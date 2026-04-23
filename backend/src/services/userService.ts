import prisma from "../lib/prisma";
import { hashPassword } from "./authService";


type UserFilters = {
  isActive?: boolean;
  roleName?: string;
  query?: string; // for "q" search
};

/**
 * Get all users with optional filters:
 * - isActive: filter by is_active (true/false)
 * - roleName: filter by role name (e.g., "Admin")
 * - query: text search on email OR full_name
 */
export async function getAllUsers(filters: UserFilters = {}) {
  const { isActive, roleName, query } = filters;

  // We'll collect conditions here and then AND them together.
  const whereClauses: any[] = [];

  if (typeof isActive === "boolean") {
    whereClauses.push({ is_active: isActive });
  }

  if (roleName) {
    whereClauses.push({
      roles: {
        is: {
          name: roleName,
        },
      },
    });
  }

  if (query && query.trim().length > 0) {
    const q = query.trim();

    // OR condition: match email OR full_name, case-insensitive.
    whereClauses.push({
      OR: [
        {
          email: {
            contains: q,
            mode: "insensitive",
          },
        },
        {
          full_name: {
            contains: q,
            mode: "insensitive",
          },
        },
      ],
    });
  }

  // If we have any conditions, wrap them in AND; otherwise, use an empty object.
  const where = whereClauses.length > 0 ? { AND: whereClauses } : {};

  const users = await prisma.users.findMany({
    where,
    select: {
      id: true,
      email: true,
      full_name: true,
      is_active: true,
      created_at: true,
      roles: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: {
      created_at: "desc",
    },
  });

  return users;
}

/**
 * Get a single user by ID with their role.
 */
export async function getUserById(id: number) {
  const user = await prisma.users.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      full_name: true,
      is_active: true,
      created_at: true,
      roles: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  return user;
}

export interface CreateUserInput {
  email: string;
  password: string;
  full_name: string;
  role_id: number;
  is_active?: boolean;
}

/**
 * Create a new user with hashed password
 */
export async function createUser(input: CreateUserInput) {
  const password_hash = await hashPassword(input.password);

  const user = await prisma.users.create({
    data: {
      email: input.email,
      password_hash,
      full_name: input.full_name,
      role_id: input.role_id,
      is_active: input.is_active ?? true
    },
    select: {
      id: true,
      email: true,
      full_name: true,
      is_active: true,
      created_at: true,
      roles: {
        select: {
          id: true,
          name: true
        }
      }
    }
  });

  return user;
}

/**
 * Update a user's password (with hashing)
 */
export async function updateUserPassword(userId: number, newPassword: string) {
  const password_hash = await hashPassword(newPassword);

  const user = await prisma.users.update({
    where: { id: userId },
    data: { password_hash },
    select: {
      id: true,
      email: true,
      full_name: true
    }
  });

  return user;
}

/**
 * Check if an email already exists
 */
export async function emailExists(email: string): Promise<boolean> {
  const user = await prisma.users.findUnique({
    where: { email },
    select: { id: true }
  });
  return user !== null;
}

/**
 * Check if an email already exists, excluding a specific user ID
 * Useful for update validation to allow user to keep their current email
 */
export async function emailExistsExcluding(email: string, excludeUserId: number): Promise<boolean> {
  const user = await prisma.users.findFirst({
    where: {
      email,
      id: { not: excludeUserId }
    },
    select: { id: true }
  });
  return user !== null;
}

export interface UpdateUserInput {
  email?: string;
  full_name?: string;
  role_id?: number;
}

/**
 * Update a user's details (email, full_name, role_id)
 * Does not update password - use updateUserPassword for that
 */
export async function updateUser(id: number, input: UpdateUserInput) {
  const user = await prisma.users.update({
    where: { id },
    data: {
      ...(input.email && { email: input.email }),
      ...(input.full_name && { full_name: input.full_name }),
      ...(input.role_id && { role_id: input.role_id }),
    },
    select: {
      id: true,
      email: true,
      full_name: true,
      is_active: true,
      created_at: true,
      roles: {
        select: {
          id: true,
          name: true
        }
      }
    }
  });

  return user;
}

/**
 * Toggle a user's active status
 */
export async function toggleUserStatus(id: number, isActive: boolean) {
  const user = await prisma.users.update({
    where: { id },
    data: { is_active: isActive },
    select: {
      id: true,
      email: true,
      full_name: true,
      is_active: true,
      created_at: true,
      roles: {
        select: {
          id: true,
          name: true
        }
      }
    }
  });

  return user;
}

/**
 * Count the number of active admin users in the system
 */
export async function countActiveAdmins(): Promise<number> {
  return prisma.users.count({
    where: {
      is_active: true,
      roles: { name: 'Admin' }
    }
  });
}

/**
 * Check if a user is the last active admin in the system
 * Returns true if the user is the sole active admin
 */
export async function isLastActiveAdmin(userId: number): Promise<boolean> {
  const user = await getUserById(userId);

  // If user doesn't exist or isn't an active admin, they can't be the "last" admin
  if (!user || user.roles.name !== 'Admin' || !user.is_active) {
    return false;
  }

  const count = await countActiveAdmins();
  return count === 1;
}

/**
 * Check if a role exists
 */
export async function roleExists(roleId: number): Promise<boolean> {
  const role = await prisma.roles.findUnique({
    where: { id: roleId },
    select: { id: true }
  });
  return role !== null;
}

/**
 * Get the Admin role ID
 */
export async function getAdminRoleId(): Promise<number | null> {
  const role = await prisma.roles.findUnique({
    where: { name: 'Admin' },
    select: { id: true }
  });
  return role?.id ?? null;
}