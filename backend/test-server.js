/**
 * test-server.js
 * 
 * A simple test script to verify our Node.js and TypeScript setup.
 */

import express from 'express';

const app = express();
const PORT = 3456;

app.get('/', (req, res) => {
  res.json({
    message: 'Test server is running',
    timestamp: new Date().toISOString(),
    nodeVersion: process.version
  });
});

app.listen(PORT, () => {
  console.log(`Test server running at http://localhost:${PORT}`);
});
