// ============================================================
// JEET ERP — Document Management System Constants
// ============================================================

import type { DocumentStatus, DocumentEntityType, DocumentAction } from '@/types/document.types';

// --- Status Labels & Colors ---
export const DOCUMENT_STATUS_LABELS: Record<DocumentStatus, string> = {
  PROCESSING: 'Processing',
  AUTO_FILED: 'Auto-Filed',
  NEEDS_REVIEW: 'Needs Review',
  VERIFIED: 'Verified',
  REJECTED: 'Rejected',
};

export const DOCUMENT_STATUS_COLORS: Record<DocumentStatus, { bg: string; text: string; border: string }> = {
  PROCESSING: { bg: 'rgba(14, 165, 233, 0.12)', text: '#0ea5e9', border: 'rgba(14, 165, 233, 0.25)' },
  AUTO_FILED: { bg: 'rgba(16, 185, 129, 0.12)', text: '#10b981', border: 'rgba(16, 185, 129, 0.25)' },
  NEEDS_REVIEW: { bg: 'rgba(245, 158, 11, 0.12)', text: '#f59e0b', border: 'rgba(245, 158, 11, 0.25)' },
  VERIFIED: { bg: 'rgba(16, 185, 129, 0.12)', text: '#10b981', border: 'rgba(16, 185, 129, 0.25)' },
  REJECTED: { bg: 'rgba(239, 68, 68, 0.12)', text: '#ef4444', border: 'rgba(239, 68, 68, 0.25)' },
};

// --- Entity Type Labels ---
export const ENTITY_TYPE_LABELS: Record<DocumentEntityType, string> = {
  PROJECT: 'Project',
  CLIENT: 'Client',
  SUPPLIER: 'Supplier',
  COMPANY: 'Company',
  AMC: 'AMC Contract',
};

// --- Category Colors (for visual grouping) ---
export const CATEGORY_COLORS: Record<string, string> = {
  COMMERCIAL: '#0ea5e9',
  CONTRACTUAL: '#6366f1',
  TECHNICAL: '#3b82f6',
  COMPLIANCE: '#ef4444',
  CORRESPONDENCE: '#f59e0b',
  SITE: '#0ea5e9',
  OTHER: '#64748b',
};

export const CATEGORY_LABELS: Record<string, string> = {
  COMMERCIAL: 'Commercial',
  CONTRACTUAL: 'Contractual',
  TECHNICAL: 'Technical',
  COMPLIANCE: 'Compliance',
  CORRESPONDENCE: 'Correspondence',
  SITE: 'Site',
  OTHER: 'Other',
};

// --- Subcategory Labels ---
export const SUBCATEGORY_LABELS: Record<string, string> = {
  QUOTATION: 'Quotation',
  CLIENT_LPO: 'Client LPO',
  SUPPLIER_QUOTE: 'Supplier Quote',
  SUPPLIER_INVOICE: 'Supplier Invoice',
  CLIENT_INVOICE: 'Client Invoice',
  PAYMENT_CERTIFICATE: 'Payment Certificate',
  VARIATION_ORDER: 'Variation Order',
  PAYMENT_RECEIPT: 'Payment Receipt',
  BANK_GUARANTEE: 'Bank Guarantee',
  CONTRACT: 'Contract',
  SUBCONTRACT: 'Subcontract',
  NDA: 'NDA',
  WARRANTY_CERTIFICATE: 'Warranty Certificate',
  HANDOVER_CERTIFICATE: 'Handover Certificate',
  INSURANCE_POLICY: 'Insurance Policy',
  SHOP_DRAWING: 'Shop Drawing',
  AS_BUILT: 'As-Built Drawing',
  SCHEMATIC: 'Schematic',
  DATASHEET: 'Datasheet',
  MATERIAL_SUBMITTAL: 'Material Submittal',
  METHOD_STATEMENT: 'Method Statement',
  RISK_ASSESSMENT: 'Risk Assessment',
  TC_REPORT: 'T&C Report',
  PROGRAMME: 'Programme',
  SIRA_CERTIFICATE: 'SIRA Certificate',
  SIRA_EGUARD: 'SIRA eGuard',
  DCD_NOC: 'DCD NOC',
  DM_APPROVAL: 'Dubai Municipality Approval',
  DEWA_NOC: 'DEWA NOC',
  TRADE_LICENSE: 'Trade License',
  ESTABLISHMENT_CARD: 'Establishment Card',
  THIRD_PARTY_CERT: 'Third Party Certificate',
  CLIENT_LETTER: 'Client Letter',
  CONSULTANT_LETTER: 'Consultant Letter',
  EMAIL: 'Email',
  RFI: 'Request for Information',
  MEETING_MINUTES: 'Meeting Minutes',
  SITE_INSTRUCTION: 'Site Instruction',
  SITE_PHOTO: 'Site Photo',
  DELIVERY_NOTE: 'Delivery Note',
  SITE_REPORT: 'Site Report',
  SNAG_LIST: 'Snag List',
  INSPECTION_REPORT: 'Inspection Report',
  UNCLASSIFIED: 'Unclassified',
};

// --- Action Labels ---
export const DOCUMENT_ACTION_LABELS: Record<DocumentAction, string> = {
  UPLOADED: 'Uploaded',
  CLASSIFIED: 'AI Classified',
  REVIEWED: 'Reviewed',
  REVISED: 'Revision Added',
  DOWNLOADED: 'Downloaded',
  LINKED: 'Linked to Record',
  DELETED: 'Deleted',
  RESTORED: 'Restored',
  METADATA_UPDATED: 'Metadata Updated',
};

// --- File Upload Constraints ---
export const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB
export const MAX_FILE_SIZE_LABEL = '50 MB';

export const ALLOWED_FILE_EXTENSIONS = [
  'pdf', 'jpg', 'jpeg', 'png', 'docx', 'xlsx', 'dwg', 'zip', 'eml', 'msg'
];

export const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg', 'image/png', 'image/jpg',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/octet-stream',
  'application/zip',
  'message/rfc822',
  'application/vnd.ms-outlook',
];

// --- Confidence Threshold ---
export const AI_CONFIDENCE_THRESHOLD = 85; // >= this = AUTO_FILED, < this = NEEDS_REVIEW

// --- Expiry Alert Windows ---
export const EXPIRY_WINDOWS = [
  { label: 'Expired', days: 0, color: '#ef4444' },
  { label: '7 Days', days: 7, color: '#f97316' },
  { label: '30 Days', days: 30, color: '#f59e0b' },
  { label: '60 Days', days: 60, color: '#0ea5e9' },
  { label: '90 Days', days: 90, color: '#94a3b8' },
];

// --- Signed URL Expiry ---
export const SIGNED_URL_EXPIRY_SECONDS = 3600; // 60 minutes

// --- File Extension → Icon mapping ---
export const FILE_EXT_ICONS: Record<string, string> = {
  pdf: 'FileText',
  jpg: 'Image',
  jpeg: 'Image',
  png: 'Image',
  docx: 'FileText',
  xlsx: 'Sheet',
  dwg: 'Ruler',
  zip: 'Archive',
  eml: 'Mail',
  msg: 'Mail',
};
