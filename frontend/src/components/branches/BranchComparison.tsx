import React, { useState } from 'react';
import { useBranchComparison } from '@/hooks/useBranchComparison';
import { DashboardChart } from '../ui/charts/DashboardChart';
import { formatCurrency } from '@/utils/format';

export const BranchComparison = () => {
  const [period, setPeriod] = useState('7d');
  const { data, isLoading } = useBranchComparison(period);

  if (isLoading) return <div>Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Branch Comparison</h2>
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          className="rounded-md border-gray-300 shadow-sm"
        >
          <option value="7d">Last 7 Days</option>
          <option value="30d">Last 30 Days</option>
          <option value="90d">Last 90 Days</option>
        </select>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {data?.branches.map((branch) => (
          <div key={branch.id} className="bg-white rounded-lg shadow p-6">
            <h3 className="font-semibold text-lg mb-4">{branch.name}</h3>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600">Total Sales</p>
                <p className="text-2xl font-bold">
                  {formatCurrency(branch.totalSales)}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Orders</p>
                <p className="text-2xl font-bold">{branch.orderCount}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Average Order Value</p>
                <p className="text-2xl font-bold">
                  {formatCurrency(branch.averageOrder)}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="font-semibold text-lg mb-4">Sales Comparison</h3>
        <DashboardChart
          data={data?.salesComparison || []}
          lines={data?.branches.map((branch) => ({
            key: branch.id,
            name: branch.name,
            color: branch.color
          })) || []}
          xAxisKey="date"
          yAxisLabel="Sales"
        />
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="font-semibold text-lg mb-4">Top Products by Branch</h3>
          <div className="space-y-6">
            {data?.branches.map((branch) => (
              <div key={branch.id}>
                <h4 className="font-medium mb-2">{branch.name}</h4>
                <div className="space-y-2">
                  {branch.topProducts.map((product) => (
                    <div
                      key={product.id}
                      className="flex justify-between items-center"
                    >
                      <span>{product.name}</span>
                      <span>{product.quantity} units</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="font-semibold text-lg mb-4">Stock Distribution</h3>
          <div className="space-y-4">
            {data?.products.map((product) => (
              <div key={product.id} className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-medium">{product.name}</span>
                  <span>{product.totalStock} units</span>
                </div>
                <div className="flex space-x-2">
                  {product.stockByBranch.map((branch) => (
                    <div
                      key={branch.branchId}
                      className="flex-1 bg-gray-100 rounded p-2"
                    >
                      <p className="text-sm">{branch.branchName}</p>
                      <p className="font-medium">{branch.stock} units</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}; 