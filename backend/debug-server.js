/**
 * debug-server.js
 * 
 * A simple script to debug the server startup process.
 * Location: backend/debug-server.js
 */

import { execSync } from 'child_process';

try {
  console.log('Starting Alpaca API Service in debug mode...');
  console.log('Current working directory:', process.cwd());
  
  // Run the server with output directly to console
  const output = execSync('npx tsx src/index.ts', { 
    encoding: 'utf8',
    stdio: 'inherit'
  });
  
  console.log(output);
} catch (error) {
  console.error('Error running server:', error);
}
