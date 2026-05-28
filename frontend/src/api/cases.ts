import { apiGet, apiPost } from "./apiClient";

export type CaseSummary = {
  id: number;
  case_reference: string;
  case_type: string;
  title: string | null;
  status: string;
  priority: string;
  opened_at: string;
  assignee_user?: { id: number; email: string; full_name: string } | null;
  assignee_team?: { id: number; key: string; name: string } | null;
  flow?: { id: number; key: string; name: string; case_type: string } | null;
};

export type CaseTask = {
  id: number;
  case_id: number;
  flow_node_key: string | null;
  title: string;
  task_type: string;
  status: string;
  assigned_user_id: number | null;
  assigned_team_id: number | null;
  claim_policy: "direct_assign" | "claim_required";
  due_at: string | null;
  completed_at: string | null;
  input_json?: unknown;
  output_json?: unknown;
  assigned_user?: { id: number; email: string; full_name: string } | null;
  assigned_team?: { id: number; key: string; name: string } | null;
  case?: { id: number; case_reference: string; title: string | null; status: string; priority: string } | null;
};

export type CaseApproval = {
  id: number;
  case_id: number;
  flow_node_key: string | null;
  status: string;
  requested_from_user_id: number | null;
  requested_from_team_id: number | null;
  requested_from_role_id: number | null;
  requested_at: string;
  due_at?: string | null;
  decided_at: string | null;
  decision_reason: string | null;
  approval_label?: string;
  case?: { id: number; case_reference: string; title: string | null; status: string } | null;
  requested_from_user?: { id: number; email: string; full_name: string } | null;
  requested_from_team?: { id: number; key: string; name: string } | null;
  requested_from_role?: { id: number; name: string } | null;
  decided_by_user?: { id: number; email: string; full_name: string } | null;
};

export type CaseEvent = {
  id: number;
  case_id: number;
  event_type: string;
  summary: string;
  flow_node_key: string | null;
  task_id: number | null;
  actor_user_id: number | null;
  created_at: string;
  data_json?: unknown;
};

export type CaseDocument = {
  id: number;
  case_id: number;
  task_id: number | null;
  flow_node_key: string | null;
  filename: string;
  mime_type: string;
  document_type: string | null;
  uploaded_by_user_id: number | null;
  uploaded_at: string;
};

export type CaseEscalation = {
  id: number;
  case_id: number;
  source_task_id?: number | null;
  flow_node_key: string | null;
  status: string;
  escalation_type: string;
  reason: string;
  from_user_id?: number | null;
  to_user_id?: number | null;
  to_team_id?: number | null;
  triggered_at: string;
  resolved_at: string | null;
  resolved_by_user_id?: number | null;
};

export type CaseDetail = CaseSummary & {
  case_data_json?: unknown;
  outcome_json?: unknown;
  intake_source: string | null;
  created_by_user_id: number | null;
  current_node_key?: string | null;
  current_task_id?: number | null;
  resolved_at?: string | null;
  tasks: CaseTask[];
  approvals: CaseApproval[];
  events: CaseEvent[];
  documents: CaseDocument[];
  escalations: CaseEscalation[];
};

export type CreateCasePayload = {
  flowId: number;
  title?: string;
  priority?: "low" | "normal" | "high" | "critical";
  intakeSource?: string;
  caseData?: Record<string, unknown>;
};

export type CasesQuery = {
  status?: string;
  priority?: string;
  search?: string;
  flowId?: number;
  assigneeUserId?: number;
  assigneeTeamId?: number;
};

const toQueryString = (query: CasesQuery = {}) => {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      params.set(key, String(value));
    }
  });
  const text = params.toString();
  return text ? `?${text}` : "";
};

export async function fetchCases(query: CasesQuery = {}): Promise<CaseSummary[]> {
  const json = await apiGet<{ data?: CaseSummary[] }>(`/cases${toQueryString(query)}`);
  return json.data ?? [];
}

export async function closeCase(id: number, reason?: string): Promise<CaseDetail> {
  const json = await apiPost<{ data?: CaseDetail }>(`/cases/${id}/close`, { reason });
  if (!json.data) throw new Error("Unexpected close case response shape");
  return json.data;
}

export async function cancelCase(id: number, reason?: string): Promise<CaseDetail> {
  const json = await apiPost<{ data?: CaseDetail }>(`/cases/${id}/cancel`, { reason });
  if (!json.data) throw new Error("Unexpected cancel case response shape");
  return json.data;
}

export async function addCaseNote(id: number, note: string): Promise<CaseEvent> {
  const json = await apiPost<{ data?: CaseEvent }>(`/cases/${id}/notes`, { note });
  if (!json.data) throw new Error("Unexpected note response shape");
  return json.data;
}

export async function resolveEscalation(caseId: number, escalationId: number, reason?: string): Promise<CaseEscalation> {
  const json = await apiPost<{ data?: CaseEscalation }>(`/cases/${caseId}/escalations/${escalationId}/resolve`, { reason });
  if (!json.data) throw new Error("Unexpected escalation response shape");
  return json.data;
}

export async function createManualEscalation(
  caseId: number,
  payload: { reason: string; toUserId?: number | null; toTeamId?: number | null }
): Promise<CaseEscalation> {
  const json = await apiPost<{ data?: CaseEscalation }>(`/cases/${caseId}/escalations`, {
    ...payload,
    escalationType: "manual",
  });
  if (!json.data) throw new Error("Unexpected escalation response shape");
  return json.data;
}

export async function fetchCaseById(id: number): Promise<CaseDetail> {
  const json = await apiGet<{ data?: CaseDetail }>(`/cases/${id}`);
  if (!json.data) throw new Error("Unexpected case detail response shape");
  return json.data;
}

export async function createCase(payload: CreateCasePayload): Promise<CaseDetail> {
  const json = await apiPost<{ data?: CaseDetail }>("/cases", payload);
  if (!json.data) throw new Error("Unexpected create case response shape");
  return json.data;
}
