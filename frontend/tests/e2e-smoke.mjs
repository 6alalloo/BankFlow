import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import vm from "node:vm";
import ts from "typescript";

const API_BASE_URL = process.env.BANKFLOW_API_URL ?? "http://localhost:3000/api";
const FRONTEND_URL = process.env.BANKFLOW_FRONTEND_URL ?? "http://127.0.0.1:5173";

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });

  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(`${options.method ?? "GET"} ${path} failed (${response.status}): ${text}`);
  }
  return body;
}

async function requestRaw(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });
  const text = await response.text();
  return {
    ok: response.ok,
    status: response.status,
    body: text ? JSON.parse(text) : null,
    text,
  };
}

function loadFrontendTemplates() {
  const templatePath = resolve(import.meta.dirname, "../src/data/templates.ts");
  const source = readFileSync(templatePath, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText;
  const sandbox = {
    exports: {},
    module: { exports: {} },
  };
  sandbox.exports = sandbox.module.exports;
  vm.runInNewContext(output, sandbox, { filename: templatePath });
  return sandbox.module.exports.templates ?? sandbox.exports.templates;
}

async function certifyTemplates(authHeaders) {
  const templates = loadFrontendTemplates();
  assert.ok(Array.isArray(templates) && templates.length > 0, "frontend templates should be loadable");

  for (const template of templates) {
    const created = await request("/flows", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        name: `Template Certification ${template.name} ${Date.now()}`,
        description: template.description,
        caseType: template.id.replace(/-/g, "_"),
      }),
    });
    const flowId = created.data.id;
    const nodeIdByTemplateId = new Map();

    try {
      for (const node of template.nodes) {
        const createdNode = await request(`/flows/${flowId}/nodes`, {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify({
            kind: node.kind,
            name: node.name,
            posX: node.pos_x,
            posY: node.pos_y,
            config: node.config,
          }),
        });
        nodeIdByTemplateId.set(node.id, createdNode.data.id);
      }

      for (const edge of template.edges) {
        await request(`/flows/${flowId}/edges`, {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify({
            fromNodeId: nodeIdByTemplateId.get(edge.from),
            toNodeId: nodeIdByTemplateId.get(edge.to),
            label: edge.label,
            condition: edge.condition,
          }),
        });
      }

      const published = await request(`/flows/${flowId}/publish`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ changeSummary: "Template certification smoke test" }),
      });
      assert.ok(published.data?.id, `${template.name} should publish`);
    } finally {
      await request(`/flows/${flowId}`, {
        method: "DELETE",
        headers: authHeaders,
      }).catch(() => null);
    }
  }
}

