// ============================================================
// JEET ERP — Document Processing Chip Component
// Color-coded status badge indicating filing accuracy/review stage
// ============================================================

import React from 'react';
import { Loader2, CheckCircle2, AlertCircle, ShieldCheck, XCircle } from 'lucide-react';
import type { DocumentStatus } from '@/types/document.types';

type Props = {
  status: DocumentStatus;
  confidence?: number | null;
  className?: string;
};

const statusConfig: Record<DocumentStatus, { label: string; bg: string; text: string; border: string; Icon: any }> = {
  PROCESSING: {
    label: 'AI Processing',
    bg: 'color-mix(in srgb, var(--accent) 12%, transparent)',
    text: '#d8b4fe',
    border: 'color-mix(in srgb, var(--accent) 25%, transparent)',
    Icon: Loader2
  },
  AUTO_FILED: {
    label: 'Auto Filed',
    bg: 'color-mix(in srgb, var(--primary) 12%, transparent)',
    text: '#10b981',
    border: 'color-mix(in srgb, var(--primary) 25%, transparent)',
    Icon: CheckCircle2
  },
  NEEDS_REVIEW: {
    label: 'Needs Review',
    bg: 'rgba(245, 158, 11, 0.12)',
    text: '#fcd34d',
    border: 'rgba(245, 158, 11, 0.25)',
    Icon: AlertCircle
  },
  VERIFIED: {
    label: 'Verified',
    bg: 'color-mix(in srgb, var(--primary) 12%, transparent)',
    text: '#3b82f6',
    border: 'color-mix(in srgb, var(--primary) 25%, transparent)',
    Icon: ShieldCheck
  },
  REJECTED: {
    label: 'Rejected',
    bg: 'rgba(239, 68, 68, 0.12)',
    text: '#fca5a5',
    border: 'rgba(239, 68, 68, 0.25)',
    Icon: XCircle
  }
};

export const DocumentProcessingChip: React.FC<Props> = ({ status, confidence, className = '' }) => {
  const config = statusConfig[status] || {
    label: status,
    bg: 'var(--surface-hover)',
    text: 'var(--text-secondary)',
    border: 'var(--border)',
    Icon: AlertCircle
  };

  const { Icon, label, bg, text, border } = config;
  const isSpinning = status === 'PROCESSING';

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border transition-all ${className}`}
      style={{ backgroundColor: bg, color: text, borderColor: border }}
    >
      <Icon size={12} className={isSpinning ? 'animate-spin' : ''} />
      <span>{label}</span>
      {status === 'AUTO_FILED' && confidence != null && (
        <span style={{ fontSize: '0.65rem', opacity: 0.8, borderLeft: '1px solid color-mix(in srgb, var(--primary) 30%, transparent)', paddingLeft: '5px' }}>
          {Math.round(confidence * 100)}%
        </span>
      )}
    </span>
  );
};
