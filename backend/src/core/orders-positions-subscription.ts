/**
 * orders-positions-subscription.ts
 * 
 * This file manages WebSocket subscriptions for real-time orders and positions updates.
 * Location: backend/src/core/orders-positions-subscription.ts
 * 
 * Responsibilities:
 * - Manage WebSocket connections to Alpaca's orders and positions stream
 * - Handle subscription and unsubscription for orders and positions updates
 * - Provide an event-based interface for real-time orders and positions data
 * - Maintain connection health with automatic reconnection
 */

import { EventEmitter } from 'events';
import WebSocket from 'ws';

/**
 * Order update data structure
 */
export interface OrderUpdate {
  id: string;
  client_order_id: string;
  created_at: string;
  updated_at: string;
  submitted_at: string;
  filled_at: string | null;
  expired_at: string | null;
  canceled_at: string | null;
  failed_at: string | null;
  replaced_at: string | null;
  replaced_by: string | null;
  replaces: string | null;
  asset_id: string;
  symbol: string;
  asset_class: string;
  qty: string;
  filled_qty: string;
  type: string;
  side: string;
  time_in_force: string;
  limit_price: string | null;
  stop_price: string | null;
  filled_avg_price: string | null;
  status: string;
  extended_hours: boolean;
  legs: any[] | null;
  trail_percent: string | null;
  trail_price: string | null;
  hwm: string | null;
  subtag: string | null;
  source: string | null;
}

/**
 * Position update data structure
 */
export interface PositionUpdate {
  asset_id: string;
  symbol: string;
  exchange: string;
  asset_class: string;
  avg_entry_price: string;
  qty: string;
  side: string;
  market_value: string;
  cost_basis: string;
  unrealized_pl: string;
  unrealized_plpc: string;
  unrealized_intraday_pl: string;
  unrealized_intraday_plpc: string;
  current_price: string;
  lastday_price: string;
  change_today: string;
  timestamp: string;
}

/**
 * OrdersPositionsSubscriptionManager
 * 
 * Manages WebSocket connections and subscriptions for real-time orders and positions updates.
 * Uses an event-based system to notify subscribers of updates.
 */
export class OrdersPositionsSubscriptionManager extends EventEmitter {
  // The WebSocket client
  private wsClient: WebSocket | null = null;
  
  // Connection status
  private connected: boolean = false;
  
  // Authentication status
  private authenticated: boolean = false;
  
  // Heartbeat interval to keep connection alive
  private heartbeatInterval: NodeJS.Timeout | null = null;
  
  // Reconnection timeout
  private reconnectTimeout: NodeJS.Timeout | null = null;
  
  // Subscription status
  private subscribed: {
    orders: boolean;
    positions: boolean;
  } = {
    orders: false,
    positions: false
  };
  
  // API credentials
  private apiKey: string = '';
  private secretKey: string = '';
  
  // WebSocket URL
  private readonly wsUrl: string = 'wss://api.alpaca.markets/stream';
  private readonly paperWsUrl: string = 'wss://paper-api.alpaca.markets/stream';
  
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
   * @param isPaper - Whether to use paper trading API
   */
  initialize(apiKey: string, secretKey: string, isPaper: boolean = false): void {
    this.apiKey = apiKey;
    this.secretKey = secretKey;
    
    // Connect to the WebSocket
    this.connect(isPaper);
  }
  
  /**
   * Connect to the WebSocket server
   * @param isPaper - Whether to use paper trading API
   */
  private connect(isPaper: boolean = false): void {
    try {
      // Close existing connection if any
      this.disconnect();
      
      // Create new WebSocket connection
      const url = isPaper ? this.paperWsUrl : this.wsUrl;
      this.wsClient = new WebSocket(url);
      
      // Set up event handlers
      this.setupEventHandlers();
      
      console.log('Connecting to Alpaca orders/positions WebSocket...');
      this.emit('connecting');
    } catch (error) {
      console.error('Error connecting to Alpaca orders/positions WebSocket:', error);
      this.emit('error', error);
      this.scheduleReconnect();
    }
  }
  
