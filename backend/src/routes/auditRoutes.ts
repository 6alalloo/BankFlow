// backend/src/routes/auditRoutes.ts
import { Router } from "express";
import * as auditController from "../controllers/auditController";
import { authenticate, adminOnly, authorize } from "../middleware/authMiddleware";

const router = Router();

// All audit routes require authentication. Auditors are read-only; purge remains admin-only.
router.use(authenticate);

// GET /api/audit - Get all audit logs with filtering
router.get("/", authorize("Admin", "Auditor"), auditController.getAuditLogs);

// DELETE /api/audit/purge - Purge old audit logs (>90 days)
router.delete("/purge", adminOnly, auditController.purgeOldAuditLogs);

// GET /api/audit/flow/:flowId - Get audit logs for a flow
router.get("/flow/:flowId", authorize("Admin", "Auditor"), auditController.getFlowAuditLogs);

// GET /api/audit/user/:userId - Get audit logs for a user
router.get("/user/:userId", authorize("Admin", "Auditor"), auditController.getUserAuditLogs);

export default router;
