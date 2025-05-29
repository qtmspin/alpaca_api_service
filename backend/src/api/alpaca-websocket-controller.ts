/**
 * alpaca-websocket-controller.ts
 * 
 * This file handles WebSocket connections for Alpaca market data, orders, and positions.
 * Location: backend/src/api/alpaca-websocket-controller.ts
 * 
 * Responsibilities:
 * - Handle WebSocket connections for market data
 * - Manage subscriptions to real-time market data
 * - Stream real-time order and position updates
 * - Broadcast connection status updates
 */

import { AlpacaClient } from '../services/alpaca-client.js';
import { MarketDataSubscriptionManager } from '../core/market-data-subscription.js';
import { OrderUpdate, PositionUpdate } from '../core/orders-positions-subscription.js';
import WebSocket from 'ws';

// Declare global WebSocket server
declare global {
  var wss: any | undefined;
}

/**
 * AlpacaWebSocketController
 * Handles WebSocket connections for Alpaca market data, orders, and positions
 */
export class AlpacaWebSocketController {
  private alpacaClient: AlpacaClient;
  private marketDataManager: MarketDataSubscriptionManager;
  
  // Track WebSocket clients subscribed to orders and positions
  private ordersSubscribers: Set<WebSocket> = new Set();
  private positionsSubscribers: Set<WebSocket> = new Set();
  
  constructor(alpacaClient: AlpacaClient) {
    this.alpacaClient = alpacaClient;
    this.marketDataManager = new MarketDataSubscriptionManager();
    this.initialize();
  }
  
  /**
   * Initialize the WebSocket controller
   */
  private initialize(): void {
    // Initialize WebSocket handlers if available
    if (global.wss) {
      this.initializeWebSocketHandlers();
    }
    
    // Initialize WebSocket streams
    try {
      // Initialize orders and positions stream
      this.alpacaClient.initOrdersPositionsStream();
      console.log('Initialized orders and positions WebSocket streams');
      
      // Get API credentials from the Alpaca client
      const config = this.alpacaClient.getConfig();
      if (config && config.apiKey && config.secretKey) {
        // Initialize market data stream with API credentials
        this.marketDataManager.initialize(config.apiKey, config.secretKey, false);
        console.log('Initialized market data WebSocket stream');
        
        // Set up event handlers for market data stream
        this.setupMarketDataHandlers();
      } else {
        console.warn('Could not initialize market data stream: API credentials not available');
      }
      
      // Set up handlers for orders and positions updates
      this.setupOrdersPositionsHandlers();
    } catch (error) {
      console.error('Failed to initialize WebSocket streams:', error);
    }
  }
  
  /**
   * Initialize WebSocket handlers for client connections
   */
  private initializeWebSocketHandlers(): void {
    if (!global.wss) return;
    
    global.wss.on('connection', (ws: WebSocket) => {
      console.log('New WebSocket client connected');
      
      // Send initial connection status
      this.sendConnectionStatus(ws);
      
      // Handle client messages
      ws.on('message', async (message: string) => {
        try {
          const data = JSON.parse(message.toString());
          console.log('Received WebSocket message:', data);
          
          // Handle subscription requests
          if (data.action === 'subscribe') {
            await this.handleSubscription(ws, data);
          }
          
          // Handle unsubscription requests
          if (data.action === 'unsubscribe') {
            // Store unsubscription info on the WebSocket client
            (ws as any).unsubscribed = {
              ...(ws as any).unsubscribed || {},
              channels: data.channels || [],
              symbols: data.symbols || []
            };
            
            // Handle unsubscription from orders/positions streams
            if (data.channels?.includes('orders')) {
              this.handleOrdersUnsubscription(ws);
            }
            
            if (data.channels?.includes('positions')) {
              this.handlePositionsUnsubscription(ws);
            }
            
            // Handle unsubscription from market data
            if (data.symbols && data.symbols.length > 0) {
              data.symbols.forEach((symbol: string) => {
                // Remove the symbol from the client's subscriptions
                if ((ws as any).subscribed?.symbols) {
                  (ws as any).subscribed.symbols = (ws as any).subscribed.symbols
                    .filter((s: string) => s !== symbol);
                }
                
                // Check if any other clients are subscribed to this symbol
                let hasOtherSubscribers = false;
                global.wss.clients.forEach((client: WebSocket) => {
                  if (client !== ws && 
                      client.readyState === WebSocket.OPEN && 
                      (client as any).subscribed?.symbols?.includes(symbol)) {
                    hasOtherSubscribers = true;
                  }
                });
                
                // If no other clients are subscribed, unsubscribe from market data
                if (!hasOtherSubscribers) {
                  this.marketDataManager.unsubscribe(symbol);
                }
              });
            }
          }
        } catch (error) {
          console.error('Error processing WebSocket message:', error);
          ws.send(JSON.stringify({
            type: 'error',
            payload: {
              message: error instanceof Error ? error.message : 'Invalid message format'
            }
          }));
        }
      });
      
      // Handle client disconnect
      ws.on('close', () => {
        console.log('Client disconnected from WebSocket');
        
        // Clean up any order/position subscriptions
        this.handleOrdersUnsubscription(ws);
        this.handlePositionsUnsubscription(ws);
        
        // Clean up any market data subscriptions
        if ((ws as any).subscribed?.symbols) {
          (ws as any).subscribed.symbols.forEach((symbol: string) => {
            // Check if any other clients are subscribed to this symbol
            let hasOtherSubscribers = false;
            global.wss.clients.forEach((client: WebSocket) => {
              if (client !== ws && 
                  client.readyState === WebSocket.OPEN && 
                  (client as any).subscribed?.symbols?.includes(symbol)) {
                hasOtherSubscribers = true;
              }
            });
            
            // If no other clients are subscribed, unsubscribe from market data
            if (!hasOtherSubscribers) {
              this.marketDataManager.unsubscribe(symbol);
            }
          });
        }
      });
    });
  }
  
