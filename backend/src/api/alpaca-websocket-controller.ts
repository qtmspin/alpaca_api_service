/**
 * alpaca-websocket-controller-new.ts
 * 
 * This file handles WebSocket connections for Alpaca market data, orders, and positions.
 * Location: backend/src/api/alpaca-websocket-controller-new.ts
 * 
 * Responsibilities:
 * - Handle WebSocket connections for market data
 * - Manage subscriptions to real-time market data
 * - Stream real-time order and position updates
 * - Broadcast connection status updates
 * - Provide sub-100ms latency for order execution via WebSockets
 */

import { AlpacaClient } from '../services/alpaca-client.js';

// Extend AlpacaClient interface to include getConfig method
declare module '../services/alpaca-client.js' {
  interface AlpacaClient {
    getConfig(): any;
  }
}
import { MarketDataSubscriptionManager } from '../core/market-data-subscription.js';
import { OrdersPositionsSubscriptionManager, OrderUpdate, PositionUpdate } from '../core/orders-positions-subscription.js';
import WebSocket from 'ws';
import { EventEmitter } from 'events';

// Declare global WebSocket server
declare global {
  var wss: any | undefined;
}

/**
 * Connection status type
 */
export interface ConnectionStatus {
  marketData: {
    connected: boolean;
    authenticated: boolean;
    error?: string;
  };
  tradingEvents: {
    connected: boolean;
    authenticated: boolean;
    error?: string;
  };
  lastUpdated: string;
}

/**
 * AlpacaWebSocketController
 * Handles WebSocket connections for Alpaca market data, orders, and positions
 * Uses WebSockets for real-time monitoring with sub-100ms latency
 */
export class AlpacaWebSocketController extends EventEmitter {
  private alpacaClient: AlpacaClient;
  // Make this public so it can be accessed from outside
  public marketDataManager: MarketDataSubscriptionManager;
  private ordersPositionsManager: OrdersPositionsSubscriptionManager;
  
  // Track WebSocket clients subscribed to different streams
  private marketDataSubscribers: Map<WebSocket, Set<string>> = new Map();
  private ordersSubscribers: Set<WebSocket> = new Set();
  private positionsSubscribers: Set<WebSocket> = new Set();
  
  // Connection status
  private connectionStatus: ConnectionStatus = {
    marketData: {
      connected: false,
      authenticated: false
    },
    tradingEvents: {
      connected: false,
      authenticated: false
    },
    lastUpdated: new Date().toISOString()
  };
  
  // Status check interval
  private statusCheckInterval: NodeJS.Timeout | null = null;
  
