import React from 'react';

export type StatusType =
  | 'DRAFT'
  | 'PENDING'
  | 'PENDING_COMMERCIAL'
  | 'PENDING_GM'
  | 'APPROVED'
  | 'SENT'
  | 'SENT_TO_CLIENT'
  | 'SUBMITTED'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'REVISED'
  | 'SUPERSEDED'
  | 'MOBILIZATION'
  | 'IN_PROGRESS'
  | 'TESTING'
  | 'HANDOVER'
  | 'DLP'
  | 'CLOSED'
  | 'ON_HOLD'
  | 'CANCELLED'
  | 'LOST'
  | 'PAID'
  | 'PARTIALLY_PAID'
  | 'SCHEDULED'
  | 'ACTIVE'
  | 'INACTIVE'
  | 'PENDING_APPROVAL'
  | 'OVERDUE';

interface StatusChipProps {
  status: StatusType | string;
  className?: string;
}

type ChipVariant = 'neutral' | 'success' | 'warning' | 'info' | 'danger';

const CHIP_CONFIG: Record<string, { label: string; variant: ChipVariant }> = {
  DRAFT:              { label: 'Draft',              variant: 'neutral' },
  PENDING:            { label: 'Pending',            variant: 'warning' },
  PENDING_APPROVAL:   { label: 'Pending Approval',   variant: 'warning' },
  PENDING_COMMERCIAL: { label: 'Commercial Review',  variant: 'warning' },
  PENDING_GM:         { label: 'GM Approval',        variant: 'warning' },
  APPROVED:           { label: 'Approved',           variant: 'success' },
  ACTIVE:             { label: 'Active',             variant: 'success' },
  PAID:               { label: 'Paid',               variant: 'success' },
  ACCEPTED:           { label: 'Accepted',           variant: 'success' },
  HANDOVER:           { label: 'Handover',           variant: 'success' },
  SENT:               { label: 'Sent',               variant: 'info' },
  SENT_TO_CLIENT:     { label: 'Sent to Client',     variant: 'info' },
  SUBMITTED:          { label: 'Submitted',          variant: 'info' },
  IN_PROGRESS:        { label: 'In Progress',        variant: 'info' },
  MOBILIZATION:       { label: 'Mobilization',       variant: 'info' },
  DLP:                { label: 'DLP / Warranty',     variant: 'info' },
  PARTIALLY_PAID:     { label: 'Partial',            variant: 'info' },
  REVISED:            { label: 'Revised',            variant: 'info' },
  TESTING:            { label: 'Testing',            variant: 'warning' },
  ON_HOLD:            { label: 'On Hold',            variant: 'warning' },
  SCHEDULED:          { label: 'Scheduled',          variant: 'warning' },
  REJECTED:           { label: 'Rejected',           variant: 'danger' },
  CANCELLED:          { label: 'Cancelled',          variant: 'danger' },
  OVERDUE:            { label: 'Overdue',            variant: 'danger' },
  CLOSED:             { label: 'Closed',             variant: 'neutral' },
  LOST:               { label: 'Lost',               variant: 'neutral' },
  SUPERSEDED:         { label: 'Superseded',         variant: 'neutral' },
  INACTIVE:           { label: 'Inactive',           variant: 'neutral' },
};

const VARIANT_STYLES: Record<ChipVariant, string> = {
  neutral: 'bg-[var(--status-neutral-bg)] text-[var(--status-neutral-text)] border-[var(--status-neutral-border)]',
  success: 'bg-[var(--status-success-bg)] text-[var(--status-success-text)] border-[var(--status-success-border)]',
  warning: 'bg-[var(--status-warning-bg)] text-[var(--status-warning-text)] border-[var(--status-warning-border)]',
  info:    'bg-[var(--status-info-bg)]    text-[var(--status-info-text)]    border-[var(--status-info-border)]',
  danger:  'bg-[var(--status-danger-bg)]  text-[var(--status-danger-text)]  border-[var(--status-danger-border)]',
};

export const StatusChip: React.FC<StatusChipProps> = ({ status, className = '' }) => {
  const key = (status || '').toUpperCase();
  const config = CHIP_CONFIG[key];
  const label = config?.label ?? (status || 'Unknown');
  const variant: ChipVariant = config?.variant ?? 'neutral';

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-md text-[0.6875rem] font-medium border select-none ${VARIANT_STYLES[variant]} ${className}`}
    >
      {label}
    </span>
  );
};
