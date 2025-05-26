/**
 * database-service.ts
 * 
 * This file contains the database service for order persistence and history.
 * Location: backend/src/services/database-service.ts
 * 
 * Responsibilities:
 * - Initialize SQLite database
 * - Create database tables
 * - Log orders and order updates
 * - Provide order history queries
 * - Store artificial orders
 */

import { Database, open } from 'sqlite';
import sqlite3 from 'sqlite3';
import path from 'path';

export interface OrderRecord {
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
  filledAt?: string;
  canceledAt?: string;
  notes?: string;
}

export interface ArtificialOrderRecord {
  artificialId: string;
  symbol: string;
  side: string;
  qty: number;
  triggerPrice: number;
  limitPrice?: number;
  status: string;
  createdAt: string;
  triggeredAt?: string;
  executedOrderId?: string;
}

export class DatabaseService {
  private db: Database | null = null;
  private dbPath: string;
  
  constructor(dbPath: string = './data/orders.sqlite') {
    this.dbPath = path.resolve(dbPath);
  }
  
  /**
   * Initialize the database connection and create tables
   */
  async initialize(): Promise<void> {
    try {
      // Ensure the directory exists
      const dbDir = path.dirname(this.dbPath);
      const fs = await import('fs/promises');
      await fs.mkdir(dbDir, { recursive: true });
      
      // Open database connection
      this.db = await open({
        filename: this.dbPath,
        driver: sqlite3.Database
      });
      
      console.log(`Database connected: ${this.dbPath}`);
      
      // Create tables
      await this.createTables();
      
      console.log('Database tables created/verified');
    } catch (error) {
      console.error('Failed to initialize database:', error);
      throw new Error(`Database initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Create database tables if they don't exist
   */
  private async createTables(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    // Order history table
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS order_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id TEXT UNIQUE NOT NULL,
        client_order_id TEXT,
        symbol TEXT NOT NULL,
        side TEXT NOT NULL,
        order_type TEXT NOT NULL,
        time_in_force TEXT NOT NULL,
        qty DECIMAL(10,2) NOT NULL,
        filled_qty DECIMAL(10,2) DEFAULT 0,
        limit_price DECIMAL(10,2),
        stop_price DECIMAL(10,2),
        status TEXT NOT NULL,
        created_at TIMESTAMP NOT NULL,
        updated_at TIMESTAMP NOT NULL,
        filled_at TIMESTAMP,
        canceled_at TIMESTAMP,
        notes TEXT
      )
    `);
    
    // Artificial orders table
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS artificial_orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        artificial_id TEXT UNIQUE NOT NULL,
        symbol TEXT NOT NULL,
        side TEXT NOT NULL,
        qty DECIMAL(10,2) NOT NULL,
        trigger_price DECIMAL(10,2) NOT NULL,
        limit_price DECIMAL(10,2),
        status TEXT NOT NULL,
        created_at TIMESTAMP NOT NULL,
        triggered_at TIMESTAMP,
        executed_order_id TEXT,
        FOREIGN KEY (executed_order_id) REFERENCES order_history(order_id)
      )
    `);
    
    // Configuration table
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS configuration (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TIMESTAMP NOT NULL,
        updated_by TEXT DEFAULT 'system'
      )
    `);
    
