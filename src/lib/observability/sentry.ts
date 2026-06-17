// ============================================================
// Aura ERP — Sentry error reporting
// Inert until NEXT_PUBLIC_SENTRY_DSN is set, so it ships safely with no DSN.
// Client-side only (this app is a browser SPA); server API routes can adopt
// @sentry/nextjs later for full coverage. Wired into logger.error.
// ============================================================

import * as Sentry from '@sentry/browser';

let initialized = false;

/** Initialise Sentry once on the client, only when a DSN is configured. */
export function initSentry(): void {
  if (initialized || typeof window === 'undefined') return;
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) return; // no DSN → stay completely inert
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,
    tracesSampleRate: 0, // errors only for now (no performance tracing)
  });
  initialized = true;
}

/** Forward a logger.error(...) payload to Sentry (no-op until initialised). */
export function captureError(args: unknown[]): void {
  if (!initialized) return;
  const err = args.find(a => a instanceof Error) as Error | undefined;
  if (err) {
    Sentry.captureException(err);
  } else {
    const msg = args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
    if (msg) Sentry.captureMessage(msg, 'error');
  }
}
