import { Router, Request, Response } from "express";
import prisma from "../lib/prisma";
import { authenticate } from "../middleware/authMiddleware";
import { advanceCaseRuntimeFromNode } from "../services/caseRuntimeService";
import { toInputJson } from "../lib/json";
import { canDecideApproval, canViewAllOperationalQueues, getUserTeamIds } from "../services/authorizationService";
import { logAuditEvent } from "../services/auditService";
import { pageMeta, parseBoolean, parseDate, parseNumber, parsePageQuery } from "../lib/query";
import { Prisma } from "@prisma/client";

const router = Router();

router.use(authenticate);

const toApprovalResponse = (approval: any) => ({
  id: approval.id,
  case_id: approval.case_id,
  task_id: approval.task_id,
  flow_node_key: approval.flow_node_key,
  approval_label: approval.approval_label,
  status: approval.status,
  requested_from_user_id: approval.requested_from_user_id,
  requested_from_role_id: approval.requested_from_role_id,
  requested_from_team_id: approval.requested_from_team_id,
  requested_at: approval.requested_at,
  due_at: approval.due_at,
  decided_at: approval.decided_at,
  decided_by_user_id: approval.decided_by_user_id,
  required_comment: approval.required_comment,
  decision_reason: approval.decision_reason,
  case: approval.cases ?? null,
  requested_from_user: approval.requested_from_user ?? null,
  requested_from_role: approval.requested_from_role ?? null,
  requested_from_team: approval.requested_from_team ?? null,
  decided_by_user: approval.decided_by_user ?? null,
});

router.get("/", async (req: Request, res: Response) => {
  const pageQuery = parsePageQuery(req);
  const caseId = parseNumber(req.query.caseId ?? req.query.case_id);
  const requestedUserId = parseNumber(req.query.requestedUserId ?? req.query.requested_from_user_id);
  const requestedTeamId = parseNumber(req.query.requestedTeamId ?? req.query.requested_from_team_id);
  const requestedRoleId = parseNumber(req.query.requestedRoleId ?? req.query.requested_from_role_id);
  const dueBefore = parseDate(req.query.dueBefore ?? req.query.due_before);
  const dueAfter = parseDate(req.query.dueAfter ?? req.query.due_after);
  const overdue = parseBoolean(req.query.overdue);

  const where: Prisma.case_approvalsWhereInput = {};
  if (typeof req.query.status === "string" && req.query.status) where.status = req.query.status as never;
  if (caseId) where.case_id = caseId;
  if (requestedUserId) where.requested_from_user_id = requestedUserId;
  if (requestedTeamId) where.requested_from_team_id = requestedTeamId;
  if (requestedRoleId) where.requested_from_role_id = requestedRoleId;
  if (dueBefore || dueAfter) {
    where.due_at = {
      ...(dueAfter && { gte: dueAfter }),
      ...(dueBefore && { lte: dueBefore }),
    };
  }
  if (overdue) {
    where.AND = [
      ...(Array.isArray(where.AND) ? where.AND : []),
      { status: "requested", due_at: { lt: new Date() } },
    ];
  }

  if (req.user && !canViewAllOperationalQueues(req.user.role)) {
    const [teamIds, user] = await Promise.all([
      getUserTeamIds(req.user.userId),
      prisma.users.findUnique({ where: { id: req.user.userId }, select: { role_id: true } }),
    ]);
    where.AND = [
      ...(Array.isArray(where.AND) ? where.AND : []),
      {
        OR: [
          { requested_from_user_id: req.user.userId },
          ...(teamIds.length > 0 ? [{ requested_from_team_id: { in: teamIds } }] : []),
          ...(user ? [{ requested_from_role_id: user.role_id }] : []),
        ],
      },
    ];
  }

  const [approvals, total] = await Promise.all([
    prisma.case_approvals.findMany({
      where,
      skip: pageQuery.skip,
      take: pageQuery.take,
      orderBy: [{ due_at: "asc" }, { requested_at: "desc" }],
      include: {
        cases: { select: { id: true, case_reference: true, title: true, status: true } },
        requested_from_user: { select: { id: true, email: true, full_name: true } },
        requested_from_role: true,
        requested_from_team: true,
        decided_by_user: { select: { id: true, email: true, full_name: true } },
      },
    }),
    prisma.case_approvals.count({ where }),
  ]);

  res.json({ data: approvals.map(toApprovalResponse), page: pageMeta(pageQuery, total) });
});

