// ============================================================
// JEET ERP — Purchase Order & GRN Constants
// ============================================================

import type { 
  POStatus, 
  POType, 
  POOrigin, 
  PODeliveryStatus, 
  POItemReceiptStatus, 
  POApprovalStage 
} from '@/types/po.types';
import type { 
  GRNStatus, 
  GRNLocation, 
  GRNRejectionReason, 
  GRNReturnStatus 
} from '@/types/grn.types';

// --- PO Status Labels & Colors ---
export const PO_STATUS_LABELS: Record<POStatus, string> = {
  DRAFT: 'Draft',
  PENDING_APPROVAL: 'Pending Approval',
  APPROVED: 'Approved',
  SENT: 'Sent to Supplier',
  ACKNOWLEDGED: 'Acknowledged',
  PARTIALLY_DELIVERED: 'Partially Delivered',
  DELIVERED: 'Fully Delivered',
  CLOSED: 'Closed',
  CANCELLED: 'Cancelled',
  REVISED: 'Revised',
  SUPERSEDED: 'Superseded',
};

export const PO_STATUS_COLORS: Record<POStatus, { bg: string; text: string; border: string }> = {
  DRAFT: { bg: 'rgba(100, 116, 139, 0.12)', text: '#94a3b8', border: 'rgba(100, 116, 139, 0.25)' },
  PENDING_APPROVAL: { bg: 'rgba(245, 158, 11, 0.12)', text: '#f59e0b', border: 'rgba(245, 158, 11, 0.25)' },
  APPROVED: { bg: 'rgba(168, 85, 247, 0.12)', text: '#a855f7', border: 'rgba(168, 85, 247, 0.25)' },
  SENT: { bg: 'rgba(14, 165, 233, 0.12)', text: '#0ea5e9', border: 'rgba(14, 165, 233, 0.25)' },
  ACKNOWLEDGED: { bg: 'rgba(6, 182, 212, 0.12)', text: '#06b6d4', border: 'rgba(6, 182, 212, 0.25)' },
  PARTIALLY_DELIVERED: { bg: 'rgba(249, 115, 22, 0.12)', text: '#f97316', border: 'rgba(249, 115, 22, 0.25)' },
  DELIVERED: { bg: 'rgba(0, 229, 160, 0.12)', text: '#00E5A0', border: 'rgba(0, 229, 160, 0.25)' },
  CLOSED: { bg: 'rgba(71, 85, 105, 0.2)', text: '#cbd5e1', border: 'rgba(71, 85, 105, 0.35)' },
  CANCELLED: { bg: 'rgba(239, 68, 68, 0.12)', text: '#ef4444', border: 'rgba(239, 68, 68, 0.25)' },
  REVISED: { bg: 'rgba(120, 113, 108, 0.12)', text: '#a8a29e', border: 'rgba(120, 113, 108, 0.25)' },
  SUPERSEDED: { bg: 'rgba(78, 70, 229, 0.12)', text: '#6366f1', border: 'rgba(78, 70, 229, 0.25)' },
};

// State Machine transitions
export const PO_STATUS_TRANSITIONS: Record<POStatus, POStatus[]> = {
  DRAFT: ['PENDING_APPROVAL', 'CANCELLED'],
  PENDING_APPROVAL: ['APPROVED', 'DRAFT', 'CANCELLED'], // Rejecting routes back to DRAFT or stays as DRAFT
  APPROVED: ['SENT', 'CANCELLED', 'REVISED'],
  SENT: ['ACKNOWLEDGED', 'PARTIALLY_DELIVERED', 'DELIVERED', 'CANCELLED', 'REVISED'],
  ACKNOWLEDGED: ['PARTIALLY_DELIVERED', 'DELIVERED', 'CANCELLED', 'REVISED'],
  PARTIALLY_DELIVERED: ['DELIVERED', 'CLOSED', 'CANCELLED'],
  DELIVERED: ['CLOSED'],
  CLOSED: [],
  CANCELLED: [],
  REVISED: ['SUPERSEDED'],
  SUPERSEDED: [],
};

// --- PO Type Labels ---
export const PO_TYPE_LABELS: Record<POType, string> = {
  PROJECT_MATERIAL: 'Project Material',
  SUBCONTRACT: 'Subcontract',
  SERVICES: 'Services',
  CONSUMABLES: 'Consumables',
  OVERHEAD: 'Overhead / Admin',
};

// --- Delivery Status Labels & Colors ---
export const PO_DELIVERY_STATUS_LABELS: Record<PODeliveryStatus, string> = {
  NOT_DELIVERED: 'Not Delivered',
  PARTIAL: 'Partially Received',
  COMPLETE: 'Fully Received',
};

