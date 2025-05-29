# Connecting to Alpaca API Service

## Overview

This guide explains how to connect to the Alpaca API service from external TypeScript applications running locally. It covers both REST API connections and WebSocket streaming connections.

## Prerequisites

- Node.js and npm installed
- TypeScript development environment
- Alpaca API service running locally

## Connection Issues

The `ECONNREFUSED` error typically occurs when:

1. The backend server is not running
2. You're trying to connect to the wrong port/host
3. CORS (Cross-Origin Resource Sharing) is blocking the connection
4. Network configurations are preventing the connection

## Basic REST API Connection

Here's a TypeScript example for connecting to the REST API endpoints, along with sample response formats:

```typescript
/**
 * api-client.ts
 * A simple client for connecting to the Alpaca API service
 */

import axios from 'axios';

// Configure the base URL for your API service
const API_BASE_URL = 'http://localhost:9000/api';

// Create an axios instance with default configuration
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Get all orders
export const getOrders = async (status?: 'open' | 'closed' | 'all') => {
  try {
    const response = await apiClient.get(`/orders${status ? `?status=${status}` : ''}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching orders:', error);
    throw error;
  }
};

// Get all positions
export const getPositions = async () => {
  try {
    const response = await apiClient.get('/positions');
    return response.data;
  } catch (error) {
    console.error('Error fetching positions:', error);
    throw error;
  }
};

// Create a new order
export const createOrder = async (orderData: any) => {
  try {
    const response = await apiClient.post('/orders', orderData);
    return response.data;
  } catch (error) {
    console.error('Error creating order:', error);
    throw error;
  }
};

// Example usage
export const fetchData = async () => {
  try {
    // Get open orders
    const openOrders = await getOrders('open');
    console.log('Open orders:', openOrders);
    
    // Get positions
    const positions = await getPositions();
    console.log('Positions:', positions);
  } catch (error) {
    console.error('Error fetching data:', error);
  }
};
```

### Sample Response Formats

#### Orders Response

```json
[
  {
    "id": "61e69015-8549-4bfd-b9c3-01e75843f47d",
    "client_order_id": "eb9e2aaa-f71a-4f51-b5b4-52a6c565dad4",
    "created_at": "2025-05-28T16:28:42.012Z",
    "updated_at": "2025-05-28T16:28:42.012Z",
    "submitted_at": "2025-05-28T16:28:42.009Z",
    "filled_at": null,
    "expired_at": null,
    "canceled_at": null,
    "failed_at": null,
    "replaced_at": null,
    "replaced_by": null,
    "replaces": null,
    "asset_id": "b0b6dd9d-8b9b-48a9-ba46-b9d54906e415",
    "symbol": "AAPL",
    "asset_class": "us_equity",
    "qty": "5",
    "filled_qty": "0",
    "type": "market",
    "side": "buy",
    "time_in_force": "day",
    "limit_price": null,
    "stop_price": null,
    "filled_avg_price": null,
    "status": "new",
    "extended_hours": false,
    "legs": null,
    "trail_percent": null,
    "trail_price": null,
    "hwm": null,
    "is_artificial": false
  }
]
```

#### Positions Response

```json
[
  {
    "asset_id": "b0b6dd9d-8b9b-48a9-ba46-b9d54906e415",
    "symbol": "AAPL",
    "exchange": "NASDAQ",
    "asset_class": "us_equity",
    "avg_entry_price": "178.42",
    "qty": "10",
    "side": "long",
    "market_value": "1784.20",
    "cost_basis": "1784.20",
    "unrealized_pl": "0.00",
    "unrealized_plpc": "0.00",
    "unrealized_intraday_pl": "0.00",
    "unrealized_intraday_plpc": "0.00",
    "current_price": "178.42",
    "lastday_price": "177.15",
    "change_today": "0.0072"
  },
  {
    "asset_id": "4ce9353c-66a3-4b5a-a149-fd4e7a03f1ac",
    "symbol": "BTC/USD",
    "exchange": "FTXU",
    "asset_class": "crypto",
    "avg_entry_price": "68245.00",
    "qty": "0.15",
    "side": "long",
    "market_value": "10236.75",
    "cost_basis": "10236.75",
    "unrealized_pl": "0.00",
    "unrealized_plpc": "0.00",
    "unrealized_intraday_pl": "0.00",
    "unrealized_intraday_plpc": "0.00",
    "current_price": "68245.00",
    "lastday_price": "67890.50",
    "change_today": "0.0052"
  }
]
```

## WebSocket Connection for Streaming Data

For real-time updates, you can use WebSockets:

```typescript
/**
 * websocket-client.ts
 * A client for streaming real-time data from the Alpaca API service
 */

