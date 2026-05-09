import { Router, Request, Response } from "express";
import { Prisma } from "@prisma/client";
import prisma from "../lib/prisma";
import { authenticate } from "../middleware/authMiddleware";
import { canViewAllOperationalQueues, getUserTeamIds } from "../services/authorizationService";

const router = Router();

router.use(authenticate);

const getScopedCaseWhere = async (req: Request): Promise<Prisma.casesWhereInput> => {
  if (!req.user || canViewAllOperationalQueues(req.user.role)) return {};

  const teamIds = await getUserTeamIds(req.user.userId);
  return {
    OR: [
      { created_by_user_id: req.user.userId },
      { assignee_user_id: req.user.userId },
      ...(teamIds.length > 0 ? [{ assignee_team_id: { in: teamIds } }] : []),
    ],
  };
};

router.get("/stats", async (req: Request, res: Response) => {
  const caseWhere = await getScopedCaseWhere(req);
  const activeCaseWhere: Prisma.casesWhereInput = {
    AND: [caseWhere, { status: { notIn: ["closed", "cancelled"] } }],
  };
  const resolvedCaseWhere: Prisma.casesWhereInput = {
    AND: [caseWhere, { resolved_at: { not: null } }],
  };
  const [
    totalUsers,
    activeFlows,
    totalCases,
    openCases,
    overdueTasks,
    pendingApprovals,
    resolvedCases,
    casesByStatusRows,
    activeEscalations,
  ] = await Promise.all([
    prisma.users.count(),
    prisma.case_flows.count({ where: { status: { not: "archived" } } }),
    prisma.cases.count({ where: caseWhere }),
    prisma.cases.count({ where: activeCaseWhere }),
    prisma.case_tasks.count({
      where: {
        cases: caseWhere,
        OR: [{ status: "overdue" }, { due_at: { lt: new Date() }, status: { in: ["pending", "assigned", "claimed"] } }],
      },
    }),
    prisma.case_approvals.count({ where: { cases: caseWhere, status: "requested" } }),
    prisma.cases.findMany({
      where: resolvedCaseWhere,
      select: { opened_at: true, resolved_at: true },
    }),
    prisma.cases.groupBy({ by: ["status"], where: caseWhere, _count: { status: true } }),
    prisma.case_escalations.count({ where: { cases: caseWhere, status: "triggered" } }),
  ]);

  const avgDurationMs =
    resolvedCases.length === 0
      ? 0
      : Math.round(
          resolvedCases.reduce((sum, item) => sum + ((item.resolved_at?.getTime() ?? 0) - item.opened_at.getTime()), 0) /
            resolvedCases.length
        );

  const casesByStatus = Object.fromEntries(casesByStatusRows.map((row) => [row.status, row._count.status]));

  res.json({
    totalUsers,
    avgDurationMs,
    activeFlows,
    totalCases,
    openCases,
    overdueTasks,
    pendingApprovals,
    activeEscalations,
    casesByStatus,
  });
});

router.get("/charts", async (req: Request, res: Response) => {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const caseWhere = await getScopedCaseWhere(req);
  const [casesByStatus, recentCases, recentEvents] = await Promise.all([
    prisma.cases.groupBy({
      by: ["status"],
      where: caseWhere,
      _count: { status: true },
    }),
    prisma.cases.findMany({
      where: { AND: [caseWhere, { opened_at: { gte: since } }] },
      select: { opened_at: true },
    }),
    prisma.case_events.findMany({
      where: { created_at: { gte: since }, cases: caseWhere },
      select: { created_at: true },
    }),
  ]);

  const statusBreakdown = casesByStatus.map((row) => ({
      name: row.status,
      value: row._count.status,
      color: "#22d3ee",
  }));

  const volumeByDay = Array.from({ length: 7 }, (_, offset) => {
    const date = new Date(since);
    date.setDate(since.getDate() + offset);
    const key = date.toISOString().slice(0, 10);
    return {
      date: key,
      count: recentCases.filter((item) => item.opened_at.toISOString().slice(0, 10) === key).length,
    };
  });

  const activityByHour = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    count: recentEvents.filter((item) => item.created_at.getHours() === hour).length,
  }));

  res.json({
    activityByHour,
    volumeByDay,
    statusBreakdown,
    casesByStatus: statusBreakdown,
  });
});

export default router;