router.patch("/:id/assign", async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid approval id" });
    return;
  }
  if (!req.user || (req.user.role !== "Admin" && req.user.role !== "Supervisor")) {
    res.status(403).json({ error: "Only admins and supervisors can reassign approvals" });
    return;
  }

  const requestedFromUserId = req.body?.requestedFromUserId ?? req.body?.requested_from_user_id;
  const requestedFromTeamId = req.body?.requestedFromTeamId ?? req.body?.requested_from_team_id;
  const requestedFromRoleId = req.body?.requestedFromRoleId ?? req.body?.requested_from_role_id;
  const hasTarget =
    requestedFromUserId !== undefined || requestedFromTeamId !== undefined || requestedFromRoleId !== undefined;
  if (!hasTarget) {
    res.status(400).json({ error: "At least one approval target must be provided" });
    return;
  }

  for (const [field, value] of [
    ["requestedFromUserId", requestedFromUserId],
    ["requestedFromTeamId", requestedFromTeamId],
    ["requestedFromRoleId", requestedFromRoleId],
  ] as const) {
    if (value !== undefined && value !== null && !Number.isInteger(Number(value))) {
      res.status(400).json({ error: `${field} must be an integer or null` });
      return;
    }
  }

  const existing = await prisma.case_approvals.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ error: "Approval not found" });
    return;
  }
  if (existing.status !== "requested") {
    res.status(409).json({ error: "Only requested approvals can be reassigned" });
    return;
  }

  const [user, team, role] = await Promise.all([
    requestedFromUserId === undefined || requestedFromUserId === null
      ? Promise.resolve(null)
      : prisma.users.findUnique({ where: { id: Number(requestedFromUserId) }, select: { id: true } }),
    requestedFromTeamId === undefined || requestedFromTeamId === null
      ? Promise.resolve(null)
      : prisma.teams.findUnique({ where: { id: Number(requestedFromTeamId), is_active: true }, select: { id: true } }),
    requestedFromRoleId === undefined || requestedFromRoleId === null
      ? Promise.resolve(null)
      : prisma.roles.findUnique({ where: { id: Number(requestedFromRoleId) }, select: { id: true } }),
  ]);
  if (requestedFromUserId !== undefined && requestedFromUserId !== null && !user) {
    res.status(404).json({ error: "Requested user not found" });
    return;
  }
  if (requestedFromTeamId !== undefined && requestedFromTeamId !== null && !team) {
    res.status(404).json({ error: "Requested team not found" });
    return;
  }
  if (requestedFromRoleId !== undefined && requestedFromRoleId !== null && !role) {
    res.status(404).json({ error: "Requested role not found" });
    return;
  }

  const approval = await prisma.$transaction(async (tx) => {
    const updated = await tx.case_approvals.update({
      where: { id },
      data: {
        requested_from_user_id:
          requestedFromUserId === undefined ? existing.requested_from_user_id : requestedFromUserId === null ? null : Number(requestedFromUserId),
        requested_from_team_id:
          requestedFromTeamId === undefined ? existing.requested_from_team_id : requestedFromTeamId === null ? null : Number(requestedFromTeamId),
        requested_from_role_id:
          requestedFromRoleId === undefined ? existing.requested_from_role_id : requestedFromRoleId === null ? null : Number(requestedFromRoleId),
      },
      include: {
        cases: { select: { id: true, case_reference: true, title: true, status: true } },
        requested_from_user: { select: { id: true, email: true, full_name: true } },
        requested_from_role: true,
        requested_from_team: true,
        decided_by_user: { select: { id: true, email: true, full_name: true } },
      },
    });

    await tx.case_events.create({
      data: {
        case_id: existing.case_id,
        flow_node_key: existing.flow_node_key,
        actor_user_id: req.user?.userId ?? null,
        event_type: "status_updated",
        summary: "Approval reassigned",
        data_json: toInputJson({
          requestedFromUserId: updated.requested_from_user_id,
          requestedFromTeamId: updated.requested_from_team_id,
          requestedFromRoleId: updated.requested_from_role_id,
        }),
      },
    });

    return updated;
  });

  await logAuditEvent({
    eventType: "approval_reassigned",
    userId: req.user.userId,
    targetType: "approval",
    targetId: approval.id,
    details: {
      caseId: approval.case_id,
      requestedFromUserId: approval.requested_from_user_id,
      requestedFromTeamId: approval.requested_from_team_id,
      requestedFromRoleId: approval.requested_from_role_id,
    },
  });

  res.json({ data: toApprovalResponse(approval) });
});