// Configure the WebSocket URL
const WS_URL = 'ws://localhost:9000';

class AlpacaWebSocketClient {
  private socket: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 2000; // 2 seconds
  private subscriptions: string[] = [];
  
  // Event callbacks
  private onOrderUpdateCallback: ((data: any) => void) | null = null;
  private onPositionUpdateCallback: ((data: any) => void) | null = null;
  
  constructor() {}
  
  // Connect to the WebSocket server
  public connect(): void {
    if (this.socket) {
      this.disconnect();
    }
    
    try {
      this.socket = new WebSocket(WS_URL);
      
      this.socket.onopen = this.handleOpen.bind(this);
      this.socket.onmessage = this.handleMessage.bind(this);
      this.socket.onclose = this.handleClose.bind(this);
      this.socket.onerror = this.handleError.bind(this);
      
      console.log('Connecting to WebSocket server...');
    } catch (error) {
      console.error('Error connecting to WebSocket:', error);
      this.attemptReconnect();
    }
  }
  
  // Disconnect from the WebSocket server
  public disconnect(): void {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
      this.reconnectAttempts = 0;
      console.log('Disconnected from WebSocket server');
    }
  }
  
  // Subscribe to channels
  public subscribe(channels: string[]): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      console.error('WebSocket is not connected');
      return;
    }
    
    this.subscriptions = [...new Set([...this.subscriptions, ...channels])];
    
    const message = {
      action: 'subscribe',
      channels: channels
    };
    
    this.socket.send(JSON.stringify(message));
    console.log(`Subscribed to channels: ${channels.join(', ')}`);
  }
  
  // Unsubscribe from channels
  public unsubscribe(channels: string[]): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      console.error('WebSocket is not connected');
      return;
    }
    
    this.subscriptions = this.subscriptions.filter(channel => !channels.includes(channel));
    
    const message = {
      action: 'unsubscribe',
      channels: channels
    };
    
    this.socket.send(JSON.stringify(message));
    console.log(`Unsubscribed from channels: ${channels.join(', ')}`);
  }
  
  // Set callback for order updates
  public onOrderUpdate(callback: (data: any) => void): void {
    this.onOrderUpdateCallback = callback;
  }
  
  // Set callback for position updates
  public onPositionUpdate(callback: (data: any) => void): void {
    this.onPositionUpdateCallback = callback;
  }
  
  // Handle WebSocket open event
  private handleOpen(): void {
    console.log('Connected to WebSocket server');
    this.reconnectAttempts = 0;
    
    // Resubscribe to channels if any
    if (this.subscriptions.length > 0) {
      this.subscribe(this.subscriptions);
    }
  }
  
  // Handle WebSocket message event
  private handleMessage(event: MessageEvent): void {
    try {
      const data = JSON.parse(event.data);
      
      switch (data.type) {
        case 'order':
          if (this.onOrderUpdateCallback) {
            this.onOrderUpdateCallback(data.payload);
          }
          break;
          
        case 'position':
          if (this.onPositionUpdateCallback) {
            this.onPositionUpdateCallback(data.payload);
          }
          break;
          
        default:
          console.log('Received message:', data);
      }
    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
    }
  }
  
  // Handle WebSocket close event
  private handleClose(event: CloseEvent): void {
    console.log(`WebSocket connection closed: ${event.code} ${event.reason}`);
    this.attemptReconnect();
  }
  
  // Handle WebSocket error event
  private handleError(event: Event): void {
    console.error('WebSocket error:', event);
  }
  
  // Attempt to reconnect to the WebSocket server
  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error(`Maximum reconnect attempts (${this.maxReconnectAttempts}) reached`);
      return;
    }
    
    this.reconnectAttempts++;
    const delay = this.reconnectDelay * this.reconnectAttempts;
    
    console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    
    setTimeout(() => {
      this.connect();
    }, delay);
  }
}

