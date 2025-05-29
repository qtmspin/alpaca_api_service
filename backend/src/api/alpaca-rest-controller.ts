/**
 * alpaca-rest-controller.ts - Fixed version
 * 
 * This file handles REST API endpoints for Alpaca API operations.
 * Location: backend/src/api/alpaca-rest-controller.ts
 * 
 * Responsibilities:
 * - Provide REST API endpoints for Alpaca API operations
 * - Handle connection to Alpaca API with proper error handling
 * - Process market data and account information requests
 */

import { Router, Request, Response } from 'express';
import { AlpacaClient } from '../services/alpaca-client.js';
import { createServerError } from '../core/errors.js';

/**
 * AlpacaRestController
 * Handles Alpaca API REST endpoints with improved error handling
 */
export class AlpacaRestController {
  private router: Router;
  private alpacaClient: AlpacaClient;

  constructor(alpacaClient: AlpacaClient) {
    this.router = Router();
    this.alpacaClient = alpacaClient;
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    this.router.post('/connect', this.connect.bind(this));
    this.router.get('/account', this.getAccount.bind(this));
    this.router.get('/positions', this.getPositions.bind(this));
    this.router.get('/market-status', this.getMarketStatus.bind(this));
    this.router.get('/orders', this.getOrders.bind(this));
    this.router.get('/assets', this.getAssets.bind(this));
    this.router.get('/market-data/:symbol', this.getMarketData.bind(this));
    this.router.get('/price-history/:symbol', this.getPriceHistory.bind(this));
    // Add a specific route for crypto price history to handle symbols with slashes
    this.router.get('/crypto-price-history/:base/:quote', this.getCryptoPriceHistory.bind(this));
  }

