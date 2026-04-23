// backend/src/services/n8nService.ts
import { N8N_EXECUTE_URL, N8N_API_BASE_URL, N8N_API_KEY } from "../config/n8nConfig";
import logger from "../lib/logger";

export type N8nExecutePayload = {
  hrflowWorkflowId: number;
  executionId: number;
  nodes: Array<{
    id: number;
    name: string | null;
    kind: string;
    config?: Record<string, unknown> | null;
  }>;
  edges: Array<{
    id: number;
    from: number;
    to: number;
  }>;
  input: Record<string, unknown> | null;
};

export type N8nExecuteResult = {
  status: string;
  nodeCount: number;
  edgeCount: number;
  inputEcho: unknown;
  finishedAt: string;
  raw?: unknown;
}[];

// ---------- N8N API types (minimal) ----------
type N8nWorkflowDto = {
  id: string;
  name: string;
  active: boolean;
};

type N8nWorkflowListResponse =
  | N8nWorkflowDto[]
  | { data: N8nWorkflowDto[] }
  | { data: N8nWorkflowDto[]; nextCursor?: string };

// IMPORTANT: do NOT include `active` in v1 create/update body (read-only)
type N8nWorkflowUpsertBody = {
  name: string;
  nodes: unknown[];
  connections: Record<string, unknown>;
  settings?: Record<string, unknown>;
};

type N8nApiError = Error & { code?: string };

// ---------- helpers ----------
function requireApiKey() {
  if (!N8N_API_KEY || N8N_API_KEY.trim().length === 0) {
    const err: N8nApiError = new Error("Missing N8N_API_KEY in backend environment");
    err.code = "N8N_MISSING_API_KEY";
    throw err;
  }
}

function requireExecuteUrl(url: string | undefined | null) {
  if (!url || url.trim().length === 0) {
    const err: N8nApiError = new Error(
      "Missing n8n execute webhook URL. Provide a webhookUrl to callN8nExecute(), or set N8N_EXECUTE_URL."
    );
    err.code = "N8N_MISSING_EXECUTE_URL";
    throw err;
  }
}

async function n8nApiFetch(path: string, init?: RequestInit): Promise<Response> {
  requireApiKey();

  const url = `${N8N_API_BASE_URL}${path}`;
  let res: Response;

  try {
    res = await fetch(url, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        "X-N8N-API-KEY": N8N_API_KEY,
        ...(init?.headers ?? {}),
      },
    });
  } catch (e: any) {
    const err: N8nApiError = new Error(`Failed to reach n8n API: ${e?.message ?? String(e)}`);
    err.code = "N8N_UNREACHABLE";
    throw err;
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const err: N8nApiError = new Error(
      `n8n API error (${res.status} ${res.statusText}) on ${path}: ${text}`
    );
    err.code = "N8N_HTTP_ERROR";
    throw err;
  }

  return res;
}

function normalizeListResponse(data: N8nWorkflowListResponse): N8nWorkflowDto[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object" && "data" in data && Array.isArray((data as any).data)) {
    return (data as any).data as N8nWorkflowDto[];
  }
  return [];
}

async function findWorkflowIdByName(name: string): Promise<string | null> {
  let cursor: string | undefined;

  while (true) {
    const path = cursor ? `/workflows?cursor=${encodeURIComponent(cursor)}` : `/workflows`;
    const res = await n8nApiFetch(path, { method: "GET" });
    const data = (await res.json()) as N8nWorkflowListResponse;

    const list = normalizeListResponse(data);
    const found = list.find((w) => w.name === name);
    if (found) return found.id;

    if (data && typeof data === "object" && "nextCursor" in data && (data as any).nextCursor) {
      cursor = (data as any).nextCursor as string;
      continue;
    }

    return null;
  }
}

// Parse n8n error response nicely when possible
async function readErrorDetails(res: Response): Promise<string> {
  const text = await res.text().catch(() => "");
  if (!text) return "";
  try {
    const parsed = JSON.parse(text);
    if (parsed?.message) return String(parsed.message);
    return text;
  } catch {
    return text;
  }
}

// ---------- public API ----------

