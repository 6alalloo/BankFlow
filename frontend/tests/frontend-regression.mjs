import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const read = (path) => readFileSync(resolve(root, path), "utf8");

const casesApi = read("src/api/cases.ts");
const tasksApi = read("src/api/tasks.ts");
const approvalsApi = read("src/api/approvals.ts");
const filesApi = read("src/api/files.ts");
const casesListPage = read("src/pages/Cases/CasesListPage.tsx");
const caseDetailPage = read("src/pages/Cases/CaseDetailPage.tsx");
const tasksWorkbenchPage = read("src/pages/Tasks/TasksWorkbenchPage.tsx");
const approvalsInboxPage = read("src/pages/Approvals/ApprovalsInboxPage.tsx");
const dashboardPage = read("src/pages/Dashboard/DashboardPage.tsx");
const appPage = read("src/App.tsx");
const sidebar = read("src/layout/sidebar.tsx");
const templates = read("src/data/templates.ts");

const expectIncludes = (label, content, snippets) => {
  for (const snippet of snippets) {
    assert.ok(
      content.includes(snippet),
      `${label} is missing expected wiring: ${snippet}`
    );
  }
};

expectIncludes("cases API", casesApi, [
  "export async function fetchCases(query: CasesQuery = {})",
  "export async function fetchCaseById",
  "export async function createCase",
  "export async function closeCase",
  "export async function cancelCase",
  "export async function addCaseNote",
  "export async function resolveEscalation",
]);

expectIncludes("tasks API", tasksApi, [
  "export async function fetchTasks",
  "export async function claimTask",
  "export async function completeTask",
  "export async function reassignTask",
  "export async function processOverdueWork",
  "/tasks/sla/process-overdue",
]);

expectIncludes("approvals API", approvalsApi, [
  "export async function fetchApprovals",
  "export async function approveApproval",
  "export async function rejectApproval",
  "export async function reassignApproval",
]);

expectIncludes("files API", filesApi, [
  "export async function uploadCaseDocument",
  "FormData",
  "export async function downloadCaseDocument",
  "/files/documents/${documentId}/download",
]);

expectIncludes("case detail page", caseDetailPage, [
  "claimTask(task.id)",
  "completeTask(taskId",
  "approveApproval(approval.id",
  "rejectApproval(approval.id",
  "uploadCaseDocument({",
  "downloadCaseDocument(document.id",
  "resolveEscalation(caseDetail.id",
  "addCaseNote(caseDetail.id",
  "closeCase(caseDetail.id",
  "cancelCase(caseDetail.id",
  "getTaskOutputFields(task.task_type)",
  "Additional output JSON",
]);

expectIncludes("cases list page", casesListPage, [
  "fetchTasks(taskQuery)",
  "fetchApprovals({ status: \"requested\" })",
  "processOverdueWork()",
  "New Case",
  "createCase({",
  "pending_action",
  "pending_approval",
  "escalated",
  "buildObjectFromFields(caseFields, createFieldValues)",
  "Additional Case Data JSON",
]);

expectIncludes("tasks workbench page", tasksWorkbenchPage, [
  "fetchTasks(query)",
  "claimTask(task.id)",
  "processOverdueWork()",
  "Open Case",
]);

expectIncludes("approvals inbox page", approvalsInboxPage, [
  "fetchApprovals(currentFilter.query)",
  "approveApproval(approval.id",
  "rejectApproval(approval.id",
  "Decision Reason",
]);

expectIncludes("application routes", appPage, [
  'path="/tasks"',
  'path="/approvals"',
  "TasksWorkbenchPage",
  "ApprovalsInboxPage",
]);

expectIncludes("sidebar navigation", sidebar, [
  'to="/tasks"',
  'to="/approvals"',
  "My Tasks",
  "Approvals",
]);

expectIncludes("dashboard page", dashboardPage, [
  "fetchCases()",
  "casesByStatus.resolved",
  "casesByStatus.closed",
  "casesByStatus.escalated",
  "item.opened_at",
  'navigate("/tasks")',
  'navigate("/approvals")',
]);

expectIncludes("builder templates", templates, [
  "AML Alert Review",
  "Payment Exception Review",
  "Supervisor Approval",
  "Collect Payment Evidence",
  "status_update",
]);

console.log("Frontend regression wiring tests passed");
