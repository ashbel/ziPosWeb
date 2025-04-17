import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useInventory } from '@/hooks/useInventory';
import { toast } from 'react-hot-toast';

const adjustmentSchema = z.object({
  productId: z.string(),
  quantity: z.number().min(0),
  type: z.enum(['add', 'remove']),
  reason: z.string().min(1, 'Reason is required')
});

type AdjustmentFormData = z.infer<typeof adjustmentSchema>;

interface StockAdjustmentProps {
  branchId: string;
  productId: string;
  onComplete: () => void;
}

export const StockAdjustment = ({ branchId, productId, onComplete }: StockAdjustmentProps) => {
  const { adjustStock } = useInventory(branchId);
  const { register, handleSubmit, formState: { errors } } = useForm<AdjustmentFormData>({
    resolver: zodResolver(adjustmentSchema),
    defaultValues: {
      productId,
      type: 'add'
    }
  });

  const onSubmit = async (data: AdjustmentFormData) => {
    try {
      await adjustStock.mutateAsync(data);
      toast.success('Stock adjusted successfully');
      onComplete();
    } catch (error) {
      toast.error('Failed to adjust stock');
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700">
          Adjustment Type
        </label>
        <select
          {...register('type')}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
        >
          <option value="add">Add Stock</option>
          <option value="remove">Remove Stock</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          Quantity
        </label>
        <input
          type="number"
          {...register('quantity', { valueAsNumber: true })}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
          min="0"
        />
        {errors.quantity && (
          <p className="mt-1 text-sm text-red-600">{errors.quantity.message}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          Reason
        </label>
        <textarea
          {...register('reason')}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
          rows={3}
        />
        {errors.reason && (
          <p className="mt-1 text-sm text-red-600">{errors.reason.message}</p>
        )}
      </div>

      <button
        type="submit"
        disabled={adjustStock.isLoading}
        className="w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
      >
        {adjustStock.isLoading ? 'Adjusting...' : 'Adjust Stock'}
      </button>
    </form>
  );
}; 