/**
 * websocket-connection-manager.ts
 * 
 * Manages WebSocket connections to Alpaca API
 * Handles connection establishment, authentication, and reconnection
 */

import WebSocket from 'ws';
import { logger } from '../../utils/logger';
import { AlpacaWebSocketManager, WebSocketType } from './alpaca-websocket-manager';

/**
 * Manages WebSocket connections to Alpaca API
 */
export class WebSocketConnectionManager {
  private manager: AlpacaWebSocketManager;
  
  // WebSocket URLs
  private readonly MARKET_DATA_URL_IEX = 'wss://stream.data.alpaca.markets/v2/iex';
  private readonly MARKET_DATA_URL_SIP = 'wss://stream.data.alpaca.markets/v2/sip';
  private readonly MARKET_DATA_URL_CRYPTO = 'wss://stream.data.alpaca.markets/v2/crypto';
  private readonly TRADING_EVENTS_URL_PAPER = 'wss://paper-api.alpaca.markets/stream';
  private readonly TRADING_EVENTS_URL_LIVE = 'wss://api.alpaca.markets/stream';
  
  /**
   * Constructor
   * @param manager Reference to the parent WebSocket manager
   */
  constructor(manager: AlpacaWebSocketManager) {
    this.manager = manager;
  }
  
  /**
   * Connect to market data WebSocket
   */
  public async connectMarketData(): Promise<void> {
    // Check if already connected
    if (this.manager.isConnected('marketData')) {
      logger.info('WebSocketConnectionManager: Already connected to market data WebSocket');
      return;
    }
    
    // Check if shutting down
    if (this.manager.isInShutdown()) {
      logger.info('WebSocketConnectionManager: Cannot connect during shutdown');
      return;
    }
    
    // Use IEX data feed by default
    const url = this.MARKET_DATA_URL_IEX;
    
    logger.info(`WebSocketConnectionManager: Connecting to market data WebSocket at ${url}`);
    
    return new Promise<void>((resolve, reject) => {
      try {
        const ws = new WebSocket(url);
        this.manager.setMarketDataWs(ws);
        
        // Set up connection timeout
        const connectionTimeout = setTimeout(() => {
          logger.error('WebSocketConnectionManager: Market data WebSocket connection timeout');
          ws.terminate();
          reject(new Error('Connection timeout'));
        }, 10000);
        
        ws.on('open', () => {
          clearTimeout(connectionTimeout);
          logger.info('WebSocketConnectionManager: Market data WebSocket connected');
          
          // Authenticate
          this.authenticateConnection(ws, 'marketData');
          
          // Set up event handlers
          this.setupEventHandlers(ws, 'marketData');
          
          // Reset reconnect attempts
          this.manager.setReconnectAttempts('marketData', 0);
          this.manager.setReconnectDelay(1000); // Reset to initial delay
          
          resolve();
        });
        
        ws.on('error', (error) => {
          clearTimeout(connectionTimeout);
          logger.error('WebSocketConnectionManager: Market data WebSocket connection error', error);
          reject(error);
        });
      } catch (error) {
        logger.error('WebSocketConnectionManager: Failed to create market data WebSocket', error);
        reject(error);
      }
    });
  }
  
  /**
   * Connect to trading events WebSocket
   */
  public async connectTradingEvents(): Promise<void> {
    // Check if already connected
    if (this.manager.isConnected('tradingEvents')) {
      logger.info('WebSocketConnectionManager: Already connected to trading events WebSocket');
      return;
    }
    
    // Check if shutting down
    if (this.manager.isInShutdown()) {
      logger.info('WebSocketConnectionManager: Cannot connect during shutdown');
      return;
    }
    
    // Determine URL based on paper/live trading
    const url = this.manager.isPaperTrading() ? this.TRADING_EVENTS_URL_PAPER : this.TRADING_EVENTS_URL_LIVE;
    
    logger.info(`WebSocketConnectionManager: Connecting to trading events WebSocket at ${url}`);
    
    return new Promise<void>((resolve, reject) => {
      try {
        const ws = new WebSocket(url);
        this.manager.setTradingEventsWs(ws);
        
        // Set up connection timeout
        const connectionTimeout = setTimeout(() => {
          logger.error('WebSocketConnectionManager: Trading events WebSocket connection timeout');
          ws.terminate();
          reject(new Error('Connection timeout'));
        }, 10000);
        
        ws.on('open', () => {
          clearTimeout(connectionTimeout);
          logger.info('WebSocketConnectionManager: Trading events WebSocket connected');
          
          // Authenticate
          this.authenticateConnection(ws, 'tradingEvents');
          
          // Set up event handlers
          this.setupEventHandlers(ws, 'tradingEvents');
          
          // Reset reconnect attempts
          this.manager.setReconnectAttempts('tradingEvents', 0);
          this.manager.setReconnectDelay(1000); // Reset to initial delay
          
          resolve();
        });
        
        ws.on('error', (error) => {
          clearTimeout(connectionTimeout);
          logger.error('WebSocketConnectionManager: Trading events WebSocket connection error', error);
          reject(error);
        });
      } catch (error) {
        logger.error('WebSocketConnectionManager: Failed to create trading events WebSocket', error);
        reject(error);
      }
    });
  }
  
