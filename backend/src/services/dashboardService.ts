// backend/src/services/dashboardService.ts
import prisma from "../lib/prisma";

export interface DashboardStats {
  totalUsers: number;
  activeWorkflows: number;
  executions24h: number;
  totalExecutions: number;
  avgDurationMs: number;
  executionsByStatus: {
    completed: number;
    failed: number;
    running: number;
    engine_error: number;
  };
}

export interface ActivityByHour {
  hour: string;
  count: number;
}

export interface VolumeByDay {
  day: string;
  count: number;
}

export interface ChartData {
  activityByHour: ActivityByHour[];
  volumeByDay: VolumeByDay[];
  statusBreakdown: { name: string; value: number; color: string }[];
}

/**
 * Get dashboard statistics for admin view
 */
export async function getAdminDashboardStats(): Promise<DashboardStats> {
  const now = new Date();
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  // Run queries in parallel for performance
  const [
    totalUsers,
    activeWorkflows,
    executions24h,
    totalExecutions,
    completedExecutions,
    statusCounts,
    avgDuration,
  ] = await Promise.all([
    // Total users
    prisma.users.count(),

    // Active workflows (not archived, is_active = true)
    prisma.workflows.count({
      where: {
        is_active: true,
        archived_at: null,
      },
    }),

    // Executions in last 24 hours
    prisma.executions.count({
      where: {
        started_at: {
          gte: twentyFourHoursAgo,
        },
      },
    }),

    // Total executions all time
    prisma.executions.count(),

    // Completed executions (for avg duration calculation)
    prisma.executions.findMany({
      where: {
        status: "completed",
        duration_ms: { not: null },
      },
      select: {
        duration_ms: true,
      },
    }),

    // Group by status
    prisma.executions.groupBy({
      by: ["status"],
      _count: { status: true },
    }),

    // Average duration of completed executions
    prisma.executions.aggregate({
      where: {
        status: "completed",
        duration_ms: { not: null },
      },
      _avg: {
        duration_ms: true,
      },
    }),
  ]);

  // Build status breakdown
  const executionsByStatus = {
    completed: 0,
    failed: 0,
    running: 0,
    engine_error: 0,
  };

  for (const group of statusCounts) {
    const status = group.status as keyof typeof executionsByStatus;
    if (status in executionsByStatus) {
      executionsByStatus[status] = group._count.status;
    }
  }

  return {
    totalUsers,
    activeWorkflows,
    executions24h,
    totalExecutions,
    avgDurationMs: avgDuration._avg.duration_ms ?? 0,
    executionsByStatus,
  };
}

/**
 * Get dashboard statistics for operator view (filtered by user's workflows)
 */
export async function getOperatorDashboardStats(userId: number): Promise<DashboardStats> {
  // Get workflows owned by this user
  const userWorkflowIds = await prisma.workflows.findMany({
    where: {
      owner_user_id: userId,
      archived_at: null,
    },
    select: { id: true },
  });

  const workflowIds = userWorkflowIds.map((w) => w.id);

  if (workflowIds.length === 0) {
    return {
      totalUsers: 0,
      activeWorkflows: 0,
      executions24h: 0,
      totalExecutions: 0,
      avgDurationMs: 0,
      executionsByStatus: {
        completed: 0,
        failed: 0,
        running: 0,
        engine_error: 0,
      },
    };
  }

  const now = new Date();
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const [
    activeWorkflows,
    executions24h,
    totalExecutions,
    statusCounts,
    avgDuration,
  ] = await Promise.all([
    prisma.workflows.count({
      where: {
        owner_user_id: userId,
        is_active: true,
        archived_at: null,
      },
    }),

    prisma.executions.count({
      where: {
        workflow_id: { in: workflowIds },
        started_at: { gte: twentyFourHoursAgo },
      },
    }),

    prisma.executions.count({
      where: {
        workflow_id: { in: workflowIds },
      },
    }),

    prisma.executions.groupBy({
      by: ["status"],
      where: {
        workflow_id: { in: workflowIds },
      },
      _count: { status: true },
    }),

    prisma.executions.aggregate({
      where: {
        workflow_id: { in: workflowIds },
        status: "completed",
        duration_ms: { not: null },
      },
      _avg: {
        duration_ms: true,
      },
    }),
  ]);

  const executionsByStatus = {
    completed: 0,
    failed: 0,
    running: 0,
    engine_error: 0,
  };

  for (const group of statusCounts) {
    const status = group.status as keyof typeof executionsByStatus;
    if (status in executionsByStatus) {
      executionsByStatus[status] = group._count.status;
    }
  }

  return {
    totalUsers: 0, // Not relevant for operator
    activeWorkflows,
    executions24h,
    totalExecutions,
    avgDurationMs: avgDuration._avg.duration_ms ?? 0,
    executionsByStatus,
  };
}

