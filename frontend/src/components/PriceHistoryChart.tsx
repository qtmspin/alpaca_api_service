/**
 * PriceHistoryChart.tsx
 * 
 * A component for displaying price history charts for stocks and crypto
 * Location: frontend/src/components/PriceHistoryChart.tsx
 * 
 * Responsibilities:
 * - Fetch and display price history data for a given symbol
 * - Allow selecting different timeframes
 * - Display chart using a simple canvas-based approach
 */

import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';

interface PriceHistoryProps {
  symbol: string;
  onError?: (error: string) => void;
  onLog?: (message: string) => void;
}

interface Bar {
  t: string;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

interface PriceHistoryData {
  symbol: string;
  timeframe: string;
  bars: { [key: string]: Bar[] };
  isCrypto: boolean;
}

const timeframeOptions = [
  { value: '1Min', label: '1 Minute' },
  { value: '5Min', label: '5 Minutes' },
  { value: '15Min', label: '15 Minutes' },
  { value: '1Hour', label: '1 Hour' },
  { value: '1Day', label: '1 Day' },
];

const PriceHistoryChart: React.FC<PriceHistoryProps> = ({ symbol, onError, onLog }) => {
  const [priceHistory, setPriceHistory] = useState<PriceHistoryData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [timeframe, setTimeframe] = useState<string>('1Day');
  const [chartData, setChartData] = useState<any[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const addLog = (message: string) => {
    console.log(message);
    if (onLog) onLog(message);
  };

  const handleError = (error: any) => {
    const errorMessage = error?.response?.data?.message || error?.message || 'Unknown error';
    console.error('Error fetching price history:', errorMessage);
    if (onError) onError(errorMessage);
  };

  const fetchPriceHistory = async () => {
    if (!symbol) return;

    setLoading(true);
    try {
      // Calculate start date (30 days ago)
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);
      
      addLog(`Fetching price history for ${symbol} with timeframe ${timeframe}`);
      
      // Check if the symbol is a crypto symbol (contains '/')
      const isCrypto = symbol.includes('/');
      let response;
      
      if (isCrypto) {
        // For crypto symbols, use the dedicated crypto endpoint
        const [base, quote] = symbol.split('/');
        response = await axios.get(`/api/alpaca/crypto-price-history/${base}/${quote}`, {
          params: {
            timeframe,
            start: startDate.toISOString(),
            limit: 100
          }
        });
      } else {
        // For stock symbols, use the regular endpoint
        const encodedSymbol = encodeURIComponent(symbol);
        response = await axios.get(`/api/alpaca/price-history/${encodedSymbol}`, {
          params: {
            timeframe,
            start: startDate.toISOString(),
            limit: 100
          }
        });
      }

      if (response.data.success) {
        setPriceHistory(response.data.data);
        processChartData(response.data.data);
        addLog(`Successfully fetched price history for ${symbol}`);
      } else {
        handleError({ message: response.data.message || 'Failed to fetch price history' });
      }
    } catch (error) {
      handleError(error);
    } finally {
      setLoading(false);
    }
  };

  const processChartData = (data: PriceHistoryData) => {
    if (!data || !data.bars || !data.bars[symbol] || data.bars[symbol].length === 0) {
      setChartData([]);
      return;
    }

    const processedData = data.bars[symbol].map((bar: Bar) => {
      const date = new Date(bar.t);
      return {
        time: date.toLocaleString(),
        timestamp: date.getTime(),
        open: bar.o,
        high: bar.h,
        low: bar.l,
        close: bar.c,
        volume: bar.v,
      };
    });

    // Sort by timestamp to ensure correct order
    processedData.sort((a, b) => a.timestamp - b.timestamp);
    setChartData(processedData);
  };

  const drawChart = () => {
    const canvas = canvasRef.current;
    if (!canvas || chartData.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    const { width, height } = canvas.getBoundingClientRect();
    canvas.width = width;
    canvas.height = height;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Chart margins
    const margin = { top: 20, right: 20, bottom: 50, left: 60 };
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;

    // Find min and max prices
    const prices = chartData.map(d => d.close);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const priceRange = maxPrice - minPrice;

    // Scale functions
    const xScale = (index: number) => margin.left + (index / (chartData.length - 1)) * chartWidth;
    const yScale = (price: number) => margin.top + ((maxPrice - price) / priceRange) * chartHeight;

    // Draw grid lines
    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth = 1;

    // Horizontal grid lines
    for (let i = 0; i <= 5; i++) {
      const y = margin.top + (i / 5) * chartHeight;
      ctx.beginPath();
      ctx.moveTo(margin.left, y);
      ctx.lineTo(margin.left + chartWidth, y);
      ctx.stroke();

      // Price labels
      const price = maxPrice - (i / 5) * priceRange;
      ctx.fillStyle = '#666';
      ctx.font = '12px Arial';
      ctx.textAlign = 'right';
      ctx.fillText(`$${price.toFixed(2)}`, margin.left - 5, y + 4);
    }

    // Vertical grid lines
    for (let i = 0; i <= 4; i++) {
      const x = margin.left + (i / 4) * chartWidth;
      ctx.beginPath();
      ctx.moveTo(x, margin.top);
      ctx.lineTo(x, margin.top + chartHeight);
      ctx.stroke();

      // Time labels
      if (i < chartData.length) {
        const dataIndex = Math.floor((i / 4) * (chartData.length - 1));
        const timeLabel = new Date(chartData[dataIndex].timestamp).toLocaleDateString();
        ctx.fillStyle = '#666';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(timeLabel, x, height - 10);
      }
    }

    // Draw price line
    ctx.strokeStyle = '#2563eb';
    ctx.lineWidth = 2;
    ctx.beginPath();

    chartData.forEach((point, index) => {
      const x = xScale(index);
      const y = yScale(point.close);

      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });

    ctx.stroke();

    // Draw data points
    ctx.fillStyle = '#2563eb';
    chartData.forEach((point, index) => {
      const x = xScale(index);
      const y = yScale(point.close);
      
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, 2 * Math.PI);
      ctx.fill();
    });

    // Chart title
    ctx.fillStyle = '#333';
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`${symbol} Price History (${timeframe})`, width / 2, 20);
  };

