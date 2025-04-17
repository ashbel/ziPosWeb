import React, { useState } from 'react';
import { useLoyaltySettings } from '@/hooks/useLoyaltySettings';
import { useCustomers } from '@/hooks/useCustomers';
import { formatCurrency } from '@/utils/format';

export const LoyaltyProgram = () => {
  const { data: settings, updateSettings } = useLoyaltySettings();
  const { data: customers } = useCustomers();
  const [selectedCustomer, setSelectedCustomer] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Loyalty Program</h2>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Program Settings</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Points per {formatCurrency(1)}
              </label>
              <input
                type="number"
                value={settings?.pointsPerUnit}
                onChange={(e) => updateSettings({ pointsPerUnit: Number(e.target.value) })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Points Required for {formatCurrency(1)} Discount
              </label>
              <input
                type="number"
                value={settings?.pointsForDiscount}
                onChange={(e) => updateSettings({ pointsForDiscount: Number(e.target.value) })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Minimum Purchase for Points
              </label>
              <input
                type="number"
                value={settings?.minimumPurchase}
                onChange={(e) => updateSettings({ minimumPurchase: Number(e.target.value) })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
              />
            </div>

            <div>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={settings?.enableBirthdayBonus}
                  onChange={(e) => updateSettings({ enableBirthdayBonus: e.target.checked })}
                  className="rounded border-gray-300"
                />
                <span className="ml-2">Enable Birthday Bonus Points</span>
              </label>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Customer Points</h3>
          <div className="space-y-4">
            <select
              value={selectedCustomer || ''}
              onChange={(e) => setSelectedCustomer(e.target.value)}
              className="block w-full rounded-md border-gray-300 shadow-sm"
            >
              <option value="">Select Customer</option>
              {customers?.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name} ({customer.points} points)
                </option>
              ))}
            </select>

            {selectedCustomer && (
              <div className="mt-4">
                <h4 className="font-medium mb-2">Points History</h4>
                <div className="space-y-2">
                  {customers
                    ?.find((c) => c.id === selectedCustomer)
                    ?.pointsHistory.map((history) => (
                      <div
                        key={history.id}
                        className="flex justify-between items-center p-2 bg-gray-50 rounded"
                      >
                        <div>
                          <p className="font-medium">{history.description}</p>
                          <p className="text-sm text-gray-600">
                            {new Date(history.date).toLocaleDateString()}
                          </p>
                        </div>
                        <p className={`font-medium ${
                          history.points > 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {history.points > 0 ? '+' : ''}{history.points}
                        </p>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}; 