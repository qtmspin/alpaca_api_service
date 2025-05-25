# API Endpoint Management Documentation

## Overview

This document provides comprehensive documentation for all API endpoints in the Alpaca Service, including request/response formats, error handling, and usage examples.

## Base Configuration

**Base URL**: `http://localhost:9000`  
**Content-Type**: `application/json`  
**API Version**: `v1` (implied, not in URL)

## Consistent Variable Naming Convention

To ensure consistency across the entire API, all variables follow these naming conventions:

**Note:** While API fields use camelCase as shown below, database schemas use snake_case for field names (e.g., order_id, client_order_id, etc.) as is common in SQL implementations.

### Common Field Names
- `symbol` - Stock symbol (always uppercase)
- `qty` - Quantity (number, not "quantity" or "amount")
- `side` - Order side ("buy" or "sell")
- `orderType` - Type of order (camelCase)
- `orderId` - Alpaca order ID
- `clientOrderId` - Client-specified order ID
- `limitPrice` - Limit price for orders
- `stopPrice` - Stop price for orders
- `timeInForce` - Order time in force
- `createdAt` - Creation timestamp
- `updatedAt` - Last update timestamp
- `filledQty` - Filled quantity
- `filledAvgPrice` - Average fill price

### Response Status Fields
- `status` - Current status of entity
- `message` - Human-readable message
- `error` - Error object with `code` and `detail`
- `data` - Main response payload

## Configuration Management Endpoints

### GET /api/config
Get current service configuration.

**Response:**
```json
{
  "runtime": {
    "alpaca": {
      "apiKey": "PK***********",
      "apiSecret": "**********",
      "paperTrading": true
    },
    "rateLimits": {
      "orders": 200,
      "data": 200,
      "burst": 10
    },
    "orderRules": {
      "cooldownMs": 1000,
      "duplicateWindowMs": 5000,
      "maxPerSymbol": 5,
      "maxTotal": 50
    },
    "marketHours": {
      "enablePreMarket": true,
      "enableAfterHours": false
    },
    "monitoring": {
      "priceCheckIntervalMs": 100,
      "websocketHeartbeatMs": 30000
    }
  },
  "startup": {
    "apiPort": 9000,
    "monitorPort": 5900
  }
}
```

### PUT /api/config
Update service configuration.

**Note:** Most configuration settings can be updated dynamically without restarting the service. However, `apiPort` and `monitorPort` settings require a service restart to take effect and should be updated through other means.

**Request:**
```json
{
  "runtime": {
    "rateLimits": {
      "orders": 150
    },
    "orderRules": {
      "cooldownMs": 2000
    },
    "marketHours": {
      "enableAfterHours": true
    }
  }
}
```

**Response:**
```json
{
  "runtime": {
    "alpaca": {
      "apiKey": "PK***********",
      "apiSecret": "**********",
      "paperTrading": true
    },
    "rateLimits": {
      "orders": 150,
      "data": 200,
      "burst": 10
    },
    "orderRules": {
      "cooldownMs": 2000,
      "duplicateWindowMs": 5000,
      "maxPerSymbol": 5,
      "maxTotal": 50
    },
    "marketHours": {
      "enablePreMarket": true,
      "enableAfterHours": true
    },
    "monitoring": {
      "priceCheckIntervalMs": 100,
      "websocketHeartbeatMs": 30000
    }
  },
  "startup": {
    "apiPort": 9000,
    "monitorPort": 5900
  }
}
```

**Error Response (400):**
```json
{
  "code": "INVALID_CONFIG",
  "message": "Validation failed",
  "fields": {
    "runtime.rateLimits.orders": "Must be between 1 and 500",
    "runtime.orderRules.cooldownMs": "Minimum value is 100"
  }
}
```

### POST /api/config/validate
Validate configuration without applying changes.

**Request:**
```json
{
  "runtime": {
    "rateLimits": {
      "orders": 1000
    },
    "alpaca": {
      "apiKey": "PKTEST123"
    }
  }
}
```

**Response:**
```json
{
  "valid": false,
  "errors": {
    "runtime.rateLimits.orders": "Exceeds maximum allowed value of 500"
  },
  "warnings": {
    "runtime.alpaca.apiKey": "Using test API key"
  }
}
```

