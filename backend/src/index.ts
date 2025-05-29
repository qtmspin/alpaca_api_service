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

/**
 * index.ts - Updated to use refactored WebSocket system
 * 
 * Main entry point with simplified WebSocket initialization
 */

import express from 'express'
import cors from 'cors'
import { createServer } from 'http'
import { ConfigManager } from './core/index.js'
import { setupApiRoutes } from './api/routes.js'
import { AlpacaWebSocketManager } from './services/websocket/alpaca-websocket-manager.js'  // Updated to use new WebSocket manager
import { ArtificialOrderManager } from './core/artificial-orders.js'  // Updated import
import { AlpacaClient } from './services/alpaca-client.js';

// Service references for graceful shutdown
interface AppServices {
  wsManager?: AlpacaWebSocketManager;
  orderManager?: ArtificialOrderManager;
}

const app = express()
let server: any = null
const services: AppServices = {}

// Enable CORS for all routes
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
    
    // Initialize Alpaca client
    console.log('🦙 Initializing Alpaca client...')
    let alpacaClient: AlpacaClient | null = null
    
    // Only initialize if we have credentials
    if (config.runtime.alpaca.apiKey && config.runtime.alpaca.secretKey) {
      try {
        alpacaClient = new AlpacaClient(config.runtime.alpaca)
        await alpacaClient.initClient()
        console.log('✅ Alpaca client connected successfully')
      } catch (error) {
        console.log('⚠️  Alpaca client connection failed:', error instanceof Error ? error.message : 'Unknown error')
        // Create a client but don't initialize it yet
        alpacaClient = new AlpacaClient({
          apiKey: '',
          secretKey: '',
          isPaper: true
        })
      }
    } else {
      console.log('⚠️  No Alpaca credentials found')
      alpacaClient = new AlpacaClient({
        apiKey: '',
        secretKey: '',
        isPaper: true
      })
    }
    
    // Initialize artificial order manager (refactored version)
    console.log('🎯 Initializing artificial order manager...')
    const orderManager = new ArtificialOrderManager()
    console.log('✅ Artificial order manager initialized')
    
    // Set up API routes
    console.log('🌐 Setting up API routes...')
    setupApiRoutes(app, configManager, alpacaClient, orderManager)
    console.log('✅ API routes configured')
    
    // Create HTTP server
    server = createServer(app)
    
    // Set up WebSocket manager
    console.log('🔌 Setting up WebSocket manager...')
    // Store reference for graceful shutdown
    services.wsManager = new AlpacaWebSocketManager()
    
    // Initialize WebSocket connections if we have valid credentials
    if (alpacaClient.isClientInitialized()) {
      const alpacaConfig = alpacaClient.getConfig()
      try {
        await services.wsManager.initialize(alpacaConfig.apiKey, alpacaConfig.secretKey, alpacaConfig.isPaper)
        console.log('✅ WebSocket connections to Alpaca established')
        
        // Register the WebSocket manager with the order manager for price monitoring
        orderManager.registerPriceMonitor((symbols: string[], callback: Function) => {
          return services.wsManager!.monitorPriceForOrders(symbols, callback as any)
        })
        
        // Register the unsubscribe function
        orderManager.registerUnsubscribeFunction((monitorId: string) => {
          services.wsManager!.stopMonitoringSymbol(monitorId)
        })
        
        // Store reference to order manager for graceful shutdown
        services.orderManager = orderManager
      } catch (error) {
        console.error('⚠️  Failed to initialize WebSocket connections:', error)
      }
    } else {
      console.log('⚠️  WebSocket connections will be initialized when credentials are provided')
    }
    
    console.log('✅ WebSocket server configured')
    
    // Start the artificial order manager
    console.log('🔄 Starting artificial order monitoring...')
    orderManager.startMonitoring()
    console.log('✅ Artificial order monitoring started')
    
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
  
  // Shutdown WebSocket manager if it exists
  if (services.wsManager) {
    try {
      console.log('🔌 Shutting down WebSocket connections...')
      await services.wsManager.shutdown()
      console.log('✅ WebSocket connections closed')
    } catch (error) {
      console.error('⚠️ Failed to shutdown WebSocket connections:', error)
    }
  }
  
  // Stop artificial order monitoring
  if (services.orderManager) {
    console.log('🔌 Stopping artificial order monitoring...')
    services.orderManager.stopMonitoring()
    console.log('✅ Artificial order monitoring stopped')
  }
  
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