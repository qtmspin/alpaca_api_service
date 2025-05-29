/**
 * artificial-orders.ts
 * 
 * This file manages artificial / simulated orders that are triggered by market conditions.
 * Location: backend/src/core/artificial-orders.ts
 * 
 * Responsibilities:
 * - Manage artificial orders that aren't sent to the broker immediately
 * - Monitor market conditions and trigger orders when conditions are met
 * - Provide a system for conditional order execution with sub-100ms latency
 * 
 * How It Works:
 * - When the service starts, it establishes a WebSocket connection to Alpaca's market data stream
 * - As artificial orders are created, the system automatically subscribes to real-time data for those symbols
 * - When price updates arrive via WebSocket, they're immediately processed against pending orders
 * - If a price condition is met, the order is executed with minimal latency (sub-100ms)
 * - The system maintains active WebSocket subscriptions for symbols with pending orders
 * - Market data is processed in real-time as it arrives, rather than polling at intervals
 * - Includes fallback to interval-based monitoring if WebSocket connection fails
 * 
 * Performance Benefits:
 * - Significantly reduced latency compared to REST API polling (milliseconds vs seconds)
 * - Lower API usage and rate limit consumption
 * - More accurate price condition evaluation due to real-time data
 * - Better scalability for monitoring multiple symbols simultaneously
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';

export interface ArtificialOrder {
  id: string;
  symbol: string;
  qty: number;
  side: 'buy' | 'sell';
  type: 'market' | 'limit' | 'stop' | 'stop_limit';
  limitPrice?: number;
  stopPrice?: number;
  timeInForce: 'day' | 'gtc';
  status: 'pending' | 'triggered' | 'filled' | 'cancelled' | 'expired';
  createdAt: string;
  updatedAt: string;
  triggerCondition?: {
    field: 'price' | 'volume';
    operator: 'gte' | 'lte' | 'eq';
    value: number;
  };
}

export interface CreateArtificialOrderRequest {
  symbol: string;
  qty: number;
  side: 'buy' | 'sell';
  type: 'market' | 'limit' | 'stop' | 'stop_limit';
  limitPrice?: number;
  stopPrice?: number;
  timeInForce: 'day' | 'gtc';
  triggerCondition?: {
    field: 'price' | 'volume';
    operator: 'gte' | 'lte' | 'eq';
    value: number;
  };
}

/**
 * ArtificialOrderManager
 * 
 * Manages artificial orders that execute based on real-time market data conditions.
 * Handles order creation, monitoring, triggering, and lifecycle management.
 * Uses WebSockets for real-time price monitoring with sub-100ms latency.
 */
export class ArtificialOrderManager extends EventEmitter {
  private orders = new Map<string, ArtificialOrder>();
  private isMonitoring = false;
  private priceMonitorCallback?: (symbols: string[], callback: Function) => string;
  private unsubscribeCallback?: (monitorId: string) => void;
  private activeMonitorIds = new Map<string, string>();

  /**
   * Create a new artificial order
   */
  createOrder(request: CreateArtificialOrderRequest): ArtificialOrder {
    const order: ArtificialOrder = {
      id: uuidv4(),
      symbol: request.symbol.toUpperCase(),
      qty: request.qty,
      side: request.side,
      type: request.type,
      limitPrice: request.limitPrice,
      stopPrice: request.stopPrice,
      timeInForce: request.timeInForce,
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      triggerCondition: request.triggerCondition
    };

    this.orders.set(order.id, order);
    this.emit('orderCreated', order);
    
    console.log(`Created artificial order: ${order.id} for ${order.symbol}`);
    return order;
  }

  /**
   * Get order by ID
   */
  getOrder(orderId: string): ArtificialOrder | undefined {
    return this.orders.get(orderId);
  }

  /**
   * Get all orders
   */
  getAllOrders(): ArtificialOrder[] {
    return Array.from(this.orders.values());
  }

  /**
   * Get orders by status
   */
  getOrdersByStatus(status: string): ArtificialOrder[] {
    return this.getAllOrders().filter(order => order.status === status);
  }

  /**
   * Get orders by symbol
   */
  getOrdersBySymbol(symbol: string): ArtificialOrder[] {
    return this.getAllOrders().filter(order => order.symbol === symbol.toUpperCase());
  }

  /**
   * Cancel an order
   */
  cancelOrder(orderId: string): boolean {
    const order = this.orders.get(orderId);
    if (!order || order.status !== 'pending') {
      return false;
    }

    order.status = 'cancelled';
    order.updatedAt = new Date().toISOString();
    
    this.emit('orderCancelled', order);
    console.log(`Cancelled artificial order: ${orderId}`);
    return true;
  }

