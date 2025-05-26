/**
 * run-dev.js
 * 
 * This is a helper script to run the development server with proper console output.
 * Location: backend/run-dev.js
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Get the current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('Starting development server...');
console.log(`Current directory: ${__dirname}`);

// Run the development server
const nodeProcess = spawn('node', ['--import', 'tsx', 'src/index.ts'], {
  cwd: __dirname,
  stdio: 'inherit',
  shell: true
});

// Handle process events
nodeProcess.on('error', (error) => {
  console.error(`Failed to start development server: ${error.message}`);
  process.exit(1);
});

nodeProcess.on('close', (code) => {
  console.log(`Development server exited with code ${code}`);
  process.exit(code);
});

// Handle SIGINT (Ctrl+C)
process.on('SIGINT', () => {
  console.log('Received SIGINT. Shutting down development server...');
  nodeProcess.kill('SIGINT');
});
