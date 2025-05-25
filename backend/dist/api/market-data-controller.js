"use strict";
/**
 * market-data-controller.ts
 *
 * This file contains the API controller for market data.
 * Location: backend/src/api/market-data-controller.ts
 *
 * Responsibilities:
 * - Handle API endpoints for market data
 * - Get quotes and historical bars
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MarketDataController = void 0;
const express_1 = require("express");
/**
 * MarketDataController class
 *
 * Handles API endpoints for market data.
 */
class MarketDataController {
    /**
     * Constructor for MarketDataController
     * @param alpacaClient - Alpaca client instance
     */
    constructor(alpacaClient) {
        this.alpacaClient = alpacaClient;
        this.router = (0, express_1.Router)();
        this.setupRoutes();
    }
    /**
     * Set up API routes
     */
    setupRoutes() {
        // Get quote for a symbol
        this.router.get('/:symbol/quote', this.getQuote.bind(this));
        // Get historical bars for a symbol
        this.router.get('/:symbol/bars/:timeframe', this.getBars.bind(this));
    }
    /**
     * Get quote for a symbol
     * @param req - Express request
     * @param res - Express response
     * @param next - Express next function
     */
    async getQuote(req, res, next) {
        try {
            const symbol = req.params.symbol.toUpperCase();
            const quote = await this.alpacaClient.getQuote(symbol);
            res.json(quote);
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            const serverError = new Error(errorMessage || `Failed to get quote for ${req.params.symbol}`);
            serverError.statusCode = 500;
            serverError.code = 'SERVER_ERROR';
            next(serverError);
        }
    }
    /**
     * Get historical bars for a symbol
     * @param req - Express request
     * @param res - Express response
     * @param next - Express next function
     */
    async getBars(req, res, next) {
        try {
            const symbol = req.params.symbol.toUpperCase();
            const timeframe = req.params.timeframe;
            // Parse query parameters
            const start = req.query.start ? new Date(req.query.start) : undefined;
            const end = req.query.end ? new Date(req.query.end) : undefined;
            const limit = req.query.limit ? parseInt(req.query.limit) : undefined;
            // Validate timeframe
            const validTimeframes = ['1Min', '5Min', '15Min', '1H', '1D'];
            if (!validTimeframes.includes(timeframe)) {
                const validationError = new Error(`Invalid timeframe: ${timeframe}. Valid values are: ${validTimeframes.join(', ')}`);
                validationError.statusCode = 400;
                validationError.code = 'INVALID_TIMEFRAME';
                next(validationError);
                return;
            }
            const bars = await this.alpacaClient.getBars(symbol, timeframe, start, end, limit);
            res.json(bars);
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            const serverError = new Error(errorMessage || `Failed to get bars for ${req.params.symbol}`);
            serverError.statusCode = 500;
            serverError.code = 'SERVER_ERROR';
            next(serverError);
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
exports.MarketDataController = MarketDataController;
