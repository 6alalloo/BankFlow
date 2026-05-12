import assert from "node:assert/strict";

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
  const flows = await request("/flows", { headers: authHeaders });
  assert.ok(Array.isArray(flows.data), "flows response should include data array");

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
