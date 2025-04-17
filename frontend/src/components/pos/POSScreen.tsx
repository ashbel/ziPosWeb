import React, { useState } from 'react';
import { ProductGrid } from './ProductGrid';
import { Cart } from './Cart';
import { PaymentModal } from './PaymentModal';
import { CustomerSearch } from './CustomerSearch';
import { QuickActions } from './QuickActions';
import { useSale } from '@/hooks/useSale';
import { toast } from 'react-hot-toast';

export const POSScreen = () => {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isCustomerSearchOpen, setIsCustomerSearchOpen] = useState(false);

  const { createSale, isLoading } = useSale();

  const handleAddToCart = (product: Product) => {
    setCart(current => {
      const existingItem = current.find(item => item.productId === product.id);
      if (existingItem) {
        return current.map(item =>
          item.productId === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...current, {
        productId: product.id,
        name: product.name,
        price: product.sellingPrice,
        quantity: 1
      }];
    });
  };

  const handleCheckout = async (paymentDetails: any) => {
    try {
      await createSale.mutateAsync({
        items: cart,
        customerId: selectedCustomer?.id,
        paymentType: paymentDetails.type,
        amount: paymentDetails.amount
      });
      
      setCart([]);
      setSelectedCustomer(null);
      setIsPaymentModalOpen(false);
      toast.success('Sale completed successfully');
    } catch (error) {
      toast.error('Failed to complete sale');
    }
  };

  return (
    <div className="flex h-screen">
      <div className="flex-1 flex flex-col">
        <div className="p-4 bg-white border-b">
          <QuickActions
            onPaymentMethodSelect={() => setIsPaymentModalOpen(true)}
            onCustomerSelect={() => setIsCustomerSearchOpen(true)}
          />
        </div>

        <div className="flex-1 overflow-y-auto">
          <ProductGrid onProductSelect={handleAddToCart} />
        </div>
      </div>

      <div className="w-96 bg-white border-l flex flex-col">
        <div className="p-4 border-b">
          {selectedCustomer ? (
            <div className="flex justify-between items-center">
              <div>
                <p className="font-medium">{selectedCustomer.name}</p>
                <p className="text-sm text-gray-600">{selectedCustomer.phone}</p>
              </div>
              <button
                onClick={() => setSelectedCustomer(null)}
                className="text-red-600 hover:text-red-800"
              >
                Remove
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsCustomerSearchOpen(true)}
              className="w-full py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100"
            >
              Add Customer
            </button>
          )}
        </div>

        <Cart
          items={cart}
          onUpdateQuantity={(productId, quantity) => {
            setCart(current =>
              current.map(item =>
                item.productId === productId
                  ? { ...item, quantity }
                  : item
              ).filter(item => item.quantity > 0)
            );
          }}
        />

        <div className="p-4 border-t mt-auto">
          <button
            onClick={() => setIsPaymentModalOpen(true)}
            disabled={cart.length === 0 || isLoading}
            className="w-full py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
          >
            {isLoading ? 'Processing...' : 'Checkout'}
          </button>
        </div>
      </div>

      <PaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        onConfirm={handleCheckout}
        total={cart.reduce((sum, item) => sum + item.price * item.quantity, 0)}
      />

      <CustomerSearch
        isOpen={isCustomerSearchOpen}
        onClose={() => setIsCustomerSearchOpen(false)}
        onSelect={setSelectedCustomer}
      />
    </div>
  );
}; 