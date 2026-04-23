import { Request, Response } from "express";
import * as roleService from "../services/roleService";
import logger from "../lib/logger";

/**
 * GET /api/roles
 * Returns all roles.
 */
export async function getAllRoles(req: Request, res: Response) {
  try {
    const roles = await roleService.getAllRoles();
    return res.status(200).json({
      data: roles,
    });
  } catch (error) {
    logger.error("Error getting all roles", {
      service: "RoleController",
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    return res.status(500).json({
      message: "Internal server error",
    });
  }
}

/**
 * GET /api/roles/:id
 * Returns a single role by ID.
 */
export async function getRoleById(req: Request, res: Response) {
  const { id } = req.params;

  const numericId = Number(id);
  if (Number.isNaN(numericId)) {
    return res.status(400).json({
      message: "Invalid role ID",
    });
  }

  try {
    const role = await roleService.getRoleById(numericId);

    if (!role) {
      return res.status(404).json({
        message: "Role not found",
      });
    }

    return res.status(200).json({
      data: role,
    });
  } catch (error) {
    logger.error("Error getting role by id", {
      service: "RoleController",
      roleId: numericId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    return res.status(500).json({
      message: "Internal server error",
    });
  }
}