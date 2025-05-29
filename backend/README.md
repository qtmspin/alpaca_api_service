# Alpaca API Service Backend

This is the backend service for the Alpaca API integration, providing a clean interface for trading and market data operations.

## Features

- REST API for trading operations
- WebSocket streaming for real-time market data, orders, and positions with sub-100ms latency
- Separation of concerns with dedicated controllers for REST and WebSocket operations
- Support for paper trading
- Configurable rate limiting
- Market hours handling (pre-market, regular, post-market)
- Artificial order execution for unsupported order types
- Event-driven architecture for real-time trading strategies

## Prerequisites

- Node.js 16+ and npm
- Alpaca API credentials (API Key and Secret)

## Getting Started

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Set up configuration**:
   ```bash
   npm run setup
   ```
   This will create a `config/config.json` file from the template.

3. **Edit the configuration**:
   Open `config/config.json` and update with your Alpaca API credentials:
   ```json
   {
     "runtime": {
       "alpaca": {
         "apiKey": "YOUR_API_KEY",
         "secretKey": "YOUR_API_SECRET",
         "paperTrading": true
       }
     }
   }
   ```

4. **Start the development server**:
   ```bash
   npm run dev
   ```

## Available Scripts

- `npm run dev` - Start development server with hot-reload
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run lint` - Run ESLint
- `npm run test` - Run tests
- `npm run setup` - Set up configuration (run this first)

## Configuration

All configuration is done through `config/config.json`. The following settings are available:

### Runtime Settings
- `alpaca`: Alpaca API credentials and settings
- `rateLimits`: API rate limiting configuration
- `orderRules`: Order validation rules
- `marketHours`: Market hours configuration
- `monitoring`: Performance monitoring settings

### Startup Settings
- `apiPort`: Port for the REST API server
- `monitorPort`: Port for the monitoring interface

## Environment Variables

You can also use environment variables to override configuration:

- `ALPACA_API_KEY`: Your Alpaca API key
- `ALPACA_API_SECRET`: Your Alpaca API secret
- `ALPACA_PAPER`: Set to 'true' for paper trading (default: true)
- `API_PORT`: Port for the REST API server (default: 9000)

## Development

### Project Structure

```
backend/
├── src/                    # Source files
│   ├── api/                # API routes and controllers
│   │   ├── alpaca-rest-controller.ts    # REST API endpoints for Alpaca
│   │   ├── alpaca-websocket-controller.ts # WebSocket functionality for Alpaca
│   │   └── ...             # Other controllers
│   ├── core/               # Core business logic
│   │   ├── market-data-subscription.ts  # Market data WebSocket subscription manager
│   │   ├── orders-positions-subscription.ts # Orders and positions WebSocket manager
│   │   └── ...             # Other core modules
│   ├── services/           # External service integrations
│   ├── utils/              # Utility functions
│   └── index.ts            # Application entry point
├── config/                 # Configuration files
│   ├── config.json         # Local configuration (ignored by git)
│   └── config.template.json # Template for configuration
├── scripts/                # Utility scripts
├── test/                   # Test files
├── .env                    # Environment variables (ignored by git)
├── package.json
└── tsconfig.json
```

## License

MIT
