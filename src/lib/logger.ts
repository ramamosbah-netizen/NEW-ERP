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
    // TODO(observability): forward to an error-reporting service in production.
    // e.g. Sentry.captureException(args.find(a => a instanceof Error) ?? new Error(String(args[0])));
  },
};

export default logger;
