import React, { useState } from 'react';
import { useDiscounts } from '@/hooks/useDiscounts';
import { DiscountForm } from './DiscountForm';
import { Dialog } from '@headlessui/react';
import { formatCurrency } from '@/utils/format';
import { toast } from 'react-hot-toast';

export const DiscountManagement = () => {
  const [isAddingDiscount, setIsAddingDiscount] = useState(false);
  const { data: discounts, isLoading } = useDiscounts();
  const { createDiscount, updateDiscount, deleteDiscount } = useDiscounts();

  const handleCreateDiscount = async (data: any) => {
    try {
      await createDiscount.mutateAsync(data);
      setIsAddingDiscount(false);
      toast.success('Discount created successfully');
    } catch (error) {
      toast.error('Failed to create discount');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Discount Management</h2>
        <button
          onClick={() => setIsAddingDiscount(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg"
        >
          Add Discount
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center">Loading...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {discounts?.map((discount) => (
            <div
              key={discount.id}
              className="bg-white rounded-lg shadow p-6 space-y-4"
            >
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-medium text-lg">{discount.name}</h3>
                  <p className="text-sm text-gray-500">
                    {discount.type === 'PERCENTAGE'
                      ? `${discount.value}% off`
                      : formatCurrency(discount.value)}
                  </p>
                </div>
                <div className="space-x-2">
                  <button
                    onClick={() => {/* Handle edit */}}
                    className="text-blue-600 hover:text-blue-800"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => deleteDiscount.mutate(discount.id)}
                    className="text-red-600 hover:text-red-800"
                  >
                    Delete
                  </button>
                </div>
              </div>

              <div className="text-sm">
                <p>Valid from: {new Date(discount.startDate).toLocaleDateString()}</p>
                <p>Valid until: {new Date(discount.endDate).toLocaleDateString()}</p>
                {discount.minimumPurchase && (
                  <p>Minimum purchase: {formatCurrency(discount.minimumPurchase)}</p>
                )}
                {discount.maximumDiscount && (
                  <p>Maximum discount: {formatCurrency(discount.maximumDiscount)}</p>
                )}
              </div>

              <div className="text-sm text-gray-500">
                {discount.applicableProducts?.length > 0 && (
                  <p>Applicable to {discount.applicableProducts.length} products</p>
                )}
                {discount.applicableCategories?.length > 0 && (
                  <p>Applicable to {discount.applicableCategories.length} categories</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog
        open={isAddingDiscount}
        onClose={() => setIsAddingDiscount(false)}
        className="fixed inset-0 z-10 overflow-y-auto"
      >
        <div className="flex items-center justify-center min-h-screen">
          <Dialog.Overlay className="fixed inset-0 bg-black opacity-30" />
          <div className="relative bg-white rounded-lg p-8 max-w-md w-full mx-4">
            <DiscountForm
              onSubmit={handleCreateDiscount}
              onCancel={() => setIsAddingDiscount(false)}
            />
          </div>
        </div>
      </Dialog>
    </div>
  );
}; 