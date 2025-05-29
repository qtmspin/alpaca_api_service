/**
 * OrdersPanel.tsx
 * Displays and manages orders, including artificial orders
 * Allows creating new orders with different types (market, limit, stop, etc.)
 * Provides a professional trading interface with dedicated BUY/SELL buttons
 * and automatic quantity/dollar amount calculations
 */

import { useState, useEffect } from 'react'
import { useAppStore } from '../store/appStore'

type OrderFormData = {
  symbol: string
  qty: number
  dollarAmount: number
  type: 'market' | 'limit' | 'stop_limit'
  limitPrice?: number
  stopPrice?: number
  timeInForce: 'day' | 'gtc' | 'ioc' | 'fok'
  takeProfitEnabled: boolean
  takeProfitAmount: number
  takeProfitPercent: number
  simulated: boolean
}

const OrdersPanel = () => {
  const { orders, submitOrder } = useAppStore()
  const [recentSymbols, setRecentSymbols] = useState<string[]>([])
  const [formData, setFormData] = useState<OrderFormData>({
    symbol: '',
    qty: 100,
    dollarAmount: 1000,
    type: 'market',
    timeInForce: 'day',
    takeProfitEnabled: false,
    takeProfitAmount: 0,
    takeProfitPercent: 0,
    simulated: false
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [isUpdating, setIsUpdating] = useState(false) // Prevent circular updates

  // Format timestamp to be more readable
  const formatTime = (isoString: string | undefined) => {
    if (!isoString) return '-'
    try {
      const date = new Date(isoString)
      return date.toLocaleString()
    } catch (e) {
      return 'Invalid date'
    }
  }

  // State for current market price
  const [currentPrice, setCurrentPrice] = useState<number>(0)

  // Get current price for calculations
  const getCurrentPrice = (): number => {
    const { type, limitPrice } = formData
    if (type === 'limit' || type === 'stop_limit') {
      return limitPrice || 0
    }
    return currentPrice // Use fetched market price for market orders
  }

  // Fetch current price for a symbol
  const fetchCurrentPrice = async (symbol: string) => {
    if (!symbol) return
    
    try {
      // Handle crypto pairs with special formatting
      const formattedSymbol = symbol.includes('/') ? symbol : symbol.toUpperCase()
      
      const response = await fetch(`/api/alpaca/market-data/${formattedSymbol}`)
      const data = await response.json()
      
      if (data && data.price) {
        setCurrentPrice(data.price)
        
        // Update calculations based on new price
        if (formData.qty > 0) {
          calculateFromQty()
        } else if (formData.dollarAmount > 0) {
          calculateFromDollar()
        }
      }
    } catch (error) {
      console.error('Error fetching price:', error)
    }
  }

  // Calculate dollar amount from quantity
  const calculateFromQty = () => {
    if (isUpdating) return
    
    const qty = formData.qty
    const price = getCurrentPrice()
    
    if (qty > 0 && price > 0) {
      setIsUpdating(true)
      setFormData(prev => ({
        ...prev,
        dollarAmount: parseFloat((qty * price).toFixed(2))
      }))
      setIsUpdating(false)
    }
  }
  
  // Calculate quantity from dollar amount
  const calculateFromDollar = () => {
    if (isUpdating) return
    
    const dollarAmount = formData.dollarAmount || 0
    const price = getCurrentPrice()
    
    if (dollarAmount > 0 && price > 0) {
      setIsUpdating(true)
      setFormData(prev => ({
        ...prev,
        qty: Math.floor(dollarAmount / price)
      }))
      setIsUpdating(false)
    }
  }

  // Handle form input changes
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type: inputType } = e.target
    const isCheckbox = inputType === 'checkbox'
    
    if (isCheckbox) {
      const checked = (e.target as HTMLInputElement).checked
      setFormData(prev => ({
        ...prev,
        [name]: checked,
      }))
      return
    }
    
    if (name === 'qty' || name === 'dollarAmount' || name === 'limitPrice' || name === 'stopPrice' || 
        name === 'takeProfitAmount' || name === 'takeProfitPercent') {
      const numValue = parseFloat(value) || 0
      setFormData(prev => ({
        ...prev,
        [name]: numValue,
      }))
      
      // Trigger calculations
      if (name === 'qty') {
        setTimeout(() => calculateFromQty(), 0)
      } else if (name === 'dollarAmount') {
        setTimeout(() => calculateFromDollar(), 0)
      } else if (name === 'limitPrice' || name === 'stopPrice') {
        // Recalculate based on which value was manually entered
        if (formData.dollarAmount && formData.dollarAmount > 0) {
          setTimeout(() => calculateFromDollar(), 0)
        } else {
          setTimeout(() => calculateFromQty(), 0)
        }
      }
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value,
      }))
      
      // If symbol changed, fetch current price
      if (name === 'symbol' && value) {
        // Add a small delay to avoid excessive API calls while typing
        const symbolValue = value.trim()
        if (symbolValue.length > 0) {
          setTimeout(() => fetchCurrentPrice(symbolValue), 500)
        }
      }
    }
  }

  // Add symbol to recent symbols list
  const addToRecentSymbols = (symbol: string) => {
    if (!symbol) return
    
    // Create new array with the current symbol at the beginning
    const updatedSymbols = [symbol]
    
    // Add other symbols, avoiding duplicates and limiting to 5 items
    recentSymbols.forEach(s => {
      if (s !== symbol && updatedSymbols.length < 5) {
        updatedSymbols.push(s)
      }
    })
    
    // Update state and localStorage
    setRecentSymbols(updatedSymbols)
    localStorage.setItem('recentSymbols', JSON.stringify(updatedSymbols))
  }
  
  // Handle symbol shortcut click
  const handleSymbolClick = (symbol: string) => {
    // Set the symbol in the form
    setFormData(prev => ({
      ...prev,
      symbol
    }))
    
    // Fetch current price for the selected symbol
    fetchCurrentPrice(symbol)
  }

  // Handle order submission (buy or sell)
  const handleSubmit = async (side: 'buy' | 'sell') => {
    setIsSubmitting(true)
    setError('')
    
    try {
      // Validate form data
      if (!formData.symbol) {
        throw new Error('Symbol is required')
      }
      
      if (formData.qty <= 0 && formData.dollarAmount <= 0) {
        throw new Error('Quantity or dollar amount must be greater than 0')
      }
      
      if ((formData.type === 'limit') && (!formData.limitPrice || formData.limitPrice <= 0)) {
        throw new Error('Limit price is required for limit orders')
      }
      
      if (formData.type === 'stop_limit') {
        if (!formData.limitPrice || formData.limitPrice <= 0) {
          throw new Error('Limit price is required for stop-limit orders')
        }
        if (!formData.stopPrice || formData.stopPrice <= 0) {
          throw new Error('Stop price is required for stop-limit orders')
        }
      }
      
      // Prepare order data
      const orderData: any = {
        // Handle crypto pairs properly by not forcing uppercase if it contains a slash
        symbol: formData.symbol.includes('/') ? formData.symbol : formData.symbol.toUpperCase(),
        qty: formData.qty,
        side: side, // Use the side passed to the function
        type: formData.type,
        time_in_force: formData.timeInForce,
      }
      
      // Add limit price if needed
      if (formData.type === 'limit' || formData.type === 'stop_limit') {
        orderData.limit_price = formData.limitPrice
      }
      
      // Add stop price if needed
      if (formData.type === 'stop_limit') {
        orderData.stop_price = formData.stopPrice
      }
      
      // Add take profit if enabled
      if (formData.takeProfitEnabled) {
        orderData.take_profit = {
          amount: formData.takeProfitAmount,
          percent: formData.takeProfitPercent
        }
      }
      
      // Add simulated flag if checked
      if (formData.simulated) {
        orderData.simulated = true
      }
      
      // Submit order
      await submitOrder(orderData)
      
      // Add to recent symbols
      if (formData.symbol) {
        addToRecentSymbols(formData.symbol)
      }
      
      // Reset form partially - keep symbol and other settings
      setFormData(prev => ({
        ...prev,
        qty: 100,
        dollarAmount: 1000
      }))
      
    } catch (err: any) {
      setError(err.message || 'Failed to submit order')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Get status badge style based on order status
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

  // Effect to update calculations when order type changes
  useEffect(() => {
    if (formData.type === 'limit' || formData.type === 'stop_limit') {
      if (formData.qty > 0) {
        calculateFromQty()
      } else if (formData.dollarAmount > 0) {
        calculateFromDollar()
      }
    }
  }, [formData.type])

  // Load recent symbols from localStorage on component mount
  useEffect(() => {
    const savedSymbols = localStorage.getItem('recentSymbols')
    if (savedSymbols) {
      try {
        const parsed = JSON.parse(savedSymbols)
        if (Array.isArray(parsed)) {
          setRecentSymbols(parsed)
        }
      } catch (e) {
        console.error('Error parsing recent symbols from localStorage:', e)
      }
    }
  }, [])

  // Handle buy button click
  const handleBuy = (e: React.MouseEvent) => {
    e.preventDefault()
    handleSubmit('buy')
  }
  
  // Handle sell button click
  const handleSell = (e: React.MouseEvent) => {
    e.preventDefault()
    handleSubmit('sell')
  }

  return (
    <div className="flex flex-col h-full p-4">
      <h2 className="text-xl font-semibold mb-4">Orders</h2>
      
      {/* Order Form */}
      <div className="bg-white rounded-lg shadow p-4 mb-4">
        <h3 className="text-lg font-medium mb-3 text-center">Manual Order</h3>
        
        <form>
          {/* First row: Symbol and Time in Force */}
          <div className="flex gap-2 mb-2">
            <div className="flex-grow">
              <div className="flex justify-between">
                <label htmlFor="symbol" className="block text-xs text-gray-700 mb-1">Symbol</label>
                {currentPrice > 0 && (
                  <span className="text-xs text-gray-500">Current Price: ${currentPrice.toFixed(2)}</span>
                )}
              </div>
              <input
                type="text"
                id="symbol"
                name="symbol"
                value={formData.symbol}
                onChange={handleChange}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm"
                placeholder="AAPL or BTC/USD"
              />
            </div>
            
            <div className="w-1/3">
              <label htmlFor="timeInForce" className="block text-xs text-gray-700 mb-1">Time in Force</label>
              <select
                id="timeInForce"
                name="timeInForce"
                value={formData.timeInForce}
                onChange={handleChange}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm"
              >
                <option value="day">DAY</option>
                <option value="gtc">GTC</option>
                <option value="ioc">IOC</option>
                <option value="fok">FOK</option>
              </select>
            </div>
          </div>
          
          {/* Second row: Quantity and Dollar Amount */}
          <div className="flex gap-2 mb-2">
            <div className="flex-grow">
              <label htmlFor="qty" className="block text-xs text-gray-700 mb-1">Quantity (shares)</label>
              <input
                type="number"
                id="qty"
                name="qty"
                value={formData.qty}
                onChange={handleChange}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm"
                placeholder="100"
                min="0"
                step="1"
              />
            </div>
            
            <div className="flex-grow">
              <label htmlFor="dollarAmount" className="block text-xs text-gray-700 mb-1">Dollar Amount</label>
              <input
                type="number"
                id="dollarAmount"
                name="dollarAmount"
                value={formData.dollarAmount}
                onChange={handleChange}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm"
                placeholder="1000.00"
                min="0"
                step="0.01"
              />
            </div>
          </div>
          
          {/* Third row: Order Type */}
          <div className="mb-2">
            <label htmlFor="type" className="block text-xs text-gray-700 mb-1">Order Type</label>
            <select
              id="type"
              name="type"
              value={formData.type}
              onChange={handleChange}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm"
            >
              <option value="market">Market</option>
              <option value="limit">Limit</option>
              <option value="stop_limit">Stop Limit</option>
            </select>
          </div>
          
          {/* Price fields - shown conditionally based on order type */}
          {formData.type === 'stop_limit' && (
            <div className="flex gap-2 mb-2">
              <div className="flex-grow">
                <label htmlFor="stopPrice" className="block text-xs text-gray-700 mb-1">Stop Price</label>
                <input
                  type="number"
                  id="stopPrice"
                  name="stopPrice"
                  value={formData.stopPrice || ''}
                  onChange={handleChange}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm"
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                />
              </div>
              
              <div className="flex-grow">
                <label htmlFor="limitPrice" className="block text-xs text-gray-700 mb-1">Limit Price</label>
                <input
                  type="number"
                  id="limitPrice"
                  name="limitPrice"
                  value={formData.limitPrice || ''}
                  onChange={handleChange}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm"
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                />
              </div>
            </div>
          )}
          
          {formData.type === 'limit' && (
            <div className="mb-2">
              <label htmlFor="limitPrice" className="block text-xs text-gray-700 mb-1">Limit Price</label>
              <input
                type="number"
                id="limitPrice"
                name="limitPrice"
                value={formData.limitPrice || ''}
                onChange={handleChange}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm"
                placeholder="0.00"
                min="0"
                step="0.01"
              />
              <div className="text-xs text-gray-500 mt-1">Used for qty/$ calculations</div>
            </div>
          )}
          
          {/* Take Profit Checkbox */}
          <div className="flex items-center mb-2">
            <input
              type="checkbox"
              id="takeProfitEnabled"
              name="takeProfitEnabled"
              checked={formData.takeProfitEnabled}
              onChange={handleChange}
              className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
            />
            <label htmlFor="takeProfitEnabled" className="ml-2 block text-sm text-gray-700">Take Profit</label>
          </div>
          
          {/* Take Profit Fields - shown conditionally */}
          {formData.takeProfitEnabled && (
            <div className="flex gap-2 mb-2 pl-6">
              <div className="flex-grow">
                <label htmlFor="takeProfitAmount" className="block text-xs text-gray-700 mb-1">TP Amount ($)</label>
                <input
                  type="number"
                  id="takeProfitAmount"
                  name="takeProfitAmount"
                  value={formData.takeProfitAmount}
                  onChange={handleChange}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm"
                  placeholder="5.00"
                  min="0"
                  step="0.01"
                />
              </div>
              
              <div className="flex-grow">
                <label htmlFor="takeProfitPercent" className="block text-xs text-gray-700 mb-1">TP Percent (%)</label>
                <input
                  type="number"
                  id="takeProfitPercent"
                  name="takeProfitPercent"
                  value={formData.takeProfitPercent}
                  onChange={handleChange}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm"
                  placeholder="2.5"
                  min="0"
                  step="0.1"
                />
              </div>
            </div>
          )}
          
          {/* Simulated Checkbox */}
          <div className="flex items-center mb-4">
            <input
              type="checkbox"
              id="simulated"
              name="simulated"
              checked={formData.simulated}
              onChange={handleChange}
              className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
            />
            <label htmlFor="simulated" className="ml-2 block text-sm text-gray-700">Simulated</label>
          </div>
          
          {/* Error message */}
          {error && (
            <div className="mb-4 p-2 bg-red-100 text-red-800 rounded text-sm">
              {error}
            </div>
          )}
          
          {/* Buy/Sell Buttons */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleBuy}
              disabled={isSubmitting}
              className="flex-1 py-2 px-4 bg-green-600 hover:bg-green-700 text-white font-bold rounded focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 transition-colors"
            >
              {isSubmitting ? 'Processing...' : 'BUY'}
            </button>
            
            <button
              type="button"
              onClick={handleSell}
              disabled={isSubmitting}
              className="flex-1 py-2 px-4 bg-red-600 hover:bg-red-700 text-white font-bold rounded focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 transition-colors"
            >
              {isSubmitting ? 'Processing...' : 'SELL'}
            </button>
          </div>
          
          {/* Recent Symbols Shortcuts */}
          {recentSymbols.length > 0 && (
            <div className="mt-3">
              <div className="text-xs text-gray-500 mb-1">Recent Symbols:</div>
              <div className="flex flex-wrap gap-1">
                {recentSymbols.map((symbol) => (
                  <button
                    key={symbol}
                    type="button"
                    onClick={() => handleSymbolClick(symbol)}
                    className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-800 rounded border border-gray-300 transition-colors"
                  >
                    {symbol}
                  </button>
                ))}
              </div>
            </div>
          )}
        </form>
      </div>
      
      {/* Orders Table */}
      <div className="flex-1 overflow-auto bg-white rounded-lg shadow">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50 sticky top-0">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Symbol</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Side</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Qty</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Filled</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Artificial</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {orders.length > 0 ? (
              orders.map((order) => (
                <tr key={order.id} className="hover:bg-gray-50">
                  <td className="px-6 py-2 whitespace-nowrap text-sm font-medium text-gray-900">
                    {order.symbol}
                  </td>
                  <td className="px-6 py-2 whitespace-nowrap text-sm text-gray-500">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${order.side === 'buy' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {order.side.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-6 py-2 whitespace-nowrap text-sm text-gray-500">
                    {order.qty}
                  </td>
                  <td className="px-6 py-2 whitespace-nowrap text-sm text-gray-500">
                    {order.type}
                  </td>
                  <td className="px-6 py-2 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusStyle(order.status)}`}>
                      {order.status}
                    </span>
                  </td>
                  <td className="px-6 py-2 whitespace-nowrap text-sm text-gray-500">
                    {formatTime(order.created_at)}
                  </td>
                  <td className="px-6 py-2 whitespace-nowrap text-sm text-gray-500">
                    {order.filled_at ? formatTime(order.filled_at) : '-'}
                  </td>
                  <td className="px-6 py-2 whitespace-nowrap text-sm text-gray-500">
                    {order.is_artificial ? 'Yes' : 'No'}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={8} className="px-6 py-4 text-center text-sm text-gray-500">
                  No orders found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default OrdersPanel
