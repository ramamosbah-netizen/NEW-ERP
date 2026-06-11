// ============================================================
// JEET ERP — AMC, PPM & Service Call-Outs Constants
// ============================================================

import type { AMCContractStatus, AMCContractType, SLATier, BillingFrequency, AMCEquipmentCondition } from '@/types/amc.types';
import type { PPMVisitStatus } from '@/types/ppm.types';
import type { ServiceTicketStatus, TicketIntakeChannel, TicketPriority, TicketCoverage } from '@/types/ticket.types';

// --- AMC Status Labels & Colors ---
export const AMC_STATUS_LABELS: Record<AMCContractStatus, string> = {
  DRAFT: 'Draft',
  PENDING_APPROVAL: 'Pending Approval',
  ACTIVE: 'Active',
  EXPIRING: 'Expiring Soon',
  EXPIRED: 'Expired',
  RENEWED: 'Renewed',
  TERMINATED: 'Terminated',
  SUSPENDED: 'Suspended'
};

export const AMC_STATUS_COLORS: Record<AMCContractStatus, { bg: string; text: string; border: string }> = {
  DRAFT: { bg: 'rgba(148, 163, 184, 0.12)', text: '#94a3b8', border: 'rgba(148, 163, 184, 0.25)' },
  PENDING_APPROVAL: { bg: 'rgba(234, 179, 8, 0.12)', text: '#eab308', border: 'rgba(234, 179, 8, 0.25)' },
  ACTIVE: { bg: 'rgba(0, 229, 160, 0.12)', text: '#00E5A0', border: 'rgba(0, 229, 160, 0.25)' },
  EXPIRING: { bg: 'rgba(249, 115, 22, 0.12)', text: '#f97316', border: 'rgba(249, 115, 22, 0.25)' },
  EXPIRED: { bg: 'rgba(239, 68, 68, 0.12)', text: '#ef4444', border: 'rgba(239, 68, 68, 0.25)' },
  RENEWED: { bg: 'rgba(168, 85, 247, 0.12)', text: '#a855f7', border: 'rgba(168, 85, 247, 0.25)' },
  TERMINATED: { bg: 'rgba(220, 38, 38, 0.12)', text: '#dc2626', border: 'rgba(220, 38, 38, 0.25)' },
  SUSPENDED: { bg: 'rgba(156, 163, 175, 0.12)', text: '#9ca3af', border: 'rgba(156, 163, 175, 0.25)' }
};

// --- AMC Contract Type Labels ---
export const AMC_TYPE_LABELS: Record<AMCContractType, string> = {
  COMPREHENSIVE: 'Comprehensive (Includes Parts)',
  NON_COMPREHENSIVE: 'Non-Comprehensive (Labour Only + Consumables)',
  LABOUR_ONLY: 'Labour Only'
};

// --- SLA Tiers ---
export const SLA_TIER_LABELS: Record<SLATier, string> = {
  STANDARD: 'Standard SLA',
  PRIORITY: 'Priority SLA',
  CRITICAL: 'Critical SLA'
};

// SLA details config (hours)
export const SLA_TIER_CONFIGS: Record<SLATier, { response_hours: number; resolution_hours: number }> = {
  STANDARD: { response_hours: 24, resolution_hours: 48 },
  PRIORITY: { response_hours: 4, resolution_hours: 12 },
  CRITICAL: { response_hours: 2, resolution_hours: 4 }
};

export const EMERGENCY_SLA_CONFIG = {
  response_hours: 1,
  resolution_hours: 2
};

// --- Billing Frequency ---
export const BILLING_FREQUENCY_LABELS: Record<BillingFrequency, string> = {
  ANNUAL_ADVANCE: 'Annual Advance',
  SEMI_ANNUAL: 'Semi-Annual (2 Installments)',
  QUARTERLY: 'Quarterly (4 Installments)',
  MONTHLY: 'Monthly (12 Installments)'
};

// --- Equipment Condition ---
export const EQUIPMENT_CONDITION_LABELS: Record<AMCEquipmentCondition, string> = {
  GOOD: 'Good (Operational)',
  FAIR: 'Fair (Needs Monitoring)',
  POOR: 'Poor (Recommend Replace)',
  FAULTY: 'Faulty (Requires Service)'
};

