'use client';

// ============================================================
// Aura ERP — TanStack Query provider
// Single client for the app: cache, dedup, background refresh, and
// invalidation replace the hand-rolled useState/useEffect fetch hooks.
// ============================================================

import { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { initSentry } from '@/lib/observability/sentry';

export default function QueryProvider({ children }: { children: React.ReactNode }) {
  // Initialise error reporting once on the client (inert without a DSN).
  useEffect(() => { initSentry(); }, []);

  // Keep one client per browser session (lazy init so it's stable across renders).
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000, // 30s: dedup the bursts of refetch-on-mount
            gcTime: 5 * 60_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  );

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
