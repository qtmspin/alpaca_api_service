/**
 * config-controller.ts
 * 
 * This file contains the API controller for managing service configuration.
 * Location: backend/src/api/config-controller.ts
 * 
 * Responsibilities:
 * - Handle API endpoints for configuration management
 * - Get and update service configuration
 * - Validate configuration changes
 */

import { Router, Request, Response, NextFunction } from 'express';
import { ApiError } from '../core/errors';
import { ConfigManager, ConfigUpdateSchema } from '../core';
import { z } from 'zod';

/**
 * ConfigController class
 * 
 * Handles API endpoints for managing service configuration.
 */
export class ConfigController {
  private router: Router;
  
  /**
   * Constructor for ConfigController
   * @param configManager - Configuration manager instance
   */
  constructor(private configManager: ConfigManager) {
    this.router = Router();
    this.setupRoutes();
  }
  
  /**
   * Set up API routes
   */
  private setupRoutes(): void {
    // Get current configuration
    this.router.get('/', this.getConfig.bind(this));
    
    // Update configuration
    this.router.put('/', this.updateConfig.bind(this));
    
    // Get rate limits
    this.router.get('/limits', this.getRateLimits.bind(this));
  }
  
  /**
   * Get current configuration
   * @param req - Express request
   * @param res - Express response
   */
  private getConfig(req: Request, res: Response): void {
    const config = this.configManager.getConfig();
    res.json(config);
  }
  
  /**
   * Update configuration
   * @param req - Express request
   * @param res - Express response
   * @param next - Express next function
   */
  private async updateConfig(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Validate request body against schema
      const updates = ConfigUpdateSchema.parse(req.body);
      
      // Update configuration
      const updatedConfig = await this.configManager.updateRuntimeConfig(updates);
      
      res.json(updatedConfig);
    } catch (error: unknown) {
      if (error instanceof z.ZodError) {
        // Handle validation errors
        const fieldErrors = error.errors.reduce<Record<string, string>>((acc, err) => {
          acc[err.path.join('.')] = err.message;
          return acc;
        }, {});
        
        const validationError = new Error('Validation failed') as ApiError;
        validationError.statusCode = 400;
        validationError.code = 'INVALID_CONFIG';
        validationError.fields = fieldErrors;
        
        next(validationError);
      } else {
        // Handle other errors
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const serverError = new Error(errorMessage || 'Failed to update configuration') as ApiError;
        serverError.statusCode = 500;
        serverError.code = 'SERVER_ERROR';
        
        next(serverError);
      }
    }
  }
  
  /**
   * Get rate limits
   * @param req - Express request
   * @param res - Express response
   */
  private getRateLimits(req: Request, res: Response): void {
    const config = this.configManager.getConfig();
    
    // Calculate remaining rate limits (this would be replaced with actual rate limit tracking)
    const now = new Date();
    const resetAt = new Date(now.getTime() + 60000).toISOString(); // 1 minute from now
    
    const rateLimits = {
      orders: {
        limit: config.runtime.rateLimits.orders,
        remaining: Math.floor(config.runtime.rateLimits.orders * 0.9), // Example value
        resetAt,
        windowMs: 60000
      },
      data: {
        limit: config.runtime.rateLimits.data,
        remaining: Math.floor(config.runtime.rateLimits.data * 0.95), // Example value
        resetAt,
        windowMs: 60000
      }
    };
    
    res.json(rateLimits);
  }
  
  /**
   * Get the router instance
   * @returns Express router
   */
  public getRouter(): Router {
    return this.router;
  }
}
