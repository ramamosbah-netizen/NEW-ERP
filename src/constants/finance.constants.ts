// ============================================================
// JEET ERP — Finance Operations Constants
// ============================================================

import type {
  InvoiceType,
  InvoiceStatus,
  PaymentMethod,
  CreditNoteStatus,
  SupplierInvoiceType,
  SupplierInvoiceStatus,
  MatchStatus,
  ExpenseCategory
} from '@/types/finance.types';

// --- Client Invoice Type Labels ---
export const INVOICE_TYPE_LABELS: Record<InvoiceType, string> = {
  ADVANCE: 'Advance Payment Invoice',
  PROGRESS: 'Progress Claim Invoice',
  FINAL: 'Final Invoice',
  RETENTION_RELEASE: 'Retention Release Claim',
  STANDALONE: 'Standalone / Ad-hoc Invoice',
};

// --- Client Invoice Status Labels & Colors ---
export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  DRAFT: 'Draft',
  PENDING_APPROVAL: 'Pending Approval',
  APPROVED: 'Approved',
  SENT: 'Sent to Client',
  PARTIALLY_PAID: 'Partially Paid',
  PAID: 'Fully Paid',
  OVERDUE: 'Overdue',
  CANCELLED: 'Cancelled',
  WRITTEN_OFF: 'Written Off',
};

export const INVOICE_STATUS_COLORS: Record<InvoiceStatus, { bg: string; text: string; border: string }> = {
  DRAFT: { bg: 'rgba(100, 116, 139, 0.12)', text: '#94a3b8', border: 'rgba(100, 116, 139, 0.25)' },
  PENDING_APPROVAL: { bg: 'rgba(245, 158, 11, 0.12)', text: '#f59e0b', border: 'rgba(245, 158, 11, 0.25)' },
  APPROVED: { bg: 'color-mix(in srgb, var(--accent) 12%, transparent)', text: 'var(--accent)', border: 'color-mix(in srgb, var(--accent) 25%, transparent)' },
  SENT: { bg: 'rgba(14, 165, 233, 0.12)', text: '#0ea5e9', border: 'rgba(14, 165, 233, 0.25)' },
  PARTIALLY_PAID: { bg: 'rgba(249, 115, 22, 0.12)', text: '#f97316', border: 'rgba(249, 115, 22, 0.25)' },
  PAID: { bg: 'color-mix(in srgb, var(--primary) 12%, transparent)', text: 'var(--primary)', border: 'color-mix(in srgb, var(--primary) 25%, transparent)' },
  OVERDUE: { bg: 'rgba(239, 68, 68, 0.12)', text: '#ef4444', border: 'rgba(239, 68, 68, 0.25)' },
  CANCELLED: { bg: 'rgba(71, 85, 105, 0.2)', text: '#cbd5e1', border: 'rgba(71, 85, 105, 0.35)' },
  WRITTEN_OFF: { bg: 'rgba(239, 68, 68, 0.2)', text: '#fda4af', border: 'rgba(239, 68, 68, 0.35)' },
};

// --- Payment Method Labels ---
export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  TRANSFER: 'Bank Wire / Transfer',
  CHEQUE: 'Cheque Payment',
  CASH: 'Petty Cash',
  CARD: 'Corporate Credit/Debit Card',
};

// --- Credit Note Status Labels & Colors ---
export const CREDIT_NOTE_STATUS_LABELS: Record<CreditNoteStatus, string> = {
  DRAFT: 'Draft CN',
  APPROVED: 'Approved CN',
  CANCELLED: 'Cancelled CN',
};

export const CREDIT_NOTE_STATUS_COLORS: Record<CreditNoteStatus, { bg: string; text: string }> = {
  DRAFT: { bg: 'rgba(245, 158, 11, 0.12)', text: '#f59e0b' },
  APPROVED: { bg: 'color-mix(in srgb, var(--primary) 12%, transparent)', text: 'var(--primary)' },
  CANCELLED: { bg: 'rgba(239, 68, 68, 0.12)', text: '#ef4444' },
};

// --- Supplier Invoice Type Labels ---
export const SUPPLIER_INVOICE_TYPE_LABELS: Record<SupplierInvoiceType, string> = {
  PO_MATCHED: 'PO-GRN Matched Purchase',
  DIRECT_EXPENSE: 'Direct Administrative Expense',
};

// --- Supplier Invoice Status Labels & Colors ---
export const SUPPLIER_INVOICE_STATUS_LABELS: Record<SupplierInvoiceStatus, string> = {
  REGISTERED: 'Registered (New)',
  PENDING_APPROVAL: 'Awaiting Sign-off',
  APPROVED: 'Approved for Payment',
  SCHEDULED: 'Scheduled for Disbursement',
  PARTIALLY_PAID: 'Partially Paid',
  PAID: 'Fully Settled',
  DISPUTED: 'Disputed / On Hold',
  CANCELLED: 'Voided',
};

