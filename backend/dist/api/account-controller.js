"use strict";
/**
 * account-controller.ts
 *
 * This file contains the API controller for account management.
 * Location: backend/src/api/account-controller.ts
 *
 * Responsibilities:
 * - Handle API endpoints for account information
 * - Get account details and balance information
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AccountController = void 0;
const express_1 = require("express");
/**
 * AccountController class
 *
 * Handles API endpoints for account management.
 */
class AccountController {
    /**
     * Constructor for AccountController
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
        // Get account information
        this.router.get('/', this.getAccount.bind(this));
    }
    /**
     * Get account information
     * @param req - Express request
     * @param res - Express response
     * @param next - Express next function
     */
    async getAccount(req, res, next) {
        try {
            const account = await this.alpacaClient.getAccount();
            res.json(account);
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            const serverError = new Error(errorMessage || 'Failed to get account information');
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
exports.AccountController = AccountController;
