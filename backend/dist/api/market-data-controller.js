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
import { Router } from 'express';
import { ApplicationError } from '../core/errors.js';
/**
 * MarketDataController class
 *
 * Handles API endpoints for market data.
 */
export class MarketDataController {
    /**
     * Constructor for MarketDataController
     * @param alpacaClient - Alpaca client instance
     */
    constructor(alpacaClient) {
        this.alpacaClient = alpacaClient;
        this.router = Router();
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
            const serverError = new ApplicationError('SERVER_ERROR', errorMessage || `Failed to get quote for ${req.params.symbol}`);
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
                const validationError = new ApplicationError('INVALID_TIMEFRAME', `Invalid timeframe: ${timeframe}. Valid values are: ${validTimeframes.join(', ')}`);
                next(validationError);
                return;
            }
            const bars = await this.alpacaClient.getBars(symbol, timeframe, start, end, limit);
            res.json(bars);
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            const serverError = new ApplicationError('SERVER_ERROR', errorMessage || `Failed to get bars for ${req.params.symbol}`);
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
