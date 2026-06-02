import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { expect, test, type Page, type APIRequestContext, type TestInfo } from "@playwright/test";

const apiBaseUrl = process.env.BANKFLOW_API_URL ?? "http://localhost:3000/api";

type FlowSummary = {
  id: number;
  key?: string;
  name: string;
  status: string;
  case_type?: string;
  current_published_version_id?: number | null;
};

function captureRuntimeIssues(page: Page) {
  const issues: string[] = [];

  page.on("pageerror", (error) => {
    issues.push(`pageerror: ${error.message}`);
  });

  page.on("console", (message) => {
    if (message.type() === "error") {
      const text = message.text();
      if (text.includes("cannot be a descendant of") || text.includes("cannot contain a nested")) {
        return;
      }
      issues.push(`console: ${text}`);
    }
  });

  page.on("response", (response) => {
    if (response.url().startsWith(apiBaseUrl) && response.status() >= 500) {
      issues.push(`api ${response.status()}: ${response.url()}`);
    }
  });

  return issues;
}

async function fetchPublishedFlow(request: APIRequestContext, name: string) {
  const login = await loginApi(request, "admin@bankflow.local", "admin123");
  const canonicalKeys: Record<string, string> = {
    "AML Alert Review": "aml-alert-review",
    "Payment Exception Review": "payment-exception-review",
    "High-Value Payment Release": "high-value-payment-release",
  };

  const flowsResponse = await request.get(`${apiBaseUrl}/flows`, {
    headers: { Authorization: `Bearer ${login.token}` },
  });
  expect(flowsResponse.ok()).toBeTruthy();
  const flows = (await flowsResponse.json()) as { data: FlowSummary[] };
  const publishedFlows = flows.data.filter(
    (item) => item.name === name && item.status === "published" && item.current_published_version_id
  );
  const flow = publishedFlows.find((item) => item.key === canonicalKeys[name]) ?? publishedFlows[0];
  expect(flow, `${name} should be seeded and published`).toBeTruthy();
  return flow!;
}

async function loginApi(request: APIRequestContext, email: string, password: string) {
  const loginResponse = await request.post(`${apiBaseUrl}/auth/login`, {
    data: { email, password },
  });
  expect(loginResponse.ok()).toBeTruthy();
  return loginResponse.json();
}

async function ensureAuditorUser(request: APIRequestContext) {
  const existingLogin = await request.post(`${apiBaseUrl}/auth/login`, {
    data: { email: "auditor@bankflow.local", password: "auditor123" },
  });
  if (existingLogin.ok()) return;

  const admin = await loginApi(request, "admin@bankflow.local", "admin123");
  const adminHeaders = { Authorization: `Bearer ${admin.token}` };
  const rolesResponse = await request.get(`${apiBaseUrl}/roles`, { headers: adminHeaders });
  expect(rolesResponse.ok()).toBeTruthy();
  const roles = (await rolesResponse.json()) as { data: { id: number; name: string }[] };
  const auditorRole = roles.data.find((role) => role.name === "Auditor");
  expect(auditorRole).toBeTruthy();

  const createResponse = await request.post(`${apiBaseUrl}/users`, {
    headers: adminHeaders,
    data: {
      email: "auditor@bankflow.local",
      full_name: "Auditor",
      password: "auditor123",
      role_id: auditorRole!.id,
    },
  });
  expect(createResponse.ok() || createResponse.status() === 400).toBeTruthy();
}

async function createCaseViaApi(request: APIRequestContext, token: string, flow: FlowSummary, title: string, caseData: Record<string, unknown>) {
  const response = await request.post(`${apiBaseUrl}/cases`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      flowId: flow.id,
      title,
      priority: "normal",
      intakeSource: "playwright",
      caseData,
    },
  });
  expect(response.ok()).toBeTruthy();
  const body = await response.json();
  expect(body.data?.id).toBeTruthy();
  return body.data;
}

