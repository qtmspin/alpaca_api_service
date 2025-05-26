/**
 * ConfigPanel.tsx
 * Allows users to configure application settings
 * Manages settings like shorting enabled, duplicate trade detection, max notional size, and max quantity
 */

import { useState } from 'react'
import { useAppStore } from '../store/appStore'

const ConfigPanel = () => {
  const { config, updateConfig } = useAppStore()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  
  // Local state for form values
  const [formValues, setFormValues] = useState({
    shortingEnabled: config.shortingEnabled,
    duplicateTradeDetection: config.duplicateTradeDetection,
    maxNotionalSize: config.maxNotionalSize,
    maxQty: config.maxQty,
  })

  // Handle form input changes
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target
    
    setFormValues({
      ...formValues,
      [name]: type === 'checkbox' ? checked : type === 'number' ? parseFloat(value) : value,
    })
  }

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError('')
    setSuccess(false)
    
    try {
      // Validate form values
      if (formValues.maxNotionalSize <= 0) {
        throw new Error('Max notional size must be greater than 0')
      }
      
      if (formValues.maxQty <= 0) {
        throw new Error('Max quantity must be greater than 0')
      }
      
      // Update configuration
      await updateConfig(formValues)
      
      // Show success message
      setSuccess(true)
      
      // Hide success message after 3 seconds
      setTimeout(() => {
        setSuccess(false)
      }, 3000)
      
    } catch (err: any) {
      setError(err.message || 'Failed to update configuration')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col h-full p-4">
      <h2 className="text-xl font-semibold mb-6">Configuration</h2>
      
      <div className="bg-white rounded-lg shadow p-6 max-w-3xl">
        <form onSubmit={handleSubmit}>
          <div className="space-y-6">
            {/* Trading Settings */}
            <div>
              <h3 className="text-lg font-medium mb-4">Trading Settings</h3>
              
              <div className="space-y-4">
                {/* Shorting Enabled */}
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="shortingEnabled"
                    name="shortingEnabled"
                    checked={formValues.shortingEnabled}
                    onChange={handleChange}
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  />
                  <label htmlFor="shortingEnabled" className="ml-2 block text-sm text-gray-700">
                    Enable Shorting
                  </label>
                </div>
                
                {/* Duplicate Trade Detection */}
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="duplicateTradeDetection"
                    name="duplicateTradeDetection"
                    checked={formValues.duplicateTradeDetection}
                    onChange={handleChange}
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  />
                  <label htmlFor="duplicateTradeDetection" className="ml-2 block text-sm text-gray-700">
                    Enable Duplicate Trade Detection
                  </label>
                </div>
              </div>
            </div>
            
            {/* Risk Management */}
            <div>
              <h3 className="text-lg font-medium mb-4">Risk Management</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Max Notional Size */}
                <div>
                  <label htmlFor="maxNotionalSize" className="block text-sm font-medium text-gray-700 mb-1">
                    Max Notional Size ($)
                  </label>
                  <input
                    type="number"
                    id="maxNotionalSize"
                    name="maxNotionalSize"
                    value={formValues.maxNotionalSize}
                    onChange={handleChange}
                    min="1"
                    step="1"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    required
                  />
                  <p className="mt-1 text-sm text-gray-500">
                    Maximum dollar amount per order
                  </p>
                </div>
                
                {/* Max Quantity */}
                <div>
                  <label htmlFor="maxQty" className="block text-sm font-medium text-gray-700 mb-1">
                    Max Quantity
                  </label>
                  <input
                    type="number"
                    id="maxQty"
                    name="maxQty"
                    value={formValues.maxQty}
                    onChange={handleChange}
                    min="1"
                    step="1"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    required
                  />
                  <p className="mt-1 text-sm text-gray-500">
                    Maximum shares per order
                  </p>
                </div>
              </div>
            </div>
          </div>
          
          {/* Error and Success Messages */}
          {error && (
            <div className="mt-4 p-2 bg-red-100 text-red-800 rounded">
              {error}
            </div>
          )}
          
          {success && (
            <div className="mt-4 p-2 bg-green-100 text-green-800 rounded">
              Configuration updated successfully!
            </div>
          )}
          
          {/* Submit Button */}
          <div className="mt-6">
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50"
            >
              {isSubmitting ? 'Saving...' : 'Save Configuration'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default ConfigPanel
