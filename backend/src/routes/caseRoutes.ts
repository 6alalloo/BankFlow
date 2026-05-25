import { Router, Request, Response } from "express";
import crypto from "crypto";
import prisma from "../lib/prisma";
import { authenticate } from "../middleware/authMiddleware";
import { startCaseRuntime } from "../services/caseRuntimeService";
import { toInputJson } from "../lib/json";
import { logAuditEvent } from "../services/auditService";
import { pageMeta, parseDate, parseNumber, parsePageQuery } from "../lib/query";
import { canViewAllOperationalQueues, canViewCase, getUserTeamIds } from "../services/authorizationService";
import { toCaseDetail, toCaseSummary } from "../serializers/caseSerializers";
import {
  asBodyObject,
  optionalBodyObject,
  readIntegerParam,
  readOptionalEnum,
  readOptionalNullableString,
  readOptionalObject,
  readOptionalString,
  readRequiredInteger,
  readRequiredString,
} from "../lib/validation";
import { Prisma } from "@prisma/client";

const router = Router();

router.use(authenticate);

const createCaseReference = () => {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `BF-${date}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
};

const allowedCasePriorities = new Set(["low", "normal", "high", "critical"] as const);
type CasePriorityInput = (typeof allowedCasePriorities extends ReadonlySet<infer T> ? T : never);

router.get("/", async (req: Request, res: Response) => {
  const pageQuery = parsePageQuery(req);
  const openedFrom = parseDate(req.query.openedFrom);
  const openedTo = parseDate(req.query.openedTo);
  const flowId = parseNumber(req.query.flowId ?? req.query.flow_id);
  const assigneeUserId = parseNumber(req.query.assigneeUserId ?? req.query.assignee_user_id);
  const assigneeTeamId = parseNumber(req.query.assigneeTeamId ?? req.query.assignee_team_id);
  const search = typeof req.query.search === "string" ? req.query.search.trim() : "";

  const where: Prisma.casesWhereInput = {};
  if (typeof req.query.status === "string" && req.query.status) where.status = req.query.status as never;
  if (typeof req.query.priority === "string" && req.query.priority) where.priority = req.query.priority as never;
  if (flowId) where.case_flow_id = flowId;
  if (assigneeUserId) where.assignee_user_id = assigneeUserId;
  if (assigneeTeamId) where.assignee_team_id = assigneeTeamId;
  if (openedFrom || openedTo) {
    where.opened_at = {
      ...(openedFrom && { gte: openedFrom }),
      ...(openedTo && { lte: openedTo }),
    };
  }
  if (search) {
    where.OR = [
      { case_reference: { contains: search, mode: "insensitive" } },
      { title: { contains: search, mode: "insensitive" } },
      { case_type: { contains: search, mode: "insensitive" } },
    ];
  }

  if (req.user && !canViewAllOperationalQueues(req.user.role)) {
    const teamIds = await getUserTeamIds(req.user.userId);
    where.AND = [
      ...(Array.isArray(where.AND) ? where.AND : []),
      {
        OR: [
          { created_by_user_id: req.user.userId },
          { assignee_user_id: req.user.userId },
          ...(teamIds.length > 0 ? [{ assignee_team_id: { in: teamIds } }] : []),
        ],
      },
    ];
  }

  const [cases, total] = await Promise.all([
    prisma.cases.findMany({
      where,
      skip: pageQuery.skip,
      take: pageQuery.take,
    orderBy: { opened_at: "desc" },
    include: {
      assignee_user: { select: { id: true, email: true, full_name: true } },
      assignee_team: true,
      case_flows: { select: { id: true, key: true, name: true, case_type: true } },
    },
    }),
    prisma.cases.count({ where }),
  ]);

  res.json({ data: cases.map(toCaseSummary), page: pageMeta(pageQuery, total) });
});

router.post("/", async (req: Request, res: Response) => {
  const body = asBodyObject(req);
  const flowId = readRequiredInteger(body, "flowId");
  const title = readOptionalString(body, "title");
  const priority = readOptionalEnum<CasePriorityInput>(
    body,
    "priority",
    allowedCasePriorities,
    "priority must be one of: low, normal, high, critical"
  );
  const intakeSource = readOptionalString(body, "intakeSource");
  const caseData = readOptionalObject(body, "caseData");

  const flow = await prisma.case_flows.findUnique({
    where: { id: flowId },
    include: { current_published_version: true },
  });

  if (!flow || !flow.current_published_version) {
    res.status(400).json({ error: "Cases can only be created from published flows" });
    return;
  }

  let caseRecord = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      caseRecord = await prisma.cases.create({
        data: {
          case_flow_id: flow.id,
          case_flow_version_id: flow.current_published_version.id,
          case_reference: createCaseReference(),
          case_type: flow.case_type,
          title: title || flow.name,
          priority: priority || "normal",
          intake_source: intakeSource || "manual",
          case_data_json: toInputJson(caseData),
          flow_snapshot_json: toInputJson(flow.current_published_version.graph_json),
          created_by_user_id: req.user?.userId ?? null,
          case_events: {
            create: {
              event_type: "case_created",
              summary: "Case created",
              actor_user_id: req.user?.userId ?? null,
              data_json: toInputJson({ intakeSource: intakeSource || "manual" }),
            },
          },
        },
        include: { case_events: true },
      });
      break;
    } catch (error) {
      if (attempt === 2 || !(error instanceof Error) || !error.message.includes("Unique constraint")) {
        throw error;
      }
    }
  }

  if (!caseRecord) {
    res.status(500).json({ error: "Failed to create case reference" });
    return;
  }

  await startCaseRuntime(caseRecord.id, req.user?.userId ?? null);

  if (req.user?.userId) {
    await logAuditEvent({
      eventType: "case_created",
      userId: req.user.userId,
      targetType: "case",
      targetId: caseRecord.id,
      details: { flowId: flow.id, caseReference: caseRecord.case_reference },
    });
  }

  const hydratedCase = await prisma.cases.findUnique({
    where: { id: caseRecord.id },
    include: {
      case_tasks: { orderBy: { id: "asc" } },
      case_events: { orderBy: { created_at: "asc" } },
      case_approvals: true,
    },
  });

  res.status(201).json({ data: hydratedCase ? toCaseDetail(hydratedCase) : caseRecord });
});

const closeOrCancelCase = async (req: Request, res: Response, status: "closed" | "cancelled") => {
  const id = readIntegerParam(req, "id", "case id");
  if (!req.user || (req.user.role !== "Admin" && req.user.role !== "Supervisor")) {
    res.status(403).json({ error: "Only admins and supervisors can close or cancel cases" });
    return;
  }

  const existing = await prisma.cases.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ error: "Case not found" });
    return;
  }
  if (existing.status === "closed" || existing.status === "cancelled") {
    res.status(409).json({ error: "Case is already closed or cancelled" });
    return;
  }

  const body = optionalBodyObject(req);
  const reason = readOptionalNullableString(body, "reason") ?? null;
  const caseRecord = await prisma.$transaction(async (tx) => {
    await tx.case_tasks.updateMany({
      where: { case_id: id, status: { in: ["pending", "assigned", "claimed", "overdue"] } },
      data: { status: "cancelled" },
    });
    await tx.case_approvals.updateMany({
      where: { case_id: id, status: "requested" },
      data: { status: "cancelled" },
    });
    await tx.case_escalations.updateMany({
      where: { case_id: id, status: "triggered" },
      data: { status: "cancelled" },
    });

    await tx.case_events.create({
      data: {
        case_id: id,
        actor_user_id: req.user?.userId ?? null,
        event_type: status === "closed" ? "case_closed" : "case_cancelled",
        summary: status === "closed" ? "Case closed" : "Case cancelled",
        data_json: toInputJson({ reason }),
      },
    });

    return tx.cases.update({
      where: { id },
      data: {
        status,
        current_node_key: null,
        current_task_id: null,
        ...(status === "closed" && { closed_at: new Date() }),
      },
      include: {
        case_tasks: { orderBy: { id: "asc" } },
        case_events: { orderBy: { created_at: "asc" } },
        case_approvals: true,
        case_escalations: true,
        case_documents: true,
        assignee_user: { select: { id: true, email: true, full_name: true } },
        assignee_team: true,
      },
    });
  });

  if (req.user?.userId) {
    await logAuditEvent({
      eventType: status === "closed" ? "case_closed" : "case_cancelled",
      userId: req.user.userId,
      targetType: "case",
      targetId: id,
      details: { reason },
    });
  }

  res.json({ data: toCaseDetail(caseRecord) });
};

router.post("/:id/close", async (req: Request, res: Response) => {
  await closeOrCancelCase(req, res, "closed");
});

router.post("/:id/cancel", async (req: Request, res: Response) => {
  await closeOrCancelCase(req, res, "cancelled");
});

router.post("/:id/escalations/:escalationId/resolve", async (req: Request, res: Response) => {
  const caseId = readIntegerParam(req, "id", "case id");
  const escalationId = readIntegerParam(req, "escalationId", "escalation id");
  if (!req.user || (req.user.role !== "Admin" && req.user.role !== "Supervisor")) {
    res.status(403).json({ error: "Only admins and supervisors can resolve escalations" });
    return;
  }

  const existing = await prisma.case_escalations.findFirst({
    where: { id: escalationId, case_id: caseId },
  });
  if (!existing) {
    res.status(404).json({ error: "Escalation not found" });
    return;
  }
  if (existing.status !== "triggered") {
    res.status(409).json({ error: "Escalation is not active" });
    return;
  }

  const body = optionalBodyObject(req);
  const reason = readOptionalNullableString(body, "reason") ?? null;
  const escalation = await prisma.$transaction(async (tx) => {
    const updated = await tx.case_escalations.update({
      where: { id: escalationId },
      data: {
        status: "resolved",
        resolved_at: new Date(),
        resolved_by_user_id: req.user?.userId ?? null,
      },
    });

    const [openTasks, pendingApprovals, activeEscalations] = await Promise.all([
      tx.case_tasks.count({ where: { case_id: caseId, status: { in: ["pending", "assigned", "claimed", "overdue"] } } }),
      tx.case_approvals.count({ where: { case_id: caseId, status: "requested" } }),
      tx.case_escalations.count({ where: { case_id: caseId, status: "triggered", id: { not: escalationId } } }),
    ]);
    const nextStatus = activeEscalations > 0 ? "escalated" : pendingApprovals > 0 ? "pending_approval" : openTasks > 0 ? "pending_action" : "intake";

    await tx.cases.update({
      where: { id: caseId },
      data: { status: nextStatus },
    });

    await tx.case_events.create({
      data: {
        case_id: caseId,
        flow_node_key: existing.flow_node_key,
        task_id: existing.source_task_id,
        actor_user_id: req.user?.userId ?? null,
        event_type: "escalation_resolved",
        summary: "Escalation resolved",
        data_json: toInputJson({ escalationId, reason }),
      },
    });

    return updated;
  });

  await logAuditEvent({
    eventType: "escalation_resolved",
    userId: req.user.userId,
    targetType: "escalation",
    targetId: escalationId,
    details: { caseId, reason },
  });

  res.json({ data: escalation });
});

router.post("/:id/notes", async (req: Request, res: Response) => {
  const id = readIntegerParam(req, "id", "case id");
  const body = asBodyObject(req);
  const note = readRequiredString(body, "note");

  const caseRecord = await prisma.cases.findUnique({
    where: { id },
    select: { id: true, created_by_user_id: true, assignee_user_id: true, assignee_team_id: true },
  });
  if (!caseRecord) {
    res.status(404).json({ error: "Case not found" });
    return;
  }
  if (!req.user || !(await canViewCase({ userId: req.user.userId, role: req.user.role }, caseRecord))) {
    res.status(403).json({ error: "You are not allowed to add notes to this case" });
    return;
  }

  const event = await prisma.case_events.create({
    data: {
      case_id: id,
      actor_user_id: req.user.userId,
      event_type: "note_added",
      summary: note.length > 160 ? `${note.slice(0, 157)}...` : note,
      data_json: toInputJson({ note }),
    },
  });

  res.status(201).json({ data: event });
});

router.get("/:id", async (req: Request, res: Response) => {
  const id = readIntegerParam(req, "id", "case id");

  const caseRecord = await prisma.cases.findUnique({
    where: { id },
    include: {
      case_tasks: { orderBy: { id: "asc" } },
      case_events: { orderBy: { created_at: "asc" } },
      case_approvals: true,
      case_escalations: true,
      case_documents: true,
      assignee_user: { select: { id: true, email: true, full_name: true } },
      assignee_team: true,
    },
  });

  if (!caseRecord) {
    res.status(404).json({ error: "Case not found" });
    return;
  }

  if (
    !req.user ||
    !(await canViewCase({ userId: req.user.userId, role: req.user.role }, {
      created_by_user_id: caseRecord.created_by_user_id,
      assignee_user_id: caseRecord.assignee_user_id,
      assignee_team_id: caseRecord.assignee_team_id,
    }))
  ) {
    res.status(403).json({ error: "You are not allowed to view this case" });
    return;
  }

  res.json({ data: toCaseDetail(caseRecord) });
});

export default router;