// Example usage
const wsClient = new AlpacaWebSocketClient();

// Set up callbacks
wsClient.onOrderUpdate((order) => {
  console.log('Order update:', order);
});

wsClient.onPositionUpdate((position) => {
  console.log('Position update:', position);
});

// Connect to the WebSocket server
wsClient.connect();

// Subscribe to channels after connection
setTimeout(() => {
  wsClient.subscribe(['orders', 'positions']);
}, 1000);

export default wsClient;
```

### Sample WebSocket Messages

#### Order Update Message

```json
{
  "type": "order",
  "payload": {
    "id": "61e69015-8549-4bfd-b9c3-01e75843f47d",
    "client_order_id": "eb9e2aaa-f71a-4f51-b5b4-52a6c565dad4",
    "created_at": "2025-05-28T16:28:42.012Z",
    "updated_at": "2025-05-28T16:28:42.012Z",
    "submitted_at": "2025-05-28T16:28:42.009Z",
    "filled_at": "2025-05-28T16:28:45.238Z",
    "expired_at": null,
    "canceled_at": null,
    "failed_at": null,
    "replaced_at": null,
    "replaced_by": null,
    "replaces": null,
    "asset_id": "b0b6dd9d-8b9b-48a9-ba46-b9d54906e415",
    "symbol": "AAPL",
    "asset_class": "us_equity",
    "qty": "5",
    "filled_qty": "5",
    "type": "market",
    "side": "buy",
    "time_in_force": "day",
    "limit_price": null,
    "stop_price": null,
    "filled_avg_price": "178.42",
    "status": "filled",
    "extended_hours": false,
    "legs": null,
    "trail_percent": null,
    "trail_price": null,
    "hwm": null,
    "is_artificial": false
  }
}
```

#### Position Update Message

```json
{
  "type": "position",
  "payload": {
    "asset_id": "b0b6dd9d-8b9b-48a9-ba46-b9d54906e415",
    "symbol": "AAPL",
    "exchange": "NASDAQ",
    "asset_class": "us_equity",
    "avg_entry_price": "178.42",
    "qty": "15",  // Updated quantity after order fill
    "side": "long",
    "market_value": "2676.30",
    "cost_basis": "2676.30",
    "unrealized_pl": "0.00",
    "unrealized_plpc": "0.00",
    "unrealized_intraday_pl": "0.00",
    "unrealized_intraday_plpc": "0.00",
    "current_price": "178.42",
    "lastday_price": "177.15",
    "change_today": "0.0072"
  }
}
```

#### Status Update Message

```json
{
  "type": "status",
  "payload": {
    "alpaca": {
      "connected": true,
      "authenticated": true,
      "lastUpdated": "2025-05-28T16:28:40.123Z"
    },
    "client": {
      "connected": true,
      "lastUpdated": "2025-05-28T16:28:40.123Z"
    }
  }
}
```

#### Log Message

```json
{
  "type": "log",
  "payload": {
    "id": "log-123456",
    "timestamp": "2025-05-28T16:28:42.012Z",
    "level": "info",
    "message": "Order 61e69015-8549-4bfd-b9c3-01e75843f47d filled at $178.42",
    "source": "order-service"
  }
}
```

## Crypto Market Data Streaming

For cryptocurrency assets like BTC/USD, you can use a dedicated WebSocket connection to stream real-time price data. Here's how to set it up:

```typescript
/**
 * crypto-price-stream.ts
 * A client for streaming real-time cryptocurrency price data
 */

import WebSocket from 'ws';

class CryptoDataStream {
  private socket: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 2000; // 2 seconds
  private symbols: string[] = [];
  private onPriceUpdateCallbacks: Map<string, ((price: number) => void)[]> = new Map();
  
