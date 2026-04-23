import { Request, Response } from "express";
import * as userService from "../services/userService";
import logger from "../lib/logger";
import { createValidationError, createForbiddenError, createNotFoundError } from "../types/errors";

/**
 * GET /api/users
 * Optional query params:
 * - ?active=true|false  → filter by is_active
 * - ?role=Admin         → filter by role name
 * - ?q=ali              → search in email OR full_name (case-insensitive)
 */
export async function getAllUsers(req: Request, res: Response) {
  try {
    const { active, role, q } = req.query;

    // Parse "active" query param into boolean | undefined.
    let isActiveFilter: boolean | undefined = undefined;
    if (active === "true") {
      isActiveFilter = true;
    } else if (active === "false") {
      isActiveFilter = false;
    }

    // Normalize role name.
    const roleName =
      typeof role === "string" && role.trim().length > 0 ? role.trim() : undefined;

    // Normalize query text (q).
    const query =
      typeof q === "string" && q.trim().length > 0 ? q.trim() : undefined;

    const users = await userService.getAllUsers({
      isActive: isActiveFilter,
      roleName,
      query,
    });

    return res.status(200).json({
      data: users,
    });
  } catch (error) {
    logger.error("Error getting all users", {
      service: "UserController",
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    return res.status(500).json({
      message: "Internal server error",
    });
  }
}

/**
 * GET /api/users/:id
 * Returns a single user by ID.
 */
export async function getUserById(req: Request, res: Response) {
  const { id } = req.params;

  const numericId = Number(id);
  if (Number.isNaN(numericId)) {
    return res.status(400).json({
      message: "Invalid user ID",
    });
  }

  try {
    const user = await userService.getUserById(numericId);

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    return res.status(200).json({
      data: user,
    });
  } catch (error) {
    logger.error("Error getting user by id", {
      service: "UserController",
      userId: numericId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    return res.status(500).json({
      message: "Internal server error",
    });
  }
}

/**
 * POST /api/users
 * Create a new user.
 * Body: { email, full_name, password, role_id }
 */
export async function createUser(req: Request, res: Response) {
  try {
    const { email, full_name, password, role_id } = req.body;

    // Validate required fields
    if (!email || typeof email !== "string" || email.trim().length === 0) {
      throw createValidationError("Email is required", "email");
    }

    if (!full_name || typeof full_name !== "string" || full_name.trim().length === 0) {
      throw createValidationError("Full name is required", "full_name");
    }

    if (!password || typeof password !== "string" || password.length < 8) {
      throw createValidationError("Password must be at least 8 characters", "password");
    }

    if (!role_id || typeof role_id !== "number") {
      throw createValidationError("Role ID is required", "role_id");
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      throw createValidationError("Invalid email format", "email");
    }

    // Check if email already exists
    const emailTaken = await userService.emailExists(email.trim());
    if (emailTaken) {
      throw createValidationError("Email already exists", "email");
    }

    // Check if role exists
    const roleValid = await userService.roleExists(role_id);
    if (!roleValid) {
      throw createValidationError("Invalid role ID", "role_id");
    }

    const user = await userService.createUser({
      email: email.trim(),
      full_name: full_name.trim(),
      password,
      role_id,
    });

    logger.info("User created", {
      service: "UserController",
      userId: user.id,
      email: user.email,
      createdBy: req.user?.userId
    });

    return res.status(201).json({
      data: user,
    });
  } catch (error: any) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        message: error.message,
        errorCode: error.errorCode,
      });
    }

    logger.error("Error creating user", {
      service: "UserController",
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    return res.status(500).json({
      message: "Internal server error",
    });
  }
}

/**
 * PUT /api/users/:id
 * Update user details (email, full_name, role_id).
 * Does not allow password updates.
 */
export async function updateUser(req: Request, res: Response) {
  const { id } = req.params;
  const numericId = Number(id);

  if (Number.isNaN(numericId)) {
    return res.status(400).json({ message: "Invalid user ID" });
  }

  try {
    // Self-edit protection
    if (req.user?.userId === numericId) {
      throw createForbiddenError("Cannot modify your own account");
    }

    const { email, full_name, role_id } = req.body;

    // Check if user exists
    const existingUser = await userService.getUserById(numericId);
    if (!existingUser) {
      throw createNotFoundError("User", numericId);
    }

    // Validate email if provided
    if (email !== undefined) {
      if (typeof email !== "string" || email.trim().length === 0) {
        throw createValidationError("Email cannot be empty", "email");
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        throw createValidationError("Invalid email format", "email");
      }

      const emailTaken = await userService.emailExistsExcluding(email.trim(), numericId);
      if (emailTaken) {
        throw createValidationError("Email already exists", "email");
      }
    }

    // Validate full_name if provided
    if (full_name !== undefined && (typeof full_name !== "string" || full_name.trim().length === 0)) {
      throw createValidationError("Full name cannot be empty", "full_name");
    }

    // Validate role_id if provided
    if (role_id !== undefined) {
      if (typeof role_id !== "number") {
        throw createValidationError("Invalid role ID", "role_id");
      }

      const roleValid = await userService.roleExists(role_id);
      if (!roleValid) {
        throw createValidationError("Invalid role ID", "role_id");
      }

      // Last admin protection: Check if changing role away from Admin
      const adminRoleId = await userService.getAdminRoleId();
      if (existingUser.roles.name === "Admin" && role_id !== adminRoleId) {
        const isLast = await userService.isLastActiveAdmin(numericId);
        if (isLast) {
          throw createForbiddenError("Cannot remove the last active administrator");
        }
      }
    }

    const user = await userService.updateUser(numericId, {
      email: email?.trim(),
      full_name: full_name?.trim(),
      role_id,
    });

    logger.info("User updated", {
      service: "UserController",
      userId: user.id,
      updatedBy: req.user?.userId
    });

    return res.status(200).json({
      data: user,
    });
  } catch (error: any) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        message: error.message,
        errorCode: error.errorCode,
      });
    }

    logger.error("Error updating user", {
      service: "UserController",
      userId: numericId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    return res.status(500).json({
      message: "Internal server error",
    });
  }
}