  const handleTimeframeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setTimeframe(e.target.value);
  };

  useEffect(() => {
    if (symbol) {
      fetchPriceHistory();
    }
  }, [symbol, timeframe]);

  useEffect(() => {
    if (chartData.length > 0) {
      // Use requestAnimationFrame to ensure canvas is properly sized
      requestAnimationFrame(drawChart);
    }
  }, [chartData]);

  useEffect(() => {
    // Redraw chart on window resize
    const handleResize = () => {
      if (chartData.length > 0) {
        setTimeout(drawChart, 100);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [chartData]);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-medium">{symbol} Price History</h3>
        <div className="flex gap-2">
          <select 
            value={timeframe} 
            onChange={handleTimeframeChange}
            className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white text-sm"
            disabled={loading}
            aria-label="Select timeframe"
            title="Select timeframe"
          >
            {timeframeOptions.map(option => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <button 
            onClick={fetchPriceHistory} 
            disabled={loading || !symbol}
            className="px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>
      </div>

      <div className="h-96 w-full">
        {loading ? (
          <div className="flex justify-center items-center h-full text-gray-500 dark:text-gray-400">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mr-2"></div>
            Loading price history...
          </div>
        ) : chartData.length > 0 ? (
          <canvas 
            ref={canvasRef}
            className="w-full h-full border border-gray-200 dark:border-gray-600 rounded"
            style={{ width: '100%', height: '100%' }}
          />
        ) : (
          <div className="flex justify-center items-center h-full text-gray-500 dark:text-gray-400">
            {symbol ? 'No price history data available' : 'Select a symbol to view price history'}
          </div>
        )}
      </div>

      {/* Data summary */}
      {chartData.length > 0 && (
        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-gray-500 dark:text-gray-400">Data Points:</span>
            <span className="ml-2 font-medium">{chartData.length}</span>
          </div>
          <div>
            <span className="text-gray-500 dark:text-gray-400">Latest Price:</span>
            <span className="ml-2 font-medium">${chartData[chartData.length - 1]?.close.toFixed(2)}</span>
          </div>
          <div>
            <span className="text-gray-500 dark:text-gray-400">High:</span>
            <span className="ml-2 font-medium">${Math.max(...chartData.map(d => d.high)).toFixed(2)}</span>
          </div>
          <div>
            <span className="text-gray-500 dark:text-gray-400">Low:</span>
            <span className="ml-2 font-medium">${Math.min(...chartData.map(d => d.low)).toFixed(2)}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default PriceHistoryChart;