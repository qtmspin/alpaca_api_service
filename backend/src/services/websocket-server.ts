/**
 * websocket-server.ts
 * 
 * Main WebSocket server integration for the Alpaca API Service
 * Integrates the AlpacaWebSocketManager with the HTTP server
 * 
 * Location: backend/src/services/websocket-server.ts
 * 
 * Responsibilities:
 * - Initialize WebSocket connections to Alpaca
 * - Manage WebSocket connections for clients
 * - Bridge between client WebSockets and Alpaca WebSockets
 * - Support artificial order monitoring
 */

import { Server as HttpServer } from 'http';
import * as ws from 'ws';
import { AlpacaClient } from './alpaca-client.js';
import { AlpacaWebSocketManager } from './websocket/alpaca-websocket-manager.js';
import { logger } from '../utils/logger.js';

// Import types for artificial orders
type ArtificialOrderManager = any;

// For compatibility with the existing codebase
const WebSocket = ws.default || ws;

/**
 * WebSocket server for the Alpaca API Service
 * Provides real-time market data and trading events to clients
 */
export class WebSocketServer {
  private wss: any; // WebSocket.Server
  private alpacaClient: AlpacaClient;
  private orderManager: ArtificialOrderManager;
  private alpacaWsManager: AlpacaWebSocketManager;
  private clients: Set<WebSocket> = new Set();
  private clientMessageHandlers: Map<string, Function> = new Map();
  
  /**
   * Constructor
   * @param server HTTP server to attach WebSocket server to
   * @param alpacaClient Alpaca client instance
   * @param orderManager Artificial order manager instance
   */
  constructor(server: HttpServer, alpacaClient: AlpacaClient, orderManager: ArtificialOrderManager) {
    // Create WebSocket server
    this.wss = new ws.Server({ server });
    this.alpacaClient = alpacaClient;
    this.orderManager = orderManager;
    this.alpacaWsManager = new AlpacaWebSocketManager();
    
    // Set up client connection handling
    this.setupClientConnections();
    
    logger.info('WebSocketServer: Initialized');
  }
  
  /**
   * Initialize WebSocket connections to Alpaca
   * @param apiKey Alpaca API key
   * @param secretKey Alpaca API secret key
   * @param isPaper Whether to use paper trading
   */
  public async initialize(apiKey: string, secretKey: string, isPaper: boolean): Promise<void> {
    try {
      // Initialize Alpaca WebSocket manager
      await this.alpacaWsManager.initialize(apiKey, secretKey, isPaper);
      
      // Set up event forwarding from Alpaca to clients
      this.setupEventForwarding();
      
      // Set up artificial order monitoring
      this.setupArtificialOrderMonitoring();
      
      logger.info('WebSocketServer: Initialized successfully');
    } catch (error) {
      logger.error('WebSocketServer: Initialization failed', error);
      throw error;
    }
  }
  
  /**
   * Set up client WebSocket connections
   */
  private setupClientConnections(): void {
    this.wss.on('connection', (ws: WebSocket) => {
      // Add client to set
      this.clients.add(ws);
      logger.info(`WebSocketServerRefactored: Client connected (${this.clients.size} total)`);
      
      // Send initial connection status
      this.sendToClient(ws, {
        type: 'connection_status',
        status: 'connected',
        message: 'Connected to WebSocket server'
      });
      
      // Set up client message handling
      ws.on('message', (data: WebSocket.Data) => {
        this.handleClientMessage(ws, data);
      });
      
      // Handle client disconnect
      ws.on('close', () => {
        this.clients.delete(ws);
        logger.info(`WebSocketServerRefactored: Client disconnected (${this.clients.size} remaining)`);
      });
      
      // Handle errors
      ws.on('error', (error) => {
        logger.error('WebSocketServer: Client connection error', error);
        this.clients.delete(ws);
      });
    });
  }
  
  /**
   * Handle messages from clients
   * @param ws Client WebSocket
   * @param data Message data
   */
  private handleClientMessage(ws: WebSocket, data: WebSocket.Data): void {
    try {
      const message = JSON.parse(data.toString());
      
      // Handle different message types
      switch (message.type) {
        case 'subscribe_market_data':
          this.handleSubscribeMarketData(ws, message);
          break;
          
        case 'unsubscribe_market_data':
          this.handleUnsubscribeMarketData(ws, message);
          break;
          
        case 'get_connection_status':
          this.handleGetConnectionStatus(ws);
          break;
          
        case 'ping':
          this.sendToClient(ws, { type: 'pong', timestamp: Date.now() });
          break;
          
        default:
          logger.warn(`WebSocketServerRefactored: Unknown message type: ${message.type}`);
          this.sendToClient(ws, {
            type: 'error',
            message: `Unknown message type: ${message.type}`
          });
          break;
      }
    } catch (error) {
      logger.error('WebSocketServer: Error parsing client message', error);
      this.sendToClient(ws, {
        type: 'error',
        message: 'Invalid message format'
      });
    }
  }
  
