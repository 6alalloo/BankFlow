/**
 * Workflow Graph Management Service
 *
 * Provides CRUD operations for workflows, nodes, and edges.
 * Manages the HRFlow workflow graph structure stored in PostgreSQL.
 *
 * Key operations:
 * - Workflow lifecycle (create, read, update, delete, duplicate)
 * - Node management (add, update, move, delete)
 * - Edge management (connect, update, delete)
 * - Graph queries (fetch complete workflow with nodes and edges)
 */

import prisma from "../lib/prisma";
import { Prisma } from "@prisma/client";

type WorkflowFilters = {
  isActive?: boolean;
  ownerId?: number;
  query?: string; // for ?q= search
};

/**
 * Safely parse JSON string with fallback value.
 * Prevents API crashes when encountering invalid JSON in database fields.
 */
function safeParseJson<T = any>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

/**
 * Supported workflow node types in HRFlow.
 * Each type maps to specific n8n node compilation logic in n8nCompiler.
 */
export type WorkflowNodeKind =
  | "trigger"
  | "http"
  | "email"
  | "database"
  | "condition"
  | "variable"
  | "logger"
  | "datetime"
  | "cv_parse"
  | "cv_parser";

/**
 * Data transfer object for workflow nodes.
 * Service-level type used for API operations, distinct from Prisma models.
 */
export interface WorkflowNodeDTO {
  kind: WorkflowNodeKind;
  name?: string | null;
  config?: Record<string, any>;
  posX?: number;
  posY?: number;
}

export interface WorkflowEdgeDTO {
  fromNodeId?: number;
  toNodeId?: number;
  label?: string | null;
  priority?: number | null;
  condition?: Record<string, any>;
}

/** -------------------- WORKFLOW CRUD -------------------- **/

export type CreateWorkflowDTO = {
  name: string;
  description?: string | null;
  isActive?: boolean;
  ownerUserId?: number | null;
  defaultTrigger?: string | null;
};

/**
 * Create a new workflow with metadata.
 * Returns the created workflow with owner information.
 */
export async function createWorkflow(dto: CreateWorkflowDTO) {
  const created = await prisma.workflows.create({
    data: {
      name: dto.name,
      description: dto.description ?? null,
      is_active: typeof dto.isActive === "boolean" ? dto.isActive : true,
      owner_user_id: dto.ownerUserId ?? null,
      default_trigger: dto.defaultTrigger ?? null,
      // version/created_at/updated_at defaults are handled by Prisma schema
    },
    select: {
      id: true,
      name: true,
      description: true,
      is_active: true,
      version: true,
      default_trigger: true,
      owner_user_id: true,
      archived_at: true,
      created_at: true,
      updated_at: true,
      n8n_workflow_id: true,
      n8n_webhook_path: true,
      users: {
        select: {
          id: true,
          full_name: true,
          email: true,
        },
      },
    },
  });

  return created;
}

/**
 * Retrieve all workflows with optional filtering.
 * Supports filtering by active status, owner, and text search (name/description).
 * Results are ordered by creation date descending.
 */
export async function getAllWorkflows(filters: WorkflowFilters = {}) {
  const { isActive, ownerId, query } = filters;

  const whereClauses: any[] = [];

  if (typeof isActive === "boolean") {
    whereClauses.push({ is_active: isActive });
  }

  if (typeof ownerId === "number") {
    whereClauses.push({ owner_user_id: ownerId });
  }

  if (query && query.trim().length > 0) {
    const q = query.trim();
    whereClauses.push({
      OR: [
        {
          name: {
            contains: q,
            mode: "insensitive",
          },
        },
        {
          description: {
            contains: q,
            mode: "insensitive",
          },
        },
      ],
    });
  }

  const where = whereClauses.length > 0 ? { AND: whereClauses } : {};

  const workflows = await prisma.workflows.findMany({
    where,
    select: {
      id: true,
      name: true,
      description: true,
      is_active: true,
      version: true,
      default_trigger: true,
      owner_user_id: true,

      // Note: Frontend uses archived_at field for archive status filtering
      archived_at: true,

      created_at: true,
      updated_at: true,
      users: {
        select: {
          id: true,
          full_name: true,
          email: true,
        },
      },
    },
    orderBy: {
      created_at: "desc",
    },
  });

  return workflows;
}

