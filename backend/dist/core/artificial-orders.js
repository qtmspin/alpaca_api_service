/**
 * artificial-orders.ts
 *
 * This file manages artificial orders that are triggered by market conditions.
 * Location: backend/src/core/artificial-orders.ts
 *
 * Responsibilities:
 * - Manage artificial orders that aren't sent to the broker immediately
 * - Monitor market conditions and trigger orders when conditions are met
 * - Provide a system for conditional order execution
 */
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
// Utility function to check if an artificial order can be executed
export function canExecuteArtificialOrder(order, marketData) {
    if (!order.trigger_condition) {
        return true;
    }
    const { field, operator, value } = order.trigger_condition;
    const marketValue = field === 'price' ? marketData.price : (marketData.volume || 0);
    switch (operator) {
        case 'gte':
            return marketValue >= value;
        case 'lte':
            return marketValue <= value;
        case 'eq':
            return marketValue === value;
        default:
            return false;
    }
}
export class ArtificialOrderManager extends EventEmitter {
    constructor(priceCheckIntervalMs = 5000) {
        super();
        this.orders = new Map();
        this.monitoringInterval = null;
        this.priceCheckIntervalMs = priceCheckIntervalMs;
    }
    /**
     * Create a new artificial order
     */
    createOrder(request) {
        // Ensure time_in_force is restricted to 'day' or 'gtc'
        const timeInForce = request.time_in_force === 'day' || request.time_in_force === 'gtc'
            ? request.time_in_force
            : 'day'; // Default to 'day' if an unsupported value is provided
        const order = {
            id: uuidv4(),
            symbol: request.symbol,
            qty: request.qty,
            side: request.side,
            type: request.type,
            limit_price: request.limit_price,
            stop_price: request.stop_price,
            time_in_force: timeInForce, // Use the validated value
            status: 'pending',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            trigger_condition: request.trigger_condition
        };
        this.orders.set(order.id, order);
        // Emit event for order creation
        this.emit('orderCreated', order);
        return order;
    }
    /**
     * Get an artificial order by ID
     */
    getOrder(orderId) {
        return this.orders.get(orderId);
    }
    /**
     * Get all artificial orders
     */
    getAllOrders() {
        return Array.from(this.orders.values());
    }
    /**
     * Get orders by status
     */
    getOrdersByStatus(status) {
        return this.getAllOrders().filter(order => order.status === status);
    }
    /**
     * Get orders by symbol
     */
    getOrdersBySymbol(symbol) {
        return this.getAllOrders().filter(order => order.symbol === symbol);
    }
    /**
     * Update an artificial order
     */
    updateOrder(orderId, updates) {
        const order = this.orders.get(orderId);
        if (!order) {
            return null;
        }
        const updatedOrder = {
            ...order,
            ...updates,
            updated_at: new Date().toISOString()
        };
        this.orders.set(orderId, updatedOrder);
        // Emit event for order update
        this.emit('orderUpdated', updatedOrder, order);
        return updatedOrder;
    }
    /**
     * Cancel an artificial order
     */
    cancelOrder(orderId) {
        const order = this.orders.get(orderId);
        if (!order || order.status !== 'pending') {
            return false;
        }
        const cancelledOrder = this.updateOrder(orderId, { status: 'cancelled' });
        if (cancelledOrder) {
            this.emit('orderCancelled', cancelledOrder);
            return true;
        }
        return false;
    }
    /**
     * Remove an artificial order
     */
    removeOrder(orderId) {
        const order = this.orders.get(orderId);
        if (!order) {
            return false;
        }
        this.orders.delete(orderId);
        this.emit('orderRemoved', order);
        return true;
    }
    /**
     * Check if an order should be triggered based on market data
     */
    checkOrderTrigger(order, marketData) {
        if (!order.trigger_condition) {
            // No trigger condition means order should be executed immediately
            return true;
        }
        const { field, operator, value } = order.trigger_condition;
        const marketValue = field === 'price' ? marketData.price : (marketData.volume || 0);
        switch (operator) {
            case 'gte':
                return marketValue >= value;
            case 'lte':
                return marketValue <= value;
            case 'eq':
                return marketValue === value;
            default:
                return false;
        }
    }
    /**
     * Process market data and trigger orders if conditions are met
     */
    processMarketData(symbol, marketData) {
        const triggeredOrders = [];
        const pendingOrders = this.getOrdersBySymbol(symbol).filter(order => order.status === 'pending');
        for (const order of pendingOrders) {
            if (this.checkOrderTrigger(order, marketData)) {
                const triggeredOrder = this.updateOrder(order.id, { status: 'filled' });
                if (triggeredOrder) {
                    triggeredOrders.push(triggeredOrder);
                    this.emit('orderTriggered', triggeredOrder, marketData);
                }
            }
        }
        return triggeredOrders;
    }
    /**
     * Start monitoring for order triggers
     */
    startMonitoring() {
        if (this.monitoringInterval) {
            return; // Already monitoring
        }
        this.monitoringInterval = setInterval(() => {
            // This would typically fetch market data and check triggers
            // For now, we'll just emit a monitoring event
            this.emit('monitoring', {
                timestamp: new Date().toISOString(),
                pendingOrders: this.getOrdersByStatus('pending').length
            });
        }, this.priceCheckIntervalMs);
        this.emit('monitoringStarted');
    }
    /**
     * Stop monitoring for order triggers
     */
    stopMonitoring() {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
            this.emit('monitoringStopped');
        }
    }
    /**
     * Check if monitoring is active
     */
    isMonitoring() {
        return this.monitoringInterval !== null;
    }
    /**
     * Clean up expired orders
     */
    cleanupExpiredOrders() {
        const now = new Date();
        const expiredOrders = [];
        for (const order of this.orders.values()) {
            if (order.status === 'pending' && order.time_in_force === 'day') {
                // Check if order was created today and market is closed
                const createdAt = new Date(order.created_at);
                const isExpired = now.getDate() !== createdAt.getDate() ||
                    now.getMonth() !== createdAt.getMonth() ||
                    now.getFullYear() !== createdAt.getFullYear();
                if (isExpired) {
                    expiredOrders.push(order);
                }
            }
        }
        // Mark expired orders
        for (const order of expiredOrders) {
            this.updateOrder(order.id, { status: 'expired' });
        }
        return expiredOrders.length;
    }
    /**
     * Get statistics about artificial orders
     */
    getStatistics() {
        const orders = this.getAllOrders();
        const byStatus = {};
        const bySymbol = {};
        for (const order of orders) {
            byStatus[order.status] = (byStatus[order.status] || 0) + 1;
            bySymbol[order.symbol] = (bySymbol[order.symbol] || 0) + 1;
        }
        return {
            total: orders.length,
            byStatus,
            bySymbol
        };
    }
    /**
     * Clear all orders (useful for testing)
     */
    clearAllOrders() {
        this.orders.clear();
        this.emit('allOrdersCleared');
    }
}
