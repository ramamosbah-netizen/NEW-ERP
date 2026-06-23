import React from 'react';
import { HelpCircle } from 'lucide-react';

// ============================================================
// Aura ERP — Tooltip + InfoHint (inline help)
// Zero-dependency, keyboard-accessible hints for dense enterprise screens:
// hover or focus to reveal. Styling lives in layout.css under `.erp-hint`.
// ============================================================

/** Wrap any element to show a hint bubble on hover/focus. */
export function Tooltip({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <span className={`erp-hint ${className}`} tabIndex={0} aria-label={label} style={{ cursor: 'default' }}>
      {children}
      <span className="erp-hint-bubble" role="tooltip">{label}</span>
    </span>
  );
}

/** A small "?" that explains a field, metric or section on hover/focus. */
export function InfoHint({ text, size = 13, className = '' }: { text: string; size?: number; className?: string }) {
  return (
    <span className={`erp-hint ${className}`} tabIndex={0} aria-label={text}>
      <HelpCircle size={size} />
      <span className="erp-hint-bubble" role="tooltip">{text}</span>
    </span>
  );
}
