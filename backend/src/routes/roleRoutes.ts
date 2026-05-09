import { Router } from "express";
import * as roleController from "../controllers/roleController";
import { authenticate, authorize } from "../middleware/authMiddleware";

const router = Router();

router.use(authenticate);

// GET /api/roles
router.get("/", authorize("Admin", "Designer", "Supervisor", "Auditor"), roleController.getAllRoles);

// GET /api/roles/:id
router.get("/:id", authorize("Admin", "Designer", "Supervisor", "Auditor"), roleController.getRoleById);

export default router;