/**
 * Create or update a workflow in n8n by workflow name (stable).
 * Returns n8n workflow id.
 *
 * NOTE:
 * - n8n v1 rejects `active` in request body (read-only).
 * - Activating is done via POST /workflows/:id/activate
 */
export async function upsertN8nWorkflow(args: {
  name: string;
  nodes: unknown[];
  connections: Record<string, unknown>;
}): Promise<{ id: string; created: boolean }> {
  const existingId = await findWorkflowIdByName(args.name);

  const bodyBase: N8nWorkflowUpsertBody = {
    name: args.name,
    nodes: args.nodes,
    connections: args.connections,
    settings: {},
  };

  if (!existingId) {
    const res = await n8nApiFetch(`/workflows`, {
      method: "POST",
      body: JSON.stringify(bodyBase),
    });

    const created = (await res.json()) as { id: string };
    return { id: created.id, created: true };
  }

  await n8nApiFetch(`/workflows/${existingId}`, {
    method: "PUT",
    body: JSON.stringify(bodyBase),
  });

  return { id: existingId, created: false };
}

/**
 * Activate workflow in n8n.
 */
export async function activateN8nWorkflow(id: string): Promise<void> {
  await n8nApiFetch(`/workflows/${id}/activate`, { method: "POST" });
}

/**
 * Deactivate workflow in n8n.
 */
export async function deactivateN8nWorkflow(id: string): Promise<void> {
  await n8nApiFetch(`/workflows/${id}/deactivate`, { method: "POST" });
}

/**
 * Fetch the most recent execution for a workflow from n8n
 * Returns per-node execution data including outputs
 */
export async function getN8nExecutionForWorkflow(
  n8nWorkflowId: string
): Promise<N8nExecutionData | null> {
  try {
    logger.info("Fetching executions from n8n", {
      service: "n8nService",
      n8nWorkflowId
    });

    // Get executions for this workflow, sorted by most recent
    const res = await n8nApiFetch(
      `/executions?workflowId=${n8nWorkflowId}&limit=1`,
      { method: "GET" }
    );
    const data = await res.json();

    logger.debug("n8n executions API response", {
      service: "n8nService",
      n8nWorkflowId,
      responseKeys: Object.keys(data || {})
    });

    // Handle both array and { data: [...] } response formats
    const executions = Array.isArray(data) ? data : data?.data || [];

    logger.info("Found n8n executions", {
      service: "n8nService",
      n8nWorkflowId,
      executionCount: executions.length
    });

    if (executions.length === 0) {
      return null;
    }

    const latestExecution = executions[0];
    logger.info("Retrieved latest n8n execution", {
      service: "n8nService",
      n8nWorkflowId,
      n8nExecutionId: latestExecution.id,
      status: latestExecution.status
    });

    // Fetch full execution details with data
    const detailRes = await n8nApiFetch(
      `/executions/${latestExecution.id}?includeData=true`,
      { method: "GET" }
    );
    const executionDetail = await detailRes.json();

    logger.debug("n8n execution details retrieved", {
      service: "n8nService",
      n8nWorkflowId,
      n8nExecutionId: latestExecution.id,
      detailKeys: Object.keys(executionDetail || {}),
      hasRunData: !!executionDetail?.data?.resultData?.runData
    });

    return parseN8nExecutionData(executionDetail);
  } catch (err) {
    logger.error("Failed to fetch n8n execution details", {
      service: "n8nService",
      n8nWorkflowId,
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined
    });
    return null;
  }
}

type N8nNodeExecutionData = {
  nodeName: string;
  nodeType: string;
  data: Record<string, unknown>;
  error?: string;
  executionStatus: "success" | "error" | "unknown";
};

export type N8nExecutionData = {
  id: string;
  finished: boolean;
  status: string;
  nodeOutputs: Map<string, N8nNodeExecutionData>;
  failedNodeName?: string;
  errorMessage?: string;
};