### GET /api/config/limits
Get current rate limit status.

**Response:**
```json
{
  "orders": {
    "limit": 200,
    "remaining": 185,
    "resetAt": "2025-01-15T14:30:00Z",
    "windowMs": 60000
  },
  "data": {
    "limit": 200,
    "remaining": 198,
    "resetAt": "2025-01-15T14:30:00Z",
    "windowMs": 60000
  }
}
```

## Account Endpoints

### GET /api/account
Get account information.

**Response:**
```json
{
  "accountNumber": "123456789",
  "status": "ACTIVE",
  "currency": "USD",
  "buyingPower": 100000.00,
  "cash": 50000.00,
  "portfolioValue": 150000.00,
  "patternDayTrader": false,
  "tradingBlocked": false,
  "transfersBlocked": false,
  "accountBlocked": false,
  "createdAt": "2025-01-01T00:00:00Z",
  "updatedAt": "2025-01-15T14:25:00Z"
}
```

## Position Endpoints

### GET /api/positions
Get all positions.

**Response:**
```json
[
  {
    "symbol": "AAPL",
    "qty": 100,
    "avgEntryPrice": 150.25,
    "side": "long",
    "marketValue": 15250.00,
    "costBasis": 15025.00,
    "unrealizedPl": 225.00,
    "unrealizedPlpc": 0.015,
    "currentPrice": 152.50,
    "lastdayPrice": 151.00,
    "changeToday": 0.0099
  }
]
```

### GET /api/positions/{symbol}
Get specific position.

**Parameters:**
- `symbol` (path) - Stock symbol

**Response:**
```json
{
  "symbol": "AAPL",
  "qty": 100,
  "avgEntryPrice": 150.25,
  "side": "long",
  "marketValue": 15250.00,
  "costBasis": 15025.00,
  "unrealizedPl": 225.00,
  "unrealizedPlpc": 0.015,
  "currentPrice": 152.50,
  "lastdayPrice": 151.00,
  "changeToday": 0.0099
}
```

**Error Response (404):**
```json
{
  "code": "POSITION_NOT_FOUND",
  "message": "No position found for symbol AAPL"
}
```

## Order Management Endpoints

### POST /api/orders
Place a new order with duplicate and rate limit checks.

**Request:**
```json
{
  "symbol": "AAPL",
  "qty": 100,
  "side": "buy",
  "orderType": "limit",
  "timeInForce": "day",
  "limitPrice": 150.00,
  "clientOrderId": "my-order-123"
}
```

**Order Types:**
- `market` - Market order
- `limit` - Limit order (requires `limitPrice`)
- `stop` - Stop order (requires `stopPrice`)
- `stop_limit` - Stop limit order (requires both `stopPrice` and `limitPrice`)

**Time in Force Options:**
- `day` - Day order
- `gtc` - Good till canceled
- `opg` - Market on open
- `cls` - Market on close
- `ioc` - Immediate or cancel
- `fok` - Fill or kill

**Response:**
```json
{
  "status": "success",
  "data": {
    "orderId": "abc-123-def",
    "clientOrderId": "my-order-123",
    "symbol": "AAPL",
    "qty": 100,
    "side": "buy",
    "orderType": "limit",
    "timeInForce": "day",
    "limitPrice": 150.00,
    "status": "pending_new",
    "createdAt": "2025-01-15T14:30:00Z",
    "updatedAt": "2025-01-15T14:30:00Z",
    "submittedAt": "2025-01-15T14:30:00Z"
  }
}
```

**Error Responses:**

**Rate Limit (429):**
```json
{
  "code": "RATE_LIMIT_EXCEEDED",
  "message": "Order rate limit exceeded",
  "retryAfter": 45
}
```

**Duplicate Order (409):**
```json
{
  "code": "DUPLICATE_ORDER",
  "message": "Duplicate order detected within 5000ms window",
  "existingOrderId": "xyz-789-abc"
}
```

**Cooldown Active (429):**
```json
{
  "code": "COOLDOWN_ACTIVE",
  "message": "Order cooldown active for AAPL",
  "cooldownRemainingMs": 750
}
```

### GET /api/orders
Get orders with optional filters.