  /**
   * Set up handlers for market data WebSocket stream
   */
  private setupMarketDataHandlers(): void {
    // Handle connection events
    this.marketDataManager.on('connected', () => {
      console.log('Market data WebSocket connected');
      this.broadcastStatus();
    });
    
    this.marketDataManager.on('disconnected', () => {
      console.log('Market data WebSocket disconnected');
      this.broadcastStatus();
    });
    
    this.marketDataManager.on('error', (error) => {
      console.error('Market data WebSocket error:', error);
      this.broadcastStatus();
    });
    
    // Handle subscription events
    this.marketDataManager.on('subscribed', (symbol) => {
      console.log(`Subscribed to market data for ${symbol}`);
    });
    
    this.marketDataManager.on('unsubscribed', (symbol) => {
      console.log(`Unsubscribed from market data for ${symbol}`);
    });
  }
  
  /**
   * Set up handlers for real-time order and position updates
   */
  private setupOrdersPositionsHandlers(): void {
    const ordersPositionsManager = this.alpacaClient.getOrdersPositionsManager();
    if (!ordersPositionsManager) return;
    
    // Handle order updates
    ordersPositionsManager.on('orderUpdate', (orderUpdate: OrderUpdate) => {
      console.log(`Broadcasting order update: ${orderUpdate.id} - ${orderUpdate.status}`);
      
      // Broadcast to all subscribed clients
      this.ordersSubscribers.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({
            type: 'order_update',
            payload: orderUpdate
          }));
        }
      });
    });
    
    // Handle position updates
    ordersPositionsManager.on('positionUpdate', (positionUpdate: PositionUpdate) => {
      console.log(`Broadcasting position update: ${positionUpdate.symbol} - ${positionUpdate.qty}`);
      
      // Broadcast to all subscribed clients
      this.positionsSubscribers.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({
            type: 'position_update',
            payload: positionUpdate
          }));
        }
      });
    });
    
    // Handle connection status updates
    ordersPositionsManager.on('connected', () => {
      console.log('Orders/positions WebSocket connected');
      this.broadcastStatus();
    });
    
    ordersPositionsManager.on('disconnected', () => {
      console.log('Orders/positions WebSocket disconnected');
      this.broadcastStatus();
    });
    
    ordersPositionsManager.on('error', (error) => {
      console.error('Orders/positions WebSocket error:', error);
      this.broadcastStatus();
    });
  }
  
  /**
   * Broadcast connection status to all WebSocket clients
   */
  private broadcastStatus(): void {
    if (!global.wss) return;
    
    const status = {
      type: 'status',
      payload: {
        alpaca: {
          connected: this.alpacaClient.isInitialized(),
          authenticated: this.alpacaClient.isInitialized(),
          ordersStreamActive: this.alpacaClient.isOrdersStreamActive(),
          positionsStreamActive: this.alpacaClient.isPositionsStreamActive(),
          marketDataStreamActive: this.marketDataManager.isConnected(),
          lastUpdated: new Date().toISOString()
        },
        client: {
          connected: true,
          lastUpdated: new Date().toISOString()
        }
      }
    };
    
    global.wss.clients.forEach((client: WebSocket) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(status));
      }
    });
  }
  
  /**
   * Send connection status to a specific WebSocket client
   */
  private sendConnectionStatus(ws: WebSocket): void {
    const status = {
      type: 'status',
      payload: {
        alpaca: {
          connected: this.alpacaClient.isInitialized(),
          authenticated: this.alpacaClient.isInitialized(),
          ordersStreamActive: this.alpacaClient.isOrdersStreamActive(),
          positionsStreamActive: this.alpacaClient.isPositionsStreamActive(),
          marketDataStreamActive: this.marketDataManager.isConnected(),
          lastUpdated: new Date().toISOString()
        },
        client: {
          connected: true,
          lastUpdated: new Date().toISOString()
        }
      }
    };
    
    ws.send(JSON.stringify(status));
  }
  
  /**
   * Handle subscription requests from WebSocket clients
   */
  private async handleSubscription(ws: WebSocket, data: any): Promise<void> {
    // Handle market data subscriptions
    if (data.symbols && data.symbols.length > 0) {
      // Store subscription info on the WebSocket client
      (ws as any).subscribed = {
        ...(ws as any).subscribed || {},
        symbols: [...((ws as any).subscribed?.symbols || []), ...data.symbols]
      };
      
      // Start live price updates for each symbol
      data.symbols.forEach((symbol: string) => {
        this.startLivePriceUpdates(symbol, ws);
      });
    }
    
    // Handle orders subscription
    if (data.channels?.includes('orders')) {
      this.handleOrdersSubscription(ws);
    }
    
    // Handle positions subscription
    if (data.channels?.includes('positions')) {
      this.handlePositionsSubscription(ws);
    }
  }
  
  /**
   * Start live price updates for a symbol
   * Uses WebSocket streaming for real-time updates with sub-100ms latency
   */
  private startLivePriceUpdates(symbol: string, ws: WebSocket): void {
    // Store subscription info on the WebSocket client
    (ws as any).subscribed = {
      ...((ws as any).subscribed || {}),
      symbols: [...((ws as any).subscribed?.symbols || []), symbol]
    };
    
    // Check if client is still subscribed to this symbol
    const isSubscribed = () => {
      return ws.readyState === WebSocket.OPEN && 
             (ws as any).subscribed?.symbols?.includes(symbol);
    };
    
    // Check if symbol is crypto (contains '/')
    const isCrypto = symbol.includes('/');
    
    // Subscribe to market data for this symbol
    this.marketDataManager.subscribe(symbol);
    
    // Set up handler for market data updates
    const marketDataHandler = (marketData: any) => {
      if (isSubscribed()) {
        // Format the market data for the client
        const formattedData = {
          symbol: marketData.symbol,
          bar: marketData.source === 'trade' ? {
            t: marketData.timestamp,
            o: marketData.price,
            h: marketData.price,
            l: marketData.price,
            c: marketData.price,
            v: marketData.volume || 0
          } : null,
          quote: marketData.source === 'quote' ? {
            t: marketData.timestamp,
            bp: marketData.bid || 0,
            ap: marketData.ask || 0,
            bs: marketData.bidSize || 0,
            as: marketData.askSize || 0
          } : null,
          asset: null,
          isCrypto,
          timestamp: marketData.timestamp
        };
        
        // Send updated market data
        ws.send(JSON.stringify({
          type: 'market_data_update',
          payload: formattedData
        }));
      } else {
        // If client is no longer subscribed, remove the listener
        this.marketDataManager.removeListener(`marketData:${symbol}`, marketDataHandler);
        
        // Check if no other clients are subscribed to this symbol
        let hasOtherSubscribers = false;
        global.wss.clients.forEach((client: WebSocket) => {
          if (client !== ws && 
              client.readyState === WebSocket.OPEN && 
              (client as any).subscribed?.symbols?.includes(symbol)) {
            hasOtherSubscribers = true;
          }
        });
        
        // If no other clients are subscribed, unsubscribe from market data
        if (!hasOtherSubscribers) {
          this.marketDataManager.unsubscribe(symbol);
        }
      }
    };
    
    // Listen for market data updates for this symbol
    this.marketDataManager.on(`marketData:${symbol}`, marketDataHandler);
    
    // Fallback to REST API if no market data is received within 5 seconds
    const fallbackTimeoutId = setTimeout(async () => {
      // Check if we've received any market data for this symbol
      const hasMarketData = this.marketDataManager.getLatestMarketData(symbol);
      
      if (!hasMarketData && isSubscribed()) {
        console.log(`No WebSocket market data received for ${symbol}, falling back to REST API polling`);
        
        // Set up interval to fetch latest price via REST API
        const updateInterval = setInterval(async () => {
          if (!isSubscribed()) {
            clearInterval(updateInterval);
            return;
          }
          
          try {
            const isCrypto = symbol.includes('/');
            let marketData;
    
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
              const [barData, quoteData] = await Promise.all([
                this.alpacaClient.getStocksBarsLatest([symbol]),
                this.alpacaClient.getStocksQuotesLatest([symbol])
              ]);
            
              marketData = {
                symbol,
                bar: barData.bars?.[symbol] || null,
                quote: quoteData.quotes?.[symbol] || null,
                asset: null,
                isCrypto: false,
                timestamp: new Date().toISOString()
              };
            }
    
            // Send updated market data
            ws.send(JSON.stringify({
              type: 'market_data_update',
              payload: marketData
            }));
          } catch (error) {
            console.error(`Error updating live price for ${symbol}:`, error);
          }
        }, 5000); // Update every 5 seconds
      }
    }, 5000); // Wait 5 seconds for WebSocket data before falling back
    
    // Clean up the fallback timeout if WebSocket data is received
    const initialDataHandler = () => {
      clearTimeout(fallbackTimeoutId);
      this.marketDataManager.removeListener(`marketData:${symbol}`, initialDataHandler);
    };
    
    // Listen for the first market data update to clear the fallback timeout
    this.marketDataManager.once(`marketData:${symbol}`, initialDataHandler);
  }
  
  /**
   * Handle orders subscription
   */
  private handleOrdersSubscription(ws: WebSocket): void {
    // Add to orders subscribers
    this.ordersSubscribers.add(ws);
    
    // Store subscription info on the WebSocket client
    (ws as any).subscribed = {
      ...(ws as any).subscribed || {},
      channels: [...((ws as any).subscribed?.channels || []), 'orders']
    };
    
    console.log('Client subscribed to orders');
    
    // Send confirmation
    ws.send(JSON.stringify({
      type: 'subscription_success',
      payload: {
        channel: 'orders',
        message: 'Successfully subscribed to orders'
      }
    }));
  }
  
  /**
   * Handle positions subscription
   */
  private handlePositionsSubscription(ws: WebSocket): void {
    // Add to positions subscribers
    this.positionsSubscribers.add(ws);
    
    // Store subscription info on the WebSocket client
    (ws as any).subscribed = {
      ...(ws as any).subscribed || {},
      channels: [...((ws as any).subscribed?.channels || []), 'positions']
    };
    
    console.log('Client subscribed to positions');
    
    // Send confirmation
    ws.send(JSON.stringify({
      type: 'subscription_success',
      payload: {
        channel: 'positions',
        message: 'Successfully subscribed to positions'
      }
    }));
  }
  
  /**
   * Handle orders unsubscription
   */
  private handleOrdersUnsubscription(ws: WebSocket): void {
    // Remove from orders subscribers
    this.ordersSubscribers.delete(ws);
    
    // Update subscription info on the WebSocket client
    if ((ws as any).subscribed?.channels) {
      (ws as any).subscribed.channels = (ws as any).subscribed.channels
        .filter((channel: string) => channel !== 'orders');
    }
    
    console.log('Client unsubscribed from orders');
    
    // Send confirmation if the connection is still open
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'unsubscription_success',
        payload: {
          channel: 'orders',
          message: 'Successfully unsubscribed from orders'
        }
      }));
    }
  }
  
  /**
   * Handle positions unsubscription
   */
  private handlePositionsUnsubscription(ws: WebSocket): void {
    // Remove from positions subscribers
    this.positionsSubscribers.delete(ws);
    
    // Update subscription info on the WebSocket client
    if ((ws as any).subscribed?.channels) {
      (ws as any).subscribed.channels = (ws as any).subscribed.channels
        .filter((channel: string) => channel !== 'positions');
    }
    
    console.log('Client unsubscribed from positions');
    
    // Send confirmation if the connection is still open
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'unsubscription_success',
        payload: {
          channel: 'positions',
          message: 'Successfully unsubscribed from positions'
        }
      }));
    }
  }
  
  /**
   * Subscribe to market data for a specific symbol
   * @param symbol - The symbol to subscribe to (e.g., 'AAPL', 'BTC/USD')
   * @param callback - Callback function to handle market data updates
   * @returns A function to unsubscribe from the market data
   */
  public subscribeToMarketData(symbol: string, callback: (data: any) => void): () => void {
    // Subscribe to market data through the market data manager
    try {
      const unsubscribe = this.marketDataManager.subscribe(symbol, callback);
      return () => {
        if (typeof unsubscribe === 'function') {
          unsubscribe();
        }
      };
    } catch (error) {
      console.error(`Error subscribing to market data for ${symbol}:`, error);
      return () => {}; // Return a no-op function if subscription fails
    }
  }
}
