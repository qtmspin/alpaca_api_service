/**
 * errors.ts
 *
 * This file contains error types and utilities for the application.
 * Location: backend/src/core/errors.ts
 *
 * Responsibilities:
 * - Define custom error classes
 * - Provide error handling utilities
 * - Export error types for consistent error handling
 */
/**
 * Base application error class
 */
export class ApplicationError extends Error {
    constructor(code, message, details) {
        super(message);
        this.name = 'ApplicationError';
        this.code = code;
        this.details = details;
        this.timestamp = new Date().toISOString();
        // Ensure proper prototype chain for instanceof checks
        Object.setPrototypeOf(this, ApplicationError.prototype);
    }
    toJSON() {
        return {
            code: this.code,
            message: this.message,
            details: this.details,
            timestamp: this.timestamp
        };
    }
}
/**
 * Configuration error class
 */
export class ConfigurationError extends ApplicationError {
    constructor(message, details) {
        super('CONFIG_ERROR', message, details);
        this.name = 'ConfigurationError';
        Object.setPrototypeOf(this, ConfigurationError.prototype);
    }
}
/**
 * Alpaca API error class
 */
export class AlpacaAPIError extends ApplicationError {
    constructor(message, statusCode, alpacaCode, details) {
        super('ALPACA_API_ERROR', message, details);
        this.name = 'AlpacaAPIError';
        this.statusCode = statusCode;
        this.alpacaCode = alpacaCode;
        Object.setPrototypeOf(this, AlpacaAPIError.prototype);
    }
    toJSON() {
        return {
            ...super.toJSON(),
            statusCode: this.statusCode,
            alpacaCode: this.alpacaCode
        };
    }
}
/**
 * Validation error class
 */
export class AppValidationError extends ApplicationError {
    constructor(field, message, value, details) {
        super('VALIDATION_ERROR', message, details);
        this.name = 'ValidationError';
        this.field = field;
        this.value = value;
        Object.setPrototypeOf(this, AppValidationError.prototype);
    }
    toJSON() {
        return {
            ...super.toJSON(),
            field: this.field,
            value: this.value
        };
    }
}
/**
 * Order management error class
 */
export class OrderError extends ApplicationError {
    constructor(message, orderId, details) {
        super('ORDER_ERROR', message, details);
        this.name = 'OrderError';
        this.orderId = orderId;
        Object.setPrototypeOf(this, OrderError.prototype);
    }
    toJSON() {
        return {
            ...super.toJSON(),
            orderId: this.orderId
        };
    }
}
/**
 * WebSocket error class
 */
export class WebSocketError extends ApplicationError {
    constructor(message, connectionId, details) {
        super('WEBSOCKET_ERROR', message, details);
        this.name = 'WebSocketError';
        this.connectionId = connectionId;
        Object.setPrototypeOf(this, WebSocketError.prototype);
    }
    toJSON() {
        return {
            ...super.toJSON(),
            connectionId: this.connectionId
        };
    }
}
/**
 * Authentication error class
 */
export class AuthenticationError extends ApplicationError {
    constructor(message, details) {
        super('AUTH_ERROR', message, details);
        this.name = 'AuthenticationError';
        Object.setPrototypeOf(this, AuthenticationError.prototype);
    }
}
/**
 * Rate limiting error class
 */
export class RateLimitError extends ApplicationError {
    constructor(message, retryAfter, details) {
        super('RATE_LIMIT_ERROR', message, details);
        this.name = 'RateLimitError';
        this.retryAfter = retryAfter;
        Object.setPrototypeOf(this, RateLimitError.prototype);
    }
    toJSON() {
        return {
            ...super.toJSON(),
            retryAfter: this.retryAfter
        };
    }
}
/**
 * Market data error class
 */
export class MarketDataError extends ApplicationError {
    constructor(message, symbol, details) {
        super('MARKET_DATA_ERROR', message, details);
        this.name = 'MarketDataError';
        this.symbol = symbol;
        Object.setPrototypeOf(this, MarketDataError.prototype);
    }
    toJSON() {
        return {
            ...super.toJSON(),
            symbol: this.symbol
        };
    }
}
/**
 * Error handler utility functions
 */
