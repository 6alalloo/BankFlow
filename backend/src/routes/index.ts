import { Router } from "express";
import userRoutes from "./userRoutes";
import roleRoutes from "./roleRoutes";
import authRoutes from "./authRoutes";
import auditRoutes from "./auditRoutes";
import dashboardRoutes from "./dashboardRoutes";
import fileRoutes from "./fileRoutes";
import flowRoutes from "./flowRoutes";
import caseRoutes from "./caseRoutes";
import taskRoutes from "./taskRoutes";
import approvalRoutes from "./approvalRoutes";
import teamRoutes from "./teamRoutes";
import settingsRoutes from "./settingsRoutes";

const router = Router();

// Auth routes (login, logout, etc.) - must be before protected routes
router.use("/auth", authRoutes);

// BankFlow case-flow authoring
router.use("/flows", flowRoutes);

// BankFlow runtime work surfaces
router.use("/cases", caseRoutes);
router.use("/tasks", taskRoutes);
router.use("/approvals", approvalRoutes);
router.use("/teams", teamRoutes);
router.use("/settings", settingsRoutes);

// /api/users/...
router.use("/users", userRoutes);

// /api/roles/...
router.use("/roles", roleRoutes);

// /api/audit/... (Admin-only)
router.use("/audit", auditRoutes);

// /api/dashboard/... (Case operations summary)
router.use("/dashboard", dashboardRoutes);

// /api/files/... (File uploads)
router.use("/files", fileRoutes);

export default router;

