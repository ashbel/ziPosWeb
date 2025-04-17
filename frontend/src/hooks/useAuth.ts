import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/components/ui/use-toast';

interface LoginCredentials {
  email: string;
  password: string;
}

export function useAuth() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const { mutateAsync: login, isLoading } = useMutation({
    mutationFn: async (credentials: LoginCredentials) => {
      const response = await api.post('/auth/login', credentials);
      return response.data;
    },
    onSuccess: (data) => {
      localStorage.setItem('token', data.token);
      toast({
        title: 'Success',
        description: 'Logged in successfully',
      });
      navigate('/dashboard');
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: 'Failed to login',
        variant: 'destructive',
      });
    },
  });

  const logout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  const isAuthenticated = !!localStorage.getItem('token');

  return {
    login,
    logout,
    isLoading,
    isAuthenticated,
  };
} 