export class ErrorHandler {
    /**
     * Check if error is an application error
     */
    static isApplicationError(error) {
        return error instanceof ApplicationError;
    }
    /**
     * Convert any error to application error
     */
    static toApplicationError(error) {
        if (ErrorHandler.isApplicationError(error)) {
            return error;
        }
        if (error instanceof Error) {
            return new ApplicationError('UNKNOWN_ERROR', error.message, {
                originalError: error.name,
                stack: error.stack
            });
        }
        return new ApplicationError('UNKNOWN_ERROR', String(error));
    }
    /**
     * Format error for API response
     */
    static formatForResponse(error) {
        const appError = ErrorHandler.toApplicationError(error);
        return appError.toJSON();
    }
    /**
     * Log error with appropriate level
     */
    static logError(error, context) {
        const appError = ErrorHandler.toApplicationError(error);
        const logContext = context ? `[${context}] ` : '';
        console.error(`${logContext}${appError.code}: ${appError.message}`, {
            details: appError.details,
            timestamp: appError.timestamp
        });
    }
    /**
     * Check if error should be retried
     */
    static shouldRetry(error) {
        if (error instanceof RateLimitError) {
            return true;
        }
        if (error instanceof AlpacaAPIError) {
            // Retry on server errors but not client errors
            return error.statusCode ? error.statusCode >= 500 : false;
        }
        return false;
    }
    /**
     * Get retry delay for error
     */
    static getRetryDelay(error, attempt = 1) {
        if (error instanceof RateLimitError && error.retryAfter) {
            return error.retryAfter * 1000; // Convert to milliseconds
        }
        // Exponential backoff: 1s, 2s, 4s, 8s, etc.
        return Math.min(1000 * Math.pow(2, attempt - 1), 30000);
    }
}
/**
 * Error codes enum for consistency
 */
export var ErrorCodes;
(function (ErrorCodes) {
    // Configuration errors
    ErrorCodes["CONFIG_ERROR"] = "CONFIG_ERROR";
    ErrorCodes["CONFIG_NOT_FOUND"] = "CONFIG_NOT_FOUND";
    ErrorCodes["CONFIG_VALIDATION_FAILED"] = "CONFIG_VALIDATION_FAILED";
    // API errors
    ErrorCodes["ALPACA_API_ERROR"] = "ALPACA_API_ERROR";
    ErrorCodes["API_CONNECTION_ERROR"] = "API_CONNECTION_ERROR";
    ErrorCodes["API_TIMEOUT"] = "API_TIMEOUT";
    // Validation errors
    ErrorCodes["VALIDATION_ERROR"] = "VALIDATION_ERROR";
    ErrorCodes["INVALID_SYMBOL"] = "INVALID_SYMBOL";
    ErrorCodes["INVALID_ORDER_DATA"] = "INVALID_ORDER_DATA";
    // Order errors
    ErrorCodes["ORDER_ERROR"] = "ORDER_ERROR";
    ErrorCodes["ORDER_NOT_FOUND"] = "ORDER_NOT_FOUND";
    ErrorCodes["ORDER_ALREADY_FILLED"] = "ORDER_ALREADY_FILLED";
    ErrorCodes["ORDER_CANCELLED"] = "ORDER_CANCELLED";
    // Authentication errors
    ErrorCodes["AUTH_ERROR"] = "AUTH_ERROR";
    ErrorCodes["INVALID_CREDENTIALS"] = "INVALID_CREDENTIALS";
    ErrorCodes["TOKEN_EXPIRED"] = "TOKEN_EXPIRED";
    // Rate limiting
    ErrorCodes["RATE_LIMIT_ERROR"] = "RATE_LIMIT_ERROR";
    // Market data errors
    ErrorCodes["MARKET_DATA_ERROR"] = "MARKET_DATA_ERROR";
    ErrorCodes["MARKET_CLOSED"] = "MARKET_CLOSED";
    ErrorCodes["INVALID_MARKET_DATA"] = "INVALID_MARKET_DATA";
    // WebSocket errors
    ErrorCodes["WEBSOCKET_ERROR"] = "WEBSOCKET_ERROR";
    ErrorCodes["CONNECTION_LOST"] = "CONNECTION_LOST";
    ErrorCodes["SUBSCRIPTION_FAILED"] = "SUBSCRIPTION_FAILED";
    // General errors
    ErrorCodes["UNKNOWN_ERROR"] = "UNKNOWN_ERROR";
    ErrorCodes["INTERNAL_ERROR"] = "INTERNAL_ERROR";
    ErrorCodes["NOT_IMPLEMENTED"] = "NOT_IMPLEMENTED";
})(ErrorCodes || (ErrorCodes = {}));
/**
 * Create a server error
 * @param message Error message
 * @param details Optional error details
 * @returns ApplicationError instance
 */
export function createServerError(message, details) {
    return new ApplicationError('INTERNAL_ERROR', message, details);
}
