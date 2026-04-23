import { config } from "../config/appConfig";

// Note: config.apiBaseUrl already includes /api suffix
const API_BASE_URL = config.apiBaseUrl.replace(/\/api$/, "");

/**
 * Execution row statuses (from DB)
 * Keep "queued" only if you actually set it in backend.
 */
export type ExecutionStatus =
  | "running"
  | "completed"
  | "failed"
  | "engine_error"
  | "queued";

/**
 * Step statuses (synthetic right now)
 * Your executionService currently writes "completed" or "skipped".
 */
export type ExecutionStepStatus = "completed" | "skipped" | "failed";

export type ExecutionSummary = {
  id: number;
  workflow_id: number;
  trigger_type: string | null;
  status: ExecutionStatus;
  started_at: string | null;
  finished_at: string | null;
  duration_ms: number | null;
  error_message: string | null;
  workflows?: {
    id: number;
    name: string | null;
  } | null;
};

export type ExecutionRecord = {
  id: number;
  workflow_id: number;
  trigger_type: string | null;
  status: ExecutionStatus;
  run_context: string | null; // JSON string from DB
  started_at: string | null;
  finished_at: string | null;
  duration_ms: number | null;
  error_message: string | null;
  workflows?: {
    id: number;
    name: string | null;
  } | null;
};

export type ExecutionStep = {
  id: number;
  execution_id: number;
  node_id: number;
  status: ExecutionStepStatus;
  input_json: string | null;
  output_json: string | null;
  logs: string | null;
  started_at: string | null;
  finished_at: string | null;
  workflow_nodes?: {
    id: number;
    name: string | null;
    kind: string;
  } | null;
};

export type ExecutionDetailResponse = {
  execution: ExecutionRecord;
  steps: ExecutionStep[];
  n8nResult?: unknown;
};

function buildUrl(path: string) {
  return `${API_BASE_URL}${path}`;
}

export async function fetchExecutions(params?: {
  status?: ExecutionStatus;
  workflowId?: number;
}): Promise<ExecutionSummary[]> {
  const query = new URLSearchParams();
  if (params?.status) query.set("status", params.status);
  if (typeof params?.workflowId === "number") {
    query.set("workflowId", String(params.workflowId));
  }

  const res = await fetch(
    buildUrl(`/api/executions${query.toString() ? `?${query}` : ""}`)
  );

  if (!res.ok) {
    throw new Error("Failed to fetch executions");
  }

  const json = (await res.json()) as { data?: ExecutionSummary[] };
  return json.data ?? [];
}

export async function fetchExecution(id: number): Promise<ExecutionRecord> {
  const res = await fetch(buildUrl(`/api/executions/${id}`));
  if (!res.ok) {
    throw new Error(`Failed to fetch execution ${id}`);
  }
  const json = (await res.json()) as { data: ExecutionRecord };
  return json.data;
}

export async function fetchExecutionSteps(id: number): Promise<ExecutionStep[]> {
  const res = await fetch(buildUrl(`/api/executions/${id}/steps`));
  if (!res.ok) {
    throw new Error(`Failed to fetch steps for execution ${id}`);
  }
  const json = (await res.json()) as { data?: ExecutionStep[] };
  return json.data ?? [];
}

/**
 * Convenience helper used right after POST /api/workflows/:id/execute.
 * You can also call this from the detail page if you want to refetch.
 */
export async function fetchExecutionWithSteps(
  id: number
): Promise<ExecutionDetailResponse> {
  const [execution, steps] = await Promise.all([
    fetchExecution(id),
    fetchExecutionSteps(id),
  ]);

  // n8n result is stored inside run_context.engine.n8n
  let n8nResult: unknown = undefined;

  if (execution.run_context) {
    try {
      const ctx = JSON.parse(execution.run_context) as {
        engine?: { n8n?: unknown };
      };
      n8nResult = ctx?.engine?.n8n;
    } catch {
      // ignore parse errors
    }
  }

  return { execution, steps, n8nResult };
}
