import React, { useState } from 'react';
import { Dialog } from '@headlessui/react';
import { formatCurrency } from '@/utils/format';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (paymentDetails: PaymentDetails) => void;
  total: number;
}

type PaymentType = 'cash' | 'card';

interface PaymentDetails {
  type: PaymentType;
  amount: number;
  change?: number;
}

export const PaymentModal = ({ isOpen, onClose, onConfirm, total }: PaymentModalProps) => {
  const [paymentType, setPaymentType] = useState<PaymentType>('cash');
  const [amount, setAmount] = useState<string>('');
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    
    if (numAmount < total && paymentType === 'cash') {
      alert('Insufficient payment amount');
      return;
    }

    onConfirm({
      type: paymentType,
      amount: numAmount,
      change: paymentType === 'cash' ? numAmount - total : 0
    });
  };

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
      
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="w-full max-w-md bg-white rounded-lg p-6">
          <Dialog.Title className="text-lg font-medium mb-4">
            Payment Details
          </Dialog.Title>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Total Amount
              </label>
              <div className="mt-1 text-2xl font-bold">
                {formatCurrency(total)}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Payment Method
              </label>
              <div className="mt-1 grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setPaymentType('cash')}
                  className={`p-3 text-center rounded-lg border ${
                    paymentType === 'cash'
                      ? 'border-blue-600 bg-blue-50 text-blue-600'
                      : 'border-gray-300'
                  }`}
                >
                  Cash
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentType('card')}
                  className={`p-3 text-center rounded-lg border ${
                    paymentType === 'card'
                      ? 'border-blue-600 bg-blue-50 text-blue-600'
                      : 'border-gray-300'
                  }`}
                >
                  Card
                </button>
              </div>
            </div>

            {paymentType === 'cash' && (
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Amount Received
                </label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                  min={total}
                  step="0.01"
                  required
                />
                {parseFloat(amount) >= total && (
                  <div className="mt-2 text-sm text-gray-600">
                    Change: {formatCurrency(parseFloat(amount) - total)}
                  </div>
                )}
              </div>
            )}

            <div className="flex space-x-4 mt-6">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
              >
                Confirm Payment
              </button>
            </div>
          </form>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
}; 