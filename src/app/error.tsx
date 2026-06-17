'use client'; // Error boundaries must be Client Components

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import { logger } from '@/lib/logger';

// Wraps every route segment below the root layout. A thrown render/data error
// shows this fallback instead of a blank screen, with a retry path.
export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    logger.error('Route segment crashed', { message: error.message, digest: error.digest });
  }, [error]);

  return (
    <main className="flex-1 flex flex-col items-center justify-center p-6 text-center text-[var(--text-primary)] min-h-[calc(100vh-60px)]">
      <div className="p-8 bg-[var(--surface-hover)] border border-[var(--border)] rounded-2xl flex flex-col items-center max-w-md gap-4 shadow-2xl backdrop-blur-md">
        <div className="rounded-2xl bg-[var(--status-danger-bg)] p-4 border border-[var(--status-danger-border)] shadow-inner">
          <AlertTriangle className="text-[var(--status-danger-text)]" size={36} />
        </div>
        <h2 className="text-lg font-bold tracking-tight text-[var(--text-primary)]">Something went wrong</h2>
        <p className="text-xs text-[var(--text-muted)] leading-relaxed">
          This page hit an unexpected error. You can try again, or head back to your dashboard.
          {error.digest ? (
            <span className="block mt-2 font-mono text-[10px] opacity-60">Ref: {error.digest}</span>
          ) : null}
        </p>
        <div className="flex items-center gap-2 mt-2">
          <button
            onClick={() => unstable_retry()}
            className="bg-gradient-to-r from-[var(--accent)] to-[var(--accent)] text-white font-bold px-5 py-2 rounded-lg text-xs transition-all shadow-lg shadow-[var(--accent-glow)] active:scale-98 select-none"
          >
            Try again
          </button>
          <Link
            href="/dashboard"
            className="px-5 py-2 rounded-lg text-xs font-semibold border border-[var(--border)] text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-all select-none"
          >
            Go to dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
