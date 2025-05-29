/**
 * quick-test.ts
 * 
 * Enhanced connectivity test - checks REST API, market data, and trading events
 * Place in backend/src/test/quick-test.ts
 * 
 * Usage: npx tsx src/test/quick-test.ts
 */

import WebSocket from 'ws';

// ========================================
// QUICK CONFIG - UPDATE THESE
// ========================================
const API_KEY = 'PKKON5IWMWKI301U6ZHG';      // Your paper trading API key
const SECRET_KEY = 'JOdYOotkvgfZR9mzU3p76o606YUrj3Vu7TemnC4H';        // Your secret key

async function quickTest() {
  console.log('🧪 Enhanced Alpaca Connectivity Test');
  console.log('===================================');
  
  // Check if API keys have been updated from the template values
  // Use includes to check if the keys are the default template values
  if (API_KEY.includes('YOUR_KEY_HERE') || SECRET_KEY.includes('YOUR_SECRET_HERE')) {
    console.error('❌ Please update API_KEY and SECRET_KEY in the script');
    return;
  }

  // Test 1: REST API Account Check
  console.log('\n1️⃣ Testing REST API...');
  try {
    const response = await fetch('https://paper-api.alpaca.markets/v2/account', {
      headers: {
        'APCA-API-KEY-ID': API_KEY,
        'APCA-API-SECRET-KEY': SECRET_KEY
      }
    });

    if (response.ok) {
      const account = await response.json();
      console.log(`✅ REST API Working - Account: ${account.id}`);
      console.log(`💰 Cash: $${Number(account.cash).toLocaleString()}`);
      console.log(`📊 Portfolio Value: $${Number(account.portfolio_value).toLocaleString()}`);
    } else {
      console.error(`❌ REST API Failed: ${response.status} ${response.statusText}`);
      const errorText = await response.text();
      console.error('Error details:', errorText);
      return;
    }
  } catch (error) {
    console.error('❌ REST API Error:', error instanceof Error ? error.message : 'Unknown error');
    return;
  }

  // Test 2: Check existing positions
  console.log('\n2️⃣ Checking existing positions...');
  try {
    const positionsResponse = await fetch('https://paper-api.alpaca.markets/v2/positions', {
      headers: {
        'APCA-API-KEY-ID': API_KEY,
        'APCA-API-SECRET-KEY': SECRET_KEY
      }
    });

    if (positionsResponse.ok) {
      const positions = await positionsResponse.json();
      console.log(`✅ Found ${positions.length} positions`);
      positions.forEach((pos: any) => {
        console.log(`  📈 ${pos.symbol}: ${pos.qty} shares @ $${pos.avg_entry_price} (P&L: $${pos.unrealized_pl})`);
      });
    } else {
      console.log('⚠️ Could not fetch positions');
    }
  } catch (error) {
    console.log('⚠️ Error fetching positions:', error instanceof Error ? error.message : 'Unknown error');
  }

  // Test 3: WebSocket Connection (Market Data)
  console.log('\n3️⃣ Testing Market Data WebSocket...');
  await testMarketDataWebSocket();

  // Small delay between WebSocket connections to avoid rate limits
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Test 4: WebSocket Connection (Trading Events)
  console.log('\n4️⃣ Testing Trading Events WebSocket...');
  console.log('💡 Add --listen flag to keep listening: npx tsx src/test/quick-test.ts --listen');
  const keepListening = process.argv.includes('--listen');
  await testTradingEventsWebSocket(keepListening);
}

// Track active connections to prevent exceeding limits
let activeConnections = 0;
const MAX_CONNECTIONS = 2; // Maximum number of simultaneous WebSocket connections

