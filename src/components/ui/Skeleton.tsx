import React from 'react';

// ============================================================
// Aura ERP — Skeleton loaders
// Content-shaped placeholders for a calmer, faster-feeling load than a spinner.
// Styling (shimmer) lives in layout.css under `.erp-skeleton`.
// ============================================================

export function Skeleton({ className = '', style }: { className?: string; style?: React.CSSProperties }) {
  return <div className={`erp-skeleton ${className}`} style={style} aria-hidden="true" />;
}

/** A few lines of text — last line short, like a real paragraph. */
export function SkeletonText({ lines = 3, className = '' }: { lines?: number; className?: string }) {
  return (
    <div className={`flex flex-col gap-2 ${className}`} aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="erp-skeleton h-3 rounded" style={{ width: i === lines - 1 ? '60%' : '100%' }} />
      ))}
    </div>
  );
}

/** A KPI/stat card placeholder (label + value). */
export function SkeletonCard({ className = '' }: { className?: string }) {
  return (
    <div className={`p-4 rounded-lg border border-[var(--border-color)] ${className}`} aria-hidden="true">
      <div className="erp-skeleton h-3 w-20 rounded mb-3" />
      <div className="erp-skeleton h-6 w-14 rounded" />
    </div>
  );
}

/** Rows of a table/list, fading slightly down the list. */
export function SkeletonRows({ rows = 5, cols = 4, className = '' }: { rows?: number; cols?: number; className?: string }) {
  return (
    <div className={`flex flex-col gap-2.5 ${className}`} aria-hidden="true">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-3" style={{ opacity: Math.max(0.35, 1 - r * 0.12) }}>
          {Array.from({ length: cols }).map((_, c) => (
            <div key={c} className="erp-skeleton h-4 rounded" style={{ flex: c === 0 ? 2 : 1 }} />
          ))}
        </div>
      ))}
    </div>
  );
}