/**
 * PATCH /api/users/:id/status
 * Toggle user active status.
 * Body: { is_active: boolean }
 */
export async function toggleUserStatus(req: Request, res: Response) {
  const { id } = req.params;
  const numericId = Number(id);

  if (Number.isNaN(numericId)) {
    return res.status(400).json({ message: "Invalid user ID" });
  }

  try {
    // Self-edit protection
    if (req.user?.userId === numericId) {
      throw createForbiddenError("Cannot modify your own account");
    }

    const { is_active } = req.body;

    if (typeof is_active !== "boolean") {
      throw createValidationError("is_active must be a boolean", "is_active");
    }

    // Check if user exists
    const existingUser = await userService.getUserById(numericId);
    if (!existingUser) {
      throw createNotFoundError("User", numericId);
    }

    // Last admin protection: Check if deactivating an admin
    if (!is_active && existingUser.roles.name === "Admin") {
      const isLast = await userService.isLastActiveAdmin(numericId);
      if (isLast) {
        throw createForbiddenError("Cannot deactivate the last active administrator");
      }
    }

    const user = await userService.toggleUserStatus(numericId, is_active);

    logger.info("User status toggled", {
      service: "UserController",
      userId: user.id,
      is_active: user.is_active,
      updatedBy: req.user?.userId
    });

    return res.status(200).json({
      data: user,
    });
  } catch (error: any) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        message: error.message,
        errorCode: error.errorCode,
      });
    }

    logger.error("Error toggling user status", {
      service: "UserController",
      userId: numericId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    return res.status(500).json({
      message: "Internal server error",
    });
  }
}

/**
 * PATCH /api/users/:id/password
 * Change a user's password.
 * Only Admins can change Operator passwords (not other Admin passwords).
 * Body: { password: string }
 */
export async function changeUserPassword(req: Request, res: Response) {
  const { id } = req.params;
  const numericId = Number(id);

  if (Number.isNaN(numericId)) {
    return res.status(400).json({ message: "Invalid user ID" });
  }

  try {
    // Self-edit protection
    if (req.user?.userId === numericId) {
      throw createForbiddenError("Cannot change your own password through this endpoint");
    }

    const { password } = req.body;

    // Validate password
    if (!password || typeof password !== "string" || password.length < 8) {
      throw createValidationError("Password must be at least 8 characters", "password");
    }

    // Check if user exists
    const existingUser = await userService.getUserById(numericId);
    if (!existingUser) {
      throw createNotFoundError("User", numericId);
    }

    // Only allow changing Operator passwords, not Admin passwords
    if (existingUser.roles.name === "Admin") {
      throw createForbiddenError("Cannot change another administrator's password");
    }

    await userService.updateUserPassword(numericId, password);

    logger.info("User password changed", {
      service: "UserController",
      userId: numericId,
      changedBy: req.user?.userId
    });

    return res.status(200).json({
      message: "Password changed successfully",
    });
  } catch (error: any) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        message: error.message,
        errorCode: error.errorCode,
      });
    }

    logger.error("Error changing user password", {
      service: "UserController",
      userId: numericId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    return res.status(500).json({
      message: "Internal server error",
    });
  }
}
