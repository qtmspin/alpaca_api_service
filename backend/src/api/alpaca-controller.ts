/**
 * alpaca-controller.ts
 * Controller for Alpaca API specific operations
 * Location: backend/src/api/alpaca-controller.ts
 */

import { Router, Request, Response } from 'express';
import { AlpacaClient } from '../services/alpaca-client.js';
import { createServerError } from '../core/errors.js';
import WebSocket from 'ws';

// Declare global WebSocket server
declare global {
  var wss: any | undefined;
}

/**
 * AlpacaController
 * Handles Alpaca API specific operations
 * Location: backend/src/api/alpaca-controller.ts
 * 
 * Responsibilities:
 * - Provide endpoints for Alpaca API operations
 * - Handle connection to Alpaca API
 * - Broadcast connection status updates via WebSocket
 */

export class AlpacaController {
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
    
    // Initialize WebSocket handlers if WebSocket server is available
    if (global.wss) {
      this.initializeWebSocketHandlers();
    }
  }

  /**
   * Initialize WebSocket handlers for market data subscriptions
   */
  private initializeWebSocketHandlers(): void {
    if (!global.wss) return;
    
    global.wss.on('connection', (ws: WebSocket) => {
      console.log('New WebSocket client connected');
      
      // Send initial connection status
      const initialStatus = {
        type: 'status',
        payload: {
          alpaca: {
            connected: this.alpacaClient.isInitialized(),
            authenticated: this.alpacaClient.isInitialized(),
            lastUpdated: new Date().toISOString()
          },
          client: {
            connected: true,
            lastUpdated: new Date().toISOString()
          }
        }
      };
      
      ws.send(JSON.stringify(initialStatus));
      
      // Handle client messages
      ws.on('message', async (message: string) => {
        try {
          const data = JSON.parse(message.toString());
          console.log('Received WebSocket message:', data);
          
          // Handle subscription requests
          if (data.action === 'subscribe') {
            await this.handleSubscription(ws, data);
          }
          
          // Handle unsubscription requests
          if (data.action === 'unsubscribe') {
            // Store unsubscription info on the WebSocket client
            (ws as any).unsubscribed = {
              ...(ws as any).unsubscribed || {},
              channels: data.channels || [],
              symbols: data.symbols || []
            };
            
            ws.send(JSON.stringify({
              type: 'subscription_update',
              message: 'Unsubscribed successfully',
              channels: data.channels,
              symbols: data.symbols
            }));
          }
        } catch (error) {
          console.error('Error handling WebSocket message:', error);
          ws.send(JSON.stringify({
            type: 'error',
            message: error instanceof Error ? error.message : 'Invalid message format'
          }));
        }
      });
      
      // Handle client disconnect
      ws.on('close', () => {
        console.log('WebSocket client disconnected');
      });
    });
  }

  /**
   * Handle subscription requests from WebSocket clients
   */
  private async handleSubscription(ws: WebSocket, data: any): Promise<void> {
    try {
      // Ensure client is initialized
      this.alpacaClient.ensureClient();
      
      // Store subscription info on the WebSocket client
      (ws as any).subscribed = {
        ...(ws as any).subscribed || {},
        channels: data.channels || [],
        symbols: data.symbols || []
      };
      
      // If market data channel is requested, set up initial data
      if (data.channels.includes('market_data') && data.symbols && data.symbols.length > 0) {
        // Fetch initial data for all symbols
        for (const symbol of data.symbols) {
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
            } else {
              // Handle stock symbols
              const [barData, quoteData, assetData] = await Promise.all([
                this.alpacaClient.getStocksBarsLatest([symbol]),
                this.alpacaClient.getStocksQuotesLatest([symbol]),
                this.alpacaClient.getAsset(symbol)
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
            
            // Send initial market data to the client
            ws.send(JSON.stringify({
              type: 'market_data',
              payload: marketData
            }));
            
            // Start live price updates for this symbol
            this.startLivePriceUpdates(symbol, ws);
            
          } catch (error) {
            console.error(`Error fetching initial market data for ${symbol}:`, error);
          }
        }
      }
      
      // Confirm subscription
      ws.send(JSON.stringify({
        type: 'subscription_update',
        message: 'Subscribed successfully',
        channels: data.channels,
        symbols: data.symbols
      }));
    } catch (error) {
      console.error('Error handling subscription:', error);
      ws.send(JSON.stringify({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to process subscription'
      }));
    }
  }

  /**
   * Start live price updates for a symbol
   */
  private startLivePriceUpdates(symbol: string, ws: WebSocket): void {
    // Check if client is still subscribed to this symbol
    const isSubscribed = () => {
      const subscribed = (ws as any).subscribed;
      return subscribed && subscribed.symbols && subscribed.symbols.includes(symbol);
    };

    // Set up periodic price updates (every 5 seconds)
    const updateInterval = setInterval(async () => {
      if (!isSubscribed() || ws.readyState !== WebSocket.OPEN) {
        clearInterval(updateInterval);
        return;
      }

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
        } else {
          const [barData, quoteData] = await Promise.all([
            this.alpacaClient.getStocksBarsLatest([symbol]),
            this.alpacaClient.getStocksQuotesLatest([symbol])
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

        // Send updated market data
        ws.send(JSON.stringify({
          type: 'market_data_update',
          payload: marketData
        }));

      } catch (error) {
        console.error(`Error updating live price for ${symbol}:`, error);
      }
    }, 5000); // Update every 5 seconds
  }

  /**
   * Connect to Alpaca API
   */
  private async connect(req: Request, res: Response): Promise<void> {
    try {
      await this.alpacaClient.initClient();
      
      // Broadcast connection status update via WebSocket if available
      if (global.wss) {
        const statusUpdate = {
          type: 'status',
          payload: {
            alpaca: {
              connected: true,
              authenticated: true,
              lastUpdated: new Date().toISOString()
            },
            client: {
              connected: true,
              lastUpdated: new Date().toISOString()
            }
          }
        };
        
        global.wss.clients.forEach((client: any) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(statusUpdate));
          }
        });
      }
      
      res.status(200).json({ 
        success: true, 
        message: 'Successfully connected to Alpaca API',
        connected: true
      });
    } catch (error) {
      console.error('Error connecting to Alpaca API:', error);
      
      // Broadcast connection failure status via WebSocket if available
      if (global.wss) {
        const statusUpdate = {
          type: 'status',
          payload: {
            alpaca: {
              connected: false,
              authenticated: false,
              lastUpdated: new Date().toISOString()
            }
          }
        };
        
        global.wss.clients.forEach((client: any) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(statusUpdate));
          }
        });
      }
      
      res.status(500).json({ 
        success: false, 
        message: error instanceof Error ? error.message : 'Failed to connect to Alpaca API',
        connected: false
      });
    }
  }

  private async getAccount(req: Request, res: Response): Promise<void> {
    try {
      this.alpacaClient.ensureClient();
      const account = await this.alpacaClient.getAccount();
      res.status(200).json({
        success: true,
        data: {
          buying_power: account.buying_power,
          cash: account.cash,
          portfolio_value: account.portfolio_value,
          equity: account.equity,
          last_equity: account.last_equity,
          status: account.status
        }
      });
    } catch (error) {
      console.error('Error getting account info:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to get account info'
      });
    }
  }

  private async getPositions(req: Request, res: Response): Promise<void> {
    try {
      this.alpacaClient.ensureClient();
      const positions = await this.alpacaClient.getPositions();
      res.status(200).json({
        success: true,
        data: positions.map((p: any) => ({
          symbol: p.symbol,
          qty: p.qty,
          market_value: p.market_value,
          current_price: p.current_price,
          cost_basis: p.cost_basis,
          unrealized_pl: p.unrealized_pl
        }))
      });
    } catch (error) {
      console.error('Error getting positions:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to get positions'
      });
    }
  }

  private async getMarketStatus(req: Request, res: Response): Promise<void> {
    try {
      this.alpacaClient.ensureClient();
      const clock = await this.alpacaClient.getClock();
      res.status(200).json({
        success: true,
        data: {
          is_open: clock.is_open,
          next_open: clock.next_open,
          next_close: clock.next_close
        }
      });
    } catch (error) {
      console.error('Error getting market status:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to get market status'
      });
    }
  }

  private async getOrders(req: Request, res: Response): Promise<void> {
    try {
      this.alpacaClient.ensureClient();
      const orders = await this.alpacaClient.getOrders();
      res.status(200).json({
        success: true,
        data: orders
      });
    } catch (error) {
      console.error('Error getting orders:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to get orders'
      });
    }
  }

  private async getAssets(req: Request, res: Response): Promise<void> {
    try {
      this.alpacaClient.ensureClient();
      const query = req.query.status ? { status: req.query.status } : {};
      const assets = await this.alpacaClient.getAssets(query);
      res.status(200).json({
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
          // For crypto symbols, use crypto snapshots
          const snapshots = await this.alpacaClient.getCryptoSnapshots([symbol]);
          
          marketData = {
            symbol,
            bar: snapshots.snapshots?.[symbol]?.latestBar || null,
            quote: snapshots.snapshots?.[symbol]?.latestQuote || null,
            asset: null,
            isCrypto: true,
            timestamp: new Date().toISOString()
          };
        } else {
          // For stock symbols, use stock-specific methods
          const [barData, quoteData, assetData] = await Promise.all([
            this.alpacaClient.getStocksBarsLatest([symbol]).catch(err => {
              console.log(`Error fetching stock bars for ${symbol}:`, err.message);
              return { bars: {} };
            }),
            this.alpacaClient.getStocksQuotesLatest([symbol]).catch(err => {
              console.log(`Error fetching stock quotes for ${symbol}:`, err.message);
              return { quotes: {} };
            }),
            this.alpacaClient.getAsset(symbol).catch(err => {
              console.log(`Error fetching asset for ${symbol}:`, err.message);
              return null;
            })
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
      
        // Broadcast market data via WebSocket if available
        if (global.wss) {
          const marketDataUpdate = {
            type: 'market_data',
            payload: marketData
          };
          
          global.wss.clients.forEach((client: any) => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify(marketDataUpdate));
            }
          });
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
   * Get price history for a symbol
   * @param req Request object
   * @param res Response object
   */
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
        // For crypto symbols
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