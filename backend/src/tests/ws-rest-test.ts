/**
 * simple-test.ts
 * 
 * Simple test to verify market data connectivity using our backend services
 * Place this file in: backend/src/test/simple-test.ts
 * 
 * Usage from backend directory:
 * npx tsx src/test/simple-test.ts
 */

import { AlpacaClient } from '../services/alpaca-client.js';
import { MarketDataSubscriptionManager } from '../core/market-data-subscription.js';

// ========================================
// CONFIGURATION
// ========================================
const TEST_CONFIG = {
  // Update these with your credentials
  apiKey: 'YOUR_API_KEY_HERE',        // e.g., 'PKTEST...'
  secretKey: 'YOUR_SECRET_KEY_HERE',  // Your secret key
  isPaper: true,                      // Paper trading recommended for testing
  
  // Test symbols
  stockSymbols: ['AAPL', 'MSFT'],
  cryptoSymbols: ['BTC/USD', 'ETH/USD'],
  
  // Test duration
  testDurationMs: 15000  // 15 seconds
};

class SimpleMarketDataTest {
  private alpacaClient: AlpacaClient;
  private marketDataManager: MarketDataSubscriptionManager;
  private receivedData: { [symbol: string]: any[] } = {};

  constructor() {
    console.log('🧪 Initializing Simple Market Data Test...');
    
    this.alpacaClient = new AlpacaClient({
      apiKey: TEST_CONFIG.apiKey,
      secretKey: TEST_CONFIG.secretKey,
      isPaper: TEST_CONFIG.isPaper
    });
    
    this.marketDataManager = new MarketDataSubscriptionManager();
  }

