"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.AccountSchema = exports.PositionSchema = exports.ErrorResponseSchema = exports.ArtificialOrderRequestSchema = exports.OrderRequestSchema = exports.StopLimitOrderSchema = exports.StopOrderSchema = exports.LimitOrderSchema = exports.MarketOrderSchema = exports.TimeInForceEnum = exports.OrderSideEnum = exports.OrderTypeEnum = exports.ConfigUpdateSchema = exports.ServiceConfigSchema = exports.MARKET_HOURS = void 0;
exports.isPreMarketHours = isPreMarketHours;
exports.isRegularMarketHours = isRegularMarketHours;
exports.isPostMarketHours = isPostMarketHours;
exports.canExecuteArtificialOrder = canExecuteArtificialOrder;
const zod_1 = require("zod");
// Market hours constants
exports.MARKET_HOURS = {
    PRE_MARKET: {
        START: '04:30:00', // 4:30 AM Eastern
        END: '09:30:00', // 9:30 AM Eastern
    },
    REGULAR_MARKET: {
        START: '09:30:00', // 9:30 AM Eastern
        END: '16:00:00', // 4:00 PM Eastern
    },
    POST_MARKET: {
        START: '16:00:00', // 4:00 PM Eastern
        END: '20:00:00', // 8:00 PM Eastern
    },
};
// Alpaca API settings schema
const AlpacaSchema = zod_1.z.object({
    apiKey: zod_1.z.string().min(1, 'API key is required'),
    apiSecret: zod_1.z.string().min(1, 'API secret is required'),
    paperTrading: zod_1.z.boolean().default(true),
});
// Rate limiting settings schema
const RateLimitsSchema = zod_1.z.object({
    orders: zod_1.z.number().int().min(1).max(500).default(200),
    data: zod_1.z.number().int().min(1).max(500).default(200),
    burst: zod_1.z.number().int().min(1).max(50).default(10),
});
// Order management settings schema
const OrderRulesSchema = zod_1.z.object({
    cooldownMs: zod_1.z.number().int().min(100).default(1000),
    duplicateWindowMs: zod_1.z.number().int().min(1000).default(5000),
    maxPerSymbol: zod_1.z.number().int().min(1).default(5),
    maxTotal: zod_1.z.number().int().min(1).default(50),
});
// Market hours settings schema
const MarketHoursSchema = zod_1.z.object({
    enablePreMarket: zod_1.z.boolean().default(true),
    enableAfterHours: zod_1.z.boolean().default(true),
});
// Monitoring settings schema
const MonitoringSchema = zod_1.z.object({
    priceCheckIntervalMs: zod_1.z.number().int().min(50).default(100),
    websocketHeartbeatMs: zod_1.z.number().int().min(1000).default(30000),
});
// Runtime settings schema (can be changed without restart)
const RuntimeConfigSchema = zod_1.z.object({
    alpaca: AlpacaSchema,
    rateLimits: RateLimitsSchema,
    orderRules: OrderRulesSchema,
    marketHours: MarketHoursSchema,
    monitoring: MonitoringSchema,
});
// Startup settings schema (require restart)
const StartupConfigSchema = zod_1.z.object({
    apiPort: zod_1.z.number().int().min(1024).max(65535).default(9000),
    monitorPort: zod_1.z.number().int().min(1024).max(65535).default(5900),
});
// Complete service configuration schema
exports.ServiceConfigSchema = zod_1.z.object({
    runtime: RuntimeConfigSchema,
    startup: StartupConfigSchema,
});
// Schema for config updates (only runtime settings can be updated via API)
exports.ConfigUpdateSchema = zod_1.z.object({
    runtime: RuntimeConfigSchema.partial(),
}).partial();
// Order types
exports.OrderTypeEnum = zod_1.z.enum([
    'market',
    'limit',
    'stop',
    'stop_limit',
]);
// Order side
exports.OrderSideEnum = zod_1.z.enum(['buy', 'sell']);
// Time in force options
exports.TimeInForceEnum = zod_1.z.enum([
    'day',
    'gtc', // Good till canceled
    'opg', // Market on open
    'cls', // Market on close
    'ioc', // Immediate or cancel
    'fok', // Fill or kill
]);
// Base order request schema
const BaseOrderRequestSchema = zod_1.z.object({
    symbol: zod_1.z.string().min(1).toUpperCase(),
    qty: zod_1.z.number().positive(),
    side: exports.OrderSideEnum,
    timeInForce: exports.TimeInForceEnum.default('day'),
    clientOrderId: zod_1.z.string().optional(),
});
// Market order schema
exports.MarketOrderSchema = BaseOrderRequestSchema.extend({
    orderType: zod_1.z.literal('market'),
});
// Limit order schema
exports.LimitOrderSchema = BaseOrderRequestSchema.extend({
    orderType: zod_1.z.literal('limit'),
    limitPrice: zod_1.z.number().positive(),
});
// Stop order schema
exports.StopOrderSchema = BaseOrderRequestSchema.extend({
    orderType: zod_1.z.literal('stop'),
    stopPrice: zod_1.z.number().positive(),
});
// Stop limit order schema
exports.StopLimitOrderSchema = BaseOrderRequestSchema.extend({
    orderType: zod_1.z.literal('stop_limit'),
    limitPrice: zod_1.z.number().positive(),
    stopPrice: zod_1.z.number().positive(),
});
// Combined order request schema
exports.OrderRequestSchema = zod_1.z.discriminatedUnion('orderType', [
    exports.MarketOrderSchema,
    exports.LimitOrderSchema,
    exports.StopOrderSchema,
    exports.StopLimitOrderSchema,
]);
/**
 * Artificial Order Schema
 *
 * Used for stop and stop-limit orders during pre-market and post-market hours
 * when these order types aren't supported by the exchange. The service will
 * monitor prices and execute market or limit orders when the trigger price is reached.
 */