  /**
   * Authenticate WebSocket connection
   * @param ws WebSocket instance
   * @param type Type of WebSocket connection
   */
  private authenticateConnection(ws: WebSocket, type: WebSocketType): void {
    const authMessage = {
      action: 'auth',
      key: this.manager.getApiKey(),
      secret: this.manager.getSecretKey()
    };
    
    ws.send(JSON.stringify(authMessage));
    logger.info(`WebSocketConnectionManager: Sent authentication for ${type} WebSocket`);
  }
  
  /**
   * Set up event handlers for WebSocket connection
   * @param ws WebSocket instance
   * @param type Type of WebSocket connection
   */
  private setupEventHandlers(ws: WebSocket, type: WebSocketType): void {
    // Message handler
    ws.on('message', (data) => {
      if (type === 'marketData') {
        // Forward to market data handler
        const marketDataHandler = (this.manager as any).marketDataHandler;
        if (marketDataHandler && typeof marketDataHandler.handleMessage === 'function') {
          marketDataHandler.handleMessage(data);
        }
      } else {
        // Forward to trading events handler
        const tradingEventsHandler = (this.manager as any).tradingEventsHandler;
        if (tradingEventsHandler && typeof tradingEventsHandler.handleMessage === 'function') {
          tradingEventsHandler.handleMessage(data);
        }
      }
    });
    
    // Error handler
    ws.on('error', (error) => {
      this.handleError(error, type);
    });
    
    // Close handler
    ws.on('close', (code, reason) => {
      this.handleClose(code, reason.toString(), type);
    });
    
    // Emit connection event
    this.manager.emit(`${type}:connected`);
  }
  
  /**
   * Handle WebSocket error
   * @param error Error object
   * @param type Type of WebSocket connection
   */
  private handleError(error: Error, type: WebSocketType): void {
    logger.error(`WebSocketConnectionManager: ${type} WebSocket error`, error);
    this.manager.emit(`${type}:error`, error);
    
    // Don't attempt reconnect if shutting down
    if (!this.manager.isInShutdown()) {
      this.handleReconnect(type);
    }
  }
  
  /**
   * Handle WebSocket close
   * @param code Close code
   * @param reason Close reason
   * @param type Type of WebSocket connection
   */
  private handleClose(code: number, reason: string, type: WebSocketType): void {
    logger.info(`WebSocketConnectionManager: ${type} WebSocket closed with code ${code}: ${reason}`);
    
    // Clean up WebSocket reference
    if (type === 'marketData') {
      this.manager.setMarketDataWs(null);
    } else {
      this.manager.setTradingEventsWs(null);
    }
    
    this.manager.emit(`${type}:disconnected`, { code, reason });
    
    // Don't attempt reconnect if shutting down or if it was a normal closure
    if (!this.manager.isInShutdown() && code !== 1000) {
      this.handleReconnect(type);
    }
  }
  
  /**
   * Handle WebSocket reconnection
   * @param type Type of WebSocket connection
   */
  private handleReconnect(type: WebSocketType): void {
    const attempts = this.manager.getReconnectAttempts()[type];
    const maxAttempts = this.manager.getMaxReconnectAttempts();
    
    if (attempts >= maxAttempts) {
      logger.error(`WebSocketConnectionManager: Maximum reconnection attempts (${maxAttempts}) reached for ${type} WebSocket`);
      this.manager.emit(`${type}:reconnectFailed`);
      return;
    }
    
    // Increment reconnect attempts
    this.manager.setReconnectAttempts(type, attempts + 1);
    
    // Calculate delay with exponential backoff (max 60 seconds)
    const delay = Math.min(this.manager.getReconnectDelay() * Math.pow(2, attempts), 60000);
    
    logger.info(`WebSocketConnectionManager: Reconnecting ${type} WebSocket in ${delay}ms (attempt ${attempts + 1}/${maxAttempts})`);
    this.manager.emit(`${type}:reconnecting`, { attempt: attempts + 1, delay });
    
    // Schedule reconnection
    setTimeout(() => {
      if (type === 'marketData') {
        this.connectMarketData().catch(error => {
          logger.error(`WebSocketConnectionManager: Failed to reconnect market data WebSocket`, error);
        });
      } else {
        this.connectTradingEvents().catch(error => {
          logger.error(`WebSocketConnectionManager: Failed to reconnect trading events WebSocket`, error);
        });
      }
    }, delay);
  }
}
