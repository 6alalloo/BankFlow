import { Router, Request, Response } from "express";
import { authenticate } from "../middleware/authMiddleware";
import { canPublishFlow } from "../services/authorizationService";
import { logAuditEvent } from "../services/auditService";
import { parseNumber, parsePageQuery } from "../lib/query";
import {
  FlowPublishValidationError,
  createCaseFlow,
  createDraftEdge,
  createDraftNode,
  deleteCaseFlow,
  deleteDraftEdge,
  deleteDraftNode,
  duplicateCaseFlow,
  getCaseFlowDetail,
  getCaseFlowGraph,
  listCaseFlows,
  publishCaseFlow,
  toCaseFlowGraphResponse,
  toCaseFlowResponse,
  toDraftNodeResponse,
  updateCaseFlow,
  updateDraftNode,
  updateDraftNodePosition,
} from "../services/flowService";

const router = Router();

router.use(authenticate);

const requireFlowDesigner = (req: Request, res: Response): boolean => {
  if (!req.user || !canPublishFlow(req.user.role)) {
    res.status(403).json({ error: "Only admins and designers can modify flows" });
    return false;
  }

  return true;
};

router.get("/", async (req: Request, res: Response) => {
  const pageQuery = parsePageQuery(req);
  const ownerUserId = parseNumber(req.query.ownerUserId ?? req.query.owner_user_id);
  const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
  const caseType =
    typeof req.query.caseType === "string" || typeof req.query.case_type === "string"
      ? String(req.query.caseType ?? req.query.case_type)
      : undefined;
  const status = typeof req.query.status === "string" && req.query.status ? req.query.status : undefined;

  res.json(await listCaseFlows({ pageQuery, ownerUserId, caseType, status, search }));
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

  const flow = await createCaseFlow({
    key,
    name,
    description,
    caseType: caseType || case_type,
    ownerUserId: req.user?.userId ?? null,
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

  res.status(201).json({ data: toCaseFlowResponse(flow) });
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

  const data: {
    name?: string;
    description?: string | null;
    caseType?: string;
    status?: "draft" | "published" | "archived";
  } = {};
  if (name !== undefined) {
    const trimmedName = name.trim();
    if (!trimmedName) {
      res.status(400).json({ error: "name cannot be empty" });
      return;
    }
    data.name = trimmedName;
  }
  if (description !== undefined) data.description = description;
  if (caseType !== undefined || case_type !== undefined) data.caseType = caseType ?? case_type;
  if (status !== undefined) data.status = status;

  if (Object.keys(data).length === 0) {
    res.status(400).json({ error: "No supported flow fields provided" });
    return;
  }

  const flow = await updateCaseFlow(id, {
    ...data,
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

  res.json({ data: toCaseFlowResponse(flow) });
});

router.get("/:id", async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid flow id" });
    return;
  }

  const flow = await getCaseFlowDetail(id);

  if (!flow) {
    res.status(404).json({ error: "Flow not found" });
    return;
  }

  res.json({ data: flow });
});

router.delete("/:id", async (req: Request, res: Response) => {
  if (!requireFlowDesigner(req, res)) return;

  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid flow id" });
    return;
  }

  const flow = await deleteCaseFlow(id);
  if (!flow) {
    res.status(404).json({ error: "Flow not found" });
    return;
  }

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

  const copy = await duplicateCaseFlow({ flowId: id, ownerUserId: req.user?.userId ?? null });
  if (!copy) {
    res.status(404).json({ error: "Flow not found" });
    return;
  }

  if (req.user?.userId) {
    await logAuditEvent({
      eventType: "flow_duplicated",
      userId: req.user.userId,
      targetType: "flow",
      targetId: copy.id,
      details: { sourceFlowId: id },
    });
  }

  res.status(201).json({ data: toCaseFlowResponse(copy) });
});

router.get("/:id/graph", async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid flow id" });
    return;
  }

  const flow = await getCaseFlowGraph(id);

  if (!flow) {
    res.status(404).json({ error: "Flow not found" });
    return;
  }

  res.json({ data: toCaseFlowGraphResponse(flow) });
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

  const node = await createDraftNode(caseFlowId, { kind, name, config, posX, posY });

  if (req.user?.userId) {
    await logAuditEvent({
      eventType: "flow_node_created",
      userId: req.user.userId,
      targetType: "flow",
      targetId: caseFlowId,
      details: { nodeId: node.id, nodeKey: node.node_key, kind: node.kind },
    });
  }

  res.status(201).json({ data: toDraftNodeResponse(node) });
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

  const node = await updateDraftNode(caseFlowId, nodeId, { kind, name, config, posX, posY });
  if (!node) {
    res.status(404).json({ error: "Node not found" });
    return;
  }

  if (req.user?.userId) {
    await logAuditEvent({
      eventType: "flow_node_updated",
      userId: req.user.userId,
      targetType: "flow",
      targetId: caseFlowId,
      details: { nodeId: node.id, nodeKey: node.node_key, kind: node.kind },
    });
  }

  res.json({ data: toDraftNodeResponse(node) });
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

  const node = await updateDraftNodePosition(caseFlowId, nodeId, posX, posY);
  if (!node) {
    res.status(404).json({ error: "Node not found" });
    return;
  }

  if (req.user?.userId) {
    await logAuditEvent({
      eventType: "flow_node_position_updated",
      userId: req.user.userId,
      targetType: "flow",
      targetId: caseFlowId,
      details: { nodeId: node.id, nodeKey: node.node_key, posX: node.pos_x, posY: node.pos_y },
    });
  }

  res.json({ data: toDraftNodeResponse(node) });
});

router.delete("/:id/nodes/:nodeId", async (req: Request, res: Response) => {
  if (!requireFlowDesigner(req, res)) return;

  const caseFlowId = Number(req.params.id);
  const nodeId = Number(req.params.nodeId);
  if (!Number.isInteger(caseFlowId) || !Number.isInteger(nodeId)) {
    res.status(400).json({ error: "Invalid flow or node id" });
    return;
  }

  const node = await deleteDraftNode(caseFlowId, nodeId);
  if (!node) {
    res.status(404).json({ error: "Node not found" });
    return;
  }

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

  const created = await createDraftEdge(caseFlowId, {
    fromNodeId,
    toNodeId,
    label,
    priority,
    condition,
  });
  if (!created) {
    res.status(404).json({ error: "Source or target node not found" });
    return;
  }
  const { edge, fromNode, toNode } = created;

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

  const edge = await deleteDraftEdge(caseFlowId, edgeId);
  if (!edge) {
    res.status(404).json({ error: "Edge not found" });
    return;
  }

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

  try {
    const version = await publishCaseFlow({
      flowId: id,
      publishedByUserId: req.user?.userId ?? null,
      changeSummary: typeof req.body?.changeSummary === "string" ? req.body.changeSummary : null,
    });

    if (!version) {
      res.status(404).json({ error: "Flow not found" });
      return;
    }

    if (req.user?.userId) {
      await logAuditEvent({
        eventType: "flow_published",
        userId: req.user.userId,
        targetType: "flow",
        targetId: id,
        details: { versionId: version.id, versionNumber: version.version_number },
      });
    }

    res.status(201).json({ data: version });
  } catch (err) {
    if (err instanceof FlowPublishValidationError) {
      res.status(400).json({
        error: err.message,
        issues: err.issues,
      });
      return;
    }

    throw err;
  }
});

export default router;
