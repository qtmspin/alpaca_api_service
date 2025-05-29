/**
 * alpaca-client.ts - Fixed version
 * 
 * Service for interacting with the Alpaca Trading API
 * Fixed to handle connection errors and proper initialization
 */

import { AlpacaConfig } from '../core/index.js';
import axios from 'axios';

// Dynamic import to handle ES module
let alpacaSDK: any = null;

async function loadAlpacaSDK() {
  if (!alpacaSDK) {
    try {
      // Try ESM import first
      alpacaSDK = await import('@alpacahq/typescript-sdk');
    } catch (error) {
      console.error('Failed to load Alpaca SDK via ESM import:', error);
      throw error;
    }
  }
  return alpacaSDK;
}

export interface AlpacaClientInterface {
  // Account methods
  getAccount(): Promise<any>;
  
  // Order methods
  createOrder(orderData: any): Promise<any>;
  getOrder(orderId: string): Promise<any>;
  getOrders(params?: any): Promise<any>;
  cancelOrder(orderId: string): Promise<any>;
  replaceOrder(orderId: string, updateData: any): Promise<any>;
  
  // Position methods
  getPositions(): Promise<any>;
  getPosition(symbol: string): Promise<any>;
  closePosition(symbol: string): Promise<any>;
  
  // Asset methods
  getAssets(params?: any): Promise<any>;
  getAsset(symbol: string): Promise<any>;
  
  // Market data methods
  getStocksBarsLatest(symbols: string[]): Promise<any>;
  getStocksQuotesLatest(symbols: string[]): Promise<any>;
  getStocksTrades(symbols: string[], params?: any): Promise<any>;
  
  // Crypto data methods
  getCryptoBarsLatest(symbols: string[]): Promise<any>;
  getCryptoBars(symbol: string, timeframe: string, start: string, end?: string, limit?: number): Promise<any>;
  getCryptoQuotes(symbol: string, start: string, end?: string, limit?: number): Promise<any>;
  getCryptoSnapshots(symbols: string[]): Promise<any>;
  
  // Price history methods
  getStockBars(symbol: string, timeframe: string, start: string, end?: string, limit?: number): Promise<any>;
  
  // Market info methods
  getClock(): Promise<any>;
  getCalendar(params?: any): Promise<any>;
  
  // Portfolio methods
  getPortfolioHistory(params?: any): Promise<any>;
  
  // Watchlist methods
  getWatchlists(): Promise<any>;
  createWatchlist(name: string, symbols: string[]): Promise<any>;
  updateWatchlist(watchlistId: string, updates: any): Promise<any>;
  deleteWatchlist(watchlistId: string): Promise<any>;
}

export class AlpacaClient implements AlpacaClientInterface {
  private client: any = null;
  private config: AlpacaConfig;
  private isInitialized: boolean = false;

  constructor(config: AlpacaConfig) {
    this.config = config;
    this.validateConfig();
  }

  private validateConfig(): void {
    if (!this.config.apiKey || this.config.apiKey.trim() === '') {
      throw new Error('Alpaca API key is required');
    }
    
    if (!this.config.secretKey || this.config.secretKey.trim() === '') {
      throw new Error('Alpaca secret key is required');
    }

    // Validate API key format (should start with PK for paper trading or APCA for live)
    if (!this.config.apiKey.startsWith('PK') && !this.config.apiKey.startsWith('APCA')) {
      console.warn('API key format appears invalid. Expected format: PK... (paper) or APCA... (live)');
    }
  }

