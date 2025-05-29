/**
 * alpaca-websocket-manager.ts
 * 
 * Central WebSocket manager for Alpaca API connections
 * Handles market data and trading events WebSocket connections
 * 
 * This class centralizes all WebSocket communication with Alpaca,
 * providing a robust, reconnectable interface for market data and trading events.
 */

import WebSocket from 'ws';
import { EventEmitter } from 'events';
import { logger } from '../../utils/logger';
import { 
  MarketDataHandler,
  TradingEventsHandler,
  WebSocketConnectionManager,
  HealthMonitor
} from './index';

// Types for WebSocket events
export type WebSocketType = 'marketData' | 'tradingEvents';
export type WebSocketEvent = 'open' | 'close' | 'error' | 'message' | 'reconnect';

// Market data subscription types
export interface MarketDataSubscription {
  trades: Set<string>;
  quotes: Set<string>;
  bars: Set<string>;
  updatedBars: Set<string>;
  dailyBars: Set<string>;
  statuses: Set<string>;
  lulds: Set<string>;
  cancelErrors: Set<string>;
  corrections: Set<string>;
}

// Price monitor callback type
export type PriceMonitorCallback = (price: number, symbol: string) => void;

// Price monitor registration
export interface PriceMonitor {
  id: string;
  symbols: string[];
  callback: PriceMonitorCallback;
}

/**
 * Central WebSocket manager for Alpaca API connections
 * Handles both market data and trading events WebSockets
 */
export class AlpacaWebSocketManager {
  // Properties
  private marketDataWs: WebSocket | null = null;
  private tradingEventsWs: WebSocket | null = null;
  private apiKey: string = '';
  private secretKey: string = '';
  private isPaper: boolean = true;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private reconnectAttempts: { marketData: number; tradingEvents: number } = { marketData: 0, tradingEvents: 0 };
  private maxReconnectAttempts: number = 10;
  private reconnectDelay: number = 1000; // Start with 1 second
  private isShuttingDown: boolean = false;
  private eventListeners: Map<string, Set<Function>> = new Map();
  private subscriptions: MarketDataSubscription = {
    trades: new Set<string>(),
    quotes: new Set<string>(),
    bars: new Set<string>(),
    updatedBars: new Set<string>(),
    dailyBars: new Set<string>(),
    statuses: new Set<string>(),
    lulds: new Set<string>(),
    cancelErrors: new Set<string>(),
    corrections: new Set<string>()
  };
  private priceMonitors: Map<string, PriceMonitor> = new Map();
  
  // Service instances
  private marketDataHandler: MarketDataHandler;
  private tradingEventsHandler: TradingEventsHandler;
  private connectionManager: WebSocketConnectionManager;
  private healthMonitor: HealthMonitor;
  
  /**
   * Constructor
   */
  constructor() {
    // Initialize handlers
    this.marketDataHandler = new MarketDataHandler(this);
    this.tradingEventsHandler = new TradingEventsHandler(this);
    this.connectionManager = new WebSocketConnectionManager(this);
    this.healthMonitor = new HealthMonitor(this);
    
    logger.info('AlpacaWebSocketManager: Initialized');
  }
  
  /**
   * Initialize the WebSocket manager with API credentials
   * @param apiKey Alpaca API key
   * @param secretKey Alpaca API secret key
   * @param isPaper Whether to use paper trading (true) or live trading (false)
   */
  public async initialize(apiKey: string, secretKey: string, isPaper: boolean = true): Promise<void> {
    this.apiKey = apiKey;
    this.secretKey = secretKey;
    this.isPaper = isPaper;
    
    logger.info(`AlpacaWebSocketManager: Initializing with ${isPaper ? 'paper' : 'live'} trading`);
    
    try {
      // Connect to both WebSockets
      await Promise.all([
        this.connectionManager.connectMarketData(),
        this.connectionManager.connectTradingEvents()
      ]);
      
      // Start health monitoring
      this.healthMonitor.startHealthMonitoring();
      
      logger.info('AlpacaWebSocketManager: Initialization complete');
    } catch (error) {
      logger.error('AlpacaWebSocketManager: Initialization failed', error);
      throw error;
    }
  }
  
  // Getters for internal properties (used by handler classes)
  public getApiKey(): string { return this.apiKey; }
  public getSecretKey(): string { return this.secretKey; }
  public isPaperTrading(): boolean { return this.isPaper; }
  public getMarketDataWs(): WebSocket | null { return this.marketDataWs; }
  public getTradingEventsWs(): WebSocket | null { return this.tradingEventsWs; }
  public getSubscriptions(): MarketDataSubscription { return this.subscriptions; }
  public getReconnectAttempts(): { marketData: number; tradingEvents: number } { return this.reconnectAttempts; }
  public getMaxReconnectAttempts(): number { return this.maxReconnectAttempts; }
  public getReconnectDelay(): number { return this.reconnectDelay; }
  public isInShutdown(): boolean { return this.isShuttingDown; }
  
  // Setters for internal properties (used by handler classes)
  public setMarketDataWs(ws: WebSocket | null): void { this.marketDataWs = ws; }
  public setTradingEventsWs(ws: WebSocket | null): void { this.tradingEventsWs = ws; }
  public setReconnectAttempts(type: WebSocketType, attempts: number): void { this.reconnectAttempts[type] = attempts; }
  public setReconnectDelay(delay: number): void { this.reconnectDelay = delay; }
  public setIsShuttingDown(isShuttingDown: boolean): void { this.isShuttingDown = isShuttingDown; }
  
  /**
   * Public API methods - these are the methods that should be called by other parts of the application
   */
  
