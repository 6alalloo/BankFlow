import { Prisma } from "@prisma/client";
import prisma from "../lib/prisma";
import { toInputJson } from "../lib/json";
import { pageMeta, type PageQuery } from "../lib/query";
import { validateDraftFlowGraph, type FlowValidationIssue } from "./flowValidationService";

export class FlowPublishValidationError extends Error {
  issues: FlowValidationIssue[];

  constructor(issues: FlowValidationIssue[]) {
    super("Flow cannot be published until validation issues are fixed");
    this.name = "FlowPublishValidationError";
    this.issues = issues;
  }
}

export const toDraftNodeResponse = (node: {
  id: number;
  case_flow_id: number;
  kind: string;
  name: string | null;
  config_json: Prisma.JsonValue;
  pos_x: number;
  pos_y: number;
}) => ({
  id: node.id,
  flowId: node.case_flow_id,
  kind: node.kind,
  name: node.name,
  config: node.config_json,
  posX: node.pos_x,
  posY: node.pos_y,
});

export const toCaseFlowResponse = (flow: any) => ({
  id: flow.id,
  key: flow.key,
  name: flow.name,
  description: flow.description,
  case_type: flow.case_type,
  status: flow.status,
  owner_user_id: flow.owner_user_id,
  current_published_version_id: flow.current_published_version_id,
  draft_data_schema_json: flow.draft_data_schema_json,
  created_at: flow.created_at,
  updated_at: flow.updated_at,
  archived_at: flow.archived_at,
  current_published_version: flow.current_published_version ?? null,
  owners: flow.owners ?? null,
  users: flow.owners ?? null,
  version: flow.current_published_version?.version_number ?? 0,
  is_active: flow.status === "published",
});

export const toCaseFlowGraphResponse = (flow: any) => {
  const nodeIdByKey = new Map(
    flow.case_flow_draft_nodes.map((node: { node_key: string; id: number }) => [node.node_key, node.id])
  );

  return {
    flow: toCaseFlowResponse(flow),
    nodes: flow.case_flow_draft_nodes.map((node: any) => ({
      id: node.id,
      flow_id: node.case_flow_id,
      node_key: node.node_key,
      kind: node.kind,
      name: node.name,
      pos_x: node.pos_x,
      pos_y: node.pos_y,
      config: node.config_json,
    })),
    edges: flow.case_flow_draft_edges.map((edge: any) => ({
      id: edge.id,
      flow_id: edge.case_flow_id,
      edge_key: edge.edge_key,
      from_node_id: nodeIdByKey.get(edge.from_node_key) ?? 0,
      to_node_id: nodeIdByKey.get(edge.to_node_key) ?? 0,
      from_node_key: edge.from_node_key,
      to_node_key: edge.to_node_key,
      label: edge.label,
      priority: edge.priority,
      condition: edge.condition_json || {},
    })),
  };
};

export async function listCaseFlows(input: {
  pageQuery: PageQuery;
  ownerUserId?: number;
  caseType?: string;
  status?: string;
  search?: string;
}) {
  const where: Prisma.case_flowsWhereInput = {};
  if (input.status) where.status = input.status as never;
  if (input.ownerUserId) where.owner_user_id = input.ownerUserId;
  if (input.caseType) where.case_type = input.caseType;
  if (input.search) {
    where.OR = [
      { key: { contains: input.search, mode: "insensitive" } },
      { name: { contains: input.search, mode: "insensitive" } },
      { description: { contains: input.search, mode: "insensitive" } },
      { case_type: { contains: input.search, mode: "insensitive" } },
    ];
  }

  const [flows, total] = await Promise.all([
    prisma.case_flows.findMany({
      where,
      skip: input.pageQuery.skip,
      take: input.pageQuery.take,
      orderBy: { updated_at: "desc" },
      include: {
        current_published_version: true,
        owners: {
          select: { id: true, email: true, full_name: true },
        },
      },
    }),
    prisma.case_flows.count({ where }),
  ]);

  return { data: flows.map(toCaseFlowResponse), page: pageMeta(input.pageQuery, total) };
}

export async function getCaseFlowDetail(flowId: number) {
  const flow = await prisma.case_flows.findUnique({
    where: { id: flowId },
    include: {
      case_flow_draft_nodes: { orderBy: { id: "asc" } },
      case_flow_draft_edges: { orderBy: [{ priority: "asc" }, { id: "asc" }] },
      case_flow_versions: { orderBy: { version_number: "desc" } },
    },
  });

  return flow ? toCaseFlowResponse(flow) : null;
}

