/**
 * artificial-orders-controller.ts
 *
 * This file contains the API controller for managing artificial orders.
 * Location: backend/src/api/artificial-orders-controller.ts
 *
 * Responsibilities:
 * - Handle API endpoints for artificial orders
 * - Create, cancel, and retrieve artificial orders
 * - Validate request payloads using Zod schemas
 */
import { Router } from 'express';
import { ApplicationError, ErrorCodes } from '../core/errors.js';
import { ArtificialOrderRequestSchema } from '../core/index.js';
import { z } from 'zod';
/**
 * ArtificialOrdersController class
 *
 * Handles API endpoints for managing artificial orders during pre-market and post-market hours.
 */
export class ArtificialOrdersController {
    /**
     * Constructor for ArtificialOrdersController
     * @param orderManager - The artificial order manager instance
     * @param runtimeConfig - The runtime configuration
     * @param alpacaClient - The Alpaca API client
     */
    constructor(orderManager, runtimeConfig, alpacaClient) {
        this.router = Router();
        this.orderManager = orderManager;
        this.runtimeConfig = runtimeConfig;
        this.alpacaClient = alpacaClient;
        this.setupRoutes();
        this.setupOrderMonitoring();
    }
    /**
     * Set up API routes
     */
    setupRoutes() {
        // Create a new artificial order
        this.router.post('/', this.createArtificialOrder.bind(this));
        // Get all artificial orders
        this.router.get('/', this.getOrders.bind(this));
        // Get a specific artificial order
        this.router.get('/:id', this.getOrder.bind(this));
        // Cancel an artificial order
        this.router.delete('/:id', this.cancelOrder.bind(this));
    }
    /**
     * Set up order monitoring
     */
    setupOrderMonitoring() {
        // Start monitoring for order triggers
        this.orderManager.startMonitoring();
        // Set up event listener for triggered orders
        this.orderManager.on('orderTriggered', async (order, marketData) => {
            try {
                // Create a real order when the artificial order is triggered
                const orderParams = {
                    symbol: order.symbol,
                    qty: order.qty,
                    side: order.side,
                    type: order.limit_price ? 'limit' : 'market',
                    time_in_force: order.time_in_force,
                    limit_price: order.limit_price,
                };
                const executedOrder = await this.alpacaClient.createOrder(orderParams);
                console.log(`Artificial order ${order.id} executed with real order ID: ${executedOrder.id}`);
            }
            catch (error) {
                console.error(`Failed to execute artificial order ${order.id}:`, error);
            }
        });
    }
    /**
     * Create a new artificial order
     * @param req - Express request
     * @param res - Express response
     * @param next - Express next function
     */
    async createArtificialOrder(req, res, next) {
        try {
            const orderRequest = req.body;
            // Validate the order request
            const validationResult = ArtificialOrderRequestSchema.safeParse(orderRequest);
            if (!validationResult.success) {
                const validationError = new ApplicationError(ErrorCodes.VALIDATION_ERROR, `Invalid order request: ${validationResult.error.message}`);
                next(validationError);
                return;
            }
            // Check if we're in valid market hours for artificial orders
            const isPreMarket = this.runtimeConfig?.marketHours?.allowPreMarket;
            const isPostMarket = this.runtimeConfig?.marketHours?.allowPostMarket;
            const isRegularHours = this.runtimeConfig?.marketHours?.allowRegularHours;
            // If no specific configuration, default to allowing artificial orders
            const allowArtificialOrders = isPreMarket || isPostMarket || isRegularHours || true;
            if (!allowArtificialOrders) {
                const marketClosedError = new ApplicationError(ErrorCodes.MARKET_CLOSED, 'Artificial orders can only be created during enabled market hours');
                next(marketClosedError);
                return;
            }
            // Create the artificial order
            const order = this.orderManager.createOrder(validationResult.data);
            res.status(201).json(order);
        }
        catch (error) {
            if (error instanceof z.ZodError) {
                // Handle validation errors
                const fieldErrors = error.errors.reduce((acc, err) => {
                    acc[err.path.join('.')] = err.message;
                    return acc;
                }, {});
                const validationError = new ApplicationError(ErrorCodes.VALIDATION_ERROR, 'Invalid order request', { fields: fieldErrors });
                next(validationError);
            }
            else {
                // Handle other errors
                console.error('Error creating artificial order:', error);
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                const serverError = new ApplicationError(ErrorCodes.INTERNAL_ERROR, `Failed to create artificial order: ${errorMessage}`);
                next(serverError);
            }
        }
    }
    /**
     * Get all artificial orders
     * @param req - Express request
     * @param res - Express response
     */
    getOrders(req, res) {
        try {
            // Get status filter from query params
            const status = req.query.status;
            // Get orders with optional status filter
            const orders = status ?
                this.orderManager.getOrdersByStatus(status) :
                this.orderManager.getAllOrders();
            res.json(orders);
        }
        catch (error) {
            console.error('Error getting artificial orders:', error);
            res.status(500).json({
                code: ErrorCodes.INTERNAL_ERROR,
                message: 'Failed to get artificial orders'
            });
        }
    }
    /**
     * Get a specific artificial order
     * @param req - Express request
     * @param res - Express response
     */
    getOrder(req, res) {
        try {
            const orderId = req.params.id;
            const order = this.orderManager.getOrder(orderId);
            if (!order) {
                res.status(404).json({
                    code: ErrorCodes.ORDER_NOT_FOUND,
                    message: `Artificial order ${orderId} not found`
                });
                return;
            }
            res.json(order);
        }
        catch (error) {
            console.error('Error getting artificial order:', error);
            res.status(500).json({
                code: ErrorCodes.INTERNAL_ERROR,
                message: 'Failed to get artificial order'
            });
        }
    }
    /**
     * Cancel an artificial order
     * @param req - Express request
     * @param res - Express response
     */
    cancelOrder(req, res) {
        try {
            const orderId = req.params.id;
            const success = this.orderManager.cancelOrder(orderId);
            if (!success) {
                // Get the order to check if it exists or just couldn't be canceled
                const order = this.orderManager.getOrder(orderId);
                if (!order) {
                    res.status(404).json({
                        code: ErrorCodes.ORDER_NOT_FOUND,
                        message: `Artificial order ${orderId} not found`
                    });
                    return;
                }
                res.status(400).json({
                    code: ErrorCodes.ORDER_ALREADY_FILLED,
                    message: `Order ${orderId} is already ${order.status} and cannot be canceled`
                });
                return;
            }
            // Get the updated order after cancellation
            const updatedOrder = this.orderManager.getOrder(orderId);
            res.json(updatedOrder);
        }
        catch (error) {
            console.error('Error canceling artificial order:', error);
            res.status(500).json({
                code: ErrorCodes.INTERNAL_ERROR,
                message: 'Failed to cancel artificial order'
            });
        }
    }
    /**
     * Get the router instance
     * @returns Express router
     */
    getRouter() {
        return this.router;
    }
}