**Query Parameters:**
- `status` - Filter by status (open, closed, all)
- `symbol` - Filter by symbol
- `side` - Filter by side (buy, sell)
- `limit` - Number of results (default: 50, max: 500)
- `after` - Cursor for pagination
- `startDate` - Start date (ISO 8601)
- `endDate` - End date (ISO 8601)

**Response:**
```json
{
  "status": "success",
  "data": {
    "orders": [
      {
        "orderId": "abc-123-def",
        "clientOrderId": "my-order-123",
        "symbol": "AAPL",
        "qty": 100,
        "filledQty": 100,
        "side": "buy",
        "orderType": "limit",
        "timeInForce": "day",
        "limitPrice": 150.00,
        "status": "filled",
        "filledAvgPrice": 149.95,
        "createdAt": "2025-01-15T14:30:00Z",
        "updatedAt": "2025-01-15T14:31:00Z",
        "submittedAt": "2025-01-15T14:30:00Z",
        "filledAt": "2025-01-15T14:31:00Z"
      }
    ],
    "nextCursor": "eyJvcmRlcklkIjoiYWJjLTEyMy1kZWYifQ=="
  }
}
```

### GET /api/orders/{orderId}
Get specific order details.

**Parameters:**
- `orderId` (path) - Order ID

**Response:**
```json
{
  "status": "success",
  "data": {
    "orderId": "abc-123-def",
    "clientOrderId": "my-order-123",
    "symbol": "AAPL",
    "qty": 100,
    "filledQty": 50,
    "remainingQty": 50,
    "side": "buy",
    "orderType": "limit",
    "timeInForce": "day",
    "limitPrice": 150.00,
    "status": "partially_filled",
    "filledAvgPrice": 149.98,
    "createdAt": "2025-01-15T14:30:00Z",
    "updatedAt": "2025-01-15T14:35:00Z",
    "submittedAt": "2025-01-15T14:30:00Z",
    "fills": [
      {
        "fillId": "fill-001",
        "qty": 30,
        "price": 149.95,
        "filledAt": "2025-01-15T14:31:00Z"
      },
      {
        "fillId": "fill-002",
        "qty": 20,
        "price": 150.02,
        "filledAt": "2025-01-15T14:33:00Z"
      }
    ]
  }
}
```

### DELETE /api/orders/{orderId}
Cancel an order.

**Parameters:**
- `orderId` (path) - Order ID

**Response:**
```json
{
  "status": "success",
  "message": "Order cancelled",
  "data": {
    "orderId": "abc-123-def",
    "status": "pending_cancel",
    "canceledAt": "2025-01-15T14:40:00Z"
  }
}
```

### GET /api/orders/history
Get complete order history with audit trail.

**Query Parameters:**
- `symbol` - Filter by symbol
- `side` - Filter by side
- `startDate` - Start date (ISO 8601)
- `endDate` - End date (ISO 8601)
- `status` - Filter by status
- `limit` - Number of results (default: 100, max: 1000)
- `offset` - Offset for pagination

**Response:**
```json
{
  "status": "success",
  "data": {
    "orders": [
      {
        "orderId": "abc-123-def",
        "clientOrderId": "my-order-123",
        "symbol": "AAPL",
        "qty": 100,
        "filledQty": 100,
        "side": "buy",
        "orderType": "limit",
        "limitPrice": 150.00,
        "status": "filled",
        "filledAvgPrice": 149.95,
        "createdAt": "2025-01-15T14:30:00Z",
        "updatedAt": "2025-01-15T14:31:00Z",
        "filledAt": "2025-01-15T14:31:00Z",
        "duplicateCheckPassed": true,
        "rateLimitStatus": "allowed",
        "notes": "Order executed successfully"
      }
    ],
    "total": 1523,
    "offset": 0,
    "limit": 100
  }
}
```

## Artificial Order Endpoints

### POST /api/artificial-orders
Create an artificial stop-limit order.

**Note:** The `orderType` field is automatically derived by the service based on the provided parameters (e.g., 'stop_limit' if both triggerPrice and limitPrice are provided, or 'stop' if only triggerPrice is provided).