/**
 * Get a single workflow by ID.
 */
export async function getWorkflowById(id: number) {
  const workflow = await prisma.workflows.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      description: true,
      is_active: true,
      version: true,
      default_trigger: true,
      owner_user_id: true,
      archived_at: true,
      created_at: true,
      updated_at: true,
      n8n_workflow_id: true,
      n8n_webhook_path: true,
      users: {
        select: {
          id: true,
          full_name: true,
          email: true,
        },
      },
    },
  });

  return workflow;
}

/**
 * Update workflow metadata (name, description, is_active, default_trigger).
 */
export async function updateWorkflow(
  id: number,
  dto: {
    name?: string;
    description?: string;
    isActive?: boolean;
    defaultTrigger?: string | null;
  }
) {
  const existing = await prisma.workflows.findUnique({
    where: { id },
  });

  if (!existing) {
    return null;
  }

  const updated = await prisma.workflows.update({
    where: { id },
    data: {
      name: dto.name ?? existing.name,
      description: dto.description !== undefined ? dto.description : existing.description,
      is_active: dto.isActive !== undefined ? dto.isActive : existing.is_active,
      default_trigger: dto.defaultTrigger !== undefined ? dto.defaultTrigger : existing.default_trigger,
    },
    select: {
      id: true,
      name: true,
      description: true,
      is_active: true,
      version: true,
      default_trigger: true,
      owner_user_id: true,
      archived_at: true,
      created_at: true,
      updated_at: true,
      n8n_workflow_id: true,
      n8n_webhook_path: true,
    },
  });

  return updated;
}

/**
 * Get all nodes for a workflow.
 */
export async function getWorkflowNodes(workflowId: number) {
  const nodes = await prisma.workflow_nodes.findMany({
    where: {
      workflow_id: workflowId,
    },
    select: {
      id: true,
      workflow_id: true,
      kind: true,
      name: true,
      config_json: true,
      pos_x: true,
      pos_y: true,
    },
    orderBy: {
      id: "asc",
    },
  });

  return nodes;
}

/**
 * Get all edges for a workflow.
 */
export async function getWorkflowEdges(workflowId: number) {
  const edges = await prisma.workflow_edges.findMany({
    where: {
      workflow_id: workflowId,
    },
    select: {
      id: true,
      workflow_id: true,
      from_node_id: true,
      to_node_id: true,
      condition_json: true,
      label: true,
      priority: true,
    },
    orderBy: {
      id: "asc",
    },
  });

  return edges;
}

/**
 * Retrieve complete workflow graph including nodes and edges.
 * Returns null if workflow not found. Parses config_json fields for client consumption.
 */
export async function getWorkflowGraph(workflowId: number) {
  // 1) Fetch the workflow itself
  const workflow = await prisma.workflows.findUnique({
    where: { id: workflowId },
  });

  if (!workflow) {
    return null;
  }

  // 2) Fetch nodes and edges in parallel
  const [nodesRaw, edgesRaw] = await Promise.all([
    prisma.workflow_nodes.findMany({
      where: { workflow_id: workflowId },
      orderBy: { id: "asc" },
    }),
    prisma.workflow_edges.findMany({
      where: { workflow_id: workflowId },
      orderBy: { id: "asc" },
    }),
  ]);

  // 3) Shape them into a graph object for the API
  const nodes = nodesRaw.map((n) => ({
    id: n.id,
    workflowId: n.workflow_id,
    kind: n.kind as WorkflowNodeKind,
    name: n.name,
    config: safeParseJson(n.config_json, {} as Record<string, any>),
    posX: n.pos_x,
    posY: n.pos_y,
  }));

  const edges = edgesRaw.map((e) => ({
    id: e.id,
    workflowId: e.workflow_id,
    fromNodeId: e.from_node_id,
    toNodeId: e.to_node_id,
    label: e.label,
    priority: e.priority ?? 0,
    condition: safeParseJson(e.condition_json, {} as Record<string, any>),
  }));

  return {
    workflow: {
      id: workflow.id,
      name: workflow.name,
      description: workflow.description,
      isActive: workflow.is_active,
      version: workflow.version,
      defaultTrigger: workflow.default_trigger,
      archivedAt: workflow.archived_at,
      createdAt: workflow.created_at,
      updatedAt: workflow.updated_at,
    },
    nodes,
    edges,
  };
}

