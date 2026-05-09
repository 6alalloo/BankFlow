import { Router, Request, Response } from "express";
import prisma from "../lib/prisma";
import { authenticate } from "../middleware/authMiddleware";
import { advanceCaseRuntimeFromNode } from "../services/caseRuntimeService";
import { toInputJson } from "../lib/json";
import { canClaimTask, canCompleteTask, canViewAllOperationalQueues, getUserTeamIds } from "../services/authorizationService";
import { logAuditEvent } from "../services/auditService";
import { pageMeta, parseBoolean, parseDate, parseNumber, parsePageQuery } from "../lib/query";
import { Prisma } from "@prisma/client";
import { processOverdueWork } from "../services/slaService";

const router = Router();

router.use(authenticate);

const asObject = (value: unknown): Record<string, unknown> => {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
};

const getRequiredDocumentTypes = (taskInput: unknown): string[] => {
  const input = asObject(taskInput);
  const nodeConfig = asObject(input.nodeConfig);
  const required = nodeConfig.requiredDocuments ?? nodeConfig.required_documents;
  if (!Array.isArray(required)) return [];

  return required.filter((documentType): documentType is string => typeof documentType === "string" && documentType.trim().length > 0);
};

const toTaskResponse = (task: any) => ({
  id: task.id,
  case_id: task.case_id,
  flow_node_key: task.flow_node_key,
  task_type: task.task_type,
  title: task.title,
  status: task.status,
  assigned_user_id: task.assigned_user_id,
  assigned_team_id: task.assigned_team_id,
  claim_policy: task.claim_policy,
  claimed_at: task.claimed_at,
  due_at: task.due_at,
  completed_at: task.completed_at,
  completed_by_user_id: task.completed_by_user_id,
  decision: task.decision,
  input_json: task.input_json,
  output_json: task.output_json,
  assigned_user: task.assigned_user ?? null,
  assigned_team: task.assigned_team ?? null,
  case: task.cases ?? null,
});

router.post("/sla/process-overdue", async (req: Request, res: Response) => {
  if (!req.user || (req.user.role !== "Admin" && req.user.role !== "Supervisor")) {
    res.status(403).json({ error: "Only admins and supervisors can process overdue work" });
    return;
  }

  const result = await processOverdueWork();

  if (req.user?.userId) {
    await logAuditEvent({
      eventType: "sla_overdue_processed",
      userId: req.user.userId,
      targetType: "sla",
      details: result,
    });
  }

  res.json({ data: result });
});

router.get("/", async (req: Request, res: Response) => {
  const pageQuery = parsePageQuery(req);
  const assignedUserId = parseNumber(req.query.assignedUserId ?? req.query.assigned_user_id);
  const assignedTeamId = parseNumber(req.query.assignedTeamId ?? req.query.assigned_team_id);
  const caseId = parseNumber(req.query.caseId ?? req.query.case_id);
  const dueBefore = parseDate(req.query.dueBefore ?? req.query.due_before);
  const dueAfter = parseDate(req.query.dueAfter ?? req.query.due_after);
  const overdue = parseBoolean(req.query.overdue);
  const claimable = parseBoolean(req.query.claimable);

  const where: Prisma.case_tasksWhereInput = {};
  if (typeof req.query.status === "string" && req.query.status) where.status = req.query.status as never;
  if (assignedUserId) where.assigned_user_id = assignedUserId;
  if (assignedTeamId) where.assigned_team_id = assignedTeamId;
  if (caseId) where.case_id = caseId;
  if (dueBefore || dueAfter) {
    where.due_at = {
      ...(dueAfter && { gte: dueAfter }),
      ...(dueBefore && { lte: dueBefore }),
    };
  }
  if (overdue) {
    where.OR = [
      ...(where.OR ?? []),
      { status: "overdue" },
      { status: { in: ["pending", "assigned", "claimed"] }, due_at: { lt: new Date() } },
    ];
  }

  if (req.user && !canViewAllOperationalQueues(req.user.role)) {
    const teamIds = await getUserTeamIds(req.user.userId);
    where.AND = [
      ...(Array.isArray(where.AND) ? where.AND : []),
      {
        OR: [
          { assigned_user_id: req.user.userId },
          { completed_by_user_id: req.user.userId },
          ...(teamIds.length > 0 ? [{ assigned_team_id: { in: teamIds } }] : []),
          ...(claimable ? [{ assigned_user_id: null, assigned_team_id: null }] : []),
        ],
      },
    ];
  } else if (claimable) {
    where.claim_policy = "claim_required";
    where.status = { in: ["pending", "assigned"] } as never;
  }

  const [tasks, total] = await Promise.all([
    prisma.case_tasks.findMany({
      where,
      skip: pageQuery.skip,
      take: pageQuery.take,
      orderBy: [{ due_at: "asc" }, { id: "desc" }],
      include: {
        assigned_user: { select: { id: true, email: true, full_name: true } },
        assigned_team: true,
        cases: { select: { id: true, case_reference: true, title: true, status: true, priority: true } },
      },
    }),
    prisma.case_tasks.count({ where }),
  ]);

  res.json({ data: tasks.map(toTaskResponse), page: pageMeta(pageQuery, total) });
});

