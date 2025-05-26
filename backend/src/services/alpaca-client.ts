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

// Import the SDK using require to avoid ESM import issues with the preview version
const { createClient } = require('@alpacahq/typescript-sdk');

/**
 * Configuration interface for Alpaca client
 */
export interface AlpacaConfig {
  apiKey: string;
  apiSecret: string;
  paperTrading?: boolean;
}

/**
 * Order parameters interface
 */
export interface OrderParams {
  symbol: string;
  qty: string | number;
  side: 'buy' | 'sell';
  orderType: 'market' | 'limit' | 'stop' | 'stop_limit';
  timeInForce: 'day' | 'gtc' | 'opg' | 'cls' | 'ioc' | 'fok';
  limitPrice?: number | string;
  stopPrice?: number | string;
  clientOrderId?: string;
  extendedHours?: boolean;
}

/**
 * Standardized order response interface
 */
export interface OrderResponse {
  orderId: string;
  clientOrderId?: string;
  symbol: string;
  side: string;
  orderType: string;
  timeInForce: string;
  qty: number;
  filledQty: number;
  limitPrice?: number;
  stopPrice?: number;
  status: string;
  createdAt: string;
  updatedAt: string;
  submittedAt?: string;
  filledAt?: string;
  expiredAt?: string;
  canceledAt?: string;
  filledAvgPrice?: number;
}

/**
 * Position response interface
 */
export interface PositionResponse {
  symbol: string;
  qty: number;
  avgEntryPrice: number;
  side: string;
  marketValue: number;
  costBasis: number;
  unrealizedPl: number;
  unrealizedPlpc: number;
  currentPrice: number;
  lastdayPrice: number;
  changeToday: number;
}

/**
 * Account response interface
 */
export interface AccountResponse {
  accountNumber: string;
  status: string;
  currency: string;
  buyingPower: number;
  cash: number;
  portfolioValue: number;
  patternDayTrader: boolean;
  tradingBlocked: boolean;
  transfersBlocked: boolean;
  accountBlocked: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Quote response interface
 */
export interface QuoteResponse {
  symbol: string;
  bidPrice: number;
  bidSize: number;
  askPrice: number;
  askSize: number;
  timestamp: string;
  latestPrice: number;
}

/**
 * Bar response interface
 */
export interface BarResponse {
  symbol: string;
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/**
 * Helper function to safely convert a value to a number
 */
function safeToNumber(value: any, defaultValue: number = 0): number {
  if (value === null || value === undefined) return defaultValue;
  const num = typeof value === 'string' ? parseFloat(value) : Number(value);
  return isNaN(num) ? defaultValue : num;
}

/**
 * Helper function to safely convert a value to a string
 */
function safeToString(value: any): string | undefined {
  if (value === null || value === undefined) return undefined;
  return String(value);
}

/**
 * AlpacaClient class
 * 
 * Provides methods for interacting with the Alpaca API using the official TypeScript SDK.
 */
export class AlpacaClient {
  private client: any; // Using any type to avoid strict typing issues with the preview SDK
  
