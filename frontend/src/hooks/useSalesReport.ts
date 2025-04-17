import { useQuery } from '@tanstack/react-query';
import api from '@/utils/api';

interface SalesReportFilters {
  startDate: Date;
  endDate: Date;
  branchId?: string;
  categoryId?: string;
  productId?: string;
}

export const useSalesReport = (filters: SalesReportFilters) => {
  return useQuery({
    queryKey: ['sales-report', filters],
    queryFn: () => api.get('/reports/sales', { params: filters }).then(res => res.data)
  });
}; 