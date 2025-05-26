/**
 * alpaca-client.ts
 *
 * Service for interacting with the Alpaca Trading API
 * Fixed to handle crypto and stock data correctly with proper API endpoints
 */
import axios from 'axios';
// Dynamic import to handle ES module
let alpacaSDK = null;
async function loadAlpacaSDK() {
    if (!alpacaSDK) {
        try {
            // Try ESM import first
            alpacaSDK = await import('@alpacahq/typescript-sdk');
        }
        catch (error) {
            console.error('Failed to load Alpaca SDK via ESM import:', error);
            throw error;
        }
    }
    return alpacaSDK;
}
export class AlpacaClient {
    constructor(config) {
        this.client = null;
        this.config = config;
    }
    async initClient() {
        try {
            const sdk = await loadAlpacaSDK();
            this.client = sdk.createClient({
                key: this.config.apiKey,
                secret: this.config.secretKey,
                paper: this.config.isPaper,
                tokenBucket: {
                    capacity: 200,
                    fillRate: 60, // requests per second
                }
            });
            console.log('Alpaca client initialized successfully');
        }
        catch (error) {
            console.error('Failed to initialize Alpaca client:', error);
            throw new Error(`Failed to initialize Alpaca client: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    ensureClient() {
        if (!this.client) {
            throw new Error('Alpaca client not initialized. Call initClient() first.');
        }
    }
    /**
     * Check if the Alpaca client is initialized
     * @returns boolean indicating whether the client is initialized
     */
    isInitialized() {
        return this.client !== null;
    }
    // Account methods
    async getAccount() {
        this.ensureClient();
        return await this.client.getAccount();
    }
    // Order methods
    async createOrder(orderData) {
        this.ensureClient();
        return await this.client.createOrder(orderData);
    }
    async getOrder(orderId) {
        this.ensureClient();
        return await this.client.getOrder({ order_id: orderId });
    }
    async getOrders(params = {}) {
        this.ensureClient();
        return await this.client.getOrders(params);
    }
    async cancelOrder(orderId) {
        this.ensureClient();
        return await this.client.cancelOrder({ order_id: orderId });
    }
    async replaceOrder(orderId, updateData) {
        this.ensureClient();
        return await this.client.replaceOrder({
            order_id: orderId,
            ...updateData
        });
    }
    // Position methods
    async getPositions() {
        this.ensureClient();
        return await this.client.getPositions();
    }
    async getPosition(symbol) {
        this.ensureClient();
        return await this.client.getPosition({ symbol_or_asset_id: symbol });
    }
    async closePosition(symbol) {
        this.ensureClient();
        return await this.client.closePosition({ symbol_or_asset_id: symbol });
    }
    // Asset methods
    async getAssets(params = {}) {
        this.ensureClient();
        return await this.client.getAssets(params);
    }
    async getAsset(symbol) {
        this.ensureClient();
        return await this.client.getAsset({ symbol_or_asset_id: symbol });
    }
    // Market data methods
    async getStocksBarsLatest(symbols) {
        this.ensureClient();
        return await this.client.getStocksBarsLatest({
            symbols: symbols.join(',')
        });
    }
    async getStocksQuotesLatest(symbols) {
        this.ensureClient();
        return await this.client.getStocksQuotesLatest({
            symbols: symbols.join(',')
        });
    }
    async getStocksTrades(symbols, params = {}) {
        this.ensureClient();
        return await this.client.getStocksTrades({
            symbols: symbols.join(','),
            ...params
        });
    }
    // Crypto data methods using direct API calls with proper endpoints
    async getCryptoSnapshots(symbols) {
        try {
            const response = await axios.get(`https://data.alpaca.markets/v1beta3/crypto/us/snapshots`, {
                params: { symbols: symbols.join(',') },
                headers: {
                    'APCA-API-KEY-ID': this.config.apiKey,
                    'APCA-API-SECRET-KEY': this.config.secretKey,
                    'Accept': 'application/json'
                }
            });
            return response.data;
        }
        catch (error) {
            console.error('Error fetching crypto snapshots:', error);
            throw error;
        }
    }
    async getCryptoBarsLatest(symbols) {
        this.ensureClient();
        try {
            // Use crypto snapshots for latest data
            return await this.getCryptoSnapshots(symbols);
        }
        catch (error) {
            console.error('Error fetching crypto bars latest:', error);
            throw error;
        }
    }
    async getCryptoBars(symbol, timeframe, start, end, limit) {
        try {
            const params = {
                symbols: symbol,
                timeframe: timeframe,
                start: start,
                limit: limit || 1000,
                sort: 'asc'
            };
            if (end)
                params.end = end;
            const response = await axios.get(`https://data.alpaca.markets/v1beta3/crypto/us/bars`, {
                params,
                headers: {
                    'APCA-API-KEY-ID': this.config.apiKey,
                    'APCA-API-SECRET-KEY': this.config.secretKey,
                    'Accept': 'application/json'
                }
            });
            return response.data;
        }
        catch (error) {
            console.error(`Error fetching crypto bars for ${symbol}:`, error);
            throw error;
        }
    }
    async getCryptoQuotes(symbol, start, end, limit) {
        try {
            const params = {
                symbols: symbol,
                start: start,
                limit: limit || 1000,
                sort: 'asc'
            };
            if (end)
                params.end = end;
            const response = await axios.get(`https://data.alpaca.markets/v1beta3/crypto/us/quotes`, {
                params,
                headers: {
                    'APCA-API-KEY-ID': this.config.apiKey,
                    'APCA-API-SECRET-KEY': this.config.secretKey,
                    'Accept': 'application/json'
                }
            });
            return response.data;
        }
        catch (error) {
            console.error(`Error fetching crypto quotes for ${symbol}:`, error);
            throw error;
        }
    }
    // Price history methods using direct API calls
    async getStockBars(symbol, timeframe, start, end, limit) {
        try {
            const params = {
                symbols: symbol,
                timeframe: timeframe,
                start: start,
                limit: limit || 1000,
                adjustment: 'raw',
                feed: 'sip',
                sort: 'asc'
            };
            if (end)
                params.end = end;
            const response = await axios.get(`https://data.alpaca.markets/v2/stocks/bars`, {
                params,
                headers: {
                    'APCA-API-KEY-ID': this.config.apiKey,
                    'APCA-API-SECRET-KEY': this.config.secretKey,
                    'Accept': 'application/json'
                }
            });
            return response.data;
        }
        catch (error) {
            console.error(`Error fetching stock bars for ${symbol}:`, error);
            throw error;
        }
    }
    // Market info methods
    async getClock() {
        this.ensureClient();
        return await this.client.getClock();
    }
    async getCalendar(params = {}) {
        this.ensureClient();
        return await this.client.getCalendar(params);
    }
    // Portfolio methods
    async getPortfolioHistory(params = {}) {
        this.ensureClient();
        return await this.client.getPortfolioHistory(params);
    }
    // Watchlist methods
    async getWatchlists() {
        this.ensureClient();
        return await this.client.getWatchlists();
    }
    async createWatchlist(name, symbols) {
        this.ensureClient();
        return await this.client.createWatchlist({
            name,
            symbols
        });
    }
    async updateWatchlist(watchlistId, updates) {
        this.ensureClient();
        return await this.client.updateWatchlist({
            watchlist_id: watchlistId,
            ...updates
        });
    }
    async deleteWatchlist(watchlistId) {
        this.ensureClient();
        return await this.client.deleteWatchlist({ watchlist_id: watchlistId });
    }
}
/**
 * Factory function to create and initialize an Alpaca client
 */
export async function createAlpacaClient(config) {
    const client = new AlpacaClient(config);
    await client.initClient();
    return client;
}