  /**
   * Connect to Alpaca API with proper validation and error handling
   */
  private async connect(req: Request, res: Response): Promise<void> {
    try {
      console.log('📡 Attempting to connect to Alpaca API...');
      
      // Get API credentials from request body
      const { apiKey, secretKey, isPaper = true } = req.body;
      
      // Validate required fields
      if (!apiKey || !secretKey) {
        console.log('❌ Missing API credentials in request');
        res.status(400).json({
          success: false,
          message: 'API key and secret key are required'
        });
        return;
      }
      
      // Validate API key format
      if (!apiKey.startsWith('PK') && !apiKey.startsWith('APCA')) {
        console.log('⚠️  API key format appears invalid');
        res.status(400).json({
          success: false,
          message: 'Invalid API key format. Expected format: PK... (paper) or APCA... (live)'
        });
        return;
      }
      
      console.log(`🔑 Connecting with API key: ${apiKey.substring(0, 8)}... (${isPaper ? 'Paper' : 'Live'} trading)`);
      
      try {
        // Update the client configuration
        this.alpacaClient = new AlpacaClient({
          apiKey,
          secretKey,
          isPaper,
          baseUrl: isPaper ? 'https://paper-api.alpaca.markets' : 'https://api.alpaca.markets'
        });
        
        // Initialize the client
        await this.alpacaClient.initClient();
        console.log('✅ Alpaca client initialized successfully');
        
        // Test the connection by getting account info
        const account = await this.alpacaClient.getAccount();
        console.log(`✅ Successfully connected to Alpaca API. Account: ${account.id} (${account.status})`);
        
        res.json({
          success: true,
          message: 'Successfully connected to Alpaca API',
          data: {
            account: {
              id: account.id,
              status: account.status,
              account_number: account.account_number,
              buying_power: account.buying_power,
              cash: account.cash,
              portfolio_value: account.portfolio_value
            },
            connected: true,
            isPaper: isPaper
          }
        });
      } catch (initError) {
        console.error('❌ Failed to initialize Alpaca client:', initError);
        
        // Provide specific error messages based on the error type
        let errorMessage = 'Failed to connect to Alpaca API';
        let statusCode = 500;
        
        if (initError instanceof Error) {
          const errorStr = initError.message.toLowerCase();
          
          if (errorStr.includes('401') || errorStr.includes('unauthorized') || errorStr.includes('credentials')) {
            errorMessage = 'Invalid API credentials. Please check your API key and secret.';
            statusCode = 401;
          } else if (errorStr.includes('403') || errorStr.includes('forbidden')) {
            errorMessage = 'API access forbidden. Please check your account permissions.';
            statusCode = 403;
          } else if (errorStr.includes('network') || errorStr.includes('enotfound') || errorStr.includes('timeout')) {
            errorMessage = 'Network error. Please check your internet connection and try again.';
            statusCode = 503;
          } else if (errorStr.includes('not found')) {
            errorMessage = 'API endpoint not found. Please verify your API configuration.';
            statusCode = 404;
          } else {
            errorMessage = `Connection failed: ${initError.message}`;
          }
        }
        
        res.status(statusCode).json({
          success: false,
          message: errorMessage,
          error: {
            code: statusCode,
            type: initError instanceof Error ? initError.name : 'UnknownError'
          }
        });
      }
    } catch (error) {
      console.error('❌ Error in connect endpoint:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error during connection attempt',
        error: createServerError(error instanceof Error ? error.message : 'Unknown error', error)
      });
    }
  }

  /**
   * Safely ensure client is initialized before making API calls
   */
  private safeEnsureClient(): boolean {
    try {
      this.alpacaClient.ensureClient();
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get account information with proper error handling
   */
  private async getAccount(req: Request, res: Response): Promise<void> {
    try {
      if (!this.safeEnsureClient()) {
        res.status(400).json({
          success: false,
          message: 'Alpaca client not connected. Please connect first.'
        });
        return;
      }
      
      const account = await this.alpacaClient.getAccount();
      
      res.json({
        success: true,
        data: account
      });
    } catch (error) {
      console.error('❌ Error getting account:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to get account information'
      });
    }
  }

  /**
   * Get positions with proper error handling
   */
  private async getPositions(req: Request, res: Response): Promise<void> {
    try {
      if (!this.safeEnsureClient()) {
        res.status(400).json({
          success: false,
          message: 'Alpaca client not connected. Please connect first.'
        });
        return;
      }
      
      const positions = await this.alpacaClient.getPositions();
      
      res.json({
        success: true,
        data: positions
      });
    } catch (error) {
      console.error('❌ Error getting positions:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to get positions'
      });
    }
  }

  /**
   * Get market status with proper error handling
   */
  private async getMarketStatus(req: Request, res: Response): Promise<void> {
    try {
      if (!this.safeEnsureClient()) {
        res.status(400).json({
          success: false,
          message: 'Alpaca client not connected. Please connect first.'
        });
        return;
      }
      
      const clock = await this.alpacaClient.getClock();
      
      res.json({
        success: true,
        data: clock
      });
    } catch (error) {
      console.error('❌ Error getting market status:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to get market status'
      });
    }
  }

  /**
   * Get orders with proper error handling
   */
  private async getOrders(req: Request, res: Response): Promise<void> {
    try {
      if (!this.safeEnsureClient()) {
        res.status(400).json({
          success: false,
          message: 'Alpaca client not connected. Please connect first.'
        });
        return;
      }
      
      const orders = await this.alpacaClient.getOrders();
      
      res.json({
        success: true,
        data: orders
      });
    } catch (error) {
      console.error('❌ Error getting orders:', error);
      res.status(500).json(createServerError(error instanceof Error ? error.message : 'Unknown error', error));
    }
  }

  /**
   * Get assets with proper error handling
   */
  private async getAssets(req: Request, res: Response): Promise<void> {
    try {
      if (!this.safeEnsureClient()) {
        res.status(400).json({
          success: false,
          message: 'Alpaca client not connected. Please connect first.'
        });
        return;
      }
      
      const assets = await this.alpacaClient.getAssets();
      
      res.json({
        success: true,
        data: assets
      });
    } catch (error) {
      console.error('❌ Error getting assets:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to get assets'
      });
    }
  }

  /**
   * Get market data for a symbol with improved error handling
   */
  private async getMarketData(req: Request, res: Response): Promise<void> {
    try {
      if (!this.safeEnsureClient()) {
        res.status(400).json({
          success: false,
          message: 'Alpaca client not connected. Please connect first.'
        });
        return;
      }
      
      const { symbol } = req.params;
      
      if (!symbol) {
        res.status(400).json({
          success: false,
          message: 'Symbol is required'
        });
        return;
      }
      
      console.log(`📊 Fetching market data for symbol: ${symbol}`);
      
      // Check if symbol is crypto (contains '/')
      const isCrypto = symbol.includes('/');
      
      try {
        let marketData;
        
        if (isCrypto) {
          console.log(`🪙 Processing crypto symbol: ${symbol}`);
          // For crypto symbols
          const snapshots = await this.alpacaClient.getCryptoSnapshots([symbol]);
          marketData = {
            symbol,
            snapshots: snapshots.snapshots || {},
            isCrypto: true,
            timestamp: new Date().toISOString()
          };
        } else {
          console.log(`📈 Processing stock symbol: ${symbol}`);
          // For stock symbols
          try {
            // Use Promise.allSettled to handle partial failures gracefully
            const [barResult, quoteResult] = await Promise.allSettled([
              this.alpacaClient.getStocksBarsLatest([symbol]),
              this.alpacaClient.getStocksQuotesLatest([symbol])
            ]);
            
            // Extract data or provide empty objects for failures
            const barData = barResult.status === 'fulfilled' ? barResult.value : { bars: {} };
            const quoteData = quoteResult.status === 'fulfilled' ? quoteResult.value : { quotes: {} };
            
            // Log any failures for debugging
            if (barResult.status === 'rejected') {
              console.log(`⚠️  Failed to get bars for ${symbol}:`, barResult.reason?.message || 'Unknown error');
            }
            if (quoteResult.status === 'rejected') {
              console.log(`⚠️  Failed to get quotes for ${symbol}:`, quoteResult.reason?.message || 'Unknown error');
            }
            
            marketData = {
              symbol,
              bars: barData.bars || {},
              quotes: quoteData.quotes || {},
              isCrypto: false,
              timestamp: new Date().toISOString(),
              // Add status information to help with debugging
              dataStatus: {
                barsAvailable: barResult.status === 'fulfilled',
                quotesAvailable: quoteResult.status === 'fulfilled'
              }
            };
          } catch (fetchError) {
            console.warn(`⚠️  Fallback error handling for ${symbol}:`, fetchError);
            // Provide empty data structure if everything fails
            marketData = {
              symbol,
              bars: {},
              quotes: {},
              isCrypto: false,
              timestamp: new Date().toISOString(),
              dataStatus: {
                barsAvailable: false,
                quotesAvailable: false,
                error: fetchError instanceof Error ? fetchError.message : 'Unknown error'
              }
            };
          }
        }
        
        console.log(`✅ Successfully fetched market data for ${symbol}`);
        res.json({
          success: true,
          data: marketData
        });
      } catch (innerError) {
        console.error(`❌ Error processing market data for ${symbol}:`, innerError);
        res.status(500).json({
          success: false,
          message: `Error processing market data: ${innerError instanceof Error ? innerError.message : 'Unknown error'}`
        });
      }
    } catch (error) {
      console.error(`❌ Error getting market data for ${req.params.symbol}:`, error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to get market data'
      });
    }
  }

  /**
   * Handle price history for crypto symbols with slashes (e.g., BTC/USD)
   * @param req Request object
   * @param res Response object
   */
  private async getCryptoPriceHistory(req: Request, res: Response): Promise<void> {
    try {
      if (!this.safeEnsureClient()) {
        res.status(400).json({
          success: false,
          message: 'Alpaca client not connected. Please connect first.'
        });
        return;
      }
      
      const { base, quote } = req.params;
      const symbol = `${base}/${quote}`;
      const { timeframe = '1Day', start, end, limit = 100 } = req.query;
      
      if (!start) {
        res.status(400).json({
          success: false,
          message: 'Start date is required'
        });
        return;
      }
      
      console.log(`📊 Fetching crypto price history for ${symbol}`);
      
      try {
        const cryptoData = await this.alpacaClient.getCryptoBars(
          symbol,
          timeframe as string,
          start as string,
          end as string | undefined,
          limit ? parseInt(limit as string) : undefined
        );
        
        // Format the response to be consistent
        const barsData = {
          symbol,
          bars: cryptoData.bars || {},
          timeframe: timeframe as string,
          currency: 'USD',
          exchange: 'CRYPTO'
        };
        
        res.json({
          success: true,
          data: {
            symbol,
            timeframe,
            bars: barsData.bars,
            isCrypto: true
          }
        });
      } catch (innerError) {
        console.error(`❌ Error processing crypto price history for ${symbol}:`, innerError);
        res.status(500).json({
          success: false,
          message: `Error processing crypto price history: ${innerError instanceof Error ? innerError.message : 'Unknown error'}`
        });
      }
    } catch (error) {
      console.error(`❌ Error getting crypto price history for ${req.params.base}/${req.params.quote}:`, error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to get crypto price history'
      });
    }
  }

  /**
   * Get price history for a symbol with proper error handling
   * @param req Request object
   * @param res Response object
   */
  private async getPriceHistory(req: Request, res: Response): Promise<void> {
    try {
      if (!this.safeEnsureClient()) {
        res.status(400).json({
          success: false,
          message: 'Alpaca client not connected. Please connect first.'
        });
        return;
      }
      
      const { symbol } = req.params;
      const { timeframe = '1Day', start, end, limit = 100 } = req.query;
      
      if (!symbol) {
        res.status(400).json({
          success: false,
          message: 'Symbol is required'
        });
        return;
      }
      
      if (!start) {
        res.status(400).json({
          success: false,
          message: 'Start date is required'
        });
        return;
      }
      
      console.log(`📊 Fetching price history for ${symbol}`);
      
      // Check if symbol is crypto (contains '/')
      const isCrypto = symbol.includes('/');
      
      try {
        let barsData;
        
        if (isCrypto) {
          // For crypto symbols
          const cryptoData = await this.alpacaClient.getCryptoBars(
            symbol,
            timeframe as string,
            start as string,
            end as string | undefined,
            limit ? parseInt(limit as string) : undefined
          );
          
          // Format the response to be consistent
          barsData = {
            symbol,
            bars: cryptoData.bars || {},
            timeframe: timeframe as string,
            currency: 'USD',
            exchange: 'CRYPTO'
          };
        } else {
          // For stock symbols
          const stockData = await this.alpacaClient.getStockBars(
            symbol,
            timeframe as string,
            start as string,
            end as string | undefined,
            limit ? parseInt(limit as string) : undefined
          );
          
          // Format the response to be consistent
          barsData = {
            symbol,
            bars: stockData.bars || {},
            timeframe: timeframe as string,
            currency: 'USD',
            exchange: 'US'
          };
        }
        
        res.json({
          success: true,
          data: {
            symbol,
            timeframe,
            bars: barsData.bars,
            isCrypto
          }
        });
      } catch (innerError) {
        console.error(`❌ Error processing price history for ${symbol}:`, innerError);
        res.status(500).json({
          success: false,
          message: `Error processing price history: ${innerError instanceof Error ? innerError.message : 'Unknown error'}`
        });
      }
    } catch (error) {
      console.error(`❌ Error getting price history for ${req.params.symbol}:`, error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to get price history'
      });
    }
  }

  public getRouter(): Router {
    return this.router;
  }
}