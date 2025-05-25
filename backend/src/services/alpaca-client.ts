/**
 * alpaca-client.ts
 * 
 * This file contains the client service for interacting with the Alpaca API.
 * Location: backend/src/services/alpaca-client.ts
 * 
 * Responsibilities:
 * - Provide methods for interacting with the Alpaca API using the official TypeScript SDK
 * - Handle API requests and responses
 * - Format data for the frontend
 * - Manage error handling and rate limiting
 */

import { createClient } from '@alpacahq/typescript-sdk';

/**
 * Helper function to safely convert a number or string to a string
 * @param value - The value to convert
 * @returns The string representation of the value or undefined if the value is undefined
 */
function toStringValue(value: number | string | undefined): string | undefined {
  if (value === undefined) return undefined;
  return typeof value === 'string' ? value : String(value);
}

/**
 * Helper function to safely parse a string to a number
 * @param value - The value to parse
 * @returns The number representation of the value or undefined if the value is undefined
 */
function toNumberValue(value: string | number | undefined): number | undefined {
  if (value === undefined) return undefined;
  return typeof value === 'number' ? value : parseFloat(value);
}

// Configuration interface for Alpaca client
export interface AlpacaConfig {
  apiKey: string;
  apiSecret: string;
  paperTrading?: boolean;
}

/**
 * AlpacaClient class
 * 
 * Provides methods for interacting with the Alpaca API using the official TypeScript SDK.
 */
export class AlpacaClient {
  private client: ReturnType<typeof createClient>;
  
  /**
   * Constructor for AlpacaClient
   * @param config - Alpaca API configuration
   */
  constructor(private config: AlpacaConfig) {
    this.client = createClient({
      key: config.apiKey,
      secret: config.apiSecret,
      paper: config.paperTrading !== false, // Default to paper trading if not specified
      tokenBucket: {
        capacity: 200, // Maximum number of tokens
        fillRate: 60   // Tokens refilled per second
      }
    });
  }
  
  /**
   * Get account information
   * @returns Promise resolving to account information
   */
  public async getAccount() {
    try {
      const account = await this.client.getAccount();
      return {
        accountNumber: account.account_number,
        status: account.status,
        currency: account.currency,
        buyingPower: parseFloat(account.buying_power),
        cash: parseFloat(account.cash),
        portfolioValue: parseFloat(account.portfolio_value),
        patternDayTrader: account.pattern_day_trader,
        tradingBlocked: account.trading_blocked,
        transfersBlocked: account.transfers_blocked,
        accountBlocked: account.account_blocked,
        createdAt: account.created_at,
        updatedAt: new Date().toISOString()
      };
    } catch (error: unknown) {
      console.error('Error getting account information:', error);
      throw error;
    }
  }
  
  /**
   * Get all positions
   * @returns Promise resolving to array of positions
   */
  public async getPositions() {
    try {
      const positions = await this.client.getPositions();
      
      return positions.map((position) => ({
        symbol: position.symbol,
        qty: parseFloat(position.qty),
        avgEntryPrice: parseFloat(position.avg_entry_price),
        side: parseFloat(position.qty) > 0 ? 'long' : 'short',
        marketValue: parseFloat(position.market_value),
        costBasis: parseFloat(position.cost_basis),
        unrealizedPl: parseFloat(position.unrealized_pl),
        unrealizedPlpc: parseFloat(position.unrealized_plpc),
        currentPrice: parseFloat(position.current_price),
        lastdayPrice: parseFloat(position.lastday_price),
        changeToday: parseFloat(position.change_today)
      }));
    } catch (error: unknown) {
      console.error('Error getting positions:', error);
      throw error;
    }
  }
  
  /**
   * Get position by symbol
   * @param symbol - Stock symbol
   * @returns Promise resolving to position information
   */
  public async getPosition(symbol: string) {
    try {
      // Use a string parameter as the SDK expects for the position endpoint
      const position = await this.client.getPosition(symbol as any);
      
      return {
        symbol: position.symbol,
        qty: parseFloat(position.qty),
        avgEntryPrice: parseFloat(position.avg_entry_price),
        side: parseFloat(position.qty) > 0 ? 'long' : 'short',
        marketValue: parseFloat(position.market_value),
        costBasis: parseFloat(position.cost_basis),
        unrealizedPl: parseFloat(position.unrealized_pl),
        unrealizedPlpc: parseFloat(position.unrealized_plpc),
        currentPrice: parseFloat(position.current_price),
        lastdayPrice: parseFloat(position.lastday_price),
        changeToday: parseFloat(position.change_today)
      };
    } catch (error: unknown) {
      // Check for 404 error (position not found)
      if ((error as any)?.status === 404) {
        throw new Error(`No position found for symbol ${symbol}`);
      }
      console.error(`Error getting position for ${symbol}:`, error);
      throw error;
    }
  }
  
