import { useRouter } from 'next/router';
import { useMemo } from 'react';

export function useQueryParams<T extends Record<string, string | number>>() {
  const router = useRouter();

  const params = useMemo(() => {
    const searchParams = new URLSearchParams(router.asPath.split('?')[1]);
    const result: Partial<T> = {};
    
    for (const [key, value] of searchParams.entries()) {
      if (value === '') continue;
      result[key as keyof T] = value as T[keyof T];
    }
    
    return result;
  }, [router.asPath]);

  const setParams = (newParams: Partial<T>) => {
    const searchParams = new URLSearchParams(router.asPath.split('?')[1]);
    
    Object.entries(newParams).forEach(([key, value]) => {
      if (value === undefined || value === '') {
        searchParams.delete(key);
      } else {
        searchParams.set(key, String(value));
      }
    });

    router.push(
      `${router.pathname}?${searchParams.toString()}`,
      undefined,
      { shallow: true }
    );
  };

  return { params, setParams };
} 