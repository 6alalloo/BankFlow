import { Router } from "express";
import * as roleController from "../controllers/roleController";

const router = Router();

// GET /api/roles
router.get("/", roleController.getAllRoles);

// GET /api/roles/:id
router.get("/:id", roleController.getRoleById);

export default router;