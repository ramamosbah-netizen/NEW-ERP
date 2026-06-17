// Default route-segment loading UI (App Router Suspense fallback).
// Shown while a segment streams in, instead of a frozen/blank screen.
export default function Loading() {
  return (
    <main className="flex-1 flex flex-col items-center justify-center gap-4 p-6 min-h-[calc(100vh-60px)]">
      <div
        className="h-9 w-9 rounded-full border-2 border-[var(--border)] border-t-[var(--accent)] animate-spin"
        role="status"
        aria-label="Loading"
      />
      <p className="text-xs text-[var(--text-muted)]">Loading…</p>
    </main>
  );
}
