import Link from 'next/link';
import { Compass } from 'lucide-react';

// Rendered for unmatched routes and explicit notFound() calls.
export default function NotFound() {
  return (
    <main className="flex-1 flex flex-col items-center justify-center p-6 text-center text-[var(--text-primary)] min-h-[calc(100vh-60px)]">
      <div className="p-8 bg-[var(--surface-hover)] border border-[var(--border)] rounded-2xl flex flex-col items-center max-w-md gap-4 shadow-2xl backdrop-blur-md">
        <div className="rounded-2xl bg-[var(--surface-hover)] p-4 border border-[var(--border)] shadow-inner">
          <Compass className="text-[var(--accent)]" size={36} />
        </div>
        <h2 className="text-lg font-bold tracking-tight">Page not found</h2>
        <p className="text-xs text-[var(--text-muted)] leading-relaxed">
          The page you’re looking for doesn’t exist or may have moved.
        </p>
        <Link
          href="/dashboard"
          className="mt-2 bg-gradient-to-r from-[var(--accent)] to-[var(--accent)] text-white font-bold px-5 py-2 rounded-lg text-xs transition-all shadow-lg shadow-[var(--accent-glow)] active:scale-98 select-none"
        >
          Back to dashboard
        </Link>
      </div>
    </main>
  );
}
