/**
 * alpaca-controller.ts
 * Controller for Alpaca API specific operations
 * Location: backend/src/api/alpaca-controller.ts
 */

import { Router, Request, Response } from 'express';
import { AlpacaClient } from '../services/alpaca-client';
import { createServerError } from '../core/errors';
import WebSocket from 'ws';

// Declare global WebSocket server
declare global {
  var wss: WebSocket.Server | undefined;
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
            // Get latest bar, quote, and asset info
            const [barData, quoteData, assetData] = await Promise.all([
              this.alpacaClient.getStocksBarsLatest([symbol]),
              this.alpacaClient.getStocksQuotesLatest([symbol]),
              this.alpacaClient.getAsset(symbol)
            ]);
            
            // Combine the data
            const marketData = {
              symbol,
              bar: barData[symbol] || null,
              quote: quoteData[symbol] || null,
              asset: assetData || null,
              timestamp: new Date().toISOString()
            };
            
            // Send initial market data to the client
            ws.send(JSON.stringify({
              type: 'market_data',
              payload: marketData
            }));
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
        
        global.wss.clients.forEach(client => {
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
        
        global.wss.clients.forEach(client => {
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
        let barData, quoteData, assetData;
        
        if (isCrypto) {
          // For crypto symbols, use crypto-specific methods
          [barData] = await Promise.all([
            this.alpacaClient.getCryptoBarsLatest([symbol]).catch(err => {
              console.log(`Error fetching crypto bars for ${symbol}:`, err.message);
              return { snapshots: {} };
            })
          ]);
          
          // Format the crypto data to match the expected structure
          const formattedBarData: any = {};
          if (barData.snapshots && barData.snapshots[symbol]) {
            const snapshot = barData.snapshots[symbol];
            formattedBarData[symbol] = {
              t: snapshot.updated_at,
              o: snapshot.bar?.o || 0,
              h: snapshot.bar?.h || 0,
              l: snapshot.bar?.l || 0,
              c: snapshot.bar?.c || 0,
              v: snapshot.bar?.v || 0
            };
          }
          
          barData = formattedBarData;
          quoteData = {}; // Crypto quotes not supported in the same way as stocks
          assetData = null; // No asset info for crypto
        } else {
          // For stock symbols, use stock-specific methods
          [barData, quoteData, assetData] = await Promise.all([
            this.alpacaClient.getStocksBarsLatest([symbol]).catch(err => {
              console.log(`Error fetching stock bars for ${symbol}:`, err.message);
              return {};
            }),
            this.alpacaClient.getStocksQuotesLatest([symbol]).catch(err => {
              console.log(`Error fetching stock quotes for ${symbol}:`, err.message);
              return {};
            }),
            this.alpacaClient.getAsset(symbol).catch(err => {
              console.log(`Error fetching asset for ${symbol}:`, err.message);
              return null;
            })
          ]);
        }
      
        // Combine the data
        const marketData = {
          symbol,
          bar: barData[symbol] || null,
          quote: quoteData[symbol] || null,
          asset: assetData || null,
          isCrypto,
          timestamp: new Date().toISOString()
        };
      
        // Broadcast market data via WebSocket if available
        if (global.wss) {
          const marketDataUpdate = {
            type: 'market_data',
            payload: marketData
          };
          
          global.wss.clients.forEach(client => {
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
            bars: cryptoData.bars?.[symbol] || [],
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
            bars: stockData.bars?.[symbol] || [],
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
            bars: barsData,
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
