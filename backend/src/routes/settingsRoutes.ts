// backend/src/routes/settingsRoutes.ts
import { Router } from "express";
import * as settingsController from "../controllers/settingsController";
import { authenticate, adminOnly } from "../middleware/authMiddleware";

const router = Router();

// All settings routes require authentication
router.use(authenticate);

// Public routes (available to all authenticated users)
// GET /api/settings/database-tables - Get available database tables for builder
router.get("/database-tables", settingsController.getDatabaseTables);

// Admin-only routes below this point
router.use(adminOnly);

// GET /api/settings/allow-list - Get all allowed domains
router.get("/allow-list", settingsController.getAllowedDomains);

// POST /api/settings/allow-list - Add a domain
router.post("/allow-list", settingsController.addAllowedDomain);

// DELETE /api/settings/allow-list/:id - Remove a domain
router.delete("/allow-list/:id", settingsController.removeAllowedDomain);

export default router;