export const SUPPLIER_INVOICE_STATUS_COLORS: Record<SupplierInvoiceStatus, { bg: string; text: string; border: string }> = {
  REGISTERED: { bg: 'rgba(100, 116, 139, 0.12)', text: '#94a3b8', border: 'rgba(100, 116, 139, 0.25)' },
  PENDING_APPROVAL: { bg: 'rgba(245, 158, 11, 0.12)', text: '#f59e0b', border: 'rgba(245, 158, 11, 0.25)' },
  APPROVED: { bg: 'color-mix(in srgb, var(--accent) 12%, transparent)', text: 'var(--accent)', border: 'color-mix(in srgb, var(--accent) 25%, transparent)' },
  SCHEDULED: { bg: 'rgba(14, 165, 233, 0.12)', text: '#0ea5e9', border: 'rgba(14, 165, 233, 0.25)' },
  PARTIALLY_PAID: { bg: 'rgba(249, 115, 22, 0.12)', text: '#f97316', border: 'rgba(249, 115, 22, 0.25)' },
  PAID: { bg: 'color-mix(in srgb, var(--primary) 12%, transparent)', text: 'var(--primary)', border: 'color-mix(in srgb, var(--primary) 25%, transparent)' },
  DISPUTED: { bg: 'rgba(239, 68, 68, 0.12)', text: '#ef4444', border: 'rgba(239, 68, 68, 0.25)' },
  CANCELLED: { bg: 'rgba(71, 85, 105, 0.2)', text: '#cbd5e1', border: 'rgba(71, 85, 105, 0.35)' },
};

// --- Three-Way Match Status Labels & Colors ---
export const MATCH_STATUS_LABELS: Record<MatchStatus, string> = {
  MATCHED: '3-Way Match Passed',
  EXCEPTION: 'Match Exception',
  OVERRIDDEN: 'Override Accepted',
  NA: 'Not Applicable',
};

export const MATCH_STATUS_COLORS: Record<MatchStatus, { bg: string; text: string }> = {
  MATCHED: { bg: 'color-mix(in srgb, var(--primary) 12%, transparent)', text: 'var(--primary)' },
  EXCEPTION: { bg: 'rgba(239, 68, 68, 0.12)', text: '#ef4444' },
  OVERRIDDEN: { bg: 'rgba(245, 158, 11, 0.12)', text: '#f59e0b' },
  NA: { bg: 'rgba(100, 116, 139, 0.12)', text: '#94a3b8' },
};

// --- Expense Category Labels ---
export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  RENT: 'Commercial Lease & Rent',
  UTILITIES: 'DEWA / Web / Phone',
  SALARIES_PLACEHOLDER: 'Staff Payroll (Finance Ledger)',
  FUEL: 'Vehicle Diesel & Petrol',
  OTHER: 'Miscellaneous Operations',
};

// --- UAE Emirates List ---
export const UAE_EMIRATES = [
  'ABU_DHABI',
  'DUBAI',
  'SHARJAH',
  'AJMAN',
  'UMM_AL_QUWAIN',
  'RAS_AL_KHAIMAH',
  'FUJAIRAH'
] as const;

export type UAEEmirate = typeof UAE_EMIRATES[number];

export const UAE_EMIRATE_LABELS: Record<UAEEmirate, string> = {
  ABU_DHABI: 'Abu Dhabi',
  DUBAI: 'Dubai',
  SHARJAH: 'Sharjah',
  AJMAN: 'Ajman',
  UMM_AL_QUWAIN: 'Umm Al Quwain',
  RAS_AL_KHAIMAH: 'Ras Al Khaimah',
  FUJAIRAH: 'Fujairah',
};

// --- Quick List Arrays ---
export const ALL_INVOICE_TYPES: InvoiceType[] = ['ADVANCE', 'PROGRESS', 'FINAL', 'RETENTION_RELEASE', 'STANDALONE'];
export const ALL_INVOICE_STATUSES: InvoiceStatus[] = ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'SENT', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED', 'WRITTEN_OFF'];
export const ALL_PAYMENT_METHODS: PaymentMethod[] = ['TRANSFER', 'CHEQUE', 'CASH', 'CARD'];
export const ALL_SUPPLIER_INVOICE_STATUSES: SupplierInvoiceStatus[] = ['REGISTERED', 'PENDING_APPROVAL', 'APPROVED', 'SCHEDULED', 'PARTIALLY_PAID', 'PAID', 'DISPUTED', 'CANCELLED'];
export const ALL_EXPENSE_CATEGORIES: ExpenseCategory[] = ['RENT', 'UTILITIES', 'SALARIES_PLACEHOLDER', 'FUEL', 'OTHER'];
