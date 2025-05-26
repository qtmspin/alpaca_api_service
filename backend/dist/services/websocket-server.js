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
 * - Stream live market data updates
 */
import WebSocket, { WebSocketServer as WSServer } from 'ws';
/**
 * WebSocketServer class
 *
 * Manages WebSocket connections and broadcasts real-time updates.
 */
export class WebSocketServer {
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
        this.liveStreamIntervals = new Map();
        // Create WebSocket server
        this.wss = new WSServer({ server });
        // Set up event handlers
        this.setupEventHandlers();
        // Set up heartbeat
        this.setupHeartbeat();
        // Expose globally for access from other parts of the application
        global.wss = this.wss;
    }
    /**
     * Set up WebSocket event handlers
     */
    setupEventHandlers() {
        this.wss.on('connection', (ws) => {
            console.log('Client connected to WebSocket');
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
                console.log('Client disconnected from WebSocket');
                this.handleClientDisconnect(ws);
            });
        });
    }
    /**
     * Handle client disconnect
     */
    handleClientDisconnect(ws) {
        // Get client's subscriptions
        const clientSubscriptions = this.subscriptions.get(ws);
        if (clientSubscriptions) {
            // Stop any live streams for symbols this client was subscribed to
            clientSubscriptions.forEach(subscription => {
                if (subscription.startsWith('market_data:')) {
                    const symbol = subscription.split(':')[1];
                    this.stopLiveStreamIfNoSubscribers(symbol);
                }
            });
        }
        // Remove client from subscriptions
        this.subscriptions.delete(ws);
    }
    /**
     * Stop live stream for a symbol if no clients are subscribed
     */
    stopLiveStreamIfNoSubscribers(symbol) {
        // Check if any client is still subscribed to this symbol
        let hasSubscribers = false;
        this.subscriptions.forEach(clientSubs => {
            if (clientSubs.has(`market_data:${symbol}`)) {
                hasSubscribers = true;
            }
        });
        // If no subscribers, stop the live stream
        if (!hasSubscribers) {
            const intervalId = this.liveStreamIntervals.get(symbol);
            if (intervalId) {
                clearInterval(intervalId);
                this.liveStreamIntervals.delete(symbol);
                console.log(`Stopped live stream for ${symbol} - no subscribers`);
            }
        }
    }
    /**
     * Set up heartbeat to keep connections alive
     */
    setupHeartbeat() {
        const interval = setInterval(() => {
            this.wss.clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
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
            // Clear all live stream intervals
            this.liveStreamIntervals.forEach(intervalId => {
                clearInterval(intervalId);
            });
            this.liveStreamIntervals.clear();
        });
    }
    /**
     * Handle messages from clients
     * @param ws - WebSocket connection
     * @param message - Parsed message from client
     */
    handleClientMessage(ws, message) {
        const { type, action, data } = message;
        // Handle both old and new message formats
        const messageType = type || action;
        switch (messageType) {
            case 'subscribe':
                this.handleSubscribe(ws, message);
                break;
            case 'unsubscribe':
                this.handleUnsubscribe(ws, message);
                break;
            default:
                this.sendMessage(ws, {
                    type: 'error',
                    data: {
                        code: 'UNKNOWN_MESSAGE_TYPE',
                        message: `Unknown message type: ${messageType}`,
                        timestamp: new Date().toISOString()
                    }
                });
        }
    }
    /**
     * Handle subscription requests
     * @param ws - WebSocket connection
     * @param message - Subscription message
     */
    async handleSubscribe(ws, message) {
        const { symbols = [], dataTypes = [], channels = [], data } = message;
        const clientSubscriptions = this.subscriptions.get(ws);
        if (!clientSubscriptions)
            return;
        // Handle both old and new formats
        const symbolsToSubscribe = symbols.length > 0 ? symbols : (data?.symbols || []);
        const channelsToSubscribe = channels.length > 0 ? channels : (data?.channels || dataTypes);
        // Add new subscriptions
        for (const symbol of symbolsToSubscribe) {
            for (const channel of channelsToSubscribe) {
                const subscription = `${channel}:${symbol}`;
                clientSubscriptions.add(subscription);
                // If it's a market data subscription, start live streaming
                if (channel === 'market_data') {
                    await this.startLiveStreamForSymbol(symbol);
                    // Send initial data immediately
                    await this.sendInitialMarketData(ws, symbol);
                }
            }
        }
        // Confirm subscription
        this.sendMessage(ws, {
            type: 'subscription_success',
            data: {
                symbols: symbolsToSubscribe,
                channels: channelsToSubscribe,
                timestamp: new Date().toISOString()
            }
        });
    }
    /**
     * Handle unsubscribe requests
     * @param ws - WebSocket connection
     * @param message - Unsubscribe message
     */
    handleUnsubscribe(ws, message) {
        const { symbols = [], dataTypes = [], channels = [], data } = message;
        const clientSubscriptions = this.subscriptions.get(ws);
        if (!clientSubscriptions)
            return;
        // Handle both old and new formats
        const symbolsToUnsubscribe = symbols.length > 0 ? symbols : (data?.symbols || []);
        const channelsToUnsubscribe = channels.length > 0 ? channels : (data?.channels || dataTypes);
        // Remove subscriptions
        for (const symbol of symbolsToUnsubscribe) {
            for (const channel of channelsToUnsubscribe) {
                const subscription = `${channel}:${symbol}`;
                clientSubscriptions.delete(subscription);
                // If it's a market data subscription, potentially stop live streaming
                if (channel === 'market_data') {
                    this.stopLiveStreamIfNoSubscribers(symbol);
                }
            }
        }
        // Confirm unsubscription
        this.sendMessage(ws, {
            type: 'unsubscription_success',
            data: {
                symbols: symbolsToUnsubscribe,
                channels: channelsToUnsubscribe,
                timestamp: new Date().toISOString()
            }
        });
    }
    /**
     * Start live streaming for a symbol
     */
    async startLiveStreamForSymbol(symbol) {
        // Don't start if already streaming
        if (this.liveStreamIntervals.has(symbol)) {
            return;
        }
        console.log(`Starting live stream for ${symbol}`);
        // Set up periodic updates every 5 seconds
        const intervalId = setInterval(async () => {
            try {
                await this.fetchAndBroadcastMarketData(symbol);
            }
            catch (error) {
                console.error(`Error in live stream for ${symbol}:`, error);
            }
        }, 5000);
        this.liveStreamIntervals.set(symbol, intervalId);
    }
    /**
     * Fetch and broadcast market data for a symbol
     */
    async fetchAndBroadcastMarketData(symbol) {
        try {
            const isCrypto = symbol.includes('/');
            let marketData;
            if (isCrypto) {
                // Handle crypto symbols
                const snapshots = await this.alpacaClient.getCryptoSnapshots([symbol]);
                marketData = {
                    symbol,
                    bar: snapshots.snapshots?.[symbol]?.latestBar || null,
                    quote: snapshots.snapshots?.[symbol]?.latestQuote || null,
                    asset: null,
                    isCrypto: true,
                    timestamp: new Date().toISOString()
                };
            }
            else {
                // Handle stock symbols
                const [barData, quoteData] = await Promise.all([
                    this.alpacaClient.getStocksBarsLatest([symbol]).catch(() => ({ bars: {} })),
                    this.alpacaClient.getStocksQuotesLatest([symbol]).catch(() => ({ quotes: {} }))
                ]);
                marketData = {
                    symbol,
                    bar: barData.bars?.[symbol] || null,
                    quote: quoteData.quotes?.[symbol] || null,
                    asset: null,
                    isCrypto: false,
                    timestamp: new Date().toISOString()
                };
            }
            // Broadcast to all subscribed clients
            this.broadcastMarketData(symbol, marketData);
        }
        catch (error) {
            console.error(`Error fetching market data for ${symbol}:`, error);
        }
    }
    /**
     * Send initial market data to a client
     */
    async sendInitialMarketData(ws, symbol) {
        try {
            const isCrypto = symbol.includes('/');
            let marketData;
            if (isCrypto) {
                const snapshots = await this.alpacaClient.getCryptoSnapshots([symbol]);
                marketData = {
                    symbol,
                    bar: snapshots.snapshots?.[symbol]?.latestBar || null,
                    quote: snapshots.snapshots?.[symbol]?.latestQuote || null,
                    asset: null,
                    isCrypto: true,
                    timestamp: new Date().toISOString()
                };
            }
            else {
                const [barData, quoteData, assetData] = await Promise.all([
                    this.alpacaClient.getStocksBarsLatest([symbol]).catch(() => ({ bars: {} })),
                    this.alpacaClient.getStocksQuotesLatest([symbol]).catch(() => ({ quotes: {} })),
                    this.alpacaClient.getAsset(symbol).catch(() => null)
                ]);
                marketData = {
                    symbol,
                    bar: barData.bars?.[symbol] || null,
                    quote: quoteData.quotes?.[symbol] || null,
                    asset: assetData || null,
                    isCrypto: false,
                    timestamp: new Date().toISOString()
                };
            }
            // Send initial market data
            this.sendMessage(ws, {
                type: 'market_data',
                payload: marketData
            });
        }
        catch (error) {
            console.error(`Error sending initial market data for ${symbol}:`, error);
        }
    }
    /**
     * Send a message to a WebSocket client
     * @param ws - WebSocket connection
     * @param message - Message to send
     */
    sendMessage(ws, message) {
        if (ws.readyState === WebSocket.OPEN) {
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
            if (client.readyState === WebSocket.OPEN) {
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
     * Broadcast market data update to all subscribed clients
     * @param symbol - Stock symbol
     * @param marketData - Market data to broadcast
     */
    broadcastMarketData(symbol, marketData) {
        const subscription = `market_data:${symbol}`;
        this.wss.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                const clientSubscriptions = this.subscriptions.get(client);
                if (clientSubscriptions && clientSubscriptions.has(subscription)) {
                    this.sendMessage(client, {
                        type: 'market_data_update',
                        payload: {
                            ...marketData,
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
     * Get connection statistics
     */
    getStats() {
        const connectionCount = this.wss.clients.size;
        const subscriptionCount = Array.from(this.subscriptions.values())
            .reduce((total, subs) => total + subs.size, 0);
        const liveStreamCount = this.liveStreamIntervals.size;
        return {
            connections: connectionCount,
            subscriptions: subscriptionCount,
            liveStreams: liveStreamCount,
            symbols: Array.from(this.liveStreamIntervals.keys())
        };
    }
    /**
     * Close the WebSocket server
     */
    close() {
        // Clear all live stream intervals
        this.liveStreamIntervals.forEach(intervalId => {
            clearInterval(intervalId);
        });
        this.liveStreamIntervals.clear();
        this.wss.close();
    }
}
/**
 * Set up the WebSocket server
 * @param server - HTTP server to attach WebSocket server to
 * @param alpacaClient - Alpaca client instance
 * @param orderManager - Artificial order manager instance
 * @returns WebSocketServer instance
 */
export function setupWebSocketServer(server, alpacaClient, orderManager) {
    return new WebSocketServer(server, alpacaClient, orderManager);
}
