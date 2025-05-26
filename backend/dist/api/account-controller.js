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
import { Router } from 'express';
import { ApplicationError } from '../core/errors.js';
/**
 * AccountController class
 *
 * Handles API endpoints for account management.
 */
export class AccountController {
    /**
     * Constructor for AccountController
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
            const serverError = new ApplicationError('SERVER_ERROR', errorMessage || 'Failed to get account information');
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
