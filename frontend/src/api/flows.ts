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

export type FlowApi = {
  id: number;
  owner_user_id: number | null;
  name: string;
  description: string | null;
  case_type: string;
  status: "draft" | "published" | "archived";
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
  current_published_version?: {
    id: number;
    version_number: number;
  } | null;
};

export type PublishIssue = {
  code: string;
  message: string;
  nodeKey?: string;
  edgeKey?: string;
  node_key?: string;
  edge_key?: string;
};

export class FlowPublishError extends Error {
  issues: PublishIssue[];

  constructor(message: string, issues: PublishIssue[]) {
    super(message);
    this.name = "FlowPublishError";
    this.issues = issues;
  }
}

type RawFlowApi = Omit<FlowApi, "case_type" | "status" | "is_active" | "version" | "default_trigger" | "users"> & {
  case_type?: string;
  status?: "draft" | "published" | "archived";
  is_active?: boolean;
  version?: number;
  default_trigger?: string | null;
  users?: FlowApi["users"];
  owners?: FlowApi["users"];
  current_published_version?: FlowApi["current_published_version"] | null;
};

export type CreateFlowNodePayload = {
  kind: string;
  name?: string;
  posX?: number;
  posY?: number;
  config?: Record<string, unknown>;
};

/* ---------- List flows ---------- */

type FlowsListResponse =
  | RawFlowApi[]
  | { data: RawFlowApi[] }
  | { flows: RawFlowApi[] };

