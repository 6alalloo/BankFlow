import { Request, Response, NextFunction } from 'express';
import { login, getUserById, verifyToken } from '../services/authService';
import * as auditService from '../services/auditService';
import { isRateLimited, getRemainingAttempts, getTimeUntilReset, resetRateLimit } from '../middleware/rateLimiter';
import logger from '../lib/logger';
import {
  createNotFoundError,
  createValidationError,
  createUnauthorizedError,
  ErrorCodes,
  AppError,
} from '../types/errors';

/**
 * POST /api/auth/login
 * Body: { email: string, password: string }
 * Response: { user: AuthUser, token: string }
 * Rate limited: 5 attempts per minute per IP/email
 */
export async function loginHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, password } = req.body;
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';

    if (!email || !password) {
      throw createValidationError('Email and password are required');
    }

    // Check rate limit
    if (isRateLimited(clientIp, email)) {
      const retryAfter = getTimeUntilReset(clientIp, email);
      const error = new AppError(
        `Rate limit exceeded. Try again in ${retryAfter} seconds.`,
        429,
        ErrorCodes.UNAUTHORIZED
      );
      (error as any).retryAfter = retryAfter;
      throw error;
    }

    const result = await login(email, password);
    if (!result) {
      const remaining = getRemainingAttempts(clientIp, email);
      const error = createUnauthorizedError('Invalid email or password');
      (error as any).remainingAttempts = remaining;
      throw error;
    }

    // Reset rate limit on successful login
    resetRateLimit(clientIp, email);

    // Audit log successful login
    await auditService.logAuditEvent({
      eventType: 'login',
      userId: result.user.id,
      targetType: 'user',
      targetId: result.user.id,
      details: { email: result.user.email },
      ipAddress: clientIp,
      userAgent: req.get('user-agent'),
    });

    return res.json({
      message: 'Login successful',
      user: result.user,
      token: result.token
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/auth/me
 * Requires authentication
 * Response: { user: AuthUser }
 */
export async function getCurrentUser(req: Request, res: Response, next: NextFunction) {
  try {
    // The user is set by the auth middleware
    const userId = (req as any).user?.userId;

    if (!userId) {
      throw createUnauthorizedError('Not authenticated');
    }

    const user = await getUserById(userId);
    if (!user) {
      throw createNotFoundError('User', userId);
    }

    return res.json({ user });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/auth/verify
 * Body: { token: string }
 * Response: { valid: boolean, payload?: JwtPayload }
 */
export async function verifyTokenHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { token } = req.body;

    if (!token) {
      throw createValidationError('Token is required');
    }

    try {
      const payload = verifyToken(token);
      return res.json({ valid: true, payload });
    } catch {
      return res.json({ valid: false });
    }
  } catch (error) {
    next(error);
  }
}
