import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/utils/api';

export const useInventory = (branchId: string) => {
  const queryClient = useQueryClient();

  const inventory = useQuery({
    queryKey: ['inventory', branchId],
    queryFn: () => api.get(`/inventory/${branchId}`).then(res => res.data)
  });

  const adjustStock = useMutation({
    mutationFn: (data: {
      productId: string;
      quantity: number;
      type: 'add' | 'remove';
      reason: string;
    }) => api.post(`/inventory/${branchId}/adjust`, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['inventory', branchId]);
      queryClient.invalidateQueries(['products']);
    }
  });

  const recordStockCount = useMutation({
    mutationFn: (data: {
      productId: string;
      actualQuantity: number;
      notes?: string;
    }) => api.post(`/inventory/${branchId}/count`, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['inventory', branchId]);
      queryClient.invalidateQueries(['products']);
    }
  });

  return {
    inventory,
    adjustStock,
    recordStockCount
  };
}; 