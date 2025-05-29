# Artificial Orders

## Overview

Artificial orders are a mechanism for handling stop and stop-limit orders during pre-market (4:30 AM - 9:30 AM Eastern) and post-market (4:00 PM - 8:00 PM Eastern) hours when these order types aren't supported by the exchange. The Alpaca API Service implements an artificial order system that uses WebSocket connections for real-time price monitoring with sub-100ms latency, executing market or limit orders immediately when trigger conditions are met.

The system is fully integrated with the real-time orders and positions WebSocket streaming, providing instant updates when artificial orders are triggered and executed.

## Market Hours

The service defines market hours as follows:

- **Pre-market**: 4:30 AM to 9:30 AM Eastern
- **Regular market**: 9:30 AM to 4:00 PM Eastern
- **Post-market**: 4:00 PM to 8:00 PM Eastern

## Configuration

Artificial orders can be enabled or disabled through the service configuration:

```json
{
  "runtime": {
    "marketHours": {
      "enablePreMarket": true,
      "enableAfterHours": true
    }
  }
}
```

## API Endpoints

### POST /api/artificial-orders

Create a new artificial order.

**Request:**
```json
{
  "symbol": "AAPL",
  "qty": 10,
  "side": "buy",
  "triggerPrice": 150.00,
  "limitPrice": 151.00,
  "timeInForce": "day",
  "notes": "Buy when price rises above $150"
}
```

**Response (201 Created):**
```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "symbol": "AAPL",
  "qty": 10,
  "side": "buy",
  "triggerPrice": 150.00,
  "limitPrice": 151.00,
  "timeInForce": "day",
  "notes": "Buy when price rises above $150",
  "status": "pending",
  "isStopLimit": true,
  "createdAt": "2025-01-15T04:45:00Z",
  "updatedAt": "2025-01-15T04:45:00Z"
}
```

### GET /api/artificial-orders

Get all artificial orders.

**Query Parameters:**
- `status` (optional): Filter by status (pending, triggered, filled, canceled, expired)

**Response:**
```json
[
  {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "symbol": "AAPL",
    "qty": 10,
    "side": "buy",
    "triggerPrice": 150.00,
    "limitPrice": 151.00,
    "timeInForce": "day",
    "notes": "Buy when price rises above $150",
    "status": "pending",
    "isStopLimit": true,
    "createdAt": "2025-01-15T04:45:00Z",
    "updatedAt": "2025-01-15T04:45:00Z"
  }
]
```

### GET /api/artificial-orders/{id}

Get a specific artificial order.

**Response:**
```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "symbol": "AAPL",
  "qty": 10,
  "side": "buy",
  "triggerPrice": 150.00,
  "limitPrice": 151.00,
  "timeInForce": "day",
  "notes": "Buy when price rises above $150",
  "status": "pending",
  "isStopLimit": true,
  "createdAt": "2025-01-15T04:45:00Z",
  "updatedAt": "2025-01-15T04:45:00Z"
}
```

### DELETE /api/artificial-orders/{id}

Cancel an artificial order.

**Response:**
```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "symbol": "AAPL",
  "qty": 10,
  "side": "buy",
  "triggerPrice": 150.00,
  "limitPrice": 151.00,
  "timeInForce": "day",
  "notes": "Buy when price rises above $150",
  "status": "canceled",
  "isStopLimit": true,
  "createdAt": "2025-01-15T04:45:00Z",
  "updatedAt": "2025-01-15T05:15:00Z"
}
```

## Error Responses

**Validation Error (400):**
```json
{
  "code": "VALIDATION_ERROR",
  "message": "Invalid order request",
  "fields": {
    "triggerPrice": "Expected number, received string"
  }
}
```

**Market Closed Error (400):**
```json
{
  "code": "MARKET_CLOSED",
  "message": "Artificial orders can only be created during enabled market hours"
}
```

**Order Not Found (404):**
```json
{
  "code": "ORDER_NOT_FOUND",
  "message": "Artificial order a1b2c3d4-e5f6-7890-abcd-ef1234567890 not found"
}
```

## Order Lifecycle

Artificial orders follow this lifecycle:

1. **pending**: Initial state when order is created
2. **triggered**: Order trigger condition has been met, execution in progress
3. **filled**: Order has been executed successfully
4. **canceled**: Order was canceled by user
5. **expired**: Order expired (day orders only)

## Implementation Details

The artificial order system:

1. Uses WebSocket connections to receive real-time price updates from Alpaca
2. Maintains active subscriptions only for symbols with pending orders
3. Processes price updates immediately when received (sub-100ms latency)
4. Executes market or limit orders instantly when trigger conditions are met
5. Updates order status throughout the lifecycle
6. Automatically expires day orders at market close
7. Broadcasts real-time order updates via WebSocket when status changes
8. Integrates with the positions WebSocket stream for immediate position updates after execution

### Architecture

The system follows SOLID principles with a clean separation of concerns:

- **MarketDataSubscriptionManager**: Handles WebSocket connections and market data subscriptions
- **OrdersPositionsSubscriptionManager**: Manages WebSocket connections for orders and positions updates
- **ArtificialOrderManager**: Manages order lifecycle and trigger conditions
- **ArtificialOrdersController**: Provides the REST API endpoints

### Real-Time Updates

When an artificial order is triggered and executed, clients subscribed to the orders WebSocket channel will receive immediate updates with the new order status. This enables building reactive trading strategies that can respond instantly to order executions.

Example WebSocket message when an artificial order is filled:

```json
{
  "type": "order_update",
  "payload": {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "symbol": "AAPL",
    "qty": "10",
    "side": "buy",
    "type": "market",
    "time_in_force": "day",
    "status": "filled",
    "filled_qty": "10",
    "filled_avg_price": "151.25",
    "created_at": "2025-01-15T04:45:00Z",
    "updated_at": "2025-01-15T04:45:02Z",
    "is_artificial": true
  }
}
```

## Limitations

- Artificial orders are only available during pre-market and post-market hours if enabled in configuration
- Only day and GTC (good till canceled) time-in-force options are supported
- Requires a stable network connection to the Alpaca WebSocket API
- For optimal performance, the service should be run on a server with low latency to the broker
