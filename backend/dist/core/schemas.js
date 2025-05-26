/**
 * schemas.ts
 *
 * This file contains all the type definitions and schemas for the application.
 * Location: backend/src/core/schemas.ts
 *
 * Responsibilities:
 * - Define TypeScript interfaces and types
 * - Export configuration schemas
 * - Define validation schemas using Zod
 */
import { z } from 'zod';
// Market hours configuration
export const MARKET_HOURS = {
    OPEN: '09:30:00',
    CLOSE: '16:00:00',
    TIMEZONE: 'America/New_York'
};
// Zod schemas for validation
export const AlpacaConfigSchema = z.object({
    apiKey: z.string().min(1, 'API key is required'),
    secretKey: z.string().min(1, 'Secret key is required'),
    isPaper: z.boolean().default(true),
    baseUrl: z.string().url().optional()
});
export const ServerConfigSchema = z.object({
    apiPort: z.number().min(1000).max(65535),
    wsPort: z.number().min(1000).max(65535),
    host: z.string().min(1)
});
export const MonitoringConfigSchema = z.object({
    priceCheckIntervalMs: z.number().min(1000).default(5000),
    maxRetries: z.number().min(1).default(3),
    retryDelayMs: z.number().min(100).default(1000)
});
export const RuntimeConfigSchema = z.object({
    alpaca: AlpacaConfigSchema,
    monitoring: MonitoringConfigSchema,
    rateLimits: z.object({
        orders: z.number().min(1).default(200),
        data: z.number().min(1).default(500)
    }).default({
        orders: 200,
        data: 500
    })
});
export const StartupConfigSchema = z.object({
    apiPort: z.number().min(1000).max(65535),
    wsPort: z.number().min(1000).max(65535),
    host: z.string().min(1)
});
export const AppConfigSchema = z.object({
    startup: StartupConfigSchema,
    runtime: RuntimeConfigSchema
});
// Configuration update schema
export const ConfigUpdateSchema = z.object({
    alpaca: AlpacaConfigSchema.partial().optional(),
    monitoring: MonitoringConfigSchema.partial().optional(),
    rateLimits: z.object({
        orders: z.number().min(1).optional(),
        data: z.number().min(1).optional()
    }).partial().optional()
});
// Artificial order schemas
export const TriggerConditionSchema = z.object({
    field: z.enum(['price', 'volume']),
    operator: z.enum(['gte', 'lte', 'eq']),
    value: z.number().positive()
});
export const ArtificialOrderRequestSchema = z.object({
    symbol: z.string().min(1).max(10),
    qty: z.number().positive(),
    side: z.enum(['buy', 'sell']),
    type: z.enum(['market', 'limit', 'stop', 'stop_limit']),
    limit_price: z.number().positive().optional(),
    stop_price: z.number().positive().optional(),
    time_in_force: z.enum(['day', 'gtc']),
    trigger_condition: TriggerConditionSchema.optional()
});
// Market hours utility functions
export function isPreMarketHours() {
    const now = new Date();
    const marketOpenTime = new Date(now);
    const [hours, minutes] = MARKET_HOURS.OPEN.split(':').map(Number);
    marketOpenTime.setHours(hours, minutes, 0, 0);
    // Pre-market is 4:00 AM to market open
    const preMarketStart = new Date(now);
    preMarketStart.setHours(4, 0, 0, 0);
    return now >= preMarketStart && now < marketOpenTime;
}
export function isPostMarketHours() {
    const now = new Date();
    const marketCloseTime = new Date(now);
    const [hours, minutes] = MARKET_HOURS.CLOSE.split(':').map(Number);
    marketCloseTime.setHours(hours, minutes, 0, 0);
    // Post-market is market close to 8:00 PM
    const postMarketEnd = new Date(now);
    postMarketEnd.setHours(20, 0, 0, 0);
    return now > marketCloseTime && now <= postMarketEnd;
}
// Order request schema
export const OrderRequestSchema = z.object({
    symbol: z.string().min(1).max(10),
    qty: z.number().positive(),
    side: z.enum(['buy', 'sell']),
    type: z.enum(['market', 'limit', 'stop', 'stop_limit']),
    time_in_force: z.enum(['day', 'gtc', 'opg', 'cls', 'ioc', 'fok']),
    limit_price: z.number().positive().optional(),
    stop_price: z.number().positive().optional(),
    extended_hours: z.boolean().optional(),
    client_order_id: z.string().optional()
});
