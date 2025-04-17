import React, { useState } from 'react';
import { useInventory } from '@/hooks/useInventory';
import { DataTable } from '@/components/common/DataTable';
import { format } from 'date-fns';

export const BatchTracking = ({ productId }: { productId: string }) => {
  const [isCreatingBatch, setIsCreatingBatch] = useState(false);
  const { batches, createBatch } = useInventory(productId);

  const columns = [
    {
      key: 'batchNumber',
      label: 'Batch Number',
      sortable: true
    },
    {
      key: 'quantity',
      label: 'Initial Quantity',
      sortable: true
    },
    {
      key: 'remainingQuantity',
      label: 'Remaining',
      sortable: true
    },
    {
      key: 'manufacturingDate',
      label: 'Mfg. Date',
      sortable: true,
      render: (value: string) => format(new Date(value), 'MMM d, yyyy')
    },
    {
      key: 'expiryDate',
      label: 'Expiry Date',
      sortable: true,
      render: (value: string) => format(new Date(value), 'MMM d, yyyy')
    },
    {
      key: 'status',
      label: 'Status',
      render: (value: string, item: any) => (
        <span className={`px-2 py-1 rounded-full text-xs ${
          item.remainingQuantity === 0
            ? 'bg-red-100 text-red-800'
            : item.remainingQuantity < item.quantity * 0.2
            ? 'bg-yellow-100 text-yellow-800'
            : 'bg-green-100 text-green-800'
        }`}>
          {item.remainingQuantity === 0
            ? 'Depleted'
            : item.remainingQuantity < item.quantity * 0.2
            ? 'Low'
            : 'In Stock'}
        </span>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-medium">Batch Tracking</h2>
        <button
          onClick={() => setIsCreatingBatch(true)}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
        >
          Create Batch
        </button>
      </div>

      <DataTable
        data={batches || []}
        columns={columns}
        pagination={{
          total: batches?.length || 0,
          page: 1,
          limit: 10,
          onPageChange: () => {},
          onLimitChange: () => {}
        }}
      />

      {/* Batch Creation Modal */}
      {isCreatingBatch && (
        <BatchCreationModal
          productId={productId}
          onClose={() => setIsCreatingBatch(false)}
          onSubmit={createBatch}
        />
      )}
    </div>
  );
}; 