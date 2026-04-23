/**
 * Request ID Middleware
 *
 * Generates or uses existing request ID for tracking requests across logs.
 * The request ID is:
 * - Generated as a UUID if not provided by client
 * - Attached to req.requestId for use in handlers
 * - Returned in response header X-Request-ID
 */

import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

declare global {
  namespace Express {
    interface Request {
      requestId?: string;
    }
  }
}

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction) {
  // Use client-provided request ID if available, otherwise generate one
  req.requestId = (req.headers['x-request-id'] as string) || crypto.randomUUID();

  // Return request ID in response header for client tracking
  res.setHeader('X-Request-ID', req.requestId);

  next();
}
