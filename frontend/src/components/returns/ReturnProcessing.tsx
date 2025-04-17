import React, { useState } from 'react';
import { useReturns } from '@/hooks/useReturns';
import { ReturnForm } from './ReturnForm';
import { formatCurrency } from '@/utils/format';
import { toast } from 'react-hot-toast';

export const ReturnProcessing = ({ saleId }: { saleId: string }) => {
  const { data: sale } = useReturns(saleId);
  const { processReturn } = useReturns();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleProcessReturn = async (data: any) => {
    try {
      await processReturn.mutateAsync({
        saleId,
        ...data
      });
      setIsProcessing(false);
      toast.success('Return processed successfully');
    } catch (error) {
      toast.error('Failed to process return');
    }
  };

  if (!sale) {
    return <div>Loading sale details...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-medium mb-4">Sale Details</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-gray-500">Sale ID</p>
            <p>{sale.id}</p>
          </div>
          <div>
            <p className="text-gray-500">Date</p>
            <p>{new Date(sale.createdAt).toLocaleString()}</p>
          </div>
          <div>
            <p className="text-gray-500">Customer</p>
            <p>{sale.customer?.name || 'Walk-in Customer'}</p>
          </div>
          <div>
            <p className="text-gray-500">Total Amount</p>
            <p>{formatCurrency(sale.total)}</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Product
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Quantity
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Price
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Total
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {sale.items.map((item) => (
              <tr key={item.id}>
                <td className="px-6 py-4">{item.product.name}</td>
                <td className="px-6 py-4">{item.quantity}</td>
                <td className="px-6 py-4">{formatCurrency(item.price)}</td>
                <td className="px-6 py-4">
                  {formatCurrency(item.price * item.quantity)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-medium mb-4">Process Return</h3>
        <ReturnForm
          sale={sale}
          onSubmit={handleProcessReturn}
          isProcessing={processReturn.isLoading}
        />
      </div>
    </div>
  );
}; 