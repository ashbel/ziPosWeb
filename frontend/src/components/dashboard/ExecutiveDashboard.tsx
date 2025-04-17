import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SalesChart } from './SalesChart';
import { MetricsGrid } from './MetricsGrid';
import { AlertsPanel } from './AlertsPanel';
import { format } from 'date-fns';

interface DashboardMetrics {
  sales: number;
  profit: number;
  orders: number;
  averageOrderValue: number;
  customerCount: number;
  inventoryValue: number;
}

export const ExecutiveDashboard = () => {
  const [timeRange, setTimeRange] = useState<'day' | 'week' | 'month' | 'year'>('day');
  const [metrics, setMetrics] = useState<DashboardMetrics>();
  const [isLoading, setIsLoading] = useState(false);

  const refreshData = async () => {
    setIsLoading(true);
    try {
      // Fetch updated metrics
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Executive Dashboard</h1>
        <div className="flex items-center space-x-4">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value as typeof timeRange)}
            className="rounded-md border-gray-300 shadow-sm"
          >
            <option value="day">Today</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
            <option value="year">This Year</option>
          </select>
          <button
            onClick={refreshData}
            className="p-2 rounded-full hover:bg-gray-100"
          >
            <RefreshIcon className="w-5 h-5" />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {isLoading ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex justify-center items-center h-64"
          >
            <Spinner />
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            <MetricsGrid metrics={metrics} />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <SalesChart timeRange={timeRange} />
              <AlertsPanel />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const RefreshIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
    />
  </svg>
);

const Spinner = () => (
  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
); 