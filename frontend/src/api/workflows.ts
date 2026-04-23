import { getAuthToken } from "../contexts/AuthContext";
import { config } from "../config/appConfig";

const API_BASE_URL = config.apiBaseUrl;

// Helper to get auth headers for API calls
function getAuthHeaders(): Record<string, string> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}


/* ---------- Core API types ---------- */

// Shape of workflow as returned by the backend
export type WorkflowApi = {
  id: number;
  owner_user_id: number | null;
  name: string;
  description: string | null;
  is_active: boolean;
  version: number;
  default_trigger: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
  users?: {
    id: number;
    full_name: string;
    email: string;
  } | null;
};

export type CreateWorkflowNodePayload = {
  kind: string;
  name?: string;
  posX?: number;
  posY?: number;
  config?: Record<string, unknown>;
};

export type ExecutionApi = {
  id: number;
  workflow_id: number | null;
  trigger_type: string;
  status: string;
  run_context: string | null;
  started_at: string;
  finished_at: string | null;
  duration_ms: number | null;
  error_message: string | null;
};

// Shape of step payload
export type ExecutionStepApi = {
  id: number;
  execution_id: number;
  node_id: number | null;
  status: string;
  input_json: string;
  output_json: string;
  logs: string | null;
  started_at: string;
  finished_at: string | null;
  workflow_nodes?: {
    id: number;
    name: string | null;
    kind: string;
  };
};

type ExecutionResponse = ExecutionApi | { data: ExecutionApi };

type ExecutionStepsResponse =
  | ExecutionStepApi[]
  | { data: ExecutionStepApi[] };

/* ---------- List workflows ---------- */

type WorkflowsListResponse =
  | WorkflowApi[]
  | { data: WorkflowApi[] }
  | { workflows: WorkflowApi[] };

export type WorkflowGraphMeta = {
  id: number;
  name: string;
  description: string | null;
  is_active?: boolean;
  isActive?: boolean;
  version?: number;
  default_trigger?: string | null;
  defaultTrigger?: string | null;
  archived_at?: string | null;
  archivedAt?: string | null;
  created_at?: string;
  createdAt?: string;
  updated_at?: string;
  updatedAt?: string;
};


export type WorkflowGraphConfig = Record<string, unknown>;

// Node type used in the frontend (normalized)
export type WorkflowGraphNode = {
  id: number;
  workflow_id: number;
  kind: string;
  name: string | null;
  pos_x: number;
  pos_y: number;
  config?: WorkflowGraphConfig;
};

// Edge type used in the frontend (normalized)
export type WorkflowGraphEdge = {
  id: number;
  workflow_id: number;
  from_node_id: number;
  to_node_id: number;
  label: string | null;
  priority: number | null;
  condition?: WorkflowGraphConfig;
};

/* ---------- Raw shapes from backend ---------- */

type RawWorkflowGraphMeta = {
  id: number;
  name: string;
  description?: string | null;
  is_active?: boolean;
  isActive?: boolean;
  version?: number;
  default_trigger?: string | null;
  defaultTrigger?: string | null;
  archived_at?: string | null;
  archivedAt?: string | null;
  created_at?: string;
  createdAt?: string;
  updated_at?: string;
  updatedAt?: string;
};

type RawWorkflowGraphNode = {
  id: number;
  workflow_id?: number;
  workflowId?: number;
  kind: string;
  name?: string | null;
  pos_x?: number;
  posX?: number;
  pos_y?: number;
  posY?: number;
  config?: WorkflowGraphConfig;
  config_json?: string | null;
};

type RawWorkflowGraphEdge = {
  id: number;
  workflow_id?: number;
  workflowId?: number;
  from_node_id?: number;
  fromNodeId?: number;
  to_node_id?: number;
  toNodeId?: number;
  label?: string | null;
  priority?: number | null;
  condition?: WorkflowGraphConfig;
  condition_json?: string | null;
};

type WorkflowGraphPayload = {
  workflow?: RawWorkflowGraphMeta;
  nodes: RawWorkflowGraphNode[];
  edges: RawWorkflowGraphEdge[];
};

type WorkflowGraphResponse =
  | WorkflowGraphPayload
  | { data: WorkflowGraphPayload };

type WorkflowNodePositionDto = {
  id: number;
  workflowId: number;
  kind: string;
  name: string | null;
  config: Record<string, unknown>;
  posX: number;
  posY: number;
};

type UpdateNodePositionResponse =
  | WorkflowNodePositionDto
  | { data: WorkflowNodePositionDto };

/* ---------- Edge DTOs for create/update ---------- */

