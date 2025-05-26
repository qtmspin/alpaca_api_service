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
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { ConfigManager, ArtificialOrderManager } from './core/index';
import { setupApiRoutes } from './api/routes';
import { createAlpacaClient } from './services/alpaca-client';
import { setupWebSocketServer } from './services/websocket-server';
import path from 'path';

// Use the current working directory for config path
const currentDir = process.cwd();

// Initialize configuration manager
const configPath = path.join(currentDir, 'temp_config.json');
const configManager = new ConfigManager(configPath);

// Initialize Express app
const app = express();

// Apply middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Load configuration
async function initializeServer() {
  try {
    // Load configuration
    const config = await configManager.loadConfig();
    console.log('Configuration loaded successfully');
    
    // Initialize Alpaca client (now async)
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
    
    // Start the API server
    const apiPort = config.startup.apiPort;
    const apiServer = app.listen(apiPort, () => {
      console.log(`API server listening on port ${apiPort}`);
    });
    
    // Set up WebSocket server for real-time updates
    const wsServer = setupWebSocketServer(apiServer, alpacaClient, orderManager);
    console.log('WebSocket server initialized');
    
    // Handle graceful shutdown
    process.on('SIGINT', () => gracefulShutdown(apiServer, wsServer, orderManager));
    process.on('SIGTERM', () => gracefulShutdown(apiServer, wsServer, orderManager));
    
  } catch (error) {
    console.error('Failed to initialize server:', error);
    
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
  apiServer: any,
  wsServer: any,
  orderManager: ArtificialOrderManager
) {
  console.log('Shutting down gracefully...');
  
  // Stop the artificial order monitoring
  orderManager.stopMonitoring();
  console.log('Artificial order monitoring stopped');
  
  // Close the WebSocket server
  wsServer.close(() => {
    console.log('WebSocket server closed');
    
    // Close the API server
    apiServer.close(() => {
      console.log('API server closed');
      process.exit(0);
    });
  });
  
  // Force exit after 5 seconds if graceful shutdown fails
  setTimeout(() => {
    console.error('Forced shutdown after timeout');
    process.exit(1);
  }, 5000);
}

// Start the server
initializeServer().catch(error => {
  console.error('Initialization error:', error);
  process.exit(1);
});