  async initClient(): Promise<void> {
    try {
      console.log('Loading Alpaca SDK...');
      const sdk = await loadAlpacaSDK();
      
      console.log('Creating Alpaca client with config:', {
        keyId: this.config.apiKey.substring(0, 8) + '...',
        paper: this.config.isPaper,
        baseUrl: this.config.baseUrl
      });
      
      // Create client with proper configuration
      this.client = sdk.createClient({
        key: this.config.apiKey,
        secret: this.config.secretKey,
        paper: this.config.isPaper,
        baseUrl: this.config.baseUrl,
        tokenBucket: {
          capacity: 200,
          fillRate: 60, // requests per second
        }
      });

      // Test the connection by making a simple API call
      console.log('Testing Alpaca connection...');
      const account = await this.client.getAccount();
      console.log('Alpaca connection successful. Account status:', account.status);
      
      this.isInitialized = true;
      console.log('Alpaca client initialized successfully');
    } catch (error) {
      this.isInitialized = false;
      console.error('Failed to initialize Alpaca client:', error);
      
      // Provide more specific error messages
      if (error instanceof Error) {
        if (error.message.includes('401') || error.message.includes('Unauthorized')) {
          throw new Error('Invalid API credentials. Please check your API key and secret.');
        } else if (error.message.includes('403') || error.message.includes('Forbidden')) {
          throw new Error('API access forbidden. Please check your account permissions.');
        } else if (error.message.includes('network') || error.message.includes('ENOTFOUND')) {
          throw new Error('Network error. Please check your internet connection.');
        } else {
          throw new Error(`Alpaca client initialization failed: ${error.message}`);
        }
      } else {
        throw new Error(`Failed to initialize Alpaca client: ${String(error)}`);
      }
    }
  }

  public ensureClient(): void {
    if (!this.client || !this.isInitialized) {
      throw new Error('Alpaca client not initialized. Call initClient() first.');
    }
  }

  /**
   * Check if the Alpaca client is initialized
   * @returns boolean indicating whether the client is initialized
   */
  public isClientInitialized(): boolean {
    return this.isInitialized && this.client !== null;
  }

  // Account methods
  async getAccount(): Promise<any> {
    this.ensureClient();
    try {
      return await this.client.getAccount();
    } catch (error) {
      console.error('Error getting account:', error);
      throw this.handleApiError(error, 'Failed to get account information');
    }
  }

  // Order methods
  async createOrder(orderData: any): Promise<any> {
    this.ensureClient();
    try {
      return await this.client.createOrder(orderData);
    } catch (error) {
      console.error('Error creating order:', error);
      throw this.handleApiError(error, 'Failed to create order');
    }
  }

  async getOrder(orderId: string): Promise<any> {
    this.ensureClient();
    try {
      return await this.client.getOrder({ order_id: orderId });
    } catch (error) {
      console.error('Error getting order:', error);
      throw this.handleApiError(error, 'Failed to get order');
    }
  }

  async getOrders(params: any = {}): Promise<any> {
    this.ensureClient();
    try {
      return await this.client.getOrders(params);
    } catch (error) {
      console.error('Error getting orders:', error);
      throw this.handleApiError(error, 'Failed to get orders');
    }
  }

  async cancelOrder(orderId: string): Promise<any> {
    this.ensureClient();
    try {
      return await this.client.cancelOrder({ order_id: orderId });
    } catch (error) {
      console.error('Error canceling order:', error);
      throw this.handleApiError(error, 'Failed to cancel order');
    }
  }

  async replaceOrder(orderId: string, updateData: any): Promise<any> {
    this.ensureClient();
    try {
      return await this.client.replaceOrder({ 
        order_id: orderId, 
        ...updateData 
      });
    } catch (error) {
      console.error('Error replacing order:', error);
      throw this.handleApiError(error, 'Failed to replace order');
    }
  }

  // Position methods
  async getPositions(): Promise<any> {
    this.ensureClient();
    try {
      return await this.client.getPositions();
    } catch (error) {
      console.error('Error getting positions:', error);
      throw this.handleApiError(error, 'Failed to get positions');
    }
  }

  async getPosition(symbol: string): Promise<any> {
    this.ensureClient();
    try {
      return await this.client.getPosition({ symbol_or_asset_id: symbol });
    } catch (error) {
      console.error('Error getting position:', error);
      throw this.handleApiError(error, 'Failed to get position');
    }
  }

  async closePosition(symbol: string): Promise<any> {
    this.ensureClient();
    try {
      return await this.client.closePosition({ symbol_or_asset_id: symbol });
    } catch (error) {
      console.error('Error closing position:', error);
      throw this.handleApiError(error, 'Failed to close position');
    }
  }

