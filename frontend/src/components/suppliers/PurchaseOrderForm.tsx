import React from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useProducts } from '@/hooks/useProducts';

const purchaseOrderSchema = z.object({
  supplierId: z.string().uuid(),
  expectedDeliveryDate: z.date(),
  items: z.array(z.object({
    productId: z.string().uuid(),
    quantity: z.number().min(1),
    unitPrice: z.number().min(0)
  })).min(1),
  notes: z.string().optional()
});

type PurchaseOrderFormData = z.infer<typeof purchaseOrderSchema>;

export const PurchaseOrderForm = ({
  onSubmit,
  onCancel,
  supplier
}: {
  onSubmit: (data: PurchaseOrderFormData) => void;
  onCancel: () => void;
  supplier: any;
}) => {
  const { data: products } = useProducts();
  const { register, control, handleSubmit, formState: { errors } } = useForm<PurchaseOrderFormData>({
    resolver: zodResolver(purchaseOrderSchema),
    defaultValues: {
      supplierId: supplier.id,
      items: [{ productId: '', quantity: 1, unitPrice: 0 }]
    }
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'items'
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700">
          Expected Delivery Date
        </label>
        <input
          type="date"
          {...register('expectedDeliveryDate', { valueAsDate: true })}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
        />
        {errors.expectedDeliveryDate && (
          <p className="mt-1 text-sm text-red-600">
            {errors.expectedDeliveryDate.message}
          </p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          Items
        </label>
        {fields.map((field, index) => (
          <div key={field.id} className="flex space-x-4 mt-2">
            <select
              {...register(`items.${index}.productId`)}
              className="block w-full rounded-md border-gray-300 shadow-sm"
            >
              <option value="">Select Product</option>
              {products?.map(product => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
            </select>
            
            <input
              type="number"
              {...register(`items.${index}.quantity`, { valueAsNumber: true })}
              placeholder="Quantity"
              className="block w-32 rounded-md border-gray-300 shadow-sm"
            />
            
            <input
              type="number"
              {...register(`items.${index}.unitPrice`, { valueAsNumber: true })}
              placeholder="Unit Price"
              className="block w-32 rounded-md border-gray-300 shadow-sm"
            />
            
            <button
              type="button"
              onClick={() => remove(index)}
              className="text-red-600 hover:text-red-800"
            >
              Remove
            </button>
          </div>
        ))}
        
        <button
          type="button"
          onClick={() => append({ productId: '', quantity: 1, unitPrice: 0 })}
          className="mt-2 text-blue-600 hover:text-blue-800"
        >
          Add Item
        </button>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          Notes
        </label>
        <textarea
          {...register('notes')}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
          rows={3}
        />
      </div>

      <div className="flex justify-end space-x-4">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 border rounded-md"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-4 py-2 bg-blue-600 text-white rounded-md"
        >
          Create Order
        </button>
      </div>
    </form>
  );
}; 