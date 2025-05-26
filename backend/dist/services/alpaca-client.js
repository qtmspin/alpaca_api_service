"use strict";
/**
 * alpaca-client.ts
 *
 * This file contains the client service for interacting with the Alpaca API.
 * Location: backend/src/services/alpaca-client.ts
 *
 * Responsibilities:
 * - Provide methods for interacting with the Alpaca API using the official TypeScript SDK
 * - Handle API requests and responses
 * - Format data for the frontend
 * - Manage error handling and rate limiting
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.AlpacaClient = void 0;
exports.createAlpacaClient = createAlpacaClient;
// Import the SDK using dynamic import to handle ESM modules
// We'll initialize this in the constructor
let createClient;
/**
 * Helper function to safely convert a value to a number
 */
function safeToNumber(value, defaultValue = 0) {
    if (value === null || value === undefined)
        return defaultValue;
    const num = typeof value === 'string' ? parseFloat(value) : Number(value);
    return isNaN(num) ? defaultValue : num;
}
/**
 * Helper function to safely convert a value to a string
 */
function safeToString(value) {
    if (value === null || value === undefined)
        return undefined;
    return String(value);
}
/**
 * AlpacaClient class
 *
 * Provides methods for interacting with the Alpaca API using the official TypeScript SDK.
 */
