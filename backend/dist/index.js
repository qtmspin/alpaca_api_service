"use strict";
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const core_1 = require("./core");
const routes_1 = require("./api/routes");
const alpaca_client_1 = require("./services/alpaca-client");
const websocket_server_1 = require("./services/websocket-server");
// Initialize configuration manager
const configPath = path_1.default.resolve(process.cwd(), 'config/config.json');
console.log(`Initializing configuration manager with path: ${configPath}`);
const configManager = new core_1.ConfigManager(configPath);
// Initialize Express app
const app = (0, express_1.default)();
// Apply middleware
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// Load configuration
async function initializeServer() {
    let config;
    try {
        console.log('Starting server initialization...');
        // Verify config file exists and is readable
        try {
            await promises_1.default.access(configPath);
            console.log('Config file exists and is accessible');
            const configContent = await promises_1.default.readFile(configPath, 'utf-8');
            console.log('Config file content:', configContent);
            // Load and validate configuration
            config = await configManager.loadConfig();
            console.log('Configuration loaded successfully');
        }
        catch (error) {
            console.error('Error accessing or reading config file:', error);
            throw new Error(`Failed to load configuration: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
        // Initialize Alpaca client
        const alpacaClient = (0, alpaca_client_1.createAlpacaClient)(config.runtime.alpaca);
        console.log('Alpaca client initialized');
        // Initialize artificial order manager
        const orderManager = new core_1.ArtificialOrderManager(config.runtime.monitoring.priceCheckIntervalMs);
        console.log('Artificial order manager initialized');
        // Set up API routes
        (0, routes_1.setupApiRoutes)(app, configManager, alpacaClient, orderManager);
        console.log('API routes configured');
        // Start the API server
        const apiPort = config.startup.apiPort;
        const apiServer = app.listen(apiPort, () => {
            console.log(`API server listening on port ${apiPort}`);
        });
        // Set up WebSocket server for real-time updates
        const wsServer = (0, websocket_server_1.setupWebSocketServer)(apiServer, alpacaClient, orderManager);
        console.log('WebSocket server initialized');
        // Handle graceful shutdown
        process.on('SIGINT', () => gracefulShutdown(apiServer, wsServer, orderManager));
        process.on('SIGTERM', () => gracefulShutdown(apiServer, wsServer, orderManager));
    }
    catch (error) {
        console.error('Failed to initialize server:', error);
        process.exit(1);
    }
}
// Graceful shutdown function
function gracefulShutdown(apiServer, wsServer, orderManager) {
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