export const PO_DELIVERY_STATUS_COLORS: Record<PODeliveryStatus, string> = {
  NOT_DELIVERED: '#ef4444',
  PARTIAL: '#f97316',
  COMPLETE: '#00E5A0',
};

// --- PO Item Receipt Status Labels & Colors ---
export const PO_ITEM_RECEIPT_STATUS_LABELS: Record<POItemReceiptStatus, string> = {
  PENDING: 'Pending Delivery',
  PARTIAL: 'Partially Received',
  COMPLETE: 'Fully Received',
  CLOSED_SHORT: 'Closed Short',
};

export const PO_ITEM_RECEIPT_STATUS_COLORS: Record<POItemReceiptStatus, string> = {
  PENDING: '#64748b',
  PARTIAL: '#f97316',
  COMPLETE: '#00E5A0',
  CLOSED_SHORT: '#94a3b8',
};

// --- GRN Status Labels & Colors ---
export const GRN_STATUS_LABELS: Record<GRNStatus, string> = {
  DRAFT: 'Draft Receipt',
  RECEIVED: 'Received & Logged',
  CANCELLED: 'Cancelled Receipt',
};

export const GRN_STATUS_COLORS: Record<GRNStatus, { bg: string; text: string; border: string }> = {
  DRAFT: { bg: 'rgba(245, 158, 11, 0.12)', text: '#f59e0b', border: 'rgba(245, 158, 11, 0.25)' },
  RECEIVED: { bg: 'rgba(0, 229, 160, 0.12)', text: '#00E5A0', border: 'rgba(0, 229, 160, 0.25)' },
  CANCELLED: { bg: 'rgba(239, 68, 68, 0.12)', text: '#ef4444', border: 'rgba(239, 68, 68, 0.25)' },
};

// --- GRN Location Labels ---
export const GRN_LOCATION_LABELS: Record<GRNLocation, string> = {
  SITE: 'On-Site Delivery',
  STORE: 'Central Store / Warehouse',
};

// --- GRN Rejection Reasons ---
export const GRN_REJECTION_REASONS: Record<GRNRejectionReason, string> = {
  DAMAGED: 'Damaged / Broken Items',
  WRONG_ITEM: 'Wrong Item Model / Specs',
  WRONG_BRAND: 'Alternative Brand Delivered (Unapproved)',
  SHORT_EXPIRY: 'Short Expiry Date',
  SPEC_MISMATCH: 'Specifications Mismatch',
  OTHER: 'Other (See notes)',
};

// --- GRN Return Statuses & Colors ---
export const GRN_RETURN_STATUS_LABELS: Record<GRNReturnStatus, string> = {
  PENDING_COLLECTION: 'Pending Supplier Collection',
  COLLECTED: 'Collected by Supplier',
  REPLACED: 'Items Replaced',
  CREDITED: 'Credit Note Issued',
};

export const GRN_RETURN_STATUS_COLORS: Record<GRNReturnStatus, { bg: string; text: string }> = {
  PENDING_COLLECTION: { bg: 'rgba(249, 115, 22, 0.12)', text: '#f97316' },
  COLLECTED: { bg: 'rgba(14, 165, 233, 0.12)', text: '#0ea5e9' },
  REPLACED: { bg: 'rgba(0, 229, 160, 0.12)', text: '#00E5A0' },
  CREDITED: { bg: 'rgba(168, 85, 247, 0.12)', text: '#a855f7' },
};

// --- Lists Array Options ---
export const ALL_PO_STATUSES: POStatus[] = [
  'DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'SENT', 'ACKNOWLEDGED', 
  'PARTIALLY_DELIVERED', 'DELIVERED', 'CLOSED', 'CANCELLED', 'REVISED', 'SUPERSEDED'
];

export const ALL_PO_TYPES: POType[] = [
  'PROJECT_MATERIAL', 'SUBCONTRACT', 'SERVICES', 'CONSUMABLES', 'OVERHEAD'
];

export const ALL_GRN_STATUSES: GRNStatus[] = ['DRAFT', 'RECEIVED', 'CANCELLED'];
export const ALL_GRN_LOCATIONS: GRNLocation[] = ['SITE', 'STORE'];
export const ALL_GRN_REJECTION_REASONS: GRNRejectionReason[] = [
  'DAMAGED', 'WRONG_ITEM', 'WRONG_BRAND', 'SHORT_EXPIRY', 'SPEC_MISMATCH', 'OTHER'
];
export const ALL_GRN_RETURN_STATUSES: GRNReturnStatus[] = [
  'PENDING_COLLECTION', 'COLLECTED', 'REPLACED', 'CREDITED'
];
