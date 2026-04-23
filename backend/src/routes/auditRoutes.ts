// backend/src/routes/auditRoutes.ts
import { Router } from "express";
import * as auditController from "../controllers/auditController";
import { authenticate, adminOnly } from "../middleware/authMiddleware";

const router = Router();

// All audit routes require authentication and admin role
router.use(authenticate);
router.use(adminOnly);

// GET /api/audit - Get all audit logs with filtering
router.get("/", auditController.getAuditLogs);

// DELETE /api/audit/purge - Purge old audit logs (>90 days)
router.delete("/purge", auditController.purgeOldAuditLogs);

// GET /api/audit/workflow/:workflowId - Get audit logs for a workflow
router.get("/workflow/:workflowId", auditController.getWorkflowAuditLogs);

// GET /api/audit/execution/:executionId - Get audit logs for an execution
router.get("/execution/:executionId", auditController.getExecutionAuditLogs);

// GET /api/audit/user/:userId - Get audit logs for a user
router.get("/user/:userId", auditController.getUserAuditLogs);

export default router;
