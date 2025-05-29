/**
 * websocket-server.ts
 * 
 * This file contains the implementation for the WebSocket server.
 * Location: backend/src/services/websocket-server.ts
 * 
 * Responsibilities:
 * - Set up and manage WebSocket connections
 * - Broadcast real-time updates to connected clients
 * - Handle WebSocket subscriptions and messages
 * - Stream live market data updates
 */

import { Server as HttpServer } from 'http';
import WebSocket, { WebSocketServer as WSServer } from 'ws';
import { ArtificialOrderManager } from '../core/index.js';
import { AlpacaWebSocketController } from '../api/alpaca-websocket-controller.js';

/**
 * WebSocketServer class
 * 
 * Manages WebSocket connections and broadcasts real-time updates.
 */
export class WebSocketServer {
  private wss: WSServer;
  private subscriptions: Map<WebSocket, Set<string>> = new Map();
  private liveStreamIntervals: Map<string, NodeJS.Timeout> = new Map();
  private alpacaWebSocketController: AlpacaWebSocketController;
  
  /**
   * Constructor for WebSocketServer
   * @param server - HTTP server to attach WebSocket server to
   * @param alpacaClient - Alpaca client instance
   * @param orderManager - Artificial order manager instance
   */
  constructor(
    server: HttpServer,
    private alpacaClient: any,
    private orderManager: ArtificialOrderManager
  ) {
    // Create WebSocket server
    this.wss = new WSServer({ server });
    
    // Initialize the Alpaca WebSocket controller
    this.alpacaWebSocketController = new AlpacaWebSocketController(alpacaClient);
    
    // Set up event handlers
    this.setupEventHandlers();
    
    // Set up heartbeat
    this.setupHeartbeat();
    
    // Expose globally for access from other parts of the application
    global.wss = this.wss;
  }
  
  /**
   * Set up WebSocket event handlers
   */
  private setupEventHandlers(): void {
    this.wss.on('connection', (ws: WebSocket) => {
      console.log('Client connected to WebSocket');
      
      // Initialize client's subscriptions
      this.subscriptions.set(ws, new Set());
      
      // Send welcome message
      this.sendMessage(ws, {
        type: 'connection_established',
        data: {
          timestamp: new Date().toISOString()
        }
      });
      
      // Handle messages from client
      ws.on('message', (message: string) => {
        try {
          const parsedMessage = JSON.parse(message);
          this.handleClientMessage(ws, parsedMessage);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
          this.sendMessage(ws, {
            type: 'error',
            data: {
              code: 'INVALID_MESSAGE',
              message: 'Invalid message format',
              timestamp: new Date().toISOString()
            }
          });
        }
      });
      
      // Handle client disconnect
      ws.on('close', () => {
        console.log('Client disconnected from WebSocket');
        this.handleClientDisconnect(ws);
      });
    });
  }
  
  /**
   * Handle client disconnect
   */
  private handleClientDisconnect(ws: WebSocket): void {
    // Get client's subscriptions
    const clientSubscriptions = this.subscriptions.get(ws);
    
    if (clientSubscriptions) {
      // Stop any live streams for symbols this client was subscribed to
      clientSubscriptions.forEach(subscription => {
        if (subscription.startsWith('market_data:')) {
          const symbol = subscription.split(':')[1];
          this.stopLiveStreamIfNoSubscribers(symbol);
        }
      });
    }
    
    // Remove client from subscriptions
    this.subscriptions.delete(ws);
  }
  
  /**
   * Stop live stream for a symbol if no clients are subscribed
   */
  private stopLiveStreamIfNoSubscribers(symbol: string): void {
    // Check if any client is still subscribed to this symbol
    let hasSubscribers = false;
    this.subscriptions.forEach(clientSubs => {
      if (clientSubs.has(`market_data:${symbol}`)) {
        hasSubscribers = true;
      }
    });
    
    // If no subscribers, stop the live stream
    if (!hasSubscribers) {
      const intervalId = this.liveStreamIntervals.get(symbol);
      if (intervalId) {
        clearInterval(intervalId);
        this.liveStreamIntervals.delete(symbol);
        console.log(`Stopped live stream for ${symbol} - no subscribers`);
      }
    }
  }
  
