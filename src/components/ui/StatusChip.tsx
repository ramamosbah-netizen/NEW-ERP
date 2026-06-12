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

  // Configuration mapping for colors, borders, and text labels
  const chipConfig: Record<StatusType | string, { label: string; bg: string; text: string; border: string }> = {
    DRAFT: { label: 'Draft', bg: 'rgba(148, 163, 184, 0.12)', text: '#cbd5e1', border: 'rgba(148, 163, 184, 0.25)' },
    PENDING: { label: 'Pending', bg: 'rgba(245, 158, 11, 0.12)', text: '#f59e0b', border: 'rgba(245, 158, 11, 0.25)' },
    PENDING_COMMERCIAL: { label: 'Pending Commercial', bg: 'rgba(245, 158, 11, 0.12)', text: '#f59e0b', border: 'rgba(245, 158, 11, 0.25)' },
    PENDING_GM: { label: 'Pending GM', bg: 'rgba(249, 115, 22, 0.12)', text: '#f97316', border: 'rgba(249, 115, 22, 0.25)' },
    APPROVED: { label: 'Approved', bg: 'rgba(16, 185, 129, 0.12)', text: '#10b981', border: 'rgba(16, 185, 129, 0.25)' },
    SENT: { label: 'Sent', bg: 'rgba(14, 165, 233, 0.12)', text: '#0ea5e9', border: 'rgba(14, 165, 233, 0.25)' },
    SENT_TO_CLIENT: { label: 'Sent to Client', bg: 'rgba(14, 165, 233, 0.12)', text: '#0ea5e9', border: 'rgba(14, 165, 233, 0.25)' },
    SUBMITTED: { label: 'Submitted (Pre-Award)', bg: 'rgba(192, 132, 252, 0.12)', text: '#c084fc', border: 'rgba(192, 132, 252, 0.25)' },
    ACCEPTED: { label: 'Accepted', bg: 'rgba(16, 185, 129, 0.12)', text: '#10b981', border: 'rgba(16, 185, 129, 0.25)' },
    REJECTED: { label: 'Rejected', bg: 'rgba(239, 68, 68, 0.12)', text: '#fca5a5', border: 'rgba(239, 68, 68, 0.25)' },
    REVISED: { label: 'Revised', bg: 'rgba(99, 102, 241, 0.12)', text: '#6366f1', border: 'rgba(99, 102, 241, 0.25)' },
    SUPERSEDED: { label: 'Superseded', bg: 'rgba(100, 116, 139, 0.1)', text: '#64748b', border: 'rgba(100, 116, 139, 0.18)' },
    MOBILIZATION: { label: 'Mobilization', bg: 'rgba(99, 102, 241, 0.12)', text: '#6366f1', border: 'rgba(99, 102, 241, 0.25)' },
    IN_PROGRESS: { label: 'In Progress', bg: 'rgba(59, 130, 246, 0.12)', text: '#93c5fd', border: 'rgba(59, 130, 246, 0.25)' },
    TESTING: { label: 'Testing', bg: 'rgba(245, 158, 11, 0.12)', text: '#fcd34d', border: 'rgba(245, 158, 11, 0.25)' },
    HANDOVER: { label: 'Handover', bg: 'rgba(16, 185, 129, 0.12)', text: '#6ee7b7', border: 'rgba(16, 185, 129, 0.25)' },
    DLP: { label: 'DLP (Warranty)', bg: 'rgba(99, 102, 241, 0.12)', text: '#6366f1', border: 'rgba(99, 102, 241, 0.25)' },
    CLOSED: { label: 'Closed', bg: 'rgba(100, 116, 139, 0.12)', text: '#94a3b8', border: 'rgba(100, 116, 139, 0.25)' },
    ON_HOLD: { label: 'On Hold', bg: 'rgba(239, 68, 68, 0.12)', text: '#fca5a5', border: 'rgba(239, 68, 68, 0.25)' },
    CANCELLED: { label: 'Cancelled', bg: 'rgba(239, 68, 68, 0.2)', text: '#ef4444', border: 'rgba(239, 68, 68, 0.4)' },
    LOST: { label: 'Lost Opportunity', bg: 'rgba(148, 163, 184, 0.15)', text: '#94a3b8', border: 'rgba(148, 163, 184, 0.3)' },
    PAID: { label: 'Paid', bg: 'rgba(16, 185, 129, 0.12)', text: '#10b981', border: 'rgba(16, 185, 129, 0.25)' },
    PARTIALLY_PAID: { label: 'Partially Paid', bg: 'rgba(14, 165, 233, 0.12)', text: '#0ea5e9', border: 'rgba(14, 165, 233, 0.25)' },
    SCHEDULED: { label: 'Scheduled', bg: 'rgba(249, 115, 22, 0.12)', text: '#f97316', border: 'rgba(249, 115, 22, 0.25)' },
    ACTIVE: { label: 'Active', bg: 'rgba(16, 185, 129, 0.12)', text: '#10b981', border: 'rgba(16, 185, 129, 0.25)' },
    INACTIVE: { label: 'Inactive', bg: 'rgba(100, 116, 139, 0.12)', text: '#94a3b8', border: 'rgba(100, 116, 139, 0.25)' },
  };

  const currentConfig = chipConfig[normStatus] || {
    label: status || 'Unknown',
    bg: 'rgba(148, 163, 184, 0.12)',
    text: '#cbd5e1',
    border: 'rgba(148, 163, 184, 0.25)'
  };

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border select-none ${className}`}
      style={{
        backgroundColor: currentConfig.bg,
        color: currentConfig.text,
        borderColor: currentConfig.border,
      }}
    >
      {currentConfig.label}
    </span>
  );
};