// -------------------- NODE CRUD --------------------

/**
 * Update workflow node properties (config, position, name, kind).
 * Validates node ownership before update. Returns null if node not found.
 */
export async function updateWorkflowNode(
  workflowId: number,
  nodeId: number,
  dto: Partial<WorkflowNodeDTO>
) {
  const existing = await prisma.workflow_nodes.findFirst({
    where: { id: nodeId, workflow_id: workflowId },
  });

  if (!existing) {
    return null;
  }

  const updated = await prisma.workflow_nodes.update({
    where: { id: nodeId },
    data: {
      kind: dto.kind ?? existing.kind,
      name: dto.name ?? existing.name,
      config_json:
        dto.config !== undefined
          ? JSON.stringify(dto.config)
          : existing.config_json,
      pos_x: dto.posX ?? existing.pos_x,
      pos_y: dto.posY ?? existing.pos_y,
    },
  });

  return {
    id: updated.id,
    workflowId: updated.workflow_id,
    kind: updated.kind as WorkflowNodeKind,
    name: updated.name,
    config: safeParseJson<Record<string, unknown>>(updated.config_json, {}),
    posX: updated.pos_x,
    posY: updated.pos_y,
  };
}

/**
 * Delete a workflow node and cascade-delete associated edges.
 * Returns null if node not found or doesn't belong to workflow.
 */
export async function deleteWorkflowNode(workflowId: number, nodeId: number) {
  const existing = await prisma.workflow_nodes.findFirst({
    where: { id: nodeId, workflow_id: workflowId },
  });

  if (!existing) {
    return null;
  }

  await prisma.workflow_nodes.delete({
    where: { id: nodeId },
  });

  return existing;
}

export async function updateWorkflowNodePosition(
  workflowId: number,
  nodeId: number,
  posX: number,
  posY: number
) {
  // Make sure this node actually belongs to the workflow
  const existing = await prisma.workflow_nodes.findFirst({
    where: { id: nodeId, workflow_id: workflowId },
  });

  if (!existing) {
    return null;
  }

  const updated = await prisma.workflow_nodes.update({
    where: { id: nodeId },
    data: {
      pos_x: posX,
      pos_y: posY,
    },
  });

  return {
    id: updated.id,
    workflowId: updated.workflow_id,
    kind: updated.kind as WorkflowNodeKind,
    name: updated.name,
    config: safeParseJson(updated.config_json, {} as Record<string, unknown>),
    posX: updated.pos_x,
    posY: updated.pos_y,
  };
}

/**
 * Retrieve workflow edges with parsed condition JSON.
 * Returns edges sorted by ID ascending.
 */
export async function listWorkflowEdgesParsed(workflowId: number) {
  const edgesRaw = await prisma.workflow_edges.findMany({
    where: { workflow_id: workflowId },
    orderBy: { id: "asc" },
  });

  return edgesRaw.map((e) => ({
    id: e.id,
    workflowId: e.workflow_id,
    fromNodeId: e.from_node_id,
    toNodeId: e.to_node_id,
    label: e.label,
    priority: e.priority ?? 0,
    condition: safeParseJson(e.condition_json, {} as Record<string, any>),
  }));
}

/**
 * Create edge connecting two workflow nodes.
 * Validates both nodes belong to the specified workflow before creation.
 */