  /**
   * Set up WebSocket event handlers
   */
  private setupEventHandlers(): void {
    if (!this.wsClient) return;
    
    this.wsClient.on('open', () => {
      console.log('Alpaca orders/positions WebSocket connection established');
      this.connected = true;
      this.emit('connected');
      
      // Authenticate
      this.authenticate();
      
      // Start heartbeat
      this.startHeartbeat();
    });
    
    this.wsClient.on('message', (data: WebSocket.Data) => {
      try {
        // Parse the incoming message
        const message = JSON.parse(data.toString());
        
        // Handle different message types
        if (message.stream === 'authorization' || message.msg === 'authenticated') {
          this.handleAuthMessage(message);
        } else if (message.stream === 'trade_updates') {
          this.handleOrderUpdate(message.data);
        } else if (message.stream === 'listening') {
          this.handleListeningMessage(message);
        }
      } catch (error) {
        console.error('Error processing WebSocket message:', error);
      }
    });
    
    this.wsClient.on('error', (error: Error) => {
      console.error('Alpaca orders/positions WebSocket error:', error);
      this.emit('error', error);
    });
    
    this.wsClient.on('close', () => {
      console.log('Alpaca orders/positions WebSocket connection closed');
      this.connected = false;
      this.authenticated = false;
      this.emit('disconnected');
      this.scheduleReconnect();
    });
  }
  
  /**
   * Authenticate with the WebSocket server
   */
  private authenticate(): void {
    if (!this.wsClient || !this.connected) return;
    
    try {
      const authMsg = {
        action: 'authenticate',
        data: {
          key_id: this.apiKey,
          secret_key: this.secretKey
        }
      };
      
      this.wsClient.send(JSON.stringify(authMsg));
      console.log('Sent authentication request to Alpaca orders/positions WebSocket');
    } catch (error) {
      console.error('Error authenticating with Alpaca orders/positions WebSocket:', error);
      this.emit('error', error);
    }
  }
  
  /**
   * Handle authentication message
   */
  private handleAuthMessage(message: any): void {
    if (message.data && message.data.status === 'authorized') {
      console.log('Successfully authenticated with Alpaca orders/positions WebSocket');
      this.authenticated = true;
      this.emit('authenticated');
      
      // Subscribe to streams if previously subscribed
      if (this.subscribed.orders) this.subscribeToOrders();
      if (this.subscribed.positions) this.subscribeToPositions();
    } else {
      console.error('Authentication failed with Alpaca orders/positions WebSocket:', message.msg || 'Unknown error');
      this.emit('authError', message.msg || 'Unknown error');
    }
  }
  
  /**
   * Handle listening message
   */
  private handleListeningMessage(message: any): void {
    console.log('Now listening to streams:', message.data.streams);
    this.emit('listening', message.data.streams);
  }
  
  /**
   * Handle order update message
   */
  private handleOrderUpdate(data: any): void {
    // Process order update
    const orderUpdate: OrderUpdate = data.order;
    const event = data.event;
    
    // Emit event with order update
    this.emit('orderUpdate', orderUpdate);
    
    // Also emit a specific event for the order status
    this.emit(`order:${orderUpdate.status}`, orderUpdate);
    
    console.log(`Order update received: ${orderUpdate.id} - ${orderUpdate.status} (${event})`);
    
    // If this is a fill or partial_fill event and we're subscribed to positions,
    // we should trigger a position update
    if (this.subscribed.positions && (event === 'fill' || event === 'partial_fill')) {
      // We'll emit the position data that comes with the order update
      // This includes position_qty which is the new position size
      if (data.position_qty !== undefined) {
        const positionUpdate: Partial<PositionUpdate> = {
          symbol: orderUpdate.symbol,
          qty: data.position_qty.toString(),
          side: parseFloat(data.position_qty) > 0 ? 'long' : 'short',
          timestamp: data.timestamp || new Date().toISOString()
        };
        
        // Emit position update event
        this.emit('positionUpdate', positionUpdate);
        console.log(`Position update emitted for ${positionUpdate.symbol}: ${positionUpdate.qty}`);
      }
    }
  }
  
