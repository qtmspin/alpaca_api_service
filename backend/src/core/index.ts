/**
 * index.ts
 * 
 * This file exports all core components from the core directory.
 * Location: backend/src/core/index.ts
 * 
 * Responsibilities:
 * - Provide a single import point for core components
 * - Export schemas, types, and utility functions
 */

// Export schemas and types
export * from './schemas.js';

// Export configuration manager
export { ConfigManager } from './config-manager.js';

// Export artificial orders manager
export { ArtificialOrderManager, type ArtificialOrder } from './artificial-orders.js';

// Export market hours constants
export { MARKET_HOURS } from './schemas.js';

// Export error types and utilities
// Export specific error types to avoid ambiguity with schemas.js exports
export { 
  createServerError,
  ErrorCodes,
  ApplicationError,
  RateLimitError,
  OrderError,
  ConfigurationError,
  AlpacaAPIError,
  WebSocketError,
  AuthenticationError,
  MarketDataError,
  ErrorHandler
} from './errors.js';
