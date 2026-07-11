'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useAuthStore } from '@/lib/store';

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const initialize = useAuthStore((state) => state.initialize);
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: 1,
          },
        },
      }),
  );

  useEffect(() => {
    void initialize();
  }, [initialize]);

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
