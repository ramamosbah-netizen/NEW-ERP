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
  | 'INACTIVE';

interface StatusChipProps {
  status: StatusType | string;
  className?: string;
}

export const StatusChip: React.FC<StatusChipProps> = ({ status, className = '' }) => {
  const normStatus = (status || '').toUpperCase() as StatusType;

  // Configuration mapping for labels
  const chipLabels: Record<StatusType | string, string> = {
    DRAFT: 'Draft',
    PENDING: 'Pending',
    PENDING_COMMERCIAL: 'Pending Commercial',
    PENDING_GM: 'Pending GM',
    APPROVED: 'Approved',
    SENT: 'Sent',
    SENT_TO_CLIENT: 'Sent to Client',
    SUBMITTED: 'Submitted (Pre-Award)',
    ACCEPTED: 'Accepted',
    REJECTED: 'Rejected',
    REVISED: 'Revised',
    SUPERSEDED: 'Superseded',
    MOBILIZATION: 'Mobilization',
    IN_PROGRESS: 'In Progress',
    TESTING: 'Testing',
    HANDOVER: 'Handover',
    DLP: 'DLP (Warranty)',
    CLOSED: 'Closed',
    ON_HOLD: 'On Hold',
    CANCELLED: 'Cancelled',
    LOST: 'Lost Opportunity',
    PAID: 'Paid',
    PARTIALLY_PAID: 'Partially Paid',
    SCHEDULED: 'Scheduled',
    ACTIVE: 'Active',
    INACTIVE: 'Inactive',
  };

  const getThemeStyles = (st: StatusType) => {
    switch (st) {
      case 'APPROVED':
      case 'ACCEPTED':
      case 'HANDOVER':
      case 'PAID':
      case 'ACTIVE':
        return {
          bg: 'var(--status-success-bg)',
          text: 'var(--status-success-text)',
          border: 'var(--status-success-border)',
        };
      case 'PENDING':
      case 'PENDING_COMMERCIAL':
      case 'PENDING_GM':
      case 'TESTING':
      case 'ON_HOLD':
      case 'SCHEDULED':
        return {
          bg: 'var(--status-warning-bg)',
          text: 'var(--status-warning-text)',
          border: 'var(--status-warning-border)',
        };
      case 'REJECTED':
      case 'CANCELLED':
        return {
          bg: 'var(--status-danger-bg)',
          text: 'var(--status-danger-text)',
          border: 'var(--status-danger-border)',
        };
      case 'SENT':
      case 'SENT_TO_CLIENT':
      case 'SUBMITTED':
      case 'IN_PROGRESS':
      case 'MOBILIZATION':
      case 'DLP':
      case 'PARTIALLY_PAID':
      case 'REVISED':
        return {
          bg: 'var(--status-info-bg)',
          text: 'var(--status-info-text)',
          border: 'var(--status-info-border)',
        };
      case 'DRAFT':
      case 'SUPERSEDED':
      case 'CLOSED':
      case 'LOST':
      case 'INACTIVE':
      default:
        return {
          bg: 'var(--status-neutral-bg)',
          text: 'var(--status-neutral-text)',
          border: 'var(--status-neutral-border)',
        };
    }
  };

  const label = chipLabels[normStatus] || status || 'Unknown';
  const styles = getThemeStyles(normStatus);

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border select-none ${className}`}
      style={{
        backgroundColor: styles.bg,
        color: styles.text,
        borderColor: styles.border,
      }}
    >
      {label}
    </span>
  );
};
