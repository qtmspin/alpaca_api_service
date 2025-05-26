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

import { AppError, ValidationError } from './schemas';

/**
 * Base application error class
 */
export class ApplicationError extends Error implements AppError {
  public readonly code: string;
  public readonly details?: any;
  public readonly timestamp: string;

  constructor(code: string, message: string, details?: any) {
    super(message);
    this.name = 'ApplicationError';
    this.code = code;
    this.details = details;
    this.timestamp = new Date().toISOString();
    
    // Ensure proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, ApplicationError.prototype);
  }

  toJSON(): AppError {
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
  constructor(message: string, details?: any) {
    super('CONFIG_ERROR', message, details);
    this.name = 'ConfigurationError';
    Object.setPrototypeOf(this, ConfigurationError.prototype);
  }
}

/**
 * Alpaca API error class
 */
export class AlpacaAPIError extends ApplicationError {
  public readonly statusCode?: number;
  public readonly alpacaCode?: string;

  constructor(message: string, statusCode?: number, alpacaCode?: string, details?: any) {
    super('ALPACA_API_ERROR', message, details);
    this.name = 'AlpacaAPIError';
    this.statusCode = statusCode;
    this.alpacaCode = alpacaCode;
    Object.setPrototypeOf(this, AlpacaAPIError.prototype);
  }

  toJSON(): AppError & { statusCode?: number; alpacaCode?: string } {
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
export class AppValidationError extends ApplicationError implements ValidationError {
  public readonly field: string;
  public readonly value: any;

  constructor(field: string, message: string, value: any, details?: any) {
    super('VALIDATION_ERROR', message, details);
    this.name = 'ValidationError';
    this.field = field;
    this.value = value;
    Object.setPrototypeOf(this, AppValidationError.prototype);
  }

  toJSON(): ValidationError {
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
  public readonly orderId?: string;

  constructor(message: string, orderId?: string, details?: any) {
    super('ORDER_ERROR', message, details);
    this.name = 'OrderError';
    this.orderId = orderId;
    Object.setPrototypeOf(this, OrderError.prototype);
  }

  toJSON(): AppError & { orderId?: string } {
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
  public readonly connectionId?: string;

  constructor(message: string, connectionId?: string, details?: any) {
    super('WEBSOCKET_ERROR', message, details);
    this.name = 'WebSocketError';
    this.connectionId = connectionId;
    Object.setPrototypeOf(this, WebSocketError.prototype);
  }

  toJSON(): AppError & { connectionId?: string } {
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
  constructor(message: string, details?: any) {
    super('AUTH_ERROR', message, details);
    this.name = 'AuthenticationError';
    Object.setPrototypeOf(this, AuthenticationError.prototype);
  }
}

/**
 * Rate limiting error class
 */
export class RateLimitError extends ApplicationError {
  public readonly retryAfter?: number;

  constructor(message: string, retryAfter?: number, details?: any) {
    super('RATE_LIMIT_ERROR', message, details);
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
    Object.setPrototypeOf(this, RateLimitError.prototype);
  }

  toJSON(): AppError & { retryAfter?: number } {
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
  public readonly symbol?: string;

  constructor(message: string, symbol?: string, details?: any) {
    super('MARKET_DATA_ERROR', message, details);
    this.name = 'MarketDataError';
    this.symbol = symbol;
    Object.setPrototypeOf(this, MarketDataError.prototype);
  }

  toJSON(): AppError & { symbol?: string } {
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
  static isApplicationError(error: any): error is ApplicationError {
    return error instanceof ApplicationError;
  }

  /**
   * Convert any error to application error
   */
  static toApplicationError(error: any): ApplicationError {
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
  static formatForResponse(error: any): AppError {
    const appError = ErrorHandler.toApplicationError(error);
    return appError.toJSON();
  }

  /**
   * Log error with appropriate level
   */
  static logError(error: any, context?: string): void {
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
  static shouldRetry(error: any): boolean {
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
  static getRetryDelay(error: any, attempt: number = 1): number {
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
export enum ErrorCodes {
  // Configuration errors
  CONFIG_ERROR = 'CONFIG_ERROR',
  CONFIG_NOT_FOUND = 'CONFIG_NOT_FOUND',
  CONFIG_VALIDATION_FAILED = 'CONFIG_VALIDATION_FAILED',

  // API errors
  ALPACA_API_ERROR = 'ALPACA_API_ERROR',
  API_CONNECTION_ERROR = 'API_CONNECTION_ERROR',
  API_TIMEOUT = 'API_TIMEOUT',

  // Validation errors
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_SYMBOL = 'INVALID_SYMBOL',
  INVALID_ORDER_DATA = 'INVALID_ORDER_DATA',

  // Order errors
  ORDER_ERROR = 'ORDER_ERROR',
  ORDER_NOT_FOUND = 'ORDER_NOT_FOUND',
  ORDER_ALREADY_FILLED = 'ORDER_ALREADY_FILLED',
  ORDER_CANCELLED = 'ORDER_CANCELLED',

  // Authentication errors
  AUTH_ERROR = 'AUTH_ERROR',
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',

  // Rate limiting
  RATE_LIMIT_ERROR = 'RATE_LIMIT_ERROR',

  // Market data errors
  MARKET_DATA_ERROR = 'MARKET_DATA_ERROR',
  MARKET_CLOSED = 'MARKET_CLOSED',
  INVALID_MARKET_DATA = 'INVALID_MARKET_DATA',

  // WebSocket errors
  WEBSOCKET_ERROR = 'WEBSOCKET_ERROR',
  CONNECTION_LOST = 'CONNECTION_LOST',
  SUBSCRIPTION_FAILED = 'SUBSCRIPTION_FAILED',

  // General errors
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  NOT_IMPLEMENTED = 'NOT_IMPLEMENTED'
}

/**
 * Create a server error
 * @param message Error message
 * @param details Optional error details
 * @returns ApplicationError instance
 */
export function createServerError(message: string, details?: any): ApplicationError {
  return new ApplicationError('INTERNAL_ERROR', message, details);
}

// Export all error types
export {
  AppError,
  ValidationError
} from './schemas';