export type CreateWorkflowEdgePayload = {
  fromNodeId: number;
  toNodeId: number;
  label?: string | null;
  priority?: number | null;
  condition?: WorkflowGraphConfig;
};

type WorkflowEdgeDto = {
  id: number;
  workflowId: number;
  fromNodeId: number;
  toNodeId: number;
  label: string | null;
  priority: number;
  condition: WorkflowGraphConfig;
};

type WorkflowEdgeResponse = WorkflowEdgeDto | { data: WorkflowEdgeDto };

/* ---------- helpers ---------- */

function safeParseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

// GET /api/workflows
export async function fetchWorkflows(): Promise<WorkflowApi[]> {
  const res = await fetch(`${API_BASE_URL}/workflows`, {
    headers: getAuthHeaders(),
  });

  if (!res.ok) {
    console.error(
      "[fetchWorkflows] HTTP error:",
      res.status,
      res.statusText
    );
    throw new Error(`Failed to fetch workflows (status ${res.status})`);
  }

  const data = (await res.json()) as WorkflowsListResponse;
  console.log("[fetchWorkflows] raw response:", data);

  if (Array.isArray(data)) {
    return data;
  }

  if ("data" in data) {
    return data.data;
  }

  if ("workflows" in data) {
    return data.workflows;
  }

  throw new Error("Unexpected workflows response shape");
}

/* ---------- Execute workflow ---------- */

// POST /api/workflows/:id/execute
export async function executeWorkflow(
  workflowId: number,
  input?: Record<string, unknown> | null,
  triggerType?: string
): Promise<{
  execution: ExecutionApi;
  steps: ExecutionStepApi[];
  // backend may include this; keep it optional so it doesn't break typing
  n8nResult?: unknown;
}> {
  const res = await fetch(`${API_BASE_URL}/workflows/${workflowId}/execute`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({
      triggerType: triggerType ?? "manual",
      input: input ?? {},
    }),
  });

  if (!res.ok) {
    console.error("[executeWorkflow] HTTP error:", res.status, res.statusText);
    // Try to extract error message from response body
    let errorMessage = `Failed to execute workflow (status ${res.status})`;
    try {
      const errorBody = await res.json();
      if (errorBody.message) {
        errorMessage = errorBody.message;
      }
    } catch {
      // Ignore JSON parse errors
    }
    throw new Error(errorMessage);
  }

  const json = (await res.json()) as
    | {
        data: {
          execution: ExecutionApi;
          steps: ExecutionStepApi[];
          n8nResult?: unknown;
        };
      }
    | {
        execution: ExecutionApi;
        steps: ExecutionStepApi[];
        n8nResult?: unknown;
      };

  if ("data" in json) return json.data;
  return json;
}

/* ---------- Single workflow + graph ---------- */

// Response type for GET /api/workflows/:id
type WorkflowByIdResponse = WorkflowApi | { data: WorkflowApi };

// GET /api/workflows/:id
export async function fetchWorkflowById(id: number): Promise<WorkflowApi> {
  const res = await fetch(`${API_BASE_URL}/workflows/${id}`, { headers: getAuthHeaders() });

  if (!res.ok) {
    console.error(
      "[fetchWorkflowById] HTTP error:",
      res.status,
      res.statusText
    );
    throw new Error(`Failed to fetch workflow ${id} (status ${res.status})`);
  }

  const data = (await res.json()) as WorkflowByIdResponse;
  console.log("[fetchWorkflowById] raw response:", data);

  if ("data" in data) {
    return data.data;
  }

  return data;
}