**Request:**
```json
{
  "symbol": "AAPL",
  "qty": 100,
  "side": "sell",
  "triggerPrice": 148.00,
  "limitPrice": 147.50,
  "timeInForce": "day",
  "notes": "Stop loss for AAPL position"
}
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "artificialId": "art-456-ghi",
    "symbol": "AAPL",
    "qty": 100,
    "side": "sell",
    "triggerPrice": 148.00,
    "limitPrice": 147.50,
    "orderType": "stop_limit",
    "timeInForce": "day",
    "status": "pending",
    "createdAt": "2025-01-15T14:45:00Z",
    "notes": "Stop loss for AAPL position"
  }
}
```

### GET /api/artificial-orders
Get all artificial orders.

**Query Parameters:**
- `status` - Filter by status (pending, triggered, executed, cancelled)
- `symbol` - Filter by symbol

**Response:**
```json
{
  "status": "success",
  "data": [
    {
      "artificialId": "art-456-ghi",
      "symbol": "AAPL",
      "qty": 100,
      "side": "sell",
      "triggerPrice": 148.00,
      "limitPrice": 147.50,
      "orderType": "stop_limit",
      "status": "pending",
      "currentPrice": 149.25,
      "distanceFromTrigger": 1.25,
      "distancePercent": 0.84,
      "createdAt": "2025-01-15T14:45:00Z"
    }
  ]
}
```

### GET /api/artificial-orders/{artificialId}
Get specific artificial order.

**Parameters:**
- `artificialId` (path) - Artificial order ID

**Response:**
```json
{
  "status": "success",
  "data": {
    "artificialId": "art-456-ghi",
    "symbol": "AAPL",
    "qty": 100,
    "side": "sell",
    "triggerPrice": 148.00,
    "limitPrice": 147.50,
    "orderType": "stop_limit",
    "status": "triggered",
    "currentPrice": 147.85,
    "triggeredAt": "2025-01-15T15:30:00Z",
    "executedOrderId": "abc-789-jkl",
    "createdAt": "2025-01-15T14:45:00Z",
    "notes": "Stop loss for AAPL position"
  }
}
```

### DELETE /api/artificial-orders/{artificialId}
Cancel an artificial order.

**Parameters:**
- `artificialId` (path) - Artificial order ID

**Response:**
```json
{
  "status": "success",
  "message": "Artificial order cancelled",
  "data": {
    "artificialId": "art-456-ghi",
    "status": "cancelled",
    "cancelledAt": "2025-01-15T15:00:00Z"
  }
}
```

### GET /api/artificial-orders/status
Get artificial order engine status.

**Response:**
```json
{
  "status": "success",
  "data": {
    "engineStatus": "running",
    "pendingOrders": 5,
    "triggeredToday": 3,
    "executedToday": 3,
    "failedToday": 0,
    "priceCheckIntervalMs": 100,
    "lastCheckAt": "2025-01-15T15:30:05Z",
    "uptime": 3600000,
    "marketStatus": "open"
  }
}
```

## Market Data Endpoints

### GET /api/market/quote/{symbol}
Get latest quote for a symbol.

**Parameters:**
- `symbol` (path) - Stock symbol

**Response:**
```json
{
  "status": "success",
  "data": {
    "symbol": "AAPL",
    "bidPrice": 149.95,
    "bidSize": 100,
    "askPrice": 150.00,
    "askSize": 200,
    "lastPrice": 149.98,
    "lastSize": 50,
    "timestamp": "2025-01-15T15:30:00Z",
    "conditions": ["R"],
    "tape": "C"
  }
}
```

### GET /api/market/bars/{symbol}
Get historical bars for a symbol.

**Parameters:**
- `symbol` (path) - Stock symbol
- `timeframe` (query) - Bar timeframe (1Min, 5Min, 15Min, 1Hour, 1Day)
- `start` (query) - Start time (ISO 8601)
- `end` (query) - End time (ISO 8601)
- `limit` (query) - Number of bars (default: 100, max: 1000)

**Response:**
```json
{
  "status": "success",
  "data": {
    "symbol": "AAPL",
    "bars": [
      {
        "timestamp": "2025-01-15T15:30:00Z",
        "open": 149.80,
        "high": 150.10,
        "low": 149.75,
        "close": 149.98,
        "volume": 125000,
        "vwap": 149.95,
        "tradeCount": 450
      }
    ],
    "nextPageToken": "eyJ0aW1lc3RhbXAiOiIyMDI1LTAxLTE1VDE1OjMwOjAwWiJ9"
  }
}
```

