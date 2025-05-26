/**
 * App.tsx
 * Main application component
 * Implements the FlexLayout-based UI with configurable tabs and dark mode support
 * Location: frontend/src/App.tsx
 * Responsibilities: Layout management, component routing, theme initialization, WebSocket connection
 */

import { useEffect, useState } from 'react'
import { Layout, Model, TabNode, IJsonModel } from 'flexlayout-react'
import 'flexlayout-react/style/light.css'
import { useAppStore } from './store/appStore'
import ConnectionStatus from './components/ConnectionStatus'
import LogsPanel from './components/LogsPanel'
import OrdersPanel from './components/OrdersPanel'
import TradeLogPanel from './components/TradeLogPanel'
import ConfigPanel from './components/ConfigPanel'
import MarketDataPanel from './components/MarketDataPanel'
import Header from './components/Header'

// Initial layout model for FlexLayout
const initialModel: IJsonModel = {
  global: {
    tabEnableFloat: false,
    tabSetEnableMaximize: true,
    splitterSize: 4,
  },
  borders: [],
  layout: {
    type: 'row',
    weight: 100,
    children: [
      {
        type: 'tabset',
        weight: 50,
        children: [
          {
            type: 'tab',
            name: 'Connection Status',
            component: 'connection-status',
          },
          {
            type: 'tab',
            name: 'Logs',
            component: 'logs',
          },
        ],
      },
      {
        type: 'row',
        weight: 50,
        children: [
          {
            type: 'tabset',
            weight: 33,
            children: [
              {
                type: 'tab',
                name: 'Orders',
                component: 'orders',
              },
            ],
          },
          {
            type: 'tabset',
            weight: 33,
            children: [
              {
                type: 'tab',
                name: 'Trade Log',
                component: 'trade-log',
              },
              {
                type: 'tab',
                name: 'Market Data',
                component: 'market-data',
              },
            ],
          },
          {
            type: 'tabset',
            weight: 34,
            children: [
              {
                type: 'tab',
                name: 'Configuration',
                component: 'config',
              },
            ],
          },
        ],
      },
    ],
  },
}

function App() {
  const [model] = useState(Model.fromJson(initialModel))
  const { initWebSocket } = useAppStore()
  const [theme, setTheme] = useState<'light' | 'dark'>('light')

  useEffect(() => {
    // Initialize theme
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null
    if (savedTheme) {
      setTheme(savedTheme)
    } else {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      setTheme(prefersDark ? 'dark' : 'light')
    }
    
    // Initialize WebSocket connection when component mounts
    initWebSocket()

    // Cleanup WebSocket connection when component unmounts
    return () => {
      // Close WebSocket connection
    }
  }, [])

  // Save theme to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('theme', theme)
    if (theme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [theme])

  // Factory function to create components based on component type
  const factory = (node: TabNode) => {
    const component = node.getComponent()
    
    switch (component) {
      case 'connection-status':
        return <ConnectionStatus />
      case 'logs':
        return <LogsPanel />
      case 'orders':
        return <OrdersPanel />
      case 'trade-log':
        return <TradeLogPanel />
      case 'market-data':
        return <MarketDataPanel />
      case 'config':
        return <ConfigPanel />
      default:
        return <div className="p-4">Component not found: {component}</div>
    }
  }

  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light')
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      <Header onToggleTheme={toggleTheme} currentTheme={theme} />
      <div className="flex-1 overflow-hidden h-full">
        <Layout
          model={model}
          factory={factory}
          classNameMapper={(className) => {
            // Map FlexLayout classes to our Tailwind classes
            if (className.includes('flexlayout__tab')) {
              return `${className} ${theme === 'dark' ? 'dark' : ''}`;
            }
            return className;
          }}
        />
      </div>
    </div>
  )
}

export default App
