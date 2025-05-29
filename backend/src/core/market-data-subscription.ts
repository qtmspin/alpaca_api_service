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
  
  // Alpaca API credentials
  private apiKey: string = '';
  private secretKey: string = '';
  
  // WebSocket URLs
  private readonly stocksDataUrl: string = 'wss://stream.data.alpaca.markets/v2/sip';
  private readonly cryptoDataUrl: string = 'wss://stream.data.alpaca.markets/v1beta2/crypto';
  
  /**
   * Constructor
   */
  constructor() {
    super();
  }
  
  /**
   * Initialize the subscription manager with API credentials
   * @param apiKey - Alpaca API key
   * @param secretKey - Alpaca API secret key
   * @param isCrypto - Whether to use crypto data stream (true) or stocks data stream (false)
   */
  initialize(apiKey: string, secretKey: string, isCrypto: boolean = false): void {
    if (this.wsClient) {
      this.disconnect();
    }
    
    this.apiKey = apiKey;
    this.secretKey = secretKey;
    
    // Create a new WebSocket connection
    const url = isCrypto ? this.cryptoDataUrl : this.stocksDataUrl;
    this.wsClient = new WebSocket(url);
    
    this.setupEventHandlers();
    this.startHeartbeat();
    
    this.emit('initializing');
  }
  
  /**
   * Set up WebSocket event handlers
   */
  private setupEventHandlers(): void {
    if (!this.wsClient) return;
    
    this.wsClient.on('open', () => {
      console.log('Market data WebSocket connection opened');
      this.authenticate();
    });
    
    this.wsClient.on('message', (data: any) => {
      try {
        // Parse the incoming message
        const message = JSON.parse(data.toString());
        
        // Handle authentication response
        if (message.T === 'success' && message.msg === 'authenticated') {
          console.log('Successfully authenticated with Alpaca market data API');
          this.connected = true;
          this.emit('connected');
          
          // Resubscribe to active symbols if any
          this.resubscribeToActiveSymbols();
          return;
        }
        
        // Handle different message types
        if (message.T === 't') {
          // Trade message
          this.handleTradeMessage(message);
        } else if (message.T === 'q') {
          // Quote message
          this.handleQuoteMessage(message);
        } else if (message.T === 'subscription') {
          // Subscription message
          this.handleSubscriptionMessage(message);
        } else if (message.T === 'error') {
          // Error message
          this.handleErrorMessage(message);
        }
      } catch (error) {
        console.error('Error processing WebSocket message:', error);
      }
    });
    
    this.wsClient.on('error', (error: any) => {
      console.error('Market data WebSocket error:', error);
      this.emit('error', error);
      this.scheduleReconnect();
    });
    
    this.wsClient.on('close', () => {
      console.log('Market data WebSocket connection closed');
      this.connected = false;
      this.emit('disconnected');
      this.scheduleReconnect();
    });
  }
  
  /**
   * Authenticate with the Alpaca WebSocket API
   */
  private authenticate(): void {
    if (!this.wsClient) return;
    
    try {
      const authMsg = {
        action: 'auth',
        key: this.apiKey,
        secret: this.secretKey
      };
      
      this.wsClient.send(JSON.stringify(authMsg));
      console.log('Sent authentication request to Alpaca market data API');
    } catch (error) {
      console.error('Error authenticating with Alpaca market data API:', error);
      this.emit('error', error);
    }
  }
  
  /**
   * Resubscribe to all active symbols after reconnection
   */
  private resubscribeToActiveSymbols(): void {
    const symbols = Array.from(this.activeSubscriptions);
    if (symbols.length === 0) return;
    
    try {
      const subscribeMsg = {
        action: 'subscribe',
        trades: symbols,
        quotes: symbols
      };
      
      this.wsClient?.send(JSON.stringify(subscribeMsg));
      console.log(`Resubscribed to ${symbols.length} symbols`);
    } catch (error) {
      console.error('Error resubscribing to symbols:', error);
      this.emit('error', error);
    }
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
    const symbol = message.S; // Symbol
    
    // Update market data cache
    const marketData: MarketData = {
      symbol,
      price: parseFloat(message.p), // Price
      volume: parseInt(message.s, 10), // Size
      timestamp: new Date(message.t * 1000000).toISOString(), // Timestamp (convert from nanoseconds)
      source: 'trade'
    };
    
    this.marketDataBySymbol.set(symbol, marketData);
    
    // Emit event with market data
    this.emit('marketData', marketData);
    this.emit(`marketData:${symbol}`, marketData);
  }
  
  /**
   * Handle quote message
   */
  private handleQuoteMessage(message: any): void {
    const symbol = message.S; // Symbol
    
    // Get existing market data or create new one
    let marketData = this.marketDataBySymbol.get(symbol) || {
      symbol,
      price: 0,
      timestamp: new Date(message.t * 1000000).toISOString(), // Timestamp (convert from nanoseconds)
      source: 'quote',
      bid: 0,
      ask: 0,
      bidSize: 0,
      askSize: 0
    } as MarketData;
    
    // Update with quote data
    marketData.bid = parseFloat(message.bp); // Bid price
    marketData.ask = parseFloat(message.ap); // Ask price
    marketData.bidSize = parseInt(message.bs, 10); // Bid size
    marketData.askSize = parseInt(message.as, 10); // Ask size
    marketData.timestamp = new Date(message.t * 1000000).toISOString(); // Timestamp (convert from nanoseconds)
    marketData.source = 'quote';
    
    // Use midpoint price if no trade price is available
    if (!marketData.price && marketData.bid && marketData.ask) {
      marketData.price = (marketData.bid + marketData.ask) / 2;
    }
    
    this.marketDataBySymbol.set(symbol, marketData);
    
    // Emit event with market data
    this.emit('marketData', marketData);
    this.emit(`marketData:${symbol}`, marketData);
  }
  
  /**
   * Handle subscription message
   */
  private handleSubscriptionMessage(message: any): void {
    console.log('Subscription update:', message);
    this.emit('subscription', message);
    
    // If subscription was successful, update our active subscriptions
    if (message.success && message.trades) {
      message.trades.forEach((symbol: string) => {
        this.activeSubscriptions.add(symbol);
      });
    }
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
   * @param callback - Optional callback function to receive market data updates
   * @returns A function to unsubscribe from the market data
   */
  subscribe(symbol: string, callback?: (data: MarketData) => void): () => void {
    // Normalize the symbol (Alpaca expects uppercase)
    const normalizedSymbol = symbol.toUpperCase();
    
    // Set up the callback if provided
    if (callback) {
      const eventName = `marketData:${normalizedSymbol}`;
      this.on(eventName, callback);
    }
    
    if (!this.wsClient) {
      // Queue subscription for when connection is established
      this.activeSubscriptions.add(normalizedSymbol);
      this.emit('subscriptionQueued', normalizedSymbol);
      return () => this.unsubscribe(normalizedSymbol);
    }
    
    if (this.activeSubscriptions.has(normalizedSymbol)) {
      return () => this.unsubscribe(normalizedSymbol); // Already subscribed
    }
    
    try {
      // Subscribe to trades and quotes for this symbol
      this.wsClient.send(JSON.stringify({
        action: 'subscribe',
        trades: [normalizedSymbol],
        quotes: [normalizedSymbol]
      }));
      
      this.activeSubscriptions.add(normalizedSymbol);
      console.log(`Subscribed to real-time data for ${normalizedSymbol}`);
      this.emit('subscribed', normalizedSymbol);
      
      // Return an unsubscribe function
      return () => {
        if (callback) {
          this.removeListener(`marketData:${normalizedSymbol}`, callback);
        }
        this.unsubscribe(normalizedSymbol);
      };
    } catch (error) {
      console.error(`Failed to subscribe to ${normalizedSymbol}:`, error);
      this.emit('subscribeError', { symbol: normalizedSymbol, error });
      return () => {}; // Return a no-op function if subscription fails
    }
  }
  
  /**
   * Unsubscribe from a symbol
   * @param symbol - Symbol to unsubscribe from
   */
  unsubscribe(symbol: string): void {
    // Normalize the symbol (Alpaca expects uppercase)
    const normalizedSymbol = symbol.toUpperCase();
    
    if (!this.wsClient) {
      return; // Not connected, so no need to unsubscribe
    }
    
    if (!this.activeSubscriptions.has(normalizedSymbol)) {
      return; // Not subscribed
    }
    
    try {
      // Unsubscribe from trades and quotes for this symbol
      this.wsClient.send(JSON.stringify({
        action: 'unsubscribe',
        trades: [normalizedSymbol],
        quotes: [normalizedSymbol]
      }));
      
      this.activeSubscriptions.delete(normalizedSymbol);
      this.marketDataBySymbol.delete(normalizedSymbol);
      console.log(`Unsubscribed from real-time data for ${normalizedSymbol}`);
      this.emit('unsubscribed', normalizedSymbol);
    } catch (error) {
      console.error(`Failed to unsubscribe from ${normalizedSymbol}:`, error);
      this.emit('unsubscribeError', { symbol: normalizedSymbol, error });
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
