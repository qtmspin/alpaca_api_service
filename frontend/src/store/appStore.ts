/**
 * appStore.ts
 * Centralized state management using Zustand
 * Manages WebSocket connections, orders, logs, and configuration
 */

import { create } from 'zustand'
import axios from 'axios'

// Define types for our store
type ConnectionStatus = 'connected' | 'disconnected' | 'connecting'

type AlpacaStatus = {
  connected: boolean
  authenticated: boolean
  lastUpdated: string
}

type ClientStatus = {
  connected: boolean
  lastUpdated: string
}

export type LogEntry = {
  id: string
  timestamp: string
  level: 'info' | 'warning' | 'error' | 'debug'
  message: string
  source: string
}

type Order = {
  id: string
  symbol: string
  qty: number
  side: 'buy' | 'sell'
  type: string
  status: string
  created_at: string
  filled_at?: string
  filled_qty?: number
  filled_avg_price?: number
  is_artificial?: boolean
}

type TradeLogEntry = {
  id: string
  timestamp: string
  symbol: string
  side: 'buy' | 'sell'
  qty: number
  price: number
  orderId: string
}

type Config = {
  shortingEnabled: boolean
  duplicateTradeDetection: boolean
  maxNotionalSize: number
  maxQty: number
}

type AppState = {
  wsConnection: ConnectionStatus
  alpacaStatus: AlpacaStatus
  clientStatus: ClientStatus
  logs: LogEntry[]
  orders: Order[]
  tradeLog: TradeLogEntry[]
  config: Config
  reconnectAttempts: number
  lastConnectionAttempt: string
  
  // Actions
  initWebSocket: () => void
  updateConfig: (config: Partial<Config>) => Promise<void>
  submitOrder: (order: Partial<Order>) => Promise<void>
  clearLogs: () => void
  setLogs: (logs: LogEntry[]) => void
}

export const useAppStore = create<AppState>((set, get) => ({
  // Initial state
  wsConnection: 'disconnected',
  alpacaStatus: {
    connected: false,
    authenticated: false,
    lastUpdated: new Date().toISOString(),
  },
  clientStatus: {
    connected: false,
    lastUpdated: new Date().toISOString(),
  },
  logs: [],
  orders: [],
  tradeLog: [],
  config: {
    shortingEnabled: false,
    duplicateTradeDetection: true,
    maxNotionalSize: 5000,
    maxQty: 100,
  },
  reconnectAttempts: 0,
  lastConnectionAttempt: new Date().toISOString(),
  
  // Actions
  initWebSocket: () => {
    // Track reconnection attempts for exponential backoff
    const state = get();
    const reconnectAttempts = state.reconnectAttempts || 0;
    
    set({ 
      wsConnection: 'connecting',
      lastConnectionAttempt: new Date().toISOString()
    })
    
    const ws = new WebSocket('ws://localhost:9000/ws')
    
    ws.onopen = () => {
      // Reset reconnection attempts on successful connection
      set({ 
        wsConnection: 'connected',
        reconnectAttempts: 0,
        lastConnectionAttempt: new Date().toISOString()
      })
      
      // Subscribe to channels
      ws.send(JSON.stringify({
        action: 'subscribe',
        channels: ['orders', 'logs', 'trades', 'status']
      }))
      
      // Add connection success to logs
      const logEntry: LogEntry = {
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        level: 'info',
        message: 'Connected to WebSocket server',
        source: 'websocket'
      };
      set(state => ({ logs: [logEntry, ...state.logs].slice(0, 1000) }));
    }
    
    ws.onclose = () => {
      // Implement exponential backoff with jitter for reconnection
      const maxReconnectDelay = 30000; // 30 seconds max
      const nextAttempt = reconnectAttempts + 1;
      
      // Calculate delay with exponential backoff and random jitter
      const baseDelay = Math.min(1000 * Math.pow(1.5, nextAttempt), maxReconnectDelay);
      const jitter = Math.random() * 1000; // Add up to 1 second of jitter
      const delay = Math.floor(baseDelay + jitter);
      
      set({ 
        wsConnection: 'disconnected',
        reconnectAttempts: nextAttempt
      })
      
      // Add disconnection to logs
      const logEntry: LogEntry = {
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        level: 'warning',
        message: `WebSocket disconnected. Reconnecting in ${Math.round(delay/1000)} seconds (attempt ${nextAttempt})`,
        source: 'websocket'
      };
      set(state => ({ logs: [logEntry, ...state.logs].slice(0, 1000) }));
      
      // Attempt to reconnect after calculated delay
      setTimeout(() => get().initWebSocket(), delay)
    }
    
    ws.onerror = () => {
      set({ wsConnection: 'disconnected' })
    }
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        
        switch (data.type) {
          case 'log':
            set((state) => ({
              logs: [data.payload, ...state.logs].slice(0, 1000) // Keep last 1000 logs
            }))
            break
            
          case 'order':
            set((state) => {
              // Update existing order or add new one
              const existingOrderIndex = state.orders.findIndex(o => o.id === data.payload.id)
              
              if (existingOrderIndex >= 0) {
                const updatedOrders = [...state.orders]
                updatedOrders[existingOrderIndex] = data.payload
                return { orders: updatedOrders }
              } else {
                return { orders: [data.payload, ...state.orders] }
              }
            })
            break
            
          case 'trade':
            set((state) => ({
              tradeLog: [data.payload, ...state.tradeLog].slice(0, 1000) // Keep last 1000 trades
            }))
            break
            
          case 'status':
            if (data.payload.alpaca) {
              set({ alpacaStatus: data.payload.alpaca })
            }
            if (data.payload.client) {
              set({ clientStatus: data.payload.client })
            }
            break
            
          case 'config':
            set({ config: data.payload })
            break
            
          default:
            console.log('Unknown message type:', data.type)
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error)
      }
    }
  },
  
  updateConfig: async (configUpdate) => {
    try {
      await axios.put('/api/config', configUpdate)
      set((state) => ({
        config: {
          ...state.config,
          ...configUpdate
        }
      }))
      return Promise.resolve()
    } catch (error) {
      console.error('Error updating config:', error)
      return Promise.reject(error)
    }
  },
  
  submitOrder: async (order) => {
    try {
      const { data } = await axios.post('/api/orders', order)
      return Promise.resolve(data)
    } catch (error) {
      console.error('Error submitting order:', error)
      return Promise.reject(error)
    }
  },
  
  clearLogs: () => {
    set({ logs: [] })
  },
  setLogs: (logs: LogEntry[]) => {
    set({ logs })
  },
}))
