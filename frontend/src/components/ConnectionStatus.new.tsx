/**
 * ConnectionStatus.tsx
 * Displays detailed connection status information for Alpaca API and client
 * Shows connection state, authentication status, and last update times
 * Provides a compact, table-like interface with draggable connection logs
 */

import { useAppStore, type LogEntry } from '../store/appStore'
import { useState, useEffect, useRef } from 'react'
import axios from 'axios'

const ConnectionStatus = () => {
  const { wsConnection, alpacaStatus, clientStatus, logs, setLogs } = useAppStore()
  const [isConnecting, setIsConnecting] = useState(false)
  const [isLoading, setIsLoading] = useState({
    account: false,
    positions: false,
    marketStatus: false
  })
  const [connectionLogs, setConnectionLogs] = useState<string[]>([])
  const [accountInfo, setAccountInfo] = useState<any>(null)
  const [positions, setPositions] = useState<any[]>([])
  const [marketStatus, setMarketStatus] = useState<any>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [logsHeight, setLogsHeight] = useState(200)
  const dragStartY = useRef(0)
  
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
      await axios.post('/api/alpaca/connect')
      addLog('Connected to Alpaca API')
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
  }
  
  // Handle drag move for resizable logs panel
  const handleDragMove = (e: React.MouseEvent) => {
    if (!isDragging) return
    
    const deltaY = dragStartY.current - e.clientY
    setLogsHeight(prev => Math.max(100, Math.min(500, prev + deltaY)))
    dragStartY.current = e.clientY
  }
  
  // Handle drag end for resizable logs panel
  const handleDragEnd = () => {
    setIsDragging(false)
  }

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleDragMove as any)
      document.addEventListener('mouseup', handleDragEnd)
    } else {
      document.removeEventListener('mousemove', handleDragMove as any)
      document.removeEventListener('mouseup', handleDragEnd)
    }
    
    return () => {
      document.removeEventListener('mousemove', handleDragMove as any)
      document.removeEventListener('mouseup', handleDragEnd)
    }
  }, [isDragging])

  return (
    <div className="p-4 flex flex-col h-full">
      <h2 className="text-xl font-semibold mb-4">Connection Status</h2>
      
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
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
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
                <div className="flex space-x-2">
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
          className="cursor-ns-resize h-2 bg-gray-300 dark:bg-gray-600 rounded-t-md w-full absolute -top-2 left-0 z-10"
          onMouseDown={handleDragStart}
        ></div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 h-full">
          <h3 className="text-lg font-medium mb-3">Connection Logs</h3>
          <div 
            className="bg-gray-50 dark:bg-gray-700 rounded-md p-3 font-mono text-sm overflow-y-auto"
            style={{ height: `${logsHeight}px` }}
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