exports.ArtificialOrderRequestSchema = zod_1.z.object({
    symbol: zod_1.z.string().min(1).toUpperCase(),
    qty: zod_1.z.number().positive(),
    side: exports.OrderSideEnum,
    triggerPrice: zod_1.z.number().positive(),
    limitPrice: zod_1.z.number().positive().optional(),
    timeInForce: zod_1.z.enum(['day', 'gtc']).default('day'),
    notes: zod_1.z.string().optional(),
});
// Error response schema
exports.ErrorResponseSchema = zod_1.z.object({
    code: zod_1.z.string(),
    message: zod_1.z.string(),
    fields: zod_1.z.record(zod_1.z.string()).optional(),
    metadata: zod_1.z.record(zod_1.z.unknown()).optional(),
});
// Position schema
exports.PositionSchema = zod_1.z.object({
    symbol: zod_1.z.string(),
    qty: zod_1.z.number(),
    avgEntryPrice: zod_1.z.number(),
    side: zod_1.z.string(),
    marketValue: zod_1.z.number(),
    costBasis: zod_1.z.number(),
    unrealizedPl: zod_1.z.number(),
    unrealizedPlpc: zod_1.z.number(),
    currentPrice: zod_1.z.number(),
    lastdayPrice: zod_1.z.number(),
    changeToday: zod_1.z.number(),
});
// Account schema
exports.AccountSchema = zod_1.z.object({
    accountNumber: zod_1.z.string(),
    status: zod_1.z.string(),
    currency: zod_1.z.string(),
    buyingPower: zod_1.z.number(),
    cash: zod_1.z.number(),
    portfolioValue: zod_1.z.number(),
    patternDayTrader: zod_1.z.boolean(),
    tradingBlocked: zod_1.z.boolean(),
    transfersBlocked: zod_1.z.boolean(),
    accountBlocked: zod_1.z.boolean(),
    createdAt: zod_1.z.string(),
    updatedAt: zod_1.z.string(),
});
/**
 * Helper function to check if current time is within pre-market hours
 * Pre-market: 4:30 AM to 9:30 AM Eastern
 */
function isPreMarketHours(date = new Date()) {
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const timeString = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:00`;
    return timeString >= exports.MARKET_HOURS.PRE_MARKET.START &&
        timeString < exports.MARKET_HOURS.REGULAR_MARKET.START;
}
/**
 * Helper function to check if current time is within regular market hours
 * Regular market: 9:30 AM to 4:00 PM Eastern
 */
function isRegularMarketHours(date = new Date()) {
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const timeString = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:00`;
    return timeString >= exports.MARKET_HOURS.REGULAR_MARKET.START &&
        timeString < exports.MARKET_HOURS.REGULAR_MARKET.END;
}
/**
 * Helper function to check if current time is within post-market hours
 * Post-market: 4:00 PM to 8:00 PM Eastern
 */
function isPostMarketHours(date = new Date()) {
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const timeString = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:00`;
    return timeString >= exports.MARKET_HOURS.REGULAR_MARKET.END &&
        timeString < exports.MARKET_HOURS.POST_MARKET.END;
}
/**
 * Helper function to determine if artificial orders can be executed based on config and market hours
 *
 * Artificial orders are used for stop and stop-limit orders during pre-market and post-market hours
 * when these order types aren't supported by the exchange.
 */
function canExecuteArtificialOrder(config, date = new Date()) {
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
