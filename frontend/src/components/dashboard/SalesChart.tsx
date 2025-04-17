import React, { useState } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { format } from 'date-fns';
import { formatCurrency } from '@/utils/format';

interface SalesChartProps {
  data: {
    date: string;
    sales: number;
    orders: number;
    averageOrderValue: number;
  }[];
  timeRange: 'daily' | 'weekly' | 'monthly' | 'yearly';
}

export const SalesChart = ({ data, timeRange }: SalesChartProps) => {
  const [chartType, setChartType] = useState<'line' | 'bar'>('line');
  const [metric, setMetric] = useState<'sales' | 'orders' | 'averageOrderValue'>('sales');

  const formatDate = (date: string) => {
    switch (timeRange) {
      case 'daily':
        return format(new Date(date), 'MMM d');
      case 'weekly':
        return `Week ${format(new Date(date), 'w')}`;
      case 'monthly':
        return format(new Date(date), 'MMM yyyy');
      case 'yearly':
        return format(new Date(date), 'yyyy');
      default:
        return date;
    }
  };

  const formatValue = (value: number) => {
    if (metric === 'sales' || metric === 'averageOrderValue') {
      return formatCurrency(value);
    }
    return value.toLocaleString();
  };

  const getChartColor = () => {
    switch (metric) {
      case 'sales':
        return '#3B82F6';
      case 'orders':
        return '#10B981';
      case 'averageOrderValue':
        return '#6366F1';
      default:
        return '#3B82F6';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6 space-y-4">
      <div className="flex justify-between items-center">
        <div className="space-x-4">
          <select
            value={metric}
            onChange={(e) => setMetric(e.target.value as typeof metric)}
            className="rounded-md border-gray-300 shadow-sm"
          >
            <option value="sales">Sales</option>
            <option value="orders">Orders</option>
            <option value="averageOrderValue">Average Order Value</option>
          </select>
          <select
            value={chartType}
            onChange={(e) => setChartType(e.target.value as typeof chartType)}
            className="rounded-md border-gray-300 shadow-sm"
          >
            <option value="line">Line Chart</option>
            <option value="bar">Bar Chart</option>
          </select>
        </div>
      </div>

      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          {chartType === 'line' ? (
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tickFormatter={formatDate}
              />
              <YAxis
                tickFormatter={formatValue}
              />
              <Tooltip
                formatter={(value: number) => formatValue(value)}
                labelFormatter={(label: string) => formatDate(label)}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey={metric}
                stroke={getChartColor()}
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          ) : (
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tickFormatter={formatDate}
              />
              <YAxis
                tickFormatter={formatValue}
              />
              <Tooltip
                formatter={(value: number) => formatValue(value)}
                labelFormatter={(label: string) => formatDate(label)}
              />
              <Legend />
              <Bar
                dataKey={metric}
                fill={getChartColor()}
              />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}; 