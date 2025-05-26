/**
 * alpaca-client.ts
 * 
 * Service for interacting with the Alpaca Trading API
 * Fixed to handle crypto and stock data correctly with proper API endpoints
 */

import { AlpacaConfig } from '../core';
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

  constructor(config: AlpacaConfig) {
    this.config = config;
  }

  async initClient(): Promise<void> {
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
    } catch (error) {
      console.error('Failed to initialize Alpaca client:', error);
      throw new Error(`Failed to initialize Alpaca client: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  public ensureClient(): void {
    if (!this.client) {
      throw new Error('Alpaca client not initialized. Call initClient() first.');
    }
  }

  /**
   * Check if the Alpaca client is initialized
   * @returns boolean indicating whether the client is initialized
   */
  public isInitialized(): boolean {
    return this.client !== null;
  }

  // Account methods
  async getAccount(): Promise<any> {
    this.ensureClient();
    return await this.client.getAccount();
  }

  // Order methods
  async createOrder(orderData: any): Promise<any> {
    this.ensureClient();
    return await this.client.createOrder(orderData);
  }

  async getOrder(orderId: string): Promise<any> {
    this.ensureClient();
    return await this.client.getOrder({ order_id: orderId });
  }

  async getOrders(params: any = {}): Promise<any> {
    this.ensureClient();
    return await this.client.getOrders(params);
  }

  async cancelOrder(orderId: string): Promise<any> {
    this.ensureClient();
    return await this.client.cancelOrder({ order_id: orderId });
  }

  async replaceOrder(orderId: string, updateData: any): Promise<any> {
    this.ensureClient();
    return await this.client.replaceOrder({ 
      order_id: orderId, 
      ...updateData 
    });
  }

  // Position methods
  async getPositions(): Promise<any> {
    this.ensureClient();
    return await this.client.getPositions();
  }

  async getPosition(symbol: string): Promise<any> {
    this.ensureClient();
    return await this.client.getPosition({ symbol_or_asset_id: symbol });
  }

  async closePosition(symbol: string): Promise<any> {
    this.ensureClient();
    return await this.client.closePosition({ symbol_or_asset_id: symbol });
  }

  // Asset methods
  async getAssets(params: any = {}): Promise<any> {
    this.ensureClient();
    return await this.client.getAssets(params);
  }

  async getAsset(symbol: string): Promise<any> {
    this.ensureClient();
    return await this.client.getAsset({ symbol_or_asset_id: symbol });
  }

  // Market data methods
  async getStocksBarsLatest(symbols: string[]): Promise<any> {
    this.ensureClient();
    return await this.client.getStocksBarsLatest({
      symbols: symbols.join(',')
    });
  }

  async getStocksQuotesLatest(symbols: string[]): Promise<any> {
    this.ensureClient();
    return await this.client.getStocksQuotesLatest({
      symbols: symbols.join(',')
    });
  }

  async getStocksTrades(symbols: string[], params: any = {}): Promise<any> {
    this.ensureClient();
    return await this.client.getStocksTrades({
      symbols: symbols.join(','),
      ...params
    });
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
      throw error;
    }
  }

  async getCryptoBarsLatest(symbols: string[]): Promise<any> {
    this.ensureClient();
    try {
      // Use crypto snapshots for latest data
      return await this.getCryptoSnapshots(symbols);
    } catch (error) {
      console.error('Error fetching crypto bars latest:', error);
      throw error;
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
      throw error;
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
      throw error;
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
      throw error;
    }
  }

  // Market info methods
  async getClock(): Promise<any> {
    this.ensureClient();
    return await this.client.getClock();
  }

  async getCalendar(params: any = {}): Promise<any> {
    this.ensureClient();
    return await this.client.getCalendar(params);
  }

  // Portfolio methods
  async getPortfolioHistory(params: any = {}): Promise<any> {
    this.ensureClient();
    return await this.client.getPortfolioHistory(params);
  }

  // Watchlist methods
  async getWatchlists(): Promise<any> {
    this.ensureClient();
    return await this.client.getWatchlists();
  }

  async createWatchlist(name: string, symbols: string[]): Promise<any> {
    this.ensureClient();
    return await this.client.createWatchlist({
      name,
      symbols
    });
  }

  async updateWatchlist(watchlistId: string, updates: any): Promise<any> {
    this.ensureClient();
    return await this.client.updateWatchlist({
      watchlist_id: watchlistId,
      ...updates
    });
  }

  async deleteWatchlist(watchlistId: string): Promise<any> {
    this.ensureClient();
    return await this.client.deleteWatchlist({ watchlist_id: watchlistId });
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