export async function createWorkflowEdge(
  workflowId: number,
  dto: Required<Pick<WorkflowEdgeDTO, "fromNodeId" | "toNodeId">> & WorkflowEdgeDTO
) {
  const [fromNode, toNode] = await Promise.all([
    prisma.workflow_nodes.findFirst({
      where: { id: dto.fromNodeId, workflow_id: workflowId },
    }),
    prisma.workflow_nodes.findFirst({
      where: { id: dto.toNodeId, workflow_id: workflowId },
    }),
  ]);

  if (!fromNode || !toNode) {
    throw new Error("fromNodeId and toNodeId must belong to this workflow");
  }

  const edge = await prisma.workflow_edges.create({
    data: {
      workflow_id: workflowId,
      from_node_id: dto.fromNodeId!,
      to_node_id: dto.toNodeId!,
      label: dto.label ?? null,
      priority: dto.priority ?? 0,
      condition_json: JSON.stringify(dto.condition ?? {}),
    },
  });

  return {
    id: edge.id,
    workflowId: edge.workflow_id,
    fromNodeId: edge.from_node_id,
    toNodeId: edge.to_node_id,
    label: edge.label,
    priority: edge.priority ?? 0,
    condition: safeParseJson(edge.condition_json, {} as Record<string, any>),
  };
}

/**
 * Update workflow edge properties (from/to nodes, label, priority, condition).
 * Validates nodes belong to workflow if node IDs are changed.
 */
export async function updateWorkflowEdge(
  workflowId: number,
  edgeId: number,
  dto: WorkflowEdgeDTO
) {
  const existing = await prisma.workflow_edges.findFirst({
    where: { id: edgeId, workflow_id: workflowId },
  });

  if (!existing) {
    return null;
  }

  let fromNodeId = existing.from_node_id;
  let toNodeId = existing.to_node_id;

  if (dto.fromNodeId !== undefined) {
    fromNodeId = dto.fromNodeId;
  }
  if (dto.toNodeId !== undefined) {
    toNodeId = dto.toNodeId;
  }

  if (dto.fromNodeId !== undefined || dto.toNodeId !== undefined) {
    const [fromNode, toNode] = await Promise.all([
      prisma.workflow_nodes.findFirst({
        where: { id: fromNodeId, workflow_id: workflowId },
      }),
      prisma.workflow_nodes.findFirst({
        where: { id: toNodeId, workflow_id: workflowId },
      }),
    ]);

    if (!fromNode || !toNode) {
      throw new Error("fromNodeId and toNodeId must belong to this workflow");
    }
  }

  const updated = await prisma.workflow_edges.update({
    where: { id: edgeId },
    data: {
      from_node_id: fromNodeId,
      to_node_id: toNodeId,
      label: dto.label ?? existing.label,
      priority: dto.priority !== undefined ? dto.priority : existing.priority ?? 0,
      condition_json:
        dto.condition !== undefined
          ? JSON.stringify(dto.condition)
          : existing.condition_json,
    },
  });

  return {
    id: updated.id,
    workflowId: updated.workflow_id,
    fromNodeId: updated.from_node_id,
    toNodeId: updated.to_node_id,
    label: updated.label,
    priority: updated.priority ?? 0,
    condition: safeParseJson(updated.condition_json, {} as Record<string, any>),
  };
}

/**
 * Delete workflow edge.
 * Returns false if edge not found or doesn't belong to workflow.
 */
export async function deleteWorkflowEdge(workflowId: number, edgeId: number) {
  const existing = await prisma.workflow_edges.findFirst({
    where: { id: edgeId, workflow_id: workflowId },
  });

  if (!existing) {
    return false;
  }

  await prisma.workflow_edges.delete({
    where: { id: edgeId },
  });

  return true;
}

/**
 * Create new workflow node with automatic grid positioning if coordinates not provided.
 * Handles PostgreSQL sequence drift with retry logic.
 */
export async function createWorkflowNode(workflowId: number, dto: WorkflowNodeDTO) {
  const count = await prisma.workflow_nodes.count({
    where: { workflow_id: workflowId },
  });

  let posX = dto.posX;
  let posY = dto.posY;

  if (posX === undefined || posY === undefined) {
    const col = count % 3;
    const row = Math.floor(count / 3);

    posX = 80 + col * 220;
    posY = 80 + row * 160;
  }

  const createNode = () =>
    prisma.workflow_nodes.create({
      data: {
        workflow_id: workflowId,
        kind: dto.kind,
        name: dto.name ?? null,
        config_json: JSON.stringify(dto.config ?? {}),
        pos_x: Math.round(posX),
        pos_y: Math.round(posY),
      },
    });

  let node;
  try {
    node = await createNode();
  } catch (error) {
    const isDuplicateId =
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002" &&
      Array.isArray((error.meta as { target?: string[] } | undefined)?.target) &&
      (error.meta as { target?: string[] } | undefined)?.target?.includes("id");

    if (!isDuplicateId) {
      throw error;
    }

    await prisma.$executeRaw`
      SELECT setval(
        pg_get_serial_sequence('workflow_nodes','id'),
        (SELECT COALESCE(MAX(id), 0) FROM workflow_nodes),
        true
      );
    `;

    node = await createNode();
  }

  return {
    id: node.id,
    workflowId: node.workflow_id,
    kind: node.kind as WorkflowNodeKind,
    name: node.name,
    config: safeParseJson(node.config_json, {} as Record<string, any>),
    posX: node.pos_x,
    posY: node.pos_y,
  };
}

