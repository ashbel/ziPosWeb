import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/utils/api';

export const useSale = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (saleData: {
      items: CartItem[];
      customerId?: string;
      paymentType: string;
      amount: number;
    }) => api.post('/sales', saleData).then(res => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries(['products']); // Refresh product stock
      queryClient.invalidateQueries(['sales']); // Refresh sales history
    }
  });
}; 