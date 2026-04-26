import { Router, Request, Response } from "express";
import { Prisma } from "@prisma/client";
import prisma from "../lib/prisma";
import { authenticate } from "../middleware/authMiddleware";

const router = Router();

router.use(authenticate);

const toInputJson = (value: unknown): Prisma.InputJsonValue =>
  JSON.parse(JSON.stringify(value ?? {})) as Prisma.InputJsonValue;

router.get("/", async (_req: Request, res: Response) => {
  const flows = await prisma.case_flows.findMany({
    orderBy: { updated_at: "desc" },
    include: {
      current_published_version: true,
      owners: {
        select: { id: true, email: true, full_name: true },
      },
    },
  });

  res.json({ data: flows });
});

router.post("/", async (req: Request, res: Response) => {
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
      key: key || `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}-${Date.now()}`,
      name,
      description: description || null,
      case_type: caseType || case_type || "general_case",
      owner_user_id: req.user?.userId ?? null,
      draft_data_schema_json: toInputJson({}),
    },
  });

  res.status(201).json({ data: flow });
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

  res.json({ data: flow });
});

router.delete("/:id", async (req: Request, res: Response) => {
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

  res.status(204).send();
});

router.post("/:id/duplicate", async (req: Request, res: Response) => {
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

  res.status(201).json({ data: copy });
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

  res.json({
    data: {
      flow,
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
        from_node_id: Number(edge.from_node_key.replace(/^node-/, "")) || 0,
        to_node_id: Number(edge.to_node_key.replace(/^node-/, "")) || 0,
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

  res.status(201).json({
    data: {
      id: node.id,
      flowId: node.case_flow_id,
      kind: node.kind,
      name: node.name,
      config: node.config_json,
      posX: node.pos_x,
      posY: node.pos_y,
    },
  });
});

router.put("/:id/nodes/:nodeId", async (req: Request, res: Response) => {
  const nodeId = Number(req.params.nodeId);
  if (!Number.isInteger(nodeId)) {
    res.status(400).json({ error: "Invalid node id" });
    return;
  }

  const { kind, name, config, posX, posY } = req.body as {
    kind?: string;
    name?: string | null;
    config?: Record<string, unknown>;
    posX?: number;
    posY?: number;
  };

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

  res.json({
    data: {
      id: node.id,
      flowId: node.case_flow_id,
      kind: node.kind,
      name: node.name,
      config: node.config_json,
      posX: node.pos_x,
      posY: node.pos_y,
    },
  });
});

router.patch("/:id/nodes/:nodeId/position", async (req: Request, res: Response) => {
  const nodeId = Number(req.params.nodeId);
  const { posX, posY } = req.body as { posX?: number; posY?: number };
  if (!Number.isInteger(nodeId) || typeof posX !== "number" || typeof posY !== "number") {
    res.status(400).json({ error: "Invalid node position payload" });
    return;
  }

  const node = await prisma.case_flow_draft_nodes.update({
    where: { id: nodeId },
    data: { pos_x: posX, pos_y: posY },
  });

  res.json({
    data: {
      id: node.id,
      flowId: node.case_flow_id,
      kind: node.kind,
      name: node.name,
      config: node.config_json,
      posX: node.pos_x,
      posY: node.pos_y,
    },
  });
});

router.delete("/:id/nodes/:nodeId", async (req: Request, res: Response) => {
  const nodeId = Number(req.params.nodeId);
  if (!Number.isInteger(nodeId)) {
    res.status(400).json({ error: "Invalid node id" });
    return;
  }

  const node = await prisma.case_flow_draft_nodes.findUnique({ where: { id: nodeId } });
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

  res.status(204).send();
});

router.post("/:id/edges", async (req: Request, res: Response) => {
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
    prisma.case_flow_draft_nodes.findUnique({ where: { id: fromNodeId } }),
    prisma.case_flow_draft_nodes.findUnique({ where: { id: toNodeId } }),
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
  const edgeId = Number(req.params.edgeId);
  if (!Number.isInteger(edgeId)) {
    res.status(400).json({ error: "Invalid edge id" });
    return;
  }

  await prisma.case_flow_draft_edges.delete({ where: { id: edgeId } });
  res.status(204).send();
});

router.post("/:id/publish", async (req: Request, res: Response) => {
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

  if (flow.case_flow_draft_nodes.length === 0) {
    res.status(400).json({ error: "Cannot publish a flow with no nodes" });
    return;
  }

  const nextVersion = (flow.case_flow_versions[0]?.version_number ?? 0) + 1;
  const graph = {
    nodes: flow.case_flow_draft_nodes,
    edges: flow.case_flow_draft_edges,
  };

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

  res.status(201).json({ data: version });
});

export default router;
