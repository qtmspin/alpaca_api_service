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
} as const;

// Alpaca API configuration
export interface AlpacaConfig {
  apiKey: string;
  secretKey: string;
  isPaper: boolean;
  baseUrl?: string;
}

// Server configuration
export interface ServerConfig {
  apiPort: number;
  wsPort: number;
  host: string;
}

// Monitoring configuration
export interface MonitoringConfig {
  priceCheckIntervalMs: number;
  maxRetries: number;
  retryDelayMs: number;
}

// Runtime configuration
export interface RuntimeConfig {
  alpaca: AlpacaConfig;
  monitoring: MonitoringConfig;
  rateLimits: {
    orders: number;
    data: number;
  };
}

// Startup configuration
export interface StartupConfig {
  apiPort: number;
  wsPort: number;
  host: string;
}

// Main application configuration
export interface AppConfig {
  startup: StartupConfig;
  runtime: RuntimeConfig;
}

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

// Order-related types
export interface OrderData {
  symbol: string;
  qty: number;
  side: 'buy' | 'sell';
  type: 'market' | 'limit' | 'stop' | 'stop_limit';
  time_in_force: 'day' | 'gtc' | 'opg' | 'cls' | 'ioc' | 'fok';
  limit_price?: number;
  stop_price?: number;
  extended_hours?: boolean;
  client_order_id?: string;
}

export interface Position {
  symbol: string;
  qty: string;
  side: 'long' | 'short';
  market_value: string;
  cost_basis: string;
  unrealized_pl: string;
  unrealized_plpc: string;
  current_price: string;
  lastday_price: string;
  change_today: string;
}

export interface Asset {
  id: string;
  class: string;
  exchange: string;
  symbol: string;
  name: string;
  status: string;
  tradable: boolean;
  marginable: boolean;
  shortable: boolean;
  easy_to_borrow: boolean;
  fractionable: boolean;
}

export interface MarketData {
  symbol: string;
  price: number;
  timestamp: string;
  volume?: number;
  high?: number;
  low?: number;
  open?: number;
  close?: number;
}

export interface Quote {
  symbol: string;
  bid_price: number;
  bid_size: number;
  ask_price: number;
  ask_size: number;
  timestamp: string;
}

export interface Trade {
  symbol: string;
  price: number;
  size: number;
  timestamp: string;
  conditions?: string[];
}

// WebSocket message types
export interface WSMessage {
  type: string;
  data: any;
  timestamp: string;
}

export interface WSSubscription {
  type: 'quotes' | 'trades' | 'bars' | 'orders' | 'positions';
  symbols?: string[];
}

// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}

export interface PaginatedResponse<T = any> extends ApiResponse<T[]> {
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
}

// Artificial order types (exported from artificial-orders module)
export interface ArtificialOrderData {
  id: string;
  symbol: string;
  qty: number;
  side: 'buy' | 'sell';
  type: 'market' | 'limit' | 'stop' | 'stop_limit';
  limit_price?: number;
  stop_price?: number;
  time_in_force: 'day' | 'gtc';
  status: 'pending' | 'filled' | 'cancelled' | 'expired';
  created_at: string;
  updated_at: string;
  trigger_condition?: {
    field: 'price' | 'volume';
    operator: 'gte' | 'lte' | 'eq';
    value: number;
  };
}

// Error types
export interface AppError {
  code: string;
  message: string;
  details?: any;
  timestamp: string;
}

export interface ValidationError extends AppError {
  field: string;
  value: any;
}

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
export function isPreMarketHours(): boolean {
  const now = new Date();
  const marketOpenTime = new Date(now);
  const [hours, minutes] = MARKET_HOURS.OPEN.split(':').map(Number);
  marketOpenTime.setHours(hours, minutes, 0, 0);
  
  // Pre-market is 4:00 AM to market open
  const preMarketStart = new Date(now);
  preMarketStart.setHours(4, 0, 0, 0);
  
  return now >= preMarketStart && now < marketOpenTime;
}

export function isPostMarketHours(): boolean {
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

// Export commonly used types
export type OrderSide = 'buy' | 'sell';
export type OrderType = 'market' | 'limit' | 'stop' | 'stop_limit';
export type TimeInForce = 'day' | 'gtc' | 'opg' | 'cls' | 'ioc' | 'fok';
export type OrderStatus = 'new' | 'partially_filled' | 'filled' | 'done_for_day' | 'canceled' | 'expired' | 'replaced' | 'pending_cancel' | 'pending_replace' | 'pending_review' | 'accepted' | 'pending_new' | 'accepted_for_bidding' | 'stopped' | 'rejected' | 'suspended' | 'calculated';
export type AssetClass = 'us_equity' | 'crypto';
export type PositionSide = 'long' | 'short';