  /**
   * Connect to the Alpaca Crypto WebSocket API
   */
  public connect(apiKey: string, apiSecret: string): void {
    // Connect to the Alpaca Crypto WebSocket API
    this.socket = new WebSocket('wss://stream.data.alpaca.markets/v1beta1/crypto');
    
    this.socket.onopen = () => {
      console.log('Connected to Alpaca Crypto WebSocket API');
      
      // Authenticate with API credentials
      const authMsg = {
        action: 'auth',
        key: apiKey,
        secret: apiSecret
      };
      
      this.socket.send(JSON.stringify(authMsg));
      
      // Subscribe to symbols if any
      if (this.symbols.length > 0) {
        this.subscribe(this.symbols);
      }
    };
    
    this.socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data.toString());
        
        // Handle different message types
        if (Array.isArray(data)) {
          data.forEach(msg => {
            if (msg.T === 'success' && msg.msg === 'authenticated') {
              console.log('Authentication successful');
            } else if (msg.T === 'subscription') {
              console.log(`Subscribed to ${msg.trades.join(', ')}`);
            } else if (msg.T === 'trade') {
              // Handle trade update
              const symbol = msg.S; // Symbol
              const price = parseFloat(msg.p); // Price
              const size = parseFloat(msg.s); // Size/volume
              const timestamp = new Date(msg.t).toISOString(); // Timestamp
              
              console.log(`Trade: ${symbol} @ $${price} | Size: ${size} | Time: ${timestamp}`);
              
              // Notify callbacks for this symbol
              this.notifyPriceUpdate(symbol, price);
            }
          });
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };
    
    this.socket.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
    
    this.socket.onclose = () => {
      console.log('WebSocket connection closed');
      this.attemptReconnect();
    };
  }
  
  /**
   * Subscribe to crypto symbols
   * @param symbols Array of symbols to subscribe to (e.g., ['BTC/USD', 'ETH/USD'])
   */
  public subscribe(symbols: string[]): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      // Store symbols for when connection is established
      this.symbols = [...new Set([...this.symbols, ...symbols])];
      return;
    }
    
    // Add to tracked symbols
    this.symbols = [...new Set([...this.symbols, ...symbols])];
    
    // Send subscription message
    const subscribeMsg = {
      action: 'subscribe',
      trades: symbols,
      quotes: symbols
    };
    
    this.socket.send(JSON.stringify(subscribeMsg));
  }
  
  /**
   * Unsubscribe from crypto symbols
   * @param symbols Array of symbols to unsubscribe from
   */
  public unsubscribe(symbols: string[]): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return;
    }
    
    // Remove from tracked symbols
    this.symbols = this.symbols.filter(s => !symbols.includes(s));
    
    // Send unsubscription message
    const unsubscribeMsg = {
      action: 'unsubscribe',
      trades: symbols,
      quotes: symbols
    };
    
    this.socket.send(JSON.stringify(unsubscribeMsg));
  }
  
  /**
   * Register a callback for price updates for a specific symbol
   * @param symbol Symbol to watch (e.g., 'BTC/USD')
   * @param callback Function to call when price updates
   */
  public onPriceUpdate(symbol: string, callback: (price: number) => void): void {
    if (!this.onPriceUpdateCallbacks.has(symbol)) {
      this.onPriceUpdateCallbacks.set(symbol, []);
    }
    
    this.onPriceUpdateCallbacks.get(symbol)?.push(callback);
    
    // Subscribe to the symbol if not already subscribed
    if (!this.symbols.includes(symbol)) {
      this.subscribe([symbol]);
    }
  }
  
  /**
   * Notify all callbacks for a symbol about a price update
   */
  private notifyPriceUpdate(symbol: string, price: number): void {
    const callbacks = this.onPriceUpdateCallbacks.get(symbol);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(price);
        } catch (error) {
          console.error(`Error in price update callback for ${symbol}:`, error);
        }
      });
    }
  }
  
  /**
   * Disconnect from the WebSocket server
   */
  public disconnect(): void {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
      this.reconnectAttempts = 0;
    }
  }
  
  /**
   * Attempt to reconnect to the WebSocket server
   */
  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error(`Maximum reconnect attempts (${this.maxReconnectAttempts}) reached`);
      return;
    }
    
    this.reconnectAttempts++;
    const delay = this.reconnectDelay * this.reconnectAttempts;
    
    console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    
    setTimeout(() => {
      // Reconnect with the same API credentials
      // Note: In a real implementation, you would store these securely
      this.connect('YOUR_API_KEY', 'YOUR_API_SECRET');
    }, delay);
  }
}

