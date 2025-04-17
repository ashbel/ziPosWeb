import React, { useState, useEffect } from 'react';
import { Line, Bar } from 'react-chartjs-2';
import { motion } from 'framer-motion';

export const SystemMonitor = () => {
  const [metrics, setMetrics] = useState<any>(null);
  const [selectedView, setSelectedView] = useState<'realtime' | 'historical'>('realtime');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchMetrics = async () => {
      // Fetch metrics implementation
    };

    fetchMetrics();
    const interval = setInterval(fetchMetrics, 30000); // Update every 30 seconds

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">System Monitor</h2>
        <div className="flex space-x-4">
          <select
            value={selectedView}
            onChange={(e) => setSelectedView(e.target.value as any)}
            className="rounded-md border-gray-300 shadow-sm"
          >
            <option value="realtime">Real-time</option>
            <option value="historical">Historical</option>
          </select>
          <button
            onClick={() => {/* Refresh data */}}
            className="p-2 rounded-full hover:bg-gray-100"
          >
            <RefreshIcon className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* CPU Usage */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-6 rounded-lg shadow"
        >
          <h3 className="text-lg font-medium mb-4">CPU Usage</h3>
          <div className="relative pt-1">
            <div className="flex mb-2 items-center justify-between">
              <div>
                <span className="text-xs font-semibold inline-block py-1 px-2 uppercase rounded-full text-blue-600 bg-blue-200">
                  {metrics?.cpu.usage}%
                </span>
              </div>
            </div>
            <div className="overflow-hidden h-2 mb-4 text-xs flex rounded bg-blue-200">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${metrics?.cpu.usage}%` }}
                className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-blue-500"
              />
            </div>
          </div>
        </motion.div>

        {/* Memory Usage */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white p-6 rounded-lg shadow"
        >
          <h3 className="text-lg font-medium mb-4">Memory Usage</h3>
          <div className="relative pt-1">
            <div className="flex mb-2 items-center justify-between">
              <div>
                <span className="text-xs font-semibold inline-block py-1 px-2 uppercase rounded-full text-green-600 bg-green-200">
                  {metrics?.memory.used} / {metrics?.memory.total} GB
                </span>
              </div>
            </div>
            <div className="overflow-hidden h-2 mb-4 text-xs flex rounded bg-green-200">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${(metrics?.memory.used / metrics?.memory.total) * 100}%` }}
                className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-green-500"
              />
            </div>
          </div>
        </motion.div>

        {/* Database Connections */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white p-6 rounded-lg shadow"
        >
          <h3 className="text-lg font-medium mb-4">Database Connections</h3>
          <div className="text-3xl font-bold text-gray-700">
            {metrics?.database.connections}
          </div>
          <div className="text-sm text-gray-500">
            Active Queries: {metrics?.database.activeQueries}
          </div>
        </motion.div>

        {/* API Response Time */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white p-6 rounded-lg shadow"
        >
          <h3 className="text-lg font-medium mb-4">API Response Time</h3>
          <div className="text-3xl font-bold text-gray-700">
            {metrics?.api.averageResponseTime}ms
          </div>
          <div className="text-sm text-gray-500">
            Requests/min: {metrics?.api.requestsPerMinute}
          </div>
        </motion.div>
      </div>

      {/* Historical Charts */}
      {selectedView === 'historical' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-medium mb-4">System Load History</h3>
            <Line
              data={metrics?.historical.systemLoad}
              options={{
                responsive: true,
                scales: {
                  y: {
                    beginAtZero: true
                  }
                }
              }}
            />
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-medium mb-4">API Performance History</h3>
            <Bar
              data={metrics?.historical.apiPerformance}
              options={{
                responsive: true,
                scales: {
                  y: {
                    beginAtZero: true
                  }
                }
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}; 