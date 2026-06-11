// ============================================================
// JEET ERP — System Event Types Constants
// ============================================================

export const EVENTS = {
  QUOTATION: {
    SUBMITTED: 'quotation.submitted',
    APPROVED: 'quotation.approved',
    REJECTED: 'quotation.rejected',
    ACCEPTED: 'quotation.accepted_by_client'
  },
  COMPARISON: {
    SUBMITTED: 'comparison.submitted',
    APPROVED: 'comparison.approved'
  },
  PROJECT: {
    CREATED: 'project.created',
    STATUS_CHANGED: 'project.status_changed',
    DLP_EXPIRING: 'project.dlp_expiring'
  },
  DMS: {
    NEEDS_REVIEW: 'document.needs_review',
    EXPIRING: 'document.expiring',
    UPLOADED: 'document.uploaded'
  },
  TASK: {
    ASSIGNED: 'task.assigned',
    DUE_SOON: 'task.due_soon',
    OVERDUE: 'task.overdue'
  },
  MEETING: {
    SCHEDULED: 'meeting.scheduled',
    STARTING_SOON: 'meeting.starting_soon',
    MINUTES_PUBLISHED: 'meeting.minutes_published'
  },
  ESCALATION: {
    APPROVAL: 'approval.escalation'
  },
  PO: {
    CREATED: 'po.created',
    SUBMITTED: 'po.submitted',
    APPROVED: 'po.approved',
    REJECTED: 'po.rejected',
    SENT: 'po.sent',
    ACKNOWLEDGED: 'po.acknowledged',
    CANCELLED: 'po.cancelled',
    FULLY_DELIVERED: 'po.fully_delivered',
    PARTIALLY_DELIVERED: 'po.partially_delivered',
    REVISED: 'po.revised'
  },
  GRN: {
    RECORDED: 'grn.recorded',
    RETURNED: 'grn.returned'
  }
} as const;

export type EventTypeConstant = typeof EVENTS[keyof typeof EVENTS][keyof typeof EVENTS[keyof typeof EVENTS]];