// Example usage
const cryptoStream = new CryptoDataStream();

// Connect to the WebSocket API
cryptoStream.connect('YOUR_API_KEY', 'YOUR_API_SECRET');

// Register price update callbacks
cryptoStream.onPriceUpdate('BTC/USD', (price) => {
  console.log(`BTC/USD price updated: $${price}`);
  
  // Example: Execute logic based on price
  if (price > 70000) {
    console.log('BTC price above $70,000 - consider selling!');
  } else if (price < 60000) {
    console.log('BTC price below $60,000 - consider buying!');
  }
});

// You can subscribe to multiple symbols
cryptoStream.subscribe(['ETH/USD', 'SOL/USD']);

// Later, you can unsubscribe if needed
// cryptoStream.unsubscribe(['SOL/USD']);

// Disconnect when done (e.g., when your application shuts down)
// cryptoStream.disconnect();
```

### Sample Crypto Trade Message

```json
{
  "T": "trade",
  "S": "BTC/USD",
  "p": "68245.00",
  "s": "0.00125",
  "t": "2025-05-29T10:15:23.456789Z",
  "i": 123456789,
  "tks": "B"
}
```

Where:
- `T`: Message type ("trade")
- `S`: Symbol ("BTC/USD")
- `p`: Price ("68245.00")
- `s`: Size/volume ("0.00125")
- `t`: Timestamp (ISO format)
- `i`: Trade ID
- `tks`: Trade condition ("B" for buy-side, "S" for sell-side)

## Usage Example

Create a main script to use both the REST API and WebSocket clients:

```typescript
/**
 * main.ts
 * Main entry point for the application
 */

import { fetchData, getOrders, getPositions, createOrder } from './api-client';
import wsClient from './websocket-client';

// Fetch initial data using REST API
fetchData();

// Example of creating an order
const createExampleOrder = async () => {
  const orderData = {
    symbol: 'AAPL',
    qty: 1,
    side: 'buy',
    type: 'market',
    time_in_force: 'day'
  };
  
  try {
    const order = await createOrder(orderData);
    console.log('Created order:', order);
  } catch (error) {
    console.error('Failed to create order');
  }
};

// Create an example order after 5 seconds
setTimeout(createExampleOrder, 5000);
```

## Troubleshooting ECONNREFUSED Errors

If you're seeing ECONNREFUSED errors, try these solutions:

1. **Verify the server is running**:
   ```bash
   # Check if the server process is running
   ps aux | grep node
   ```

2. **Check the server port**:
   - Make sure your API service is running on the expected port (default: 9000)
   - Verify there are no port conflicts

3. **Update the connection URL**:
   - If your server is running on a different port, update the `API_BASE_URL` and `WS_URL` variables

4. **Check CORS settings**:
   - If your backend has CORS restrictions, make sure your client's origin is allowed

5. **Try a different host**:
   - Instead of `localhost`, try using `127.0.0.1` explicitly

6. **Check firewall settings**:
   - Ensure your firewall isn't blocking local connections

7. **Verify network configuration**:
   - If using Docker or VMs, ensure proper network configuration

## Specific Solution for Your Error

Based on the ECONNREFUSED errors you're seeing, the most likely issues are:

1. The backend server isn't running when you're making the requests
2. The server is running on a different port than what your client is trying to connect to

Try these specific steps:

1. Start your backend server first:
   ```bash
   cd backend
   npm run dev
   ```

2. Verify the server is running and note the port (check the console output)

3. Update your client code to use the correct port

4. If using Vite for your frontend, check your Vite configuration for proxy settings:
   ```javascript
   // vite.config.js
   export default {
     server: {
       proxy: {
         '/api': {
           target: 'http://localhost:9000',
           changeOrigin: true,
         }
       }
     }
   }
   ```

5. Try using direct API calls without the proxy for testing:
   ```typescript
   const API_BASE_URL = 'http://localhost:9000/api'; // Use the actual port
   ```

By following this guide, you should be able to connect to your Alpaca API service from any local TypeScript application, regardless of which browser you're using.
