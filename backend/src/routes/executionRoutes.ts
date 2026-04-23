
import { Router } from "express";
import * as executionController from "../controllers/executionController";
import { authenticate } from "../middleware/authMiddleware";

const router = Router();

router.use(authenticate);

// GET /api/executions
router.get("/", executionController.getAllExecutions);

// GET /api/executions/:id
router.get("/:id", executionController.getExecutionById);

// GET /api/executions/:id/steps
router.get("/:id/steps", executionController.getExecutionSteps);

// DELETE /api/executions/:id
router.delete("/:id", executionController.deleteExecution);

export default router;