  /**
   * Set up heartbeat to keep connections alive
   */
  private setupHeartbeat(): void {
    const interval = setInterval(() => {
      this.wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          this.sendMessage(client, {
            type: 'heartbeat',
            data: {
              timestamp: new Date().toISOString()
            }
          });
        }
      });
    }, 30000); // 30 seconds
    
    // Clear interval when server closes
    this.wss.on('close', () => {
      clearInterval(interval);
      
      // Clear all live stream intervals
      this.liveStreamIntervals.forEach(intervalId => {
        clearInterval(intervalId);
      });
      this.liveStreamIntervals.clear();
    });
  }
  
  /**
   * Handle messages from clients
   * @param ws - WebSocket connection
   * @param message - Parsed message from client
   */
  private handleClientMessage(ws: WebSocket, message: any): void {
    const { type, action, data } = message;
    
    // Handle both old and new message formats
    const messageType = type || action;
    
    switch (messageType) {
      case 'subscribe':
        this.handleSubscribe(ws, message);
        break;
      
      case 'unsubscribe':
        this.handleUnsubscribe(ws, message);
        break;
      
      default:
        this.sendMessage(ws, {
          type: 'error',
          data: {
            code: 'UNKNOWN_MESSAGE_TYPE',
            message: `Unknown message type: ${messageType}`,
            timestamp: new Date().toISOString()
          }
        });
    }
  }
  
  /**
   * Handle subscription requests
   * @param ws - WebSocket connection
   * @param message - Subscription message
   */
  private async handleSubscribe(ws: WebSocket, message: any): Promise<void> {
    const { symbols = [], dataTypes = [], channels = [], data } = message;
    const clientSubscriptions = this.subscriptions.get(ws);
    
    if (!clientSubscriptions) return;
    
    // Handle both old and new formats
    const symbolsToSubscribe = symbols.length > 0 ? symbols : (data?.symbols || []);
    const channelsToSubscribe = channels.length > 0 ? channels : (data?.channels || dataTypes);
    
    // Add new subscriptions
    for (const symbol of symbolsToSubscribe) {
      for (const channel of channelsToSubscribe) {
        const subscription = `${channel}:${symbol}`;
        clientSubscriptions.add(subscription);
        
        // If it's a market data subscription, start live streaming
        if (channel === 'market_data') {
          await this.startLiveStreamForSymbol(symbol);
          // Send initial data immediately
          await this.sendInitialMarketData(ws, symbol);
        }
      }
    }
    
    // Confirm subscription
    this.sendMessage(ws, {
      type: 'subscription_success',
      data: {
        symbols: symbolsToSubscribe,
        channels: channelsToSubscribe,
        timestamp: new Date().toISOString()
      }
    });
  }
  
  /**
   * Handle unsubscribe requests
   * @param ws - WebSocket connection
   * @param message - Unsubscribe message
   */
  private handleUnsubscribe(ws: WebSocket, message: any): void {
    const { symbols = [], dataTypes = [], channels = [], data } = message;
    const clientSubscriptions = this.subscriptions.get(ws);
    
    if (!clientSubscriptions) return;
    
    // Handle both old and new formats
    const symbolsToUnsubscribe = symbols.length > 0 ? symbols : (data?.symbols || []);
    const channelsToUnsubscribe = channels.length > 0 ? channels : (data?.channels || dataTypes);
    
    // Remove subscriptions
    for (const symbol of symbolsToUnsubscribe) {
      for (const channel of channelsToUnsubscribe) {
        const subscription = `${channel}:${symbol}`;
        clientSubscriptions.delete(subscription);
        
        // If it's a market data subscription, potentially stop live streaming
        if (channel === 'market_data') {
          this.stopLiveStreamIfNoSubscribers(symbol);
        }
      }
    }
    
    // Confirm unsubscription
    this.sendMessage(ws, {
      type: 'unsubscription_success',
      data: {
        symbols: symbolsToUnsubscribe,
        channels: channelsToUnsubscribe,
        timestamp: new Date().toISOString()
      }
    });
  }
  
  /**
   * Start live streaming for a symbol
   * @param symbol - Symbol to stream
   */
  private async startLiveStreamForSymbol(symbol: string): Promise<void> {
    try {
      if (this.liveStreamIntervals.has(symbol)) {
        console.log(`Live stream for ${symbol} already running`);
        return;
      }
      
      // Use the AlpacaWebSocketController to subscribe to market data
      await this.alpacaWebSocketController.subscribeToMarketData(symbol, (marketData) => {
        // When market data is received, broadcast it to all subscribed clients
        this.broadcastMarketData(symbol, marketData);
      });
      
      // Set up interval to fetch and broadcast market data
      const intervalId = setInterval(() => {
        this.fetchAndBroadcastMarketData(symbol).catch(error => {
          console.error(`Error fetching market data for ${symbol}:`, error);
        });
      }, 5000); // Update every 5 seconds
      
      this.liveStreamIntervals.set(symbol, intervalId);
      console.log(`Live stream started for ${symbol}`);
    } catch (error) {
      console.error(`Failed to start live stream for ${symbol}:`, error);
    }
  }
  
  /**
   * Fetch and broadcast market data for a symbol
   * @param symbol - Symbol to fetch data for
   */
  private async fetchAndBroadcastMarketData(symbol: string): Promise<void> {
    try {
      const isCrypto = symbol.includes('/');
      let marketData: any;
      
      if (isCrypto) {
        const snapshots = await this.alpacaClient.getCryptoSnapshots([symbol]);
        marketData = {
          symbol,
          bar: snapshots.snapshots?.[symbol]?.latestBar || null,
          quote: snapshots.snapshots?.[symbol]?.latestQuote || null,
          asset: null,
          isCrypto: true,
          timestamp: new Date().toISOString()
        };
      } else {
        const [barData, quoteData, assetData] = await Promise.all([
          this.alpacaClient.getStocksBarsLatest([symbol]).catch(() => ({ bars: {} })),
          this.alpacaClient.getStocksQuotesLatest([symbol]).catch(() => ({ quotes: {} })),
          this.alpacaClient.getAsset(symbol).catch(() => null)
        ]);
        
        marketData = {
          symbol,
          bar: barData.bars?.[symbol] || null,
          quote: quoteData.quotes?.[symbol] || null,
          asset: assetData || null,
          isCrypto: false,
          timestamp: new Date().toISOString()
        };
      }
      
      // Broadcast the market data to all subscribed clients
      this.broadcastMarketData(symbol, marketData);
      
    } catch (error) {
      console.error(`Error fetching and broadcasting market data for ${symbol}:`, error);
    }
  }
  
  /**
   * Send initial market data to a specific client
   * @param ws - WebSocket connection
   * @param symbol - Symbol to send data for
   */
  private async sendInitialMarketData(ws: WebSocket, symbol: string): Promise<void> {
    try {
      const isCrypto = symbol.includes('/');
      let marketData: any;
      
      if (isCrypto) {
        const snapshots = await this.alpacaClient.getCryptoSnapshots([symbol]);
        marketData = {
          symbol,
          bar: snapshots.snapshots?.[symbol]?.latestBar || null,
          quote: snapshots.snapshots?.[symbol]?.latestQuote || null,
          asset: null,
          isCrypto: true,
          timestamp: new Date().toISOString()
        };
      } else {
        const [barData, quoteData, assetData] = await Promise.all([
          this.alpacaClient.getStocksBarsLatest([symbol]).catch(() => ({ bars: {} })),
          this.alpacaClient.getStocksQuotesLatest([symbol]).catch(() => ({ quotes: {} })),
          this.alpacaClient.getAsset(symbol).catch(() => null)
        ]);
        
        marketData = {
          symbol,
          bar: barData.bars?.[symbol] || null,
          quote: quoteData.quotes?.[symbol] || null,
          asset: assetData || null,
          isCrypto: false,
          timestamp: new Date().toISOString()
        };
      }
      
      // Send initial market data
      this.sendMessage(ws, {
        type: 'market_data',
        payload: marketData
      });
      
    } catch (error) {
      console.error(`Error sending initial market data for ${symbol}:`, error);
    }
  }
  
  /**
   * Send a message to a WebSocket client
   * @param ws - WebSocket connection
   * @param message - Message to send
   */
  private sendMessage(ws: WebSocket, message: any): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }
  
  /**
   * Broadcast a message to all subscribed clients
   * @param type - Data type (e.g., 'quotes', 'trades')
   * @param symbol - Stock symbol
   * @param data - Data to broadcast
   */
  public broadcast(type: string, symbol: string, data: any): void {
    const subscription = `${type}:${symbol}`;
    
    this.wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        const clientSubscriptions = this.subscriptions.get(client);
        
        if (clientSubscriptions && clientSubscriptions.has(subscription)) {
          this.sendMessage(client, {
            type,
            data: {
              ...data,
              symbol,
              timestamp: new Date().toISOString()
            }
          });
        }
      }
    });
  }

  /**
   * Broadcast market data update to all subscribed clients
   * @param symbol - Stock symbol
   * @param marketData - Market data to broadcast
   */
  public broadcastMarketData(symbol: string, marketData: any): void {
    const subscription = `market_data:${symbol}`;
    
    this.wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        const clientSubscriptions = this.subscriptions.get(client);
        
        if (clientSubscriptions && clientSubscriptions.has(subscription)) {
          this.sendMessage(client, {
            type: 'market_data_update',
            payload: {
              ...marketData,
              symbol,
              timestamp: new Date().toISOString()
            }
          });
        }
      }
    });
  }
  
  /**
   * Broadcast an order update to all clients
   * @param order - Order data
   */
  public broadcastOrderUpdate(order: any): void {
    this.broadcast('order_update', order.symbol, order);
  }
  
  /**
   * Broadcast a position update to all clients
   * @param position - Position data
   */
  public broadcastPositionUpdate(position: any): void {
    this.broadcast('position_update', position.symbol, position);
  }
  
  /**
   * Get connection statistics
   */
  public getStats(): any {
    const connectionCount = this.wss.clients.size;
    const subscriptionCount = Array.from(this.subscriptions.values())
      .reduce((total, subs) => total + subs.size, 0);
    const liveStreamCount = this.liveStreamIntervals.size;
    
    return {
      connections: connectionCount,
      subscriptions: subscriptionCount,
      liveStreams: liveStreamCount,
      symbols: Array.from(this.liveStreamIntervals.keys())
    };
  }
  
  /**
   * Close the WebSocket server
   */
  public close(): void {
    // Clear all live stream intervals
    this.liveStreamIntervals.forEach(intervalId => {
      clearInterval(intervalId);
    });
    this.liveStreamIntervals.clear();
    
    this.wss.close();
  }
}

/**
 * Set up the WebSocket server
 * @param server - HTTP server to attach WebSocket server to
 * @param alpacaClient - Alpaca client instance
 * @param orderManager - Artificial order manager instance
 * @returns WebSocketServer instance
 */
export function setupWebSocketServer(
  server: HttpServer,
  alpacaClient: any,
  orderManager: ArtificialOrderManager
): WebSocketServer {
  return new WebSocketServer(server, alpacaClient, orderManager);
}