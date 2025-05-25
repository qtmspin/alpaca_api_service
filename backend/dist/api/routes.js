"use strict";
/**
 * routes.ts
 *
 * This file sets up all API routes for the Alpaca API Service.
 * Location: backend/src/api/routes.ts
 *
 * Responsibilities:
 * - Configure Express routes for all API endpoints
 * - Connect controllers to routes
 * - Set up middleware for routes
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupApiRoutes = setupApiRoutes;
const express_1 = __importDefault(require("express"));
const config_controller_1 = require("./config-controller");
const account_controller_1 = require("./account-controller");
const order_controller_1 = require("./order-controller");
const position_controller_1 = require("./position-controller");
const market_data_controller_1 = require("./market-data-controller");
const artificial_orders_controller_1 = require("./artificial-orders-controller");
/**
 * Set up all API routes
 * @param app - Express application
 * @param configManager - Configuration manager instance
 * @param alpacaClient - Alpaca client instance
 * @param orderManager - Artificial order manager instance
 */
function setupApiRoutes(app, configManager, alpacaClient, orderManager) {
    // Get current configuration
    const config = configManager.getConfig();
    // Create controllers
    const configController = new config_controller_1.ConfigController(configManager);
    const accountController = new account_controller_1.AccountController(alpacaClient);
    const orderController = new order_controller_1.OrderController(alpacaClient, config.runtime);
    const positionController = new position_controller_1.PositionController(alpacaClient);
    const marketDataController = new market_data_controller_1.MarketDataController(alpacaClient);
    const artificialOrdersController = new artificial_orders_controller_1.ArtificialOrdersController(orderManager, config.runtime, alpacaClient);
    // Set up API routes
    app.use('/api/config', configController.getRouter());
    app.use('/api/account', accountController.getRouter());
    app.use('/api/orders', orderController.getRouter());
    app.use('/api/positions', positionController.getRouter());
    app.use('/api/market', marketDataController.getRouter());
    app.use('/api/artificial-orders', artificialOrdersController.getRouter());
    // Health check endpoint
    app.get('/api/health', (req, res) => {
        res.json({
            status: 'healthy',
            timestamp: new Date().toISOString()
        });
    });
    // API documentation endpoint
    app.get('/api/docs', (req, res) => {
        res.redirect('/docs/api-endpoint-management.md');
    });
    // Serve static documentation files
    app.use('/docs', express_1.default.static('docs'));
    // Error handling middleware
    app.use((err, req, res, next) => {
        console.error('API Error:', err);
        // Default error response
        const statusCode = err.statusCode || 500;
        const errorResponse = {
            code: err.code || 'SERVER_ERROR',
            message: err.message || 'An unexpected error occurred'
        };
        // Add validation fields if available
        if (err.fields) {
            errorResponse.fields = err.fields;
        }
        res.status(statusCode).json(errorResponse);
    });
}
