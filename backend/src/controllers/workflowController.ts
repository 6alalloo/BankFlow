/**
 * Workflow HTTP Controllers
 *
 * Handles HTTP requests for workflow CRUD operations, graph management,
 * and workflow execution. Delegates business logic to workflowService
 * and executionService.
 *
 * Routes: /api/workflows
 */

import { Request, Response, NextFunction } from "express";
import * as workflowService from "../services/workflowService";
import * as auditService from "../services/auditService";
import {
  createNotFoundError,
  createValidationError,
} from "../types/errors";

/**
 * GET /api/workflows
 * List all workflows.
 */
export async function getAllWorkflows(req: Request, res: Response, next: NextFunction) {
  try {
    const { active, ownerId, q } = req.query;

    // active → boolean | undefined
    let isActiveFilter: boolean | undefined = undefined;
    if (active === "true") {
      isActiveFilter = true;
    } else if (active === "false") {
      isActiveFilter = false;
    }

    // ownerId → number | undefined
    let ownerIdFilter: number | undefined = undefined;
    if (typeof ownerId === "string") {
      const parsed = Number(ownerId);
      if (!Number.isNaN(parsed)) {
        ownerIdFilter = parsed;
      }
    }

    // q → string | undefined
    const query =
      typeof q === "string" && q.trim().length > 0 ? q.trim() : undefined;

    const workflows = await workflowService.getAllWorkflows({
      isActive: isActiveFilter,
      ownerId: ownerIdFilter,
      query,
    });

    return res.status(200).json({
      data: workflows,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/workflows/:id
 * Get a single workflow by ID.
 */
export async function getWorkflowById(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;

    const numericId = Number(id);
    if (Number.isNaN(numericId)) {
      throw createValidationError("Invalid workflow ID");
    }

    const workflow = await workflowService.getWorkflowById(numericId);

    if (!workflow) {
      throw createNotFoundError("Workflow", numericId);
    }

    return res.status(200).json({
      data: workflow,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /api/workflows/:id
 * Update workflow metadata (name, description, is_active, default_trigger).
 */
export async function updateWorkflow(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;

    const numericId = Number(id);
    if (Number.isNaN(numericId)) {
      throw createValidationError("Invalid workflow ID");
    }

    const { name, description, is_active, default_trigger } = req.body;

    const updated = await workflowService.updateWorkflow(numericId, {
      name,
      description,
      isActive: is_active,
      defaultTrigger: default_trigger,
    });

    if (!updated) {
      throw createNotFoundError("Workflow", numericId);
    }

    // Audit log
    const userId = (req as any).user?.userId || 1;
    await auditService.logAuditEvent({
      eventType: "workflow_updated",
      userId,
      targetType: "workflow",
      targetId: numericId,
      details: { action: "metadata_updated", name: updated.name },
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
    });

    return res.status(200).json({
      data: updated,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/workflows/:id/nodes
 * Get all nodes for a workflow.
 */
export async function getWorkflowNodes(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;

    const numericId = Number(id);
    if (Number.isNaN(numericId)) {
      throw createValidationError("Invalid workflow ID");
    }

    const nodes = await workflowService.getWorkflowNodes(numericId);

    return res.status(200).json({
      data: nodes,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/workflows/:id/edges
 * Get all edges for a workflow.
 */
export async function getWorkflowEdges(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;

    const numericId = Number(id);
    if (Number.isNaN(numericId)) {
      throw createValidationError("Invalid workflow ID");
    }

    const edges = await workflowService.getWorkflowEdges(numericId);

    return res.status(200).json({
      data: edges,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/workflows/:id/graph
 * Return { nodes, edges } for a workflow graph.
 */
export async function getWorkflowGraph(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;

    const numericId = Number(id);
    if (Number.isNaN(numericId)) {
      throw createValidationError("Invalid workflow ID");
    }

    const graph = await workflowService.getWorkflowGraph(numericId);

    if (!graph) {
      throw createNotFoundError("Workflow", numericId);
    }

    return res.status(200).json({
      data: graph,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/workflows/:id/nodes
 * Create a new node in the workflow.
 */


/**
 * PUT /api/workflows/:id/nodes/:nodeId
 * Update an existing node in the workflow.
 */
export async function updateWorkflowNode(req: Request, res: Response, next: NextFunction) {
  try {
    const { id, nodeId } = req.params;

    const workflowId = Number(id);
    const numericNodeId = Number(nodeId);

    if (Number.isNaN(workflowId) || Number.isNaN(numericNodeId)) {
      throw createValidationError("Invalid workflow ID or node ID");
    }

    const { kind, name, config, posX, posY } = req.body ?? {};

    const updated = await workflowService.updateWorkflowNode(
      workflowId,
      numericNodeId,
      {
        kind,
        name,
        config,
        posX,
        posY,
      }
    );

    if (!updated) {
      throw createNotFoundError("Node", numericNodeId);
    }

    // Audit log
    const userId = (req as any).user?.userId || 1;
    await auditService.logAuditEvent({
      eventType: "workflow_updated",
      userId,
      targetType: "workflow",
      targetId: workflowId,
      // Use updated.kind specifically
      details: { action: "node_updated", nodeId: numericNodeId, kind: updated.kind },
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
    });

    // Return whatever the frontend expects as the node shape
    return res.status(200).json({ data: updated });
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /api/workflows/:id/nodes/:nodeId
 * Delete a node from the workflow.
 */
export async function deleteWorkflowNode(req: Request, res: Response, next: NextFunction) {
  try {
    const { id, nodeId } = req.params;
    const numericId = Number(id);
    const numericNodeId = Number(nodeId);

    if (Number.isNaN(numericId) || Number.isNaN(numericNodeId)) {
      throw createValidationError("Invalid workflow ID or node ID");
    }

    const ok = await workflowService.deleteWorkflowNode(
      numericId,
      numericNodeId
    );

    if (!ok) {
      throw createNotFoundError("Node", numericNodeId);
    }

    // Audit log
    const userId = (req as any).user?.userId || 1;
    await auditService.logAuditEvent({
      eventType: "workflow_updated",
      userId,
      targetType: "workflow",
      targetId: numericId,
      // Use ok.kind (since 'ok' is now the node object)
      details: { action: "node_deleted", nodeId: numericNodeId, kind: ok.kind },
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
    });

    // 204 No Content is standard for successful delete
    return res.status(204).send();
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/workflows/:id/edges
 * Create a new edge between two nodes in the workflow.
 */
export async function createWorkflowEdge(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const numericId = Number(id);

    if (Number.isNaN(numericId)) {
      throw createValidationError("Invalid workflow ID");
    }

    const { fromNodeId, toNodeId, label, priority, condition } = req.body;

    if (typeof fromNodeId !== "number" || typeof toNodeId !== "number") {
      throw createValidationError("fromNodeId and toNodeId must be numbers");
    }

    const edge = await workflowService.createWorkflowEdge(numericId, {
      fromNodeId,
      toNodeId,
      label,
      priority,
      condition,
    });

    return res.status(201).json({ data: edge });
  } catch (error) {
    next(error);
  }
}

/**
 * PUT /api/workflows/:id/edges/:edgeId
 * Update an existing edge in the workflow.
 */
export async function updateWorkflowEdge(req: Request, res: Response, next: NextFunction) {
  try {
    const { id, edgeId } = req.params;
    const numericId = Number(id);
    const numericEdgeId = Number(edgeId);

    if (Number.isNaN(numericId) || Number.isNaN(numericEdgeId)) {
      throw createValidationError("Invalid workflow ID or edge ID");
    }

    const { fromNodeId, toNodeId, label, priority, condition } = req.body;

    const edge = await workflowService.updateWorkflowEdge(
      numericId,
      numericEdgeId,
      {
        fromNodeId,
        toNodeId,
        label,
        priority,
        condition,
      }
    );

    if (!edge) {
      throw createNotFoundError("Edge", numericEdgeId);
    }

    return res.status(200).json({ data: edge });
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /api/workflows/:id/edges/:edgeId
 * Delete an edge from the workflow.
 */
export async function deleteWorkflowEdge(req: Request, res: Response, next: NextFunction) {
  try {
    const { id, edgeId } = req.params;
    const numericId = Number(id);
    const numericEdgeId = Number(edgeId);

    if (Number.isNaN(numericId) || Number.isNaN(numericEdgeId)) {
      throw createValidationError("Invalid workflow ID or edge ID");
    }

    const ok = await workflowService.deleteWorkflowEdge(
      numericId,
      numericEdgeId
    );

    if (!ok) {
      throw createNotFoundError("Edge", numericEdgeId);
    }

    return res.status(204).send();
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/workflows/:id/nodes
 * Create a new node for a workflow.
 */
export async function createWorkflowNode(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const workflowId = Number(id);

    if (Number.isNaN(workflowId)) {
      throw createValidationError("Invalid workflow ID");
    }

    const { kind, name, config, posX, posY } = req.body as {
      kind?: string;
      name?: string;
      config?: Record<string, any>;
      posX?: number;
      posY?: number;
    };

    if (!kind) {
      throw createValidationError("Node kind is required");
    }

    const node = await workflowService.createWorkflowNode(workflowId, {
      kind: kind as any,
      name: name ?? null,
      config: config ?? {},
      posX,
      posY,
    });

    return res.status(201).json({ data: node });
  } catch (error) {
    next(error);
  }
}
export async function updateWorkflowNodePosition(req: Request, res: Response, next: NextFunction) {
  try {
    const { id, nodeId } = req.params;
    const { posX, posY } = req.body as {
      posX?: number;
      posY?: number;
    };

    const numericId = Number(id);
    const numericNodeId = Number(nodeId);

    if (Number.isNaN(numericId) || Number.isNaN(numericNodeId)) {
      throw createValidationError("Invalid workflow ID or node ID");
    }

    if (typeof posX !== "number" || typeof posY !== "number") {
      throw createValidationError("posX and posY must be numbers");
    }

    const updated = await workflowService.updateWorkflowNodePosition(
      numericId,
      numericNodeId,
      posX,
      posY
    );

    if (!updated) {
      throw createNotFoundError("Node", numericNodeId);
    }

    return res.status(200).json({ data: updated });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/workflows
 * Create a workflow.
 */
export async function createWorkflow(req: Request, res: Response, next: NextFunction) {
  try {
    const { name, description, isActive, ownerUserId, defaultTrigger } =
      req.body ?? {};
    const authUserId = (req as any).user?.userId;
    const resolvedOwnerUserId =
      typeof authUserId === "number"
        ? authUserId
        : typeof ownerUserId === "number"
          ? ownerUserId
          : null;

    if (typeof name !== "string" || name.trim().length === 0) {
      throw createValidationError("Workflow name is required");
    }

    const created = await workflowService.createWorkflow({
      name: name.trim(),
      description:
        typeof description === "string" && description.trim().length > 0
          ? description.trim()
          : null,
      isActive: typeof isActive === "boolean" ? isActive : undefined,
      ownerUserId: resolvedOwnerUserId,
      defaultTrigger:
        typeof defaultTrigger === "string" && defaultTrigger.trim().length > 0
          ? defaultTrigger.trim()
          : null,
    });

    // Audit log
    const userId =
      typeof authUserId === "number"
        ? authUserId
        : typeof resolvedOwnerUserId === "number"
          ? resolvedOwnerUserId
          : 1;
    await auditService.logAuditEvent({
      eventType: "workflow_created",
      userId,
      targetType: "workflow",
      targetId: created.id,
      details: { name: created.name },
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
    });

    return res.status(201).json({ data: created });
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /api/workflows/:id
 * Delete a workflow.
 */
export async function deleteWorkflow(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;

    const numericId = Number(id);
    if (Number.isNaN(numericId)) {
      throw createValidationError("Invalid workflow ID");
    }

    const workflow = await workflowService.getWorkflowById(numericId);
    if (!workflow) {
      throw createNotFoundError("Workflow", numericId);
    }

    await workflowService.deleteWorkflow(numericId);

    // Audit log
    const userId = (req as any).user?.userId || workflow.owner_user_id || 1;
    await auditService.logAuditEvent({
      eventType: "workflow_deleted",
      userId,
      targetType: "workflow",
      targetId: numericId,
      details: { name: workflow.name },
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
    });

    return res.status(204).send();
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/workflows/:id/duplicate
 * Duplicate a workflow with all its nodes and edges.
 */
export async function duplicateWorkflow(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;

    const numericId = Number(id);
    if (Number.isNaN(numericId)) {
      throw createValidationError("Invalid workflow ID");
    }

    const authUserId = (req as any).user?.userId;
    const duplicated = await workflowService.duplicateWorkflow(
      numericId,
      typeof authUserId === "number" ? authUserId : undefined
    );

    if (!duplicated) {
      throw createNotFoundError("Workflow", numericId);
    }

    // Audit log
    const userId = (req as any).user?.userId || 1;
    await auditService.logAuditEvent({
      eventType: "workflow_created",
      userId,
      targetType: "workflow",
      targetId: duplicated.id,
      details: {
        action: "duplicated",
        originalWorkflowId: numericId,
        name: duplicated.name,
      },
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
    });

    return res.status(201).json({ data: duplicated });
  } catch (error) {
    next(error);
  }
}

