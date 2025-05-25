"use strict";
/**
 * position-controller.ts
 *
 * This file contains the API controller for position management.
 * Location: backend/src/api/position-controller.ts
 *
 * Responsibilities:
 * - Handle API endpoints for position information
 * - Get all positions and specific position details
 * - Close positions
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PositionController = void 0;
const express_1 = require("express");
/**
 * PositionController class
 *
 * Handles API endpoints for position management.
 */
class PositionController {
    /**
     * Constructor for PositionController
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
        // Get all positions
        this.router.get('/', this.getPositions.bind(this));
        // Get position for a specific symbol
        this.router.get('/:symbol', this.getPosition.bind(this));
        // Close position for a specific symbol
        this.router.delete('/:symbol', this.closePosition.bind(this));
    }
    /**
     * Get all positions
     * @param req - Express request
     * @param res - Express response
     * @param next - Express next function
     */
    async getPositions(req, res, next) {
        try {
            const positions = await this.alpacaClient.getPositions();
            res.json(positions);
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            const serverError = new Error(errorMessage || 'Failed to get positions');
            serverError.statusCode = 500;
            serverError.code = 'SERVER_ERROR';
            next(serverError);
        }
    }
    /**
     * Get position for a specific symbol
     * @param req - Express request
     * @param res - Express response
     * @param next - Express next function
     */
    async getPosition(req, res, next) {
        try {
            const symbol = req.params.symbol.toUpperCase();
            const position = await this.alpacaClient.getPosition(symbol);
            if (!position) {
                const notFoundError = new Error(`Position not found for symbol: ${symbol}`);
                notFoundError.statusCode = 404;
                notFoundError.code = 'POSITION_NOT_FOUND';
                next(notFoundError);
                return;
            }
            res.json(position);
        }
        catch (error) {
            // Check if it's a 404 error from Alpaca
            if (error?.statusCode === 404 ||
                (error?.response && error.response.statusCode === 404)) {
                const notFoundError = new Error(`Position not found for symbol: ${req.params.symbol}`);
                notFoundError.statusCode = 404;
                notFoundError.code = 'POSITION_NOT_FOUND';
                next(notFoundError);
                return;
            }
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            const serverError = new Error(errorMessage || `Failed to get position for ${req.params.symbol}`);
            serverError.statusCode = 500;
            serverError.code = 'SERVER_ERROR';
            next(serverError);
        }
    }
    /**
     * Close position for a specific symbol
     * @param req - Express request
     * @param res - Express response
     * @param next - Express next function
     */
    async closePosition(req, res, next) {
        try {
            const symbol = req.params.symbol.toUpperCase();
            const result = await this.alpacaClient.closePosition(symbol);
            res.json(result);
        }
        catch (error) {
            // Check if it's a 404 error from Alpaca
            if (error?.statusCode === 404 ||
                (error?.response && error.response.statusCode === 404)) {
                const notFoundError = new Error(`Position not found for symbol: ${req.params.symbol}`);
                notFoundError.statusCode = 404;
                notFoundError.code = 'POSITION_NOT_FOUND';
                next(notFoundError);
                return;
            }
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            const serverError = new Error(errorMessage || `Failed to close position for ${req.params.symbol}`);
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
exports.PositionController = PositionController;
