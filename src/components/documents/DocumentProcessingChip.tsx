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
    bg: 'rgba(168, 85, 247, 0.12)',
    text: '#d8b4fe',
    border: 'rgba(168, 85, 247, 0.25)',
    Icon: Loader2
  },
  AUTO_FILED: {
    label: 'Auto Filed',
    bg: 'rgba(0, 229, 160, 0.12)',
    text: '#00E5A0',
    border: 'rgba(0, 229, 160, 0.25)',
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
    bg: 'rgba(34, 211, 238, 0.12)',
    text: '#22d3ee',
    border: 'rgba(34, 211, 238, 0.25)',
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
    bg: 'rgba(255, 255, 255, 0.05)',
    text: 'var(--text-secondary)',
    border: 'rgba(255, 255, 255, 0.1)',
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
        <span style={{ fontSize: '0.65rem', opacity: 0.8, borderLeft: '1px solid rgba(0, 229, 160, 0.3)', paddingLeft: '5px' }}>
          {Math.round(confidence * 100)}%
        </span>
      )}
    </span>
  );
};
