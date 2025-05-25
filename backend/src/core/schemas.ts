/**
 * schemas.ts
 * 
 * This file contains Zod schemas for validating API requests and responses.
 * It provides type safety and runtime validation for the Alpaca API Service.
 * Location: backend/src/core/schemas.ts
 * 
 * Responsibilities:
 * - Define validation schemas for configuration
 * - Define validation schemas for API requests/responses
 * - Provide helper functions for market hours
 * - Export TypeScript types derived from schemas
 */

import { z } from 'zod';

// Market hours constants
export const MARKET_HOURS = {
  PRE_MARKET: {
    START: '04:30:00', // 4:30 AM Eastern
    END: '09:30:00',   // 9:30 AM Eastern
  },
  REGULAR_MARKET: {
    START: '09:30:00', // 9:30 AM Eastern
    END: '16:00:00',   // 4:00 PM Eastern
  },
  POST_MARKET: {
    START: '16:00:00', // 4:00 PM Eastern
    END: '20:00:00',   // 8:00 PM Eastern
  },
};

// Alpaca API settings schema
const AlpacaSchema = z.object({
  apiKey: z.string().min(1, 'API key is required'),
  apiSecret: z.string().min(1, 'API secret is required'),
  paperTrading: z.boolean().default(true),
});

// Rate limiting settings schema
const RateLimitsSchema = z.object({
  orders: z.number().int().min(1).max(500).default(200),
  data: z.number().int().min(1).max(500).default(200),
  burst: z.number().int().min(1).max(50).default(10),
});

// Order management settings schema
const OrderRulesSchema = z.object({
  cooldownMs: z.number().int().min(100).default(1000),
  duplicateWindowMs: z.number().int().min(1000).default(5000),
  maxPerSymbol: z.number().int().min(1).default(5),
  maxTotal: z.number().int().min(1).default(50),
});

// Market hours settings schema
const MarketHoursSchema = z.object({
  enablePreMarket: z.boolean().default(true),
  enableAfterHours: z.boolean().default(true),
});

// Monitoring settings schema
const MonitoringSchema = z.object({
  priceCheckIntervalMs: z.number().int().min(50).default(100),
  websocketHeartbeatMs: z.number().int().min(1000).default(30000),
});

// Runtime settings schema (can be changed without restart)
const RuntimeConfigSchema = z.object({
  alpaca: AlpacaSchema,
  rateLimits: RateLimitsSchema,
  orderRules: OrderRulesSchema,
  marketHours: MarketHoursSchema,
  monitoring: MonitoringSchema,
});

// Startup settings schema (require restart)
const StartupConfigSchema = z.object({
  apiPort: z.number().int().min(1024).max(65535).default(9000),
  monitorPort: z.number().int().min(1024).max(65535).default(5900),
});

// Complete service configuration schema
export const ServiceConfigSchema = z.object({
  runtime: RuntimeConfigSchema,
  startup: StartupConfigSchema,
});

// Schema for config updates (only runtime settings can be updated via API)
export const ConfigUpdateSchema = z.object({
  runtime: RuntimeConfigSchema.partial(),
}).partial();

// Order types
export const OrderTypeEnum = z.enum([
  'market',
  'limit',
  'stop',
  'stop_limit',
]);

// Order side
export const OrderSideEnum = z.enum(['buy', 'sell']);

// Time in force options
export const TimeInForceEnum = z.enum([
  'day',
  'gtc',  // Good till canceled
  'opg',  // Market on open
  'cls',  // Market on close
  'ioc',  // Immediate or cancel
  'fok',  // Fill or kill
]);

// Base order request schema
const BaseOrderRequestSchema = z.object({
  symbol: z.string().min(1).toUpperCase(),
  qty: z.number().positive(),
  side: OrderSideEnum,
  timeInForce: TimeInForceEnum.default('day'),
  clientOrderId: z.string().optional(),
});

// Market order schema
export const MarketOrderSchema = BaseOrderRequestSchema.extend({
  orderType: z.literal('market'),
});

// Limit order schema
export const LimitOrderSchema = BaseOrderRequestSchema.extend({
  orderType: z.literal('limit'),
  limitPrice: z.number().positive(),
});

// Stop order schema
export const StopOrderSchema = BaseOrderRequestSchema.extend({
  orderType: z.literal('stop'),
  stopPrice: z.number().positive(),
});

