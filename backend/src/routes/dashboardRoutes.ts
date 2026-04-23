// backend/src/routes/dashboardRoutes.ts
import { Router, Request, Response } from "express";
import * as dashboardService from "../services/dashboardService";
import logger from "../lib/logger";
import { authenticate } from "../middleware/authMiddleware";

const router = Router();

router.use(authenticate);

/**
 * GET /api/dashboard/stats
 * Returns dashboard statistics based on user role
 */
router.get("/stats", async (req: Request, res: Response) => {
  try {
    const user = req.user;
    const isAdmin = user?.role === "Admin";

    let stats;
    if (isAdmin) {
      stats = await dashboardService.getAdminDashboardStats();
    } else if (user?.userId) {
      stats = await dashboardService.getOperatorDashboardStats(user.userId);
    } else {
      // Fallback to admin stats if no user context
      stats = await dashboardService.getAdminDashboardStats();
    }

    res.json(stats);
  } catch (error) {
    logger.error("Failed to fetch dashboard stats", {
      service: "dashboardRoutes",
      requestId: (req as any).requestId,
      userId: req.user?.userId,
      role: req.user?.role,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    res.status(500).json({ error: "Failed to fetch dashboard stats" });
  }
});

/**
 * GET /api/dashboard/charts
 * Returns chart data for dashboards
 */
router.get("/charts", async (req: Request, res: Response) => {
  try {
    const user = req.user;
    const isAdmin = user?.role === "Admin";

    // Admin sees all data, operators see only their workflows
    const chartData = await dashboardService.getDashboardChartData(
      isAdmin ? undefined : user?.userId
    );

    res.json(chartData);
  } catch (error) {
    logger.error("Failed to fetch dashboard chart data", {
      service: "dashboardRoutes",
      requestId: (req as any).requestId,
      userId: req.user?.userId,
      role: req.user?.role,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    res.status(500).json({ error: "Failed to fetch chart data" });
  }
});

export default router;
