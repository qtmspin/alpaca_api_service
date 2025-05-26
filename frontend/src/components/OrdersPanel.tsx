/**
 * OrdersPanel.tsx
 * Displays and manages orders, including artificial orders
 * Allows creating new orders with different types (market, limit, stop, etc.)
 */

import { useState } from 'react'
import { useAppStore } from '../store/appStore'

type OrderFormData = {
  symbol: string
  qty: number
  side: 'buy' | 'sell'
  type: 'market' | 'limit' | 'stop' | 'stop_limit'
  limitPrice?: number
  stopPrice?: number
  timeInForce: 'day' | 'gtc' | 'ioc' | 'opg'
}

const OrdersPanel = () => {
  const { orders, submitOrder } = useAppStore()
  const [formData, setFormData] = useState<OrderFormData>({
    symbol: '',
    qty: 1,
    side: 'buy',
    type: 'market',
    timeInForce: 'day',
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

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

  // Handle form input changes
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    
    if (name === 'qty' || name === 'limitPrice' || name === 'stopPrice') {
      setFormData({
        ...formData,
        [name]: parseFloat(value) || 0,
      })
    } else {
      setFormData({
        ...formData,
        [name]: value,
      })
    }
  }

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError('')
    
    try {
      // Validate form data
      if (!formData.symbol) {
        throw new Error('Symbol is required')
      }
      
      if (formData.qty <= 0) {
        throw new Error('Quantity must be greater than 0')
      }
      
      if ((formData.type === 'limit' || formData.type === 'stop_limit') && (!formData.limitPrice || formData.limitPrice <= 0)) {
        throw new Error('Limit price is required for limit orders')
      }
      
      if ((formData.type === 'stop' || formData.type === 'stop_limit') && (!formData.stopPrice || formData.stopPrice <= 0)) {
        throw new Error('Stop price is required for stop orders')
      }
      
      // Prepare order data
      const orderData: any = {
        symbol: formData.symbol.toUpperCase(),
        qty: formData.qty,
        side: formData.side,
        type: formData.type,
        time_in_force: formData.timeInForce,
      }
      
      if (formData.type === 'limit' || formData.type === 'stop_limit') {
        orderData.limit_price = formData.limitPrice
      }
      
      if (formData.type === 'stop' || formData.type === 'stop_limit') {
        orderData.stop_price = formData.stopPrice
      }
      
      // Submit order
      await submitOrder(orderData)
      
      // Reset form
      setFormData({
        ...formData,
        qty: 1,
      })
      
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

  return (
    <div className="flex flex-col h-full p-4">
      <h2 className="text-xl font-semibold mb-4">Orders</h2>
      
      {/* Order Form */}
      <div className="bg-white rounded-lg shadow p-4 mb-4">
        <h3 className="text-lg font-medium mb-3">New Order</h3>
        
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
            {/* Symbol */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Symbol</label>
              <input
                type="text"
                name="symbol"
                value={formData.symbol}
                onChange={handleChange}
                placeholder="AAPL"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                required
                aria-label="Stock symbol"
                title="Enter the stock symbol (e.g., AAPL for Apple)"
              />
            </div>
            
            {/* Quantity */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
              <input
                type="number"
                name="qty"
                value={formData.qty}
                onChange={handleChange}
                min="1"
                step="1"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                required
              />
            </div>
            
            {/* Side */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Side</label>
              <select
                name="side"
                value={formData.side}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                aria-label="Order side"
              >
                <option value="buy">Buy</option>
                <option value="sell">Sell</option>
              </select>
            </div>
            
            {/* Order Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Order Type</label>
              <select
                name="type"
                value={formData.type}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                aria-label="Order type"
              >
                <option value="market">Market</option>
                <option value="limit">Limit</option>
                <option value="stop">Stop</option>
                <option value="stop_limit">Stop Limit</option>
              </select>
            </div>
            
            {/* Limit Price (only for limit and stop_limit orders) */}
            {(formData.type === 'limit' || formData.type === 'stop_limit') && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1" aria-label="Limit Price" title="Enter the limit price for your order">Limit Price</label>
                <input
                  type="number"
                  name="limitPrice"
                  value={formData.limitPrice || ''}
                  onChange={handleChange}
                  min="0.01"
                  step="0.01"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  required
                  aria-label="Limit Price"
                  title="Enter the limit price for your order"
                />
              </div>
            )}
            
            {/* Stop Price (only for stop and stop_limit orders) */}
            {(formData.type === 'stop' || formData.type === 'stop_limit') && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1" aria-label="Stop Price" title="Enter the stop price for your order">Stop Price</label>
                <input
                  type="number"
                  name="stopPrice"
                  value={formData.stopPrice || ''}
                  onChange={handleChange}
                  min="0.01"
                  step="0.01"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  required
                  aria-label="Stop Price"
                  title="Enter the stop price for your order"
                />
              </div>
            )}
            
            {/* Time in Force */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1" aria-label="Time in Force" title="Select the time in force for your order">Time in Force</label>
              <select
                name="timeInForce"
                value={formData.timeInForce}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                aria-label="Time in force"
              >
                <option value="day">Day</option>
                <option value="gtc">Good Till Canceled</option>
                <option value="ioc">Immediate or Cancel</option>
                <option value="opg">Market on Open</option>
              </select>
            </div>
          </div>
          
          {error && (
            <div className="mb-4 p-2 bg-red-100 text-red-800 rounded">
              {error}
            </div>
          )}
          
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50"
          >
            {isSubmitting ? 'Submitting...' : 'Submit Order'}
          </button>
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
