import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { AppError, isAppError, ErrorCodes } from '../types/errors';
import logger from '../lib/logger';

/**
 * Global Error Handler Middleware
 *
 * Catches all errors thrown in the application and formats them consistently.
 * Handles:
 * - AppError (custom application errors)
 * - Prisma errors (database errors)
 * - JWT errors (authentication errors)
 * - Generic errors (unexpected errors)
 */
export function errorHandler(
  error: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Extract request ID for error tracking
  const requestId = (req as any).requestId || 'unknown';

  // Default error response
  let statusCode = 500;
  let errorCode: string = ErrorCodes.INTERNAL_ERROR;
  let message = 'An unexpected error occurred';
  let details: any = undefined;

  // Handle AppError (custom application errors)
  if (isAppError(error)) {
    statusCode = error.statusCode;
    errorCode = error.errorCode;
    message = error.message;

    // Log operational errors at appropriate level
    if (error.isOperational) {
      if (statusCode >= 500) {
        logger.error('Operational error', {
          requestId,
          errorCode,
          message: error.message,
          stack: error.stack,
          url: req.url,
          method: req.method,
        });
      } else {
        logger.warn('Client error', {
          requestId,
          errorCode,
          message: error.message,
          url: req.url,
          method: req.method,
        });
      }
    } else {
      // Non-operational errors are programming errors
      logger.error('Non-operational error', {
        requestId,
        errorCode,
        message: error.message,
        stack: error.stack,
        url: req.url,
        method: req.method,
      });
    }
  }
  // Handle Prisma errors (database errors)
  else if (error instanceof Prisma.PrismaClientKnownRequestError) {
    statusCode = 400;
    errorCode = ErrorCodes.DATABASE_ERROR;

    switch (error.code) {
      case 'P2002': // Unique constraint violation
        statusCode = 409;
        errorCode = ErrorCodes.DUPLICATE_ENTRY;
        message = 'A record with this value already exists';
        details = { field: error.meta?.target };
        break;

      case 'P2025': // Record not found
        statusCode = 404;
        errorCode = ErrorCodes.NOT_FOUND;
        message = 'The requested record was not found';
        break;

      case 'P2003': // Foreign key constraint violation
        statusCode = 400;
        errorCode = ErrorCodes.VALIDATION_ERROR;
        message = 'Referenced record does not exist';
        details = { field: error.meta?.field_name };
        break;

      case 'P2014': // Relation violation
        statusCode = 400;
        errorCode = ErrorCodes.VALIDATION_ERROR;
        message = 'Invalid relation between records';
        break;

      default:
        message = 'Database operation failed';
        details = { code: error.code };
    }

    logger.error('Prisma error', {
      requestId,
      prismaCode: error.code,
      errorCode,
      message: error.message,
      meta: error.meta,
      url: req.url,
      method: req.method,
    });
  }
  // Handle Prisma validation errors
  else if (error instanceof Prisma.PrismaClientValidationError) {
    statusCode = 400;
    errorCode = ErrorCodes.VALIDATION_ERROR;
    message = 'Invalid data provided';

    logger.error('Prisma validation error', {
      requestId,
      errorCode,
      message: error.message,
      url: req.url,
      method: req.method,
    });
  }
  // Handle JWT errors (authentication errors)
  else if (error.name === 'JsonWebTokenError') {
    statusCode = 401;
    errorCode = ErrorCodes.INVALID_TOKEN;
    message = 'Invalid authentication token';

    logger.warn('JWT error', {
      requestId,
      errorCode,
      message: error.message,
      url: req.url,
      method: req.method,
    });
  }
  else if (error.name === 'TokenExpiredError') {
    statusCode = 401;
    errorCode = ErrorCodes.TOKEN_EXPIRED;
    message = 'Authentication token has expired';

    logger.warn('JWT token expired', {
      requestId,
      errorCode,
      message: error.message,
      url: req.url,
      method: req.method,
    });
  }
  // Handle generic errors (unexpected errors)
  else {
    statusCode = 500;
    errorCode = ErrorCodes.UNEXPECTED_ERROR;
    message = process.env.NODE_ENV === 'production'
      ? 'An unexpected error occurred'
      : error.message;

    // Log full error details for unexpected errors
    logger.error('Unexpected error', {
      requestId,
      errorCode,
      message: error.message,
      stack: error.stack,
      name: error.name,
      url: req.url,
      method: req.method,
      body: req.body,
    });
  }

  // Send error response
  const errorResponse: any = {
    error: {
      code: errorCode,
      message,
      requestId,
    },
  };

  // Include details if available
  if (details) {
    errorResponse.error.details = details;
  }

  // Include stack trace in development
  if (process.env.NODE_ENV === 'development' && error.stack) {
    errorResponse.error.stack = error.stack;
  }

  res.status(statusCode).json(errorResponse);
}

/**
 * 404 Not Found Handler
 * Catches requests to undefined routes
 */
export function notFoundHandler(req: Request, res: Response, next: NextFunction): void {
  const requestId = (req as any).requestId || 'unknown';

  logger.warn('Route not found', {
    requestId,
    url: req.url,
    method: req.method,
  });

  res.status(404).json({
    error: {
      code: ErrorCodes.NOT_FOUND,
      message: `Route ${req.method} ${req.url} not found`,
      requestId,
    },
  });
}
