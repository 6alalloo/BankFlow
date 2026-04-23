import { Router } from "express";
import * as userController from "../controllers/userController";
import { authenticate, adminOnly } from "../middleware/authMiddleware";

const router = Router();

// All user management routes require authentication and admin role
router.use(authenticate);
router.use(adminOnly);

// GET /api/users - List all users with optional filters
router.get("/", userController.getAllUsers);

// GET /api/users/:id - Get a single user by ID
router.get("/:id", userController.getUserById);

// POST /api/users - Create a new user
router.post("/", userController.createUser);

// PUT /api/users/:id - Update user details (email, full_name, role_id)
router.put("/:id", userController.updateUser);

// PATCH /api/users/:id/status - Toggle user active status
router.patch("/:id/status", userController.toggleUserStatus);

// PATCH /api/users/:id/password - Change user password (Admin can only change Operator passwords)
router.patch("/:id/password", userController.changeUserPassword);

export default router;