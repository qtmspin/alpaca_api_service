# 🦙 Alpaca API Service

A TypeScript service for interacting with the Alpaca API with enhanced features for pre-market and post-market trading, featuring real-time WebSocket-based order monitoring with sub-100ms latency.

## 📚 Documentation

- [API Endpoint Management](./docs/api-endpoint-management.md)
- [Artificial Orders](./docs/artificial-orders.md)

## 🛠️ Tech Stack

- **Node.js**: [nodejs.org](https://nodejs.org) - JavaScript runtime
- **Express**: [expressjs.com](https://expressjs.com) - Web framework
- **TypeScript**: [typescriptlang.org](https://www.typescriptlang.org) - Type safety
- **Alpaca TypeScript SDK**: [github.com/alpacahq/typescript-sdk](https://github.com/alpacahq/typescript-sdk) - Official Alpaca API client
- **SQLite**: [sqlite.org](https://www.sqlite.org) - Database for order persistence
- **Zustand**: [zustand](https://github.com/pmndrs/zustand) - State management
- **Zod**: [zod](https://github.com/colinhacks/zod) - TypeScript-first schema validation
- **Tailwind CSS**: [tailwindcss.com](https://tailwindcss.com) - Utility-first CSS framework
- **React**: [reactjs.org](https://reactjs.org) - Frontend framework
- **Flexlayout**: [flexlayout.io](https://flexlayout.io) - Layout engine

## 🎯 Core Philosophy

**Centralized Management:**
- **Configuration UI**: Manage API keys, rate limits, and order settings through UI
- **Order Management**: Artificial stop-limits with cool-down and duplicate detection
- **Local Service**: Secure local-only API (no external authentication needed)
- **Order Persistence**: SQLite for reliable order logs and audit trail
- **Simplified API**: Direct response formats without unnecessary nesting

## 🏗️ Project Structure

```
alpaca_api_service/
├── .vscode/                      # VS Code configuration
├── backend/
│   ├── src/
│   │   ├── api/                  # API controllers and routes
│   │   │   ├── account-controller.ts    # Account endpoints
│   │   │   ├── artificial-orders-controller.ts # Artificial orders
│   │   │   ├── config-controller.ts     # Configuration endpoints
│   │   │   ├── market-data-controller.ts # Market data endpoints
│   │   │   ├── order-controller.ts      # Order management
│   │   │   ├── position-controller.ts   # Position management
│   │   │   └── routes.ts               # Route configuration
│   │   ├── core/                 # Core business logic and schemas
│   │   │   ├── artificial-orders.ts    # Artificial order management
│   │   │   ├── market-data-subscription.ts # Real-time market data subscriptions
│   │   │   ├── config-manager.ts       # Configuration management
│   │   │   ├── errors.ts               # Error handling
│   │   │   ├── index.ts               # Core exports
│   │   │   └── schemas.ts              # Zod schemas and validation
│   │   ├── services/             # External service integrations
│   │   │   ├── alpaca-client.ts        # Alpaca API client
│   │   │   ├── database-service.ts     # SQLite database service
│   │   │   └── websocket-server.ts     # WebSocket server
│   │   └── index.ts             # Main entry point
│   ├── package.json             # Backend dependencies
│   └── tsconfig.json            # TypeScript configuration
├── frontend/                    # Frontend application (React/Vue)
└── docs/                        # Documentation
    ├── api-endpoint-management.md
    └── artificial-orders.md
```

## ✨ Features

### 🕒 Market Hours Management

- **Pre-market**: 4:30 AM to 9:30 AM Eastern
- **Regular market**: 9:30 AM to 4:00 PM Eastern
- **Post-market**: 4:00 PM to 8:00 PM Eastern

### 🛑 Artificial Orders

Implements stop and stop-limit orders during pre-market and post-market hours when these order types aren't natively supported by the exchange. Features real-time WebSocket-based price monitoring with sub-100ms latency for near-instant order execution when conditions are met.

```typescript
// Example: Creating an artificial stop order
await fetch('/api/artificial-orders', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    symbol: 'AAPL',
    qty: 10,
    side: 'sell',
    stopPrice: 150.50,
    orderType: 'stop'
  })
});
```

### 🔄 WebSocket Streaming

Real-time updates for orders, positions, and market data via WebSocket.

```typescript
// Example: Connecting to WebSocket
const ws = new WebSocket('ws://localhost:3000/ws');
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Received:', data);
};

// Subscribe to updates
ws.send(JSON.stringify({
  action: 'subscribe',
  channel: 'orders'
}));
```

### ⚙️ Configuration Management

Centralized configuration with runtime and startup settings.

```typescript
// Example: Updating runtime configuration
await fetch('/api/config', {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    runtime: {
      orderRules: {
        cooldownMs: 1000,
        duplicateWindowMs: 5000
      }
    }
  })
});
```

## 🚀 Getting Started

### Prerequisites

- Node.js 16+
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/alpaca_api_service.git
cd alpaca_api_service

# Install backend dependencies
cd backend
npm install

# Start the development server
npm run dev
```

### Configuration

Create a `config.json` file in the `backend/config` directory:

```json
{
  "startup": {
    "alpacaKeyId": "YOUR_API_KEY",
    "alpacaSecretKey": "YOUR_SECRET_KEY",
    "alpacaPaperTrading": true,
    "port": 3000
  },
  "runtime": {
    "orderRules": {
      "cooldownMs": 1000,
      "duplicateWindowMs": 5000,
      "maxOrdersPerMinute": 10
    },
    "artificialOrdersEnabled": true,
    "preMarketOrdersEnabled": true,
    "postMarketOrdersEnabled": true
  }
}
```

## 📝 License

MIT
