/**
 * market-data-subscription.ts
 * 
 * This file manages WebSocket subscriptions for real-time market data.
 * Location: backend/src/core/market-data-subscription.ts
 * 
 * Responsibilities:
 * - Manage WebSocket connections to market data providers
 * - Handle symbol subscriptions and unsubscriptions
 * - Cache latest market data for subscribed symbols
 * - Provide an event-based interface for real-time market data
 */

import { EventEmitter } from 'events';

/**
 * Market data structure
 */
export interface MarketData {
  symbol: string;
  price: number;
  volume?: number;
  timestamp: string;
  bid?: number;
  ask?: number;
  bidSize?: number;
  askSize?: number;
  source: 'trade' | 'quote';
}

/**
 * MarketDataSubscriptionManager
 * 
 * Manages WebSocket connections and subscriptions for real-time market data.
 * Uses an event-based system to notify subscribers of market data updates.
 */
export class MarketDataSubscriptionManager extends EventEmitter {
  // Track active WebSocket subscriptions by symbol
  private activeSubscriptions: Set<string> = new Set();
  
  // Cache the latest market data for each symbol
  private marketDataBySymbol: Map<string, MarketData> = new Map();
  
  // The WebSocket client
  private wsClient: any = null;
  
  // Heartbeat interval to keep connection alive
  private heartbeatInterval: NodeJS.Timeout | null = null;
  
  // Reconnection timeout
  private reconnectTimeout: NodeJS.Timeout | null = null;
  
  // Connection status
  private connected: boolean = false;
  
  /**
   * Constructor
   */
  constructor() {
    super();
  }
  
  /**
   * Initialize the subscription manager with a WebSocket client
   * @param wsClient - WebSocket client
   */
  initialize(wsClient: any): void {
    if (this.wsClient) {
      this.disconnect();
    }
    
    this.wsClient = wsClient;
    this.setupEventHandlers();
    this.startHeartbeat();
    this.connected = true;
    
    this.emit('initialized');
  }
  
  /**
   * Set up WebSocket event handlers
   */
  private setupEventHandlers(): void {
    if (!this.wsClient) return;
    
    this.wsClient.on('message', (data: any) => {
      try {
        // Parse the incoming message
        const message = JSON.parse(data.toString());
        
        // Handle different message types
        if (message.type === 'trade') {
          this.handleTradeMessage(message);
        } else if (message.type === 'quote') {
          this.handleQuoteMessage(message);
        } else if (message.type === 'subscription') {
          this.handleSubscriptionMessage(message);
        } else if (message.type === 'error') {
          this.handleErrorMessage(message);
        }
      } catch (error) {
        console.error('Error processing WebSocket message:', error);
      }
    });
    
    this.wsClient.on('error', (error: any) => {
      console.error('WebSocket error:', error);
      this.emit('error', error);
      this.scheduleReconnect();
    });
    
    this.wsClient.on('close', () => {
      console.log('WebSocket connection closed');
      this.connected = false;
      this.emit('disconnected');
      this.scheduleReconnect();
    });
  }
  
