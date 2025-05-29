/**
 * alpaca-rest-controller.ts
 * 
 * This file handles REST API endpoints for Alpaca API operations.
 * Location: backend/src/api/alpaca-rest-controller.ts
 * 
 * Responsibilities:
 * - Provide REST API endpoints for Alpaca API operations
 * - Handle connection to Alpaca API
 * - Process market data and account information requests
 */

import { Router, Request, Response } from 'express';
import { AlpacaClient } from '../services/alpaca-client.js';
import { createServerError } from '../core/errors.js';

/**
 * AlpacaRestController
 * Handles Alpaca API REST endpoints
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
   * Connect to Alpaca API
   */
  private async connect(req: Request, res: Response): Promise<void> {
    try {
      // Get API credentials from request body
      const { apiKey, secretKey, isPaper = true } = req.body;
      
      if (!apiKey || !secretKey) {
        res.status(400).json({
          success: false,
          message: 'API key and secret key are required'
        });
        return;
      }
      
      // Initialize Alpaca client with provided credentials
      try {
        await this.alpacaClient.initClient();
        
        // Get account info to verify connection
        const account = await this.alpacaClient.getAccount();
        
        res.json({
          success: true,
          message: 'Successfully connected to Alpaca API',
          data: {
            account,
            connected: true
          }
        });
      } catch (error) {
        console.error('Error connecting to Alpaca API:', error);
        res.status(500).json({
          success: false,
          message: error instanceof Error ? error.message : 'Failed to connect to Alpaca API'
        });
      }
    } catch (error) {
      console.error('Error in connect endpoint:', error);
      res.status(500).json(createServerError(error instanceof Error ? error.message : 'Unknown error', error));
    }
  }

  /**
   * Get account information
   */
  private async getAccount(req: Request, res: Response): Promise<void> {
    try {
      this.alpacaClient.ensureClient();
      const account = await this.alpacaClient.getAccount();
      
      res.json({
        success: true,
        data: account
      });
    } catch (error) {
      console.error('Error getting account:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to get account information'
      });
    }
  }

  /**
   * Get positions
   */
  private async getPositions(req: Request, res: Response): Promise<void> {
    try {
      this.alpacaClient.ensureClient();
      const positions = await this.alpacaClient.getPositions();
      
      res.json({
        success: true,
        data: positions
      });
    } catch (error) {
      console.error('Error getting positions:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to get positions'
      });
    }
  }

  /**
   * Get market status
   */
  private async getMarketStatus(req: Request, res: Response): Promise<void> {
    try {
      this.alpacaClient.ensureClient();
      const clock = await this.alpacaClient.getClock();
      
      res.json({
        success: true,
        data: clock
      });
    } catch (error) {
      console.error('Error getting market status:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to get market status'
      });
    }
  }

  /**
   * Get orders
   */
  private async getOrders(req: Request, res: Response): Promise<void> {
    try {
      this.alpacaClient.ensureClient();
      const orders = await this.alpacaClient.getOrders();
      
      res.json({
        success: true,
        data: orders
      });
    } catch (error) {
      console.error('Error getting orders:', error);
      res.status(500).json(createServerError(error instanceof Error ? error.message : 'Unknown error', error));
    }
  }

  /**
   * Get assets
   */
  private async getAssets(req: Request, res: Response): Promise<void> {
    try {
      this.alpacaClient.ensureClient();
      const assets = await this.alpacaClient.getAssets();
      
      res.json({
        success: true,
        data: assets
      });
    } catch (error) {
      console.error('Error getting assets:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to get assets'
      });
    }
  }

  /**
   * Get market data for a symbol
   */
  private async getMarketData(req: Request, res: Response): Promise<void> {
    try {
      this.alpacaClient.ensureClient();
      const { symbol } = req.params;
      
      if (!symbol) {
        res.status(400).json({
          success: false,
          message: 'Symbol is required'
        });
        return;
      }
      
      // Check if symbol is crypto (contains '/')
      const isCrypto = symbol.includes('/');
      
      try {
        let marketData;
        
        if (isCrypto) {
          // For crypto symbols
          const snapshots = await this.alpacaClient.getCryptoSnapshots([symbol]);
          marketData = {
            symbol,
            snapshots: snapshots.snapshots || {},
            isCrypto: true
          };
        } else {
          // For stock symbols
          try {
            // Use Promise.allSettled to handle partial failures
            const [barResult, quoteResult] = await Promise.allSettled([
              this.alpacaClient.getStocksBarsLatest([symbol]),
              this.alpacaClient.getStocksQuotesLatest([symbol])
            ]);
            
            // Extract data or provide empty objects for failures
            const barData = barResult.status === 'fulfilled' ? barResult.value : { bars: {} };
            const quoteData = quoteResult.status === 'fulfilled' ? quoteResult.value : { quotes: {} };
            
            marketData = {
              symbol,
              bars: barData.bars || {},
              quotes: quoteData.quotes || {},
              isCrypto: false,
              // Add status information to help with debugging
              dataStatus: {
                barsAvailable: barResult.status === 'fulfilled',
                quotesAvailable: quoteResult.status === 'fulfilled'
              }
            };
          } catch (fetchError) {
            console.warn(`Fallback error handling for ${symbol}:`, fetchError);
            // Provide empty data structure if everything fails
            marketData = {
              symbol,
              bars: {},
              quotes: {},
              isCrypto: false,
              dataStatus: {
                barsAvailable: false,
                quotesAvailable: false,
                error: fetchError instanceof Error ? fetchError.message : 'Unknown error'
              }
            };
          }
        }
        
        res.json({
          success: true,
          data: marketData
        });
      } catch (innerError) {
        console.error(`Error processing market data for ${symbol}:`, innerError);
        res.status(500).json({
          success: false,
          message: `Error processing market data: ${innerError instanceof Error ? innerError.message : 'Unknown error'}`
        });
      }
    } catch (error) {
      console.error(`Error getting market data for ${req.params.symbol}:`, error);
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
      this.alpacaClient.ensureClient();
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
        console.error(`Error processing crypto price history for ${symbol}:`, innerError);
        res.status(500).json({
          success: false,
          message: `Error processing crypto price history: ${innerError instanceof Error ? innerError.message : 'Unknown error'}`
        });
      }
    } catch (error) {
      console.error(`Error getting crypto price history for ${req.params.base}/${req.params.quote}:`, error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to get crypto price history'
      });
    }
  }

  /**
   * Get price history for a symbol
   * @param req Request object
   * @param res Response object
   */
  private async getPriceHistory(req: Request, res: Response): Promise<void> {
    try {
      this.alpacaClient.ensureClient();
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
        console.error(`Error processing price history for ${symbol}:`, innerError);
        res.status(500).json({
          success: false,
          message: `Error processing price history: ${innerError instanceof Error ? innerError.message : 'Unknown error'}`
        });
      }
    } catch (error) {
      console.error(`Error getting price history for ${req.params.symbol}:`, error);
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