router.post("/:id/claim", async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid task id" });
    return;
  }

  const task = await prisma.$transaction(async (tx) => {
    const existing = await tx.case_tasks.findUnique({ where: { id } });
    if (!existing) return null;
    if (!["pending", "assigned"].includes(existing.status) || existing.claim_policy === "direct_assign") {
      return "conflict" as const;
    }
    if (!req.user || !(await canClaimTask({ userId: req.user.userId, role: req.user.role }, existing))) {
      return "forbidden" as const;
    }

    return tx.case_tasks.update({
      where: { id },
      data: {
        status: "claimed",
        assigned_user_id: req.user?.userId ?? null,
        claimed_at: new Date(),
        case_events: {
          create: {
            case_id: existing.case_id,
            actor_user_id: req.user?.userId ?? null,
            event_type: "task_claimed",
            summary: "Task claimed",
          },
        },
      },
    });
  });

  if (!task) {
    res.status(404).json({ error: "Task not found" });
    return;
  }
  if (task === "conflict") {
    res.status(409).json({ error: "Task cannot be claimed in its current state" });
    return;
  }
  if (task === "forbidden") {
    res.status(403).json({ error: "You are not allowed to claim this task" });
    return;
  }

  if (req.user?.userId) {
    await logAuditEvent({
      eventType: "task_claimed",
      userId: req.user.userId,
      targetType: "task",
      targetId: task.id,
      details: { caseId: task.case_id },
    });
  }

  res.json({ data: toTaskResponse(task) });
});

router.patch("/:id/assign", async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid task id" });
    return;
  }
  if (!req.user || (req.user.role !== "Admin" && req.user.role !== "Supervisor")) {
    res.status(403).json({ error: "Only admins and supervisors can reassign tasks" });
    return;
  }

  const assignedUserId = req.body?.assignedUserId ?? req.body?.assigned_user_id;
  const assignedTeamId = req.body?.assignedTeamId ?? req.body?.assigned_team_id;
  if (assignedUserId !== undefined && assignedUserId !== null && !Number.isInteger(Number(assignedUserId))) {
    res.status(400).json({ error: "assignedUserId must be an integer or null" });
    return;
  }
  if (assignedTeamId !== undefined && assignedTeamId !== null && !Number.isInteger(Number(assignedTeamId))) {
    res.status(400).json({ error: "assignedTeamId must be an integer or null" });
    return;
  }

  const existing = await prisma.case_tasks.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ error: "Task not found" });
    return;
  }
  if (["completed", "cancelled", "rejected"].includes(existing.status)) {
    res.status(409).json({ error: "Task cannot be reassigned in its current state" });
    return;
  }

  const [user, team] = await Promise.all([
    assignedUserId === undefined || assignedUserId === null
      ? Promise.resolve(null)
      : prisma.users.findUnique({ where: { id: Number(assignedUserId) }, select: { id: true } }),
    assignedTeamId === undefined || assignedTeamId === null
      ? Promise.resolve(null)
      : prisma.teams.findUnique({ where: { id: Number(assignedTeamId), is_active: true }, select: { id: true } }),
  ]);
  if (assignedUserId !== undefined && assignedUserId !== null && !user) {
    res.status(404).json({ error: "Assigned user not found" });
    return;
  }
  if (assignedTeamId !== undefined && assignedTeamId !== null && !team) {
    res.status(404).json({ error: "Assigned team not found" });
    return;
  }

  const task = await prisma.$transaction(async (tx) => {
    const updated = await tx.case_tasks.update({
      where: { id },
      data: {
        assigned_user_id: assignedUserId === undefined ? existing.assigned_user_id : assignedUserId === null ? null : Number(assignedUserId),
        assigned_team_id: assignedTeamId === undefined ? existing.assigned_team_id : assignedTeamId === null ? null : Number(assignedTeamId),
        status: assignedUserId || assignedTeamId ? "assigned" : "pending",
      },
      include: {
        assigned_user: { select: { id: true, email: true, full_name: true } },
        assigned_team: true,
        cases: { select: { id: true, case_reference: true, title: true, status: true, priority: true } },
      },
    });

    await tx.cases.update({
      where: { id: existing.case_id },
      data: {
        assignee_user_id: updated.assigned_user_id,
        assignee_team_id: updated.assigned_team_id,
      },
    });

    await tx.case_events.create({
      data: {
        case_id: existing.case_id,
        task_id: id,
        flow_node_key: existing.flow_node_key,
        actor_user_id: req.user?.userId ?? null,
        event_type: "status_updated",
        summary: "Task reassigned",
        data_json: toInputJson({
          assignedUserId: updated.assigned_user_id,
          assignedTeamId: updated.assigned_team_id,
        }),
      },
    });

    return updated;
  });

  await logAuditEvent({
    eventType: "task_reassigned",
    userId: req.user.userId,
    targetType: "task",
    targetId: task.id,
    details: { caseId: task.case_id, assignedUserId: task.assigned_user_id, assignedTeamId: task.assigned_team_id },
  });

  res.json({ data: toTaskResponse(task) });
});