export async function fetchWorkflowGraph(
  id: number
): Promise<{
  workflow?: WorkflowGraphMeta;
  nodes: WorkflowGraphNode[];
  edges: WorkflowGraphEdge[];
}> {
  const res = await fetch(`${API_BASE_URL}/workflows/${id}/graph`, { headers: getAuthHeaders() });

  if (!res.ok) {
    console.error(
      "[fetchWorkflowGraph] HTTP error:",
      res.status,
      res.statusText
    );
    throw new Error(
      `Failed to fetch workflow graph for ${id} (status ${res.status})`
    );
  }

  const raw = (await res.json()) as WorkflowGraphResponse;
  console.log("[fetchWorkflowGraph] raw response:", raw);

  const payload: WorkflowGraphPayload = "data" in raw ? raw.data : raw;

  // Normalize workflow meta if present
  let workflow: WorkflowGraphMeta | undefined;
  if (payload.workflow) {
    const w = payload.workflow;
    workflow = {
      id: w.id,
      name: w.name,
      description: w.description ?? null,
      is_active: w.is_active ?? w.isActive,
      isActive: w.isActive ?? w.is_active,
      version: w.version,
      default_trigger: w.default_trigger ?? w.defaultTrigger ?? null,
      defaultTrigger: w.defaultTrigger ?? w.default_trigger ?? null,
      archived_at: w.archived_at ?? w.archivedAt ?? null,
      archivedAt: w.archivedAt ?? w.archived_at ?? null,
      created_at: w.created_at ?? w.createdAt,
      createdAt: w.createdAt ?? w.created_at,
      updated_at: w.updated_at ?? w.updatedAt,
      updatedAt: w.updatedAt ?? w.updated_at,
    };
  }

  // Normalize nodes
  const nodes: WorkflowGraphNode[] = (payload.nodes ?? []).map(
    (n: RawWorkflowGraphNode): WorkflowGraphNode => ({
      id: n.id,
      workflow_id: n.workflow_id ?? n.workflowId ?? 0,
      kind: n.kind,
      name: n.name ?? null,
      pos_x: n.pos_x ?? n.posX ?? 0,
      pos_y: n.pos_y ?? n.posY ?? 0,
      config:
        n.config ??
        (n.config_json
          ? safeParseJson<WorkflowGraphConfig>(n.config_json, {})
          : {}),
    })
  );

  // Normalize edges
  const edges: WorkflowGraphEdge[] = (payload.edges ?? []).map(
    (e: RawWorkflowGraphEdge): WorkflowGraphEdge => ({
      id: e.id,
      workflow_id: e.workflow_id ?? e.workflowId ?? 0,
      from_node_id: e.from_node_id ?? e.fromNodeId ?? 0,
      to_node_id: e.to_node_id ?? e.toNodeId ?? 0,
      label: e.label ?? null,
      priority: e.priority ?? null,
      condition:
        e.condition ??
        (e.condition_json
          ? safeParseJson<WorkflowGraphConfig>(e.condition_json, {})
          : {}),
    })
  );

  return { workflow, nodes, edges };
}

// POST /api/workflows/:id/nodes
export async function deleteWorkflow(id: number): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/workflows/${id}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    throw new Error(`Failed to delete workflow: ${res.statusText}`);
  }
}

export async function createWorkflowNode(
  workflowId: number,
  payload: CreateWorkflowNodePayload
): Promise<WorkflowGraphNode> {
  const res = await fetch(`${API_BASE_URL}/workflows/${workflowId}/nodes`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    let serverMessage = "";
    try {
      const text = await res.text();
      if (text) {
        try {
          const parsed = JSON.parse(text) as { message?: string; error?: string };
          serverMessage = parsed.message || parsed.error || text;
        } catch {
          serverMessage = text;
        }
      }
    } catch {
      serverMessage = "";
    }
    console.error(
      "[createWorkflowNode] HTTP error:",
      res.status,
      res.statusText
    );
    throw new Error(
      `Failed to create node for workflow ${workflowId} (status ${res.status})${serverMessage ? `: ${serverMessage}` : ""}`
    );
  }

  const json = (await res.json()) as
    | WorkflowGraphNode
    | { data: WorkflowGraphNode };

  if ("data" in json) return json.data;
  return json;
}

export async function updateWorkflowNodePosition(
  workflowId: number,
  nodeId: number,
  posX: number,
  posY: number
): Promise<WorkflowGraphNode> {
  const res = await fetch(
    `${API_BASE_URL}/workflows/${workflowId}/nodes/${nodeId}/position`,
    {
      method: "PATCH",
      headers: getAuthHeaders(),
      body: JSON.stringify({ posX, posY }),
    }
  );

  if (!res.ok) {
    console.error(
      "[updateWorkflowNodePosition] HTTP error:",
      res.status,
      res.statusText
    );
    throw new Error(`Failed to update node position (status ${res.status})`);
  }

  const json = (await res.json()) as UpdateNodePositionResponse;
  console.log("[updateWorkflowNodePosition] raw response:", json);

  const raw: WorkflowNodePositionDto =
    "data" in json ? json.data : (json as WorkflowNodePositionDto);

  // Normalize into WorkflowGraphNode used by the builder
  const node: WorkflowGraphNode = {
    id: raw.id,
    workflow_id: raw.workflowId,
    kind: raw.kind,
    name: raw.name,
    pos_x: raw.posX,
    pos_y: raw.posY,
    config: raw.config,
  };

  return node;
}

/* ---------- Node update (name/config/position) ---------- */

type WorkflowNodeUpdateDto = {
  id: number;
  workflowId: number;
  kind: string;
  name: string | null;
  config: WorkflowGraphConfig;
  posX: number;
  posY: number;
};

