/**
 * Custom Application Error Class
 * Extends Error to include HTTP status codes and error codes for structured error handling
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly errorCode: string;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    statusCode: number = 500,
    errorCode: string = 'INTERNAL_ERROR',
    isOperational: boolean = true
  ) {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.isOperational = isOperational;

    // Maintains proper stack trace for where error was thrown (V8 only)
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Standard Error Codes
 * Consistent error codes for API responses
 */
export const ErrorCodes = {
  // Authentication & Authorization (401, 403)
  UNAUTHORIZED: 'UNAUTHORIZED',
  INVALID_TOKEN: 'INVALID_TOKEN',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  FORBIDDEN: 'FORBIDDEN',
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',

  // Resource Errors (404)
  NOT_FOUND: 'NOT_FOUND',
  WORKFLOW_NOT_FOUND: 'WORKFLOW_NOT_FOUND',
  EXECUTION_NOT_FOUND: 'EXECUTION_NOT_FOUND',
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  NODE_NOT_FOUND: 'NODE_NOT_FOUND',
  EDGE_NOT_FOUND: 'EDGE_NOT_FOUND',

  // Validation Errors (400)
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_INPUT: 'INVALID_INPUT',
  INVALID_NODE_TYPE: 'INVALID_NODE_TYPE',
  INVALID_WORKFLOW_STATE: 'INVALID_WORKFLOW_STATE',
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',

  // Business Logic Errors (400, 409)
  WORKFLOW_ALREADY_EXISTS: 'WORKFLOW_ALREADY_EXISTS',
  WORKFLOW_NOT_ACTIVE: 'WORKFLOW_NOT_ACTIVE',
  EXECUTION_ALREADY_RUNNING: 'EXECUTION_ALREADY_RUNNING',
  CIRCULAR_DEPENDENCY: 'CIRCULAR_DEPENDENCY',
  DUPLICATE_ENTRY: 'DUPLICATE_ENTRY',

  // External Service Errors (502, 503)
  N8N_ERROR: 'N8N_ERROR',
  N8N_UNAVAILABLE: 'N8N_UNAVAILABLE',
  DATABASE_ERROR: 'DATABASE_ERROR',
  CV_PARSER_ERROR: 'CV_PARSER_ERROR',

  // Internal Errors (500)
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  COMPILATION_ERROR: 'COMPILATION_ERROR',
  UNEXPECTED_ERROR: 'UNEXPECTED_ERROR',
} as const;

/**
 * Helper Functions for Common Error Types
 */

export function createNotFoundError(resource: string, id?: string | number): AppError {
  const message = id
    ? `${resource} with ID ${id} not found`
    : `${resource} not found`;

  const errorCode = `${resource.toUpperCase().replace(/\s+/g, '_')}_NOT_FOUND`;

  return new AppError(message, 404, errorCode);
}

export function createValidationError(message: string, field?: string): AppError {
  const errorMessage = field
    ? `Validation error for field '${field}': ${message}`
    : `Validation error: ${message}`;

  return new AppError(errorMessage, 400, ErrorCodes.VALIDATION_ERROR);
}

export function createUnauthorizedError(message: string = 'Authentication required'): AppError {
  return new AppError(message, 401, ErrorCodes.UNAUTHORIZED);
}

export function createForbiddenError(message: string = 'Access denied'): AppError {
  return new AppError(message, 403, ErrorCodes.FORBIDDEN);
}

export function createConflictError(message: string, errorCode: string = ErrorCodes.DUPLICATE_ENTRY): AppError {
  return new AppError(message, 409, errorCode);
}

export function createInternalError(message: string = 'Internal server error'): AppError {
  return new AppError(message, 500, ErrorCodes.INTERNAL_ERROR);
}

export function createN8nError(message: string, statusCode: number = 502): AppError {
  return new AppError(message, statusCode, ErrorCodes.N8N_ERROR);
}

export function createDatabaseError(message: string): AppError {
  return new AppError(message, 500, ErrorCodes.DATABASE_ERROR);
}

/**
 * Type guard to check if error is an AppError
 */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
