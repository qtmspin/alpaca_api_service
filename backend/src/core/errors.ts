/**
 * errors.ts
 * 
 * This file contains custom error types for the Alpaca API Service.
 * Location: backend/src/core/errors.ts
 * 
 * Responsibilities:
 * - Define custom error types with additional properties
 * - Provide error factory functions
 */

/**
 * ApiError interface
 * 
 * Extends the standard Error with additional properties for API responses.
 */
export interface ApiError extends Error {
  statusCode: number;
  code: string;
  fields?: Record<string, string>;
  retryAfter?: number;
  cooldownRemainingMs?: number;
  existingOrderId?: string;
}

/**
 * Create a validation error
 * @param message - Error message
 * @param fields - Validation error fields
 * @returns ApiError instance
 */
export function createValidationError(message: string, fields: Record<string, string>): ApiError {
  const error = new Error(message) as ApiError;
  error.statusCode = 400;
  error.code = 'VALIDATION_ERROR';
  error.fields = fields;
  return error;
}

/**
 * Create a rate limit error
 * @param message - Error message
 * @param retryAfter - Seconds until retry is allowed
 * @returns ApiError instance
 */
export function createRateLimitError(message: string, retryAfter: number): ApiError {
  const error = new Error(message) as ApiError;
  error.statusCode = 429;
  error.code = 'RATE_LIMIT_EXCEEDED';
  error.retryAfter = retryAfter;
  return error;
}

/**
 * Create a cooldown error
 * @param message - Error message
 * @param cooldownRemainingMs - Milliseconds until cooldown expires
 * @returns ApiError instance
 */
export function createCooldownError(message: string, cooldownRemainingMs: number): ApiError {
  const error = new Error(message) as ApiError;
  error.statusCode = 429;
  error.code = 'COOLDOWN_ACTIVE';
  error.cooldownRemainingMs = cooldownRemainingMs;
  return error;
}

/**
 * Create a duplicate order error
 * @param message - Error message
 * @param existingOrderId - ID of the existing duplicate order
 * @returns ApiError instance
 */
export function createDuplicateOrderError(message: string, existingOrderId: string): ApiError {
  const error = new Error(message) as ApiError;
  error.statusCode = 400;
  error.code = 'DUPLICATE_ORDER';
  error.existingOrderId = existingOrderId;
  return error;
}

/**
 * Create a not found error
 * @param message - Error message
 * @param code - Error code
 * @returns ApiError instance
 */
export function createNotFoundError(message: string, code: string = 'NOT_FOUND'): ApiError {
  const error = new Error(message) as ApiError;
  error.statusCode = 404;
  error.code = code;
  return error;
}

/**
 * Create a server error
 * @param message - Error message
 * @returns ApiError instance
 */
export function createServerError(message: string): ApiError {
  const error = new Error(message) as ApiError;
  error.statusCode = 500;
  error.code = 'SERVER_ERROR';
  return error;
}
