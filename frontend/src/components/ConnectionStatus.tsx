/**
 * ConnectionStatus.tsx
 * Displays detailed connection status information for Alpaca API and client
 * Shows connection state, authentication status, and last update times
 * Provides a compact, table-like interface with draggable connection logs
 * Location: frontend/src/components/ConnectionStatus.tsx
 * Responsibilities: Connection management, status display, data fetching, orders display
 */

import { useAppStore, type LogEntry } from '../store/appStore'
import { useState, useEffect, useRef } from 'react'
import axios from 'axios'
import './ConnectionStatus.css'

const ConnectionStatus = () => {
  const { wsConnection, alpacaStatus, clientStatus, logs, setLogs } = useAppStore()
  const [isConnecting, setIsConnecting] = useState(false)
  const [isLoading, setIsLoading] = useState({
    account: false,
    positions: false,
    marketStatus: false,
    orders: false
  })
  const [connectionLogs, setConnectionLogs] = useState<string[]>([])
  const [accountInfo, setAccountInfo] = useState<any>(null)
  const [positions, setPositions] = useState<any[]>([])
  const [marketStatus, setMarketStatus] = useState<any>(null)
  const [orders, setOrders] = useState<any[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [logsHeight, setLogsHeight] = useState(200)
  const [showOrdersModal, setShowOrdersModal] = useState(false)
  const dragStartY = useRef(0)
  const dragStartHeight = useRef(0)
  
  // Filter logs related to connection status
  useEffect(() => {
    const connectionLogs = logs
      .filter(log => 
        log.message.toLowerCase().includes('connect') ||
        log.message.toLowerCase().includes('disconnect') ||
        log.message.toLowerCase().includes('alpaca') ||
        log.message.toLowerCase().includes('socket')
      )
      .slice(0, 10) // Show only the 10 most recent relevant logs
      .map(log => `${new Date(log.timestamp).toLocaleTimeString()}: ${log.message}`)
    
    setConnectionLogs(connectionLogs)
  }, [logs])

  const handleConnect = async () => {
    try {
      setIsConnecting(true)
      const response = await axios.post('/api/alpaca/connect')
      addLog('Connected to Alpaca API')
      
      // Manually update the status immediately
      if (response.data.success) {
        useAppStore.setState({
          alpacaStatus: {
            ...alpacaStatus,
            connected: true,
            authenticated: true,
            lastUpdated: new Date().toISOString()
          },
          clientStatus: {
            ...clientStatus,
            connected: true,
            lastUpdated: new Date().toISOString()
          }
        })
      }
    } catch (error) {
      console.error('Error connecting to Alpaca:', error)
      addLog(`Error connecting to Alpaca: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsConnecting(false)
    }
  }

  const addLog = (message: string) => {
    const timestamp = new Date().toISOString()
    const newLog: LogEntry = {
      id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp,
      message,
      level: 'info',
      source: 'frontend'
    }
    setLogs([newLog, ...logs].slice(0, 1000))
  }

  const fetchAccountInfo = async () => {
    try {
      setIsLoading(prev => ({ ...prev, account: true }))
      const { data } = await axios.get('/api/alpaca/account')
      if (data.success) {
        setAccountInfo(data.data)
        addLog('Fetched account info')
      }
    } catch (error) {
      console.error('Error fetching account info:', error)
      addLog(`Error fetching account info: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsLoading(prev => ({ ...prev, account: false }))
    }
  }

  const fetchPositions = async () => {
    try {
      setIsLoading(prev => ({ ...prev, positions: true }))
      const { data } = await axios.get('/api/alpaca/positions')
      if (data.success) {
        setPositions(data.data)
        addLog(`Fetched ${data.data.length} positions`)
      }
    } catch (error) {
      console.error('Error fetching positions:', error)
      addLog(`Error fetching positions: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsLoading(prev => ({ ...prev, positions: false }))
    }
  }

  const fetchMarketStatus = async () => {
    try {
      setIsLoading(prev => ({ ...prev, marketStatus: true }))
      const { data } = await axios.get('/api/alpaca/market-status')
      if (data.success) {
        setMarketStatus(data.data)
        addLog('Fetched market status')
      }
    } catch (error) {
      console.error('Error fetching market status:', error)
      addLog(`Error fetching market status: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsLoading(prev => ({ ...prev, marketStatus: false }))
    }
  }

  const fetchOrders = async () => {
    try {
      setIsLoading(prev => ({ ...prev, orders: true }))
      const { data } = await axios.get('/api/alpaca/orders')
      if (data.success) {
        setOrders(data.data)
        addLog(`Fetched ${data.data.length} orders`)
      }
    } catch (error) {
      console.error('Error fetching orders:', error)
      addLog(`Error fetching orders: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsLoading(prev => ({ ...prev, orders: false }))
    }
  }

  // Format timestamp to be more readable
  const formatTime = (isoString: string) => {
    try {
      const date = new Date(isoString)
      return date.toLocaleTimeString()
    } catch (e) {
      return 'Invalid date'
    }
  }
  
  // Handle drag start for resizable logs panel
  const handleDragStart = (e: React.MouseEvent) => {
    setIsDragging(true)
    dragStartY.current = e.clientY
    dragStartHeight.current = logsHeight
    document.addEventListener('mousemove', handleDragMove)
    document.addEventListener('mouseup', handleDragEnd)
  }

  const handleDragMove = (e: MouseEvent) => {
    if (!isDragging) return
    const deltaY = dragStartY.current - e.clientY
    setLogsHeight(Math.max(50, Math.min(400, dragStartHeight.current + deltaY)))
  }

  const handleDragEnd = () => {
    setIsDragging(false)
    document.removeEventListener('mousemove', handleDragMove)
    document.removeEventListener('mouseup', handleDragEnd)
  }

  const toggleOrdersModal = () => {
    setShowOrdersModal(!showOrdersModal)
  }

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleDragMove)
      document.addEventListener('mouseup', handleDragEnd)
    } else {
      document.removeEventListener('mousemove', handleDragMove)
      document.removeEventListener('mouseup', handleDragEnd)
    }
    
    return () => {
      document.removeEventListener('mousemove', handleDragMove as any)
      document.removeEventListener('mouseup', handleDragEnd)
    }
  }, [isDragging])

  // Format order status with appropriate styling
  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'filled':
        return 'bg-green-100 text-green-800'
      case 'partially_filled':
        return 'bg-blue-100 text-blue-800'
      case 'canceled':
        return 'bg-gray-100 text-gray-800'
      case 'rejected':
        return 'bg-red-100 text-red-800'
      case 'new':
      case 'accepted':
        return 'bg-yellow-100 text-yellow-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="flex flex-col h-full p-4">
      <h2 className="text-xl font-semibold mb-4">Connection Status</h2>
      
      {/* Orders Modal */}
      {showOrdersModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg w-11/12 max-w-6xl max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-semibold">Alpaca Orders</h2>
              <button
                onClick={toggleOrdersModal}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                title="Close orders modal"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="flex-1 overflow-auto p-4">
              {isLoading.orders ? (
                <div className="flex justify-center items-center h-64">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
                </div>
              ) : orders.length > 0 ? (
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Symbol</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Side</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Qty</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Type</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Created</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Updated</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {orders.map((order) => (
                      <tr key={order.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                          {order.symbol}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${order.side === 'buy' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'}`}>
                            {order.side.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                          {order.qty}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                          {order.type}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusStyle(order.status)}`}>
                            {order.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                          {formatTime(order.created_at)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                          {formatTime(order.updated_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="flex justify-center items-center h-64">
                  <p className="text-gray-500 dark:text-gray-400">No orders found</p>
                </div>
              )}
            </div>
            
            <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-end">
              <button
                onClick={toggleOrdersModal}
                className="px-4 py-2 bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-white rounded hover:bg-gray-300 dark:hover:bg-gray-600"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Connection Status Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow mb-4">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider w-1/4">Service</th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider w-1/4">Status</th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider w-1/4">Last Updated</th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider w-1/4">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {/* WebSocket Row */}
            <tr>
              <td className="px-4 py-3 whitespace-nowrap">
                <div className="text-sm font-medium text-gray-900 dark:text-white">WebSocket</div>
              </td>
              <td className="px-4 py-3 whitespace-nowrap">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  wsConnection === 'connected' 
                    ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                    : wsConnection === 'connecting' 
                      ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' 
                      : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                }`}>
                  {wsConnection === 'connected' 
                    ? 'Connected' 
                    : wsConnection === 'connecting' 
                      ? 'Connecting...' 
                      : 'Disconnected'
                  }
                </span>
              </td>
              <td className="px-4 py-3 whitespace-nowrap">
                <div className="text-sm text-gray-500 dark:text-gray-400">-</div>
              </td>
              <td className="px-4 py-3 whitespace-nowrap">
                <div className="text-sm text-gray-500 dark:text-gray-400">-</div>
              </td>
            </tr>
            
            {/* Client Row */}
            <tr>
              <td className="px-4 py-3 whitespace-nowrap">
                <div className="text-sm font-medium text-gray-900 dark:text-white">Client</div>
              </td>
              <td className="px-4 py-3 whitespace-nowrap">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  clientStatus.connected 
                    ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                    : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                }`}>
                  {clientStatus.connected ? 'Connected' : 'Disconnected'}
                </span>
              </td>
              <td className="px-4 py-3 whitespace-nowrap">
                <div className="text-sm text-gray-500 dark:text-gray-400">{formatTime(clientStatus.lastUpdated)}</div>
              </td>
              <td className="px-4 py-3 whitespace-nowrap">
                <div className="text-sm text-gray-500 dark:text-gray-400">-</div>
              </td>
            </tr>
            
            {/* Alpaca API Row */}
            <tr>
              <td className="px-4 py-3 whitespace-nowrap">
                <div className="text-sm font-medium text-gray-900 dark:text-white">Alpaca API</div>
              </td>
              <td className="px-4 py-3 whitespace-nowrap">
                <div className="flex items-center space-x-2">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    alpacaStatus.connected 
                      ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                      : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                  }`}>
                    {alpacaStatus.connected ? 'Connected' : 'Disconnected'}
                  </span>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    alpacaStatus.authenticated 
                      ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                      : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                  }`}>
                    {alpacaStatus.authenticated ? 'Authenticated' : 'Not Authenticated'}
                  </span>
                </div>
              </td>
              <td className="px-4 py-3 whitespace-nowrap">
                <div className="text-sm text-gray-500 dark:text-gray-400">{formatTime(alpacaStatus.lastUpdated)}</div>
              </td>
              <td className="px-4 py-3 whitespace-nowrap">
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={handleConnect}
                    disabled={isConnecting || alpacaStatus.connected}
                    className={`px-3 py-1 text-xs rounded-md ${
                      isConnecting || alpacaStatus.connected 
                        ? 'bg-gray-300 dark:bg-gray-600 cursor-not-allowed' 
                        : 'bg-blue-600 hover:bg-blue-700 text-white'
                    }`}
                  >
                    {isConnecting ? 'Connecting...' : alpacaStatus.connected ? 'Connected' : 'Connect'}
                  </button>
                  <button
                    onClick={fetchAccountInfo}
                    disabled={isLoading.account || !alpacaStatus.connected}
                    title={!alpacaStatus.connected ? 'Connect to Alpaca API first' : ''}
                    className="px-3 py-1 text-xs rounded-md bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading.account ? 'Loading...' : 'Account'}
                  </button>
                  <button
                    onClick={fetchPositions}
                    disabled={isLoading.positions || !alpacaStatus.connected}
                    title={!alpacaStatus.connected ? 'Connect to Alpaca API first' : ''}
                    className="px-3 py-1 text-xs rounded-md bg-green-600 hover:bg-green-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading.positions ? 'Loading...' : 'Positions'}
                  </button>
                  <button
                    onClick={fetchMarketStatus}
                    disabled={isLoading.marketStatus || !alpacaStatus.connected}
                    title={!alpacaStatus.connected ? 'Connect to Alpaca API first' : ''}
                    className="px-3 py-1 text-xs rounded-md bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading.marketStatus ? 'Loading...' : 'Market'}
                  </button>
                  <button
                    onClick={() => {
                      fetchOrders();
                      toggleOrdersModal();
                    }}
                    disabled={isLoading.orders || !alpacaStatus.connected}
                    title={!alpacaStatus.connected ? 'Connect to Alpaca API first' : ''}
                    className="px-3 py-1 text-xs rounded-md bg-orange-600 hover:bg-orange-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading.orders ? 'Loading...' : 'Orders'}
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      
      {/* Data Display Section */}
      {(accountInfo || positions.length > 0 || marketStatus) && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          {/* Account Info */}
          {accountInfo && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
              <h4 className="font-medium mb-2">Account Info</h4>
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  <tr>
                    <td className="py-2 text-sm text-gray-500 dark:text-gray-400">Buying Power</td>
                    <td className="py-2 text-sm text-right">${Number(accountInfo.buying_power).toLocaleString()}</td>
                  </tr>
                  <tr>
                    <td className="py-2 text-sm text-gray-500 dark:text-gray-400">Cash</td>
                    <td className="py-2 text-sm text-right">${Number(accountInfo.cash).toLocaleString()}</td>
                  </tr>
                  <tr>
                    <td className="py-2 text-sm text-gray-500 dark:text-gray-400">Portfolio Value</td>
                    <td className="py-2 text-sm text-right">${Number(accountInfo.portfolio_value).toLocaleString()}</td>
                  </tr>
                  <tr>
                    <td className="py-2 text-sm text-gray-500 dark:text-gray-400">Equity</td>
                    <td className="py-2 text-sm text-right">${Number(accountInfo.equity).toLocaleString()}</td>
                  </tr>
                  <tr>
                    <td className="py-2 text-sm text-gray-500 dark:text-gray-400">Status</td>
                    <td className="py-2 text-sm text-right capitalize">{accountInfo.status}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
          
          {/* Market Status */}
          {marketStatus && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
              <h4 className="font-medium mb-2">Market Status</h4>
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  <tr>
                    <td className="py-2 text-sm text-gray-500 dark:text-gray-400">Status</td>
                    <td className="py-2 text-sm text-right">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        marketStatus.is_open 
                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                          : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                      }`}>
                        {marketStatus.is_open ? 'Open' : 'Closed'}
                      </span>
                    </td>
                  </tr>
                  {marketStatus.next_open && (
                    <tr>
                      <td className="py-2 text-sm text-gray-500 dark:text-gray-400">Next Open</td>
                      <td className="py-2 text-sm text-right">{new Date(marketStatus.next_open).toLocaleString()}</td>
                    </tr>
                  )}
                  {marketStatus.next_close && (
                    <tr>
                      <td className="py-2 text-sm text-gray-500 dark:text-gray-400">Next Close</td>
                      <td className="py-2 text-sm text-right">{new Date(marketStatus.next_close).toLocaleString()}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
          
          {/* Market Hours */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <h4 className="font-medium mb-2">Market Hours</h4>
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                <tr>
                  <td className="py-2 text-sm text-gray-500 dark:text-gray-400">Pre-market</td>
                  <td className="py-2 text-sm text-right">4:30 AM - 9:30 AM ET</td>
                </tr>
                <tr>
                  <td className="py-2 text-sm text-gray-500 dark:text-gray-400">Regular market</td>
                  <td className="py-2 text-sm text-right">9:30 AM - 4:00 PM ET</td>
                </tr>
                <tr>
                  <td className="py-2 text-sm text-gray-500 dark:text-gray-400">Post-market</td>
                  <td className="py-2 text-sm text-right">4:00 PM - 8:00 PM ET</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
      
      {/* Positions */}
      {positions.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mb-4">
          <h4 className="font-medium mb-2">Positions ({positions.length})</h4>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Symbol</th>
                  <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Qty</th>
                  <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Market Value</th>
                  <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Avg Cost</th>
                  <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Current Price</th>
                  <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">P/L</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {positions.map((position) => (
                  <tr key={position.symbol}>
                    <td className="px-3 py-2 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{position.symbol}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{Number(position.qty).toFixed(2)}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">${Number(position.market_value).toLocaleString()}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">${Number(position.cost_basis).toLocaleString()}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">${Number(position.current_price).toLocaleString()}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm">
                      <span className={position.unrealized_pl >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                        ${Number(position.unrealized_pl).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      
      {/* Draggable Connection Logs */}
      <div className="relative flex-grow">
        <div 
          className="resize-handle"
          onMouseDown={handleDragStart}
        ></div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 h-full">
          <h3 className="text-lg font-medium mb-3">Connection Logs</h3>
          <div
            className={`logs-container h-${Math.floor(logsHeight / 50) * 50}`}
          >
            {connectionLogs.length > 0 ? (
              <div className="space-y-1">
                {connectionLogs.map((log, index) => (
                  <div key={index} className="text-gray-800 dark:text-gray-200">
                    {log}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-gray-500 dark:text-gray-400 italic">
                No connection logs available
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default ConnectionStatus