// --- PPM Visit Status ---
export const PPM_VISIT_STATUS_LABELS: Record<PPMVisitStatus, string> = {
  UNSCHEDULED: 'Unscheduled',
  SCHEDULED: 'Scheduled',
  IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed',
  MISSED: 'Missed (Overdue)',
  CANCELLED: 'Cancelled'
};

export const PPM_VISIT_STATUS_COLORS: Record<PPMVisitStatus, { bg: string; text: string; border: string }> = {
  UNSCHEDULED: { bg: 'rgba(148, 163, 184, 0.12)', text: '#94a3b8', border: 'rgba(148, 163, 184, 0.25)' },
  SCHEDULED: { bg: 'rgba(14, 165, 233, 0.12)', text: '#0ea5e9', border: 'rgba(14, 165, 233, 0.25)' },
  IN_PROGRESS: { bg: 'rgba(234, 179, 8, 0.12)', text: '#eab308', border: 'rgba(234, 179, 8, 0.25)' },
  COMPLETED: { bg: 'rgba(0, 229, 160, 0.12)', text: '#00E5A0', border: 'rgba(0, 229, 160, 0.25)' },
  MISSED: { bg: 'rgba(239, 68, 68, 0.12)', text: '#ef4444', border: 'rgba(239, 68, 68, 0.25)' },
  CANCELLED: { bg: 'rgba(100, 116, 139, 0.12)', text: '#64748b', border: 'rgba(100, 116, 139, 0.25)' }
};

// --- Service Ticket Status ---
export const TICKET_STATUS_LABELS: Record<ServiceTicketStatus, string> = {
  NEW: 'New',
  ASSIGNED: 'Assigned',
  IN_PROGRESS: 'In Progress',
  ON_HOLD_PARTS: 'On Hold (Waiting Parts)',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
  CANCELLED: 'Cancelled',
  DUPLICATE: 'Duplicate'
};

export const TICKET_STATUS_COLORS: Record<ServiceTicketStatus, { bg: string; text: string; border: string }> = {
  NEW: { bg: 'rgba(14, 165, 233, 0.12)', text: '#0ea5e9', border: 'rgba(14, 165, 233, 0.25)' },
  ASSIGNED: { bg: 'rgba(168, 85, 247, 0.12)', text: '#a855f7', border: 'rgba(168, 85, 247, 0.25)' },
  IN_PROGRESS: { bg: 'rgba(234, 179, 8, 0.12)', text: '#eab308', border: 'rgba(234, 179, 8, 0.25)' },
  ON_HOLD_PARTS: { bg: 'rgba(249, 115, 22, 0.12)', text: '#f97316', border: 'rgba(249, 115, 22, 0.25)' },
  RESOLVED: { bg: 'rgba(34, 211, 238, 0.12)', text: '#22d3ee', border: 'rgba(34, 211, 238, 0.25)' },
  CLOSED: { bg: 'rgba(0, 229, 160, 0.12)', text: '#00E5A0', border: 'rgba(0, 229, 160, 0.25)' },
  CANCELLED: { bg: 'rgba(239, 68, 68, 0.12)', text: '#ef4444', border: 'rgba(239, 68, 68, 0.25)' },
  DUPLICATE: { bg: 'rgba(100, 116, 139, 0.12)', text: '#64748b', border: 'rgba(100, 116, 139, 0.25)' }
};

// --- Ticket Priority ---
export const TICKET_PRIORITY_LABELS: Record<TicketPriority, string> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  EMERGENCY: 'Emergency (24/7 Bypass)'
};

export const TICKET_PRIORITY_COLORS: Record<TicketPriority, { bg: string; text: string; border: string }> = {
  LOW: { bg: 'rgba(148, 163, 184, 0.12)', text: '#94a3b8', border: 'rgba(148, 163, 184, 0.25)' },
  MEDIUM: { bg: 'rgba(14, 165, 233, 0.12)', text: '#0ea5e9', border: 'rgba(14, 165, 233, 0.25)' },
  HIGH: { bg: 'rgba(249, 115, 22, 0.12)', text: '#f97316', border: 'rgba(249, 115, 22, 0.25)' },
  EMERGENCY: { bg: 'rgba(239, 68, 68, 0.12)', text: '#ef4444', border: 'rgba(239, 68, 68, 0.25)' }
};

