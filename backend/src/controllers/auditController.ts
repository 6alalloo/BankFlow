// backend/src/controllers/auditController.ts
import { Request, Response } from "express";
import * as auditService from "../services/auditService";
import logger from "../lib/logger";

/**
 * GET /api/audit
 * Get audit logs with filtering and pagination
 */
export async function getAuditLogs(req: Request, res: Response) {
  try {
    const {
      limit,
      offset,
      eventType,
      action, // Alias for eventType (more intuitive)
      userId,
      targetType,
      targetId,
      startDate,
      endDate,
    } = req.query;

    const params: any = {};

    if (limit) params.limit = parseInt(limit as string, 10);
    if (offset) params.offset = parseInt(offset as string, 10);
    // Support both 'action' and 'eventType' query params
    if (action || eventType) params.eventType = (action || eventType) as string;
    if (userId) params.userId = parseInt(userId as string, 10);
    if (targetType) params.targetType = targetType as string;
    if (targetId) params.targetId = parseInt(targetId as string, 10);
    if (startDate) params.startDate = new Date(startDate as string);
    if (endDate) params.endDate = new Date(endDate as string);

    const result = await auditService.getAuditLogs(params);

    return res.status(200).json({
      data: result.logs,
      total: result.total,
      limit: result.limit,
      offset: result.offset,
    });
  } catch (error) {
    logger.error("Error getting audit logs", {
      service: "AuditController",
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    return res.status(500).json({
      message: "Internal server error",
    });
  }
}

/**
 * GET /api/audit/workflow/:workflowId
 * Get audit logs for a specific workflow
 */
export async function getWorkflowAuditLogs(req: Request, res: Response) {
  try {
    const { workflowId } = req.params;
    const numericWorkflowId = parseInt(workflowId, 10);

    if (isNaN(numericWorkflowId)) {
      return res.status(400).json({
        message: "Invalid workflow ID",
      });
    }

    const result = await auditService.getWorkflowAuditLogs(numericWorkflowId);

    return res.status(200).json({
      data: result.logs,
      total: result.total,
    });
  } catch (error) {
    logger.error("Error getting workflow audit logs", {
      service: "AuditController",
      workflowId: req.params.workflowId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    return res.status(500).json({
      message: "Internal server error",
    });
  }
}

/**
 * GET /api/audit/execution/:executionId
 * Get audit logs for a specific execution
 */
export async function getExecutionAuditLogs(req: Request, res: Response) {
  try {
    const { executionId } = req.params;
    const numericExecutionId = parseInt(executionId, 10);

    if (isNaN(numericExecutionId)) {
      return res.status(400).json({
        message: "Invalid execution ID",
      });
    }

    const result = await auditService.getExecutionAuditLogs(numericExecutionId);

    return res.status(200).json({
      data: result.logs,
      total: result.total,
    });
  } catch (error) {
    logger.error("Error getting execution audit logs", {
      service: "AuditController",
      executionId: req.params.executionId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    return res.status(500).json({
      message: "Internal server error",
    });
  }
}

/**
 * GET /api/audit/user/:userId
 * Get audit logs for a specific user
 */
export async function getUserAuditLogs(req: Request, res: Response) {
  try {
    const { userId } = req.params;
    const numericUserId = parseInt(userId, 10);

    if (isNaN(numericUserId)) {
      return res.status(400).json({
        message: "Invalid user ID",
      });
    }

    const result = await auditService.getUserAuditLogs(numericUserId);

    return res.status(200).json({
      data: result.logs,
      total: result.total,
    });
  } catch (error) {
    logger.error("Error getting user audit logs", {
      service: "AuditController",
      userId: req.params.userId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    return res.status(500).json({
      message: "Internal server error",
    });
  }
}

/**
 * DELETE /api/audit/purge
 * Purge audit logs older than specified days (default 90)
 */
export async function purgeOldAuditLogs(req: Request, res: Response) {
  try {
    const days = parseInt(req.query.days as string, 10) || 90;

    if (days < 30) {
      return res.status(400).json({
        message: "Cannot purge logs less than 30 days old",
      });
    }

    // Log the purge action first (before deleting)
    const userId = (req as any).user?.userId;
    if (userId) {
      await auditService.logAuditEvent({
        eventType: "audit_logs_purged",
        userId: userId,
        targetType: "audit",
        details: { daysThreshold: days },
      });
    }

    const deletedCount = await auditService.deleteOldAuditLogs(days);

    return res.status(200).json({
      deleted: deletedCount,
      message: `Successfully purged ${deletedCount} audit log records older than ${days} days`,
    });
  } catch (error) {
    logger.error("Error purging audit logs", {
      service: "AuditController",
      days: req.query.days,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    return res.status(500).json({
      message: "Internal server error",
    });
  }
}
