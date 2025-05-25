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

import { Router, Request, Response, NextFunction } from 'express';
import { ApiError } from '../core/errors';
import { ArtificialOrderManager, ArtificialOrderRequestSchema, canExecuteArtificialOrder } from '../core';
import { z } from 'zod';

/**
 * ArtificialOrdersController class
 * 
 * Handles API endpoints for managing artificial orders during pre-market and post-market hours.
 */
export class ArtificialOrdersController {
  private router: Router;
  private orderManager: ArtificialOrderManager;
  private runtimeConfig: any;
  private alpacaClient: any;
  
  /**
   * Constructor for ArtificialOrdersController
   * @param orderManager - The artificial order manager instance
   * @param runtimeConfig - The runtime configuration
   * @param alpacaClient - The Alpaca API client
   */
  constructor(
    orderManager: ArtificialOrderManager,
    runtimeConfig: any,
    alpacaClient: any
  ) {
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
  private setupRoutes(): void {
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
  private setupOrderMonitoring(): void {
    // Start monitoring prices and executing orders when triggered
    this.orderManager.startMonitoring(
      // Price provider function
      async (symbol: string) => {
        const quote = await this.alpacaClient.getQuote(symbol);
        return quote.latestPrice;
      },
      // Order executor function
      async (order) => {
        // Create a real order when the artificial order is triggered
        const orderParams = {
          symbol: order.symbol,
          qty: order.qty,
          side: order.side,
          type: order.limitPrice ? 'limit' : 'market',
          time_in_force: order.timeInForce,
          limit_price: order.limitPrice,
        };
        
        const executedOrder = await this.alpacaClient.createOrder(orderParams);
        return executedOrder.id;
      }
    );
  }
  
  /**
   * Create a new artificial order
   * @param req - Express request
   * @param res - Express response
   * @param next - Express next function
   */
  private async createArtificialOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orderRequest = req.body;
      
      // Validate the order request
      const validationResult = ArtificialOrderRequestSchema.safeParse(orderRequest);
      if (!validationResult.success) {
        const validationError = new Error(`Invalid order request: ${validationResult.error.message}`) as ApiError;
        validationError.statusCode = 400;
        validationError.code = 'VALIDATION_ERROR';
        
        next(validationError);
        return;
      }
      
      // Check if artificial orders can be executed based on market hours
      if (!canExecuteArtificialOrder(this.runtimeConfig)) {
        const marketClosedError = new Error('Artificial orders can only be created during enabled market hours') as ApiError;
        marketClosedError.statusCode = 400;
        marketClosedError.code = 'MARKET_CLOSED';
        
        next(marketClosedError);
        return;
      }
      
      // Create the artificial order
      const order = this.orderManager.createOrder(validationResult.data);
      
      res.status(201).json(order);
    } catch (error: unknown) {
      if (error instanceof z.ZodError) {
        // Handle validation errors
        const fieldErrors = error.errors.reduce<Record<string, string>>((acc, err) => {
          acc[err.path.join('.')] = err.message;
          return acc;
        }, {});
        
        const validationError = new Error('Invalid order request') as ApiError;
        validationError.statusCode = 400;
        validationError.code = 'VALIDATION_ERROR';
        validationError.fields = fieldErrors;
        
        next(validationError);
      } else {
        // Handle other errors
        console.error('Error creating artificial order:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const serverError = new Error(`Failed to create artificial order: ${errorMessage}`) as ApiError;
        serverError.statusCode = 500;
        serverError.code = 'SERVER_ERROR';
        
        next(serverError);
      }
    }
  }
  
  /**
   * Get all artificial orders
   * @param req - Express request
   * @param res - Express response
   */
  private getOrders(req: Request, res: Response): void {
    try {
      // Get status filter from query params
      const status = req.query.status as string | undefined;
      
      // Get orders with optional status filter
      const orders = this.orderManager.getOrders(status as any);
      
      res.json(orders);
    } catch (error) {
      console.error('Error getting artificial orders:', error);
      res.status(500).json({
        code: 'SERVER_ERROR',
        message: 'Failed to get artificial orders'
      });
    }
  }
  
  /**
   * Get a specific artificial order
   * @param req - Express request
   * @param res - Express response
   */
  private getOrder(req: Request, res: Response): void {
    try {
      const orderId = req.params.id;
      const order = this.orderManager.getOrder(orderId);
      
      if (!order) {
        res.status(404).json({
          code: 'ORDER_NOT_FOUND',
          message: `Artificial order ${orderId} not found`
        });
        return;
      }
      
      res.json(order);
    } catch (error) {
      console.error('Error getting artificial order:', error);
      res.status(500).json({
        code: 'SERVER_ERROR',
        message: 'Failed to get artificial order'
      });
    }
  }
  
  /**
   * Cancel an artificial order
   * @param req - Express request
   * @param res - Express response
   */
  private cancelOrder(req: Request, res: Response): void {
    try {
      const orderId = req.params.id;
      const order = this.orderManager.cancelOrder(orderId);
      
      if (!order) {
        res.status(404).json({
          code: 'ORDER_NOT_FOUND',
          message: `Artificial order ${orderId} not found`
        });
        return;
      }
      
      if (order.status !== 'canceled') {
        res.status(400).json({
          code: 'CANNOT_CANCEL',
          message: `Order ${orderId} is already ${order.status} and cannot be canceled`
        });
        return;
      }
      
      res.json(order);
    } catch (error) {
      console.error('Error canceling artificial order:', error);
      res.status(500).json({
        code: 'SERVER_ERROR',
        message: 'Failed to cancel artificial order'
      });
    }
  }
  
  /**
   * Get the router instance
   * @returns Express router
   */
  public getRouter(): Router {
    return this.router;
  }
}