class AlpacaClient {
    /**
     * Constructor for AlpacaClient
     * @param config - Alpaca API configuration
     */
    constructor(config) {
        this.config = config;
        // Initialize the client asynchronously
        this.initClient();
    }
    /**
     * Initialize the Alpaca client asynchronously
     * This handles the dynamic import of the ESM module
     */
    /**
     * Ensure the client is initialized before making API calls
     * @returns The initialized client
     */
    async ensureClient() {
        if (!this.client) {
            await this.initClient();
        }
        if (!this.client) {
            throw new Error('Alpaca client failed to initialize');
        }
        return this.client;
    }
    /**
     * Initialize the Alpaca client asynchronously
     * This handles the dynamic import of the ESM module
     */
    async initClient() {
        try {
            // Dynamically import the SDK
            const alpacaSdk = await Promise.resolve().then(() => __importStar(require('@alpacahq/typescript-sdk')));
            createClient = alpacaSdk.createClient;
            this.client = createClient({
                key: this.config.apiKey,
                secret: this.config.apiSecret,
                paper: this.config.paperTrading !== false, // Default to paper trading
                tokenBucket: {
                    capacity: 200, // Maximum number of tokens
                    fillRate: 60 // Tokens refilled per second
                }
            });
        }
        catch (error) {
            console.error('Failed to initialize Alpaca client:', error);
            throw new Error(`Failed to initialize Alpaca client: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * Get account information
     * @returns Promise resolving to account information
     */
    async getAccount() {
        try {
            const client = await this.ensureClient();
            const account = await client.getAccount();
            return {
                accountNumber: account.account_number || '',
                status: account.status || 'UNKNOWN',
                currency: account.currency || 'USD',
                buyingPower: safeToNumber(account.buying_power),
                cash: safeToNumber(account.cash),
                portfolioValue: safeToNumber(account.portfolio_value),
                patternDayTrader: Boolean(account.pattern_day_trader),
                tradingBlocked: Boolean(account.trading_blocked),
                transfersBlocked: Boolean(account.transfers_blocked),
                accountBlocked: Boolean(account.account_blocked),
                createdAt: account.created_at || new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
        }
        catch (error) {
            console.error('Error getting account information:', error);
            throw this.handleApiError(error, 'Failed to get account information');
        }
    }
    /**
     * Get all positions
     * @returns Promise resolving to array of positions
     */
    async getPositions() {
        try {
            const client = await this.ensureClient();
            const positions = await client.getPositions();
            return positions.map((position) => ({
                symbol: position.symbol || '',
                qty: safeToNumber(position.qty),
                avgEntryPrice: safeToNumber(position.avg_entry_price),
                side: safeToNumber(position.qty) >= 0 ? 'long' : 'short',
                marketValue: safeToNumber(position.market_value),
                costBasis: safeToNumber(position.cost_basis),
                unrealizedPl: safeToNumber(position.unrealized_pl),
                unrealizedPlpc: safeToNumber(position.unrealized_plpc),
                currentPrice: safeToNumber(position.current_price),
                lastdayPrice: safeToNumber(position.lastday_price),
                changeToday: safeToNumber(position.change_today)
            }));
        }
        catch (error) {
            console.error('Error getting positions:', error);
            throw this.handleApiError(error, 'Failed to get positions');
        }
    }
    /**
     * Get position by symbol
     * @param symbol - Stock symbol
     * @returns Promise resolving to position information
     */
    async getPosition(symbol) {
        try {
            const client = await this.ensureClient();
            // Use symbol_or_asset_id as the parameter name per SDK documentation
            const position = await client.getPosition({ symbol_or_asset_id: symbol });
            return {
                symbol: position.symbol || symbol,
                qty: safeToNumber(position.qty),
                avgEntryPrice: safeToNumber(position.avg_entry_price),
                side: safeToNumber(position.qty) >= 0 ? 'long' : 'short',
                marketValue: safeToNumber(position.market_value),
                costBasis: safeToNumber(position.cost_basis),
                unrealizedPl: safeToNumber(position.unrealized_pl),
                unrealizedPlpc: safeToNumber(position.unrealized_plpc),
                currentPrice: safeToNumber(position.current_price),
                lastdayPrice: safeToNumber(position.lastday_price),
                changeToday: safeToNumber(position.change_today)
            };
        }
        catch (error) {
            // Handle 404 error specifically
            if (error?.status === 404 || error?.response?.status === 404) {
                const notFoundError = new Error(`No position found for symbol ${symbol}`);
                notFoundError.statusCode = 404;
                throw notFoundError;
            }
            console.error(`Error getting position for ${symbol}:`, error);
            throw this.handleApiError(error, `Failed to get position for ${symbol}`);
        }
    }
    /**
     * Create a new order
     * @param params - Order parameters
     * @returns Promise resolving to order information
     */
    async createOrder(params) {
        try {
            const client = await this.ensureClient();
            // Convert parameters to the format expected by the SDK
            const orderParams = {
                symbol: params.symbol,
                qty: params.qty,
                side: params.side,
                type: params.orderType,
                time_in_force: params.timeInForce,
                limit_price: params.limitPrice,
                stop_price: params.stopPrice,
                client_order_id: params.clientOrderId,
                extended_hours: params.extendedHours
            };
            const order = await client.createOrder(orderParams);
            return this.formatOrderResponse(order);
        }
        catch (error) {
            console.error('Error creating order:', error);
            throw this.handleApiError(error, 'Failed to create order');
        }
    }
    /**
     * Get an order by ID
     * @param orderId - Order ID
     * @returns Promise resolving to order information
     */
    async getOrder(orderId) {
        try {
            const client = await this.ensureClient();
            const order = await client.getOrder({ order_id: orderId });
            return this.formatOrderResponse(order);
        }
        catch (error) {
            if (error?.status === 404 || error?.response?.status === 404) {
                const notFoundError = new Error(`Order ${orderId} not found`);
                notFoundError.statusCode = 404;
                throw notFoundError;
            }
            console.error(`Error getting order ${orderId}:`, error);
            throw this.handleApiError(error, `Failed to get order ${orderId}`);
        }
    }
    /**
     * Get orders
     * @param status - Order status filter
     * @param limit - Maximum number of orders to return
     * @returns Promise resolving to array of orders
     */
    async getOrders(status = 'open', limit = 50) {
        try {
            const client = await this.ensureClient();
            const request = {
                status: status,
                limit,
                direction: 'desc'
            };
            const orders = await client.getOrders(request);
            // Handle both single order and array responses
            const orderArray = Array.isArray(orders) ? orders : [orders];
            return orderArray.map((order) => this.formatOrderResponse(order));
        }
        catch (error) {
            console.error('Error getting orders:', error);
            throw this.handleApiError(error, 'Failed to get orders');
        }
    }
    /**
     * Cancel an order
     * @param orderId - Order ID
     * @returns Promise resolving to canceled order status
     */
    async cancelOrder(orderId) {
        try {
            const client = await this.ensureClient();
            await client.cancelOrder({ order_id: orderId });
            return {
                orderId,
                status: 'canceled'
            };
        }
        catch (error) {
            if (error?.status === 404 || error?.response?.status === 404) {
                const notFoundError = new Error(`Order ${orderId} not found`);
                notFoundError.statusCode = 404;
                throw notFoundError;
            }
            console.error(`Error canceling order ${orderId}:`, error);
            throw this.handleApiError(error, `Failed to cancel order ${orderId}`);
        }
    }
    /**
     * Get current quote for a symbol
     * @param symbol - Stock symbol
     * @returns Promise resolving to quote information
     */
    async getQuote(symbol) {
        try {
            const client = await this.ensureClient();
            // Use the stocks quotes latest method from the TypeScript SDK
            const response = await client.getStocksQuotesLatest({ symbols: symbol });
            // Extract the quote data - handle various response structures
            let quote;
            if (response.quotes && response.quotes[symbol]) {
                quote = response.quotes[symbol];
            }
            else if (response[symbol]) {
                quote = response[symbol];
            }
            else if (Array.isArray(response) && response.length > 0) {
                quote = response[0];
            }
            else {
                quote = response;
            }
            return {
                symbol,
                bidPrice: safeToNumber(quote.bp || quote.bid_price || quote.bidPrice),
                bidSize: safeToNumber(quote.bs || quote.bid_size || quote.bidSize),
                askPrice: safeToNumber(quote.ap || quote.ask_price || quote.askPrice),
                askSize: safeToNumber(quote.as || quote.ask_size || quote.askSize),
                timestamp: quote.t || quote.timestamp || new Date().toISOString(),
                latestPrice: (safeToNumber(quote.bp || quote.bid_price || quote.bidPrice) +
                    safeToNumber(quote.ap || quote.ask_price || quote.askPrice)) / 2
            };
        }
        catch (error) {
            console.error(`Error getting quote for ${symbol}:`, error);
            throw this.handleApiError(error, `Failed to get quote for ${symbol}`);
        }
    }
    /**
     * Get historical bars for a symbol
     * @param symbol - Stock symbol
     * @param timeframe - Timeframe for bars
     * @param start - Start date
     * @param end - End date
     * @param limit - Maximum number of bars to return
     * @returns Promise resolving to array of bars
     */
    async getBars(symbol, timeframe, start, end, limit) {
        try {
            const client = await this.ensureClient();
            const request = {
                symbols: symbol,
                timeframe,
                limit: limit || 100
            };
            if (start)
                request.start = start.toISOString();
            if (end)
                request.end = end.toISOString();
            // Use the stocks bars method from the TypeScript SDK
            const response = await client.getStocksBars(request);
            // Extract bars from the response structure
            let bars = [];
            if (response.bars && response.bars[symbol]) {
                bars = response.bars[symbol];
            }
            else if (response[symbol]) {
                bars = response[symbol];
            }
            else if (response.bars && Array.isArray(response.bars)) {
                bars = response.bars;
            }
            else if (Array.isArray(response)) {
                bars = response;
            }
            return bars.map((bar) => ({
                symbol,
                timestamp: bar.t || bar.timestamp || new Date().toISOString(),
                open: safeToNumber(bar.o || bar.open),
                high: safeToNumber(bar.h || bar.high),
                low: safeToNumber(bar.l || bar.low),
                close: safeToNumber(bar.c || bar.close),
                volume: safeToNumber(bar.v || bar.volume)
            }));
        }
        catch (error) {
            console.error(`Error getting bars for ${symbol}:`, error);
            throw this.handleApiError(error, `Failed to get bars for ${symbol}`);
        }
    }
    /**
     * Get assets available for trading
     * @param status - Asset status filter
     * @returns Promise resolving to array of assets
     */
    async getAssets(status = 'active') {
        try {
            const client = await this.ensureClient();
            const assets = await client.getAssets({ status });
            return assets.map((asset) => ({
                id: asset.id,
                symbol: asset.symbol,
                name: asset.name,
                exchange: asset.exchange,
                status: asset.status,
                tradable: asset.tradable,
                marginable: asset.marginable,
                shortable: asset.shortable,
                fractionable: asset.fractionable
            }));
        }
        catch (error) {
            console.error('Error getting assets:', error);
            throw this.handleApiError(error, 'Failed to get assets');
        }
    }
    /**
     * Get asset by symbol
     * @param symbol - Stock symbol
     * @returns Promise resolving to asset information
     */
    async getAsset(symbol) {
        try {
            const client = await this.ensureClient();
            // Use symbol_or_asset_id as the parameter name per SDK documentation
            const asset = await client.getAsset({ symbol_or_asset_id: symbol });
            return {
                id: asset.id,
                symbol: asset.symbol,
                name: asset.name,
                exchange: asset.exchange,
                status: asset.status,
                tradable: asset.tradable,
                marginable: asset.marginable,
                shortable: asset.shortable,
                fractionable: asset.fractionable
            };
        }
        catch (error) {
            console.error(`Error getting asset ${symbol}:`, error);
            throw this.handleApiError(error, `Failed to get asset ${symbol}`);
        }
    }
    /**
     * Close a position
     * @param symbol - Stock symbol
     * @returns Promise resolving to closed position result
     */
    async closePosition(symbol) {
        try {
            const client = await this.ensureClient();
            // Use symbol_or_asset_id as the parameter name per SDK documentation
            const result = await client.closePosition({ symbol_or_asset_id: symbol });
            return {
                symbol,
                side: result.side || 'unknown',
                qty: safeToNumber(result.qty),
                status: 'closed'
            };
        }
        catch (error) {
            if (error?.status === 404 || error?.response?.status === 404) {
                const notFoundError = new Error(`Position not found for symbol ${symbol}`);
                notFoundError.statusCode = 404;
                throw notFoundError;
            }
            console.error(`Error closing position for ${symbol}:`, error);
            throw this.handleApiError(error, `Failed to close position for ${symbol}`);
        }
    }
    /**
     * Format order response to standardized format
     * @param order - Raw order object from Alpaca API
     * @returns Formatted order response
     */
    formatOrderResponse(order) {
        return {
            orderId: order.id || '',
            clientOrderId: order.client_order_id,
            symbol: order.symbol || '',
            side: order.side || '',
            orderType: order.type || order.order_type || '',
            timeInForce: order.time_in_force || '',
            qty: safeToNumber(order.qty),
            filledQty: safeToNumber(order.filled_qty),
            limitPrice: order.limit_price ? safeToNumber(order.limit_price) : undefined,
            stopPrice: order.stop_price ? safeToNumber(order.stop_price) : undefined,
            status: order.status || '',
            createdAt: order.created_at || new Date().toISOString(),
            updatedAt: order.updated_at || new Date().toISOString(),
            submittedAt: order.submitted_at,
            filledAt: order.filled_at,
            expiredAt: order.expired_at,
            canceledAt: order.canceled_at,
            filledAvgPrice: order.filled_avg_price ? safeToNumber(order.filled_avg_price) : undefined
        };
    }
    /**
     * Handle API errors consistently
     * @param error - The error object
     * @param message - Default error message
     * @returns Formatted error
     */
    handleApiError(error, message) {
        // If it's already a handled error, just return it
        if (error.statusCode) {
            return error;
        }
        // Create a new error with the original message if available
        const errorMessage = error instanceof Error ? error.message : message;
        const apiError = new Error(errorMessage);
        // Add status code if available
        if (error?.status) {
            apiError.statusCode = error.status;
        }
        else if (error?.response?.status) {
            apiError.statusCode = error.response.status;
        }
        else {
            apiError.statusCode = 500;
        }
        // Add error code if available
        apiError.code = error?.code || 'ALPACA_API_ERROR';
        return apiError;
    }
}
exports.AlpacaClient = AlpacaClient;
/**
 * Create an Alpaca client instance
 * @param config - Alpaca API configuration
 * @returns AlpacaClient instance
 */
function createAlpacaClient(config) {
    return new AlpacaClient(config);
}