  // Asset methods
  async getAssets(params: any = {}): Promise<any> {
    this.ensureClient();
    try {
      return await this.client.getAssets(params);
    } catch (error) {
      console.error('Error getting assets:', error);
      throw this.handleApiError(error, 'Failed to get assets');
    }
  }

  async getAsset(symbol: string): Promise<any> {
    this.ensureClient();
    try {
      return await this.client.getAsset({ symbol_or_asset_id: symbol });
    } catch (error) {
      console.error('Error getting asset:', error);
      throw this.handleApiError(error, 'Failed to get asset');
    }
  }

  // Market data methods
  async getStocksBarsLatest(symbols: string[]): Promise<any> {
    this.ensureClient();
    try {
      return await this.client.getStocksBarsLatest({
        symbols: symbols.join(',')
      });
    } catch (error) {
      console.error('Error getting latest stock bars:', error);
      throw this.handleApiError(error, 'Failed to get latest stock bars');
    }
  }

  async getStocksQuotesLatest(symbols: string[]): Promise<any> {
    this.ensureClient();
    try {
      return await this.client.getStocksQuotesLatest({
        symbols: symbols.join(',')
      });
    } catch (error) {
      console.error('Error getting latest stock quotes:', error);
      throw this.handleApiError(error, 'Failed to get latest stock quotes');
    }
  }

  async getStocksTrades(symbols: string[], params: any = {}): Promise<any> {
    this.ensureClient();
    try {
      return await this.client.getStocksTrades({
        symbols: symbols.join(','),
        ...params
      });
    } catch (error) {
      console.error('Error getting stock trades:', error);
      throw this.handleApiError(error, 'Failed to get stock trades');
    }
  }
  
