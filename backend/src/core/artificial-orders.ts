/**
 * artificial-orders.ts
 * 
 * This file contains the implementation for handling artificial stop and stop-limit orders
 * during pre-market and post-market hours when these order types aren't supported by the exchange.
 * Location: backend/src/core/artificial-orders.ts
 * 
 * Responsibilities:
 * - Store and manage artificial orders
 * - Monitor prices and execute orders when trigger conditions are met
 * - Provide methods to create, cancel, and query artificial orders
 */

import { v4 as uuidv4 } from 'uuid';
import { ArtificialOrderRequest, isPreMarketHours, isPostMarketHours } from './schemas';

// Artificial order status types
type ArtificialOrderStatus = 'pending' | 'triggered' | 'filled' | 'canceled' | 'expired';

// Artificial order data structure
export interface ArtificialOrder extends ArtificialOrderRequest {
  id: string;
  status: ArtificialOrderStatus;
  createdAt: string;
  updatedAt: string;
  executedOrderId?: string;
  isStopLimit: boolean;
}

/**
 * ArtificialOrderManager class
 * 
 * Manages artificial stop and stop-limit orders during pre-market and post-market hours.
 * Monitors prices and executes orders when trigger conditions are met.
 */
export class ArtificialOrderManager {
  private orders: Map<string, ArtificialOrder> = new Map();
  private priceMonitorInterval: NodeJS.Timeout | null = null;
  private readonly intervalMs: number;
  
  /**
   * Constructor for ArtificialOrderManager
   * @param intervalMs - Interval in milliseconds for price checking (default: 1000ms)
   */
  constructor(intervalMs = 1000) {
    this.intervalMs = intervalMs;
  }
  
  /**
   * Start the price monitoring service
   * @param priceProvider - Function that returns the latest price for a symbol
   * @param orderExecutor - Function that executes an order when triggered
   */
  public startMonitoring(
    priceProvider: (symbol: string) => Promise<number>,
    orderExecutor: (order: ArtificialOrder) => Promise<string>
  ): void {
    if (this.priceMonitorInterval) {
      clearInterval(this.priceMonitorInterval);
    }
    
    this.priceMonitorInterval = setInterval(async () => {
      const pendingOrders = Array.from(this.orders.values())
        .filter(order => order.status === 'pending');
      
      if (pendingOrders.length === 0) return;
      
      // Group orders by symbol to minimize API calls
      const symbolGroups = pendingOrders.reduce((groups, order) => {
        if (!groups[order.symbol]) {
          groups[order.symbol] = [];
        }
        groups[order.symbol].push(order);
        return groups;
      }, {} as Record<string, ArtificialOrder[]>);
      
      // Check each symbol's price once and evaluate all orders for that symbol
      for (const [symbol, orders] of Object.entries(symbolGroups)) {
        try {
          const currentPrice = await priceProvider(symbol);
          
          for (const order of orders) {
            if (this.shouldTriggerOrder(order, currentPrice)) {
              order.status = 'triggered';
              order.updatedAt = new Date().toISOString();
              
              try {
                const executedOrderId = await orderExecutor(order);
                order.status = 'filled';
                order.executedOrderId = executedOrderId;
                order.updatedAt = new Date().toISOString();
                this.orders.set(order.id, order);
              } catch (error) {
                console.error(`Failed to execute artificial order ${order.id}:`, error);
                // Reset to pending if execution fails, will retry on next interval
                order.status = 'pending';
                order.updatedAt = new Date().toISOString();
                this.orders.set(order.id, order);
              }
            }
          }
        } catch (error) {
          console.error(`Failed to get price for ${symbol}:`, error);
        }
      }
    }, this.intervalMs);
  }
  
  /**
   * Stop the price monitoring service
   */
  public stopMonitoring(): void {
    if (this.priceMonitorInterval) {
      clearInterval(this.priceMonitorInterval);
      this.priceMonitorInterval = null;
    }
  }
  
  /**
   * Create a new artificial order
   * @param orderRequest - The artificial order request
   * @returns The created artificial order
   */
  public createOrder(orderRequest: ArtificialOrderRequest): ArtificialOrder {
    const now = new Date().toISOString();
    const isStopLimit = !!orderRequest.limitPrice;
    
    const order: ArtificialOrder = {
      ...orderRequest,
      id: uuidv4(),
      status: 'pending',
      createdAt: now,
      updatedAt: now,
      isStopLimit
    };
    
    this.orders.set(order.id, order);
    return order;
  }
  
  /**
   * Cancel an artificial order
   * @param orderId - The ID of the order to cancel
   * @returns The canceled order or null if not found
   */
  public cancelOrder(orderId: string): ArtificialOrder | null {
    const order = this.orders.get(orderId);
    
    if (order && order.status === 'pending') {
      order.status = 'canceled';
      order.updatedAt = new Date().toISOString();
      this.orders.set(orderId, order);
      return order;
    }
    
    return order || null;
  }
  
  /**
   * Get all artificial orders
   * @param status - Optional filter by status
   * @returns Array of artificial orders
   */
  public getOrders(status?: ArtificialOrderStatus): ArtificialOrder[] {
    const orders = Array.from(this.orders.values());
    
    if (status) {
      return orders.filter(order => order.status === status);
    }
    
    return orders;
  }
  
  /**
   * Get a specific artificial order by ID
   * @param orderId - The ID of the order to retrieve
   * @returns The order or null if not found
   */
  public getOrder(orderId: string): ArtificialOrder | null {
    return this.orders.get(orderId) || null;
  }
  
  /**
   * Determine if an order should be triggered based on current price
   * @param order - The artificial order to check
   * @param currentPrice - The current price of the symbol
   * @returns True if the order should be triggered
   */
  private shouldTriggerOrder(order: ArtificialOrder, currentPrice: number): boolean {
    if (order.side === 'buy') {
      // For buy stop orders, trigger when price rises above trigger price
      return currentPrice >= order.triggerPrice;
    } else {
      // For sell stop orders, trigger when price falls below trigger price
      return currentPrice <= order.triggerPrice;
    }
  }
  
  /**
   * Check if artificial orders should be used based on market hours
   * @returns True if artificial orders should be used
   */
  public static shouldUseArtificialOrders(): boolean {
    const now = new Date();
    return isPreMarketHours(now) || isPostMarketHours(now);
  }
  
  /**
   * Clean up expired orders (for day orders)
   */
  public cleanupExpiredOrders(): void {
    const now = new Date();
    const isMarketOpen = !isPreMarketHours(now) && !isPostMarketHours(now);
    
    // Only expire day orders when market is closed for the day
    if (!isMarketOpen) return;
    
    for (const order of this.orders.values()) {
      if (order.status === 'pending' && order.timeInForce === 'day') {
        // Check if the order was created on a previous day
        const orderDate = new Date(order.createdAt).setHours(0, 0, 0, 0);
        const today = now.setHours(0, 0, 0, 0);
        
        if (orderDate < today) {
          order.status = 'expired';
          order.updatedAt = now.toISOString();
          this.orders.set(order.id, order);
        }
      }
    }
  }
}