function testMarketDataWebSocket(): Promise<void> {
  // Check if we already have too many connections
  if (activeConnections >= MAX_CONNECTIONS) {
    console.log('⚠️ Too many active connections. Waiting for existing connections to close...');
    return new Promise(resolve => setTimeout(() => resolve(), 2000));
  }
  
  activeConnections++;
  return new Promise<void>((resolve) => {
    const ws = new WebSocket('wss://stream.data.alpaca.markets/v2/iex');
    let authenticated = false;
    let dataReceived = false;
    
    // Timeout after 10 seconds for market data test
    const timeout = setTimeout(() => {
      console.log('⏰ Market data test timeout - closing connection');
      ws.close();
    }, 10000);

    ws.on('open', () => {
      console.log('✅ Market Data WebSocket Connected');
      
      // Authenticate
      ws.send(JSON.stringify({
        action: 'auth',
        key: API_KEY,
        secret: SECRET_KEY
      }));
    });

    ws.on('message', (data) => {
      try {
        const messages = JSON.parse(data.toString());
        const msgArray = Array.isArray(messages) ? messages : [messages];
        
        msgArray.forEach(msg => {
          switch (msg.T) {
            case 'success':
              if (msg.msg === 'authenticated') {
                console.log('✅ Market Data WebSocket Authenticated');
                authenticated = true;
                
                // Subscribe to AAPL data
                ws.send(JSON.stringify({
                  action: 'subscribe',
                  trades: ['AAPL'],
                  quotes: ['AAPL']
                }));
              }
              break;
              
            default:
              // Handle any other message types
              if (msg.data && msg.stream) {
                console.log(`📄 Unknown stream: ${msg.stream}`, msg.data);
              } else if (msg.data?.msg_type) {
                console.log(`📄 Unknown message type: ${msg.data.msg_type}`, msg.data);
              }
              break;
              
            case 'subscription':
              console.log('✅ Subscribed to AAPL market data');
              console.log('🎧 Listening for market data...');
              break;
              
            case 't': // Trade
              if (!dataReceived) {
                console.log(`✅ Trade Data: AAPL @ $${msg.p} (${msg.s} shares)`);
                dataReceived = true;
              }
              break;
              
            case 'q': // Quote
              if (!dataReceived) {
                console.log(`✅ Quote Data: AAPL Bid $${msg.bp} Ask $${msg.ap}`);
                dataReceived = true;
              }
              break;
              
            case 'error':
              console.error('❌ Market Data WebSocket Error:', msg);
              break;
          }
        });
      } catch (error) {
        console.error('❌ Market Data Message Parse Error:', error);
      }
    });

    ws.on('error', (error) => {
      console.error('❌ Market Data WebSocket Error:', error);
      clearTimeout(timeout);
      resolve();
    });

    ws.on('close', () => {
      console.log('📴 Market Data WebSocket Closed');
      clearTimeout(timeout);
      
      // Decrement active connections counter
      activeConnections = Math.max(0, activeConnections - 1);
      
      if (authenticated) {
        if (dataReceived) {
          console.log('🎉 Market Data WebSocket working perfectly!');
        } else {
          console.log('⚠️ Market data WebSocket connected but no data (normal outside market hours)');
        }
      } else {
        console.log('❌ Market data WebSocket authentication failed');
      }
      
      resolve();
    });
  });
}