function parseN8nExecutionData(execution: any): N8nExecutionData {
  const nodeOutputs = new Map<string, N8nNodeExecutionData>();
  let failedNodeName: string | undefined;
  let errorMessage: string | undefined;

  // n8n execution data structure: execution.data.resultData.runData
  // runData is keyed by node name, each containing array of execution items
  const runData = execution?.data?.resultData?.runData;

  // Check for overall execution error
  const executionError = execution?.data?.resultData?.error;
  if (executionError) {
    errorMessage = executionError.message || String(executionError);
    // The node that caused the error is often in the error object
    if (executionError.node?.name) {
      failedNodeName = executionError.node.name;
    }
  }

  if (runData && typeof runData === "object") {
    for (const [nodeName, nodeRuns] of Object.entries(runData)) {
      if (!Array.isArray(nodeRuns) || nodeRuns.length === 0) continue;

      // Get the last run for this node (in case of retries)
      const lastRun = nodeRuns[nodeRuns.length - 1];

      // Extract output data from the run
      // Structure: lastRun.data.main[0] contains array of output items
      let outputData: Record<string, unknown> = {};
      let nodeError: string | undefined;
      let executionStatus: "success" | "error" | "unknown" = "unknown";

      // Check for node-level error
      if (lastRun?.error) {
        nodeError = lastRun.error.message || String(lastRun.error);
        executionStatus = "error";
        // If we haven't found a failed node yet, this is it
        if (!failedNodeName) {
          failedNodeName = nodeName;
          errorMessage = nodeError;
        }
      } else if (lastRun?.data?.main) {
        const mainOutput = lastRun.data.main[0]; // First output connection
        if (Array.isArray(mainOutput) && mainOutput.length > 0) {
          // Get the first output item's json data
          const firstItem = mainOutput[0];
          if (firstItem?.json) {
            outputData = firstItem.json;
          }
        }
        executionStatus = "success";
      }

      nodeOutputs.set(nodeName, {
        nodeName,
        nodeType: lastRun?.source?.[0]?.previousNode || "unknown",
        data: outputData,
        error: nodeError,
        executionStatus,
      });
    }
  }

  return {
    id: execution?.id || "",
    finished: execution?.finished ?? false,
    status: execution?.status || "unknown",
    nodeOutputs,
    failedNodeName,
    errorMessage,
  };
}


export async function callN8nExecute(payload: N8nExecutePayload): Promise<N8nExecuteResult>;
export async function callN8nExecute(webhookUrl: string, body: unknown): Promise<N8nExecuteResult>;
export async function callN8nExecute(arg1: any, arg2?: any): Promise<N8nExecuteResult> {
  const isLegacyCall = typeof arg1 === "object" && arg1 !== null && arg2 === undefined;

  const url = isLegacyCall ? N8N_EXECUTE_URL : String(arg1);
  requireExecuteUrl(url);

  const body = isLegacyCall ? arg1 : arg2;

  let res: Response;

  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}),
    });
  } catch (err: any) {
    const error: any = new Error(
      `Failed to reach automation engine (n8n) at ${url}: ${err?.message ?? String(err)}`
    );
    error.code = "N8N_UNREACHABLE";
    throw error;
  }

  // Read text ONCE so we can both parse JSON and show meaningful errors.
  const text = await res.text().catch(() => "");

  if (!res.ok) {
    let details: string = text || "(empty response body)";

    // Try common n8n error shapes
    try {
      const parsed: any = text ? JSON.parse(text) : null;

      const candidate =
        parsed?.message ??
        parsed?.error?.message ??
        parsed?.error ??
        parsed?.cause?.message ??
        parsed?.cause ??
        parsed?.data?.message ??
        parsed;

      if (typeof candidate === "string") details = candidate;
      else if (candidate != null) details = JSON.stringify(candidate);
    } catch {
      // If it's not JSON, keep raw text (could be HTML)
    }

    // Keep logs readable (n8n can dump big stacks)
    if (details.length > 4000) details = details.slice(0, 4000) + "…(truncated)";

    const err: N8nApiError = new Error(
      `n8n webhook error (${res.status} ${res.statusText}) on ${url}: ${details}`
    );
    err.code = "N8N_HTTP_ERROR";
    throw err;
  }

  // Success: parse JSON if possible, otherwise return raw wrapper
  try {
    return (text ? JSON.parse(text) : []) as N8nExecuteResult;
  } catch {
    return [
      {
        status: "unknown",
        nodeCount: 0,
        edgeCount: 0,
        inputEcho: null,
        finishedAt: new Date().toISOString(),
        raw: text,
      },
    ];
  }
}

