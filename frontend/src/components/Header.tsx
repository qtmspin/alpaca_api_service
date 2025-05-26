/**
 * Header.tsx
 * Main application header component
 * Displays application title, connection status indicators, and theme toggle
 * Location: frontend/src/components/Header.tsx
 * Responsibilities: Display app title, connection status, and theme toggle button
 */

import { useAppStore } from '../store/appStore'

interface HeaderProps {
  onToggleTheme?: () => void;
  currentTheme?: 'light' | 'dark';
}

const Header = ({ onToggleTheme, currentTheme = 'light' }: HeaderProps) => {
  const { wsConnection, alpacaStatus, clientStatus } = useAppStore()

  return (
    <header className="bg-primary-700 text-white p-4 shadow-md">
      <div className="container mx-auto flex justify-between items-center">
        <h1 className="text-xl font-bold">Alpaca API Service</h1>
        
        <div className="flex items-center space-x-4">
          <div className="flex items-center">
            <span className="mr-2">WebSocket:</span>
            <span className={`status-indicator ${wsConnection === 'connected' ? 'status-connected' : wsConnection === 'connecting' ? 'status-connecting' : 'status-disconnected'}`}>
              {wsConnection === 'connected' ? 'Connected' : wsConnection === 'connecting' ? 'Connecting' : 'Disconnected'}
            </span>
          </div>
          
          <div className="flex items-center">
            <span className="mr-2">Alpaca:</span>
            <span className={`status-indicator ${alpacaStatus.connected ? 'status-connected' : 'status-disconnected'}`}>
              {alpacaStatus.connected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
          
          <div className="flex items-center">
            <span className="mr-2">Client:</span>
            <span className={`status-indicator ${clientStatus.connected ? 'status-connected' : 'status-disconnected'}`}>
              {clientStatus.connected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
          
          {onToggleTheme && (
            <button 
              onClick={onToggleTheme}
              className="ml-4 p-2 rounded-full bg-primary-600 hover:bg-primary-500 transition-colors duration-200"
              aria-label={`Switch to ${currentTheme === 'light' ? 'dark' : 'light'} mode`}
            >
              {currentTheme === 'light' ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
                </svg>
              )}
            </button>
          )}
        </div>
      </div>
    </header>
  )
}

export default Header
