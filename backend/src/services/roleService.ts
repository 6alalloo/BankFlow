import prisma from "../lib/prisma";

/**
 * Get all roles.
 * Sorted by created_at descending so newest roles appear first.
 */
export async function getAllRoles() {
  const roles = await prisma.roles.findMany({
    orderBy: {
      created_at: "desc",
    },
    select: {
      id: true,
      name: true,
      created_at: true,
    },
  });

  return roles;
}

/**
 * Get a single role by ID.
 */
export async function getRoleById(id: number) {
  const role = await prisma.roles.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      created_at: true,
    },
  });

  return role;
}