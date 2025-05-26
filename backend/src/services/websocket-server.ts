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
 */

import { Server as HttpServer } from 'http';
import WebSocket from 'ws';
import { ArtificialOrderManager } from '../core';

/**
 * WebSocketServer class
 * 
 * Manages WebSocket connections and broadcasts real-time updates.
 */
export class WebSocketServer {
  private wss: WebSocket.Server;
  private subscriptions: Map<WebSocket, Set<string>> = new Map();
  
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
    this.wss = new WebSocket.Server({ server });
    
    // Set up event handlers
    this.setupEventHandlers();
    
    // Set up heartbeat
    this.setupHeartbeat();
  }
  
  /**
   * Set up WebSocket event handlers
   */
  private setupEventHandlers(): void {
    this.wss.on('connection', (ws: WebSocket) => {
      console.log('Client connected');
      
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
        console.log('Client disconnected');
        this.subscriptions.delete(ws);
      });
    });
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
    });
  }
  
  /**
   * Handle messages from clients
   * @param ws - WebSocket connection
   * @param message - Parsed message from client
   */
  private handleClientMessage(ws: WebSocket, message: any): void {
    const { type, data } = message;
    
    switch (type) {
      case 'subscribe':
        this.handleSubscribe(ws, data);
        break;
      
      case 'unsubscribe':
        this.handleUnsubscribe(ws, data);
        break;
      
      default:
        this.sendMessage(ws, {
          type: 'error',
          data: {
            code: 'UNKNOWN_MESSAGE_TYPE',
            message: `Unknown message type: ${type}`,
            timestamp: new Date().toISOString()
          }
        });
    }
  }
  
  /**
   * Handle subscription requests
   * @param ws - WebSocket connection
   * @param data - Subscription data
   */
  private async handleSubscribe(ws: WebSocket, data: any): Promise<void> {
    const { symbols = [], dataTypes = [], channels = [] } = data;
    const clientSubscriptions = this.subscriptions.get(ws);
    
    if (!clientSubscriptions) return;
    
    // Add new subscriptions
    for (const symbol of symbols) {
      for (const dataType of dataTypes) {
        const subscription = `${dataType}:${symbol}`;
        clientSubscriptions.add(subscription);
      }
      
      // Add channel-based subscriptions (new format)
      for (const channel of channels) {
        const subscription = `${channel}:${symbol}`;
        clientSubscriptions.add(subscription);
      }
    }
    
    // If market_data channel is requested, fetch initial data
    if (channels.includes('market_data') && symbols.length > 0) {
      try {
        // Ensure Alpaca client is initialized
        if (this.alpacaClient.isInitialized()) {
          for (const symbol of symbols) {
            try {
              // Get latest bar, quote, and asset info
              const [barData, quoteData, assetData] = await Promise.all([
                this.alpacaClient.getStocksBarsLatest([symbol]),
                this.alpacaClient.getStocksQuotesLatest([symbol]),
                this.alpacaClient.getAsset(symbol)
              ]);
              
              // Combine the data
              const marketData = {
                symbol,
                bar: barData[symbol] || null,
                quote: quoteData[symbol] || null,
                asset: assetData || null,
                timestamp: new Date().toISOString()
              };
              
              // Send initial market data
              this.sendMessage(ws, {
                type: 'market_data',
                payload: marketData
              });
            } catch (error) {
              console.error(`Error fetching initial market data for ${symbol}:`, error);
            }
          }
        }
      } catch (error) {
        console.error('Error handling market data subscription:', error);
      }
    }
    
    // Confirm subscription
    this.sendMessage(ws, {
      type: 'subscription_success',
      data: {
        symbols,
        dataTypes,
        channels,
        timestamp: new Date().toISOString()
      }
    });
  }
  
  /**
   * Handle unsubscribe requests
   * @param ws - WebSocket connection
   * @param data - Unsubscribe data
   */
  private handleUnsubscribe(ws: WebSocket, data: any): void {
    const { symbols = [], dataTypes = [], channels = [] } = data;
    const clientSubscriptions = this.subscriptions.get(ws);
    
    if (!clientSubscriptions) return;
    
    // Remove subscriptions
    for (const symbol of symbols) {
      for (const dataType of dataTypes) {
        const subscription = `${dataType}:${symbol}`;
        clientSubscriptions.delete(subscription);
      }
      
      // Remove channel-based subscriptions (new format)
      for (const channel of channels) {
        const subscription = `${channel}:${symbol}`;
        clientSubscriptions.delete(subscription);
      }
    }
    
    // Confirm unsubscription
    this.sendMessage(ws, {
      type: 'unsubscription_success',
      data: {
        symbols,
        dataTypes,
        channels,
        timestamp: new Date().toISOString()
      }
    });
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
          // Special handling for market data
          if (type === 'market_data') {
            this.sendMessage(client, {
              type,
              payload: {
                ...data,
                symbol,
                timestamp: new Date().toISOString()
              }
            });
          } else {
            // Standard format for other data types
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
      }
    });
  }

  /**
   * Broadcast market data update to all subscribed clients
   * @param symbol - Stock symbol
   * @param marketData - Market data to broadcast
   */
  public broadcastMarketData(symbol: string, marketData: any): void {
    this.broadcast('market_data', symbol, marketData);
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
   * Close the WebSocket server
   */
  public close(): void {
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
