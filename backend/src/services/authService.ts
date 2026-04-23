import bcrypt from 'bcryptjs';
import jwt, { SignOptions } from 'jsonwebtoken';
import prisma from '../lib/prisma';
import { config } from '../config/appConfig';

export interface JwtPayload {
  userId: number;
  email: string;
  role: string;
}

export interface AuthUser {
  id: number;
  email: string;
  full_name: string;
  role: {
    id: number;
    name: string;
  };
}

/**
 * Hash a plain-text password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  const saltRounds = 10;
  return bcrypt.hash(password, saltRounds);
}

/**
 * Compare a plain-text password with a hashed password
 */
export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Generate a JWT token for a user
 */
export function generateToken(user: AuthUser): string {
  const payload: JwtPayload = {
    userId: user.id,
    email: user.email,
    role: user.role.name
  };

  // Use config value, TypeScript will infer the correct type
  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn
  } as jwt.SignOptions);
}

/**
 * Verify and decode a JWT token
 */
export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, config.jwt.secret) as JwtPayload;
}

/**
 * Authenticate a user by email and password
 * Returns the user object if credentials are valid, null otherwise
 */
export async function authenticateUser(email: string, password: string): Promise<AuthUser | null> {
  const user = await prisma.users.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      full_name: true,
      password_hash: true,
      is_active: true,
      roles: {
        select: {
          id: true,
          name: true
        }
      }
    }
  });

  if (!user) {
    return null;
  }

  if (!user.is_active) {
    return null;
  }

  const isPasswordValid = await comparePassword(password, user.password_hash);
  if (!isPasswordValid) {
    return null;
  }

  return {
    id: user.id,
    email: user.email,
    full_name: user.full_name,
    role: user.roles
  };
}

/**
 * Login a user and return a JWT token
 */
export async function login(email: string, password: string): Promise<{ user: AuthUser; token: string } | null> {
  const user = await authenticateUser(email, password);
  if (!user) {
    return null;
  }

  const token = generateToken(user);
  return { user, token };
}

/**
 * Get user by ID (for token refresh or profile)
 */
export async function getUserById(userId: number): Promise<AuthUser | null> {
  const user = await prisma.users.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      full_name: true,
      is_active: true,
      roles: {
        select: {
          id: true,
          name: true
        }
      }
    }
  });

  if (!user || !user.is_active) {
    return null;
  }

  return {
    id: user.id,
    email: user.email,
    full_name: user.full_name,
    role: user.roles
  };
}