export async function createCaseFlow(input: {
  key?: string;
  name: string;
  description?: string | null;
  caseType?: string;
  ownerUserId?: number | null;
}) {
  return prisma.case_flows.create({
    data: {
      key:
        input.key ||
        `${input.name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "")}-${Date.now()}`,
      name: input.name,
      description: input.description || null,
      case_type: input.caseType || "general_case",
      owner_user_id: input.ownerUserId ?? null,
      draft_data_schema_json: toInputJson({}),
    },
  });
}

export async function updateCaseFlow(
  flowId: number,
  data: {
    name?: string;
    description?: string | null;
    caseType?: string;
    status?: "draft" | "published" | "archived";
  }
) {
  return prisma.case_flows.update({
    where: { id: flowId },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.caseType !== undefined && { case_type: data.caseType }),
      ...(data.status !== undefined && { status: data.status }),
    },
    include: {
      current_published_version: true,
      owners: {
        select: { id: true, email: true, full_name: true },
      },
    },
  });
}

export async function deleteCaseFlow(flowId: number) {
  const flow = await prisma.case_flows.findUnique({ where: { id: flowId } });
  if (!flow) return null;

  await prisma.$transaction(async (tx) => {
    await tx.case_flows.update({
      where: { id: flowId },
      data: { current_published_version_id: null },
    });
    await tx.case_flows.delete({ where: { id: flowId } });
  });

  return flow;
}

export async function duplicateCaseFlow(input: { flowId: number; ownerUserId?: number | null }) {
  const source = await prisma.case_flows.findUnique({
    where: { id: input.flowId },
    include: {
      case_flow_draft_nodes: true,
      case_flow_draft_edges: true,
    },
  });

  if (!source) return null;

  return prisma.case_flows.create({
    data: {
      key: `${source.key}-copy-${Date.now()}`,
      name: `${source.name} Copy`,
      description: source.description,
      case_type: source.case_type,
      owner_user_id: input.ownerUserId ?? source.owner_user_id,
      draft_data_schema_json: toInputJson(source.draft_data_schema_json),
      case_flow_draft_nodes: {
        create: source.case_flow_draft_nodes.map((node) => ({
          node_key: node.node_key,
          kind: node.kind,
          name: node.name,
          config_json: toInputJson(node.config_json),
          pos_x: node.pos_x,
          pos_y: node.pos_y,
        })),
      },
      case_flow_draft_edges: {
        create: source.case_flow_draft_edges.map((edge) => ({
          edge_key: edge.edge_key,
          from_node_key: edge.from_node_key,
          to_node_key: edge.to_node_key,
          condition_json: edge.condition_json === null ? Prisma.JsonNull : toInputJson(edge.condition_json),
          label: edge.label,
          priority: edge.priority,
        })),
      },
    },
  });
}

export async function getCaseFlowGraph(flowId: number) {
  return prisma.case_flows.findUnique({
    where: { id: flowId },
    include: {
      case_flow_draft_nodes: { orderBy: { id: "asc" } },
      case_flow_draft_edges: { orderBy: [{ priority: "asc" }, { id: "asc" }] },
    },
  });
}

