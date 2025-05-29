/**
 * market-data-handler.ts
 * 
 * Handles market data WebSocket messages and subscriptions
 * Responsible for processing market data messages and managing subscriptions
 */

import WebSocket from 'ws';
import { logger } from '../../utils/logger.js';
import { AlpacaWebSocketManager, MarketDataSubscription } from './alpaca-websocket-manager.js';

/**
 * Handles market data WebSocket messages and subscriptions
 */
export class MarketDataHandler {
  private manager: AlpacaWebSocketManager;
  
  /**
   * Constructor
   * @param manager Reference to the parent WebSocket manager
   */
  constructor(manager: AlpacaWebSocketManager) {
    this.manager = manager;
  }
  
  /**
   * Handle incoming market data messages
   * @param data Raw WebSocket message data
   */
  public handleMessage(data: WebSocket.Data): void {
    try {
      const messages = JSON.parse(data.toString());
      const msgArray = Array.isArray(messages) ? messages : [messages];
      
      msgArray.forEach(msg => {
        this.processMessage(msg);
      });
    } catch (error) {
      logger.error('MarketDataHandler: Error parsing message', error);
    }
  }
  
  /**
   * Process a single market data message
   * @param msg Parsed message object
   */
  private processMessage(msg: any): void {
    // Handle different message types based on the 'T' field
    switch (msg.T) {
      case 'success':
        if (msg.msg === 'authenticated') {
          logger.info('MarketDataHandler: Authenticated successfully');
          this.manager.emit('marketData:authenticated');
          
          // Resubscribe to previous subscriptions if any
          this.resubscribeToAll();
        } else if (msg.msg === 'connected') {
          logger.info('MarketDataHandler: Connected successfully');
        }
        break;
        
      case 'subscription':
        logger.info(`MarketDataHandler: Subscription confirmed: ${JSON.stringify(msg.trades || [])} ${JSON.stringify(msg.quotes || [])}`);
        this.manager.emit('marketData:subscribed', msg);
        break;
        
      case 'error':
        logger.error(`MarketDataHandler: Error from server: ${msg.msg}`);
        this.manager.emit('marketData:error', msg);
        break;
        
      // Trade message
      case 't':
        this.handleTradeMessage(msg);
        break;
        
      // Quote message
      case 'q':
        this.handleQuoteMessage(msg);
        break;
        
      // Bar message
      case 'b':
        this.handleBarMessage(msg);
        break;
        
      // Updated bar message
      case 'u':
        this.handleUpdatedBarMessage(msg);
        break;
        
      // Daily bar message
      case 'd':
        this.handleDailyBarMessage(msg);
        break;
        
      // Status message
      case 's':
        this.handleStatusMessage(msg);
        break;
        
      // LULD message (Limit Up Limit Down)
      case 'l':
        this.handleLuldMessage(msg);
        break;
        
      // Cancel error message
      case 'x':
        this.handleCancelErrorMessage(msg);
        break;
        
      // Correction message
      case 'c':
        this.handleCorrectionMessage(msg);
        break;
        
      default:
        logger.debug(`MarketDataHandler: Unknown message type: ${msg.T}`, msg);
        break;
    }
  }
  
  /**
   * Handle trade message
   * @param msg Trade message
   */
  private handleTradeMessage(msg: any): void {
    const tradeData = {
      symbol: msg.S,
      price: parseFloat(msg.p),
      size: parseInt(msg.s),
      timestamp: new Date(msg.t),
      exchange: msg.x,
      id: msg.i,
      tape: msg.z
    };
    
    // Emit trade event
    this.manager.emit('trade', tradeData);
    this.manager.emit(`trade:${msg.S}`, tradeData);
  }
  
  /**
   * Handle quote message
   * @param msg Quote message
   */
  private handleQuoteMessage(msg: any): void {
    const quoteData = {
      symbol: msg.S,
      askPrice: parseFloat(msg.ap),
      askSize: parseInt(msg.as),
      bidPrice: parseFloat(msg.bp),
      bidSize: parseInt(msg.bs),
      timestamp: new Date(msg.t),
      exchange: msg.x,
      tape: msg.z
    };
    
    // Emit quote event
    this.manager.emit('quote', quoteData);
    this.manager.emit(`quote:${msg.S}`, quoteData);
  }
  
