// backend/src/services/auditService.ts
import prisma from "../lib/prisma";
import logger from "../lib/logger";

export interface AuditLogParams {
  eventType: string; // e.g., "workflow_created", "execution_completed"
  userId: number;
  targetType?: string; // e.g., "workflow", "execution"
  targetId?: number;
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

export interface GetAuditLogsParams {
  limit?: number;
  offset?: number;
  eventType?: string;
  userId?: number;
  targetType?: string;
  targetId?: number;
  startDate?: Date;
  endDate?: Date;
}

/**
 * Log an audit event to the database
 * Maps to existing audit_logs schema: actor_user_id, action, entity_type, entity_id, data_json
 */
export async function logAuditEvent(params: AuditLogParams) {
  try {
    const auditLog = await prisma.audit_logs.create({
      data: {
        actor_user_id: params.userId,
        action: params.eventType,
        entity_type: params.targetType || null,
        entity_id: params.targetId || null,
        data_json: JSON.stringify({
          details: params.details || {},
          ipAddress: params.ipAddress,
          userAgent: params.userAgent,
        }),
      },
    });

    return auditLog;
  } catch (error) {
    logger.error("Failed to log audit event", {
      service: "auditService",
      eventType: params.eventType,
      userId: params.userId,
      targetType: params.targetType,
      targetId: params.targetId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    // Don't throw - audit logging should not break main operations
    return null;
  }
}

/**
 * Get audit logs with filtering and pagination
 */
export async function getAuditLogs(params: GetAuditLogsParams = {}) {
  const {
    limit = 100,
    offset = 0,
    eventType,
    userId,
    targetType,
    targetId,
    startDate,
    endDate,
  } = params;

  const where: any = {};

  if (eventType) where.action = eventType;
  if (userId) where.actor_user_id = userId;
  if (targetType) where.entity_type = targetType;
  if (targetId) where.entity_id = targetId;

  if (startDate || endDate) {
    where.created_at = {};
    if (startDate) where.created_at.gte = startDate;
    if (endDate) where.created_at.lte = endDate;
  }

  const [logs, total] = await Promise.all([
    prisma.audit_logs.findMany({
      where,
      orderBy: { created_at: "desc" },
      take: limit,
      skip: offset,
      include: {
        users: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    }),
    prisma.audit_logs.count({ where }),
  ]);

  return {
    logs,
    total,
    limit,
    offset,
  };
}

/**
 * Get audit logs for a specific workflow
 */
export async function getWorkflowAuditLogs(workflowId: number, limit = 50) {
  return getAuditLogs({
    targetType: "workflow",
    targetId: workflowId,
    limit,
  });
}

/**
 * Get audit logs for a specific execution
 */
export async function getExecutionAuditLogs(executionId: number, limit = 50) {
  return getAuditLogs({
    targetType: "execution",
    targetId: executionId,
    limit,
  });
}

/**
 * Get recent audit logs for a user
 */
export async function getUserAuditLogs(userId: number, limit = 50) {
  return getAuditLogs({
    userId,
    limit,
  });
}

/**
 * Delete old audit logs (for maintenance)
 */
export async function deleteOldAuditLogs(daysToKeep: number) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

  const result = await prisma.audit_logs.deleteMany({
    where: {
      created_at: {
        lt: cutoffDate,
      },
    },
  });

  return result.count;
}
