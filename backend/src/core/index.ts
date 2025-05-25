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
export * from './schemas';

// Export configuration manager
export { ConfigManager } from './config-manager';

// Export artificial orders manager
export { ArtificialOrderManager, type ArtificialOrder } from './artificial-orders';

// Export market hours constants
export { MARKET_HOURS } from './schemas';

// Export error types and utilities
export * from './errors';
