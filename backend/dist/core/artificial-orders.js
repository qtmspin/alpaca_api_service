"use strict";
/**
 * artificial-orders.ts
 *
 * This file contains the implementation for handling artificial stop and stop-limit orders
 * during pre-market and post-market hours when these order types aren't supported by the exchange.
 * Location: backend/src/core/artificial-orders.ts
 *
 * Responsibilities:
 * - Store and manage artificial orders
 * - Monitor prices and execute orders when trigger conditions are met
 * - Provide methods to create, cancel, and query artificial orders
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ArtificialOrderManager = void 0;
const uuid_1 = require("uuid");
const schemas_1 = require("./schemas");
/**
 * ArtificialOrderManager class
 *
 * Manages artificial stop and stop-limit orders during pre-market and post-market hours.
 * Monitors prices and executes orders when trigger conditions are met.
 */
class ArtificialOrderManager {
    /**
     * Constructor for ArtificialOrderManager
     * @param intervalMs - Interval in milliseconds for price checking (default: 1000ms)
     */
    constructor(intervalMs = 1000) {
        this.orders = new Map();
        this.priceMonitorInterval = null;
        this.intervalMs = intervalMs;
    }
    /**
     * Start the price monitoring service
     * @param priceProvider - Function that returns the latest price for a symbol
     * @param orderExecutor - Function that executes an order when triggered
     */
    startMonitoring(priceProvider, orderExecutor) {
        if (this.priceMonitorInterval) {
            clearInterval(this.priceMonitorInterval);
        }
        this.priceMonitorInterval = setInterval(async () => {
            const pendingOrders = Array.from(this.orders.values())
                .filter(order => order.status === 'pending');
            if (pendingOrders.length === 0)
                return;
            // Group orders by symbol to minimize API calls
            const symbolGroups = pendingOrders.reduce((groups, order) => {
                if (!groups[order.symbol]) {
                    groups[order.symbol] = [];
                }
                groups[order.symbol].push(order);
                return groups;
            }, {});
            // Check each symbol's price once and evaluate all orders for that symbol
            for (const [symbol, orders] of Object.entries(symbolGroups)) {
                try {
                    const currentPrice = await priceProvider(symbol);
                    for (const order of orders) {
                        if (this.shouldTriggerOrder(order, currentPrice)) {
                            order.status = 'triggered';
                            order.updatedAt = new Date().toISOString();
                            try {
                                const executedOrderId = await orderExecutor(order);
                                order.status = 'filled';
                                order.executedOrderId = executedOrderId;
                                order.updatedAt = new Date().toISOString();
                                this.orders.set(order.id, order);
                            }
                            catch (error) {
                                console.error(`Failed to execute artificial order ${order.id}:`, error);
                                // Reset to pending if execution fails, will retry on next interval
                                order.status = 'pending';
                                order.updatedAt = new Date().toISOString();
                                this.orders.set(order.id, order);
                            }
                        }
                    }
                }
                catch (error) {
                    console.error(`Failed to get price for ${symbol}:`, error);
                }
            }
        }, this.intervalMs);
    }
    /**
     * Stop the price monitoring service
     */
    stopMonitoring() {
        if (this.priceMonitorInterval) {
            clearInterval(this.priceMonitorInterval);
            this.priceMonitorInterval = null;
        }
    }
    /**
     * Create a new artificial order
     * @param orderRequest - The artificial order request
     * @returns The created artificial order
     */
    createOrder(orderRequest) {
        const now = new Date().toISOString();
        const isStopLimit = !!orderRequest.limitPrice;
        const order = {
            ...orderRequest,
            id: (0, uuid_1.v4)(),
            status: 'pending',
            createdAt: now,
            updatedAt: now,
            isStopLimit
        };
        this.orders.set(order.id, order);
        return order;
    }
    /**
     * Cancel an artificial order
     * @param orderId - The ID of the order to cancel
     * @returns The canceled order or null if not found
     */
    cancelOrder(orderId) {
        const order = this.orders.get(orderId);
        if (order && order.status === 'pending') {
            order.status = 'canceled';
            order.updatedAt = new Date().toISOString();
            this.orders.set(orderId, order);
            return order;
        }
        return order || null;
    }
    /**
     * Get all artificial orders
     * @param status - Optional filter by status
     * @returns Array of artificial orders
     */
    getOrders(status) {
        const orders = Array.from(this.orders.values());
        if (status) {
            return orders.filter(order => order.status === status);
        }
        return orders;
    }
    /**
     * Get a specific artificial order by ID
     * @param orderId - The ID of the order to retrieve
     * @returns The order or null if not found
     */
    getOrder(orderId) {
        return this.orders.get(orderId) || null;
    }
    /**
     * Determine if an order should be triggered based on current price
     * @param order - The artificial order to check
     * @param currentPrice - The current price of the symbol
     * @returns True if the order should be triggered
     */
    shouldTriggerOrder(order, currentPrice) {
        if (order.side === 'buy') {
            // For buy stop orders, trigger when price rises above trigger price
            return currentPrice >= order.triggerPrice;
        }
        else {
            // For sell stop orders, trigger when price falls below trigger price
            return currentPrice <= order.triggerPrice;
        }
    }
    /**
     * Check if artificial orders should be used based on market hours
     * @returns True if artificial orders should be used
     */
    static shouldUseArtificialOrders() {
        const now = new Date();
        return (0, schemas_1.isPreMarketHours)(now) || (0, schemas_1.isPostMarketHours)(now);
    }
    /**
     * Clean up expired orders (for day orders)
     */
    cleanupExpiredOrders() {
        const now = new Date();
        const isMarketOpen = !(0, schemas_1.isPreMarketHours)(now) && !(0, schemas_1.isPostMarketHours)(now);
        // Only expire day orders when market is closed for the day
        if (!isMarketOpen)
            return;
        for (const order of this.orders.values()) {
            if (order.status === 'pending' && order.timeInForce === 'day') {
                // Check if the order was created on a previous day
                const orderDate = new Date(order.createdAt).setHours(0, 0, 0, 0);
                const today = now.setHours(0, 0, 0, 0);
                if (orderDate < today) {
                    order.status = 'expired';
                    order.updatedAt = now.toISOString();
                    this.orders.set(order.id, order);
                }
            }
        }
    }
}
exports.ArtificialOrderManager = ArtificialOrderManager;