### POST /api/market/subscribe
Subscribe to real-time market data.

**Request:**
```json
{
  "symbols": ["AAPL", "GOOGL", "MSFT"],
  "dataTypes": ["quotes", "trades", "bars"]
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Subscribed to market data",
  "data": {
    "subscribed": ["AAPL", "GOOGL", "MSFT"],
    "dataTypes": ["quotes", "trades", "bars"]
  }
}
```

## Health Check Endpoints

### GET /api/health
Get overall service health.

**Response:**
```json
{
  "status": "success",
  "data": {
    "status": "healthy",
    "timestamp": "2025-01-15T15:30:00Z",
    "version": "1.0.0",
    "uptime": 3600000,
    "checks": {
      "database": "healthy",
      "alpaca": "healthy",
      "websocket": "healthy",
      "orderEngine": "healthy"
    }
  }
}
```

### GET /api/health/alpaca
Get Alpaca connection status.

**Response:**
```json
{
  "status": "success",
  "data": {
    "connected": true,
    "accountStatus": "ACTIVE",
    "lastPing": "2025-01-15T15:29:55Z",
    "apiCallsRemaining": 185,
    "apiResetAt": "2025-01-15T16:00:00Z",
    "dataSubscriptions": 3,
    "marketStatus": "open"
  }
}
```

### GET /api/health/orders
Get order engine status.

**Response:**
```json
{
  "status": "success",
  "data": {
    "engineStatus": "running",
    "ordersProcessedToday": 45,
    "ordersInQueue": 2,
    "averageProcessingTimeMs": 38,
    "duplicatesBlockedToday": 3,
    "rateLimitBlocksToday": 1,
    "cooldownBlocksToday": 5,
    "lastProcessedAt": "2025-01-15T15:29:58Z"
  }
}
```

### GET /api/status
Get detailed service status.

**Response:**
```json
{
  "status": "success",
  "data": {
    "service": {
      "name": "Alpaca API Service",
      "version": "1.0.0",
      "environment": "production",
      "startedAt": "2025-01-15T12:00:00Z",
      "uptime": 3600000
    },
    "connections": {
      "alpacaApi": "connected",
      "alpacaStream": "connected",
      "database": "connected",
      "websocketClients": 5
    },
    "performance": {
      "cpuUsage": 15.2,
      "memoryUsage": 256.5,
      "requestsPerMinute": 120,
      "averageResponseTimeMs": 25
    },
    "configuration": {
      "orderRateLimit": 200,
      "dataRateLimit": 200,
      "maxOrdersPerSymbol": 5,
      "maxTotalOrders": 50
    }
  }
}
```

## Error Response Format

All error responses follow this consistent format:

```json
{
  "code": "ERROR_CODE",
  "message": "Human-readable error message",
  "fields": {
    "field_name": "Field-specific error message"
  }, // Optional: for validation errors
  "metadata": {} // Optional: additional error context
}
```

### Common Error Codes

- `INVALID_REQUEST` - Request validation failed
- `RATE_LIMIT_EXCEEDED` - Rate limit exceeded
- `DUPLICATE_ORDER` - Duplicate order detected
- `COOLDOWN_ACTIVE` - Order cooldown period active
- `INSUFFICIENT_FUNDS` - Insufficient buying power
- `POSITION_NOT_FOUND` - Position not found
- `ORDER_NOT_FOUND` - Order not found
- `SYMBOL_NOT_FOUND` - Symbol not found
- `MARKET_CLOSED` - Market is closed
- `ALPACA_ERROR` - Alpaca API error
- `INTERNAL_ERROR` - Internal server error

## WebSocket Events

WebSocket connection: `ws://localhost:9000/ws`

### Outbound Events (Server → Client)

**Connection Established:**
```json
{
  "type": "connected",
  "data": {
    "sessionId": "sess-123-abc",
    "timestamp": "2025-01-15T15:30:00Z"
  }
}
```

**Quote Update:**
```json
{
  "type": "quote",
  "data": {
    "symbol": "AAPL",
    "bidPrice": 149.95,
    "askPrice": 150.00,
    "timestamp": "2025-01-15T15:30:00Z"
  }
}
```

