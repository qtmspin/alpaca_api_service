"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.createValidationError = createValidationError;
exports.createRateLimitError = createRateLimitError;
exports.createCooldownError = createCooldownError;
exports.createDuplicateOrderError = createDuplicateOrderError;
exports.createNotFoundError = createNotFoundError;
exports.createServerError = createServerError;
/**
 * Create a validation error
 * @param message - Error message
 * @param fields - Validation error fields
 * @returns ApiError instance
 */
function createValidationError(message, fields) {
    const error = new Error(message);
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
function createRateLimitError(message, retryAfter) {
    const error = new Error(message);
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
function createCooldownError(message, cooldownRemainingMs) {
    const error = new Error(message);
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
function createDuplicateOrderError(message, existingOrderId) {
    const error = new Error(message);
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
function createNotFoundError(message, code = 'NOT_FOUND') {
    const error = new Error(message);
    error.statusCode = 404;
    error.code = code;
    return error;
}
/**
 * Create a server error
 * @param message - Error message
 * @returns ApiError instance
 */
function createServerError(message) {
    const error = new Error(message);
    error.statusCode = 500;
    error.code = 'SERVER_ERROR';
    return error;
}