  /**
   * Handle bar message
   * @param msg Bar message
   */
  private handleBarMessage(msg: any): void {
    const barData = {
      symbol: msg.S,
      open: parseFloat(msg.o),
      high: parseFloat(msg.h),
      low: parseFloat(msg.l),
      close: parseFloat(msg.c),
      volume: parseInt(msg.v),
      timestamp: new Date(msg.t),
      vwap: parseFloat(msg.vw)
    };
    
    // Emit bar event
    this.manager.emit('bar', barData);
    this.manager.emit(`bar:${msg.S}`, barData);
  }
  
  /**
   * Handle updated bar message
   * @param msg Updated bar message
   */
  private handleUpdatedBarMessage(msg: any): void {
    const updatedBarData = {
      symbol: msg.S,
      open: parseFloat(msg.o),
      high: parseFloat(msg.h),
      low: parseFloat(msg.l),
      close: parseFloat(msg.c),
      volume: parseInt(msg.v),
      timestamp: new Date(msg.t),
      vwap: parseFloat(msg.vw)
    };
    
    // Emit updated bar event
    this.manager.emit('updatedBar', updatedBarData);
    this.manager.emit(`updatedBar:${msg.S}`, updatedBarData);
  }
  
  /**
   * Handle daily bar message
   * @param msg Daily bar message
   */
  private handleDailyBarMessage(msg: any): void {
    const dailyBarData = {
      symbol: msg.S,
      open: parseFloat(msg.o),
      high: parseFloat(msg.h),
      low: parseFloat(msg.l),
      close: parseFloat(msg.c),
      volume: parseInt(msg.v),
      timestamp: new Date(msg.t),
      vwap: parseFloat(msg.vw)
    };
    
    // Emit daily bar event
    this.manager.emit('dailyBar', dailyBarData);
    this.manager.emit(`dailyBar:${msg.S}`, dailyBarData);
  }
  
  /**
   * Handle status message
   * @param msg Status message
   */
  private handleStatusMessage(msg: any): void {
    const statusData = {
      symbol: msg.S,
      statusCode: msg.sc,
      statusMessage: msg.sm,
      tradeTimestamp: new Date(msg.t),
      receiveTimestamp: new Date(msg.r),
      tape: msg.z
    };
    
    // Emit status event
    this.manager.emit('status', statusData);
    this.manager.emit(`status:${msg.S}`, statusData);
  }
  
  /**
   * Handle LULD message
   * @param msg LULD message
   */
  private handleLuldMessage(msg: any): void {
    const luldData = {
      symbol: msg.S,
      limitUpPrice: parseFloat(msg.u),
      limitDownPrice: parseFloat(msg.d),
      timestamp: new Date(msg.t),
      indicator: msg.i,
      tape: msg.z
    };
    
    // Emit LULD event
    this.manager.emit('luld', luldData);
    this.manager.emit(`luld:${msg.S}`, luldData);
  }
  
  /**
   * Handle cancel error message
   * @param msg Cancel error message
   */
  private handleCancelErrorMessage(msg: any): void {
    const cancelErrorData = {
      symbol: msg.S,
      id: msg.i,
      timestamp: new Date(msg.t),
      reason: msg.r,
      tape: msg.z
    };
    
    // Emit cancel error event
    this.manager.emit('cancelError', cancelErrorData);
    this.manager.emit(`cancelError:${msg.S}`, cancelErrorData);
  }
  
  /**
   * Handle correction message
   * @param msg Correction message
   */
  private handleCorrectionMessage(msg: any): void {
    const correctionData = {
      symbol: msg.S,
      originalId: msg.oi,
      correctedId: msg.ci,
      originalPrice: parseFloat(msg.op),
      correctedPrice: parseFloat(msg.cp),
      originalSize: parseInt(msg.os),
      correctedSize: parseInt(msg.cs),
      timestamp: new Date(msg.t),
      tape: msg.z
    };
    
    // Emit correction event
    this.manager.emit('correction', correctionData);
    this.manager.emit(`correction:${msg.S}`, correctionData);
  }
  
