/**
 * MarketDataPanel.tsx
 * Displays real-time market data for stocks and cryptocurrencies
 * Provides symbol search with autocomplete and data visualization
 * Location: frontend/src/components/MarketDataPanel.tsx
 */

import { useState, useEffect, useRef } from 'react'
import { useAppStore, type LogEntry } from '../store/appStore'
import axios from 'axios'
import PriceHistoryChart from './PriceHistoryChart'

const MarketDataPanel = () => {
  const { alpacaStatus, setLogs, logs } = useAppStore()
  const [symbol, setSymbol] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [marketData, setMarketData] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const wsRef = useRef<WebSocket | null>(null)

  // Handle symbol search with debounce
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    if (symbol.length < 2) {
      setSearchResults([])
      return
    }

    searchTimeoutRef.current = setTimeout(async () => {
      try {
        setIsSearching(true)
        const { data } = await axios.get(`/api/alpaca/assets?status=active`)
        if (data.success) {
          // Filter assets by symbol or name containing the search term
          const filteredResults = data.data
            .filter((asset: any) => 
              asset.symbol.toLowerCase().includes(symbol.toLowerCase()) || 
              (asset.name && asset.name.toLowerCase().includes(symbol.toLowerCase()))
            )
            .slice(0, 10) // Limit to 10 results
          setSearchResults(filteredResults)
        }
      } catch (error) {
        console.error('Error searching for symbols:', error)
        addLog(`Error searching for symbols: ${error instanceof Error ? error.message : 'Unknown error'}`)
      } finally {
        setIsSearching(false)
      }
    }, 300) // 300ms debounce

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
    }
  }, [symbol])

  // Add log entry
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

  // Fetch market data for a symbol
  const fetchMarketData = async (symbolToFetch: string) => {
    try {
      setIsLoading(true)
      setError('')
      const { data } = await axios.get(`/api/alpaca/market-data/${symbolToFetch}`)
      if (data.success) {
        setMarketData(data.data)
        addLog(`Fetched market data for ${symbolToFetch}`)
      }
    } catch (error) {
      console.error(`Error fetching market data for ${symbolToFetch}:`, error)
      setError(`Failed to fetch market data: ${error instanceof Error ? error.message : 'Unknown error'}`)
      addLog(`Error fetching market data for ${symbolToFetch}: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsLoading(false)
    }
  }

  // Handle symbol selection
  const handleSymbolSelect = (selectedSymbol: string) => {
    setSymbol(selectedSymbol);
    setSearchResults([]);
    fetchMarketData(selectedSymbol);
    
    // Only setup WebSocket if it's not already connected
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      setupWebSocket(selectedSymbol);
    } else {
      // If WebSocket is already open, just send a subscription message
      subscribeToMarketData(selectedSymbol);
    }
  }

  // Subscribe to market data for a symbol using existing WebSocket connection
  const subscribeToMarketData = (selectedSymbol: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        action: 'subscribe',
        channels: ['market_data'],
        symbols: [selectedSymbol]
      }));
      addLog(`Subscribed to market data for ${selectedSymbol}`);
    }
  }

  // Setup WebSocket connection for real-time updates
  const setupWebSocket = (selectedSymbol: string) => {
    // If there's an existing connection in CONNECTING state, wait for it
    if (wsRef.current && wsRef.current.readyState === WebSocket.CONNECTING) {
      addLog('WebSocket connection already in progress, waiting...');
      return;
    }
    
    // Close existing connection if it's in a CLOSING state
    if (wsRef.current && wsRef.current.readyState === WebSocket.CLOSING) {
      addLog('Previous WebSocket connection is closing, will reconnect when done');
      setTimeout(() => setupWebSocket(selectedSymbol), 1000);
      return;
    }

    // If connection is already open, just subscribe to the new symbol
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      subscribeToMarketData(selectedSymbol);
      return;
    }
    
    // Close existing connection if in an unexpected state
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch (err) {
        console.error('Error closing previous WebSocket:', err);
      }
    }

    // Create new WebSocket connection
    try {
      const ws = new WebSocket(`ws://localhost:9000/ws`);
      wsRef.current = ws;

      ws.onopen = () => {
        addLog(`WebSocket connection opened for market data`);
        // Subscribe to market data for the selected symbol
        subscribeToMarketData(selectedSymbol);
      }

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'market_data' && data.payload && data.payload.symbol === symbol) {
            setMarketData(data.payload);
            // Don't log every update to avoid flooding the logs
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      }

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        addLog(`WebSocket error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }

      ws.onclose = (event) => {
        addLog(`WebSocket connection closed: ${event.wasClean ? 'Clean close' : 'Connection error'} - Code: ${event.code}`);
        
        // Attempt to reconnect after a delay if not a clean close
        if (!event.wasClean) {
          setTimeout(() => {
            addLog('Attempting to reconnect WebSocket...');
            setupWebSocket(symbol);
          }, 3000);
        }
      }
    } catch (error) {
      console.error('Error creating WebSocket:', error);
      addLog(`Error creating WebSocket: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Cleanup WebSocket on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close()
      }
    }
  }, [])

  // Format price with appropriate decimals
  const formatPrice = (price: number | string) => {
    if (typeof price === 'string') {
      price = parseFloat(price)
    }
    return price.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })
  }

  // Format date/time
  const formatDateTime = (dateString: string) => {
    try {
      const date = new Date(dateString)
      return date.toLocaleString()
    } catch (e) {
      return 'Invalid date'
    }
  }

  return (
    <div className="p-4">
      <h2 className="text-xl font-semibold mb-4">Market Data</h2>
      
      {/* Symbol Search */}
      <div className="mb-6">
        <div className="relative">
          <div className="flex">
            <input
              type="text"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              placeholder="Enter symbol (e.g., AAPL, BTC/USD)"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
              disabled={!alpacaStatus.connected}
            />
            <button
              onClick={() => symbol && handleSymbolSelect(symbol)}
              disabled={!symbol || isLoading || !alpacaStatus.connected}
              className="ml-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Loading...' : 'Get Data'}
            </button>
          </div>
          
          {/* Search Results Dropdown */}
          {searchResults.length > 0 && (
            <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg max-h-60 overflow-auto">
              {searchResults.map((asset) => (
                <div 
                  key={asset.id} 
                  className="px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
                  onClick={() => handleSymbolSelect(asset.symbol)}
                >
                  <div className="font-medium">{asset.symbol}</div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">{asset.name}</div>
                </div>
              ))}
            </div>
          )}
          
          {isSearching && (
            <div className="absolute right-12 top-3">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
            </div>
          )}
        </div>
        
        {!alpacaStatus.connected && (
          <div className="mt-2 text-sm text-red-500">
            Connect to Alpaca API first to search for symbols and get market data
          </div>
        )}
        
        {error && (
          <div className="mt-2 text-sm text-red-500">
            {error}
          </div>
        )}
      </div>
      
      {/* Market Data Display */}
      {marketData && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Asset Information */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <h3 className="text-lg font-medium mb-3">Asset Information</h3>
            <table className="min-w-full">
              <tbody>
                <tr>
                  <td className="py-2 text-gray-500 dark:text-gray-400">Symbol</td>
                  <td className="py-2 font-medium">{marketData.symbol}</td>
                </tr>
                {marketData.asset && (
                  <>
                    <tr>
                      <td className="py-2 text-gray-500 dark:text-gray-400">Name</td>
                      <td className="py-2">{marketData.asset.name}</td>
                    </tr>
                    <tr>
                      <td className="py-2 text-gray-500 dark:text-gray-400">Exchange</td>
                      <td className="py-2">{marketData.asset.exchange}</td>
                    </tr>
                    <tr>
                      <td className="py-2 text-gray-500 dark:text-gray-400">Class</td>
                      <td className="py-2">{marketData.asset.class}</td>
                    </tr>
                    <tr>
                      <td className="py-2 text-gray-500 dark:text-gray-400">Status</td>
                      <td className="py-2">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          marketData.asset.status === 'active' 
                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                            : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                        }`}>
                          {marketData.asset.status}
                        </span>
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2 text-gray-500 dark:text-gray-400">Tradable</td>
                      <td className="py-2">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          marketData.asset.tradable 
                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                            : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                        }`}>
                          {marketData.asset.tradable ? 'Yes' : 'No'}
                        </span>
                      </td>
                    </tr>
                  </>
                )}
                <tr>
                  <td className="py-2 text-gray-500 dark:text-gray-400">Last Updated</td>
                  <td className="py-2">{formatDateTime(marketData.timestamp)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          
          {/* Price Information */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <h3 className="text-lg font-medium mb-3">Price Information</h3>
            
            {/* Bar Data */}
            {marketData.bar && (
              <div className="mb-4">
                <h4 className="font-medium mb-2">OHLC Data</h4>
                <table className="min-w-full">
                  <tbody>
                    <tr>
                      <td className="py-2 text-gray-500 dark:text-gray-400">Open</td>
                      <td className="py-2">${formatPrice(marketData.bar.o)}</td>
                    </tr>
                    <tr>
                      <td className="py-2 text-gray-500 dark:text-gray-400">High</td>
                      <td className="py-2">${formatPrice(marketData.bar.h)}</td>
                    </tr>
                    <tr>
                      <td className="py-2 text-gray-500 dark:text-gray-400">Low</td>
                      <td className="py-2">${formatPrice(marketData.bar.l)}</td>
                    </tr>
                    <tr>
                      <td className="py-2 text-gray-500 dark:text-gray-400">Close</td>
                      <td className="py-2">${formatPrice(marketData.bar.c)}</td>
                    </tr>
                    <tr>
                      <td className="py-2 text-gray-500 dark:text-gray-400">Volume</td>
                      <td className="py-2">{parseInt(marketData.bar.v).toLocaleString()}</td>
                    </tr>
                    <tr>
                      <td className="py-2 text-gray-500 dark:text-gray-400">Timestamp</td>
                      <td className="py-2">{formatDateTime(marketData.bar.t)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
            
            {/* Quote Data */}
            {marketData.quote && (
              <div>
                <h4 className="font-medium mb-2">Quote Data</h4>
                <table className="min-w-full">
                  <tbody>
                    <tr>
                      <td className="py-2 text-gray-500 dark:text-gray-400">Ask Price</td>
                      <td className="py-2">${formatPrice(marketData.quote.ap)}</td>
                    </tr>
                    <tr>
                      <td className="py-2 text-gray-500 dark:text-gray-400">Ask Size</td>
                      <td className="py-2">{parseInt(marketData.quote.as).toLocaleString()}</td>
                    </tr>
                    <tr>
                      <td className="py-2 text-gray-500 dark:text-gray-400">Bid Price</td>
                      <td className="py-2">${formatPrice(marketData.quote.bp)}</td>
                    </tr>
                    <tr>
                      <td className="py-2 text-gray-500 dark:text-gray-400">Bid Size</td>
                      <td className="py-2">{parseInt(marketData.quote.bs).toLocaleString()}</td>
                    </tr>
                    <tr>
                      <td className="py-2 text-gray-500 dark:text-gray-400">Timestamp</td>
                      <td className="py-2">{formatDateTime(marketData.quote.t)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
            
            {!marketData.bar && !marketData.quote && (
              <div className="text-center py-4 text-gray-500 dark:text-gray-400">
                No price data available for this symbol
              </div>
            )}
          </div>
          
          {/* Price History Chart */}
          {symbol && (
            <div className="mt-6">
              <h3 className="text-lg font-medium mb-4">Price History</h3>
              <PriceHistoryChart 
                symbol={symbol} 
                onError={(error) => {
                  setError(error);
                  addLog(`Error fetching price history: ${error}`);
                }}
                onLog={addLog}
              />
            </div>
          )}
        </div>
      )}
      
      {!marketData && symbol && !isLoading && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center">
          <div className="text-gray-500 dark:text-gray-400">
            Enter a symbol and click "Get Data" to view market information
          </div>
        </div>
      )}
      
      {isLoading && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mb-2"></div>
          <div className="text-gray-500 dark:text-gray-400">
            Loading market data...
          </div>
        </div>
      )}
    </div>
  )
}

export default MarketDataPanel