  /**
   * Constructor for AlpacaClient
   * @param config - Alpaca API configuration
   */
  constructor(private config: AlpacaConfig) {
    this.client = createClient({
      key: config.apiKey,
      secret: config.apiSecret,
      paper: config.paperTrading !== false, // Default to paper trading
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
  public async getAccount(): Promise<AccountResponse> {
    try {
      const account = await this.client.getAccount();
      
      return {
        accountNumber: account.account_number || '',
        status: account.status || 'UNKNOWN',
        currency: account.currency || 'USD',
        buyingPower: safeToNumber(account.buying_power),
        cash: safeToNumber(account.cash),
        portfolioValue: safeToNumber(account.portfolio_value),
        patternDayTrader: Boolean(account.pattern_day_trader),
        tradingBlocked: Boolean(account.trading_blocked),
        transfersBlocked: Boolean(account.transfers_blocked),
        accountBlocked: Boolean(account.account_blocked),
        createdAt: account.created_at || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
    } catch (error: unknown) {
      console.error('Error getting account information:', error);
      throw this.handleApiError(error, 'Failed to get account information');
    }
  }
  
  /**
   * Get all positions
   * @returns Promise resolving to array of positions
   */
  public async getPositions(): Promise<PositionResponse[]> {
    try {
      const positions = await this.client.getPositions();
      
      return positions.map((position: any) => ({
        symbol: position.symbol || '',
        qty: safeToNumber(position.qty),
        avgEntryPrice: safeToNumber(position.avg_entry_price),
        side: safeToNumber(position.qty) >= 0 ? 'long' : 'short',
        marketValue: safeToNumber(position.market_value),
        costBasis: safeToNumber(position.cost_basis),
        unrealizedPl: safeToNumber(position.unrealized_pl),
        unrealizedPlpc: safeToNumber(position.unrealized_plpc),
        currentPrice: safeToNumber(position.current_price),
        lastdayPrice: safeToNumber(position.lastday_price),
        changeToday: safeToNumber(position.change_today)
      }));
    } catch (error: unknown) {
      console.error('Error getting positions:', error);
      throw this.handleApiError(error, 'Failed to get positions');
    }
  }
  
  /**
   * Get position by symbol
   * @param symbol - Stock symbol
   * @returns Promise resolving to position information
   */
  public async getPosition(symbol: string): Promise<PositionResponse> {
    try {
      // Use symbol_or_asset_id as the parameter name per SDK documentation
      const position = await this.client.getPosition({ symbol_or_asset_id: symbol });
      
      return {
        symbol: position.symbol || symbol,
        qty: safeToNumber(position.qty),
        avgEntryPrice: safeToNumber(position.avg_entry_price),
        side: safeToNumber(position.qty) >= 0 ? 'long' : 'short',
        marketValue: safeToNumber(position.market_value),
        costBasis: safeToNumber(position.cost_basis),
        unrealizedPl: safeToNumber(position.unrealized_pl),
        unrealizedPlpc: safeToNumber(position.unrealized_plpc),
        currentPrice: safeToNumber(position.current_price),
        lastdayPrice: safeToNumber(position.lastday_price),
        changeToday: safeToNumber(position.change_today)
      };
    } catch (error: any) {
      // Handle 404 error specifically
      if (error?.status === 404 || error?.response?.status === 404) {
        const notFoundError = new Error(`No position found for symbol ${symbol}`);
        (notFoundError as any).statusCode = 404;
        throw notFoundError;
      }
      console.error(`Error getting position for ${symbol}:`, error);
      throw this.handleApiError(error, `Failed to get position for ${symbol}`);
    }
  }
  
  /**
   * Create a new order
   * @param params - Order parameters
   * @returns Promise resolving to order information
   */
  public async createOrder(params: OrderParams): Promise<OrderResponse> {
    try {
      // Convert parameters to the format expected by the TypeScript SDK
      const orderRequest: any = {
        symbol: params.symbol,
        qty: String(params.qty),
        side: params.side,
        type: params.orderType,
        time_in_force: params.timeInForce,
      };
      
      // Add conditional fields
      if (params.limitPrice !== undefined) {
        orderRequest.limit_price = String(params.limitPrice);
      }
      
      if (params.stopPrice !== undefined) {
        orderRequest.stop_price = String(params.stopPrice);
      }
      
      if (params.clientOrderId) {
        orderRequest.client_order_id = params.clientOrderId;
      }
      
      if (params.extendedHours !== undefined) {
        orderRequest.extended_hours = params.extendedHours;
      }
      
      const order = await this.client.createOrder(orderRequest);
      
      return this.formatOrderResponse(order);
    } catch (error: unknown) {
      console.error('Error creating order:', error);
      throw this.handleApiError(error, 'Failed to create order');
    }
  }
  
  /**
   * Get an order by ID
   * @param orderId - Order ID
   * @returns Promise resolving to order information
   */
  public async getOrder(orderId: string): Promise<OrderResponse> {
    try {
      const order = await this.client.getOrder({ order_id: orderId });
      return this.formatOrderResponse(order);
    } catch (error: any) {
      if (error?.status === 404 || error?.response?.status === 404) {
        const notFoundError = new Error(`Order ${orderId} not found`);
        (notFoundError as any).statusCode = 404;
        throw notFoundError;
      }
      console.error(`Error getting order ${orderId}:`, error);
      throw this.handleApiError(error, `Failed to get order ${orderId}`);
    }
  }
  
  /**
   * Get orders
   * @param status - Order status filter
   * @param limit - Maximum number of orders to return
   * @returns Promise resolving to array of orders
   */
  public async getOrders(status: string = 'open', limit: number = 50): Promise<OrderResponse[]> {
    try {
      const request: any = {
        status: status,
        limit,
        direction: 'desc'
      };
      
      const orders = await this.client.getOrders(request);
      
      // Handle both single order and array responses
      const orderArray = Array.isArray(orders) ? orders : [orders];
      return orderArray.map((order: any) => this.formatOrderResponse(order));
    } catch (error: unknown) {
      console.error('Error getting orders:', error);
      throw this.handleApiError(error, 'Failed to get orders');
    }
  }
  
  /**
   * Cancel an order
   * @param orderId - Order ID
   * @returns Promise resolving to canceled order status
   */
  public async cancelOrder(orderId: string): Promise<{ orderId: string; status: string }> {
    try {
      await this.client.cancelOrder({ order_id: orderId });
      
      return {
        orderId,
        status: 'canceled'
      };
    } catch (error: any) {
      if (error?.status === 404 || error?.response?.status === 404) {
        const notFoundError = new Error(`Order ${orderId} not found`);
        (notFoundError as any).statusCode = 404;
        throw notFoundError;
      }
      console.error(`Error canceling order ${orderId}:`, error);
      throw this.handleApiError(error, `Failed to cancel order ${orderId}`);
    }
  }
  
  /**
   * Get current quote for a symbol
   * @param symbol - Stock symbol
   * @returns Promise resolving to quote information
   */
  public async getQuote(symbol: string): Promise<QuoteResponse> {
    try {
      // Use the stocks quotes latest method from the TypeScript SDK
      const response = await this.client.getStocksQuotesLatest({ symbols: symbol });
      
      // Extract the quote data - handle various response structures
      let quote: any;
      if (response.quotes && response.quotes[symbol]) {
        quote = response.quotes[symbol];
      } else if (response[symbol]) {
        quote = response[symbol];
      } else if (Array.isArray(response) && response.length > 0) {
        quote = response[0];
      } else {
        quote = response;
      }
      
      return {
        symbol,
        bidPrice: safeToNumber(quote.bp || quote.bid_price || quote.bidPrice),
        bidSize: safeToNumber(quote.bs || quote.bid_size || quote.bidSize),
        askPrice: safeToNumber(quote.ap || quote.ask_price || quote.askPrice),
        askSize: safeToNumber(quote.as || quote.ask_size || quote.askSize),
        timestamp: quote.t || quote.timestamp || new Date().toISOString(),
        latestPrice: (safeToNumber(quote.bp || quote.bid_price || quote.bidPrice) + 
                     safeToNumber(quote.ap || quote.ask_price || quote.askPrice)) / 2
      };
    } catch (error: unknown) {
      console.error(`Error getting quote for ${symbol}:`, error);
      throw this.handleApiError(error, `Failed to get quote for ${symbol}`);
    }
  }
  
  /**
   * Get historical bars for a symbol
   * @param symbol - Stock symbol
   * @param timeframe - Timeframe for bars
   * @param start - Start date
   * @param end - End date
   * @param limit - Maximum number of bars to return
   * @returns Promise resolving to array of bars
   */
  public async getBars(
    symbol: string, 
    timeframe: string, 
    start?: Date, 
    end?: Date, 
    limit?: number
  ): Promise<BarResponse[]> {
    try {
      const request: any = {
        symbols: symbol,
        timeframe,
        limit: limit || 100
      };
      
      if (start) request.start = start.toISOString();
      if (end) request.end = end.toISOString();
      
      // Use the stocks bars method from the TypeScript SDK
      const response = await this.client.getStocksBars(request);
      
      // Extract bars from the response structure
      let bars: any[] = [];
      if (response.bars && response.bars[symbol]) {
        bars = response.bars[symbol];
      } else if (response[symbol]) {
        bars = response[symbol];
      } else if (response.bars && Array.isArray(response.bars)) {
        bars = response.bars;
      } else if (Array.isArray(response)) {
        bars = response;
      }
      
      return bars.map((bar: any) => ({
        symbol,
        timestamp: bar.t || bar.timestamp || new Date().toISOString(),
        open: safeToNumber(bar.o || bar.open),
        high: safeToNumber(bar.h || bar.high),
        low: safeToNumber(bar.l || bar.low),
        close: safeToNumber(bar.c || bar.close),
        volume: safeToNumber(bar.v || bar.volume)
      }));
    } catch (error: unknown) {
      console.error(`Error getting bars for ${symbol}:`, error);
      throw this.handleApiError(error, `Failed to get bars for ${symbol}`);
    }
  }
  
  /**
   * Get assets available for trading
   * @param status - Asset status filter
   * @returns Promise resolving to array of assets
   */
  public async getAssets(status: string = 'active'): Promise<any[]> {
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
      throw this.handleApiError(error, 'Failed to get assets');
    }
  }
  
  /**
   * Get asset by symbol
   * @param symbol - Stock symbol
   * @returns Promise resolving to asset information
   */
  public async getAsset(symbol: string): Promise<any> {
    try {
      // Use symbol_or_asset_id as the parameter name per SDK documentation
      const asset = await this.client.getAsset({ symbol_or_asset_id: symbol });
      
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
      throw this.handleApiError(error, `Failed to get asset ${symbol}`);
    }
  }
  
  /**
   * Close a position
   * @param symbol - Stock symbol
   * @returns Promise resolving to closed position result
   */
  public async closePosition(symbol: string): Promise<{ symbol: string; side: string; qty: number; status: string }> {
    try {
      // Use symbol_or_asset_id as the parameter name per SDK documentation
      const result = await this.client.closePosition({ symbol_or_asset_id: symbol });
      
      return {
        symbol,
        side: result.side || 'unknown',
        qty: safeToNumber(result.qty),
        status: 'closed'
      };
    } catch (error: any) {
      if (error?.status === 404 || error?.response?.status === 404) {
        const notFoundError = new Error(`Position not found for symbol ${symbol}`);
        (notFoundError as any).statusCode = 404;
        throw notFoundError;
      }
      console.error(`Error closing position for ${symbol}:`, error);
      throw this.handleApiError(error, `Failed to close position for ${symbol}`);
    }
  }
  
  /**
   * Format order response to standardized format
   * @param order - Raw order object from Alpaca API
   * @returns Formatted order response
   */
  private formatOrderResponse(order: any): OrderResponse {
    return {
      orderId: order.id || '',
      clientOrderId: order.client_order_id,
      symbol: order.symbol || '',
      side: order.side || '',
      orderType: order.type || order.order_type || '',
      timeInForce: order.time_in_force || '',
      qty: safeToNumber(order.qty),
      filledQty: safeToNumber(order.filled_qty),
      limitPrice: order.limit_price ? safeToNumber(order.limit_price) : undefined,
      stopPrice: order.stop_price ? safeToNumber(order.stop_price) : undefined,
      status: order.status || '',
      createdAt: order.created_at || new Date().toISOString(),
      updatedAt: order.updated_at || new Date().toISOString(),
      submittedAt: order.submitted_at,
      filledAt: order.filled_at,
      expiredAt: order.expired_at,
      canceledAt: order.canceled_at,
      filledAvgPrice: order.filled_avg_price ? safeToNumber(order.filled_avg_price) : undefined
    };
  }
  
  /**
   * Handle API errors consistently
   * @param error - The error object
   * @param message - Default error message
   * @returns Formatted error
   */
  private handleApiError(error: any, message: string): Error {
    // If it's already a handled error, just return it
    if (error.statusCode) {
      return error;
    }
    
    // Create a new error with the original message if available
    const errorMessage = error instanceof Error ? error.message : message;
    const apiError = new Error(errorMessage);
    
    // Add status code if available
    if (error?.status) {
      (apiError as any).statusCode = error.status;
    } else if (error?.response?.status) {
      (apiError as any).statusCode = error.response.status;
    } else {
      (apiError as any).statusCode = 500;
    }
    
    // Add error code if available
    (apiError as any).code = error?.code || 'ALPACA_API_ERROR';
    
    return apiError;
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