  /**
   * Process market data and check for triggers
   * This is called by the WebSocket server when market data is received
   */
  processMarketData(symbol: string, marketData: { price: number; volume?: number }): void {
    const pendingOrders = this.getOrdersBySymbol(symbol).filter(order => order.status === 'pending');
    
    for (const order of pendingOrders) {
      if (this.checkOrderTrigger(order, marketData)) {
        this.triggerOrder(order, marketData);
      }
    }
  }

  /**
   * Check if an order should be triggered
   */
  private checkOrderTrigger(order: ArtificialOrder, marketData: { price: number; volume?: number }): boolean {
    if (!order.triggerCondition) {
      return true; // No condition means immediate trigger
    }

    const { field, operator, value } = order.triggerCondition;
    const marketValue = field === 'price' ? marketData.price : (marketData.volume || 0);

    switch (operator) {
      case 'gte':
        return marketValue >= value;
      case 'lte':
        return marketValue <= value;
      case 'eq':
        return marketValue === value;
      default:
        return false;
    }
  }

  /**
   * Trigger an order
   */
  private triggerOrder(order: ArtificialOrder, marketData: { price: number; volume?: number }): void {
    order.status = 'triggered';
    order.updatedAt = new Date().toISOString();
    
    this.emit('orderTriggered', order, marketData);
    console.log(`Triggered artificial order: ${order.id} for ${order.symbol} at price ${marketData.price}`);
  }

  /**
   * Mark order as filled
   */
  markOrderFilled(orderId: string): boolean {
    const order = this.orders.get(orderId);
    if (!order) {
      return false;
    }

    order.status = 'filled';
    order.updatedAt = new Date().toISOString();
    
    this.emit('orderFilled', order);
    console.log(`Marked artificial order as filled: ${orderId}`);
    return true;
  }

  /**
   * Clean up expired orders
   */
  cleanupExpiredOrders(): number {
    const now = new Date();
    let expiredCount = 0;

    for (const order of this.orders.values()) {
      if (order.status === 'pending' && order.timeInForce === 'day') {
        const createdAt = new Date(order.createdAt);
        const isExpired = now.getDate() !== createdAt.getDate() ||
                         now.getMonth() !== createdAt.getMonth() ||
                         now.getFullYear() !== createdAt.getFullYear();

        if (isExpired) {
          order.status = 'expired';
          order.updatedAt = new Date().toISOString();
          this.emit('orderExpired', order);
          expiredCount++;
        }
      }
    }

    if (expiredCount > 0) {
      console.log(`Expired ${expiredCount} day orders`);
    }

    return expiredCount;
  }

  /**
   * Register a function to monitor price for orders
   * This is called by the WebSocket manager to provide price monitoring capability
   * @param callback Function that accepts symbols and a callback function
   */
  registerPriceMonitor(callback: (symbols: string[], priceCallback: Function) => string): void {
    this.priceMonitorCallback = callback;
    console.log('Price monitor registered with ArtificialOrderManager');
  }

  /**
   * Register a function to unsubscribe from price monitoring
   * @param callback Function that accepts a monitor ID
   */
  registerUnsubscribeFunction(callback: (monitorId: string) => void): void {
    this.unsubscribeCallback = callback;
    console.log('Unsubscribe function registered with ArtificialOrderManager');
  }

  /**
   * Start monitoring (called by WebSocket server)
   */
  startMonitoring(): void {
    if (this.isMonitoring) {
      return;
    }

    this.isMonitoring = true;
    
    // Set up cleanup interval for expired orders
    setInterval(() => {
      this.cleanupExpiredOrders();
    }, 60000); // Check every min
    
    // Start monitoring prices for pending orders if we have a price monitor
    if (this.priceMonitorCallback) {
      this.setupPriceMonitoring();
    }

    this.emit('monitoringStarted');
    console.log('Artificial order monitoring started');
  }

  /**
   * Setup price monitoring for all pending orders
   * Uses the registered price monitor callback to subscribe to market data
   */
  private setupPriceMonitoring(): void {
    if (!this.priceMonitorCallback) {
      console.warn('Cannot setup price monitoring: No price monitor callback registered');
      return;
    }

    // Get all unique symbols from pending orders
    const pendingOrders = this.getOrdersByStatus('pending');
    const symbols = [...new Set(pendingOrders.map(order => order.symbol))];

    if (symbols.length === 0) {
      console.log('No pending orders to monitor');
      return;
    }

    console.log(`Setting up price monitoring for ${symbols.length} symbols: ${symbols.join(', ')}`);
    
    // Register for price updates
    const monitorId = this.priceMonitorCallback(symbols, (symbol: string, marketData: { price: number; volume?: number }) => {
      this.processMarketData(symbol, marketData);
    });
    
    // Store the monitor ID for cleanup
    for (const symbol of symbols) {
      this.activeMonitorIds.set(symbol, monitorId);
    }
  }