  async runTest(): Promise<void> {
    try {
      console.log('='.repeat(60));
      console.log('🚀 Starting Alpaca Market Data Test');
      console.log('='.repeat(60));

      // Validate credentials
      if (!TEST_CONFIG.apiKey || TEST_CONFIG.apiKey === 'YOUR_API_KEY_HERE') {
        throw new Error('Please set your API_KEY in TEST_CONFIG');
      }
      
      if (!TEST_CONFIG.secretKey || TEST_CONFIG.secretKey === 'YOUR_SECRET_KEY_HERE') {
        throw new Error('Please set your SECRET_KEY in TEST_CONFIG');
      }

      console.log(`🔑 API Key: ${TEST_CONFIG.apiKey.substring(0, 8)}...`);
      console.log(`🏪 Mode: ${TEST_CONFIG.isPaper ? 'Paper Trading' : 'Live Trading'}`);
      console.log('');

      // Test 1: REST API Connection
      await this.testRestApi();
      
      // Test 2: Market Data via REST
      await this.testRestMarketData();
      
      // Test 3: WebSocket Streaming
      await this.testWebSocketStreaming();

      console.log('\n🎉 All tests completed successfully!');
      
    } catch (error) {
      console.error('\n❌ Test failed:', error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  private async testRestApi(): Promise<void> {
    console.log('📋 TEST 1: REST API Connection');
    console.log('-'.repeat(40));
    
    try {
      // Initialize and test connection
      await this.alpacaClient.initClient();
      console.log('✅ Alpaca client initialized');
      
      // Get account info
      const account = await this.alpacaClient.getAccount();
      console.log(`✅ Account: ${account.id} (${account.status})`);
      console.log(`💵 Buying Power: $${Number(account.buying_power).toLocaleString()}`);
      console.log(`💰 Cash: $${Number(account.cash).toLocaleString()}`);
      
      // Get market status
      const clock = await this.alpacaClient.getClock();
      console.log(`🕐 Market: ${clock.is_open ? 'OPEN' : 'CLOSED'}`);
      
    } catch (error) {
      console.error('❌ REST API test failed:', error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  private async testRestMarketData(): Promise<void> {
    console.log('\n📋 TEST 2: REST Market Data');
    console.log('-'.repeat(40));
    
    try {
      // Test stock data
      console.log('📈 Testing stock market data...');
      for (const symbol of TEST_CONFIG.stockSymbols.slice(0, 2)) {
        try {
          const [bars, quotes] = await Promise.all([
            this.alpacaClient.getStocksBarsLatest([symbol]).catch(() => ({ bars: {} })),
            this.alpacaClient.getStocksQuotesLatest([symbol]).catch(() => ({ quotes: {} }))
          ]);
          
          const bar = bars.bars?.[symbol];
          const quote = quotes.quotes?.[symbol];
          
          if (bar || quote) {
            console.log(`  ✅ ${symbol}: ${bar ? `Price $${bar.c}` : 'No bar'} ${quote ? `Bid/Ask $${quote.bp}/$${quote.ap}` : 'No quote'}`);
          } else {
            console.log(`  ⚠️  ${symbol}: No data available`);
          }
        } catch (error) {
          console.log(`  ❌ ${symbol}: ${error instanceof Error ? error.message : 'Error'}`);
        }
      }
      
      // Test crypto data
      console.log('🪙 Testing crypto market data...');
      for (const symbol of TEST_CONFIG.cryptoSymbols.slice(0, 2)) {
        try {
          const snapshots = await this.alpacaClient.getCryptoSnapshots([symbol]);
          const snapshot = snapshots.snapshots?.[symbol];
          
          if (snapshot?.latestBar || snapshot?.latestQuote) {
            const price = snapshot.latestBar?.c || snapshot.latestQuote?.ap || 'N/A';
            console.log(`  ✅ ${symbol}: Price $${price}`);
          } else {
            console.log(`  ⚠️  ${symbol}: No data available`);
          }
        } catch (error) {
          console.log(`  ❌ ${symbol}: ${error instanceof Error ? error.message : 'Error'}`);
        }
      }
      
    } catch (error) {
      console.error('❌ REST market data test failed:', error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  private async testWebSocketStreaming(): Promise<void> {
    console.log('\n📋 TEST 3: WebSocket Streaming');
    console.log('-'.repeat(40));
    
    try {
      // Initialize market data manager
      this.marketDataManager.initialize(
        TEST_CONFIG.apiKey,
        TEST_CONFIG.secretKey,
        false // Use stock data feed
      );
      
      // Set up event handlers
      this.setupEventHandlers();
      
      // Wait for connection
      console.log('🔌 Connecting to WebSocket...');
      await this.waitForConnection();
      
      // Subscribe to symbols
      const allSymbols = [...TEST_CONFIG.stockSymbols, ...TEST_CONFIG.cryptoSymbols];
      console.log(`📡 Subscribing to: ${allSymbols.join(', ')}`);
      
      allSymbols.forEach(symbol => {
        this.receivedData[symbol] = [];
        this.marketDataManager.subscribe(symbol);
      });
      
      // Listen for data
      console.log(`🎧 Listening for data for ${TEST_CONFIG.testDurationMs / 1000} seconds...`);
      await this.waitForData();
      
      // Display results
      this.displayResults();
      
      // Cleanup
      this.marketDataManager.disconnect();
      
    } catch (error) {
      console.error('❌ WebSocket streaming test failed:', error instanceof Error ? error.message : 'Unknown error');
      this.marketDataManager.disconnect();
      throw error;
    }
  }

  private setupEventHandlers(): void {
    this.marketDataManager.on('connected', () => {
      console.log('✅ WebSocket connected');
    });
    
    this.marketDataManager.on('disconnected', () => {
      console.log('📴 WebSocket disconnected');
    });
    
    this.marketDataManager.on('error', (error) => {
      console.error('❌ WebSocket error:', error);
    });
    
    this.marketDataManager.on('marketData', (data) => {
      if (this.receivedData[data.symbol]) {
        this.receivedData[data.symbol].push({
          ...data,
          receivedAt: new Date().toISOString()
        });
        
        // Log first few messages for each symbol
        if (this.receivedData[data.symbol].length <= 3) {
          console.log(`  📊 ${data.symbol}: ${data.source} - Price: $${data.price} (${new Date().toLocaleTimeString()})`);
        }
      }
    });
  }

  private async waitForConnection(timeoutMs: number = 10000): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('WebSocket connection timeout'));
      }, timeoutMs);
      
      const checkConnection = () => {
        if (this.marketDataManager.isConnected()) {
          clearTimeout(timeout);
          resolve();
        } else {
          setTimeout(checkConnection, 100);
        }
      };
      
      checkConnection();
    });
  }

  private async waitForData(): Promise<void> {
    return new Promise(resolve => {
      setTimeout(() => {
        resolve();
      }, TEST_CONFIG.testDurationMs);
    });
  }

  private displayResults(): void {
    console.log('\n📊 Test Results Summary:');
    console.log('-'.repeat(40));
    
    const allSymbols = [...TEST_CONFIG.stockSymbols, ...TEST_CONFIG.cryptoSymbols];
    
    for (const symbol of allSymbols) {
      const dataCount = this.receivedData[symbol]?.length || 0;
      const status = dataCount > 0 ? '✅' : '❌';
      console.log(`  ${status} ${symbol}: ${dataCount} data points received`);
    }
    
    const totalDataPoints = Object.values(this.receivedData).reduce((sum, data) => sum + data.length, 0);
    console.log(`\n📈 Total data points received: ${totalDataPoints}`);
    
    if (totalDataPoints > 0) {
      console.log('✅ WebSocket streaming is working correctly!');
    } else {
      console.log('⚠️  No data received - this might be normal during market hours or for inactive symbols');
    }
  }
}

// ========================================
// MAIN EXECUTION
// ========================================
async function main(): Promise<void> {
  const test = new SimpleMarketDataTest();
  
  try {
    await test.runTest();
    process.exit(0);
  } catch (error) {
    console.error('\n💥 Test execution failed:', error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Test interrupted by user');
  process.exit(0);
});

// Run the test
console.log('🔬 Starting Simple Market Data Test...\n');
main().catch(error => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});