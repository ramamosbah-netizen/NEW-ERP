// ============================================================
// JEET ERP — Project Master Status Chip
// Color-coded status badge with appropriate icons
// ============================================================

import React from 'react';
import { 
  Wrench, 
  Play, 
  Activity, 
  CheckCircle, 
  ShieldAlert, 
  Archive, 
  Pause, 
  XOctagon,
  FileText
} from 'lucide-react';
import type { ProjectStatus } from '@/types/project.types';

type Props = {
  status: ProjectStatus;
  className?: string;
};

const statusConfig: Record<ProjectStatus, { label: string; bg: string; text: string; border: string; Icon: any }> = {
  SUBMITTED: {
    label: 'Submitted (Pre-Award)',
    bg: 'rgba(192, 132, 252, 0.12)', // light purple
    text: '#c084fc',
    border: 'rgba(192, 132, 252, 0.25)',
    Icon: FileText
  },
  MOBILIZATION: {
    label: 'Mobilization',
    bg: 'color-mix(in srgb, var(--accent) 12%, transparent)',
    text: '#d8b4fe',
    border: 'color-mix(in srgb, var(--accent) 25%, transparent)',
    Icon: Wrench
  },
  IN_PROGRESS: {
    label: 'In Progress',
    bg: 'rgba(59, 130, 246, 0.12)',
    text: '#93c5fd',
    border: 'rgba(59, 130, 246, 0.25)',
    Icon: Play
  },
  TESTING: {
    label: 'Testing & Commissioning',
    bg: 'rgba(245, 158, 11, 0.12)',
    text: '#fcd34d',
    border: 'rgba(245, 158, 11, 0.25)',
    Icon: Activity
  },
  HANDOVER: {
    label: 'Handover',
    bg: 'rgba(16, 185, 129, 0.12)',
    text: '#6ee7b7',
    border: 'rgba(16, 185, 129, 0.25)',
    Icon: CheckCircle
  },
  DLP: {
    label: 'DLP (Warranty)',
    bg: 'color-mix(in srgb, var(--primary) 12%, transparent)',
    text: '#3b82f6',
    border: 'color-mix(in srgb, var(--primary) 25%, transparent)',
    Icon: ShieldAlert
  },
  CLOSED: {
    label: 'Closed',
    bg: 'rgba(100, 116, 139, 0.12)',
    text: 'var(--text-tertiary)',
    border: 'rgba(100, 116, 139, 0.25)',
    Icon: Archive
  },
  ON_HOLD: {
    label: 'On Hold',
    bg: 'rgba(239, 68, 68, 0.12)',
    text: '#fca5a5',
    border: 'rgba(239, 68, 68, 0.25)',
    Icon: Pause
  },
  CANCELLED: {
    label: 'Cancelled',
    bg: 'rgba(239, 68, 68, 0.2)',
    text: '#ef4444',
    border: 'rgba(239, 68, 68, 0.4)',
    Icon: XOctagon
  },
  LOST: {
    label: 'Lost Opportunity',
    bg: 'rgba(148, 163, 184, 0.15)', // steel grey/reddish
    text: 'var(--text-tertiary)',
    border: 'rgba(148, 163, 184, 0.3)',
    Icon: XOctagon
  }
};

export const ProjectStatusChip: React.FC<Props> = ({ status, className = '' }) => {
  const config = statusConfig[status] || {
    label: status,
    bg: 'var(--surface-hover)',
    text: 'var(--text-secondary)',
    border: 'var(--border)',
    Icon: Play
  };

  const { Icon, label, bg, text, border } = config;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border transition-all ${className}`}
      style={{ backgroundColor: bg, color: text, borderColor: border }}
    >
      <Icon size={12} />
      {label}
    </span>
  );
};
