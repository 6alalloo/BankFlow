
import { Router } from "express";
import workflowRoutes from "./workflowRoutes";
import userRoutes from "./userRoutes";
import roleRoutes from "./roleRoutes";
import executionRoutes from "./executionRoutes";
import authRoutes from "./authRoutes";
import auditRoutes from "./auditRoutes";
import dashboardRoutes from "./dashboardRoutes";
import settingsRoutes from "./settingsRoutes";
import fileRoutes from "./fileRoutes";

const router = Router();

// Auth routes (login, logout, etc.) - must be before protected routes
router.use("/auth", authRoutes);

// All workflow endpoints under /api/workflows
router.use("/workflows", workflowRoutes);

// /api/users/...
router.use("/users", userRoutes);

// /api/roles/...
router.use("/roles", roleRoutes);

// /api/executions/...
router.use("/executions", executionRoutes);

// /api/audit/... (Admin-only)
router.use("/audit", auditRoutes);

// /api/dashboard/... (Dashboard statistics)
router.use("/dashboard", dashboardRoutes);

// /api/settings/... (Admin-only settings)
router.use("/settings", settingsRoutes);

// /api/files/... (File uploads)
router.use("/files", fileRoutes);


export default router;

