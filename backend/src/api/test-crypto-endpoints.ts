/**
 * test-crypto-endpoints.ts
 * 
 * Test script to verify crypto API endpoints are working correctly
 * This script tests the crypto data endpoints using the Alpaca data API
 */

import axios from 'axios';

const API_KEY = 'PKKON5IWMWKI301U6ZHG';
const SECRET_KEY = 'JOdYOotkvgfZR9mzU3p76o606YUrj3Vu7TemnC4H';

async function testCryptoSnapshots() {
  console.log('Testing crypto snapshots...');
  try {
    const response = await axios.get('https://data.alpaca.markets/v1beta3/crypto/us/snapshots', {
      params: { symbols: 'BTC/USD,ETH/USD' },
      headers: {
        'APCA-API-KEY-ID': API_KEY,
        'APCA-API-SECRET-KEY': SECRET_KEY,
        'Accept': 'application/json'
      }
    });
    console.log('Crypto snapshots response:', JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error('Error testing crypto snapshots:', error.response?.data || error.message);
  }
}

async function testCryptoBars() {
  console.log('\nTesting crypto bars...');
  try {
    const response = await axios.get('https://data.alpaca.markets/v1beta3/crypto/us/bars', {
      params: {
        symbols: 'BTC/USD',
        timeframe: '5Min',
        limit: 10,
        sort: 'asc'
      },
      headers: {
        'APCA-API-KEY-ID': API_KEY,
        'APCA-API-SECRET-KEY': SECRET_KEY,
        'Accept': 'application/json'
      }
    });
    console.log('Crypto bars response:', JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error('Error testing crypto bars:', error.response?.data || error.message);
  }
}

async function testStockBars() {
  console.log('\nTesting stock bars...');
  try {
    const start = new Date();
    start.setDate(start.getDate() - 7); // 7 days ago
    
    const response = await axios.get('https://data.alpaca.markets/v2/stocks/bars', {
      params: {
        symbols: 'AAPL',
        timeframe: '5Min',
        start: start.toISOString(),
        limit: 10,
        adjustment: 'raw',
        feed: 'sip',
        sort: 'asc'
      },
      headers: {
        'APCA-API-KEY-ID': API_KEY,
        'APCA-API-SECRET-KEY': SECRET_KEY,
        'Accept': 'application/json'
      }
    });
    console.log('Stock bars response:', JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error('Error testing stock bars:', error.response?.data || error.message);
  }
}

async function testBackendEndpoints() {
  console.log('\nTesting backend endpoints...');
  
  try {
    // Test market data endpoint for crypto
    console.log('Testing backend crypto market data...');
    const cryptoResponse = await axios.get('http://localhost:9000/api/alpaca/market-data/BTC/USD');
    console.log('Backend crypto response:', JSON.stringify(cryptoResponse.data, null, 2));
  } catch (error) {
    console.error('Error testing backend crypto endpoint:', error.response?.data || error.message);
  }

  try {
    // Test market data endpoint for stock
    console.log('\nTesting backend stock market data...');
    const stockResponse = await axios.get('http://localhost:9000/api/alpaca/market-data/AAPL');
    console.log('Backend stock response:', JSON.stringify(stockResponse.data, null, 2));
  } catch (error) {
    console.error('Error testing backend stock endpoint:', error.response?.data || error.message);
  }

  try {
    // Test price history endpoint for crypto
    console.log('\nTesting backend crypto price history...');
    const start = new Date();
    start.setDate(start.getDate() - 7);
    
    const priceHistoryResponse = await axios.get('http://localhost:9000/api/alpaca/price-history/BTC/USD', {
      params: {
        timeframe: '1Day',
        start: start.toISOString(),
        limit: 10
      }
    });
    console.log('Backend crypto price history response:', JSON.stringify(priceHistoryResponse.data, null, 2));
  } catch (error) {
    console.error('Error testing backend crypto price history:', error.response?.data || error.message);
  }
}

async function runTests() {
  console.log('Starting API tests...\n');
  
  // Test direct Alpaca API calls
  await testCryptoSnapshots();
  await testCryptoBars();
  await testStockBars();
  
  // Test backend endpoints
  await testBackendEndpoints();
  
  console.log('\nTests completed!');
}

// Run the tests
runTests().catch(console.error);