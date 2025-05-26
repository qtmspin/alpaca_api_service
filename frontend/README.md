# Alpaca API Service Frontend

## Overview
This is the frontend application for the Alpaca API Service, built with React, TypeScript, FlexLayout, and Tailwind CSS. It provides a user interface for monitoring and testing the Alpaca API service, including order execution, connection status, logs, and configuration.

## Features
- **Connection Status Monitoring**: View the status of connections to Alpaca API and clients
- **Order Management**: Create and monitor orders, including artificial orders
- **Trade Log**: Track executed trades
- **Logs Panel**: View application logs with filtering capabilities
- **Configuration**: Adjust settings like shorting, duplicate trade detection, and risk parameters
- **Flexible Layout**: Using FlexLayout for a customizable interface

## Technology Stack
- **React**: Frontend framework
- **TypeScript**: Type safety
- **Zustand**: State management
- **FlexLayout**: Layout engine
- **Tailwind CSS**: Styling
- **Vite**: Build tool

## Getting Started

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn

### Installation
```bash
npm install
```

### Development
```bash
npm run dev
```

### Building for Production
```bash
npm run build
```

## Project Structure
- `/src`: Source code
  - `/components`: React components
  - `/store`: Zustand state management
  - `/types`: TypeScript type definitions
  - `/utils`: Utility functions
  - `/layouts`: Layout components
  - `/pages`: Page components
  - `/assets`: Static assets

## WebSocket Communication
The application connects to the backend via WebSocket for real-time updates on orders, positions, and market data. The WebSocket connection is established in the `appStore.ts` file.

## Configuration
The application configuration is managed through the Config panel, which allows adjusting various settings like shorting, duplicate trade detection, max notional size, and max quantity.
