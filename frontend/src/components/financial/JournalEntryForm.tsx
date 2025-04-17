import React from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AccountSelect } from './AccountSelect';

const journalEntrySchema = z.object({
  date: z.string(),
  description: z.string().min(1),
  reference: z.string().min(1),
  entries: z.array(z.object({
    accountId: z.string().uuid(),
    debit: z.number().min(0).optional(),
    credit: z.number().min(0).optional(),
    reference: z.string().optional()
  })).min(2).refine(
    data => {
      const totalDebits = data.reduce((sum, entry) => sum + (entry.debit || 0), 0);
      const totalCredits = data.reduce((sum, entry) => sum + (entry.credit || 0), 0);
      return Math.abs(totalDebits - totalCredits) < 0.01;
    },
    { message: 'Debits must equal credits' }
  )
});

export const JournalEntryForm = () => {
  const { register, control, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(journalEntrySchema),
    defaultValues: {
      entries: [
        { accountId: '', debit: 0 },
        { accountId: '', credit: 0 }
      ]
    }
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'entries'
  });

  const onSubmit = async (data: any) => {
    try {
      // Handle submission
    } catch (error) {
      console.error('Error creating journal entry:', error);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Date
          </label>
          <input
            type="date"
            {...register('date')}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
          />
          {errors.date && (
            <p className="mt-1 text-sm text-red-600">{errors.date.message}</p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Reference
          </label>
          <input
            type="text"
            {...register('reference')}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
          />
          {errors.reference && (
            <p className="mt-1 text-sm text-red-600">{errors.reference.message}</p>
          )}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          Description
        </label>
        <textarea
          {...register('description')}
          rows={3}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
        />
        {errors.description && (
          <p className="mt-1 text-sm text-red-600">{errors.description.message}</p>
        )}
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-12 gap-4 text-sm font-medium text-gray-700">
          <div className="col-span-6">Account</div>
          <div className="col-span-3">Debit</div>
          <div className="col-span-3">Credit</div>
        </div>

        {fields.map((field, index) => (
          <div key={field.id} className="grid grid-cols-12 gap-4 items-center">
            <div className="col-span-6">
              <AccountSelect
                {...register(`entries.${index}.accountId`)}
              />
            </div>
            <div className="col-span-3">
              <input
                type="number"
                step="0.01"
                {...register(`entries.${index}.debit`)}
                className="block w-full rounded-md border-gray-300 shadow-sm"
              />
            </div>
            <div className="col-span-3 flex items-center space-x-2">
              <input
                type="number"
                step="0.01"
                {...register(`entries.${index}.credit`)}
                className="block w-full rounded-md border-gray-300 shadow-sm"
              />
              <button
                type="button"
                onClick={() => remove(index)}
                className="text-red-600 hover:text-red-800"
              >
                ×
              </button>
            </div>
          </div>
        ))}

        <button
          type="button"
          onClick={() => append({ accountId: '', debit: 0, credit: 0 })}
          className="text-blue-600 hover:text-blue-800"
        >
          Add Line
        </button>
      </div>

      {errors.entries && (
        <p className="text-sm text-red-600">{errors.entries.message}</p>
      )}

      <button
        type="submit"
        className="w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
      >
        Create Journal Entry
      </button>
    </form>
  );
}; 