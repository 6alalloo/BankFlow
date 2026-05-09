import { Router, Request, Response } from "express";
import { Prisma } from "@prisma/client";
import prisma from "../lib/prisma";
import { authenticate } from "../middleware/authMiddleware";
import { validateDraftFlowGraph } from "../services/flowValidationService";
import { toInputJson } from "../lib/json";
import { canPublishFlow } from "../services/authorizationService";
import { logAuditEvent } from "../services/auditService";
import { pageMeta, parseNumber, parsePageQuery } from "../lib/query";

const router = Router();

router.use(authenticate);

const requireFlowDesigner = (req: Request, res: Response): boolean => {
  if (!req.user || !canPublishFlow(req.user.role)) {
    res.status(403).json({ error: "Only admins and designers can modify flows" });
    return false;
  }

  return true;
};

const toNodeResponse = (node: {
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

const toFlowResponse = (flow: any) => ({
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

router.get("/", async (req: Request, res: Response) => {
  const pageQuery = parsePageQuery(req);
  const ownerUserId = parseNumber(req.query.ownerUserId ?? req.query.owner_user_id);
  const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
  const where: Prisma.case_flowsWhereInput = {};

  if (typeof req.query.status === "string" && req.query.status) where.status = req.query.status as never;
  if (ownerUserId) where.owner_user_id = ownerUserId;
  if (typeof req.query.caseType === "string" || typeof req.query.case_type === "string") {
    where.case_type = String(req.query.caseType ?? req.query.case_type);
  }
  if (search) {
    where.OR = [
      { key: { contains: search, mode: "insensitive" } },
      { name: { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } },
      { case_type: { contains: search, mode: "insensitive" } },
    ];
  }

  const [flows, total] = await Promise.all([
    prisma.case_flows.findMany({
      where,
      skip: pageQuery.skip,
      take: pageQuery.take,
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

  res.json({ data: flows.map(toFlowResponse), page: pageMeta(pageQuery, total) });
});

router.post("/", async (req: Request, res: Response) => {
  if (!requireFlowDesigner(req, res)) return;

  const { key, name, description, caseType, case_type } = req.body as {
    key?: string;
    name?: string;
    description?: string;
    caseType?: string;
    case_type?: string;
  };

  if (!name) {
    res.status(400).json({ error: "name is required" });
    return;
  }

  const flow = await prisma.case_flows.create({
    data: {
      key:
        key ||
        `${name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "")}-${Date.now()}`,
      name,
      description: description || null,
      case_type: caseType || case_type || "general_case",
      owner_user_id: req.user?.userId ?? null,
      draft_data_schema_json: toInputJson({}),
    },
  });

  if (req.user?.userId) {
    await logAuditEvent({
      eventType: "flow_created",
      userId: req.user.userId,
      targetType: "flow",
      targetId: flow.id,
      details: { key: flow.key, name: flow.name },
    });
  }

  res.status(201).json({ data: toFlowResponse(flow) });
});

router.patch("/:id", async (req: Request, res: Response) => {
  if (!requireFlowDesigner(req, res)) return;

  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid flow id" });
    return;
  }

  const { name, description, caseType, case_type, status } = req.body as {
    name?: string;
    description?: string | null;
    caseType?: string;
    case_type?: string;
    status?: "draft" | "published" | "archived";
  };

  const data: Prisma.case_flowsUpdateInput = {};
  if (name !== undefined) {
    const trimmedName = name.trim();
    if (!trimmedName) {
      res.status(400).json({ error: "name cannot be empty" });
      return;
    }
    data.name = trimmedName;
  }
  if (description !== undefined) data.description = description;
  if (caseType !== undefined || case_type !== undefined) data.case_type = caseType ?? case_type;
  if (status !== undefined) data.status = status;

  if (Object.keys(data).length === 0) {
    res.status(400).json({ error: "No supported flow fields provided" });
    return;
  }

  const flow = await prisma.case_flows.update({
    where: { id },
    data,
    include: {
      current_published_version: true,
      owners: {
        select: { id: true, email: true, full_name: true },
      },
    },
  });

  if (req.user?.userId) {
    await logAuditEvent({
      eventType: "flow_updated",
      userId: req.user.userId,
      targetType: "flow",
      targetId: flow.id,
      details: { fields: Object.keys(data) },
    });
  }

  res.json({ data: toFlowResponse(flow) });
});

router.get("/:id", async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid flow id" });
    return;
  }

  const flow = await prisma.case_flows.findUnique({
    where: { id },
    include: {
      case_flow_draft_nodes: { orderBy: { id: "asc" } },
      case_flow_draft_edges: { orderBy: [{ priority: "asc" }, { id: "asc" }] },
      case_flow_versions: { orderBy: { version_number: "desc" } },
    },
  });

  if (!flow) {
    res.status(404).json({ error: "Flow not found" });
    return;
  }

  res.json({ data: toFlowResponse(flow) });
});

router.delete("/:id", async (req: Request, res: Response) => {
  if (!requireFlowDesigner(req, res)) return;

  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid flow id" });
    return;
  }

  const flow = await prisma.case_flows.findUnique({ where: { id } });
  if (!flow) {
    res.status(404).json({ error: "Flow not found" });
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.case_flows.update({
      where: { id },
      data: { current_published_version_id: null },
    });
    await tx.case_flows.delete({ where: { id } });
  });

  if (req.user?.userId) {
    await logAuditEvent({
      eventType: "flow_deleted",
      userId: req.user.userId,
      targetType: "flow",
      targetId: flow.id,
      details: { key: flow.key, name: flow.name },
    });
  }

  res.status(204).send();
});

router.post("/:id/duplicate", async (req: Request, res: Response) => {
  if (!requireFlowDesigner(req, res)) return;

  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid flow id" });
    return;
  }

  const source = await prisma.case_flows.findUnique({
    where: { id },
    include: {
      case_flow_draft_nodes: true,
      case_flow_draft_edges: true,
    },
  });

  if (!source) {
    res.status(404).json({ error: "Flow not found" });
    return;
  }

  const copy = await prisma.case_flows.create({
    data: {
      key: `${source.key}-copy-${Date.now()}`,
      name: `${source.name} Copy`,
      description: source.description,
      case_type: source.case_type,
      owner_user_id: req.user?.userId ?? source.owner_user_id,
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

  if (req.user?.userId) {
    await logAuditEvent({
      eventType: "flow_duplicated",
      userId: req.user.userId,
      targetType: "flow",
      targetId: copy.id,
      details: { sourceFlowId: source.id },
    });
  }

  res.status(201).json({ data: toFlowResponse(copy) });
});

router.get("/:id/graph", async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid flow id" });
    return;
  }

  const flow = await prisma.case_flows.findUnique({
    where: { id },
    include: {
      case_flow_draft_nodes: { orderBy: { id: "asc" } },
      case_flow_draft_edges: { orderBy: [{ priority: "asc" }, { id: "asc" }] },
    },
  });

  if (!flow) {
    res.status(404).json({ error: "Flow not found" });
    return;
  }

  const nodeIdByKey = new Map(
    flow.case_flow_draft_nodes.map((node) => [node.node_key, node.id])
  );

  res.json({
    data: {
      flow: toFlowResponse(flow),
      nodes: flow.case_flow_draft_nodes.map((node) => ({
        id: node.id,
        flow_id: node.case_flow_id,
        node_key: node.node_key,
        kind: node.kind,
        name: node.name,
        pos_x: node.pos_x,
        pos_y: node.pos_y,
        config: node.config_json,
      })),
      edges: flow.case_flow_draft_edges.map((edge) => ({
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
    },
  });
});

router.post("/:id/nodes", async (req: Request, res: Response) => {
  if (!requireFlowDesigner(req, res)) return;

  const caseFlowId = Number(req.params.id);
  if (!Number.isInteger(caseFlowId)) {
    res.status(400).json({ error: "Invalid flow id" });
    return;
  }

  const { kind, name, config, posX, posY } = req.body as {
    kind?: string;
    name?: string;
    config?: Record<string, unknown>;
    posX?: number;
    posY?: number;
  };

  if (!kind) {
    res.status(400).json({ error: "kind is required" });
    return;
  }

  const node = await prisma.case_flow_draft_nodes.create({
    data: {
      case_flow_id: caseFlowId,
      node_key: `node-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      kind,
      name: name || kind,
      config_json: toInputJson(config),
      pos_x: posX || 0,
      pos_y: posY || 0,
    },
  });

  if (req.user?.userId) {
    await logAuditEvent({
      eventType: "flow_node_created",
      userId: req.user.userId,
      targetType: "flow",
      targetId: caseFlowId,
      details: { nodeId: node.id, nodeKey: node.node_key, kind: node.kind },
    });
  }

  res.status(201).json({ data: toNodeResponse(node) });
});

router.put("/:id/nodes/:nodeId", async (req: Request, res: Response) => {
  if (!requireFlowDesigner(req, res)) return;

  const caseFlowId = Number(req.params.id);
  const nodeId = Number(req.params.nodeId);
  if (!Number.isInteger(caseFlowId) || !Number.isInteger(nodeId)) {
    res.status(400).json({ error: "Invalid flow or node id" });
    return;
  }

  const { kind, name, config, posX, posY } = req.body as {
    kind?: string;
    name?: string | null;
    config?: Record<string, unknown>;
    posX?: number;
    posY?: number;
  };

  const existing = await prisma.case_flow_draft_nodes.findFirst({
    where: { id: nodeId, case_flow_id: caseFlowId },
  });
  if (!existing) {
    res.status(404).json({ error: "Node not found" });
    return;
  }

  const node = await prisma.case_flow_draft_nodes.update({
    where: { id: nodeId },
    data: {
      ...(kind && { kind }),
      ...(name !== undefined && { name }),
      ...(config && { config_json: toInputJson(config) }),
      ...(typeof posX === "number" && { pos_x: posX }),
      ...(typeof posY === "number" && { pos_y: posY }),
    },
  });

  if (req.user?.userId) {
    await logAuditEvent({
      eventType: "flow_node_updated",
      userId: req.user.userId,
      targetType: "flow",
      targetId: caseFlowId,
      details: { nodeId: node.id, nodeKey: node.node_key, kind: node.kind },
    });
  }

  res.json({ data: toNodeResponse(node) });
});

router.patch("/:id/nodes/:nodeId/position", async (req: Request, res: Response) => {
  if (!requireFlowDesigner(req, res)) return;

  const caseFlowId = Number(req.params.id);
  const nodeId = Number(req.params.nodeId);
  const { posX, posY } = req.body as { posX?: number; posY?: number };
  if (
    !Number.isInteger(caseFlowId) ||
    !Number.isInteger(nodeId) ||
    typeof posX !== "number" ||
    typeof posY !== "number"
  ) {
    res.status(400).json({ error: "Invalid node position payload" });
    return;
  }

  const existing = await prisma.case_flow_draft_nodes.findFirst({
    where: { id: nodeId, case_flow_id: caseFlowId },
  });
  if (!existing) {
    res.status(404).json({ error: "Node not found" });
    return;
  }

  const node = await prisma.case_flow_draft_nodes.update({
    where: { id: nodeId },
    data: { pos_x: posX, pos_y: posY },
  });

  if (req.user?.userId) {
    await logAuditEvent({
      eventType: "flow_node_position_updated",
      userId: req.user.userId,
      targetType: "flow",
      targetId: caseFlowId,
      details: { nodeId: node.id, nodeKey: node.node_key, posX: node.pos_x, posY: node.pos_y },
    });
  }

  res.json({ data: toNodeResponse(node) });
});

router.delete("/:id/nodes/:nodeId", async (req: Request, res: Response) => {
  if (!requireFlowDesigner(req, res)) return;

  const caseFlowId = Number(req.params.id);
  const nodeId = Number(req.params.nodeId);
  if (!Number.isInteger(caseFlowId) || !Number.isInteger(nodeId)) {
    res.status(400).json({ error: "Invalid flow or node id" });
    return;
  }

  const node = await prisma.case_flow_draft_nodes.findFirst({
    where: { id: nodeId, case_flow_id: caseFlowId },
  });
  if (!node) {
    res.status(404).json({ error: "Node not found" });
    return;
  }

  await prisma.case_flow_draft_edges.deleteMany({
    where: {
      case_flow_id: node.case_flow_id,
      OR: [{ from_node_key: node.node_key }, { to_node_key: node.node_key }],
    },
  });
  await prisma.case_flow_draft_nodes.delete({ where: { id: nodeId } });

  if (req.user?.userId) {
    await logAuditEvent({
      eventType: "flow_node_deleted",
      userId: req.user.userId,
      targetType: "flow",
      targetId: node.case_flow_id,
      details: { nodeId, nodeKey: node.node_key },
    });
  }

  res.status(204).send();
});

router.post("/:id/edges", async (req: Request, res: Response) => {
  if (!requireFlowDesigner(req, res)) return;

  const caseFlowId = Number(req.params.id);
  const { fromNodeId, toNodeId, label, priority, condition } = req.body as {
    fromNodeId?: number;
    toNodeId?: number;
    label?: string | null;
    priority?: number | null;
    condition?: Record<string, unknown>;
  };

  if (!Number.isInteger(caseFlowId) || !fromNodeId || !toNodeId) {
    res.status(400).json({ error: "fromNodeId and toNodeId are required" });
    return;
  }

  const [fromNode, toNode] = await Promise.all([
    prisma.case_flow_draft_nodes.findFirst({
      where: { id: fromNodeId, case_flow_id: caseFlowId },
    }),
    prisma.case_flow_draft_nodes.findFirst({
      where: { id: toNodeId, case_flow_id: caseFlowId },
    }),
  ]);

  if (!fromNode || !toNode) {
    res.status(404).json({ error: "Source or target node not found" });
    return;
  }

  const edge = await prisma.case_flow_draft_edges.create({
    data: {
      case_flow_id: caseFlowId,
      edge_key: `edge-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      from_node_key: fromNode.node_key,
      to_node_key: toNode.node_key,
      label: label || null,
      priority: priority || 0,
      condition_json: toInputJson(condition),
    },
  });

  if (req.user?.userId) {
    await logAuditEvent({
      eventType: "flow_edge_created",
      userId: req.user.userId,
      targetType: "flow",
      targetId: caseFlowId,
      details: { edgeId: edge.id, edgeKey: edge.edge_key, fromNodeKey: edge.from_node_key, toNodeKey: edge.to_node_key },
    });
  }

  res.status(201).json({
    data: {
      id: edge.id,
      flowId: edge.case_flow_id,
      fromNodeId: fromNode.id,
      toNodeId: toNode.id,
      label: edge.label,
      priority: edge.priority,
      condition: edge.condition_json || {},
    },
  });
});

router.delete("/:id/edges/:edgeId", async (req: Request, res: Response) => {
  if (!requireFlowDesigner(req, res)) return;

  const caseFlowId = Number(req.params.id);
  const edgeId = Number(req.params.edgeId);
  if (!Number.isInteger(caseFlowId) || !Number.isInteger(edgeId)) {
    res.status(400).json({ error: "Invalid flow or edge id" });
    return;
  }

  const edge = await prisma.case_flow_draft_edges.findFirst({
    where: { id: edgeId, case_flow_id: caseFlowId },
  });
  if (!edge) {
    res.status(404).json({ error: "Edge not found" });
    return;
  }

  await prisma.case_flow_draft_edges.delete({ where: { id: edgeId } });

  if (req.user?.userId) {
    await logAuditEvent({
      eventType: "flow_edge_deleted",
      userId: req.user.userId,
      targetType: "flow",
      targetId: edge.case_flow_id,
      details: { edgeId, edgeKey: edge.edge_key, fromNodeKey: edge.from_node_key, toNodeKey: edge.to_node_key },
    });
  }
  res.status(204).send();
});

router.post("/:id/publish", async (req: Request, res: Response) => {
  if (!requireFlowDesigner(req, res)) return;

  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid flow id" });
    return;
  }

  const flow = await prisma.case_flows.findUnique({
    where: { id },
    include: {
      case_flow_draft_nodes: { orderBy: { id: "asc" } },
      case_flow_draft_edges: { orderBy: [{ priority: "asc" }, { id: "asc" }] },
      case_flow_versions: { orderBy: { version_number: "desc" }, take: 1 },
    },
  });

  if (!flow) {
    res.status(404).json({ error: "Flow not found" });
    return;
  }

  const nextVersion = (flow.case_flow_versions[0]?.version_number ?? 0) + 1;
  const graph = {
    nodes: flow.case_flow_draft_nodes,
    edges: flow.case_flow_draft_edges,
  };

  const validation = validateDraftFlowGraph(graph);
  if (!validation.valid) {
    res.status(400).json({
      error: "Flow cannot be published until validation issues are fixed",
      issues: validation.issues,
    });
    return;
  }

  const version = await prisma.$transaction(async (tx) => {
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
        change_summary: typeof req.body?.changeSummary === "string" ? req.body.changeSummary : null,
        published_by_user_id: req.user?.userId ?? null,
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

  if (req.user?.userId) {
    await logAuditEvent({
      eventType: "flow_published",
      userId: req.user.userId,
      targetType: "flow",
      targetId: flow.id,
      details: { versionId: version.id, versionNumber: version.version_number },
    });
  }

  res.status(201).json({ data: version });
});

export default router;
