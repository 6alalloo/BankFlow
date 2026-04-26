import { Router, Request, Response } from "express";
import prisma from "../lib/prisma";
import { authenticate } from "../middleware/authMiddleware";

const router = Router();

router.use(authenticate);

router.get("/stats", async (_req: Request, res: Response) => {
  const [
    totalUsers,
    activeFlows,
    totalCases,
    openCases,
    overdueTasks,
    pendingApprovals,
  ] = await Promise.all([
    prisma.users.count(),
    prisma.case_flows.count({ where: { status: { not: "archived" } } }),
    prisma.cases.count(),
    prisma.cases.count({ where: { status: { notIn: ["closed", "cancelled"] } } }),
    prisma.case_tasks.count({ where: { status: "overdue" } }),
    prisma.case_approvals.count({ where: { status: "requested" } }),
  ]);

  res.json({
    totalUsers,
    avgDurationMs: 0,
    activeFlows,
    totalCases,
    openCases,
    overdueTasks,
    pendingApprovals,
    casesByStatus: {
      completed: totalCases - openCases,
      failed: overdueTasks,
      running: openCases,
      engine_error: pendingApprovals,
    },
  });
});

router.get("/charts", async (_req: Request, res: Response) => {
  const casesByStatus = await prisma.cases.groupBy({
    by: ["status"],
    _count: { status: true },
  });

  const statusBreakdown = casesByStatus.map((row) => ({
      name: row.status,
      value: row._count.status,
      color: "#22d3ee",
  }));

  res.json({
    activityByHour: [],
    volumeByDay: [],
    statusBreakdown,
    casesByStatus: statusBreakdown,
  });
});

export default router;