// --- Ticket Coverage ---
export const TICKET_COVERAGE_LABELS: Record<TicketCoverage, string> = {
  COVERED: 'Covered under AMC',
  CHARGEABLE: 'Chargeable (Out of Scope)',
  WARRANTY: 'Warranty (Project DLP)'
};

// --- Intake Channels ---
export const TICKET_INTAKE_LABELS: Record<TicketIntakeChannel, string> = {
  MANUAL: 'Service Coordinator Portal',
  PHONE: 'Phone Support Desk',
  EMAIL: 'Email Auto-Intake',
  WHATSAPP: 'WhatsApp Business API'
};

// --- WhatsApp Message Templates ---
// Format compliant with Meta business message standards
export const WHATSAPP_TEMPLATES = {
  ticket_created: {
    template_name: 'srv_ticket_created_bilingual',
    english: 'Dear {{client_name}},\n\nYour service request regarding "{{title}}" has been logged successfully.\nTicket: {{ticket_number}}\nPriority: {{priority}}\nSLA Due: {{sla_due}}\n\nOur service desk is processing this now. Thank you.',
    arabic: 'عزيزنا {{client_name}}،\n\nتم تسجيل طلب الخدمة الخاص بكم بنجاح بشأن "{{title}}".\nرقم التذكرة: {{ticket_number}}\nالأولوية: {{priority}}\nتاريخ الاستحقاق: {{sla_due}}\n\nمكتب الخدمة لدينا يعمل على معالجة طلبكم الآن. شكراً لكم.'
  },
  ticket_assigned: {
    template_name: 'srv_ticket_assigned_bilingual',
    english: 'Dear {{client_name}},\n\nTechnician {{tech_name}} has been assigned to resolve your ticket {{ticket_number}}.\nEstimated dispatch time details will follow shortly.',
    arabic: 'عزيزنا {{client_name}}،\n\nتم تعيين الفني {{tech_name}} لحل التذكرة الخاصة بكم رقم {{ticket_number}}.\nستصلكم تفاصيل موعد الإرسال المتوقع قريباً.'
  },
  ticket_dispatched: {
    template_name: 'srv_technician_dispatched_bilingual',
    english: 'Dear {{client_name}},\n\nTechnician {{tech_name}} (Phone: {{tech_phone}}) has been dispatched to your site.\nSite: {{site_address}}\nTicket: {{ticket_number}}',
    arabic: 'عزيزنا {{client_name}}،\n\nتم إرسال الفني {{tech_name}} (هاتف: {{tech_phone}}) إلى موقعكم.\nالموقع: {{site_address}}\nالتذكرة: {{ticket_number}}'
  },
  ticket_resolved: {
    template_name: 'srv_ticket_resolved_bilingual',
    english: 'Dear {{client_name}},\n\nTicket {{ticket_number}} has been marked as RESOLVED by technician.\nSummary: {{resolution_summary}}\n\nPlease review and confirm closure. Thank you.',
    arabic: 'عزيزنا {{client_name}}،\n\nتم تحديث حالة التذكرة رقم {{ticket_number}} كـ "تم الحل" من قبل الفني.\nملخص الحل: {{resolution_summary}}\n\nيرجى المراجعة وتأكيد الإغلاق. شكراً لكم.'
  },
  ppm_visit_scheduled: {
    template_name: 'ppm_visit_scheduled_bilingual',
    english: 'Dear {{client_name}},\n\nYour PPM visit is scheduled on {{scheduled_date}} (Slot: {{slot}}).\nTechnician: {{tech_name}}\nContract: {{contract_number}}\n\nPlease ensure site access.',
    arabic: 'عزيزنا {{client_name}}،\n\nتمت جدولة زيارة الصيانة الوقائية الخاصة بكم بتاريخ {{scheduled_date}} (الفترة: {{slot}}).\nالفني: {{tech_name}}\nرقم العقد: {{contract_number}}\n\nيرجى التكرم بتسهيل الدخول للموقع.'
  }
};