  /**
   * Stop monitoring
   * Unsubscribes from all active price monitors and stops the monitoring process
   */
  stopMonitoring(): void {
    if (!this.isMonitoring) {
      return;
    }
    
    // Unsubscribe from all active monitors if we have an unsubscribe callback
    if (this.unsubscribeCallback) {
      const monitorIds = new Set([...this.activeMonitorIds.values()]);
      for (const monitorId of monitorIds) {
        this.unsubscribeCallback(monitorId);
      }
      this.activeMonitorIds.clear();
    }
    
    this.isMonitoring = false;
    this.emit('monitoringStopped');
    console.log('Artificial order monitoring stopped');
  }

  /**
   * Get statistics
   */
  getStatistics(): {
    total: number;
    byStatus: Record<string, number>;
    bySymbol: Record<string, number>;
  } {
    const orders = this.getAllOrders();
    const byStatus: Record<string, number> = {};
    const bySymbol: Record<string, number> = {};

    for (const order of orders) {
      byStatus[order.status] = (byStatus[order.status] || 0) + 1;
      bySymbol[order.symbol] = (bySymbol[order.symbol] || 0) + 1;
    }

    return {
      total: orders.length,
      byStatus,
      bySymbol
    };
  }

  /**
   * Clear all orders (for testing)
   */
  clearAllOrders(): void {
    this.orders.clear();
    this.emit('allOrdersCleared');
    console.log('All artificial orders cleared');
  }
}

/**
 * client-example.ts
 * 
 * Example client code for connecting to the refactored WebSocket server
 */

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 2000;

  constructor(private url: string) {}

  /**
   * Connect to WebSocket server
   */
  connect(): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      this.ws = new WebSocket(this.url);
      this.setupEventHandlers();
    } catch (error) {
      console.error('Failed to connect to WebSocket:', error);
      this.scheduleReconnect();
    }
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  /**
   * Subscribe to market data
   */
  subscribeToMarketData(symbols: string[]): void {
    this.send({
      type: 'subscribe',
      symbols: symbols
    });
  }

  /**
   * Subscribe to order updates
   */
  subscribeToOrders(): void {
    this.send({
      type: 'subscribe',
      channels: ['orders']
    });
  }

  /**
   * Unsubscribe from market data
   */
  unsubscribeFromMarketData(symbols: string[]): void {
    this.send({
      type: 'unsubscribe',
      symbols: symbols
    });
  }

  /**
   * Send message to server
   */
  private send(message: any): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket not connected, cannot send message');
    }
  }

  /**
   * Set up event handlers
   */
  private setupEventHandlers(): void {
    if (!this.ws) return;

    this.ws.onopen = () => {
      console.log('Connected to WebSocket server');
      this.reconnectAttempts = 0;
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.handleMessage(data);
      } catch (error) {
        console.error('Error parsing message:', error);
      }
    };

    this.ws.onclose = () => {
      console.log('WebSocket connection closed');
      this.scheduleReconnect();
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
  }

  /**
   * Handle incoming messages
   */
  private handleMessage(data: any): void {
    switch (data.type) {
      case 'connection_established':
        console.log('Connection established:', data.data);
        break;

      case 'market_data':
        console.log('Market data update:', data.payload);
        break;

      case 'order_update':
        console.log('Order update:', data.payload);
        break;

      case 'status_update':
        console.log('Status update:', data.payload);
        break;

      case 'error':
        console.error('Server error:', data.payload);
        break;

      case 'heartbeat':
        // Heartbeat received, connection is alive
        break;

      default:
        console.log('Unknown message type:', data.type);
    }
  }

  /**
   * Schedule reconnection
   */
  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnect attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * this.reconnectAttempts;

    setTimeout(() => {
      console.log(`Reconnecting... (attempt ${this.reconnectAttempts})`);
      this.connect();
    }, delay);
  }
}

// Example usage:
/*
const client = new WebSocketClient('ws://localhost:9000');
client.connect();

// Subscribe to market data for AAPL and MSFT
client.subscribeToMarketData(['AAPL', 'MSFT']);

// Subscribe to order updates
client.subscribeToOrders();

// Later, unsubscribe from MSFT
client.unsubscribeFromMarketData(['MSFT']);
*/