router.post("/:id/complete", async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid task id" });
    return;
  }
  if (req.body?.decision !== undefined && typeof req.body.decision !== "string") {
    res.status(400).json({ error: "decision must be a string when provided" });
    return;
  }
  if (req.body?.output !== undefined && (typeof req.body.output !== "object" || Array.isArray(req.body.output) || req.body.output === null)) {
    res.status(400).json({ error: "output must be an object when provided" });
    return;
  }

  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.case_tasks.findUnique({
      where: { id },
      include: { cases: { select: { status: true, case_data_json: true, current_node_key: true } } },
    });
    if (!existing) return null;
    if (existing.status === "completed" || existing.status === "cancelled" || existing.status === "rejected") {
      return "conflict" as const;
    }
    if (!req.user || !(await canCompleteTask({ userId: req.user.userId, role: req.user.role }, existing))) {
      return "forbidden" as const;
    }
    if (existing.cases.status === "closed" || existing.cases.status === "cancelled" || existing.cases.status === "resolved") {
      return "case_closed" as const;
    }
    if (existing.cases.current_node_key !== existing.flow_node_key) {
      return "stale_task" as const;
    }
    if (existing.task_type === "document_collection") {
      const requiredDocumentTypes = getRequiredDocumentTypes(existing.input_json);
      const documents = await tx.case_documents.findMany({
        where: { case_id: existing.case_id, task_id: existing.id },
        select: { document_type: true },
      });
      if (documents.length === 0) {
        return "document_required" as const;
      }
      if (requiredDocumentTypes.length > 0) {
        const uploadedTypes = new Set(documents.map((document) => document.document_type).filter(Boolean));
        const missingTypes = requiredDocumentTypes.filter((documentType) => !uploadedTypes.has(documentType));
        if (missingTypes.length > 0) {
          return { type: "missing_documents" as const, missingTypes };
        }
      }
    }

    const output = req.body?.output || {};
    const caseData = asObject(existing.cases.case_data_json);
    const task = await tx.case_tasks.update({
      where: { id },
      data: {
        status: "completed",
        completed_at: new Date(),
        completed_by_user_id: req.user?.userId ?? null,
        decision: typeof req.body?.decision === "string" ? req.body.decision : null,
        output_json: toInputJson(output),
        case_events: {
          create: {
            case_id: existing.case_id,
            actor_user_id: req.user?.userId ?? null,
            event_type: "task_completed",
            summary: "Task completed",
            data_json: toInputJson(output),
          },
        },
      },
    });

    await tx.cases.update({
      where: { id: existing.case_id },
      data: {
        case_data_json: toInputJson({ ...caseData, ...asObject(output) }),
      },
    });

    return { existing, task };
  });

  if (!result) {
    res.status(404).json({ error: "Task not found" });
    return;
  }
  if (result === "conflict") {
    res.status(409).json({ error: "Task cannot be completed in its current state" });
    return;
  }
  if (result === "case_closed") {
    res.status(409).json({ error: "Case cannot be advanced in its current state" });
    return;
  }
  if (result === "document_required") {
    res.status(400).json({ error: "Document collection tasks require at least one uploaded document" });
    return;
  }
  if (result === "forbidden") {
    res.status(403).json({ error: "You are not allowed to complete this task" });
    return;
  }
  if (result === "stale_task") {
    res.status(409).json({ error: "Task is no longer the active case step" });
    return;
  }
  if (typeof result === "object" && "type" in result && result.type === "missing_documents") {
    res.status(400).json({ error: "Document collection task is missing required document types", missingTypes: result.missingTypes });
    return;
  }

  await advanceCaseRuntimeFromNode(result.existing.case_id, result.existing.flow_node_key, req.user?.userId ?? null, result.task.decision);

  if (req.user?.userId) {
    await logAuditEvent({
      eventType: "task_completed",
      userId: req.user.userId,
      targetType: "task",
      targetId: result.task.id,
      details: { caseId: result.existing.case_id, decision: result.task.decision },
    });
  }

  res.json({ data: toTaskResponse(result.task) });
});

export default router;