  /**
   * Handle position update message
   */
  private handlePositionUpdate(data: any): void {
    // Process position update
    const positionUpdate: PositionUpdate = data.position;
    
    // Emit event with position update
    this.emit('positionUpdate', positionUpdate);
    
    console.log(`Position update received: ${positionUpdate.symbol} - ${positionUpdate.qty}`);
  }
  
  /**
   * Start heartbeat to keep connection alive
   */
  private startHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    
    this.heartbeatInterval = setInterval(() => {
      if (this.wsClient && this.wsClient.readyState === WebSocket.OPEN) {
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
      console.log('Attempting to reconnect to Alpaca orders/positions WebSocket...');
      this.emit('reconnecting');
      this.connect();
    }, 5000); // 5 seconds
  }
  
  /**
   * Subscribe to order updates
   */
  subscribeToOrders(): void {
    if (!this.wsClient || !this.authenticated) {
      // Mark as wanting to subscribe when authenticated
      this.subscribed.orders = true;
      return;
    }
    
    try {
      const subscribeMsg = {
        action: 'listen',
        data: {
          streams: ['trade_updates']
        }
      };
      
      this.wsClient.send(JSON.stringify(subscribeMsg));
      this.subscribed.orders = true;
      console.log('Subscribed to order updates');
      this.emit('subscribedToOrders');
    } catch (error) {
      console.error('Error subscribing to order updates:', error);
      this.emit('subscribeError', { stream: 'trade_updates', error });
    }
  }
  
  /**
   * Subscribe to position updates
   * 
   * Note: Alpaca doesn't provide real-time position updates via WebSocket.
   * Instead, we'll poll for positions after receiving order updates.
   */
  subscribeToPositions(): void {
    // Mark as subscribed to positions
    this.subscribed.positions = true;
    console.log('Position updates will be polled after order updates');
    this.emit('subscribedToPositions');
    
    // We don't actually subscribe to a position_updates stream as it doesn't exist
    // Instead, we'll emit position updates after order fills by polling the REST API
  }
  
  /**
   * Unsubscribe from order updates
   */
  unsubscribeFromOrders(): void {
    if (!this.wsClient || !this.authenticated) return;
    
    try {
      const unsubscribeMsg = {
        action: 'unlisten',
        data: {
          streams: ['trade_updates']
        }
      };
      
      this.wsClient.send(JSON.stringify(unsubscribeMsg));
      this.subscribed.orders = false;
      console.log('Unsubscribed from order updates');
      this.emit('unsubscribedFromOrders');
    } catch (error) {
      console.error('Error unsubscribing from order updates:', error);
      this.emit('unsubscribeError', { stream: 'trade_updates', error });
    }
  }
  
  /**
   * Unsubscribe from position updates
   */
  unsubscribeFromPositions(): void {
    // Simply mark as unsubscribed from positions
    this.subscribed.positions = false;
    console.log('Unsubscribed from position updates');
    this.emit('unsubscribedFromPositions');
  }
  
  /**
   * Disconnect from the WebSocket server
   */
  disconnect(): void {
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
    this.authenticated = false;
    this.emit('disconnected');
  }
  
  /**
   * Check if connected to WebSocket server
   * @returns True if connected, false otherwise
   */
  isConnected(): boolean {
    return this.connected && this.wsClient !== null;
  }
  
  /**
   * Check if authenticated with WebSocket server
   * @returns True if authenticated, false otherwise
   */
  isAuthenticated(): boolean {
    return this.authenticated;
  }
  
  /**
   * Check if subscribed to order updates
   * @returns True if subscribed, false otherwise
   */
  isSubscribedToOrders(): boolean {
    return this.subscribed.orders;
  }
  
  /**
   * Check if subscribed to position updates
   * @returns True if subscribed, false otherwise
   */
  isSubscribedToPositions(): boolean {
    return this.subscribed.positions;
  }
}