    // Order duplicate checking table
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS order_checks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        symbol TEXT NOT NULL,
        side TEXT NOT NULL,
        qty DECIMAL(10,2) NOT NULL,
        order_type TEXT NOT NULL,
        hash TEXT NOT NULL,
        created_at TIMESTAMP NOT NULL
      )
    `);
    
    // Create indexes for better performance
    await this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_order_history_symbol_created 
      ON order_history(symbol, created_at DESC)
    `);
    
    await this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_order_checks_hash_created 
      ON order_checks(hash, created_at)
    `);
    
    await this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_artificial_orders_status 
      ON artificial_orders(status, created_at DESC)
    `);
  }
  
  /**
   * Log a new order to the database
   */
  async logOrder(order: OrderRecord): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    try {
      await this.db.run(`
        INSERT OR REPLACE INTO order_history (
          order_id, client_order_id, symbol, side, order_type, time_in_force,
          qty, filled_qty, limit_price, stop_price, status,
          created_at, updated_at, filled_at, canceled_at, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        order.orderId,
        order.clientOrderId,
        order.symbol,
        order.side,
        order.orderType,
        order.timeInForce,
        order.qty,
        order.filledQty,
        order.limitPrice,
        order.stopPrice,
        order.status,
        order.createdAt,
        order.updatedAt,
        order.filledAt,
        order.canceledAt,
        order.notes
      ]);
    } catch (error) {
      console.error('Failed to log order:', error);
      throw new Error(`Order logging failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Store an artificial order
   */
  async storeArtificialOrder(order: ArtificialOrderRecord): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    try {
      await this.db.run(`
        INSERT OR REPLACE INTO artificial_orders (
          artificial_id, symbol, side, qty, trigger_price, limit_price,
          status, created_at, triggered_at, executed_order_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        order.artificialId,
        order.symbol,
        order.side,
        order.qty,
        order.triggerPrice,
        order.limitPrice,
        order.status,
        order.createdAt,
        order.triggeredAt,
        order.executedOrderId
      ]);
    } catch (error) {
      console.error('Failed to store artificial order:', error);
      throw new Error(`Artificial order storage failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Get order history with filters
   */
  async getOrderHistory(filters: {
    symbol?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<OrderRecord[]> {
    if (!this.db) throw new Error('Database not initialized');
    
    let query = 'SELECT * FROM order_history WHERE 1=1';
    const params: any[] = [];
    
    if (filters.symbol) {
      query += ' AND symbol = ?';
      params.push(filters.symbol);
    }
    
    if (filters.status) {
      query += ' AND status = ?';
      params.push(filters.status);
    }
    
    if (filters.startDate) {
      query += ' AND created_at >= ?';
      params.push(filters.startDate);
    }
    
    if (filters.endDate) {
      query += ' AND created_at <= ?';
      params.push(filters.endDate);
    }
    
    query += ' ORDER BY created_at DESC';
    
    if (filters.limit) {
      query += ' LIMIT ?';
      params.push(filters.limit);
    }
    
    if (filters.offset) {
      query += ' OFFSET ?';
      params.push(filters.offset);
    }
    
    try {
      const rows = await this.db.all(query, params);
      return rows.map(this.mapOrderRecord);
    } catch (error) {
      console.error('Failed to get order history:', error);
      throw new Error(`Order history query failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Get artificial orders
   */
  async getArtificialOrders(status?: string): Promise<ArtificialOrderRecord[]> {
    if (!this.db) throw new Error('Database not initialized');
    
    let query = 'SELECT * FROM artificial_orders';
    const params: any[] = [];
    
    if (status) {
      query += ' WHERE status = ?';
      params.push(status);
    }
    
    query += ' ORDER BY created_at DESC';
    
    try {
      const rows = await this.db.all(query, params);
      return rows.map(this.mapArtificialOrderRecord);
    } catch (error) {
      console.error('Failed to get artificial orders:', error);
      throw new Error(`Artificial orders query failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Check for duplicate orders
   */
  async checkDuplicateOrder(orderHash: string, windowMs: number): Promise<boolean> {
    if (!this.db) throw new Error('Database not initialized');
    
    const cutoffTime = new Date(Date.now() - windowMs).toISOString();
    
    try {
      const result = await this.db.get(`
        SELECT COUNT(*) as count FROM order_checks 
        WHERE hash = ? AND created_at > ?
      `, [orderHash, cutoffTime]);
      
      return result.count > 0;
    } catch (error) {
      console.error('Failed to check duplicate order:', error);
      return false; // Fail safe - allow the order
    }
  }
  
  /**
   * Record order for duplicate checking
   */
  async recordOrderCheck(symbol: string, side: string, qty: number, orderType: string, hash: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    try {
      await this.db.run(`
        INSERT INTO order_checks (symbol, side, qty, order_type, hash, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [symbol, side, qty, orderType, hash, new Date().toISOString()]);
    } catch (error) {
      console.error('Failed to record order check:', error);
      // Don't throw - this is not critical for order placement
    }
  }
  
  /**
   * Clean up old order check records
   */
  async cleanupOldOrderChecks(maxAgeMs: number = 24 * 60 * 60 * 1000): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    const cutoffTime = new Date(Date.now() - maxAgeMs).toISOString();
    
    try {
      await this.db.run('DELETE FROM order_checks WHERE created_at < ?', [cutoffTime]);
    } catch (error) {
      console.error('Failed to cleanup old order checks:', error);
    }
  }
  
  /**
   * Close database connection
   */
  async close(): Promise<void> {
    if (this.db) {
      await this.db.close();
      this.db = null;
      console.log('Database connection closed');
    }
  }
  
  /**
   * Map database row to OrderRecord
   */
  private mapOrderRecord(row: any): OrderRecord {
    return {
      orderId: row.order_id,
      clientOrderId: row.client_order_id,
      symbol: row.symbol,
      side: row.side,
      orderType: row.order_type,
      timeInForce: row.time_in_force,
      qty: parseFloat(row.qty),
      filledQty: parseFloat(row.filled_qty),
      limitPrice: row.limit_price ? parseFloat(row.limit_price) : undefined,
      stopPrice: row.stop_price ? parseFloat(row.stop_price) : undefined,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      filledAt: row.filled_at,
      canceledAt: row.canceled_at,
      notes: row.notes
    };
  }
  
  /**
   * Map database row to ArtificialOrderRecord
   */
  private mapArtificialOrderRecord(row: any): ArtificialOrderRecord {
    return {
      artificialId: row.artificial_id,
      symbol: row.symbol,
      side: row.side,
      qty: parseFloat(row.qty),
      triggerPrice: parseFloat(row.trigger_price),
      limitPrice: row.limit_price ? parseFloat(row.limit_price) : undefined,
      status: row.status,
      createdAt: row.created_at,
      triggeredAt: row.triggered_at,
      executedOrderId: row.executed_order_id
    };
  }
}