  /**
   * Subscribe to market data for specific symbols
   * @param symbols Array of symbols to subscribe to
   * @param channels Optional array of channels to subscribe to (defaults to trades and quotes)
   */
  public subscribeToMarketData(symbols: string[], channels: (keyof MarketDataSubscription)[] = ['trades', 'quotes']): void {
    this.marketDataHandler.subscribeToMarketData(symbols, channels);
  }
  
  /**
   * Unsubscribe from market data for specific symbols
   * @param symbols Array of symbols to unsubscribe from
   * @param channels Optional array of channels to unsubscribe from (defaults to all channels)
   */
  public unsubscribeFromMarketData(symbols: string[], channels?: (keyof MarketDataSubscription)[]): void {
    this.marketDataHandler.unsubscribeFromMarketData(symbols, channels);
  }
  
  /**
   * Subscribe to trading updates
   */
  public subscribeToTradingUpdates(): void {
    this.tradingEventsHandler.subscribeToTradingUpdates();
  }
  
  /**
   * Register an event listener
   * @param event Event name to listen for
   * @param callback Callback function to execute when event occurs
   */
  public on(event: string, callback: Function): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)?.add(callback);
  }
  
  /**
   * Remove an event listener
   * @param event Event name
   * @param callback Callback function to remove
   */
  public off(event: string, callback: Function): void {
    if (this.eventListeners.has(event)) {
      this.eventListeners.get(event)?.delete(callback);
    }
  }
  
  /**
   * Emit an event to all registered listeners
   * @param event Event name
   * @param args Arguments to pass to listeners
   */
  public emit(event: string, ...args: any[]): void {
    if (this.eventListeners.has(event)) {
      this.eventListeners.get(event)?.forEach(callback => {
        try {
          callback(...args);
        } catch (error) {
          logger.error(`AlpacaWebSocketManager: Error in event listener for ${event}`, error);
        }
      });
    }
  }
  
  /**
   * Check if a WebSocket connection is currently established
   * @param type Type of WebSocket connection to check
   * @returns Boolean indicating if connection is established
   */
  public isConnected(type: WebSocketType): boolean {
    const ws = type === 'marketData' ? this.marketDataWs : this.tradingEventsWs;
    return ws !== null && ws.readyState === WebSocket.OPEN;
  }
  
  /**
   * Get the current connection status for both WebSockets
   * @returns Object with connection status for both WebSockets
   */
  public getConnectionStatus(): { marketData: boolean; tradingEvents: boolean } {
    return {
      marketData: this.isConnected('marketData'),
      tradingEvents: this.isConnected('tradingEvents')
    };
  }
  
  /**
   * Register a price monitoring callback for artificial orders
   * @param symbols Symbols to monitor prices for
   * @param callback Callback function to execute when price updates are received
   * @returns Monitor ID that can be used to stop monitoring
   */
  public monitorPriceForOrders(symbols: string[], callback: PriceMonitorCallback): string {
    const monitorId = `monitor_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    
    // Store the monitor
    this.priceMonitors.set(monitorId, {
      id: monitorId,
      symbols,
      callback
    });
    
    // Subscribe to market data for these symbols if not already subscribed
    this.subscribeToMarketData(symbols);
    
    // Set up listeners for price updates
    this.on('trade', (data: any) => {
      if (symbols.includes(data.symbol)) {
        callback(data.price, data.symbol);
      }
    });
    
    return monitorId;
  }
  
  /**
   * Stop monitoring prices for a specific monitor
   * @param monitorId Monitor ID to stop
   */
  public stopMonitoringSymbol(monitorId: string): void {
    const monitor = this.priceMonitors.get(monitorId);
    if (monitor) {
      // Check if any other monitors are watching these symbols
      const symbolsToUnsubscribe = monitor.symbols.filter(symbol => {
        for (const [id, otherMonitor] of this.priceMonitors.entries()) {
          if (id !== monitorId && otherMonitor.symbols.includes(symbol)) {
            return false; // Another monitor is watching this symbol
          }
        }
        return true; // No other monitor is watching this symbol
      });
      
      // Unsubscribe from symbols that are no longer needed
      if (symbolsToUnsubscribe.length > 0) {
        this.unsubscribeFromMarketData(symbolsToUnsubscribe);
      }
      
      // Remove the monitor
      this.priceMonitors.delete(monitorId);
    }
  }
  
  /**
   * Gracefully shut down all WebSocket connections
   */
  public async shutdown(): Promise<void> {
    logger.info('AlpacaWebSocketManager: Shutting down...');
    this.isShuttingDown = true;
    
    // Stop health monitoring
    this.healthMonitor.stopHealthMonitoring();
    
    // Close WebSocket connections
    const closePromises: Promise<void>[] = [];
    
    if (this.marketDataWs) {
      closePromises.push(new Promise<void>((resolve) => {
        if (this.marketDataWs) {
          this.marketDataWs.onclose = () => resolve();
          this.marketDataWs.close();
        } else {
          resolve();
        }
      }));
    }
    
    if (this.tradingEventsWs) {
      closePromises.push(new Promise<void>((resolve) => {
        if (this.tradingEventsWs) {
          this.tradingEventsWs.onclose = () => resolve();
          this.tradingEventsWs.close();
        } else {
          resolve();
        }
      }));
    }
    
    await Promise.all(closePromises);
    
    // Clear all event listeners
    this.eventListeners.clear();
    
    // Clear all price monitors
    this.priceMonitors.clear();
    
    logger.info('AlpacaWebSocketManager: Shutdown complete');
  }
}