  /**
   * Create a new order
   * @param params - Order parameters
   * @returns Promise resolving to order information
   */
  public async createOrder(params: {
    symbol: string;
    qty: string | number;
    side: 'buy' | 'sell';
    orderType: 'market' | 'limit' | 'stop' | 'stop_limit';
    timeInForce: 'day' | 'gtc' | 'opg' | 'cls' | 'ioc' | 'fok';
    limitPrice?: number | string;
    stopPrice?: number | string;
    clientOrderId?: string;
    extendedHours?: boolean;
  }) {
    try {
      // Convert order parameters to the format expected by the SDK
      const orderParams = {
        symbol: params.symbol,
        qty: params.qty.toString(),
        side: params.side,
        type: params.orderType,
        time_in_force: params.timeInForce,
        limit_price: toStringValue(params.limitPrice),
        stop_price: toStringValue(params.stopPrice),
        client_order_id: params.clientOrderId,
        extended_hours: params.extendedHours
      };
      
      // Use type assertion for the client.createOrder method
      // The SDK might return different response structures based on the version
      const order = await this.client.createOrder(orderParams as any);
      
      return {
        orderId: order.id,
        clientOrderId: order.client_order_id,
        symbol: order.symbol,
        side: order.side,
        orderType: order.type,
        timeInForce: order.time_in_force,
        qty: parseFloat(order.qty),
        filledQty: parseFloat(order.filled_qty),
        limitPrice: order.limit_price ? parseFloat(order.limit_price) : undefined,
        stopPrice: order.stop_price ? parseFloat(order.stop_price) : undefined,
        status: order.status,
        createdAt: order.created_at,
        updatedAt: order.updated_at,
        submittedAt: order.submitted_at,
        filledAt: order.filled_at,
        expiredAt: order.expired_at,
        canceledAt: order.canceled_at
      };
    } catch (error: unknown) {
      console.error('Error creating order:', error);
      // Add more detailed error information
      if (error instanceof Error) {
        throw new Error(`Failed to create order: ${error.message}`);
      }
      throw error;
    }
  }
  
  /**
   * Get an order by ID
   * @param orderId - Order ID
   * @returns Promise resolving to order information
   */
  public async getOrder(orderId: string) {
    try {
      const order = await this.client.getOrder({ order_id: orderId });
      
      return {
        orderId: order.id,
        clientOrderId: order.client_order_id,
        symbol: order.symbol,
        side: order.side,
        orderType: order.type,
        timeInForce: order.time_in_force,
        qty: parseFloat(order.qty),
        filledQty: parseFloat(order.filled_qty),
        limitPrice: order.limit_price ? parseFloat(order.limit_price) : undefined,
        stopPrice: order.stop_price ? parseFloat(order.stop_price) : undefined,
        status: order.status,
        createdAt: order.created_at,
        updatedAt: order.updated_at,
        submittedAt: order.submitted_at,
        filledAt: order.filled_at,
        expiredAt: order.expired_at,
        canceledAt: order.canceled_at
      };
    } catch (error: unknown) {
      console.error(`Error getting order ${orderId}:`, error);
      throw error;
    }
  }
  
  /**
   * Get orders
   * @param status - Order status filter
   * @param limit - Maximum number of orders to return
   * @returns Promise resolving to array of orders
   */
  public async getOrders(status: string = 'open', limit: number = 50) {
    try {
      // Use parameters as the SDK expects for the getOrders endpoint
      const params = {
        status,
        limit,
        direction: 'desc'
      };
      
      const orders = await this.client.getOrders(params as any);
      
      // The SDK returns an array of orders
      return (Array.isArray(orders) ? orders : [orders]).map((order: any) => ({
        orderId: order.id,
        clientOrderId: order.client_order_id,
        symbol: order.symbol,
        side: order.side,
        orderType: order.type,
        timeInForce: order.time_in_force,
        qty: parseFloat(order.qty),
        filledQty: parseFloat(order.filled_qty),
        limitPrice: order.limit_price ? parseFloat(order.limit_price) : undefined,
        stopPrice: order.stop_price ? parseFloat(order.stop_price) : undefined,
        status: order.status,
        createdAt: order.created_at,
        updatedAt: order.updated_at,
        submittedAt: order.submitted_at,
        filledAt: order.filled_at,
        expiredAt: order.expired_at,
        canceledAt: order.canceled_at
      }));
    } catch (error: unknown) {
      console.error('Error getting orders:', error);
      throw error;
    }
  }

