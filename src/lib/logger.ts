// ============================================================
// Aura ERP — Lightweight logging facade
// One funnel for all diagnostics so an error-reporting service
// (Sentry, Logflare, etc.) can be wired in a single spot. Variadic
// signatures mirror console.* so call sites map 1:1.
// ============================================================

type Level = 'debug' | 'info' | 'warn' | 'error';

const isProd = process.env.NODE_ENV === 'production';

function emit(level: Level, args: unknown[]): void {
  // In production, drop noisy debug/info; keep warn/error.
  if (isProd && (level === 'debug' || level === 'info')) return;
  const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  fn(...args);
}

export const logger = {
  debug: (...args: unknown[]) => emit('debug', args),
  info: (...args: unknown[]) => emit('info', args),
  warn: (...args: unknown[]) => emit('warn', args),
  error: (...args: unknown[]) => {
    emit('error', args);
    // Forward to Sentry on the client (lazy import keeps it off the server path
    // and out of the base bundle; no-op until a DSN is configured).
    if (typeof window !== 'undefined') {
      void import('@/lib/observability/sentry').then(m => m.captureError(args)).catch(() => {});
    }
  },
};

export default logger;
