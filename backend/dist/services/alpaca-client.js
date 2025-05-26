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
Object.defineProperty(exports, "__esModule", { value: true });
exports.AlpacaClient = void 0;
exports.createAlpacaClient = createAlpacaClient;
const typescript_sdk_1 = require("@alpacahq/typescript-sdk");
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
        this.client = (0, typescript_sdk_1.createClient)({
            key: config.apiKey,
            secret: config.apiSecret,
            paper: config.paperTrading !== false, // Default to paper trading
            tokenBucket: {
                capacity: 200, // Maximum number of tokens
                fillRate: 60 // Tokens refilled per second
            }
        });
    }
    /**
     * Get account information
     * @returns Promise resolving to account information
     */
    async getAccount() {
        try {
            const account = await this.client.getAccount();
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
            const positions = await this.client.getPositions();
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
            const position = await this.client.getPosition({ symbol });
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
            // Convert parameters to the format expected by the TypeScript SDK
            const orderRequest = {
                symbol: params.symbol,
                qty: String(params.qty),
                side: params.side,
                type: params.orderType,
                time_in_force: params.timeInForce,
            };
            // Add conditional fields
            if (params.limitPrice !== undefined) {
                orderRequest.limit_price = String(params.limitPrice);
            }
            if (params.stopPrice !== undefined) {
                orderRequest.stop_price = String(params.stopPrice);
            }
            if (params.clientOrderId) {
                orderRequest.client_order_id = params.clientOrderId;
            }
            if (params.extendedHours !== undefined) {
                orderRequest.extended_hours = params.extendedHours;
            }
            const order = await this.client.createOrder(orderRequest);
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
            const order = await this.client.getOrder({ order_id: orderId });
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
            const request = {
                status: status,
                limit,
                direction: 'desc'
            };
            const orders = await this.client.getOrders(request);
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
            await this.client.cancelOrder({ order_id: orderId });
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
            // Use the market data methods from the TypeScript SDK
            const quote = await this.client.getLatestQuote({ symbol });
            return {
                symbol,
                bidPrice: safeToNumber(quote.bid_price),
                bidSize: safeToNumber(quote.bid_size),
                askPrice: safeToNumber(quote.ask_price),
                askSize: safeToNumber(quote.ask_size),
                timestamp: quote.timestamp || new Date().toISOString(),
                latestPrice: (safeToNumber(quote.bid_price) + safeToNumber(quote.ask_price)) / 2
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
            const request = {
                symbol,
                timeframe,
                limit: limit || 100
            };
            if (start)
                request.start = start.toISOString();
            if (end)
                request.end = end.toISOString();
            const response = await this.client.getBars(request);
            // Handle the response structure - the SDK typically returns an object with bars array
            const bars = response.bars || response || [];
            return bars.map((bar) => ({
                symbol,
                timestamp: bar.timestamp || bar.t || new Date().toISOString(),
                open: safeToNumber(bar.open || bar.o),
                high: safeToNumber(bar.high || bar.h),
                low: safeToNumber(bar.low || bar.l),
                close: safeToNumber(bar.close || bar.c),
                volume: safeToNumber(bar.volume || bar.v)
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
            const assets = await this.client.getAssets({ status });
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
            const asset = await this.client.getAsset({ symbol });
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
            const result = await this.client.closePosition({ symbol });
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