/**
 * Get chart data for dashboards
 */
export async function getDashboardChartData(userId?: number): Promise<ChartData> {
  const now = new Date();
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // Build where clause based on user
  let workflowFilter: { workflow_id?: { in: number[] } } = {};

  if (userId) {
    const userWorkflows = await prisma.workflows.findMany({
      where: { owner_user_id: userId, archived_at: null },
      select: { id: true },
    });
    workflowFilter = { workflow_id: { in: userWorkflows.map((w) => w.id) } };
  }

  // Get executions for the last 24 hours (for hourly chart)
  const recentExecutions = await prisma.executions.findMany({
    where: {
      ...workflowFilter,
      started_at: { gte: twentyFourHoursAgo },
    },
    select: {
      started_at: true,
      status: true,
    },
  });

  // Get executions for the last 7 days (for daily chart)
  const weeklyExecutions = await prisma.executions.findMany({
    where: {
      ...workflowFilter,
      started_at: { gte: sevenDaysAgo },
    },
    select: {
      started_at: true,
      status: true,
    },
  });

  // Build hourly activity data (last 24 hours)
  const hourlyMap = new Map<string, number>();
  for (let i = 0; i < 24; i++) {
    const hour = i.toString().padStart(2, "0") + ":00";
    hourlyMap.set(hour, 0);
  }

  for (const exec of recentExecutions) {
    const hour = new Date(exec.started_at).getHours().toString().padStart(2, "0") + ":00";
    hourlyMap.set(hour, (hourlyMap.get(hour) || 0) + 1);
  }

  const activityByHour: ActivityByHour[] = Array.from(hourlyMap.entries())
    .map(([hour, count]) => ({ hour, count }))
    .sort((a, b) => a.hour.localeCompare(b.hour));

  // Build daily volume data (last 7 days)
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const dailyMap = new Map<string, number>();

  // Initialize with last 7 days
  for (let i = 6; i >= 0; i--) {
    const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const dayName = dayNames[date.getDay()];
    dailyMap.set(dayName, 0);
  }

  for (const exec of weeklyExecutions) {
    const dayName = dayNames[new Date(exec.started_at).getDay()];
    dailyMap.set(dayName, (dailyMap.get(dayName) || 0) + 1);
  }

  // Order days starting from 6 days ago
  const volumeByDay: VolumeByDay[] = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const dayName = dayNames[date.getDay()];
    volumeByDay.push({ day: dayName, count: dailyMap.get(dayName) || 0 });
  }

  // Build status breakdown for pie chart
  const statusMap = new Map<string, number>();
  for (const exec of weeklyExecutions) {
    statusMap.set(exec.status, (statusMap.get(exec.status) || 0) + 1);
  }

  const statusColors: Record<string, string> = {
    completed: "#10b981",
    failed: "#f43f5e",
    running: "#3b82f6",
    engine_error: "#f59e0b",
  };

  const statusBreakdown = [
    { name: "Success", value: statusMap.get("completed") || 0, color: statusColors.completed },
    { name: "Failed", value: statusMap.get("failed") || 0, color: statusColors.failed },
    { name: "Running", value: statusMap.get("running") || 0, color: statusColors.running },
  ];

  // Add engine_error if present
  const engineErrors = statusMap.get("engine_error") || 0;
  if (engineErrors > 0) {
    statusBreakdown.push({ name: "Engine Error", value: engineErrors, color: statusColors.engine_error });
  }

  return {
    activityByHour,
    volumeByDay,
    statusBreakdown,
  };
}
