/**
 * health-monitor.ts
 * 
 * Monitors the health of WebSocket connections
 * Implements periodic health checks and ping/pong mechanism
 */

import WebSocket from 'ws';
import { logger } from '../../utils/logger.js';
import { AlpacaWebSocketManager } from './alpaca-websocket-manager.js';

/**
 * Monitors the health of WebSocket connections
 */
export class HealthMonitor {
  private manager: AlpacaWebSocketManager;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private readonly HEALTH_CHECK_INTERVAL_MS = 30000; // 30 seconds
  private readonly PING_TIMEOUT_MS = 10000; // 10 seconds
  private marketDataPingTimeout: NodeJS.Timeout | null = null;
  private tradingEventsPingTimeout: NodeJS.Timeout | null = null;
  
  /**
   * Constructor
   * @param manager Reference to the parent WebSocket manager
   */
  constructor(manager: AlpacaWebSocketManager) {
    this.manager = manager;
  }
  
  /**
   * Start health monitoring
   */
  public startHealthMonitoring(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    
    this.healthCheckInterval = setInterval(() => {
      this.checkConnectionHealth();
    }, this.HEALTH_CHECK_INTERVAL_MS);
    
    logger.info('HealthMonitor: Started health monitoring');
  }
  
  /**
   * Stop health monitoring
   */
  public stopHealthMonitoring(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
    
    if (this.marketDataPingTimeout) {
      clearTimeout(this.marketDataPingTimeout);
      this.marketDataPingTimeout = null;
    }
    
    if (this.tradingEventsPingTimeout) {
      clearTimeout(this.tradingEventsPingTimeout);
      this.tradingEventsPingTimeout = null;
    }
    
    logger.info('HealthMonitor: Stopped health monitoring');
  }
  
  /**
   * Check the health of WebSocket connections
   */
  private checkConnectionHealth(): void {
    this.checkMarketDataHealth();
    this.checkTradingEventsHealth();
  }
  
  /**
   * Check the health of market data WebSocket
   */
  private checkMarketDataHealth(): void {
    const ws = this.manager.getMarketDataWs();
    
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      logger.warn('HealthMonitor: Market data WebSocket not connected');
      
      // Attempt to reconnect if not already reconnecting
      if (!this.manager.isConnected('marketData') && !this.manager.isInShutdown()) {
        logger.info('HealthMonitor: Triggering market data WebSocket reconnection');
        const connectionManager = (this.manager as any).connectionManager;
        if (connectionManager && typeof connectionManager.handleReconnect === 'function') {
          connectionManager.handleReconnect('marketData');
        }
      }
      return;
    }
    
    // Send ping to check if connection is alive
    try {
      // Clear any existing ping timeout
      if (this.marketDataPingTimeout) {
        clearTimeout(this.marketDataPingTimeout);
        this.marketDataPingTimeout = null;
      }
      
      // Set up pong listener for this ping
      const onPong = () => {
        // Connection is alive
        if (this.marketDataPingTimeout) {
          clearTimeout(this.marketDataPingTimeout);
          this.marketDataPingTimeout = null;
        }
        
        // Remove the pong listener to avoid memory leaks
        ws.removeListener('pong', onPong);
        
        logger.debug('HealthMonitor: Market data WebSocket is healthy');
      };
      
      // Listen for pong
      ws.on('pong', onPong);
      
      // Send ping
      ws.ping();
      
      // Set up timeout for pong response
      this.marketDataPingTimeout = setTimeout(() => {
        // No pong received within timeout
        logger.warn('HealthMonitor: Market data WebSocket ping timeout');
        
        // Remove the pong listener
        ws.removeListener('pong', onPong);
        
        // Terminate the connection to force reconnect
        ws.terminate();
      }, this.PING_TIMEOUT_MS);
    } catch (error) {
      logger.error('HealthMonitor: Error checking market data WebSocket health', error);
    }
  }
  
  /**
   * Check the health of trading events WebSocket
   */
  private checkTradingEventsHealth(): void {
    const ws = this.manager.getTradingEventsWs();
    
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      logger.warn('HealthMonitor: Trading events WebSocket not connected');
      
      // Attempt to reconnect if not already reconnecting
      if (!this.manager.isConnected('tradingEvents') && !this.manager.isInShutdown()) {
        logger.info('HealthMonitor: Triggering trading events WebSocket reconnection');
        const connectionManager = (this.manager as any).connectionManager;
        if (connectionManager && typeof connectionManager.handleReconnect === 'function') {
          connectionManager.handleReconnect('tradingEvents');
        }
      }
      return;
    }
    
    // Send ping to check if connection is alive
    try {
      // Clear any existing ping timeout
      if (this.tradingEventsPingTimeout) {
        clearTimeout(this.tradingEventsPingTimeout);
        this.tradingEventsPingTimeout = null;
      }
      
      // Set up pong listener for this ping
      const onPong = () => {
        // Connection is alive
        if (this.tradingEventsPingTimeout) {
          clearTimeout(this.tradingEventsPingTimeout);
          this.tradingEventsPingTimeout = null;
        }
        
        // Remove the pong listener to avoid memory leaks
        ws.removeListener('pong', onPong);
        
        logger.debug('HealthMonitor: Trading events WebSocket is healthy');
      };
      
      // Listen for pong
      ws.on('pong', onPong);
      
      // Send ping
      ws.ping();
      
      // Set up timeout for pong response
      this.tradingEventsPingTimeout = setTimeout(() => {
        // No pong received within timeout
        logger.warn('HealthMonitor: Trading events WebSocket ping timeout');
        
        // Remove the pong listener
        ws.removeListener('pong', onPong);
        
        // Terminate the connection to force reconnect
        ws.terminate();
      }, this.PING_TIMEOUT_MS);
    } catch (error) {
      logger.error('HealthMonitor: Error checking trading events WebSocket health', error);
    }
  }
}