async function decideApproval(
  id: number,
  decision: "approved" | "rejected",
  user: { userId: number; role: string } | undefined,
  reason?: string
) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.case_approvals.findUnique({
      where: { id },
      include: { cases: { select: { status: true, current_node_key: true } } },
    });
    if (!existing) return null;
    if (existing.status !== "requested") return "conflict" as const;
    if (!user || !(await canDecideApproval(user, existing))) return "forbidden" as const;
    if (existing.required_comment && !reason?.trim()) return "comment_required" as const;
    if (existing.cases.status === "closed" || existing.cases.status === "cancelled" || existing.cases.status === "resolved") {
      return "case_closed" as const;
    }
    if (existing.cases.current_node_key !== existing.flow_node_key) return "stale_approval" as const;

    const approval = await tx.case_approvals.update({
      where: { id },
      data: {
        status: decision,
        decided_at: new Date(),
        decided_by_user_id: user.userId,
        decision_reason: reason || null,
      },
    });

    await tx.case_events.create({
      data: {
        case_id: existing.case_id,
        actor_user_id: user.userId,
        event_type: "approval_decided",
        summary: `Approval ${decision}`,
        data_json: toInputJson({ approvalId: id, decision, reason }),
      },
    });

    return approval;
  });
}

router.post("/:id/approve", async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid approval id" });
    return;
  }
  if (req.body?.reason !== undefined && typeof req.body.reason !== "string") {
    res.status(400).json({ error: "reason must be a string when provided" });
    return;
  }

  const approval = await decideApproval(id, "approved", req.user ? { userId: req.user.userId, role: req.user.role } : undefined, req.body?.reason);
  if (!approval) {
    res.status(404).json({ error: "Approval not found" });
    return;
  }
  if (approval === "conflict") {
    res.status(409).json({ error: "Approval has already been decided or cannot be decided" });
    return;
  }
  if (approval === "comment_required") {
    res.status(400).json({ error: "A decision reason is required for this approval" });
    return;
  }
  if (approval === "case_closed") {
    res.status(409).json({ error: "Case cannot be advanced in its current state" });
    return;
  }
  if (approval === "forbidden") {
    res.status(403).json({ error: "You are not allowed to decide this approval" });
    return;
  }
  if (approval === "stale_approval") {
    res.status(409).json({ error: "Approval is no longer the active case step" });
    return;
  }

  await advanceCaseRuntimeFromNode(approval.case_id, approval.flow_node_key, req.user?.userId ?? null, "approved");

  if (req.user?.userId) {
    await logAuditEvent({
      eventType: "approval_decided",
      userId: req.user.userId,
      targetType: "approval",
      targetId: approval.id,
      details: { caseId: approval.case_id, decision: "approved" },
    });
  }

  res.json({ data: toApprovalResponse(approval) });
});

router.post("/:id/reject", async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid approval id" });
    return;
  }
  if (req.body?.reason !== undefined && typeof req.body.reason !== "string") {
    res.status(400).json({ error: "reason must be a string when provided" });
    return;
  }

  const approval = await decideApproval(id, "rejected", req.user ? { userId: req.user.userId, role: req.user.role } : undefined, req.body?.reason);
  if (!approval) {
    res.status(404).json({ error: "Approval not found" });
    return;
  }
  if (approval === "conflict") {
    res.status(409).json({ error: "Approval has already been decided or cannot be decided" });
    return;
  }
  if (approval === "comment_required") {
    res.status(400).json({ error: "A decision reason is required for this approval" });
    return;
  }
  if (approval === "case_closed") {
    res.status(409).json({ error: "Case cannot be advanced in its current state" });
    return;
  }
  if (approval === "forbidden") {
    res.status(403).json({ error: "You are not allowed to decide this approval" });
    return;
  }
  if (approval === "stale_approval") {
    res.status(409).json({ error: "Approval is no longer the active case step" });
    return;
  }

  await advanceCaseRuntimeFromNode(approval.case_id, approval.flow_node_key, req.user?.userId ?? null, "rejected");

  if (req.user?.userId) {
    await logAuditEvent({
      eventType: "approval_decided",
      userId: req.user.userId,
      targetType: "approval",
      targetId: approval.id,
      details: { caseId: approval.case_id, decision: "rejected" },
    });
  }

  res.json({ data: toApprovalResponse(approval) });
});

export default router;
