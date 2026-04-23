import { Router } from "express";
import * as workflowController from "../controllers/workflowController";
import * as executionController from "../controllers/executionController";
import { authenticate } from "../middleware/authMiddleware";

const router = Router();

// All workflow routes require authentication
router.use(authenticate);

// List all workflows
router.get("/", workflowController.getAllWorkflows);


router.post("/", workflowController.createWorkflow);

// Update node position
router.patch(
  "/:id/nodes/:nodeId/position",
  workflowController.updateWorkflowNodePosition
);

// Get one workflow by id
router.get("/:id", workflowController.getWorkflowById);

// Update workflow metadata
router.patch("/:id", workflowController.updateWorkflow);

// Delete workflow
router.delete("/:id", workflowController.deleteWorkflow);

// Duplicate workflow
router.post("/:id/duplicate", workflowController.duplicateWorkflow);

// Get workflow nodes
router.get("/:id/nodes", workflowController.getWorkflowNodes);

// Get workflow edges
router.get("/:id/edges", workflowController.getWorkflowEdges);

// Get workflow graph
router.get("/:id/graph", workflowController.getWorkflowGraph);

// Create a new node
router.post("/:id/nodes", workflowController.createWorkflowNode);

// Update a node
router.put("/:id/nodes/:nodeId", workflowController.updateWorkflowNode);

// Delete a node
router.delete("/:id/nodes/:nodeId", workflowController.deleteWorkflowNode);

// Get executions for a workflow
router.get("/:id/executions", executionController.getExecutionsForWorkflow);

// Run or execute a workflow
router.post("/:id/execute", executionController.executeWorkflow);

// Create a new edge
router.post("/:id/edges", workflowController.createWorkflowEdge);

// Update an edge
router.put("/:id/edges/:edgeId", workflowController.updateWorkflowEdge);

// Delete an edge
router.delete("/:id/edges/:edgeId", workflowController.deleteWorkflowEdge);

export default router;
