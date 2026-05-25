import { Prisma } from "@prisma/client";

type CaseUserSummary = Pick<Prisma.usersGetPayload<{}>, "id" | "email" | "full_name">;
type CaseFlowSummary = Pick<Prisma.case_flowsGetPayload<{}>, "id" | "key" | "name" | "case_type">;
type CaseSummarySource = Prisma.casesGetPayload<{}> & {
  assignee_user?: CaseUserSummary | null;
  assignee_team?: Prisma.teamsGetPayload<{}> | null;
  case_flows?: CaseFlowSummary | null;
};
type CaseDetailSource = CaseSummarySource & {
  case_tasks?: Prisma.case_tasksGetPayload<{}>[];
  case_approvals?: Prisma.case_approvalsGetPayload<{}>[];
  case_escalations?: Prisma.case_escalationsGetPayload<{}>[];
  case_documents?: Prisma.case_documentsGetPayload<{}>[];
  case_events?: Prisma.case_eventsGetPayload<{}>[];
};

export const toCaseSummary = (caseRecord: CaseSummarySource) => ({
  id: caseRecord.id,
  case_reference: caseRecord.case_reference,
  case_type: caseRecord.case_type,
  title: caseRecord.title,
  status: caseRecord.status,
  priority: caseRecord.priority,
  opened_at: caseRecord.opened_at,
  resolved_at: caseRecord.resolved_at,
  current_node_key: caseRecord.current_node_key,
  current_task_id: caseRecord.current_task_id,
  assignee_user: caseRecord.assignee_user ?? null,
  assignee_team: caseRecord.assignee_team ?? null,
  flow: caseRecord.case_flows ?? null,
});

export const toCaseDetail = (caseRecord: CaseDetailSource) => ({
  ...toCaseSummary(caseRecord),
  case_data_json: caseRecord.case_data_json,
  outcome_json: caseRecord.outcome_json,
  intake_source: caseRecord.intake_source,
  created_by_user_id: caseRecord.created_by_user_id,
  tasks: caseRecord.case_tasks ?? [],
  approvals: caseRecord.case_approvals ?? [],
  escalations: caseRecord.case_escalations ?? [],
  documents: (caseRecord.case_documents ?? []).map((document) => ({
    id: document.id,
    case_id: document.case_id,
    task_id: document.task_id,
    flow_node_key: document.flow_node_key,
    filename: document.filename,
    mime_type: document.mime_type,
    document_type: document.document_type,
    metadata_json: document.metadata_json,
    uploaded_by_user_id: document.uploaded_by_user_id,
    uploaded_at: document.uploaded_at,
  })),
  events: caseRecord.case_events ?? [],
});