type UpdateWorkflowNodeResponse =
  | WorkflowNodeUpdateDto
  | { data: WorkflowNodeUpdateDto };

export type UpdateWorkflowNodePayload = {
  kind?: string;
  name?: string | null;
  config?: WorkflowGraphConfig;
  posX?: number;
  posY?: number;
};

/**
 * PUT /api/workflows/:workflowId/nodes/:nodeId
 * Update workflow node core fields (name, kind, config, position).
 */
export async function updateWorkflowNode(
  workflowId: number,
  nodeId: number,
  payload: UpdateWorkflowNodePayload
): Promise<WorkflowGraphNode> {
  const res = await fetch(
    `${API_BASE_URL}/workflows/${workflowId}/nodes/${nodeId}`,
    {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    }
  );

  if (!res.ok) {
    console.error(
      "[updateWorkflowNode] HTTP error:",
      res.status,
      res.statusText
    );
    throw new Error(
      `Failed to update node ${nodeId} for workflow ${workflowId} (status ${res.status})`
    );
  }

  const json = (await res.json()) as UpdateWorkflowNodeResponse;
  console.log("[updateWorkflowNode] raw response:", json);

  const raw: WorkflowNodeUpdateDto =
    "data" in json ? json.data : (json as WorkflowNodeUpdateDto);

  const node: WorkflowGraphNode = {
    id: raw.id,
    workflow_id: raw.workflowId,
    kind: raw.kind,
    name: raw.name,
    pos_x: raw.posX,
    pos_y: raw.posY,
    config: raw.config,
  };

  return node;
}

/* ---------- Edge helpers ---------- */

// POST /api/workflows/:id/edges
export async function createWorkflowEdge(
  workflowId: number,
  payload: CreateWorkflowEdgePayload
): Promise<WorkflowGraphEdge> {
  const res = await fetch(`${API_BASE_URL}/workflows/${workflowId}/edges`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    console.error(
      "[createWorkflowEdge] HTTP error:",
      res.status,
      res.statusText
    );
    throw new Error(
      `Failed to create edge for workflow ${workflowId} (status ${res.status})`
    );
  }

  const json = (await res.json()) as WorkflowEdgeResponse;
  console.log("[createWorkflowEdge] raw response:", json);

  const raw: WorkflowEdgeDto =
    "data" in json ? json.data : (json as WorkflowEdgeDto);

  const edge: WorkflowGraphEdge = {
    id: raw.id,
    workflow_id: raw.workflowId,
    from_node_id: raw.fromNodeId,
    to_node_id: raw.toNodeId,
    label: raw.label ?? null,
    priority: raw.priority ?? null,
    condition: raw.condition ?? {},
  };

  return edge;
}

// DELETE /api/workflows/:id/edges/:edgeId
export async function deleteWorkflowEdge(
  workflowId: number,
  edgeId: number
): Promise<void> {
  const res = await fetch(
    `${API_BASE_URL}/workflows/${workflowId}/edges/${edgeId}`,
    {
      method: "DELETE",
      headers: getAuthHeaders(),
    }
  );

  // 204 is the happy path, 200 with body is also technically fine
  if (!res.ok && res.status !== 204) {
    console.error(
      "[deleteWorkflowEdge] HTTP error:",
      res.status,
      res.statusText
    );
    throw new Error(
      `Failed to delete edge ${edgeId} for workflow ${workflowId} (status ${res.status})`
    );
  }
}

export async function deleteWorkflowNode(
  workflowId: number,
  nodeId: number
): Promise<boolean> {
  try {
    const res = await fetch(
      `${API_BASE_URL}/workflows/${workflowId}/nodes/${nodeId}`,
      {
        method: "DELETE",
        headers: getAuthHeaders(),
      }
    );

    // Any 2xx (including 204) is a success
    if (res.ok) {
      return true;
    }

    console.error(
      "[deleteWorkflowNode] HTTP error:",
      res.status,
      res.statusText
    );
    return false;
  } catch (err) {
    console.error("[deleteWorkflowNode] Network or fetch error:", err);
    return false;
  }
}

/* ---------- Executions ---------- */

export async function fetchExecution(id: number): Promise<ExecutionApi> {
  const res = await fetch(`${API_BASE_URL}/executions/${id}`, { headers: getAuthHeaders() });

  if (!res.ok) {
    console.error(
      "[fetchExecution] HTTP error:",
      res.status,
      res.statusText
    );
    throw new Error(`Failed to fetch execution ${id} (status ${res.status})`);
  }

  const data = (await res.json()) as ExecutionResponse;
  console.log("[fetchExecution] raw response:", data);

  if ("data" in data) {
    return data.data;
  }

  return data;
}