**Order Update:**
```json
{
  "type": "order_update",
  "data": {
    "orderId": "abc-123-def",
    "symbol": "AAPL",
    "status": "filled",
    "filledQty": 100,
    "filledAvgPrice": 149.95,
    "timestamp": "2025-01-15T15:30:00Z"
  }
}
```

**Artificial Order Triggered:**
```json
{
  "type": "artificial_order_triggered",
  "data": {
    "artificialId": "art-456-ghi",
    "symbol": "AAPL",
    "triggerPrice": 148.00,
    "currentPrice": 147.85,
    "executedOrderId": "abc-789-jkl",
    "timestamp": "2025-01-15T15:30:00Z"
  }
}
```

**Position Update:**
```json
{
  "type": "position_update",
  "data": {
    "symbol": "AAPL",
    "qty": 100,
    "marketValue": 14985.00,
    "unrealizedPl": -40.00,
    "timestamp": "2025-01-15T15:30:00Z"
  }
}
```

**Error Event:**
```json
{
  "type": "error",
  "data": {
    "code": "SUBSCRIPTION_FAILED",
    "detail": "Failed to subscribe to INVALID",
    "timestamp": "2025-01-15T15:30:00Z"
  }
}
```

### Inbound Events (Client → Server)

**Subscribe to Market Data:**
```json
{
  "type": "subscribe",
  "data": {
    "symbols": ["AAPL", "GOOGL"],
    "dataTypes": ["quotes", "trades"]
  }
}
```

**Unsubscribe from Market Data:**
```json
{
  "type": "unsubscribe",
  "data": {
    "symbols": ["AAPL"]
  }
}
```

**Heartbeat:**
```json
{
  "type": "heartbeat",
  "data": {
    "timestamp": "2025-01-15T15:30:00Z"
  }
}
```

## Rate Limiting

The API implements dynamic rate limiting that can be configured via the UI:

- **Order Endpoints**: Configurable limit (default: 200/minute)
- **Data Endpoints**: Configurable limit (default: 200/minute)
- **Burst Allowance**: Configurable burst capacity

Rate limit headers are included in all responses:
- `X-RateLimit-Limit`: Request limit per window
- `X-RateLimit-Remaining`: Remaining requests in window
- `X-RateLimit-Reset`: Window reset time (Unix timestamp)

## Best Practices

1. **Always check rate limit headers** before making multiple requests
2. **Use WebSocket for real-time data** instead of polling REST endpoints
3. **Implement exponential backoff** for retry logic
4. **Store clientOrderId** for order tracking and duplicate prevention
5. **Monitor cooldown periods** to avoid rejected orders
6. **Use proper error handling** for all API calls
7. **Validate orders client-side** before submission
8. **Subscribe to WebSocket events** for order and position updates

## Example: Complete Order Flow

```typescript
// 1. Check configuration and limits
const config = await client.getConfig();
const limits = await client.getRateLimits();

// 2. Validate order parameters
const orderRequest: OrderRequest = {
  symbol: "AAPL",
  qty: 100,
  side: "buy",
  orderType: "limit",
  limitPrice: 150.00,
  timeInForce: "day",
  clientOrderId: `order-${Date.now()}`
};

// 3. Place order with error handling
try {
  const order = await client.placeOrder(orderRequest);
  console.log(`Order placed: ${order.orderId}`);
  
  // 4. Monitor order via WebSocket
  // Order updates will come through WebSocket events
  
} catch (error) {
  if (error.code === 'RATE_LIMIT_EXCEEDED') {
    console.log(`Retry after ${error.retryAfter} seconds`);
  } else if (error.code === 'DUPLICATE_ORDER') {
    console.log(`Duplicate order: ${error.existingOrderId}`);
  } else if (error.code === 'COOLDOWN_ACTIVE') {
    console.log(`Cooldown remaining: ${error.cooldownRemainingMs}ms`);
  }
}

// 5. Check order status
const orderStatus = await client.getOrder(order.orderId);

// 6. View in order history
const history = await client.getOrderHistory({
  symbol: "AAPL",
  startDate: new Date().toISOString()
});
```