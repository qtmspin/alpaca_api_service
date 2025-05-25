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
            paper: config.paperTrading !== false, // Default to paper trading if not specified
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
                accountNumber: account.account_number,
                status: account.status,
                currency: account.currency,
                buyingPower: parseFloat(account.buying_power),
                cash: parseFloat(account.cash),
                portfolioValue: parseFloat(account.portfolio_value),
                patternDayTrader: account.pattern_day_trader,
                tradingBlocked: account.trading_blocked,
                transfersBlocked: account.transfers_blocked,
                accountBlocked: account.account_blocked,
                createdAt: account.created_at,
                updatedAt: new Date().toISOString()
            };
        }
        catch (error) {
            console.error('Error getting account information:', error);
            throw error;
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
                symbol: position.symbol,
                qty: parseFloat(position.qty),
                avgEntryPrice: parseFloat(position.avg_entry_price),
                side: parseFloat(position.qty) > 0 ? 'long' : 'short',
                marketValue: parseFloat(position.market_value),
                costBasis: parseFloat(position.cost_basis),
                unrealizedPl: parseFloat(position.unrealized_pl),
                unrealizedPlpc: parseFloat(position.unrealized_plpc),
                currentPrice: parseFloat(position.current_price),
                lastdayPrice: parseFloat(position.lastday_price),
                changeToday: parseFloat(position.change_today)
            }));
        }
        catch (error) {
            console.error('Error getting positions:', error);
            throw error;
        }
    }
    /**
     * Get position by symbol
     * @param symbol - Stock symbol
     * @returns Promise resolving to position information
     */
    async getPosition(symbol) {
        try {
            // Use a string parameter as the SDK expects for the position endpoint
            const position = await this.client.getPosition(symbol);
            return {
                symbol: position.symbol,
                qty: parseFloat(position.qty),
                avgEntryPrice: parseFloat(position.avg_entry_price),
                side: parseFloat(position.qty) > 0 ? 'long' : 'short',
                marketValue: parseFloat(position.market_value),
                costBasis: parseFloat(position.cost_basis),
                unrealizedPl: parseFloat(position.unrealized_pl),
                unrealizedPlpc: parseFloat(position.unrealized_plpc),
                currentPrice: parseFloat(position.current_price),
                lastdayPrice: parseFloat(position.lastday_price),
                changeToday: parseFloat(position.change_today)
            };
        }
        catch (error) {
            // Check for 404 error (position not found)
            if (error?.status === 404) {
                throw new Error(`No position found for symbol ${symbol}`);
            }
            console.error(`Error getting position for ${symbol}:`, error);
            throw error;
        }
    }
    /**
     * Create a new order
     * @param params - Order parameters
     * @returns Promise resolving to order information
     */
    async createOrder(params) {
        try {
            // Convert order parameters to the format expected by the SDK
            const orderParams = {
                symbol: params.symbol,
                qty: params.qty.toString(),
                side: params.side,
                type: params.orderType,
                time_in_force: params.timeInForce,
                limit_price: params.limitPrice ? String(params.limitPrice) : undefined,
                stop_price: params.stopPrice ? String(params.stopPrice) : undefined,
                client_order_id: params.clientOrderId,
                extended_hours: params.extendedHours
            };
            // Use type assertion for the client.createOrder method
            const order = await this.client.createOrder(orderParams);
            return {
                orderId: order.id,
                clientOrderId: order.client_order_id,
                symbol: order.symbol,
                side: order.side,
                orderType: order.type,
                timeInForce: order.time_in_force,
                qty: parseFloat(order.qty),
                filledQty: parseFloat(order.filled_qty),
                limitPrice: order.limit_price ? parseFloat(order.limit_price) : undefined,
                stopPrice: order.stop_price ? parseFloat(order.stop_price) : undefined,
                status: order.status,
                createdAt: order.created_at,
                updatedAt: order.updated_at,
                submittedAt: order.submitted_at,
                filledAt: order.filled_at,
                expiredAt: order.expired_at,
                canceledAt: order.canceled_at
            };
        }
        catch (error) {
            console.error('Error creating order:', error);
            // Add more detailed error information
            if (error instanceof Error) {
                throw new Error(`Failed to create order: ${error.message}`);
            }
            throw error;
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
            return {
                orderId: order.id,
                clientOrderId: order.client_order_id,
                symbol: order.symbol,
                side: order.side,
                orderType: order.type,
                timeInForce: order.time_in_force,
                qty: parseFloat(order.qty),
                filledQty: parseFloat(order.filled_qty),
                limitPrice: order.limit_price ? parseFloat(order.limit_price) : undefined,
                stopPrice: order.stop_price ? parseFloat(order.stop_price) : undefined,
                status: order.status,
                createdAt: order.created_at,
                updatedAt: order.updated_at,
                submittedAt: order.submitted_at,
                filledAt: order.filled_at,
                expiredAt: order.expired_at,
                canceledAt: order.canceled_at
            };
        }
        catch (error) {
            console.error(`Error getting order ${orderId}:`, error);
            throw error;
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
            // Use parameters as the SDK expects for the getOrders endpoint
            const params = {
                status,
                limit,
                direction: 'desc'
            };
            const orders = await this.client.getOrders(params);
            // The SDK returns an array of orders
            return (Array.isArray(orders) ? orders : [orders]).map((order) => ({
                orderId: order.id,
                clientOrderId: order.client_order_id,
                symbol: order.symbol,
                side: order.side,
                orderType: order.type,
                timeInForce: order.time_in_force,
                qty: parseFloat(order.qty),
                filledQty: parseFloat(order.filled_qty),
                limitPrice: order.limit_price ? parseFloat(order.limit_price) : undefined,
                stopPrice: order.stop_price ? parseFloat(order.stop_price) : undefined,
                status: order.status,
                createdAt: order.created_at,
                updatedAt: order.updated_at,
                submittedAt: order.submitted_at,
                filledAt: order.filled_at,
                expiredAt: order.expired_at,
                canceledAt: order.canceled_at
            }));
        }
        catch (error) {
            console.error('Error getting orders:', error);
            throw error;
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
            console.error(`Error canceling order ${orderId}:`, error);
            throw error;
        }
    }
    /**
     * Get current quote for a symbol
     * @param symbol - Stock symbol
     * @returns Promise resolving to quote information
     */
    async getQuote(symbol) {
        try {
            // In the TypeScript SDK, we need to use the market_data client for quotes
            // Use type assertion since the structure might vary between SDK versions
            const quote = await this.client.getMarketData().getLatestQuote(symbol);
            return {
                symbol,
                bidPrice: parseFloat(quote.bidPrice),
                bidSize: parseInt(quote.bidSize),
                askPrice: parseFloat(quote.askPrice),
                askSize: parseInt(quote.askSize),
                timestamp: quote.timestamp,
                latestPrice: (parseFloat(quote.bidPrice) + parseFloat(quote.askPrice)) / 2
            };
        }
        catch (error) {
            console.error(`Error getting quote for ${symbol}:`, error);
            throw error;
        }
    }
    /**
     * Get historical bars for a symbol
     * @param symbol - Stock symbol
     * @param timeframe - Timeframe for bars (e.g., '1Min', '1D')
     * @param start - Start date
     * @param end - End date
     * @param limit - Maximum number of bars to return
     * @returns Promise resolving to array of bars
     */
    async getBars(symbol, timeframe, start, end, limit) {
        try {
            // Create params object for the getBars endpoint
            const params = {
                timeframe,
                start: start?.toISOString(),
                end: end?.toISOString(),
                limit
            };
            // In the TypeScript SDK, we need to use the market_data client for bars
            // Use type assertion since the structure might vary between SDK versions
            const barsResponse = await this.client.getMarketData().getBars(symbol, params);
            return barsResponse.bars.map((bar) => ({
                symbol,
                timestamp: bar.timestamp,
                open: parseFloat(bar.open),
                high: parseFloat(bar.high),
                low: parseFloat(bar.low),
                close: parseFloat(bar.close),
                volume: parseInt(bar.volume.toString())
            }));
        }
        catch (error) {
            console.error(`Error getting bars for ${symbol}:`, error);
            throw error;
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
            throw error;
        }
    }
    /**
     * Get asset by symbol
     * @param symbol - Stock symbol
     * @returns Promise resolving to asset information
     */
    async getAsset(symbol) {
        try {
            // Use a string parameter as the SDK expects for the asset endpoint
            const asset = await this.client.getAsset(symbol);
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
            throw error;
        }
    }
    /**
     * Close a position
     * @param symbol - Stock symbol
     * @returns Promise resolving to closed position
     */
    async closePosition(symbol) {
        try {
            // Use a string parameter as the SDK expects for the closePosition endpoint
            const response = await this.client.closePosition(symbol);
            return {
                symbol,
                side: response.side,
                qty: parseFloat(response.qty),
                status: 'closed'
            };
        }
        catch (error) {
            console.error(`Error closing position for ${symbol}:`, error);
            throw error;
        }
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
