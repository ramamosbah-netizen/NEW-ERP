// ============================================================
// JEET ERP — Variation Order (VO) Constants
// Location: src/constants/vo.constants.ts
// Bloomberg Terminal Obsidian/Electric Mint tailors
// ============================================================

import { VOType, VOOrigin, VOStatus, VOPricingBasis, VOWorkStatus } from '@/types/vo.types';

export const VO_TYPES: VOType[] = [
  'ADDITION',
  'OMISSION',
  'SUBSTITUTION',
  'RATE_CHANGE',
  'DAYWORKS',
  'PROVISIONAL_SUM_ADJ'
];

export const VO_TYPE_LABELS: Record<VOType, string> = {
  ADDITION: 'Addition (New Scope)',
  OMISSION: 'Omission (Scope Credit)',
  SUBSTITUTION: 'Substitution (Swap/Spec Change)',
  RATE_CHANGE: 'Rate Change (Re-rate Item)',
  DAYWORKS: 'Dayworks (T&M Billing)',
  PROVISIONAL_SUM_ADJ: 'Provisional Sum Adjustment'
};

export const VO_ORIGINS: VOOrigin[] = [
  'CLIENT_INSTRUCTION',
  'SITE_INSTRUCTION',
  'CONSULTANT',
  'RFI',
  'DESIGN_CHANGE',
  'SITE_CONDITION'
];

export const VO_ORIGIN_LABELS: Record<VOOrigin, string> = {
  CLIENT_INSTRUCTION: 'Client Written Instruction',
  SITE_INSTRUCTION: 'Site Instruction (Verbal)',
  CONSULTANT: 'Consultant Variation Order Request',
  RFI: 'RFI Resolution Outcome',
  DESIGN_CHANGE: 'Design Change/Revision',
  SITE_CONDITION: 'Unforeseen Site Condition'
};

export const VO_STATUSES: VOStatus[] = [
  'DRAFT',
  'PRICED',
  'PENDING_INTERNAL',
  'INTERNALLY_APPROVED',
  'SUBMITTED_TO_CLIENT',
  'CLIENT_APPROVED',
  'CLIENT_REJECTED',
  'REVISED',
  'SUPERSEDED',
  'CANCELLED'
];

export const VO_STATUS_LABELS: Record<VOStatus, string> = {
  DRAFT: 'Draft (Scope Collection)',
  PRICED: 'Priced (Estimation Complete)',
  PENDING_INTERNAL: 'Pending Internal Sign-off',
  INTERNALLY_APPROVED: 'Approved Internally',
  SUBMITTED_TO_CLIENT: 'Issued to Client',
  CLIENT_APPROVED: 'Client Approved (Contract Revised)',
  CLIENT_REJECTED: 'Rejected by Client',
  REVISED: 'Revised (Superseded)',
  SUPERSEDED: 'Superseded',
  CANCELLED: 'Cancelled'
};

// Bloomberg Obsidian Harmonious HSL/Hex Palettes
export const VO_STATUS_COLORS: Record<VOStatus, { bg: string; text: string; border: string }> = {
  DRAFT: {
    bg: 'rgba(148, 163, 184, 0.1)',
    text: '#94a3b8',
    border: 'rgba(148, 163, 184, 0.25)'
  },
  PRICED: {
    bg: 'rgba(56, 189, 248, 0.1)',
    text: '#38bdf8',
    border: 'rgba(56, 189, 248, 0.25)'
  },
  PENDING_INTERNAL: {
    bg: 'rgba(234, 179, 8, 0.1)',
    text: '#eab308',
    border: 'rgba(234, 179, 8, 0.25)'
  },
  INTERNALLY_APPROVED: {
    bg: 'rgba(99, 102, 241, 0.1)',
    text: '#6366f1',
    border: 'rgba(99, 102, 241, 0.25)'
  },
  SUBMITTED_TO_CLIENT: {
    bg: 'rgba(168, 85, 247, 0.1)',
    text: '#a855f7',
    border: 'rgba(168, 85, 247, 0.25)'
  },
  CLIENT_APPROVED: {
    bg: 'rgba(0, 229, 160, 0.1)',
    text: '#00E5A0',
    border: 'rgba(0, 229, 160, 0.3)'
  },
  CLIENT_REJECTED: {
    bg: 'rgba(239, 68, 68, 0.1)',
    text: '#ef4444',
    border: 'rgba(239, 68, 68, 0.3)'
  },
  REVISED: {
    bg: 'rgba(249, 115, 22, 0.1)',
    text: '#f97316',
    border: 'rgba(249, 115, 22, 0.25)'
  },
  SUPERSEDED: {
    bg: 'rgba(100, 116, 139, 0.08)',
    text: '#64748b',
    border: 'rgba(100, 116, 139, 0.15)'
  },
  CANCELLED: {
    bg: 'rgba(244, 63, 94, 0.08)',
    text: '#f43f5e',
    border: 'rgba(244, 63, 94, 0.15)'
  }
};

export const VO_PRICING_BASIS: VOPricingBasis[] = [
  'BOQ_RATES',
  'NEW_RATES',
  'DAYWORKS',
  'NEGOTIATED'
];

export const VO_PRICING_BASIS_LABELS: Record<VOPricingBasis, string> = {
  BOQ_RATES: 'Original BOQ Unit Rates',
  NEW_RATES: 'New Rates (Rate Analysis)',
  DAYWORKS: 'Dayworks (Labour & Materials Sheet)',
  NEGOTIATED: 'Negotiated Lump Sum / Price'
};

export const VO_WORK_STATUSES: VOWorkStatus[] = [
  'NOT_STARTED',
  'IN_PROGRESS',
  'COMPLETED'
];

export const VO_WORK_STATUS_LABELS: Record<VOWorkStatus, string> = {
  NOT_STARTED: 'Not Started',
  IN_PROGRESS: 'Work In Progress',
  COMPLETED: 'Work Completed on Site'
};