/**
 * Delete workflow and cascade-delete all associated nodes and edges.
 */
export async function deleteWorkflow(id: number): Promise<void> {
  await prisma.workflows.delete({
    where: { id },
  });
}

/**
 * Duplicate workflow with all nodes and edges.
 * Creates copy with "(Copy)" suffix, sets inactive by default to prevent accidental triggers.
 * Performs atomic duplication within transaction and syncs PostgreSQL sequences.
 */
export async function duplicateWorkflow(id: number, ownerUserId?: number | null) {
  const original = await prisma.workflows.findUnique({
    where: { id },
  });

  if (!original) {
    return null;
  }

  const [nodes, edges] = await Promise.all([
    prisma.workflow_nodes.findMany({
      where: { workflow_id: id },
      orderBy: { id: "asc" },
    }),
    prisma.workflow_edges.findMany({
      where: { workflow_id: id },
      orderBy: { id: "asc" },
    }),
  ]);

  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT setval(pg_get_serial_sequence('workflow_nodes','id'), (SELECT COALESCE(MAX(id), 0) FROM workflow_nodes), true);`;
    await tx.$executeRaw`SELECT setval(pg_get_serial_sequence('workflow_edges','id'), (SELECT COALESCE(MAX(id), 0) FROM workflow_edges), true);`;

    const newWorkflow = await tx.workflows.create({
      data: {
        name: `${original.name} (Copy)`,
        description: original.description,
        is_active: false,
        owner_user_id:
          typeof ownerUserId === "number" ? ownerUserId : original.owner_user_id,
        default_trigger: original.default_trigger,
      },
      select: {
        id: true,
        name: true,
        description: true,
        is_active: true,
        version: true,
        default_trigger: true,
        owner_user_id: true,
        archived_at: true,
        created_at: true,
        updated_at: true,
        n8n_workflow_id: true,
        n8n_webhook_path: true,
        users: {
          select: {
            id: true,
            full_name: true,
            email: true,
          },
        },
      },
    });

    const nodeIdMap: Record<number, number> = {};

    for (const node of nodes) {
      const newNode = await tx.workflow_nodes.create({
        data: {
          workflow_id: newWorkflow.id,
          kind: node.kind,
          name: node.name,
          config_json: node.config_json,
          pos_x: node.pos_x,
          pos_y: node.pos_y,
        },
      });
      nodeIdMap[node.id] = newNode.id;
    }

    for (const edge of edges) {
      const newFromNodeId = nodeIdMap[edge.from_node_id];
      const newToNodeId = nodeIdMap[edge.to_node_id];

      if (newFromNodeId && newToNodeId) {
        await tx.workflow_edges.create({
          data: {
            workflow_id: newWorkflow.id,
            from_node_id: newFromNodeId,
            to_node_id: newToNodeId,
            label: edge.label,
            priority: edge.priority,
            condition_json: edge.condition_json,
          },
        });
      }
    }

    return {
      id: newWorkflow.id,
      name: newWorkflow.name,
      description: newWorkflow.description,
      is_active: newWorkflow.is_active,
      version: newWorkflow.version,
      default_trigger: newWorkflow.default_trigger,
      owner_user_id: newWorkflow.owner_user_id,
      archived_at: newWorkflow.archived_at,
      created_at: newWorkflow.created_at,
      updated_at: newWorkflow.updated_at,
      users: newWorkflow.users,
      nodeCount: nodes.length,
      edgeCount: edges.length,
    };
  });
}