  // Crypto data methods using direct API calls with proper endpoints
  async getCryptoSnapshots(symbols: string[]): Promise<any> {
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
    } catch (error) {
      console.error('Error fetching crypto snapshots:', error);
      throw this.handleApiError(error, 'Failed to get crypto snapshots');
    }
  }

  async getCryptoBarsLatest(symbols: string[]): Promise<any> {
    try {
      // Use crypto snapshots for latest data
      return await this.getCryptoSnapshots(symbols);
    } catch (error) {
      console.error('Error fetching crypto bars latest:', error);
      throw this.handleApiError(error, 'Failed to get latest crypto bars');
    }
  }
  
  async getCryptoBars(symbol: string, timeframe: string, start: string, end?: string, limit?: number): Promise<any> {
    try {
      const params: any = {
        symbols: symbol,
        timeframe: timeframe,
        start: start,
        limit: limit || 1000,
        sort: 'asc'
      };
      
      if (end) params.end = end;
      
      const response = await axios.get(`https://data.alpaca.markets/v1beta3/crypto/us/bars`, {
        params,
        headers: {
          'APCA-API-KEY-ID': this.config.apiKey,
          'APCA-API-SECRET-KEY': this.config.secretKey,
          'Accept': 'application/json'
        }
      });
      return response.data;
    } catch (error) {
      console.error(`Error fetching crypto bars for ${symbol}:`, error);
      throw this.handleApiError(error, `Failed to get crypto bars for ${symbol}`);
    }
  }
  
  async getCryptoQuotes(symbol: string, start: string, end?: string, limit?: number): Promise<any> {
    try {
      const params: any = {
        symbols: symbol,
        start: start,
        limit: limit || 1000,
        sort: 'asc'
      };
      
      if (end) params.end = end;
      
      const response = await axios.get(`https://data.alpaca.markets/v1beta3/crypto/us/quotes`, {
        params,
        headers: {
          'APCA-API-KEY-ID': this.config.apiKey,
          'APCA-API-SECRET-KEY': this.config.secretKey,
          'Accept': 'application/json'
        }
      });
      return response.data;
    } catch (error) {
      console.error(`Error fetching crypto quotes for ${symbol}:`, error);
      throw this.handleApiError(error, `Failed to get crypto quotes for ${symbol}`);
    }
  }
  
  // Price history methods using direct API calls
  async getStockBars(symbol: string, timeframe: string, start: string, end?: string, limit?: number): Promise<any> {
    try {
      const params: any = {
        symbols: symbol,
        timeframe: timeframe,
        start: start,
        limit: limit || 1000,
        adjustment: 'raw',
        feed: 'sip',
        sort: 'asc'
      };
      
      if (end) params.end = end;
      
      const response = await axios.get(`https://data.alpaca.markets/v2/stocks/bars`, {
        params,
        headers: {
          'APCA-API-KEY-ID': this.config.apiKey,
          'APCA-API-SECRET-KEY': this.config.secretKey,
          'Accept': 'application/json'
        }
      });
      return response.data;
    } catch (error) {
      console.error(`Error fetching stock bars for ${symbol}:`, error);
      throw this.handleApiError(error, `Failed to get stock bars for ${symbol}`);
    }
  }

  // Market info methods
  async getClock(): Promise<any> {
    this.ensureClient();
    try {
      return await this.client.getClock();
    } catch (error) {
      console.error('Error getting market clock:', error);
      throw this.handleApiError(error, 'Failed to get market clock');
    }
  }

  async getCalendar(params: any = {}): Promise<any> {
    this.ensureClient();
    try {
      return await this.client.getCalendar(params);
    } catch (error) {
      console.error('Error getting calendar:', error);
      throw this.handleApiError(error, 'Failed to get calendar');
    }
  }

  // Portfolio methods
  async getPortfolioHistory(params: any = {}): Promise<any> {
    this.ensureClient();
    try {
      return await this.client.getPortfolioHistory(params);
    } catch (error) {
      console.error('Error getting portfolio history:', error);
      throw this.handleApiError(error, 'Failed to get portfolio history');
    }
  }

  // Watchlist methods
  async getWatchlists(): Promise<any> {
    this.ensureClient();
    try {
      return await this.client.getWatchlists();
    } catch (error) {
      console.error('Error getting watchlists:', error);
      throw this.handleApiError(error, 'Failed to get watchlists');
    }
  }

  async createWatchlist(name: string, symbols: string[]): Promise<any> {
    this.ensureClient();
    try {
      return await this.client.createWatchlist({
        name,
        symbols
      });
    } catch (error) {
      console.error('Error creating watchlist:', error);
      throw this.handleApiError(error, 'Failed to create watchlist');
    }
  }

  async updateWatchlist(watchlistId: string, updates: any): Promise<any> {
    this.ensureClient();
    try {
      return await this.client.updateWatchlist({
        watchlist_id: watchlistId,
        ...updates
      });
    } catch (error) {
      console.error('Error updating watchlist:', error);
      throw this.handleApiError(error, 'Failed to update watchlist');
    }
  }

  async deleteWatchlist(watchlistId: string): Promise<any> {
    this.ensureClient();
    try {
      return await this.client.deleteWatchlist({ watchlist_id: watchlistId });
    } catch (error) {
      console.error('Error deleting watchlist:', error);
      throw this.handleApiError(error, 'Failed to delete watchlist');
    }
  }

  /**
   * Handle API errors and provide meaningful error messages
   */
  private handleApiError(error: any, defaultMessage: string): Error {
    if (error?.response?.status) {
      const status = error.response.status;
      const message = error.response.data?.message || error.message;
      
      switch (status) {
        case 401:
          return new Error('Authentication failed. Please check your API credentials.');
        case 403:
          return new Error('Access forbidden. Please check your account permissions.');
        case 404:
          return new Error('Resource not found.');
        case 429:
          return new Error('Rate limit exceeded. Please try again later.');
        case 500:
          return new Error('Alpaca server error. Please try again later.');
        default:
          return new Error(`${defaultMessage}: ${message || 'Unknown error'}`);
      }
    }
    
    return new Error(`${defaultMessage}: ${error?.message || 'Unknown error'}`);
  }
}

/**
 * Factory function to create and initialize an Alpaca client
 */
export async function createAlpacaClient(config: AlpacaConfig): Promise<AlpacaClient> {
  const client = new AlpacaClient(config);
  await client.initClient();
  return client;
}