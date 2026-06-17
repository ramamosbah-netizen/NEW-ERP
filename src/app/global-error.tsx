'use client'; // Error boundaries must be Client Components

import { useEffect } from 'react';
import { logger } from '@/lib/logger';

// Last-resort boundary: catches errors thrown in the ROOT layout itself, which
// the segment-level error.tsx cannot. Must render its own <html>/<body> and
// rely on inline styles (the root layout — and its CSS — is replaced here).
export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    logger.error('Root layout crashed (global-error)', { message: error.message, digest: error.digest });
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0b0f17',
          color: '#e6e8ee',
          fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
        }}
      >
        <div
          style={{
            maxWidth: 420,
            padding: '2rem',
            textAlign: 'center',
            border: '1px solid #232a39',
            borderRadius: 16,
            background: '#121826',
          }}
        >
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 0.5rem' }}>Application error</h2>
          <p style={{ fontSize: 13, lineHeight: 1.6, opacity: 0.75, margin: '0 0 1.25rem' }}>
            The app failed to load. Please try again. If it keeps happening, contact your administrator.
            {error.digest ? (
              <span style={{ display: 'block', marginTop: 8, fontSize: 10, opacity: 0.6, fontFamily: 'monospace' }}>
                Ref: {error.digest}
              </span>
            ) : null}
          </p>
          <button
            onClick={() => unstable_retry()}
            style={{
              background: '#3b82f6',
              color: '#fff',
              fontWeight: 700,
              fontSize: 13,
              padding: '0.55rem 1.25rem',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
