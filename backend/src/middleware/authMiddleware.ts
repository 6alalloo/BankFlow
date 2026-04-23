import { Request, Response, NextFunction } from 'express';
import { verifyToken, JwtPayload } from '../services/authService';
import logger from '../lib/logger';

// Extend Express Request to include user info
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

/**
 * Authentication middleware
 * Verifies the JWT token from the Authorization header
 * Sets req.user with the decoded payload if valid
 */
export function authenticate(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({ error: 'Authorization header required' });
    }

    // Expect format: "Bearer <token>"
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return res.status(401).json({ error: 'Invalid authorization format. Use: Bearer <token>' });
    }

    const token = parts[1];

    try {
      const payload = verifyToken(token);
      req.user = payload;
      next();
    } catch (error) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
  } catch (error) {
    logger.error('Authentication middleware error', {
      service: 'authMiddleware',
      requestId: (req as any).requestId,
      path: req.path,
      method: req.method,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Optional authentication middleware
 * Same as authenticate but doesn't fail if no token is provided
 * Useful for routes that have different behavior for authenticated users
 */
export function optionalAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return next();
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return next();
    }

    const token = parts[1];

    try {
      const payload = verifyToken(token);
      req.user = payload;
    } catch {
      // Ignore invalid tokens in optional auth
    }

    next();
  } catch (error) {
    next();
  }
}

/**
 * Role-based authorization middleware
 * Must be used AFTER authenticate middleware
 * Checks if the user has one of the allowed roles
 */
export function authorize(...allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: `This action requires one of the following roles: ${allowedRoles.join(', ')}`
      });
    }

    next();
  };
}

/**
 * Admin-only authorization middleware
 * Shortcut for authorize('Admin')
 */
export function adminOnly(req: Request, res: Response, next: NextFunction) {
  return authorize('Admin')(req, res, next);
}