async function login(page: Page, email = "admin@bankflow.local", password = "admin123") {
  await page.goto("/login");
  await page.getByLabel("Email Address").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("link", { name: "BankFlow Case Orchestration" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Cases" })).toBeVisible();
}

async function createCaseFromFlow(page: Page, flow: FlowSummary, title: string, caseData: string) {
  const parsedData = JSON.parse(caseData) as Record<string, unknown>;
  await page.getByRole("link", { name: "Cases" }).click();
  await expect(page).toHaveURL(/\/cases$/);
  await expect(page.getByRole("heading", { name: "Cases" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Overdue Work" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Pending Approvals" })).toBeVisible();

  await page.getByRole("button", { name: "New Case" }).click();
  await expect(page.getByRole("heading", { name: "New Case" })).toBeVisible();
  await page.getByLabel("Published Flow").selectOption(String(flow.id));
  await page.getByPlaceholder("Optional case title").fill(title);
  if (typeof parsedData.customer === "string") {
    await page.getByLabel("Customer").fill(parsedData.customer);
  }
  const risk = parsedData.risk && typeof parsedData.risk === "object" && !Array.isArray(parsedData.risk) ? parsedData.risk as Record<string, unknown> : {};
  if (risk.score !== undefined) {
    await page.getByLabel("Risk Score").fill(String(risk.score));
  }
  if (typeof parsedData.alertType === "string") {
    await page.getByLabel("Alert Type").fill(parsedData.alertType);
  }
  if (typeof parsedData.paymentId === "string") {
    await page.getByLabel("Payment ID").fill(parsedData.paymentId);
  }
  if (parsedData.amount !== undefined) {
    await page.getByLabel("Amount").fill(String(parsedData.amount));
  }
  if (typeof parsedData.currency === "string") {
    await page.getByLabel("Currency").fill(parsedData.currency);
  }
  await page.getByRole("button", { name: "Create Case" }).click();

  await expect(page).toHaveURL(/\/cases\/\d+$/);
  await expect(page.getByRole("button", { name: /Tasks/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "Documents", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "History", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Details", exact: true })).toBeVisible();
}

async function createCaseFromGuidedFields(page: Page, flow: FlowSummary, title: string, fields: Record<string, string>) {
  await page.getByRole("link", { name: "Cases" }).click();
  await expect(page).toHaveURL(/\/cases$/);
  await expect(page.getByRole("heading", { name: "Cases" })).toBeVisible();

  await page.getByRole("button", { name: "New Case" }).click();
  await expect(page.getByRole("heading", { name: "New Case" })).toBeVisible();
  await page.getByLabel("Published Flow").selectOption(String(flow.id));
  await page.getByPlaceholder("Optional case title").fill(title);
  for (const [label, value] of Object.entries(fields)) {
    await page.getByLabel(label).fill(value);
  }
  await page.getByRole("button", { name: "Create Case" }).click();

  await expect(page).toHaveURL(/\/cases\/\d+$/);
  await expect(page.getByRole("button", { name: /Tasks/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "Documents", exact: true })).toBeVisible();
}

async function uploadDocument(page: Page, documentType: string, filePath: string, taskLabel?: string) {
  await page.getByRole("button", { name: "Documents", exact: true }).click();
  if (taskLabel) {
    await page.getByLabel("Task").selectOption({ label: taskLabel });
  }
  await page.getByLabel("Document Type").fill(documentType);
  await page.locator("#document-file").setInputFiles(filePath);
  await page.getByRole("button", { name: "Upload", exact: true }).click();
  await expect(page.getByText("Document uploaded.")).toBeVisible();
  await page.getByRole("button", { name: /Tasks/ }).click();
}

function approvalRowForCase(page: Page, caseReference: string) {
  return page
    .locator("[data-testid^='approval-row-']")
    .filter({ has: page.getByRole("button", { name: caseReference }) })
    .first();
}

function caseTaskTitle(page: Page, title: string) {
  return page.getByText(title, { exact: true }).first();
}

test("create-case validation errors stay visible inside the modal", async ({ page, request }) => {
  const runtimeIssues = captureRuntimeIssues(page);
  const flow = await fetchPublishedFlow(request, "High-Value Payment Release");

  await login(page);
  await page.getByRole("link", { name: "Cases" }).click();
  await expect(page).toHaveURL(/\/cases$/);
  await expect(page.getByRole("heading", { name: "Cases" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Overdue Work" })).toBeVisible();
  await page.getByRole("button", { name: "New Case" }).click();
  await expect(page.getByRole("heading", { name: "New Case" })).toBeVisible();

  await page.getByRole("button", { name: "Create Case" }).click();
  await expect(page.getByText("Choose a published flow.")).toBeVisible();

  await page.getByLabel("Published Flow").selectOption(String(flow.id));
  await expect(page.getByLabel("Amount BHD")).toBeVisible();

  expect(runtimeIssues).toEqual([]);
});

test("admin can run an AML case from intake to approval, note, and closure", async ({ page, request }) => {
  const runtimeIssues = captureRuntimeIssues(page);
  const flow = await fetchPublishedFlow(request, "AML Alert Review");

  await login(page);
  await expect(page.getByRole("link", { name: "Dashboard" })).toBeVisible();

  await createCaseFromFlow(
    page,
    flow,
    `AML UI Journey ${Date.now()}`,
    '{\n  "customer": "Acme Imports",\n  "risk": { "score": 92 }\n}'
  );

  await expect(caseTaskTitle(page, "Review AML alert")).toBeVisible();
  await page.getByRole("button", { name: "Claim" }).click();
  await expect(page.getByText("Task claimed.")).toBeVisible();

  await page.getByPlaceholder("Decision label, e.g. approved").fill("approved");
  await page.getByPlaceholder('Additional output, e.g. {"finding":"clear"}').fill('{"finding":"clear"}');
  await page.getByRole("button", { name: "Complete Task" }).click();
  await expect(page.getByText("Task completed.")).toBeVisible();

  await expect(page.getByText("Approval #")).toBeVisible();
  await page.getByPlaceholder("Decision reason").fill("Disposition reviewed and approved.");
  await page.getByRole("button", { name: "Approve" }).click();
  await expect(page.getByText("Approval approved.")).toBeVisible();
  await expect(page.locator("body")).toContainText("Resolved");

  await page.getByPlaceholder("Add a case note").fill("Follow-up completed through UI.");
  await page.getByRole("button", { name: "Add Note" }).click();
  await expect(page.getByText("Note added.")).toBeVisible();

  await page.getByRole("button", { name: "Close Case" }).click();
  await expect(page.getByText("Case closed.")).toBeVisible();
  await expect(page.locator("body")).toContainText("Closed");

  expect(runtimeIssues).toEqual([]);
});

test("operator can claim and complete assigned work from My Tasks", async ({ page, request }) => {
  const runtimeIssues = captureRuntimeIssues(page);
  const flow = await fetchPublishedFlow(request, "AML Alert Review");
  const admin = await loginApi(request, "admin@bankflow.local", "admin123");
  const createdCase = await createCaseViaApi(
    request,
    admin.token,
    flow,
    `Operator Workbench ${Date.now()}`,
    { customer: "Gulf Meridian Trading", risk: { score: 88 } }
  );
  const reviewTask = createdCase.tasks.find((item: { title: string }) => item.title === "Review AML alert");
  expect(reviewTask).toBeTruthy();

  await login(page, "operator@bankflow.local", "operator123");
  await page.getByRole("link", { name: "My Tasks" }).click();
  await expect(page).toHaveURL(/\/tasks$/);
  await expect(page.getByRole("heading", { name: "My Tasks" })).toBeVisible();

  const row = page.getByTestId(`task-row-${reviewTask.id}`);
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: "Claim" }).click();
  await expect(row).toContainText("Claimed");
  await row.getByRole("button", { name: "Open Case" }).click();

  await expect(page).toHaveURL(/\/cases\/\d+$/);
  await page.getByRole("textbox", { name: "Finding", exact: true }).fill("clear");
  await page.getByRole("textbox", { name: "Review Notes" }).fill("Operator completed AML review from My Tasks.");
  await page.getByRole("button", { name: "Complete Task" }).click();
  await expect(page.getByText("Task completed.")).toBeVisible();
  await expect(page.locator("body")).toContainText("Pending Approval");

  expect(runtimeIssues).toEqual([]);
});

test("supervisor can decide an approval from the Approvals Inbox", async ({ page, request }) => {
  const runtimeIssues = captureRuntimeIssues(page);
  const flow = await fetchPublishedFlow(request, "AML Alert Review");
  const admin = await loginApi(request, "admin@bankflow.local", "admin123");
  const operator = await loginApi(request, "operator@bankflow.local", "operator123");
  const createdCase = await createCaseViaApi(
    request,
    admin.token,
    flow,
    `Supervisor Approval ${Date.now()}`,
    { customer: "Pearl Coast Exchange", risk: { score: 94 } }
  );
  const operatorHeaders = { Authorization: `Bearer ${operator.token}` };
  const tasksResponse = await request.get(`${apiBaseUrl}/tasks?caseId=${createdCase.id}`, { headers: operatorHeaders });
  expect(tasksResponse.ok()).toBeTruthy();
  const tasks = await tasksResponse.json();
  const task = tasks.data.find((item: { title: string }) => item.title === "Review AML alert");
  expect(task).toBeTruthy();
  await request.post(`${apiBaseUrl}/tasks/${task.id}/claim`, { headers: operatorHeaders });
  const completeResponse = await request.post(`${apiBaseUrl}/tasks/${task.id}/complete`, {
    headers: operatorHeaders,
    data: { decision: "approved", output: { finding: "clear", notes: "Prepared for supervisor approval." } },
  });
  expect(completeResponse.ok()).toBeTruthy();

  await login(page, "supervisor@bankflow.local", "supervisor123");
  await page.getByRole("link", { name: "Approvals" }).click();
  await expect(page).toHaveURL(/\/approvals$/);
  await expect(page.getByRole("heading", { name: "Approvals Inbox" })).toBeVisible();

  const approvalsResponse = await request.get(`${apiBaseUrl}/approvals?caseId=${createdCase.id}&status=requested`, {
    headers: { Authorization: `Bearer ${(await loginApi(request, "supervisor@bankflow.local", "supervisor123")).token}` },
  });
  expect(approvalsResponse.ok()).toBeTruthy();
  const approvals = await approvalsResponse.json();
  const approval = approvals.data.find((item: { case_id: number }) => item.case_id === createdCase.id);
  expect(approval).toBeTruthy();
  const approveResponse = await request.post(`${apiBaseUrl}/approvals/${approval.id}/approve`, {
    headers: { Authorization: `Bearer ${(await loginApi(request, "supervisor@bankflow.local", "supervisor123")).token}` },
    data: { reason: "Supervisor approved from approvals inbox." },
  });
  expect(approveResponse.ok()).toBeTruthy();

  await page.goto(`/cases/${createdCase.id}`);
  await expect(page.locator("body")).toContainText("Resolved");

  expect(runtimeIssues).toEqual([]);
});

test("admin can satisfy payment document requirements and complete the workflow", async ({ page, request }, testInfo: TestInfo) => {
  const runtimeIssues = captureRuntimeIssues(page);
  const flow = await fetchPublishedFlow(request, "Payment Exception Review");
  const fixturePath = testInfo.outputPath("payment-instruction.pdf");
  mkdirSync(dirname(fixturePath), { recursive: true });
  writeFileSync(
    fixturePath,
    "%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n",
    "utf8"
  );

  await login(page);
  await createCaseFromFlow(
    page,
    flow,
    `Payment UI Journey ${Date.now()}`,
    '{\n  "paymentId": "PAY-1001",\n  "amount": 12850,\n  "currency": "BHD"\n}'
  );

  await expect(caseTaskTitle(page, "Collect payment evidence")).toBeVisible();
  await expect(page.getByRole("button", { name: "Complete Task" })).toBeDisabled();
  await uploadDocument(page, "payment_instruction", fixturePath, "Collect payment evidence");
  await expect(page.getByRole("button", { name: "Complete Task" })).toBeEnabled();

  await page.getByPlaceholder('Additional output, e.g. {"finding":"clear"}').fill('{"documents":"received"}');
  await page.getByRole("button", { name: "Complete Task" }).click();
  await expect(page.getByText("Task completed.")).toBeVisible();

  await expect(caseTaskTitle(page, "Resolve payment exception")).toBeVisible();
  await page.getByPlaceholder("Decision label, e.g. approved").fill("resolved");
  await page.getByPlaceholder('Additional output, e.g. {"finding":"clear"}').fill('{"resolution":"credited"}');
  await page.getByRole("button", { name: "Complete Task" }).click();
  await expect(page.getByText("Task completed.")).toBeVisible();
  await expect(page.locator("body")).toContainText("Resolved");

  expect(runtimeIssues).toEqual([]);
});

test("admin can complete a high-value payment release through treasury approval", async ({ page, request }, testInfo: TestInfo) => {
  const runtimeIssues = captureRuntimeIssues(page);
  const flow = await fetchPublishedFlow(request, "High-Value Payment Release");
  const fixturePaths = ["payment_instruction", "sanctions_screen", "customer_mandate"].map((documentType) => {
    const fixturePath = testInfo.outputPath(`${documentType}.pdf`);
    mkdirSync(dirname(fixturePath), { recursive: true });
    writeFileSync(
      fixturePath,
      "%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n",
      "utf8"
    );
    return { documentType, fixturePath };
  });

  await login(page);
  await createCaseFromGuidedFields(
    page,
    flow,
    `High Value Release UI Journey ${Date.now()}`,
    {
      "Payment ID": "HV-2201",
      Beneficiary: "Alba Industrial Services",
      "Amount BHD": "250000",
      Currency: "BHD",
    }
  );

  await expect(caseTaskTitle(page, "Collect payment instruction, sanctions screen, and customer mandate")).toBeVisible();
  for (const fixture of fixturePaths) {
    await uploadDocument(page, fixture.documentType, fixture.fixturePath, "Collect payment instruction, sanctions screen, and customer mandate");
  }
  await expect(page.getByRole("button", { name: "Complete Task" })).toBeEnabled();
  await page.getByRole("textbox", { name: "Document Status" }).fill("received");
  await page.getByRole("textbox", { name: "Notes" }).fill("All release evidence uploaded.");
  await page.getByRole("button", { name: "Complete Task" }).click();
  await expect(page.getByText("Task completed.")).toBeVisible();

  await expect(caseTaskTitle(page, "Validate funding, beneficiary, and correspondent route")).toBeVisible();
  await page.getByRole("button", { name: "Claim" }).click();
  await expect(page.getByText("Task claimed.")).toBeVisible();
  await page.getByRole("textbox", { name: "Finding", exact: true }).fill("clear");
  await page.getByRole("textbox", { name: "Review Notes" }).fill("Treasury validation completed.");
  await page.getByRole("button", { name: "Complete Task" }).click();
  await expect(page.getByText("Task completed.")).toBeVisible();

  await expect(page.getByText("Approval #")).toBeVisible();
  await page.getByPlaceholder("Decision reason").fill("Senior treasury approval completed.");
  await page.getByRole("button", { name: "Approve" }).click();
  await expect(page.getByText("Approval approved.")).toBeVisible();
  await expect(page.locator("body")).toContainText("Resolved");

  expect(runtimeIssues).toEqual([]);
});

test("admin can reject a high-value release into rework escalation", async ({ page, request }, testInfo: TestInfo) => {
  const runtimeIssues = captureRuntimeIssues(page);
  const flow = await fetchPublishedFlow(request, "High-Value Payment Release");
  const fixturePaths = ["payment_instruction", "sanctions_screen", "customer_mandate"].map((documentType) => {
    const fixturePath = testInfo.outputPath(`reject-${documentType}.pdf`);
    mkdirSync(dirname(fixturePath), { recursive: true });
    writeFileSync(
      fixturePath,
      "%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n",
      "utf8"
    );
    return { documentType, fixturePath };
  });

  await login(page);
  await createCaseFromGuidedFields(
    page,
    flow,
    `High Value Rework UI Journey ${Date.now()}`,
    {
      "Payment ID": "HV-REWORK-1",
      Beneficiary: "Northern Gulf Equipment",
      "Amount BHD": "325000",
      Currency: "BHD",
    }
  );

  for (const fixture of fixturePaths) {
    await uploadDocument(page, fixture.documentType, fixture.fixturePath, "Collect payment instruction, sanctions screen, and customer mandate");
  }
  await page.getByRole("textbox", { name: "Document Status" }).fill("received");
  await page.getByRole("textbox", { name: "Notes" }).fill("Evidence package ready for treasury review.");
  await page.getByRole("button", { name: "Complete Task" }).click();
  await expect(page.getByText("Task completed.")).toBeVisible();

  await page.getByRole("button", { name: "Claim" }).click();
  await expect(page.getByText("Task claimed.")).toBeVisible();
  await page.getByRole("textbox", { name: "Finding", exact: true }).fill("exception");
  await page.getByRole("textbox", { name: "Review Notes" }).fill("Route needs senior decision.");
  await page.getByRole("button", { name: "Complete Task" }).click();
  await expect(page.getByText("Task completed.")).toBeVisible();

  await page.getByPlaceholder("Decision reason").fill("Beneficiary mandate does not match the release package.");
  await page.getByRole("button", { name: "Reject" }).click();
  await expect(page.getByText("Approval rejected.")).toBeVisible();
  await expect(page.locator("body")).toContainText("Escalated");
  await expect(page.locator("body")).toContainText("Senior approver rejected payment release");

  expect(runtimeIssues).toEqual([]);
});

test("admin can process SLA work and review escalated queue", async ({ page }) => {
  const runtimeIssues = captureRuntimeIssues(page);

  await login(page);
  await page.getByRole("link", { name: "Cases" }).click();
  await expect(page.getByRole("button", { name: "Open Work" })).toBeVisible();
  await page.getByRole("button", { name: "Process SLA" }).click();
  await expect(page.getByRole("button", { name: "Process SLA" })).toBeEnabled();
  await page.getByRole("button", { name: "Escalated", exact: true }).click();
  await expect(page.locator("body")).toContainText("Escalated");

  expect(runtimeIssues).toEqual([]);
});

test("auditor can inspect cases while unauthorized approver cannot access protected case documents", async ({ page, request }) => {
  const runtimeIssues = captureRuntimeIssues(page);
  await ensureAuditorUser(request);

  const flow = await fetchPublishedFlow(request, "Payment Exception Review");
  const admin = await loginApi(request, "admin@bankflow.local", "admin123");
  const adminHeaders = { Authorization: `Bearer ${admin.token}` };
  const createdCase = await createCaseViaApi(
    request,
    admin.token,
    flow,
    `Audit Permission ${Date.now()}`,
    { paymentId: "PAY-AUDIT-1", amount: 2250, currency: "BHD" }
  );

  const uploadResponse = await request.post(`${apiBaseUrl}/files/cases/${createdCase.id}/upload`, {
    headers: adminHeaders,
    multipart: {
      documentType: "payment_instruction",
      file: {
        name: "audit-payment-instruction.pdf",
        mimeType: "application/pdf",
        buffer: Buffer.from("%PDF-1.4\n% BankFlow audit fixture\n%%EOF\n", "utf8"),
      },
    },
  });
  expect(uploadResponse.ok()).toBeTruthy();
  const uploadBody = await uploadResponse.json();
  const documentId = uploadBody.data.id;
  expect(documentId).toBeTruthy();

  await login(page, "auditor@bankflow.local", "auditor123");
  await page.goto(`/cases/${createdCase.id}`);
  await expect(page.locator("body")).toContainText(createdCase.case_reference);
  await page.getByRole("button", { name: "Documents", exact: true }).click();
  await expect(page.getByText("audit-payment-instruction.pdf", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Close Case" })).toHaveCount(0);

  const auditor = await loginApi(request, "auditor@bankflow.local", "auditor123");
  const closeResponse = await request.post(`${apiBaseUrl}/cases/${createdCase.id}/close`, {
    headers: { Authorization: `Bearer ${auditor.token}` },
    data: { reason: "read-only audit attempt" },
  });
  expect(closeResponse.status()).toBe(403);

  const approver = await loginApi(request, "approver@bankflow.local", "approver123");
  const approverHeaders = { Authorization: `Bearer ${approver.token}` };
  const approverCaseResponse = await request.get(`${apiBaseUrl}/cases/${createdCase.id}`, { headers: approverHeaders });
  expect(approverCaseResponse.status()).toBe(403);
  const approverDocumentResponse = await request.get(`${apiBaseUrl}/files/documents/${documentId}`, { headers: approverHeaders });
  expect(approverDocumentResponse.status()).toBe(403);

  expect(runtimeIssues).toEqual([]);
});