async function verifySecurityBoundaries(authHeaders, flows) {
  const paymentFlow = flows.data.find(
    (flow) => flow.name === "Payment Exception Review" && flow.status === "published" && flow.current_published_version_id
  );
  assert.ok(paymentFlow, "payment exception flow should be available for permission checks");

  const createdCase = await request("/cases", {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({
      flowId: paymentFlow.id,
      title: `E2E Permission ${Date.now()}`,
      priority: "normal",
      intakeSource: "e2e-smoke",
      caseData: { paymentId: "PAY-SMOKE-AUDIT", amount: 1250, currency: "BHD" },
    }),
  });

  const documentForm = new FormData();
  documentForm.set("documentType", "payment_instruction");
  documentForm.set(
    "file",
    new Blob(["%PDF-1.4\n% BankFlow smoke fixture\n%%EOF\n"], { type: "application/pdf" }),
    "smoke-payment-instruction.pdf"
  );
  const uploadResponse = await fetch(`${API_BASE_URL}/files/cases/${createdCase.data.id}/upload`, {
    method: "POST",
    headers: { Authorization: authHeaders.Authorization },
    body: documentForm,
  });
  assert.equal(uploadResponse.status, 201, "admin should upload a case document");
  const uploaded = await uploadResponse.json();
  assert.ok(uploaded.data?.id, "document upload should return a document id");

  const auditor = await request("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: "auditor@bankflow.local", password: "auditor123" }),
  });
  assert.ok(auditor.token, "auditor login should return a JWT");
  const auditorHeaders = { Authorization: `Bearer ${auditor.token}` };
  const auditorCase = await request(`/cases/${createdCase.data.id}`, { headers: auditorHeaders });
  assert.equal(auditorCase.data.id, createdCase.data.id, "auditor should be able to inspect case detail");
  const auditorClose = await requestRaw(`/cases/${createdCase.data.id}/close`, {
    method: "POST",
    headers: auditorHeaders,
    body: JSON.stringify({ reason: "read-only smoke check" }),
  });
  assert.equal(auditorClose.status, 403, "auditor should not be able to close cases");

  const approver = await request("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: "approver@bankflow.local", password: "approver123" }),
  });
  const approverHeaders = { Authorization: `Bearer ${approver.token}` };
  const approverCase = await requestRaw(`/cases/${createdCase.data.id}`, { headers: approverHeaders });
  assert.equal(approverCase.status, 403, "approver outside the assigned team should not view the protected case");
  const approverDocument = await requestRaw(`/files/documents/${uploaded.data.id}`, { headers: approverHeaders });
  assert.equal(approverDocument.status, 403, "approver outside the assigned team should not view protected documents");
}

async function main() {
  const frontendResponse = await fetch(FRONTEND_URL);
  assert.equal(frontendResponse.status, 200, "frontend dev server should respond");
  assert.match(await frontendResponse.text(), /<div id="root">/, "frontend should serve the React root");

  const login = await request("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: "admin@bankflow.local", password: "admin123" }),
  });
  assert.ok(login.token, "login should return a JWT");
  assert.equal(login.user?.email, "admin@bankflow.local");

  const authHeaders = { Authorization: `Bearer ${login.token}` };
  await certifyTemplates(authHeaders);

  const flows = await request("/flows", { headers: authHeaders });
  assert.ok(Array.isArray(flows.data), "flows response should include data array");
  await verifySecurityBoundaries(authHeaders, flows);

  const publishedFlow = flows.data.find((flow) => flow.status === "published" && flow.current_published_version_id);
  assert.ok(publishedFlow, "at least one published seeded flow should exist");

  const createdCase = await request("/cases", {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({
      flowId: publishedFlow.id,
      title: `E2E Smoke ${Date.now()}`,
      priority: "normal",
      intakeSource: "e2e-smoke",
      caseData: { smoke: true },
    }),
  });
  assert.ok(createdCase.data?.id, "case creation should return a case id");
  assert.ok(createdCase.data?.events?.some((event) => event.event_type === "case_created"), "case should include creation event");

  const caseDetail = await request(`/cases/${createdCase.data.id}`, { headers: authHeaders });
  assert.equal(caseDetail.data.id, createdCase.data.id, "case detail should be retrievable");
  assert.ok(Array.isArray(caseDetail.data.tasks), "case detail should include tasks");
  assert.ok(Array.isArray(caseDetail.data.events), "case detail should include timeline events");

  const cases = await request("/cases", { headers: authHeaders });
  assert.ok(
    cases.data.some((item) => item.id === createdCase.data.id),
    "case list should include newly created case"
  );

  const tasks = await request("/tasks", { headers: authHeaders });
  assert.ok(Array.isArray(tasks.data), "tasks endpoint should return data array");

  const approvals = await request("/approvals", { headers: authHeaders });
  assert.ok(Array.isArray(approvals.data), "approvals endpoint should return data array");

  const dashboard = await request("/dashboard/stats", { headers: authHeaders });
  assert.equal(typeof dashboard.totalCases, "number", "dashboard stats should expose totalCases");
  assert.equal(typeof dashboard.casesByStatus, "object", "dashboard stats should expose casesByStatus");

  console.log("BankFlow E2E smoke test passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
