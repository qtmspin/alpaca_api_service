/**
 * index.ts
 * 
 * This is the main entry point for the Alpaca API Service.
 * Location: backend/src/index.ts
 * 
 * Responsibilities:
 * - Initialize the Express server
 * - Set up middleware
 * - Configure API routes
 * - Start the server
 * - Initialize the artificial order monitoring system
 * - Set up WebSocket server with global reference
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { ConfigManager, ArtificialOrderManager } from './core/index.js';
import { setupApiRoutes } from './api/routes.js';
import { createAlpacaClient } from './services/alpaca-client.js';
import { setupWebSocketServer } from './services/websocket-server.js';
import path from 'path';
import { Server } from 'http';
import WebSocket from 'ws';

// Declare global WebSocket server
declare global {
  var wss: any | undefined;
}

// Use the current working directory for config path
const currentDir = process.cwd();

// Initialize configuration manager
const configPath = path.join(currentDir, 'config', 'config.json');
console.log(`Config path: ${configPath}`);

const configManager = new ConfigManager(configPath);

// Initialize Express app
const app = express();

// Apply middleware
app.use(helmet({
  crossOriginEmbedderPolicy: false, // Allow WebSocket connections
}));
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:5173'], // Common dev ports
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Add request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Load configuration
async function initializeServer() {
  try {
    console.log('Starting server initialization...');
    
    // Check if config file exists
    try {
      const fs = await import('fs/promises');
      await fs.access(configPath);
      console.log('Config file exists and is accessible');
    } catch (error) {
      console.error('Config file not found, creating default config...');
      await configManager.createDefaultConfig();
    }
    
    // Load configuration
    const config = await configManager.loadConfig();
    console.log('Configuration loaded successfully');
    console.log('API Port:', config.startup.apiPort);
    console.log('Paper Trading:', config.runtime.alpaca.isPaper);
    
    // Initialize Alpaca client
    console.log('Initializing Alpaca client...');
    const alpacaClient = await createAlpacaClient(config.runtime.alpaca);
    console.log('Alpaca client initialized');
    
    // Initialize artificial order manager
    const orderManager = new ArtificialOrderManager(
      config.runtime.monitoring.priceCheckIntervalMs
    );
    console.log('Artificial order manager initialized');
    
    // Set up API routes
    setupApiRoutes(app, configManager, alpacaClient, orderManager);
    console.log('API routes configured');
    
    // Add a root route
    app.get('/', (req, res) => {
      res.json({
        service: 'Alpaca API Service',
        status: 'running',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        endpoints: {
          health: '/api/health',
          config: '/api/config',
          account: '/api/account',
          orders: '/api/orders',
          positions: '/api/positions',
          market: '/api/market',
          alpaca: '/api/alpaca',
          'artificial-orders': '/api/artificial-orders'
        }
      });
    });
    
    // Start the API server
    const apiPort = config.startup.apiPort;
    const apiServer = app.listen(apiPort, '0.0.0.0', () => {
      console.log(`🚀 API server listening on http://localhost:${apiPort}`);
      console.log(`📊 WebSocket server will be available on ws://localhost:${apiPort}`);
    });
    
    // Set up WebSocket server for real-time updates
    const wsServer = setupWebSocketServer(apiServer, alpacaClient, orderManager);
    console.log('✅ WebSocket server initialized');
    
    // WebSocketServer constructor already sets global.wss
    
    // Log successful startup
    console.log('\n🎉 Server initialization completed successfully!');
    console.log(`📡 API Base URL: http://localhost:${apiPort}`);
    console.log(`🔄 WebSocket URL: ws://localhost:${apiPort}`);
    console.log('\n📋 Available endpoints:');
    console.log(`   GET  /                          - Service info`);
    console.log(`   GET  /api/health                - Health check`);
    console.log(`   GET  /api/alpaca/market-data/:symbol - Market data`);
    console.log(`   GET  /api/alpaca/price-history/:symbol - Price history`);
    console.log(`   POST /api/alpaca/connect        - Connect to Alpaca`);
    console.log(`   WS   ws://localhost:${apiPort}     - WebSocket endpoint`);
    
    // Handle graceful shutdown
    process.on('SIGINT', () => gracefulShutdown(apiServer, wsServer, orderManager));
    process.on('SIGTERM', () => gracefulShutdown(apiServer, wsServer, orderManager));
    
    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      console.error('❌ Uncaught Exception:', error);
      gracefulShutdown(apiServer, wsServer, orderManager);
    });
    
    process.on('unhandledRejection', (reason, promise) => {
      console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
      gracefulShutdown(apiServer, wsServer, orderManager);
    });
    
  } catch (error) {
    console.error('❌ Failed to initialize server:', error);
    
    // More detailed error logging
    if (error instanceof Error) {
      console.error('Error name:', error.name);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    
    process.exit(1);
  }
}

// Graceful shutdown function
function gracefulShutdown(
  apiServer: Server,
  wsServer: any,
  orderManager: ArtificialOrderManager
) {
  console.log('\n🛑 Shutting down gracefully...');
  
  // Stop the artificial order monitoring
  orderManager.stopMonitoring();
  console.log('✅ Artificial order monitoring stopped');
  
  // Close the WebSocket server
  if (wsServer && typeof wsServer.close === 'function') {
    wsServer.close();
    console.log('✅ WebSocket server closed');
  }
  
  // Close the API server
  apiServer.close(() => {
    console.log('✅ API server closed');
    console.log('👋 Goodbye!');
    process.exit(0);
  });
  
  // Force exit after 10 seconds if graceful shutdown fails
  setTimeout(() => {
    console.error('⚠️  Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
}

// Start the server
console.log('🚀 Starting Alpaca API Service...');
console.log(`📅 ${new Date().toISOString()}`);
console.log(`📂 Working directory: ${process.cwd()}`);
console.log(`🔧 Node version: ${process.version}`);

// Add a simple health check endpoint that doesn't require initialization
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

// Start listening on a basic port for health checks
const healthCheckPort = 3456;
const healthServer = app.listen(healthCheckPort, () => {
  console.log(`Health check server running at http://localhost:${healthCheckPort}/health`);
});

// Initialize the main server
initializeServer()
  .then(() => {
    console.log('Server initialization completed successfully!');
  })
  .catch(error => {
    console.error('💥 Fatal initialization error:', error);
    // Print more detailed error information
    if (error instanceof Error) {
      console.error('Error name:', error.name);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    } else {
      console.error('Unknown error type:', typeof error);
      console.error('Error value:', error);
    }
    process.exit(1);
  });