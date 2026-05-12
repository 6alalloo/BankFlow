import { apiGet, apiPost, apiPatch } from "./apiClient";
import type { CaseApproval } from "./cases";

export type ApprovalsQuery = {
  status?: string;
  caseId?: number;
  requestedUserId?: number;
  requestedTeamId?: number;
  requestedRoleId?: number;
  overdue?: boolean;
};

const toQueryString = (query: ApprovalsQuery = {}) => {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      params.set(key, String(value));
    }
  });
  const text = params.toString();
  return text ? `?${text}` : "";
};

export async function fetchApprovals(query: ApprovalsQuery = {}): Promise<CaseApproval[]> {
  const response = await apiGet<{ data: CaseApproval[] }>(`/approvals${toQueryString(query)}`);
  return response.data ?? [];
}

export async function approveApproval(id: number, reason?: string): Promise<CaseApproval> {
  const response = await apiPost<{ data: CaseApproval }>(`/approvals/${id}/approve`, { reason });
  return response.data;
}

export async function rejectApproval(id: number, reason?: string): Promise<CaseApproval> {
  const response = await apiPost<{ data: CaseApproval }>(`/approvals/${id}/reject`, { reason });
  return response.data;
}

export async function reassignApproval(
  id: number,
  payload: {
    requestedFromUserId?: number | null;
    requestedFromTeamId?: number | null;
    requestedFromRoleId?: number | null;
  }
): Promise<CaseApproval> {
  const response = await apiPatch<{ data: CaseApproval }>(`/approvals/${id}/assign`, payload);
  return response.data;
}
