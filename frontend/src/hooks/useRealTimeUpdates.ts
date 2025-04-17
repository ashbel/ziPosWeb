import { useEffect } from 'react';
import { socketManager } from '@/utils/socket';
import { useQueryClient } from '@tanstack/react-query';

export function useRealTimeUpdates(channels: string[]) {
  const queryClient = useQueryClient();

  useEffect(() => {
    channels.forEach(channel => {
      socketManager.subscribe(channel);
    });

    return () => {
      channels.forEach(channel => {
        socketManager.unsubscribe(channel);
      });
    };
  }, [channels]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        queryClient.invalidateQueries();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [queryClient]);
} 