import { apiGet, apiPost, apiPatch } from "./apiClient";
import type { CaseTask } from "./cases";

export type TasksQuery = {
  status?: string;
  caseId?: number;
  assignedUserId?: number;
  assignedTeamId?: number;
  overdue?: boolean;
  claimable?: boolean;
};

const toQueryString = (query: TasksQuery = {}) => {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      params.set(key, String(value));
    }
  });
  const text = params.toString();
  return text ? `?${text}` : "";
};

export async function fetchTasks(query: TasksQuery = {}): Promise<CaseTask[]> {
  const response = await apiGet<{ data: CaseTask[] }>(`/tasks${toQueryString(query)}`);
  return response.data ?? [];
}

export async function claimTask(id: number): Promise<CaseTask> {
  const response = await apiPost<{ data: CaseTask }>(`/tasks/${id}/claim`);
  return response.data;
}

export async function completeTask(
  id: number,
  payload: { decision?: string; output?: Record<string, unknown> }
): Promise<CaseTask> {
  const response = await apiPost<{ data: CaseTask }>(`/tasks/${id}/complete`, payload);
  return response.data;
}

export async function reassignTask(
  id: number,
  payload: { assignedUserId?: number | null; assignedTeamId?: number | null }
): Promise<CaseTask> {
  const response = await apiPatch<{ data: CaseTask }>(`/tasks/${id}/assign`, payload);
  return response.data;
}

export async function processOverdueWork(): Promise<{
  overdueTasks: number;
  overdueApprovals: number;
  escalationsCreated: number;
}> {
  const response = await apiPost<{ data: { overdueTasks: number; overdueApprovals: number; escalationsCreated: number } }>(
    "/tasks/sla/process-overdue"
  );
  return response.data;
}
