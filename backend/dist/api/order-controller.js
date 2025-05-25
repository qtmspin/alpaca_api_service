"use strict";
/**
 * order-controller.ts
 *
 * This file contains the API controller for order management.
 * Location: backend/src/api/order-controller.ts
 *
 * Responsibilities:
 * - Handle API endpoints for order management
 * - Create, get, and cancel orders
 * - Implement order validation, cooldown, and duplicate detection
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrderController = void 0;
const express_1 = require("express");
const core_1 = require("../core");
const errors_1 = require("../core/errors");
const zod_1 = require("zod");
/**
 * OrderController class
 *
 * Handles API endpoints for order management.
 */
class OrderController {
    /**
     * Constructor for OrderController
     * @param alpacaClient - Alpaca client instance
     * @param runtimeConfig - Runtime configuration
     */
    constructor(alpacaClient, config) {
        this.alpacaClient = alpacaClient;
        this.config = config;
        this.orderCooldowns = new Map();
        this.recentOrders = new Map();
        this.router = (0, express_1.Router)();
        this.runtimeConfig = config;
        this.setupRoutes();
    }
    /**
     * Set up API routes
     */
    setupRoutes() {
        // Create a new order
        this.router.post('/', this.createOrder.bind(this));
        // Get all orders
        this.router.get('/', this.getOrders.bind(this));
        // Get a specific order
        this.router.get('/:orderId', this.getOrder.bind(this));
        // Cancel an order
        this.router.delete('/:orderId', this.cancelOrder.bind(this));
    }
    /**
     * Create a new order
     * @param req - Express request
     * @param res - Express response
     * @param next - Express next function
     */
    async createOrder(req, res, next) {
        try {
            // Validate request body against schema
            const orderRequest = core_1.OrderRequestSchema.parse(req.body);
            // Check for rate limits
            if (this.isRateLimitExceeded()) {
                const rateLimitError = (0, errors_1.createRateLimitError)('Order rate limit exceeded', 45 // Example value
                );
                next(rateLimitError);
                return;
            }
            // Check for cooldown
            const cooldownMs = this.getCooldownRemaining(orderRequest.symbol);
            if (cooldownMs > 0) {
                const cooldownError = (0, errors_1.createCooldownError)(`Order cooldown active for ${orderRequest.symbol}`, cooldownMs);
                next(cooldownError);
                return;
            }
            // Check for duplicate orders
            const duplicateOrderId = this.checkForDuplicateOrder(orderRequest);
            if (duplicateOrderId) {
                const duplicateError = (0, errors_1.createDuplicateOrderError)(`Duplicate order detected within ${this.config.orderRules.duplicateWindowMs}ms window`, duplicateOrderId);
                next(duplicateError);
                return;
            }
            // Check market hours for stop and stop-limit orders during extended hours
            const now = new Date();
            const isExtendedHours = (0, core_1.isPreMarketHours)(now) || (0, core_1.isPostMarketHours)(now);
            if (isExtendedHours &&
                (orderRequest.orderType === 'stop' || orderRequest.orderType === 'stop_limit')) {
                const marketHoursError = new Error('Stop and stop-limit orders are not supported during extended hours. Use artificial orders instead.');
                marketHoursError.statusCode = 400;
                marketHoursError.code = 'UNSUPPORTED_ORDER_TYPE';
                next(marketHoursError);
                return;
            }
            // Create the order
            const order = await this.alpacaClient.createOrder(orderRequest);
            // Update cooldown and recent orders
            this.setOrderCooldown(orderRequest.symbol);
            this.addRecentOrder(orderRequest);
            res.status(201).json(order);
        }
        catch (error) {
            if (error instanceof zod_1.z.ZodError) {
                // Handle validation errors
                const fieldErrors = error.errors.reduce((acc, err) => {
                    acc[err.path.join('.')] = err.message;
                    return acc;
                }, {});
                const validationError = (0, errors_1.createValidationError)('Invalid order request', fieldErrors);
                next(validationError);
            }
            else if (error.statusCode) {
                // Pass through Alpaca API errors
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                const apiError = new Error(errorMessage || 'Alpaca API error');
                apiError.statusCode = error.statusCode;
                apiError.code = error.code || 'ALPACA_API_ERROR';
                next(apiError);
            }
            else {
                // Handle other errors
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                const serverError = (0, errors_1.createServerError)(errorMessage || 'Failed to create order');
                next(serverError);
            }
        }
    }
    /**
     * Get all orders
     * @param req - Express request
     * @param res - Express response
     * @param next - Express next function
     */
    async getOrders(req, res, next) {
        try {
            const status = req.query.status || 'open';
            const limit = parseInt(req.query.limit) || 50;
            const orders = await this.alpacaClient.getOrders(status, limit);
            res.json(orders);
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            const serverError = (0, errors_1.createServerError)(errorMessage || 'Failed to get orders');
            next(serverError);
        }
    }
    /**
     * Get a specific order
     * @param req - Express request
     * @param res - Express response
     * @param next - Express next function
     */
    async getOrder(req, res, next) {
        try {
            const orderId = req.params.orderId;
            const order = await this.alpacaClient.getOrder(orderId);
            res.json(order);
        }
        catch (error) {
            if (error.statusCode === 404) {
                const notFoundError = (0, errors_1.createNotFoundError)(`Order ${req.params.orderId} not found`, 'ORDER_NOT_FOUND');
                next(notFoundError);
            }
            else {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                const serverError = (0, errors_1.createServerError)(errorMessage || 'Failed to get order');
                next(serverError);
            }
        }
    }
    /**
     * Cancel an order
     * @param req - Express request
     * @param res - Express response
     * @param next - Express next function
     */
    async cancelOrder(req, res, next) {
        try {
            const orderId = req.params.orderId;
            const result = await this.alpacaClient.cancelOrder(orderId);
            res.json(result);
        }
        catch (error) {
            if (error.statusCode === 404) {
                const notFoundError = (0, errors_1.createNotFoundError)(`Order ${req.params.orderId} not found`, 'ORDER_NOT_FOUND');
                next(notFoundError);
            }
            else {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                const serverError = (0, errors_1.createServerError)(errorMessage || 'Failed to cancel order');
                next(serverError);
            }
        }
    }
    /**
     * Check if rate limit is exceeded
     * @returns True if rate limit is exceeded
     */
    isRateLimitExceeded() {
        // This would be replaced with actual rate limit tracking
        return false;
    }
    /**
     * Get cooldown remaining for a symbol
     * @param symbol - Stock symbol
     * @returns Cooldown remaining in milliseconds
     */
    getCooldownRemaining(symbol) {
        const cooldownUntil = this.orderCooldowns.get(symbol) || 0;
        const now = Date.now();
        return Math.max(0, cooldownUntil - now);
    }
    /**
     * Set order cooldown for a symbol
     * @param symbol - Stock symbol
     */
    setOrderCooldown(symbol) {
        const cooldownMs = this.config.orderRules.cooldownMs;
        const cooldownUntil = Date.now() + cooldownMs;
        this.orderCooldowns.set(symbol, cooldownUntil);
    }
    /**
     * Check for duplicate order
     * @param orderRequest - Order request
     * @returns Order ID of duplicate order or null
     */
    checkForDuplicateOrder(orderRequest) {
        const orderKey = this.getOrderKey(orderRequest);
        const recentOrderIds = this.recentOrders.get(orderKey) || new Set();
        if (recentOrderIds.size > 0) {
            return Array.from(recentOrderIds)[0];
        }
        return null;
    }
    /**
     * Add recent order
     * @param orderRequest - Order request
     */
    addRecentOrder(orderRequest) {
        const orderKey = this.getOrderKey(orderRequest);
        const duplicateWindowMs = this.config.orderRules.duplicateWindowMs;
        // Create or get the set of recent order IDs for this key
        if (!this.recentOrders.has(orderKey)) {
            this.recentOrders.set(orderKey, new Set());
        }
        const recentOrderIds = this.recentOrders.get(orderKey);
        // Safety check - this should never happen due to the check above, but TypeScript needs it
        if (!recentOrderIds) {
            return;
        }
        // Add the order ID (using a placeholder since we don't have the actual ID yet)
        const placeholderId = `order_${Date.now()}`;
        recentOrderIds.add(placeholderId);
        // Set a timeout to remove the order ID after the duplicate window
        setTimeout(() => {
            // Get the current set, which might have changed
            const currentSet = this.recentOrders.get(orderKey);
            if (currentSet) {
                currentSet.delete(placeholderId);
                // Clean up empty sets
                if (currentSet.size === 0) {
                    this.recentOrders.delete(orderKey);
                }
            }
        }, duplicateWindowMs);
    }
    /**
     * Get order key for duplicate detection
     * @param orderRequest - Order request
     * @returns Order key
     */
    getOrderKey(orderRequest) {
        return `${orderRequest.symbol}_${orderRequest.side}_${orderRequest.orderType}_${orderRequest.qty}`;
    }
    /**
     * Get the router instance
     * @returns Express router
     */
    getRouter() {
        return this.router;
    }
}
exports.OrderController = OrderController;
