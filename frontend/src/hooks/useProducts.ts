import { useQuery } from '@tanstack/react-query';
import api from '@/utils/api';

export const useProducts = (filters?: { categoryId?: string; search?: string }) => {
  return useQuery({
    queryKey: ['products', filters],
    queryFn: async () => {
      const { data } = await api.get('/products', { params: filters });
      return data;
    }
  });
}; 