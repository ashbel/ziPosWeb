import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/utils/api';
import { useRouter } from 'next/router';

export const useAuth = () => {
  const queryClient = useQueryClient();
  const router = useRouter();

  const login = useMutation({
    mutationFn: (credentials: { email: string; password: string }) =>
      api.post('/auth/login', credentials).then(res => res.data),
    onSuccess: (data) => {
      localStorage.setItem('token', data.token);
      queryClient.setQueryData(['user'], data.user);
      router.push('/dashboard');
    }
  });

  const logout = () => {
    localStorage.removeItem('token');
    queryClient.clear();
    router.push('/login');
  };

  return {
    login: login.mutateAsync,
    logout,
    isLoading: login.isLoading
  };
}; 