export async function createDraftNode(
  caseFlowId: number,
  input: {
    kind: string;
    name?: string;
    config?: Record<string, unknown>;
    posX?: number;
    posY?: number;
  }
) {
  return prisma.case_flow_draft_nodes.create({
    data: {
      case_flow_id: caseFlowId,
      node_key: `node-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      kind: input.kind,
      name: input.name || input.kind,
      config_json: toInputJson(input.config),
      pos_x: input.posX || 0,
      pos_y: input.posY || 0,
    },
  });
}

export async function updateDraftNode(
  caseFlowId: number,
  nodeId: number,
  input: {
    kind?: string;
    name?: string | null;
    config?: Record<string, unknown>;
    posX?: number;
    posY?: number;
  }
) {
  const existing = await prisma.case_flow_draft_nodes.findFirst({
    where: { id: nodeId, case_flow_id: caseFlowId },
  });
  if (!existing) return null;

  return prisma.case_flow_draft_nodes.update({
    where: { id: nodeId },
    data: {
      ...(input.kind && { kind: input.kind }),
      ...(input.name !== undefined && { name: input.name }),
      ...(input.config !== undefined && { config_json: toInputJson(input.config) }),
      ...(typeof input.posX === "number" && { pos_x: input.posX }),
      ...(typeof input.posY === "number" && { pos_y: input.posY }),
    },
  });
}

export async function updateDraftNodePosition(caseFlowId: number, nodeId: number, posX: number, posY: number) {
  const existing = await prisma.case_flow_draft_nodes.findFirst({
    where: { id: nodeId, case_flow_id: caseFlowId },
  });
  if (!existing) return null;

  return prisma.case_flow_draft_nodes.update({
    where: { id: nodeId },
    data: { pos_x: posX, pos_y: posY },
  });
}

export async function deleteDraftNode(caseFlowId: number, nodeId: number) {
  const node = await prisma.case_flow_draft_nodes.findFirst({
    where: { id: nodeId, case_flow_id: caseFlowId },
  });
  if (!node) return null;

  await prisma.case_flow_draft_edges.deleteMany({
    where: {
      case_flow_id: node.case_flow_id,
      OR: [{ from_node_key: node.node_key }, { to_node_key: node.node_key }],
    },
  });
  await prisma.case_flow_draft_nodes.delete({ where: { id: nodeId } });

  return node;
}

export async function createDraftEdge(
  caseFlowId: number,
  input: {
    fromNodeId: number;
    toNodeId: number;
    label?: string | null;
    priority?: number | null;
    condition?: Record<string, unknown>;
  }
) {
  const [fromNode, toNode] = await Promise.all([
    prisma.case_flow_draft_nodes.findFirst({
      where: { id: input.fromNodeId, case_flow_id: caseFlowId },
    }),
    prisma.case_flow_draft_nodes.findFirst({
      where: { id: input.toNodeId, case_flow_id: caseFlowId },
    }),
  ]);

  if (!fromNode || !toNode) return null;

  const edge = await prisma.case_flow_draft_edges.create({
    data: {
      case_flow_id: caseFlowId,
      edge_key: `edge-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      from_node_key: fromNode.node_key,
      to_node_key: toNode.node_key,
      label: input.label || null,
      priority: input.priority || 0,
      condition_json: toInputJson(input.condition),
    },
  });

  return { edge, fromNode, toNode };
}

export async function deleteDraftEdge(caseFlowId: number, edgeId: number) {
  const edge = await prisma.case_flow_draft_edges.findFirst({
    where: { id: edgeId, case_flow_id: caseFlowId },
  });
  if (!edge) return null;

  await prisma.case_flow_draft_edges.delete({ where: { id: edgeId } });
  return edge;
}

export async function publishCaseFlow(input: {
  flowId: number;
  publishedByUserId?: number | null;
  changeSummary?: string | null;
}) {
  const flow = await prisma.case_flows.findUnique({
    where: { id: input.flowId },
    include: {
      case_flow_draft_nodes: { orderBy: { id: "asc" } },
      case_flow_draft_edges: { orderBy: [{ priority: "asc" }, { id: "asc" }] },
      case_flow_versions: { orderBy: { version_number: "desc" }, take: 1 },
    },
  });

  if (!flow) return null;

  const nextVersion = (flow.case_flow_versions[0]?.version_number ?? 0) + 1;
  const graph = {
    nodes: flow.case_flow_draft_nodes,
    edges: flow.case_flow_draft_edges,
  };

  const validation = validateDraftFlowGraph(graph);
  if (!validation.valid) {
    throw new FlowPublishValidationError(validation.issues);
  }

  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    if (flow.current_published_version_id) {
      await tx.case_flow_versions.update({
        where: { id: flow.current_published_version_id },
        data: { status: "superseded", retired_at: new Date() },
      });
    }

    const createdVersion = await tx.case_flow_versions.create({
      data: {
        case_flow_id: flow.id,
        version_number: nextVersion,
        graph_json: toInputJson(graph),
        data_schema_json: toInputJson(flow.draft_data_schema_json),
        change_summary: input.changeSummary ?? null,
        published_by_user_id: input.publishedByUserId ?? null,
      },
    });

    await tx.case_flows.update({
      where: { id: flow.id },
      data: {
        status: "published",
        current_published_version_id: createdVersion.id,
      },
    });

    return createdVersion;
  });
}