export async function fetchExecutionSteps(
  id: number
): Promise<ExecutionStepApi[]> {
  const res = await fetch(`${API_BASE_URL}/executions/${id}/steps`, { headers: getAuthHeaders() });

  if (!res.ok) {
    console.error(
      "[fetchExecutionSteps] HTTP error:",
      res.status,
      res.statusText
    );
    throw new Error(`Failed to fetch steps for execution ${id}`);
  }

  const data = (await res.json()) as ExecutionStepsResponse;
  console.log("[fetchExecutionSteps] raw response:", data);

  if (Array.isArray(data)) {
    return data;
  }

  if ("data" in data) {
    return data.data;
  }

  throw new Error("Unexpected execution steps response shape");
}

type CreateWorkflowResponse = WorkflowApi | { data: WorkflowApi };

export type CreateWorkflowPayload = {
  name: string;
  description?: string | null;
  is_active?: boolean;
};

export async function createWorkflow(payload: {
  name: string;
  description?: string | null;
  isActive?: boolean;
  ownerUserId?: number | null;
  defaultTrigger?: string | null;
}): Promise<WorkflowApi> {
  const res = await fetch(`${API_BASE_URL}/workflows`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    console.error("[createWorkflow] HTTP error:", res.status, res.statusText);
    throw new Error(`Failed to create workflow (status ${res.status})`);
  }

  const json = (await res.json()) as CreateWorkflowResponse;
  return "data" in json ? json.data : json;
}

export type UpdateWorkflowPayload = {
  name?: string;
  description?: string | null;
  isActive?: boolean;
  defaultTrigger?: string | null;
  ownerUserId?: number | null;
  is_active?: boolean;
  default_trigger?: string | null;
};

// PATCH /api/workflows/:id
export async function updateWorkflow(
  id: number,
  payload: UpdateWorkflowPayload
): Promise<WorkflowApi> {
  const res = await fetch(`${API_BASE_URL}/workflows/${id}`, {
    method: "PATCH",
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    console.error(`[updateWorkflow] HTTP error:`, res.status, res.statusText);
    throw new Error(`Failed to update workflow ${id} (status ${res.status})`);
  }

  const json = await res.json();
  const data = "data" in json ? json.data : json;
  return data as WorkflowApi;
}

// POST /api/workflows/:id/duplicate
export async function duplicateWorkflow(id: number): Promise<WorkflowApi> {
  const res = await fetch(`${API_BASE_URL}/workflows/${id}/duplicate`, {
    method: "POST",
    headers: getAuthHeaders(),
  });

  if (!res.ok) {
    console.error(`[duplicateWorkflow] HTTP error:`, res.status, res.statusText);
    throw new Error(`Failed to duplicate workflow ${id} (status ${res.status})`);
  }

  const json = await res.json();
  const data = "data" in json ? json.data : json;
  return data as WorkflowApi;
}

/* ---------- Settings API ---------- */

export type DatabaseTable = {
  name: string;
  label: string;
  description: string;
};

type DatabaseTablesResponse =
  | { data: DatabaseTable[] }
  | DatabaseTable[];

// GET /api/settings/database-tables
export async function fetchDatabaseTables(): Promise<DatabaseTable[]> {
  const res = await fetch(`${API_BASE_URL}/settings/database-tables`, {
    headers: getAuthHeaders(),
  });

  if (!res.ok) {
    console.error("[fetchDatabaseTables] HTTP error:", res.status, res.statusText);
    throw new Error(`Failed to fetch database tables (status ${res.status})`);
  }

  const json = (await res.json()) as DatabaseTablesResponse;

  if (Array.isArray(json)) {
    return json;
  }

  if ("data" in json) {
    return json.data;
  }

  return [];
}

/**
 * Fetch Google Form URL for a workflow
 */
export type GoogleFormUrlResponse = {
  data: {
    formUrl: string;
    workflowId: number;
    workflowName: string;
    configured: boolean;
  };
};

export async function fetchWorkflowFormUrl(workflowId: number): Promise<string | null> {
  const res = await fetch(`${API_BASE_URL}/workflows/${workflowId}/form-url`, {
    headers: getAuthHeaders(),
  });

  if (!res.ok) {
    if (res.status === 503) {
      // Google Form not configured
      return null;
    }
    console.error("[fetchWorkflowFormUrl] HTTP error:", res.status, res.statusText);
    throw new Error(`Failed to fetch form URL (status ${res.status})`);
  }

  const json = (await res.json()) as GoogleFormUrlResponse;
  return json.data.formUrl;
}