  /**
   * Handle subscribe_market_data message
   * @param ws Client WebSocket
   * @param message Message data
   */
  private handleSubscribeMarketData(ws: WebSocket, message: any): void {
    const { symbols, channels } = message;
    
    if (!symbols || !Array.isArray(symbols) || symbols.length === 0) {
      this.sendToClient(ws, {
        type: 'error',
        message: 'Invalid symbols'
      });
      return;
    }
    
    // Subscribe to market data
    this.alpacaWsManager.subscribeToMarketData(symbols, channels);
    
    // Register client-specific handlers for these symbols
    symbols.forEach(symbol => {
      // For trades
      const tradeHandler = (data: any) => {
        if (data.symbol === symbol) {
          this.sendToClient(ws, {
            type: 'market_data',
            subType: 'trade',
            data
          });
        }
      };
      
      // For quotes
      const quoteHandler = (data: any) => {
        if (data.symbol === symbol) {
          this.sendToClient(ws, {
            type: 'market_data',
            subType: 'quote',
            data
          });
        }
      };
      
      // Store handlers so we can remove them later
      this.clientMessageHandlers.set(`trade:${symbol}:${ws.url}`, tradeHandler);
      this.clientMessageHandlers.set(`quote:${symbol}:${ws.url}`, quoteHandler);
      
      // Register handlers
      this.alpacaWsManager.on(`trade:${symbol}`, tradeHandler);
      this.alpacaWsManager.on(`quote:${symbol}`, quoteHandler);
    });
    
    this.sendToClient(ws, {
      type: 'subscription_success',
      symbols,
      channels
    });
  }
  
  /**
   * Handle unsubscribe_market_data message
   * @param ws Client WebSocket
   * @param message Message data
   */
  private handleUnsubscribeMarketData(ws: WebSocket, message: any): void {
    const { symbols } = message;
    
    if (!symbols || !Array.isArray(symbols) || symbols.length === 0) {
      this.sendToClient(ws, {
        type: 'error',
        message: 'Invalid symbols'
      });
      return;
    }
    
    // Remove client-specific handlers for these symbols
    symbols.forEach(symbol => {
      const tradeHandlerKey = `trade:${symbol}:${ws.url}`;
      const quoteHandlerKey = `quote:${symbol}:${ws.url}`;
      
      if (this.clientMessageHandlers.has(tradeHandlerKey)) {
        this.alpacaWsManager.off(`trade:${symbol}`, this.clientMessageHandlers.get(tradeHandlerKey)!);
        this.clientMessageHandlers.delete(tradeHandlerKey);
      }
      
      if (this.clientMessageHandlers.has(quoteHandlerKey)) {
        this.alpacaWsManager.off(`quote:${symbol}`, this.clientMessageHandlers.get(quoteHandlerKey)!);
        this.clientMessageHandlers.delete(quoteHandlerKey);
      }
    });
    
    this.sendToClient(ws, {
      type: 'unsubscription_success',
      symbols
    });
  }
  
  /**
   * Handle get_connection_status message
   * @param ws Client WebSocket
   */
  private handleGetConnectionStatus(ws: WebSocket): void {
    const status = this.alpacaWsManager.getConnectionStatus();
    
    this.sendToClient(ws, {
      type: 'connection_status',
      marketData: status.marketData,
      tradingEvents: status.tradingEvents
    });
  }
  
  /**
   * Set up event forwarding from Alpaca to clients
   */
  private setupEventForwarding(): void {
    // Forward order updates to all clients
    this.alpacaWsManager.on('orderUpdate', (data: any) => {
      this.broadcastToClients({
        type: 'order_update',
        data
      });
    });
    
    // Forward connection status changes
    this.alpacaWsManager.on('marketData:connected', () => {
      this.broadcastToClients({
        type: 'connection_status',
        service: 'marketData',
        status: 'connected'
      });
    });
    
    this.alpacaWsManager.on('marketData:disconnected', () => {
      this.broadcastToClients({
        type: 'connection_status',
        service: 'marketData',
        status: 'disconnected'
      });
    });
    
    this.alpacaWsManager.on('tradingEvents:connected', () => {
      this.broadcastToClients({
        type: 'connection_status',
        service: 'tradingEvents',
        status: 'connected'
      });
    });
    
    this.alpacaWsManager.on('tradingEvents:disconnected', () => {
      this.broadcastToClients({
        type: 'connection_status',
        service: 'tradingEvents',
        status: 'disconnected'
      });
    });
  }
  
  /**
   * Set up artificial order monitoring
   */
  private setupArtificialOrderMonitoring(): void {
    // Register the order manager with the WebSocket manager for price monitoring
    this.orderManager.registerPriceMonitor((symbols: string[], callback: Function) => {
      return this.alpacaWsManager.monitorPriceForOrders(symbols, callback as any);
    });
    
    // Register the unsubscribe function
    this.orderManager.registerUnsubscribeFunction((monitorId: string) => {
      this.alpacaWsManager.stopMonitoringSymbol(monitorId);
    });
    
    logger.info('WebSocketServer: Artificial order monitoring set up');
  }
  
  /**
   * Send a message to a specific client
   * @param ws Client WebSocket
   * @param message Message to send
   */
  private sendToClient(ws: WebSocket, message: any): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }
  
  /**
   * Broadcast a message to all connected clients
   * @param message Message to broadcast
   */
  private broadcastToClients(message: any): void {
    const messageStr = JSON.stringify(message);
    
    this.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(messageStr);
      }
    });
  }
  
  /**
   * Shutdown the WebSocket server
   */
  public async shutdown(): Promise<void> {
    logger.info('WebSocketServer: Shutting down...');
    
    // Shutdown Alpaca WebSocket manager
    await this.alpacaWsManager.shutdown();
    
    // Close all client connections
    this.clients.forEach(client => {
      client.close();
    });
    
    // Clear client set
    this.clients.clear();
    
    // Close WebSocket server
    this.wss.close();
    
    logger.info('WebSocketServer: Shutdown complete');
  }
}
