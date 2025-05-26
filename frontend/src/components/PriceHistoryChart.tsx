/**
 * PriceHistoryChart.tsx
 * 
 * A component for displaying price history charts for stocks and crypto
 * Location: frontend/src/components/PriceHistoryChart.tsx
 * 
 * Responsibilities:
 * - Fetch and display price history data for a given symbol
 * - Allow selecting different timeframes
 * - Display chart using Recharts library
 */

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import './PriceHistoryChart.css';

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
  const [, setPriceHistory] = useState<PriceHistoryData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [timeframe, setTimeframe] = useState<string>('1Day');
  const [chartData, setChartData] = useState<any[]>([]);

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
      
      const response = await axios.get(`/api/alpaca/price-history/${symbol}`, {
        params: {
          timeframe,
          start: startDate.toISOString(),
          limit: 100
        }
      });

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
        open: bar.o,
        high: bar.h,
        low: bar.l,
        close: bar.c,
        volume: bar.v,
      };
    });

    setChartData(processedData);
  };

  const handleTimeframeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setTimeframe(e.target.value);
  };

  useEffect(() => {
    if (symbol) {
      fetchPriceHistory();
    }
  }, [symbol, timeframe]);

  return (
    <div className="price-history-chart">
      <div className="chart-header">
        <h3>{symbol} Price History</h3>
        <div className="chart-controls">
          <select 
            value={timeframe} 
            onChange={handleTimeframeChange}
            className="timeframe-select"
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
            className="refresh-button"
          >
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>
      </div>

      <div className="chart-container">
        {loading ? (
          <div className="loading-indicator">Loading price history...</div>
        ) : chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={400}>
            <LineChart
              data={chartData}
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="time" 
                tick={{ fontSize: 12 }}
                interval="preserveStartEnd"
                tickFormatter={(value) => {
                  const date = new Date(value);
                  return timeframe.includes('Min') || timeframe.includes('Hour')
                    ? date.toLocaleTimeString()
                    : date.toLocaleDateString();
                }}
              />
              <YAxis 
                domain={['dataMin', 'dataMax']}
                tick={{ fontSize: 12 }}
              />
              <Tooltip 
                labelFormatter={(value) => `Time: ${value}`}
                formatter={(value: number) => [`$${value.toFixed(2)}`, '']}
              />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="close" 
                stroke="#8884d8" 
                activeDot={{ r: 8 }} 
                name="Price"
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="no-data-message">
            {symbol ? 'No price history data available' : 'Select a symbol to view price history'}
          </div>
        )}
      </div>
    </div>
  );
};

export default PriceHistoryChart;
