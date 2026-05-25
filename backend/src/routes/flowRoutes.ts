import { Router, Request, Response } from "express";
import { authenticate } from "../middleware/authMiddleware";
import { canPublishFlow } from "../services/authorizationService";
import { logAuditEvent } from "../services/auditService";
import { parseNumber, parsePageQuery } from "../lib/query";
import {
  asBodyObject,
  optionalBodyObject,
  readIntegerParam,
  readOptionalInteger,
  readOptionalNullableString,
  readOptionalNumber,
  readOptionalObject,
  readOptionalString,
  readRequiredString,
} from "../lib/validation";
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

  const body = optionalBodyObject(req);
  const key = readOptionalString(body, "key");
  const name = readRequiredString(body, "name");
  const description = readOptionalString(body, "description");
  const caseType = readOptionalString(body, "caseType") ?? readOptionalString(body, "case_type");

  const flow = await createCaseFlow({
    key,
    name,
    description,
    caseType,
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

  const id = readIntegerParam(req, "id", "flow id");
  const body = optionalBodyObject(req);
  const name = readOptionalString(body, "name");
  const description = readOptionalNullableString(body, "description");
  const caseType = readOptionalString(body, "caseType");
  const case_type = readOptionalString(body, "case_type");
  const status = readOptionalString(body, "status") as "draft" | "published" | "archived" | undefined;

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
  const id = readIntegerParam(req, "id", "flow id");

  const flow = await getCaseFlowDetail(id);

  if (!flow) {
    res.status(404).json({ error: "Flow not found" });
    return;
  }

  res.json({ data: flow });
});

router.delete("/:id", async (req: Request, res: Response) => {
  if (!requireFlowDesigner(req, res)) return;

  const id = readIntegerParam(req, "id", "flow id");

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

  const id = readIntegerParam(req, "id", "flow id");

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
  const id = readIntegerParam(req, "id", "flow id");

  const flow = await getCaseFlowGraph(id);

  if (!flow) {
    res.status(404).json({ error: "Flow not found" });
    return;
  }

  res.json({ data: toCaseFlowGraphResponse(flow) });
});

router.post("/:id/nodes", async (req: Request, res: Response) => {
  if (!requireFlowDesigner(req, res)) return;

  const caseFlowId = readIntegerParam(req, "id", "flow id");
  const body = asBodyObject(req);
  const kind = readRequiredString(body, "kind");
  const name = readOptionalString(body, "name");
  const config = readOptionalObject(body, "config");
  const posX = readOptionalNumber(body, "posX");
  const posY = readOptionalNumber(body, "posY");

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

  const caseFlowId = readIntegerParam(req, "id", "flow id");
  const nodeId = readIntegerParam(req, "nodeId", "node id");
  const body = asBodyObject(req);
  const kind = readOptionalString(body, "kind");
  const name = readOptionalNullableString(body, "name");
  const config = readOptionalObject(body, "config");
  const posX = readOptionalNumber(body, "posX");
  const posY = readOptionalNumber(body, "posY");

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

  const caseFlowId = readIntegerParam(req, "id", "flow id");
  const nodeId = readIntegerParam(req, "nodeId", "node id");
  const body = asBodyObject(req);
  const posX = readOptionalNumber(body, "posX");
  const posY = readOptionalNumber(body, "posY");
  if (posX === undefined || posY === undefined) {
    res.status(400).json({ error: "posX and posY are required" });
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

  const caseFlowId = readIntegerParam(req, "id", "flow id");
  const nodeId = readIntegerParam(req, "nodeId", "node id");

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

  const caseFlowId = readIntegerParam(req, "id", "flow id");
  const body = asBodyObject(req);
  const fromNodeId = readOptionalInteger(body.fromNodeId, "fromNodeId");
  const toNodeId = readOptionalInteger(body.toNodeId, "toNodeId");
  const label = readOptionalNullableString(body, "label");
  const priority = readOptionalInteger(body.priority, "priority");
  const condition = readOptionalObject(body, "condition");

  if (!fromNodeId || !toNodeId) {
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

  const caseFlowId = readIntegerParam(req, "id", "flow id");
  const edgeId = readIntegerParam(req, "edgeId", "edge id");

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

  const id = readIntegerParam(req, "id", "flow id");
  const body = optionalBodyObject(req);

  try {
    const version = await publishCaseFlow({
      flowId: id,
      publishedByUserId: req.user?.userId ?? null,
      changeSummary: readOptionalString(body, "changeSummary") ?? null,
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
