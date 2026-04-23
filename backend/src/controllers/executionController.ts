/**
 * Execution HTTP Controllers
 *
 * Handles HTTP requests for workflow execution history, status tracking,
 * and execution detail retrieval. Delegates to executionService for
 * business logic and execution orchestration.
 *
 * Routes: /api/executions
 */

import { Request, Response, NextFunction } from "express";
import * as executionService from "../services/executionService";
import * as auditService from "../services/auditService";
import logger from "../lib/logger";
import {
  createNotFoundError,
  createValidationError,
  ErrorCodes,
  AppError,
} from "../types/errors";

/**
 * GET /api/executions
 * Optional query params:
 * - ?status=completed       → filter by execution status
 * - ?workflowId=3           → filter by workflow_id
 */
export async function getAllExecutions(req: Request, res: Response, next: NextFunction) {
  try {
    const { status, workflowId } = req.query;

    let workflowIdFilter: number | undefined = undefined;
    if (typeof workflowId === "string") {
      const parsed = Number(workflowId);
      if (!Number.isNaN(parsed)) {
        workflowIdFilter = parsed;
      }
    }

    const statusFilter =
      typeof status === "string" && status.trim().length > 0
        ? status.trim()
        : undefined;

    const executions = await executionService.getAllExecutions({
      status: statusFilter,
      workflowId: workflowIdFilter,
    });

    return res.status(200).json({
      data: executions,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/executions/:id
 * Returns a single execution by ID.
 */
export async function getExecutionById(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;

    const numericId = Number(id);
    if (Number.isNaN(numericId)) {
      throw createValidationError("Invalid execution ID");
    }

    const execution = await executionService.getExecutionById(numericId);

    if (!execution) {
      throw createNotFoundError("Execution", numericId);
    }

    return res.status(200).json({
      data: execution,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/workflows/:id/executions
 * Returns all executions for a given workflow.
 * Optional query:
 * - ?status=completed|failed|running
 */
export async function getExecutionsForWorkflow(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const { status } = req.query;

    const workflowId = Number(id);
    if (Number.isNaN(workflowId)) {
      throw createValidationError("Invalid workflow ID");
    }

    const statusFilter =
      typeof status === "string" && status.trim().length > 0
        ? status.trim()
        : undefined;

    const executions = await executionService.getAllExecutions({
      status: statusFilter,
      workflowId,
    });

    return res.status(200).json({
      data: executions,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/executions/:id/steps
 * Returns all steps for a given execution.
 */
export async function getExecutionSteps(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;

    const executionId = Number(id);
    if (Number.isNaN(executionId)) {
      throw createValidationError("Invalid execution ID");
    }

    const steps = await executionService.getExecutionStepsByExecutionId(
      executionId
    );

    // Even if there are no steps, we return 200 with an empty array.
    return res.status(200).json({
      data: steps,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/workflows/:id/execute
 * Triggers a workflow execution.
 *
 * Body shape (optional):
 * {
 *   "triggerType": "manual",
 *   "input": { ... any JSON ... }
 * }
 */
export async function executeWorkflow(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const { triggerType, input } = req.body || {};

    const workflowId = Number(id);
    if (Number.isNaN(workflowId)) {
      throw createValidationError("Invalid workflow ID");
    }

    const result = await executionService.executeWorkflow({
      workflowId,
      triggerType,
      input,
    });

    // result is { execution, steps, n8nResult }
    return res.status(201).json({
      data: result,
    });
  } catch (error: any) {
    // Handle custom error codes from executionService
    if (error.code === "WORKFLOW_NOT_FOUND") {
      return next(createNotFoundError("Workflow"));
    }

    if (error.code === "WORKFLOW_INACTIVE") {
      return next(new AppError("Workflow is not active", 400, ErrorCodes.INVALID_WORKFLOW_STATE));
    }

    if (error.code === "WORKFLOW_HAS_NO_NODES") {
      return next(createValidationError("Workflow has no nodes"));
    }

    next(error);
  }
}

/**
 * DELETE /api/executions/:id
 * Deletes an execution and its steps.
 */
export async function deleteExecution(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;

    const executionId = Number(id);
    if (Number.isNaN(executionId)) {
      throw createValidationError("Invalid execution ID");
    }

    const deleted = await executionService.deleteExecution(executionId);

    if (!deleted) {
      throw createNotFoundError("Execution", executionId);
    }

    const userId = (req as any).user?.userId || 1;
    await auditService.logAuditEvent({
      eventType: "execution_deleted",
      userId,
      targetType: "execution",
      targetId: executionId,
      details: {
        workflowId: deleted.workflow_id,
        triggerType: deleted.trigger_type,
        status: deleted.status,
      },
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
    });

    return res.status(204).send();
  } catch (error) {
    next(error);
  }
}