  /**
   * Constructor
   */
  constructor(alpacaClient: AlpacaClient) {
    super();
    this.alpacaClient = alpacaClient;
    this.marketDataManager = new MarketDataSubscriptionManager();
    this.ordersPositionsManager = new OrdersPositionsSubscriptionManager();
    
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
      // Get API credentials from the Alpaca client
      const config = this.alpacaClient.getConfig();
      if (!config || !config.apiKey || !config.secretKey) {
        throw new Error('API credentials not available');
      }
      
      // Initialize market data stream with API credentials
      this.marketDataManager.initialize(config.apiKey, config.secretKey, false);
      console.log('Initialized market data WebSocket stream');
      
      // Initialize orders and positions stream
      this.ordersPositionsManager.initialize(config.apiKey, config.secretKey, config.isPaper);
      console.log('Initialized orders and positions WebSocket streams');
      
      // Set up event handlers for market data stream
      this.setupMarketDataHandlers();
      
      // Set up handlers for orders and positions updates
      this.setupOrdersPositionsHandlers();
      
      // Set up status check interval
      this.statusCheckInterval = setInterval(() => this.checkConnectionStatus(), 30000);
    } catch (error) {
      console.error('Failed to initialize WebSocket streams:', error);
    }
  }
  
  /**
   * Initialize WebSocket handlers for client connections
   */
  private initializeWebSocketHandlers(): void {
    if (!global.wss) return;
    
    // Instead of adding a new connection handler, we'll add a message handler
    // to the existing WebSocket server that's already handling connections
    
    // Create a message handler function that we can attach to each connection
    const messageHandler = async (ws: WebSocket, message: string) => {
      try {
        const data = JSON.parse(message.toString());
        console.log('Received WebSocket message:', data);
        
        // Handle subscription requests
        if (data.action === 'subscribe') {
          await this.handleSubscription(ws, data);
        }
        
        // Handle unsubscription requests
        if (data.action === 'unsubscribe') {
          this.handleUnsubscription(ws, data);
        }
        
        // Handle status request
        if (data.action === 'status') {
          this.sendConnectionStatus(ws);
        }
      } catch (error) {
        console.error('Error processing client message:', error);
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: 'error',
            payload: {
              message: 'Invalid message format'
            }
          }));
        }
      }
    };
    
    // Add our handler to the existing WebSocket server's connection event
    global.wss.on('connection', (ws: WebSocket) => {
      // Send initial connection status
      this.sendConnectionStatus(ws);
      
      // Store our handler in a property on the WebSocket object
      // so we can identify our handler later if needed
      (ws as any).alpacaMessageHandler = (message: string) => {
        messageHandler(ws, message);
      };
      
      // Add our message handler
      ws.on('message', (ws as any).alpacaMessageHandler);
      
      // When client disconnects, clean up our subscriptions
      ws.on('close', () => {
        this.cleanupClientSubscriptions(ws);
      });
    });
  }
  
  /**
   * Set up handlers for market data WebSocket stream
   */
  private setupMarketDataHandlers(): void {
    // Handle connection events
    this.marketDataManager.on('connecting', () => {
      this.connectionStatus.marketData.connected = false;
      this.connectionStatus.marketData.authenticated = false;
      this.connectionStatus.lastUpdated = new Date().toISOString();
      this.broadcastStatus();
    });
    
    this.marketDataManager.on('connected', () => {
      this.connectionStatus.marketData.connected = true;
      this.connectionStatus.lastUpdated = new Date().toISOString();
      this.broadcastStatus();
    });
    
    this.marketDataManager.on('authenticated', () => {
      this.connectionStatus.marketData.authenticated = true;
      this.connectionStatus.lastUpdated = new Date().toISOString();
      this.broadcastStatus();
    });
    
    this.marketDataManager.on('disconnected', () => {
      this.connectionStatus.marketData.connected = false;
      this.connectionStatus.marketData.authenticated = false;
      this.connectionStatus.lastUpdated = new Date().toISOString();
      this.broadcastStatus();
    });
    
    this.marketDataManager.on('error', (error) => {
      this.connectionStatus.marketData.error = error.message || 'Unknown error';
      this.connectionStatus.lastUpdated = new Date().toISOString();
      this.broadcastStatus();
    });
  }
  
  /**
   * Set up handlers for real-time order and position updates
   */
  private setupOrdersPositionsHandlers(): void {
    // Handle connection events
    this.ordersPositionsManager.on('connecting', () => {
      this.connectionStatus.tradingEvents.connected = false;
      this.connectionStatus.tradingEvents.authenticated = false;
      this.connectionStatus.lastUpdated = new Date().toISOString();
      this.broadcastStatus();
    });
    
    this.ordersPositionsManager.on('connected', () => {
      this.connectionStatus.tradingEvents.connected = true;
      this.connectionStatus.lastUpdated = new Date().toISOString();
      this.broadcastStatus();
    });
    
    this.ordersPositionsManager.on('authenticated', () => {
      this.connectionStatus.tradingEvents.authenticated = true;
      this.connectionStatus.lastUpdated = new Date().toISOString();
      this.broadcastStatus();
    });
    
    this.ordersPositionsManager.on('disconnected', () => {
      this.connectionStatus.tradingEvents.connected = false;
      this.connectionStatus.tradingEvents.authenticated = false;
      this.connectionStatus.lastUpdated = new Date().toISOString();
      this.broadcastStatus();
    });
    
    this.ordersPositionsManager.on('error', (error) => {
      this.connectionStatus.tradingEvents.error = error instanceof Error ? error.message : 'Unknown error';
      this.connectionStatus.lastUpdated = new Date().toISOString();
      this.broadcastStatus();
    });
    
    // Handle order updates
    this.ordersPositionsManager.on('orderUpdate', (orderUpdate: OrderUpdate) => {
      if (this.ordersSubscribers.size === 0) return;
      
      // Process the event type to create a more detailed message
      const eventType = orderUpdate.event || orderUpdate.status;
      let enhancedPayload: any = { ...orderUpdate };
      
      // Add event-specific details based on the event type
      switch (eventType) {
        case 'new':
          // New order created
          enhancedPayload.eventDescription = 'Order has been routed to exchanges for execution';
          break;
          
        case 'fill':
          // Order completely filled
          enhancedPayload.eventDescription = 'Order has been completely filled';
          enhancedPayload.fillDetails = {
            timestamp: orderUpdate.fill_timestamp || orderUpdate.filled_at || new Date().toISOString(),
            price: orderUpdate.fill_price || orderUpdate.filled_avg_price,
            quantity: orderUpdate.fill_qty || orderUpdate.filled_qty,
            positionSize: orderUpdate.position_qty
          };
          break;
          
        case 'partial_fill':
          // Order partially filled
          enhancedPayload.eventDescription = 'Order has been partially filled';
          enhancedPayload.fillDetails = {
            timestamp: orderUpdate.fill_timestamp || orderUpdate.filled_at || new Date().toISOString(),
            price: orderUpdate.fill_price || orderUpdate.filled_avg_price,
            quantity: orderUpdate.fill_qty || orderUpdate.filled_qty,
            positionSize: orderUpdate.position_qty
          };
          break;
          
        case 'canceled':
          // Order canceled
          enhancedPayload.eventDescription = 'Order has been canceled';
          enhancedPayload.cancelDetails = {
            timestamp: orderUpdate.cancel_timestamp || orderUpdate.canceled_at || new Date().toISOString()
          };
          break;
          
        case 'expired':
          // Order expired
          enhancedPayload.eventDescription = 'Order has expired due to time in force constraints';
          enhancedPayload.expirationDetails = {
            timestamp: orderUpdate.expiration_timestamp || orderUpdate.expired_at || new Date().toISOString()
          };
          break;
          
        case 'replaced':
          // Order replaced
          enhancedPayload.eventDescription = 'Order has been replaced';
          enhancedPayload.replaceDetails = {
            timestamp: orderUpdate.replace_timestamp || orderUpdate.replaced_at || new Date().toISOString(),
            oldOrderId: orderUpdate.replaces,
            newOrderId: orderUpdate.id
          };
          break;
          
        case 'rejected':
          // Order rejected
          enhancedPayload.eventDescription = 'Order has been rejected';
          enhancedPayload.rejectDetails = {
            timestamp: orderUpdate.reject_timestamp || orderUpdate.failed_at || new Date().toISOString(),
            reason: orderUpdate.reject_reason || orderUpdate.reason || 'Unknown'
          };
          break;
          
        case 'done_for_day':
          // Order done for day
          enhancedPayload.eventDescription = 'Order is done executing for the day';
          break;
          
        case 'stopped':
          // Order stopped
          enhancedPayload.eventDescription = 'Order has been stopped, trade is guaranteed';
          break;
          
        case 'pending_new':
          // Order pending
          enhancedPayload.eventDescription = 'Order has been received but not yet accepted for execution';
          break;
          
        case 'pending_cancel':
          // Order pending cancelation
          enhancedPayload.eventDescription = 'Order is awaiting cancelation';
          break;
          
        case 'pending_replace':
          // Order pending replacement
          enhancedPayload.eventDescription = 'Order is awaiting replacement';
          break;
          
        case 'calculated':
          // Order calculated
          enhancedPayload.eventDescription = 'Order has been completed but settlement calculations are pending';
          break;
          
        case 'suspended':
          // Order suspended
          enhancedPayload.eventDescription = 'Order has been suspended and is not eligible for trading';
          break;
          
        case 'order_replace_rejected':
          // Order replace rejected
          enhancedPayload.eventDescription = 'Order replacement has been rejected';
          break;
          
        case 'order_cancel_rejected':
          // Order cancel rejected
          enhancedPayload.eventDescription = 'Order cancelation has been rejected';
          break;
          
        default:
          enhancedPayload.eventDescription = `Order status: ${eventType}`;
          break;
      }
      
      const message = {
        type: 'order_update',
        payload: enhancedPayload
      };
      
      // Broadcast to all subscribers
      for (const client of this.ordersSubscribers) {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(message));
        }
      }
    });
    
    // Handle position updates
    this.ordersPositionsManager.on('positionUpdate', (positionUpdate: PositionUpdate) => {
      if (this.positionsSubscribers.size === 0) return;
      
      const message = {
        type: 'position_update',
        payload: positionUpdate
      };
      
      // Broadcast to all subscribers
      for (const client of this.positionsSubscribers) {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(message));
        }
      }
    });
  }
  
  /**
   * Broadcast connection status to all WebSocket clients
   */
  private broadcastStatus(): void {
    if (!global.wss) return;
    
    const statusMessage = {
      type: 'connection_status',
      payload: this.connectionStatus
    };
    
    global.wss.clients.forEach((client: WebSocket) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(statusMessage));
      }
    });
  }
  
  /**
   * Send connection status to a specific WebSocket client
   */
  private sendConnectionStatus(ws: WebSocket): void {
    if (ws.readyState !== WebSocket.OPEN) return;
    
    const statusMessage = {
      type: 'connection_status',
      payload: this.connectionStatus
    };
    
    ws.send(JSON.stringify(statusMessage));
  }
  
  /**
   * Check connection status and attempt reconnection if needed
   */
  private checkConnectionStatus(): void {
    // Check market data connection
    if (!this.marketDataManager.isConnected()) {
      console.log('Market data WebSocket disconnected, attempting to reconnect...');
      try {
        const config = this.alpacaClient.getConfig();
        if (config && config.apiKey && config.secretKey) {
          this.marketDataManager.initialize(config.apiKey, config.secretKey, false);
        }
      } catch (error) {
        console.error('Failed to reconnect to market data WebSocket:', error);
      }
    }
    
    // Check orders/positions connection
    if (!this.ordersPositionsManager.isConnected()) {
      console.log('Orders/positions WebSocket disconnected, attempting to reconnect...');
      try {
        const config = this.alpacaClient.getConfig();
        if (config && config.apiKey && config.secretKey) {
          this.ordersPositionsManager.initialize(config.apiKey, config.secretKey, config.isPaper);
        }
      } catch (error) {
        console.error('Failed to reconnect to orders/positions WebSocket:', error);
      }
    }
  }
  
  /**
   * Handle subscription requests from WebSocket clients
   */
  private async handleSubscription(ws: WebSocket, data: any): Promise<void> {
    const channels = data.channels || [];
    const symbols = data.symbols || [];
    
    // Store subscription info on the WebSocket client
    (ws as any).subscribed = {
      ...(ws as any).subscribed || {},
      channels: [...((ws as any).subscribed?.channels || []), ...channels],
      symbols: [...((ws as any).subscribed?.symbols || []), ...symbols]
    };
    
    // Handle channel subscriptions
    if (channels.includes('orders')) {
      this.handleOrdersSubscription(ws);
    }
    
    if (channels.includes('positions')) {
      this.handlePositionsSubscription(ws);
    }
    
    // Handle symbol subscriptions for market data
    for (const symbol of symbols) {
      this.startLivePriceUpdates(symbol, ws);
    }
  }
  
  /**
   * Handle unsubscription requests from WebSocket clients
   */
  private handleUnsubscription(ws: WebSocket, data: any): void {
    const channels = data.channels || [];
    const symbols = data.symbols || [];
    
    // Store unsubscription info on the WebSocket client
    (ws as any).unsubscribed = {
      ...(ws as any).unsubscribed || {},
      channels: [...((ws as any).unsubscribed?.channels || []), ...channels],
      symbols: [...((ws as any).unsubscribed?.symbols || []), ...symbols]
    };
    
    // Handle channel unsubscriptions
    if (channels.includes('orders')) {
      this.handleOrdersUnsubscription(ws);
    }
    
    if (channels.includes('positions')) {
      this.handlePositionsUnsubscription(ws);
    }
    
    // Handle symbol unsubscriptions for market data
    for (const symbol of symbols) {
      this.stopLivePriceUpdates(symbol, ws);
    }
  }
  
  /**
   * Start live price updates for a symbol
   * Uses WebSocket streaming for real-time updates with sub-100ms latency
   */
  private startLivePriceUpdates(symbol: string, ws: WebSocket): void {
    // Normalize the symbol
    const normalizedSymbol = symbol.toUpperCase();
    
    // Initialize client's symbol subscriptions if not exists
    if (!this.marketDataSubscribers.has(ws)) {
      this.marketDataSubscribers.set(ws, new Set());
    }
    
    // Add symbol to client's subscriptions
    const clientSymbols = this.marketDataSubscribers.get(ws)!;
    if (clientSymbols.has(normalizedSymbol)) {
      // Already subscribed
      return;
    }
    
    clientSymbols.add(normalizedSymbol);
    
    // Create a function to check if client is still subscribed
    const isSubscribed = () => {
      return (
        ws.readyState === WebSocket.OPEN &&
        this.marketDataSubscribers.has(ws) &&
        this.marketDataSubscribers.get(ws)!.has(normalizedSymbol)
      );
    };
    
    // Set up handler for market data updates
    const marketDataHandler = (marketData: any) => {
      if (!isSubscribed()) {
        // Client no longer subscribed, remove listener
        this.marketDataManager.removeListener(`marketData:${normalizedSymbol}`, marketDataHandler);
        return;
      }
      
      // Send market data to client
      try {
        // Create base payload
        const basePayload = {
          symbol: normalizedSymbol,
          price: marketData.price,
          timestamp: marketData.timestamp,
          source: marketData.source
        };
        
        // Create full payload with additional fields based on data source
        let fullPayload: any = { ...basePayload };
        
        if (marketData.source === 'quote') {
          fullPayload = {
            ...fullPayload,
            bid: marketData.bid,
            ask: marketData.ask,
            bidSize: marketData.bidSize,
            askSize: marketData.askSize
          };
        } else if (marketData.source === 'trade') {
          fullPayload = {
            ...fullPayload,
            volume: marketData.volume
          };
        }
        
        const message = {
          type: 'market_data',
          payload: fullPayload
        };
        
        ws.send(JSON.stringify(message));
      } catch (error) {
        console.error(`Error sending market data for ${normalizedSymbol}:`, error);
      }
    };
    
    // Subscribe to market data
    this.marketDataManager.on(`marketData:${normalizedSymbol}`, marketDataHandler);
    
    // Attempt to subscribe to the symbol
    try {
      this.marketDataManager.subscribe(normalizedSymbol);
      
      // Send confirmation to client
      ws.send(JSON.stringify({
        type: 'subscription_success',
        payload: {
          symbol: normalizedSymbol,
          message: `Successfully subscribed to ${normalizedSymbol} market data`
        }
      }));
      
      console.log(`Client subscribed to ${normalizedSymbol} market data`);
      
      // Set up a fallback for initial data in case WebSocket is slow
      const fallbackTimeoutId = setTimeout(async () => {
        if (!isSubscribed()) return;
        
        try {
          // Fetch latest quote via REST API as fallback
          const latestData = await this.alpacaClient.getStocksQuotesLatest([normalizedSymbol]);
          if (latestData && latestData[normalizedSymbol]) {
            const quote = latestData[normalizedSymbol];
            
            // Create market data object
            const marketData = {
              symbol: normalizedSymbol,
              price: (quote.ap + quote.bp) / 2, // Midpoint price
              timestamp: new Date(quote.t).toISOString(),
              bid: quote.bp,
              ask: quote.ap,
              bidSize: quote.bs,
              askSize: quote.as,
              source: 'quote'
            };
            
            // Send to client
            marketDataHandler(marketData);
          }
        } catch (error) {
          console.error(`Error fetching fallback data for ${normalizedSymbol}:`, error);
        }
      }, 2000); // 2 second fallback timeout
      
      // Clean up the fallback timeout if WebSocket data is received
      const initialDataHandler = () => {
        clearTimeout(fallbackTimeoutId);
        this.marketDataManager.removeListener(`marketData:${normalizedSymbol}`, initialDataHandler);
      };
      
      // Listen for the first market data update to clear the fallback timeout
      this.marketDataManager.once(`marketData:${normalizedSymbol}`, initialDataHandler);
    } catch (error) {
      console.error(`Error subscribing to ${normalizedSymbol}:`, error);
      
      // Send error to client
      ws.send(JSON.stringify({
        type: 'subscription_error',
        payload: {
          symbol: normalizedSymbol,
          message: `Failed to subscribe to ${normalizedSymbol}: ${error instanceof Error ? error.message : 'Unknown error'}`
        }
      }));
    }
  }
  
  /**
   * Stop live price updates for a symbol
   */
  private stopLivePriceUpdates(symbol: string, ws: WebSocket): void {
    // Normalize the symbol
    const normalizedSymbol = symbol.toUpperCase();
    
    // Check if client is subscribed to this symbol
    if (!this.marketDataSubscribers.has(ws)) return;
    
    const clientSymbols = this.marketDataSubscribers.get(ws)!;
    if (!clientSymbols.has(normalizedSymbol)) return;
    
    // Remove symbol from client's subscriptions
    clientSymbols.delete(normalizedSymbol);
    
    // Check if any other clients are subscribed to this symbol
    let hasOtherSubscribers = false;
    for (const [client, symbols] of this.marketDataSubscribers.entries()) {
      if (client !== ws && symbols.has(normalizedSymbol)) {
        hasOtherSubscribers = true;
        break;
      }
    }
    
    // If no other clients are subscribed, unsubscribe from market data
    if (!hasOtherSubscribers) {
      this.marketDataManager.unsubscribe(normalizedSymbol);
    }
    
    // Send confirmation to client
    ws.send(JSON.stringify({
      type: 'unsubscription_success',
      payload: {
        symbol: normalizedSymbol,
        message: `Successfully unsubscribed from ${normalizedSymbol} market data`
      }
    }));
    
    console.log(`Client unsubscribed from ${normalizedSymbol} market data`);
  }
  
  /**
   * Handle orders subscription
   */
  private handleOrdersSubscription(ws: WebSocket): void {
    // Add to orders subscribers
    this.ordersSubscribers.add(ws);
    
    // Ensure orders stream is active
    if (!this.ordersPositionsManager.isSubscribedToOrders()) {
      this.ordersPositionsManager.subscribeToOrders();
    }
    
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
    
    // Ensure positions stream is active
    if (!this.ordersPositionsManager.isSubscribedToPositions()) {
      this.ordersPositionsManager.subscribeToPositions();
    }
    
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
    
    // If no more subscribers, unsubscribe from orders stream
    if (this.ordersSubscribers.size === 0) {
      this.ordersPositionsManager.unsubscribeFromOrders();
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
    
    // If no more subscribers, unsubscribe from positions stream
    if (this.positionsSubscribers.size === 0) {
      this.ordersPositionsManager.unsubscribeFromPositions();
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
   * Clean up client subscriptions when they disconnect
   */
  private cleanupClientSubscriptions(ws: WebSocket): void {
    // Clean up market data subscriptions
    if (this.marketDataSubscribers.has(ws)) {
      const symbols = Array.from(this.marketDataSubscribers.get(ws)!);
      for (const symbol of symbols) {
        this.stopLivePriceUpdates(symbol, ws);
      }
      this.marketDataSubscribers.delete(ws);
    }
    
    // Clean up orders subscription
    if (this.ordersSubscribers.has(ws)) {
      this.handleOrdersUnsubscription(ws);
    }
    
    // Clean up positions subscription
    if (this.positionsSubscribers.has(ws)) {
      this.handlePositionsUnsubscription(ws);
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
  
  /**
   * Clean up resources when shutting down
   */
  public shutdown(): void {
    // Clear intervals
    if (this.statusCheckInterval) {
      clearInterval(this.statusCheckInterval);
      this.statusCheckInterval = null;
    }
    
    // Disconnect from WebSocket streams
    this.marketDataManager.disconnect();
    this.ordersPositionsManager.disconnect();
    
    console.log('AlpacaWebSocketController shut down');
  }
}
