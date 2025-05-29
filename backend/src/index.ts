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

/**
 * Fixed backend initialization with proper error handling and CORS
 * Location: backend/src/index.ts
 */

import express from 'express'
import cors from 'cors'
import { createServer } from 'http'
import { ConfigManager } from './core/index.js'
import { setupApiRoutes } from './api/routes.js'
import { setupWebSocketServer } from './services/websocket-server.js'
import { ArtificialOrderManager } from './core/artificial-orders.js'
import { AlpacaClient } from './services/alpaca-client.js';

const app = express()
let server: any = null

// Enable CORS for all routes - this fixes WebSocket connection issues
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:5173', 'http://127.0.0.1:3000', 'http://127.0.0.1:5173'],
  credentials: true
}))

// Parse JSON bodies
app.use(express.json())

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`)
  next()
})

async function initializeServices() {
  try {
    console.log('🚀 Starting Alpaca API Service...')
    
    // Initialize configuration manager
    const configManager = new ConfigManager('./config/config.json')
    
    // Try to load existing config, create default if it doesn't exist
    let config
    try {
      config = await configManager.loadConfig()
      console.log('✅ Configuration loaded successfully')
    } catch (error) {
      console.log('⚠️  No configuration found, creating default...')
      config = await configManager.createDefaultConfig()
      console.log('✅ Default configuration created')
    }
    
    // Initialize Alpaca client (but don't connect until credentials are provided)
    console.log('🦙 Initializing Alpaca client...')
    let alpacaClient: AlpacaClient | null = null
    
    // Only initialize if we have credentials
    if (config.runtime.alpaca.apiKey && config.runtime.alpaca.secretKey) {
      try {
        alpacaClient = new AlpacaClient(config.runtime.alpaca)
        await alpacaClient.initClient()
        console.log('✅ Alpaca client connected successfully')
      } catch (error) {
        console.log('⚠️  Alpaca client connection failed (will need to connect via UI):', error instanceof Error ? error.message : 'Unknown error')
        // Create a client but don't initialize it yet
        alpacaClient = new AlpacaClient({
          apiKey: '',
          secretKey: '',
          isPaper: true
        })
      }
    } else {
      console.log('⚠️  No Alpaca credentials found (will need to connect via UI)')
      // Create a client but don't initialize it yet
      alpacaClient = new AlpacaClient({
        apiKey: '',
        secretKey: '',
        isPaper: true
      })
    }
    
    // Initialize artificial order manager
    console.log('🎯 Initializing artificial order manager...')
    const orderManager = new ArtificialOrderManager()
    console.log('✅ Artificial order manager initialized')
    
    // Set up API routes
    console.log('🌐 Setting up API routes...')
    setupApiRoutes(app, configManager, alpacaClient, orderManager)
    console.log('✅ API routes configured')
    
    // Create HTTP server
    server = createServer(app)
    
    // Set up WebSocket server
    console.log('🔌 Setting up WebSocket server...')
    const wsServer = setupWebSocketServer(server, alpacaClient, orderManager)
    console.log('✅ WebSocket server configured')
    
    // Start the artificial order manager with the WebSocket client
    console.log('🔄 Starting artificial order monitoring...')
    // Get the market data manager from the WebSocket controller
    if (global.wss && wsServer) {
      // Get the market data subscription manager from the Alpaca WebSocket controller
      const alpacaController = (wsServer as any).alpacaWebSocketController;
      if (alpacaController && alpacaController.marketDataManager) {
        // Start monitoring with the market data manager
        orderManager.startMonitoring(null, alpacaController.marketDataManager);
        console.log('✅ Artificial order monitoring started with WebSocket')
      } else {
        console.warn('⚠️ WebSocket controller not properly initialized, falling back to interval-based monitoring')
        orderManager.startMonitoring();
      }
    } else {
      console.warn('⚠️ WebSocket server not initialized, artificial orders will use interval-based monitoring')
      // Start monitoring without WebSocket
      orderManager.startMonitoring();
    }
    
    // Start server
    const port = config.startup.apiPort || 9000
    server.listen(port, () => {
      console.log('🎉 Alpaca API Service started successfully!')
      console.log(`📡 HTTP Server: http://localhost:${port}`)
      console.log(`🔌 WebSocket Server: ws://localhost:${port}`)
      console.log('')
      console.log('📋 Available endpoints:')
      console.log('  - GET  /api/health           Health check')
      console.log('  - POST /api/alpaca/connect   Connect to Alpaca API')
      console.log('  - GET  /api/alpaca/account   Get account info')
      console.log('  - GET  /api/alpaca/positions Get positions')
      console.log('  - GET  /api/alpaca/orders    Get orders')
      console.log('  - POST /api/orders           Create order')
      console.log('  - GET  /api/config           Get configuration')
      console.log('  - PUT  /api/config           Update configuration')
      console.log('')
      if (!config.runtime.alpaca.apiKey) {
        console.log('⚠️  Please connect to Alpaca API via the UI to start trading')
      }
    })
    
  } catch (error) {
    console.error('❌ Failed to initialize services:', error)
    process.exit(1)
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down gracefully...')
  
  if (server) {
    server.close(() => {
      console.log('✅ HTTP server closed')
      process.exit(0)
    })
  } else {
    process.exit(0)
  }
})

// Handle unhandled rejections
process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled rejection:', error)
  process.exit(1)
})

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught exception:', error)
  process.exit(1)
})

// Start the application
initializeServices().catch((error) => {
  console.error('❌ Failed to start application:', error)
  process.exit(1)
})