// Stop limit order schema
export const StopLimitOrderSchema = BaseOrderRequestSchema.extend({
  orderType: z.literal('stop_limit'),
  limitPrice: z.number().positive(),
  stopPrice: z.number().positive(),
});

// Combined order request schema
export const OrderRequestSchema = z.discriminatedUnion('orderType', [
  MarketOrderSchema,
  LimitOrderSchema,
  StopOrderSchema,
  StopLimitOrderSchema,
]);

/**
 * Artificial Order Schema
 * 
 * Used for stop and stop-limit orders during pre-market and post-market hours
 * when these order types aren't supported by the exchange. The service will
 * monitor prices and execute market or limit orders when the trigger price is reached.
 */
export const ArtificialOrderRequestSchema = z.object({
  symbol: z.string().min(1).toUpperCase(),
  qty: z.number().positive(),
  side: OrderSideEnum,
  triggerPrice: z.number().positive(),
  limitPrice: z.number().positive().optional(),
  timeInForce: z.enum(['day', 'gtc']).default('day'),
  notes: z.string().optional(),
});

// Error response schema
export const ErrorResponseSchema = z.object({
  code: z.string(),
  message: z.string(),
  fields: z.record(z.string()).optional(),
  metadata: z.record(z.unknown()).optional(),
});

// Position schema
export const PositionSchema = z.object({
  symbol: z.string(),
  qty: z.number(),
  avgEntryPrice: z.number(),
  side: z.string(),
  marketValue: z.number(),
  costBasis: z.number(),
  unrealizedPl: z.number(),
  unrealizedPlpc: z.number(),
  currentPrice: z.number(),
  lastdayPrice: z.number(),
  changeToday: z.number(),
});

// Account schema
export const AccountSchema = z.object({
  accountNumber: z.string(),
  status: z.string(),
  currency: z.string(),
  buyingPower: z.number(),
  cash: z.number(),
  portfolioValue: z.number(),
  patternDayTrader: z.boolean(),
  tradingBlocked: z.boolean(),
  transfersBlocked: z.boolean(),
  accountBlocked: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

/**
 * Helper function to check if current time is within pre-market hours
 * Pre-market: 4:30 AM to 9:30 AM Eastern
 */
export function isPreMarketHours(date = new Date()): boolean {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const timeString = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:00`;
  
  return timeString >= MARKET_HOURS.PRE_MARKET.START && 
         timeString < MARKET_HOURS.REGULAR_MARKET.START;
}

/**
 * Helper function to check if current time is within regular market hours
 * Regular market: 9:30 AM to 4:00 PM Eastern
 */
export function isRegularMarketHours(date = new Date()): boolean {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const timeString = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:00`;
  
  return timeString >= MARKET_HOURS.REGULAR_MARKET.START && 
         timeString < MARKET_HOURS.REGULAR_MARKET.END;
}

/**
 * Helper function to check if current time is within post-market hours
 * Post-market: 4:00 PM to 8:00 PM Eastern
 */
export function isPostMarketHours(date = new Date()): boolean {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const timeString = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:00`;
  
  return timeString >= MARKET_HOURS.REGULAR_MARKET.END && 
         timeString < MARKET_HOURS.POST_MARKET.END;
}

/**
 * Helper function to determine if artificial orders can be executed based on config and market hours
 * 
 * Artificial orders are used for stop and stop-limit orders during pre-market and post-market hours
 * when these order types aren't supported by the exchange.
 */
export function canExecuteArtificialOrder(
  config: z.infer<typeof RuntimeConfigSchema>,
  date = new Date()
): boolean {
  if (isRegularMarketHours(date)) {
    return true; // Always allow during regular market hours
  }
  
  if (isPreMarketHours(date) && config.marketHours.enablePreMarket) {
    return true; // Allow during pre-market if enabled
  }
  
  if (isPostMarketHours(date) && config.marketHours.enableAfterHours) {
    return true; // Allow during post-market if enabled
  }
  
  return false; // Outside of allowed hours
}

// Export types derived from schemas
export type ServiceConfig = z.infer<typeof ServiceConfigSchema>;
export type RuntimeConfig = z.infer<typeof RuntimeConfigSchema>;
export type OrderRequest = z.infer<typeof OrderRequestSchema>;
export type ArtificialOrderRequest = z.infer<typeof ArtificialOrderRequestSchema>;
export type Position = z.infer<typeof PositionSchema>;
export type Account = z.infer<typeof AccountSchema>;