  /**
   * Cancel an order
   * @param orderId - Order ID
   * @returns Promise resolving to canceled order status
   */
  public async cancelOrder(orderId: string) {
    try {
      await this.client.cancelOrder({ order_id: orderId });
      
      return {
        orderId,
        status: 'canceled'
      };
    } catch (error: unknown) {
      console.error(`Error canceling order ${orderId}:`, error);
      throw error;
    }
  }
  
  /**
   * Get current quote for a symbol
   * @param symbol - Stock symbol
   * @returns Promise resolving to quote information
   */
  public async getQuote(symbol: string) {
    try {
      // In the TypeScript SDK, we need to use the market_data client for quotes
      // Use type assertion since the structure might vary between SDK versions
      const quote = await (this.client as any).getMarketData().getLatestQuote(symbol);
      
      return {
        symbol,
        bidPrice: parseFloat(quote.bidPrice),
        bidSize: parseInt(quote.bidSize),
        askPrice: parseFloat(quote.askPrice),
        askSize: parseInt(quote.askSize),
        timestamp: quote.timestamp,
        latestPrice: (parseFloat(quote.bidPrice) + parseFloat(quote.askPrice)) / 2
      };
    } catch (error: unknown) {
      console.error(`Error getting quote for ${symbol}:`, error);
      throw error;
    }
  }
  
  /**
   * Get historical bars for a symbol
   * @param symbol - Stock symbol
   * @param timeframe - Timeframe for bars (e.g., '1Min', '1D')
   * @param start - Start date
   * @param end - End date
   * @param limit - Maximum number of bars to return
   * @returns Promise resolving to array of bars
   */
  public async getBars(symbol: string, timeframe: string, start?: Date, end?: Date, limit?: number) {
    try {
      // Create params object for the getBars endpoint
      const params: any = {
        timeframe,
        start: start?.toISOString(),
        end: end?.toISOString(),
        limit
      };
      
      // In the TypeScript SDK, we need to use the market_data client for bars
      // Use type assertion since the structure might vary between SDK versions
      const barsResponse = await (this.client as any).getMarketData().getBars(symbol, params);
      
      return barsResponse.bars.map((bar: any) => ({
        symbol,
        timestamp: bar.timestamp,
        open: parseFloat(bar.open),
        high: parseFloat(bar.high),
        low: parseFloat(bar.low),
        close: parseFloat(bar.close),
        volume: parseInt(bar.volume.toString())
      }));
    } catch (error: unknown) {
      console.error(`Error getting bars for ${symbol}:`, error);
      throw error;
    }
  }
  
  /**
   * Get assets available for trading
   * @param status - Asset status filter
   * @returns Promise resolving to array of assets
   */
  public async getAssets(status: string = 'active') {
    try {
      const assets = await this.client.getAssets({ status });
      
      return assets.map((asset: any) => ({
        id: asset.id,
        symbol: asset.symbol,
        name: asset.name,
        exchange: asset.exchange,
        status: asset.status,
        tradable: asset.tradable,
        marginable: asset.marginable,
        shortable: asset.shortable,
        fractionable: asset.fractionable
      }));
    } catch (error: unknown) {
      console.error('Error getting assets:', error);
      throw error;
    }
  }
  
  /**
   * Get asset by symbol
   * @param symbol - Stock symbol
   * @returns Promise resolving to asset information
   */
  public async getAsset(symbol: string) {
    try {
      // Use a string parameter as the SDK expects for the asset endpoint
      const asset = await this.client.getAsset(symbol as any);
      
      return {
        id: asset.id,
        symbol: asset.symbol,
        name: asset.name,
        exchange: asset.exchange,
        status: asset.status,
        tradable: asset.tradable,
        marginable: asset.marginable,
        shortable: asset.shortable,
        fractionable: asset.fractionable
      };
    } catch (error: unknown) {
      console.error(`Error getting asset ${symbol}:`, error);
      throw error;
    }
  }
  
  /**
   * Close a position
   * @param symbol - Stock symbol
   * @returns Promise resolving to closed position
   */
  public async closePosition(symbol: string) {
    try {
      // Use a string parameter as the SDK expects for the closePosition endpoint
      const response = await this.client.closePosition(symbol as any);
      
      return {
        symbol,
        side: response.side,
        qty: parseFloat(response.qty),
        status: 'closed'
      };
    } catch (error: unknown) {
      console.error(`Error closing position for ${symbol}:`, error);
      throw error;
    }
  }
}

/**
 * Create an Alpaca client instance
 * @param config - Alpaca API configuration
 * @returns AlpacaClient instance
 */
export function createAlpacaClient(config: AlpacaConfig): AlpacaClient {
  return new AlpacaClient(config);
}