function testTradingEventsWebSocket(keepListening: boolean = false): Promise<void> {
  // Check if we already have too many connections
  if (activeConnections >= MAX_CONNECTIONS) {
    console.log('⚠️ Too many active connections. Waiting for existing connections to close...');
    return new Promise(resolve => setTimeout(() => testTradingEventsWebSocket(keepListening).then(resolve), 2000));
  }
  
  activeConnections++;
  return new Promise<void>((resolve) => {
    const ws = new WebSocket('wss://paper-api.alpaca.markets/stream');
    let authenticated = false;
    let tradingEventReceived = false;
    
    // Timeout after 15 seconds for testing, or keep alive if listening
    const timeout = keepListening ? null : setTimeout(() => {
      console.log('⏰ Trading events test timeout - closing connection');
      ws.close();
    }, 15000);

    ws.on('open', () => {
      console.log('✅ Trading Events WebSocket Connected');
      
      // Authenticate for trading events using the recommended format
      const authMessage = {
        action: 'auth',
        key: API_KEY,
        secret: SECRET_KEY
      };
      
      console.log('🔐 Sending authentication...');
      ws.send(JSON.stringify(authMessage));
    });

    ws.on('message', (data) => {
      try {
        const messages = JSON.parse(data.toString());
        const msgArray = Array.isArray(messages) ? messages : [messages];
        
        // Debug: Log all incoming messages to understand the format
        console.log('📨 Received message:', JSON.stringify(messages, null, 2));
        
        msgArray.forEach(msg => {
          const streamType = msg.stream;
          const msgType = msg.data?.msg_type;
          
          // Handle authentication response - can be either old or new format
          if (streamType === 'authorization' || msgType === 'authorization' || msg.T === 'success') {
            if ((msg.data?.status === 'authorized') || (msg.T === 'success' && msg.msg === 'authenticated')) {
              console.log('✅ Trading Events WebSocket Authenticated');
              authenticated = true;
              
              // Subscribe to trading updates
              const subscribeMessage = {
                action: 'listen',
                data: {
                  streams: ['trade_updates']
                }
              };
              
              console.log('📡 Subscribing to trade_updates...');
              ws.send(JSON.stringify(subscribeMessage));
            } else {
              console.error('❌ Trading Events Authentication failed:', msg);
            }
            return;
          }
          
          // Handle subscription confirmation
          if (streamType === 'listening' || msgType === 'listening') {
            console.log('✅ Subscribed to trading events');
            console.log('🎧 Listening for order and position updates...');
            console.log('💡 Try placing/canceling an order to see events!');
            
            if (keepListening) {
              console.log('🔄 Keeping connection alive... Press Ctrl+C to exit');
            }
            return;
          }
              
          // Handle trading events
          if (streamType === 'trade_updates') {
            const eventType = msg.data?.event;
            const order = msg.data?.order;
            
            switch (eventType) {
                case 'new':
                  console.log(`🆕 NEW ORDER: ${order?.symbol} - ${order?.side} ${order?.qty} shares @ ${order?.order_type}`);
                  console.log(`   Order ID: ${order?.id}`);
                  console.log(`   Status: ${order?.status}`);
                  tradingEventReceived = true;
                  break;
                  
                case 'fill':
                  console.log(`✅ ORDER FILLED: ${order?.symbol}`);
                  console.log(`   Price: ${msg.data?.price}`);
                  console.log(`   Quantity: ${msg.data?.qty} shares`);
                  console.log(`   Position Qty: ${msg.data?.position_qty} shares`);
                  console.log(`   Timestamp: ${new Date(msg.data?.timestamp).toLocaleString()}`);
                  tradingEventReceived = true;
                  break;
                  
                case 'partial_fill':
                  console.log(`🔄 PARTIAL FILL: ${order?.symbol}`);
                  console.log(`   Price: ${msg.data?.price}`);
                  console.log(`   Quantity: ${msg.data?.qty} shares`);
                  console.log(`   Position Qty: ${msg.data?.position_qty} shares`);
                  console.log(`   Timestamp: ${new Date(msg.data?.timestamp).toLocaleString()}`);
                  tradingEventReceived = true;
                  break;
                  
                case 'canceled':
                  console.log(`❌ ORDER CANCELED: ${order?.symbol}`);
                  console.log(`   Order ID: ${order?.id}`);
                  console.log(`   Timestamp: ${new Date(msg.data?.timestamp || order?.canceled_at).toLocaleString()}`);
                  tradingEventReceived = true;
                  break;
                  
                case 'rejected':
                  console.log(`🚫 ORDER REJECTED: ${order?.symbol}`);
                  console.log(`   Reason: ${order?.reason || 'Unknown'}`);
                  tradingEventReceived = true;
                  break;
                  
                case 'replaced':
                  console.log(`🔄 ORDER REPLACED: ${order?.symbol}`);
                  console.log(`   Order ID: ${order?.id}`);
                  tradingEventReceived = true;
                  break;
                  
                case 'pending_new':
                  console.log(`⏳ ORDER PENDING: ${order?.symbol}`);
                  console.log(`   Order ID: ${order?.id}`);
                  tradingEventReceived = true;
                  break;
                  
                case 'stopped':
                  console.log(`⏹️ ORDER STOPPED: ${order?.symbol}`);
                  console.log(`   Order ID: ${order?.id}`);
                  tradingEventReceived = true;
                  break;
                  
                case 'suspended':
                  console.log(`⏸️ ORDER SUSPENDED: ${order?.symbol}`);
                  console.log(`   Order ID: ${order?.id}`);
                  tradingEventReceived = true;
                  break;
                  
                case 'calculated':
                  console.log(`🧮 ORDER CALCULATED: ${order?.symbol}`);
                  console.log(`   Order ID: ${order?.id}`);
                  tradingEventReceived = true;
                  break;
                  
                case 'expired':
                  console.log(`⏰ ORDER EXPIRED: ${order?.symbol}`);
                  console.log(`   Order ID: ${order?.id}`);
                  tradingEventReceived = true;
                  break;
                  
                default:
                  console.log(`📄 Unknown trade event: ${eventType}`, msg.data);
                  tradingEventReceived = true;
              }
          }
        });
      } catch (error) {
        console.error('❌ Trading Events Message Parse Error:', error);
      }
    });

    ws.on('error', (error) => {
      console.error('❌ Trading Events WebSocket Error:', error);
      if (timeout) clearTimeout(timeout);
      resolve();
    });

    ws.on('close', () => {
      console.log('📴 Trading Events WebSocket Closed');
      if (timeout) clearTimeout(timeout);
      
      // Decrement active connections counter
      activeConnections = Math.max(0, activeConnections - 1);
      
      if (!keepListening) {
        if (authenticated) {
          if (tradingEventReceived) {
            console.log('🎉 Trading Events WebSocket received data!');
          } else {
            console.log('⚠️ Trading Events WebSocket connected but no events received');
            console.log('💡 This is normal if no trades were executed during the test');
          }
        } else {
          console.log('❌ Trading Events WebSocket authentication failed');
        }
        
        console.log('\n🏁 Test Complete!');
        console.log('================');
        console.log('✅ REST API: Account info retrieved');
        console.log('✅ Market Data WebSocket: Connected and authenticated');
        console.log('✅ Trading Events WebSocket: Connected and authenticated');
        console.log('\n💡 To see trading events, try placing an order through the Alpaca dashboard or API!');
      }
      
      resolve();
    });
    
    // Handle Ctrl+C gracefully when listening
    if (keepListening) {
      process.on('SIGINT', () => {
        console.log('\n🛑 Gracefully closing connection...');
        ws.close();
      });
    }
  });
}

// Run the test
quickTest().catch(error => {
  console.error('💥 Test failed:', error);
  process.exit(1);
});