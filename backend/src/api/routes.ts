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

import express, { Express } from 'express';
import { ConfigController } from './config-controller.js';
import { AccountController } from './account-controller.js';
import { OrderController } from './order-controller.js';
import { PositionController } from './position-controller.js';
import { MarketDataController } from './market-data-controller.js';
import { ArtificialOrdersController } from './artificial-orders-controller.js';
import { AlpacaRestController } from './alpaca-rest-controller.js';
import { ConfigManager, ArtificialOrderManager } from '../core/index.js';
import { AlpacaClient } from '../services/alpaca-client.js';

/**
 * Set up all API routes
 * @param app - Express application
 * @param configManager - Configuration manager instance
 * @param alpacaClient - Alpaca client instance
 * @param orderManager - Artificial order manager instance
 */
export function setupApiRoutes(
  app: Express,
  configManager: ConfigManager,
  alpacaClient: any,
  orderManager: ArtificialOrderManager
): void {
  // Get current configuration
  const config = configManager.getConfig();
  
  // Create controllers
  const configController = new ConfigController(configManager);
  const accountController = new AccountController(alpacaClient);
  const orderController = new OrderController(alpacaClient, config.runtime);
  const positionController = new PositionController(alpacaClient);
  const marketDataController = new MarketDataController(alpacaClient);
  const artificialOrdersController = new ArtificialOrdersController(
    orderManager,
    config.runtime,
    alpacaClient
  );
  const alpacaController = new AlpacaRestController(alpacaClient);
  
  // Set up API routes
  app.use('/api/alpaca', alpacaController.getRouter());
  app.use('/api/config', configController.getRouter());
  app.use('/api/account', accountController.getRouter());
  app.use('/api/orders', orderController.getRouter());
  app.use('/api/positions', positionController.getRouter());
  app.use('/api/market', marketDataController.getRouter());
  app.use('/api/artificial-orders', artificialOrdersController.getRouter());
  
  // Health check endpoint
  app.get('/api/health', (req: express.Request, res: express.Response) => {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString()
    });
  });
  
  // API documentation endpoint
  app.get('/api/docs', (req: express.Request, res: express.Response) => {
    res.redirect('/docs/api-endpoint-management.md');
  });
  
  // Serve static documentation files
  app.use('/docs', express.static('docs'));
  
  // Error handling middleware
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('API Error:', err);
    
    // Default error response
    const statusCode = err.statusCode || 500;
    const errorResponse: any = {
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
