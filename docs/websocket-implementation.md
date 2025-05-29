# WebSocket Implementation

## Overview

The Alpaca API Service uses WebSockets to provide real-time market data, order updates, and position updates with sub-100ms latency. This document explains the WebSocket implementation and how to use it.

## Key Features

- **Real-time Market Data**: Stream live market data for stocks and cryptocurrencies with sub-100ms latency
- **Order Updates**: Receive real-time updates when orders are created, filled, or canceled
- **Position Updates**: Get instant notifications when positions change
- **Artificial Order Monitoring**: Monitor and execute artificial orders in real-time using WebSockets instead of polling intervals
- **Automatic Reconnection**: Handles connection drops and automatically reconnects
- **Event-based Architecture**: Uses an event-driven approach for efficient data processing

## Implementation Details

### Architecture

The WebSocket implementation follows SOLID principles with a clear separation of concerns:

1. **AlpacaWebSocketController**: Manages client connections and message routing
2. **MarketDataSubscriptionManager**: Handles market data subscriptions and real-time price updates
3. **OrdersPositionsSubscriptionManager**: Manages order and position update subscriptions

This separation allows for better maintainability, testability, and scalability.

### Connection Flow

1. Client connects to the WebSocket server
2. Server establishes connections to Alpaca's WebSocket endpoints:
   - Market Data: `wss://stream.data.alpaca.markets/v2/sip` (stocks) or `wss://stream.data.alpaca.markets/v1beta2/crypto` (crypto)
   - Trading Events: `wss://paper-api.alpaca.markets/stream` (paper trading) or `wss://api.alpaca.markets/stream` (live trading)
3. Server authenticates with Alpaca using API credentials
4. Client subscribes to specific symbols or data channels
5. Server streams real-time updates to the client

### Subscription Types

- **Market Data**: Subscribe to real-time price updates for specific symbols
- **Orders**: Subscribe to order status updates
- **Positions**: Subscribe to position updates

## Using the WebSocket API

### Connecting

Connect to the WebSocket server at `ws://localhost:9000` (or your configured port).

### Subscribing to Market Data

To subscribe to market data for a specific symbol:

```json
{
  "action": "subscribe",
  "symbols": ["AAPL", "MSFT"],
  "channels": []
}
```

### Subscribing to Orders and Positions

To subscribe to order and position updates:

```json
{
  "action": "subscribe",
  "symbols": [],
  "channels": ["orders", "positions"]
}
```

### Unsubscribing

To unsubscribe from market data or channels:

```json
{
  "action": "unsubscribe",
  "symbols": ["AAPL"],
  "channels": ["orders"]
}
```

## Message Types

### Market Data Updates

```json
{
  "type": "market_data",
  "payload": {
    "symbol": "AAPL",
    "price": 150.25,
    "timestamp": "2023-05-29T12:34:56.789Z",
    "source": "trade",
    "volume": 100
  }
}
```

For quotes:

```json
{
  "type": "market_data",
  "payload": {
    "symbol": "AAPL",
    "price": 150.25,
    "timestamp": "2023-05-29T12:34:56.789Z",
    "source": "quote",
    "bid": 150.20,
    "ask": 150.30,
    "bidSize": 100,
    "askSize": 200
  }
}
```

### Order Updates

The system provides comprehensive handling of all order event types from Alpaca's WebSocket stream, with sub-100ms latency. Each order update includes detailed information specific to the event type.

#### Supported Order Event Types

| Event Type | Description |
|------------|-------------|
| `new` | Order has been routed to exchanges for execution |
| `fill` | Order has been completely filled |
| `partial_fill` | Order has been partially filled |
| `canceled` | Order has been canceled |
| `expired` | Order has expired due to time in force constraints |
| `replaced` | Order has been replaced |
| `rejected` | Order has been rejected |
| `done_for_day` | Order is done executing for the day |
| `stopped` | Order has been stopped, trade is guaranteed |
| `pending_new` | Order has been received but not yet accepted for execution |
| `pending_cancel` | Order is awaiting cancelation |
| `pending_replace` | Order is awaiting replacement |
| `calculated` | Order has been completed but settlement calculations are pending |
| `suspended` | Order has been suspended and is not eligible for trading |
| `order_replace_rejected` | Order replacement has been rejected |
| `order_cancel_rejected` | Order cancelation has been rejected |

#### Example Order Update Message

```json
{
  "type": "order_update",
  "payload": {
    "id": "order_id",
    "symbol": "AAPL",
    "side": "buy",
    "qty": "10",
    "filled_qty": "10",
    "type": "market",
    "status": "filled",
    "event": "fill",
    "eventDescription": "Order has been completely filled",
    "created_at": "2023-05-29T12:34:56.789Z",
    "filled_at": "2023-05-29T12:34:57.123Z",
    "fillDetails": {
      "timestamp": "2023-05-29T12:34:57.123Z",
      "price": "150.25",
      "quantity": "10",
      "positionSize": "10"
    }
  }
}
```

#### Event-Specific Details

Depending on the event type, the order update will include additional fields:

- **Fill Events**: Includes `fillDetails` with timestamp, price, quantity, and position size
- **Cancel Events**: Includes `cancelDetails` with timestamp
- **Expiration Events**: Includes `expirationDetails` with timestamp
- **Replace Events**: Includes `replaceDetails` with timestamp, old order ID, and new order ID
- **Rejection Events**: Includes `rejectDetails` with timestamp and reason
```

### Position Updates

```json
{
  "type": "position_update",
  "payload": {
    "symbol": "AAPL",
    "qty": "10",
    "side": "long",
    "market_value": "1502.50",
    "cost_basis": "1500.00",
    "unrealized_pl": "2.50"
  }
}
```

### Connection Status

```json
{
  "type": "connection_status",
  "payload": {
    "marketData": {
      "connected": true,
      "authenticated": true
    },
    "tradingEvents": {
      "connected": true,
      "authenticated": true
    },
    "lastUpdated": "2023-05-29T12:34:56.789Z"
  }
}
```

## Artificial Order Monitoring

The system uses WebSockets to monitor and execute artificial orders in real-time, providing sub-100ms latency for order execution. This is a significant improvement over the previous polling-based approach.

### How It Works

1. When the service starts, it establishes a WebSocket connection to Alpaca's market data stream
2. As artificial orders are created, the system automatically subscribes to real-time data for those symbols
3. When price updates arrive via WebSocket, they're immediately processed against pending orders
4. If a price condition is met, the order is executed with minimal latency

### Benefits

- **Lower Latency**: Sub-100ms execution time compared to seconds with polling
- **Reduced API Usage**: No need for frequent REST API calls to check prices
- **Better Scalability**: Can handle more symbols and orders with less overhead
- **Improved Reliability**: Includes fallback to interval-based monitoring if WebSocket connection fails

## Performance Considerations

- The WebSocket implementation is designed to run on a server near the broker to minimize latency
- For optimal performance, limit the number of symbols subscribed to what's necessary
- The system automatically manages subscriptions based on active orders and client connections
