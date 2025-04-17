import React from 'react';
import { TrashIcon } from '@heroicons/react/24/outline';
import { formatCurrency } from '@/utils/format';

interface CartProps {
  items: CartItem[];
  onUpdateQuantity: (productId: string, quantity: number) => void;
}

export const Cart = ({ items, onUpdateQuantity }: CartProps) => {
  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  return (
    <div className="flex-1 flex flex-col">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {items.map((item) => (
          <div key={item.productId} className="flex items-center space-x-4">
            <div className="flex-1">
              <h3 className="font-medium">{item.name}</h3>
              <p className="text-sm text-gray-600">
                {formatCurrency(item.price)} × {item.quantity}
              </p>
            </div>
            
            <div className="flex items-center space-x-2">
              <button
                onClick={() => onUpdateQuantity(item.productId, item.quantity - 1)}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200"
              >
                -
              </button>
              <span className="w-8 text-center">{item.quantity}</span>
              <button
                onClick={() => onUpdateQuantity(item.productId, item.quantity + 1)}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200"
              >
                +
              </button>
              <button
                onClick={() => onUpdateQuantity(item.productId, 0)}
                className="text-red-600 hover:text-red-800"
              >
                <TrashIcon className="w-5 h-5" />
              </button>
            </div>
          </div>
        ))}

        {items.length === 0 && (
          <div className="text-center text-gray-500 py-8">
            Cart is empty
          </div>
        )}
      </div>

      <div className="border-t p-4">
        <div className="flex justify-between items-center text-lg font-medium">
          <span>Total</span>
          <span>{formatCurrency(total)}</span>
        </div>
      </div>
    </div>
  );
}; 