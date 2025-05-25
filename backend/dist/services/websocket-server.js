"use strict";
/**
 * websocket-server.ts
 *
 * This file contains the implementation for the WebSocket server.
 * Location: backend/src/services/websocket-server.ts
 *
 * Responsibilities:
 * - Set up and manage WebSocket connections
 * - Broadcast real-time updates to connected clients
 * - Handle WebSocket subscriptions and messages
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebSocketServer = void 0;
exports.setupWebSocketServer = setupWebSocketServer;
const ws_1 = __importDefault(require("ws"));
/**
 * WebSocketServer class
 *
 * Manages WebSocket connections and broadcasts real-time updates.
 */
class WebSocketServer {
    /**
     * Constructor for WebSocketServer
     * @param server - HTTP server to attach WebSocket server to
     * @param alpacaClient - Alpaca client instance
     * @param orderManager - Artificial order manager instance
     */
    constructor(server, alpacaClient, orderManager) {
        this.alpacaClient = alpacaClient;
        this.orderManager = orderManager;
        this.subscriptions = new Map();
        // Create WebSocket server
        this.wss = new ws_1.default.Server({ server });
        // Set up event handlers
        this.setupEventHandlers();
        // Set up heartbeat
        this.setupHeartbeat();
    }
    /**
     * Set up WebSocket event handlers
     */
    setupEventHandlers() {
        this.wss.on('connection', (ws) => {
            console.log('Client connected');
            // Initialize client's subscriptions
            this.subscriptions.set(ws, new Set());
            // Send welcome message
            this.sendMessage(ws, {
                type: 'connection_established',
                data: {
                    timestamp: new Date().toISOString()
                }
            });
            // Handle messages from client
            ws.on('message', (message) => {
                try {
                    const parsedMessage = JSON.parse(message);
                    this.handleClientMessage(ws, parsedMessage);
                }
                catch (error) {
                    console.error('Error parsing WebSocket message:', error);
                    this.sendMessage(ws, {
                        type: 'error',
                        data: {
                            code: 'INVALID_MESSAGE',
                            message: 'Invalid message format',
                            timestamp: new Date().toISOString()
                        }
                    });
                }
            });
            // Handle client disconnect
            ws.on('close', () => {
                console.log('Client disconnected');
                this.subscriptions.delete(ws);
            });
        });
    }
    /**
     * Set up heartbeat to keep connections alive
     */
    setupHeartbeat() {
        const interval = setInterval(() => {
            this.wss.clients.forEach(client => {
                if (client.readyState === ws_1.default.OPEN) {
                    this.sendMessage(client, {
                        type: 'heartbeat',
                        data: {
                            timestamp: new Date().toISOString()
                        }
                    });
                }
            });
        }, 30000); // 30 seconds
        // Clear interval when server closes
        this.wss.on('close', () => {
            clearInterval(interval);
        });
    }
    /**
     * Handle messages from clients
     * @param ws - WebSocket connection
     * @param message - Parsed message from client
     */
    handleClientMessage(ws, message) {
        const { type, data } = message;
        switch (type) {
            case 'subscribe':
                this.handleSubscribe(ws, data);
                break;
            case 'unsubscribe':
                this.handleUnsubscribe(ws, data);
                break;
            default:
                this.sendMessage(ws, {
                    type: 'error',
                    data: {
                        code: 'UNKNOWN_MESSAGE_TYPE',
                        message: `Unknown message type: ${type}`,
                        timestamp: new Date().toISOString()
                    }
                });
        }
    }
    /**
     * Handle subscription requests
     * @param ws - WebSocket connection
     * @param data - Subscription data
     */
    handleSubscribe(ws, data) {
        const { symbols = [], dataTypes = [] } = data;
        const clientSubscriptions = this.subscriptions.get(ws);
        if (!clientSubscriptions)
            return;
        // Add new subscriptions
        for (const symbol of symbols) {
            for (const dataType of dataTypes) {
                const subscription = `${dataType}:${symbol}`;
                clientSubscriptions.add(subscription);
            }
        }
        // Confirm subscription
        this.sendMessage(ws, {
            type: 'subscription_success',
            data: {
                symbols,
                dataTypes,
                timestamp: new Date().toISOString()
            }
        });
    }
    /**
     * Handle unsubscribe requests
     * @param ws - WebSocket connection
     * @param data - Unsubscribe data
     */
    handleUnsubscribe(ws, data) {
        const { symbols = [], dataTypes = [] } = data;
        const clientSubscriptions = this.subscriptions.get(ws);
        if (!clientSubscriptions)
            return;
        // Remove subscriptions
        for (const symbol of symbols) {
            for (const dataType of dataTypes) {
                const subscription = `${dataType}:${symbol}`;
                clientSubscriptions.delete(subscription);
            }
        }
        // Confirm unsubscription
        this.sendMessage(ws, {
            type: 'unsubscription_success',
            data: {
                symbols,
                dataTypes,
                timestamp: new Date().toISOString()
            }
        });
    }
    /**
     * Send a message to a WebSocket client
     * @param ws - WebSocket connection
     * @param message - Message to send
     */
    sendMessage(ws, message) {
        if (ws.readyState === ws_1.default.OPEN) {
            ws.send(JSON.stringify(message));
        }
    }
    /**
     * Broadcast a message to all subscribed clients
     * @param type - Data type (e.g., 'quotes', 'trades')
     * @param symbol - Stock symbol
     * @param data - Data to broadcast
     */
    broadcast(type, symbol, data) {
        const subscription = `${type}:${symbol}`;
        this.wss.clients.forEach(client => {
            if (client.readyState === ws_1.default.OPEN) {
                const clientSubscriptions = this.subscriptions.get(client);
                if (clientSubscriptions && clientSubscriptions.has(subscription)) {
                    this.sendMessage(client, {
                        type,
                        data: {
                            ...data,
                            symbol,
                            timestamp: new Date().toISOString()
                        }
                    });
                }
            }
        });
    }
    /**
     * Broadcast an order update to all clients
     * @param order - Order data
     */
    broadcastOrderUpdate(order) {
        this.broadcast('order_update', order.symbol, order);
    }
    /**
     * Broadcast a position update to all clients
     * @param position - Position data
     */
    broadcastPositionUpdate(position) {
        this.broadcast('position_update', position.symbol, position);
    }
    /**
     * Close the WebSocket server
     */
    close() {
        this.wss.close();
    }
}
exports.WebSocketServer = WebSocketServer;
/**
 * Set up the WebSocket server
 * @param server - HTTP server to attach WebSocket server to
 * @param alpacaClient - Alpaca client instance
 * @param orderManager - Artificial order manager instance
 * @returns WebSocketServer instance
 */
function setupWebSocketServer(server, alpacaClient, orderManager) {
    return new WebSocketServer(server, alpacaClient, orderManager);
}
