/**
 * trading-events-handler.ts
 * 
 * Handles trading events WebSocket messages and subscriptions
 * Responsible for processing order updates and position changes
 */

import WebSocket from 'ws';
import { logger } from '../../utils/logger.js';
import { AlpacaWebSocketManager } from './alpaca-websocket-manager.js';

/**
 * Handles trading events WebSocket messages and subscriptions
 */
export class TradingEventsHandler {
  private manager: AlpacaWebSocketManager;
  
  /**
   * Constructor
   * @param manager Reference to the parent WebSocket manager
   */
  constructor(manager: AlpacaWebSocketManager) {
    this.manager = manager;
  }
  
  /**
   * Handle incoming trading events messages
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
      logger.error('TradingEventsHandler: Error parsing message', error);
    }
  }
  
  /**
   * Process a single trading events message
   * @param msg Parsed message object
   */
  private processMessage(msg: any): void {
    const streamType = msg.stream;
    const msgType = msg.data?.msg_type;
    
    // Handle authentication response
    if (streamType === 'authorization' || msgType === 'authorization' || msg.T === 'success') {
      if ((msg.data?.status === 'authorized') || (msg.T === 'success' && msg.msg === 'authenticated')) {
        logger.info('TradingEventsHandler: Authenticated successfully');
        this.manager.emit('tradingEvents:authenticated');
        
        // Subscribe to trading updates
        this.subscribeToTradingUpdates();
      } else {
        logger.error('TradingEventsHandler: Authentication failed', msg);
        this.manager.emit('tradingEvents:authError', msg);
      }
      return;
    }
    
    // Handle subscription confirmation
    if (streamType === 'listening' || msgType === 'listening') {
      logger.info(`TradingEventsHandler: Subscribed to streams: ${JSON.stringify(msg.data?.streams || [])}`);
      this.manager.emit('tradingEvents:subscribed', msg.data?.streams);
      return;
    }
    
    // Handle trading events
    if (streamType === 'trade_updates') {
      this.handleOrderEvent(msg.data);
    }
  }
  
  /**
   * Handle order event
   * @param eventData Order event data
   */
  private handleOrderEvent(eventData: any): void {
    if (!eventData) {
      logger.warn('TradingEventsHandler: Received empty order event data');
      return;
    }
    
    const eventType = eventData.event;
    const order = eventData.order;
    
    if (!eventType || !order) {
      logger.warn('TradingEventsHandler: Received malformed order event', eventData);
      return;
    }
    
    // Standardize the order data
    const orderData = {
      id: order.id,
      clientOrderId: order.client_order_id,
      createdAt: new Date(order.created_at),
      updatedAt: new Date(order.updated_at),
      submittedAt: order.submitted_at ? new Date(order.submitted_at) : null,
      filledAt: order.filled_at ? new Date(order.filled_at) : null,
      expiredAt: order.expired_at ? new Date(order.expired_at) : null,
      canceledAt: order.canceled_at ? new Date(order.canceled_at) : null,
      failedAt: order.failed_at ? new Date(order.failed_at) : null,
      replacedAt: order.replaced_at ? new Date(order.replaced_at) : null,
      replacedBy: order.replaced_by,
      replaces: order.replaces,
      assetId: order.asset_id,
      symbol: order.symbol,
      assetClass: order.asset_class,
      qty: parseFloat(order.qty),
      filledQty: parseFloat(order.filled_qty),
      type: order.type,
      side: order.side,
      timeInForce: order.time_in_force,
      limitPrice: order.limit_price ? parseFloat(order.limit_price) : null,
      stopPrice: order.stop_price ? parseFloat(order.stop_price) : null,
      filledAvgPrice: order.filled_avg_price ? parseFloat(order.filled_avg_price) : null,
      status: order.status,
      extendedHours: order.extended_hours,
      legs: order.legs || [],
      trailPercent: order.trail_percent ? parseFloat(order.trail_percent) : null,
      trailPrice: order.trail_price ? parseFloat(order.trail_price) : null,
      hwm: order.hwm ? parseFloat(order.hwm) : null
    };
    
    // Additional event-specific data
    const eventSpecificData: any = {};
    
    // Add event-specific data based on event type
    switch (eventType) {
      case 'fill':
      case 'partial_fill':
        eventSpecificData.price = eventData.price ? parseFloat(eventData.price) : null;
        eventSpecificData.qty = eventData.qty ? parseFloat(eventData.qty) : null;
        eventSpecificData.positionQty = eventData.position_qty ? parseFloat(eventData.position_qty) : null;
        eventSpecificData.timestamp = eventData.timestamp ? new Date(eventData.timestamp) : null;
        break;
        
      case 'rejected':
        eventSpecificData.reason = order.reason || 'Unknown';
        break;
        
      case 'canceled':
        eventSpecificData.timestamp = eventData.timestamp || order.canceled_at ? new Date(eventData.timestamp || order.canceled_at) : null;
        break;
    }
    
    // Emit general order event
    this.manager.emit('orderUpdate', { 
      event: eventType, 
      order: orderData,
      ...eventSpecificData
    });
    
    // Emit specific event type
    this.manager.emit(`order:${eventType}`, { 
      order: orderData,
      ...eventSpecificData
    });
    
    // Emit symbol-specific event
    if (order.symbol) {
      this.manager.emit(`order:${order.symbol}`, { 
        event: eventType, 
        order: orderData,
        ...eventSpecificData
      });
    }
    
    // Log the event
    switch (eventType) {
      case 'new':
        logger.info(`Order Created: ${order.symbol} - ${order.side} ${order.qty} @ ${order.type}`);
        break;
        
      case 'fill':
        logger.info(`Order Filled: ${order.symbol} - ${eventData.qty} shares @ $${eventData.price}`);
        break;
        
      case 'partial_fill':
        logger.info(`Order Partially Filled: ${order.symbol} - ${eventData.qty}/${order.qty} shares @ $${eventData.price}`);
        break;
        
      case 'canceled':
        logger.info(`Order Canceled: ${order.symbol}`);
        break;
        
      case 'rejected':
        logger.warn(`Order Rejected: ${order.symbol} - Reason: ${order.reason || 'Unknown'}`);
        break;
        
      case 'replaced':
        logger.info(`Order Replaced: ${order.symbol}`);
        break;
        
      case 'pending_new':
        logger.info(`Order Pending: ${order.symbol}`);
        break;
        
      case 'stopped':
        logger.info(`Order Stopped: ${order.symbol}`);
        break;
        
      case 'suspended':
        logger.info(`Order Suspended: ${order.symbol}`);
        break;
        
      case 'calculated':
        logger.info(`Order Calculated: ${order.symbol}`);
        break;
        
      case 'expired':
        logger.info(`Order Expired: ${order.symbol}`);
        break;
        
      default:
        logger.info(`Order Event: ${eventType} for ${order.symbol}`);
        break;
    }
  }
  
  /**
   * Subscribe to trading updates
   */
  public subscribeToTradingUpdates(): void {
    const ws = this.manager.getTradingEventsWs();
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      logger.warn('TradingEventsHandler: Cannot subscribe, WebSocket not connected');
      return;
    }
    
    const subscribeMessage = {
      action: 'listen',
      data: {
        streams: ['trade_updates']
      }
    };
    
    ws.send(JSON.stringify(subscribeMessage));
    logger.info('TradingEventsHandler: Subscribed to trade_updates stream');
  }
}