  /**
   * Subscribe to market data for specific symbols
   * @param symbols Array of symbols to subscribe to
   * @param channels Array of channels to subscribe to
   */
  public subscribeToMarketData(symbols: string[], channels: (keyof MarketDataSubscription)[] = ['trades', 'quotes']): void {
    if (!symbols || symbols.length === 0) {
      logger.warn('MarketDataHandler: No symbols provided for subscription');
      return;
    }
    
    if (!channels || channels.length === 0) {
      logger.warn('MarketDataHandler: No channels provided for subscription');
      return;
    }
    
    // Add symbols to subscriptions
    const subscriptions = this.manager.getSubscriptions();
    channels.forEach(channel => {
      symbols.forEach(symbol => {
        subscriptions[channel].add(symbol);
      });
    });
    
    // Only send subscription message if connected
    if (this.manager.isConnected('marketData')) {
      this.sendSubscriptionMessage(symbols, channels, 'subscribe');
    } else {
      logger.warn('MarketDataHandler: Not connected to market data WebSocket, subscription will be sent when connected');
    }
  }
  
  /**
   * Unsubscribe from market data for specific symbols
   * @param symbols Array of symbols to unsubscribe from
   * @param channels Optional array of channels to unsubscribe from (defaults to all channels)
   */
  public unsubscribeFromMarketData(symbols: string[], channels?: (keyof MarketDataSubscription)[]): void {
    if (!symbols || symbols.length === 0) {
      logger.warn('MarketDataHandler: No symbols provided for unsubscription');
      return;
    }
    
    const subscriptions = this.manager.getSubscriptions();
    const channelsToUse = channels || Object.keys(subscriptions) as (keyof MarketDataSubscription)[];
    
    // Remove symbols from subscriptions
    channelsToUse.forEach(channel => {
      symbols.forEach(symbol => {
        subscriptions[channel].delete(symbol);
      });
    });
    
    // Only send unsubscription message if connected
    if (this.manager.isConnected('marketData')) {
      this.sendSubscriptionMessage(symbols, channelsToUse, 'unsubscribe');
    }
  }
  
  /**
   * Resubscribe to all previous subscriptions
   * Called after reconnection
   */
  public resubscribeToAll(): void {
    const subscriptions = this.manager.getSubscriptions();
    
    // Get all unique symbols across all channels
    const symbolsByChannel: Record<string, string[]> = {};
    
    // Group symbols by channel
    Object.keys(subscriptions).forEach(channelKey => {
      const channel = channelKey as keyof MarketDataSubscription;
      const symbols = Array.from(subscriptions[channel]);
      
      if (symbols.length > 0) {
        symbolsByChannel[channelKey] = symbols;
      }
    });
    
    // Send subscription messages for each channel
    if (Object.keys(symbolsByChannel).length > 0) {
      logger.info('MarketDataHandler: Resubscribing to previous subscriptions');
      
      const subscriptionMsg: any = {
        action: 'subscribe'
      };
      
      // Add symbols for each channel
      Object.keys(symbolsByChannel).forEach(channelKey => {
        subscriptionMsg[channelKey] = symbolsByChannel[channelKey];
      });
      
      // Send subscription message
      const ws = this.manager.getMarketDataWs();
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(subscriptionMsg));
      }
    }
  }
  
  /**
   * Send subscription or unsubscription message
   * @param symbols Array of symbols
   * @param channels Array of channels
   * @param action 'subscribe' or 'unsubscribe'
   */
  private sendSubscriptionMessage(symbols: string[], channels: (keyof MarketDataSubscription)[], action: 'subscribe' | 'unsubscribe'): void {
    const ws = this.manager.getMarketDataWs();
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      logger.warn(`MarketDataHandler: Cannot ${action}, WebSocket not connected`);
      return;
    }
    
    const subscriptionMsg: any = {
      action
    };
    
    // Add symbols for each channel
    channels.forEach(channel => {
      subscriptionMsg[channel] = symbols;
    });
    
    // Send subscription message
    ws.send(JSON.stringify(subscriptionMsg));
    logger.info(`MarketDataHandler: Sent ${action} message for ${symbols.join(', ')} on channels ${channels.join(', ')}`);
  }
}