export type FlowGraphMeta = {
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


export type FlowGraphConfig = Record<string, unknown>;

// Node type used in the frontend (normalized)
export type FlowGraphNode = {
  id: number;
  flow_id: number;
  kind: string;
  name: string | null;
  pos_x: number;
  pos_y: number;
  config?: FlowGraphConfig;
};

// Edge type used in the frontend (normalized)
export type FlowGraphEdge = {
  id: number;
  flow_id: number;
  from_node_id: number;
  to_node_id: number;
  label: string | null;
  priority: number | null;
  condition?: FlowGraphConfig;
};

/* ---------- Raw shapes from backend ---------- */

type RawFlowGraphMeta = {
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

type RawFlowGraphNode = {
  id: number;
  flow_id?: number;
  flowId?: number;
  kind: string;
  name?: string | null;
  pos_x?: number;
  posX?: number;
  pos_y?: number;
  posY?: number;
  config?: FlowGraphConfig;
  config_json?: string | null;
};

type RawFlowGraphEdge = {
  id: number;
  flow_id?: number;
  flowId?: number;
  from_node_id?: number;
  fromNodeId?: number;
  to_node_id?: number;
  toNodeId?: number;
  label?: string | null;
  priority?: number | null;
  condition?: FlowGraphConfig;
  condition_json?: string | null;
};

type FlowGraphPayload = {
  flow?: RawFlowGraphMeta;
  nodes: RawFlowGraphNode[];
  edges: RawFlowGraphEdge[];
};

type FlowGraphResponse =
  | FlowGraphPayload
  | { data: FlowGraphPayload };

type FlowNodePositionDto = {
  id: number;
  flowId: number;
  kind: string;
  name: string | null;
  config: Record<string, unknown>;
  posX: number;
  posY: number;
};

type UpdateNodePositionResponse =
  | FlowNodePositionDto
  | { data: FlowNodePositionDto };

/* ---------- Edge DTOs for create/update ---------- */

export type CreateFlowEdgePayload = {
  fromNodeId: number;
  toNodeId: number;
  label?: string | null;
  priority?: number | null;
  condition?: FlowGraphConfig;
};

type FlowEdgeDto = {
  id: number;
  flowId: number;
  fromNodeId: number;
  toNodeId: number;
  label: string | null;
  priority: number;
  condition: FlowGraphConfig;
};

type FlowEdgeResponse = FlowEdgeDto | { data: FlowEdgeDto };

/* ---------- helpers ---------- */

function safeParseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function normalizeFlow(raw: RawFlowApi): FlowApi {
  const status = raw.status ?? (raw.is_active ? "published" : "draft");
  return {
    ...raw,
    owner_user_id: raw.owner_user_id ?? null,
    description: raw.description ?? null,
    case_type: raw.case_type ?? "general_case",
    status,
    is_active: raw.is_active ?? status === "published",
    version: raw.current_published_version?.version_number ?? raw.version ?? 0,
    default_trigger: raw.default_trigger ?? null,
    archived_at: raw.archived_at ?? null,
    users: raw.users ?? raw.owners ?? null,
    current_published_version: raw.current_published_version ?? null,
  };
}

// GET /api/flows
export async function fetchFlows(): Promise<FlowApi[]> {
  const res = await fetch(`${API_BASE_URL}/flows`, {
    headers: getAuthHeaders(),
  });

  if (!res.ok) {
    console.error(
      "[fetchFlows] HTTP error:",
      res.status,
      res.statusText
    );
    throw new Error(`Failed to fetch flows (status ${res.status})`);
  }

  const data = (await res.json()) as FlowsListResponse;

  if (Array.isArray(data)) {
    return data.map(normalizeFlow);
  }

  if ("data" in data) {
    return data.data.map(normalizeFlow);
  }

  if ("flows" in data) {
    return data.flows.map(normalizeFlow);
  }

  throw new Error("Unexpected flows response shape");
}

/* ---------- Single flow + graph ---------- */

// Response type for GET /api/flows/:id
type FlowByIdResponse = RawFlowApi | { data: RawFlowApi };

// GET /api/flows/:id
export async function fetchFlowById(id: number): Promise<FlowApi> {
  const res = await fetch(`${API_BASE_URL}/flows/${id}`, { headers: getAuthHeaders() });

  if (!res.ok) {
    console.error(
      "[fetchFlowById] HTTP error:",
      res.status,
      res.statusText
    );
    throw new Error(`Failed to fetch flow ${id} (status ${res.status})`);
  }

  const data = (await res.json()) as FlowByIdResponse;

  if ("data" in data) {
    return normalizeFlow(data.data);
  }

  return normalizeFlow(data);
}

export async function fetchFlowGraph(
  id: number
): Promise<{
  flow?: FlowGraphMeta;
  nodes: FlowGraphNode[];
  edges: FlowGraphEdge[];
}> {
  const res = await fetch(`${API_BASE_URL}/flows/${id}/graph`, { headers: getAuthHeaders() });

  if (!res.ok) {
    console.error(
      "[fetchFlowGraph] HTTP error:",
      res.status,
      res.statusText
    );
    throw new Error(
      `Failed to fetch flow graph for ${id} (status ${res.status})`
    );
  }

  const raw = (await res.json()) as FlowGraphResponse;

  const payload: FlowGraphPayload = "data" in raw ? raw.data : raw;

  // Normalize flow meta if present
  let flow: FlowGraphMeta | undefined;
  if (payload.flow) {
    const w = payload.flow;
    flow = {
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
  const nodes: FlowGraphNode[] = (payload.nodes ?? []).map(
    (n: RawFlowGraphNode): FlowGraphNode => ({
      id: n.id,
      flow_id: n.flow_id ?? n.flowId ?? 0,
      kind: n.kind,
      name: n.name ?? null,
      pos_x: n.pos_x ?? n.posX ?? 0,
      pos_y: n.pos_y ?? n.posY ?? 0,
      config:
        n.config ??
        (n.config_json
          ? safeParseJson<FlowGraphConfig>(n.config_json, {})
          : {}),
    })
  );

  // Normalize edges
  const edges: FlowGraphEdge[] = (payload.edges ?? []).map(
    (e: RawFlowGraphEdge): FlowGraphEdge => ({
      id: e.id,
      flow_id: e.flow_id ?? e.flowId ?? 0,
      from_node_id: e.from_node_id ?? e.fromNodeId ?? 0,
      to_node_id: e.to_node_id ?? e.toNodeId ?? 0,
      label: e.label ?? null,
      priority: e.priority ?? null,
      condition:
        e.condition ??
        (e.condition_json
          ? safeParseJson<FlowGraphConfig>(e.condition_json, {})
          : {}),
    })
  );

  return { flow, nodes, edges };
}

// POST /api/flows/:id/nodes
export async function deleteFlow(id: number): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/flows/${id}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    throw new Error(`Failed to delete flow: ${res.statusText}`);
  }
}

export async function createFlowNode(
  flowId: number,
  payload: CreateFlowNodePayload
): Promise<FlowGraphNode> {
  const res = await fetch(`${API_BASE_URL}/flows/${flowId}/nodes`, {
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
      "[createFlowNode] HTTP error:",
      res.status,
      res.statusText
    );
    throw new Error(
      `Failed to create node for flow ${flowId} (status ${res.status})${serverMessage ? `: ${serverMessage}` : ""}`
    );
  }

  const json = (await res.json()) as
    | FlowGraphNode
    | { data: FlowGraphNode };

  if ("data" in json) return json.data;
  return json;
}

export async function updateFlowNodePosition(
  flowId: number,
  nodeId: number,
  posX: number,
  posY: number
): Promise<FlowGraphNode> {
  const res = await fetch(
    `${API_BASE_URL}/flows/${flowId}/nodes/${nodeId}/position`,
    {
      method: "PATCH",
      headers: getAuthHeaders(),
      body: JSON.stringify({ posX, posY }),
    }
  );

  if (!res.ok) {
    console.error(
      "[updateFlowNodePosition] HTTP error:",
      res.status,
      res.statusText
    );
    throw new Error(`Failed to update node position (status ${res.status})`);
  }

  const json = (await res.json()) as UpdateNodePositionResponse;

  const raw: FlowNodePositionDto =
    "data" in json ? json.data : (json as FlowNodePositionDto);

  // Normalize into FlowGraphNode used by the builder
  const node: FlowGraphNode = {
    id: raw.id,
    flow_id: raw.flowId,
    kind: raw.kind,
    name: raw.name,
    pos_x: raw.posX,
    pos_y: raw.posY,
    config: raw.config,
  };

  return node;
}

/* ---------- Node update (name/config/position) ---------- */

type FlowNodeUpdateDto = {
  id: number;
  flowId: number;
  kind: string;
  name: string | null;
  config: FlowGraphConfig;
  posX: number;
  posY: number;
};

type UpdateFlowNodeResponse =
  | FlowNodeUpdateDto
  | { data: FlowNodeUpdateDto };

export type UpdateFlowNodePayload = {
  kind?: string;
  name?: string | null;
  config?: FlowGraphConfig;
  posX?: number;
  posY?: number;
};

/**
 * PUT /api/flows/:flowId/nodes/:nodeId
 * Update flow node core fields (name, kind, config, position).
 */
export async function updateFlowNode(
  flowId: number,
  nodeId: number,
  payload: UpdateFlowNodePayload
): Promise<FlowGraphNode> {
  const res = await fetch(
    `${API_BASE_URL}/flows/${flowId}/nodes/${nodeId}`,
    {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    }
  );

  if (!res.ok) {
    console.error(
      "[updateFlowNode] HTTP error:",
      res.status,
      res.statusText
    );
    throw new Error(
      `Failed to update node ${nodeId} for flow ${flowId} (status ${res.status})`
    );
  }

  const json = (await res.json()) as UpdateFlowNodeResponse;

  const raw: FlowNodeUpdateDto =
    "data" in json ? json.data : (json as FlowNodeUpdateDto);

  const node: FlowGraphNode = {
    id: raw.id,
    flow_id: raw.flowId,
    kind: raw.kind,
    name: raw.name,
    pos_x: raw.posX,
    pos_y: raw.posY,
    config: raw.config,
  };

  return node;
}

/* ---------- Edge helpers ---------- */

// POST /api/flows/:id/edges
export async function createFlowEdge(
  flowId: number,
  payload: CreateFlowEdgePayload
): Promise<FlowGraphEdge> {
  const res = await fetch(`${API_BASE_URL}/flows/${flowId}/edges`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    console.error(
      "[createFlowEdge] HTTP error:",
      res.status,
      res.statusText
    );
    throw new Error(
      `Failed to create edge for flow ${flowId} (status ${res.status})`
    );
  }

  const json = (await res.json()) as FlowEdgeResponse;

  const raw: FlowEdgeDto =
    "data" in json ? json.data : (json as FlowEdgeDto);

  const edge: FlowGraphEdge = {
    id: raw.id,
    flow_id: raw.flowId,
    from_node_id: raw.fromNodeId,
    to_node_id: raw.toNodeId,
    label: raw.label ?? null,
    priority: raw.priority ?? null,
    condition: raw.condition ?? {},
  };

  return edge;
}

// DELETE /api/flows/:id/edges/:edgeId
export async function deleteFlowEdge(
  flowId: number,
  edgeId: number
): Promise<void> {
  const res = await fetch(
    `${API_BASE_URL}/flows/${flowId}/edges/${edgeId}`,
    {
      method: "DELETE",
      headers: getAuthHeaders(),
    }
  );

  // 204 is the happy path, 200 with body is also technically fine
  if (!res.ok && res.status !== 204) {
    console.error(
      "[deleteFlowEdge] HTTP error:",
      res.status,
      res.statusText
    );
    throw new Error(
      `Failed to delete edge ${edgeId} for flow ${flowId} (status ${res.status})`
    );
  }
}

export async function deleteFlowNode(
  flowId: number,
  nodeId: number
): Promise<boolean> {
  try {
    const res = await fetch(
      `${API_BASE_URL}/flows/${flowId}/nodes/${nodeId}`,
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
      "[deleteFlowNode] HTTP error:",
      res.status,
      res.statusText
    );
    return false;
  } catch (err) {
    console.error("[deleteFlowNode] Network or fetch error:", err);
    return false;
  }
}

type CreateFlowResponse = RawFlowApi | { data: RawFlowApi };

export type CreateFlowPayload = {
  name: string;
  description?: string | null;
  is_active?: boolean;
};

export async function createFlow(payload: {
  name: string;
  description?: string | null;
  isActive?: boolean;
  ownerUserId?: number | null;
  defaultTrigger?: string | null;
}): Promise<FlowApi> {
  const res = await fetch(`${API_BASE_URL}/flows`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    console.error("[createFlow] HTTP error:", res.status, res.statusText);
    throw new Error(`Failed to create flow (status ${res.status})`);
  }

  const json = (await res.json()) as CreateFlowResponse;
  return normalizeFlow("data" in json ? json.data : json);
}

export type UpdateFlowPayload = {
  name?: string;
  description?: string | null;
  isActive?: boolean;
  defaultTrigger?: string | null;
  ownerUserId?: number | null;
  is_active?: boolean;
  default_trigger?: string | null;
};

// PATCH /api/flows/:id
export async function updateFlow(
  id: number,
  payload: UpdateFlowPayload
): Promise<FlowApi> {
  const res = await fetch(`${API_BASE_URL}/flows/${id}`, {
    method: "PATCH",
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    console.error(`[updateFlow] HTTP error:`, res.status, res.statusText);
    throw new Error(`Failed to update flow ${id} (status ${res.status})`);
  }

  const json = await res.json();
  const data = "data" in json ? json.data : json;
  return normalizeFlow(data as RawFlowApi);
}

// POST /api/flows/:id/duplicate
export async function duplicateFlow(id: number): Promise<FlowApi> {
  const res = await fetch(`${API_BASE_URL}/flows/${id}/duplicate`, {
    method: "POST",
    headers: getAuthHeaders(),
  });

  if (!res.ok) {
    console.error(`[duplicateFlow] HTTP error:`, res.status, res.statusText);
    throw new Error(`Failed to duplicate flow ${id} (status ${res.status})`);
  }

  const json = await res.json();
  const data = "data" in json ? json.data : json;
  return normalizeFlow(data as RawFlowApi);
}

// POST /api/flows/:id/publish
export async function publishFlow(id: number, changeSummary?: string): Promise<FlowApi> {
  const res = await fetch(`${API_BASE_URL}/flows/${id}/publish`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ changeSummary }),
  });

  if (!res.ok) {
    let message = `Failed to publish flow ${id} (status ${res.status})`;
    let issues: PublishIssue[] = [];

    try {
      const json = (await res.json()) as { error?: string; issues?: PublishIssue[] };
      message = json.error || message;
      issues = Array.isArray(json.issues) ? json.issues : [];
    } catch {
      // Keep the generic message when the server does not return JSON.
    }

    throw new FlowPublishError(message, issues);
  }

  return fetchFlowById(id);
}

/* ---------- Settings API ---------- */

export type DatabaseTable = {
  name: string;
  label: string;
  description: string;
};

export async function fetchDatabaseTables(): Promise<DatabaseTable[]> {
  return [
    { name: 'cases', label: 'Cases', description: 'BankFlow case records' },
    { name: 'case_tasks', label: 'Case Tasks', description: 'Human task records' },
    { name: 'case_events', label: 'Case Events', description: 'Case timeline events' },
    { name: 'case_documents', label: 'Case Documents', description: 'Documents linked to cases' },
  ];
}