  /**
   * Start heartbeat to keep connection alive
   */
  private startHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    
    this.heartbeatInterval = setInterval(() => {
      if (this.wsClient && this.wsClient.readyState === 1) { // 1 = OPEN
        this.wsClient.send(JSON.stringify({ action: 'ping' }));
      }
    }, 30000); // 30 seconds
  }
  
  /**
   * Schedule a reconnection attempt
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }
    
    this.reconnectTimeout = setTimeout(() => {
      this.emit('reconnecting');
      // The actual reconnection should be handled by the controller
    }, 5000); // 5 seconds
  }
  
  /**
   * Handle trade message
   */
  private handleTradeMessage(message: any): void {
    const symbol = message.symbol;
    
    // Update market data cache
    const marketData: MarketData = {
      symbol,
      price: message.price,
      volume: message.size,
      timestamp: new Date().toISOString(),
      source: 'trade'
    };
    
    this.marketDataBySymbol.set(symbol, marketData);
    
    // Emit market data update event
    this.emit('marketData', marketData);
    this.emit(`marketData:${symbol}`, marketData);
  }
  
  /**
   * Handle quote message
   */
  private handleQuoteMessage(message: any): void {
    const symbol = message.symbol;
    
    // Update market data cache
    const marketData: MarketData = {
      symbol,
      price: (message.bidprice + message.askprice) / 2, // Midpoint price
      bid: message.bidprice,
      ask: message.askprice,
      bidSize: message.bidsize,
      askSize: message.asksize,
      timestamp: new Date().toISOString(),
      source: 'quote'
    };
    
    this.marketDataBySymbol.set(symbol, marketData);
    
    // Emit market data update event
    this.emit('marketData', marketData);
    this.emit(`marketData:${symbol}`, marketData);
  }
  
  /**
   * Handle subscription message
   */
  private handleSubscriptionMessage(message: any): void {
    console.log('Subscription update:', message);
    this.emit('subscription', message);
  }
  
  /**
   * Handle error message
   */
  private handleErrorMessage(message: any): void {
    console.error('WebSocket API error:', message);
    this.emit('apiError', message);
  }
  
  /**
   * Subscribe to a symbol
   * @param symbol - Symbol to subscribe to
   */
  subscribe(symbol: string): void {
    if (!this.wsClient || !this.connected) {
      console.warn(`Cannot subscribe to ${symbol}: WebSocket not connected`);
      return;
    }
    
    if (this.activeSubscriptions.has(symbol)) {
      return; // Already subscribed
    }
    
    try {
      // Subscribe to trades and quotes for this symbol
      this.wsClient.send(JSON.stringify({
        action: 'subscribe',
        trades: [symbol],
        quotes: [symbol]
      }));
      
      this.activeSubscriptions.add(symbol);
      console.log(`Subscribed to real-time data for ${symbol}`);
      this.emit('subscribed', symbol);
    } catch (error) {
      console.error(`Failed to subscribe to ${symbol}:`, error);
      this.emit('subscribeError', { symbol, error });
    }
  }
  
  /**
   * Unsubscribe from a symbol
   * @param symbol - Symbol to unsubscribe from
   */
  unsubscribe(symbol: string): void {
    if (!this.wsClient || !this.connected) {
      return; // Not connected, so no need to unsubscribe
    }
    
    if (!this.activeSubscriptions.has(symbol)) {
      return; // Not subscribed
    }
    
    try {
      // Unsubscribe from trades and quotes for this symbol
      this.wsClient.send(JSON.stringify({
        action: 'unsubscribe',
        trades: [symbol],
        quotes: [symbol]
      }));
      
      this.activeSubscriptions.delete(symbol);
      this.marketDataBySymbol.delete(symbol);
      console.log(`Unsubscribed from real-time data for ${symbol}`);
      this.emit('unsubscribed', symbol);
    } catch (error) {
      console.error(`Failed to unsubscribe from ${symbol}:`, error);
      this.emit('unsubscribeError', { symbol, error });
    }
  }
  
  /**
   * Unsubscribe from all symbols
   */
  unsubscribeAll(): void {
    if (!this.wsClient || !this.connected) {
      return; // Not connected
    }
    
    const symbols = Array.from(this.activeSubscriptions);
    
    if (symbols.length === 0) {
      return; // No active subscriptions
    }
    
    try {
      // Unsubscribe from all trades and quotes
      this.wsClient.send(JSON.stringify({
        action: 'unsubscribe',
        trades: symbols,
        quotes: symbols
      }));
      
      this.activeSubscriptions.clear();
      this.marketDataBySymbol.clear();
      console.log(`Unsubscribed from all ${symbols.length} symbols`);
      this.emit('unsubscribedAll', symbols);
    } catch (error) {
      console.error('Failed to unsubscribe from all symbols:', error);
      this.emit('unsubscribeAllError', error);
    }
  }
  
  /**
   * Get the latest market data for a symbol
   * @param symbol - Symbol to get market data for
   * @returns Latest market data or undefined if not available
   */
  getLatestMarketData(symbol: string): MarketData | undefined {
    return this.marketDataBySymbol.get(symbol);
  }
  
  /**
   * Get all active subscriptions
   * @returns Array of active subscriptions
   */
  getActiveSubscriptions(): string[] {
    return Array.from(this.activeSubscriptions);
  }
  
  /**
   * Check if a symbol is subscribed
   * @param symbol - Symbol to check
   * @returns True if subscribed, false otherwise
   */
  isSubscribed(symbol: string): boolean {
    return this.activeSubscriptions.has(symbol);
  }
  
  /**
   * Get the number of active subscriptions
   * @returns Number of active subscriptions
   */
  getSubscriptionCount(): number {
    return this.activeSubscriptions.size;
  }
  
  /**
   * Disconnect from the WebSocket server
   */
  disconnect(): void {
    // Unsubscribe from all symbols first
    this.unsubscribeAll();
    
    // Clear intervals
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    
    // Close WebSocket connection
    if (this.wsClient) {
      try {
        this.wsClient.terminate();
      } catch (error) {
        console.error('Error terminating WebSocket connection:', error);
      }
      
      this.wsClient = null;
    }
    
    this.connected = false;
    this.emit('disconnected');
  }
  
  /**
   * Check if connected to WebSocket server
   * @returns True if connected, false otherwise
   */
  isConnected(): boolean {
    return this.connected && this.wsClient !== null;
  }
}
