// ============================================================
// JEET ERP — Project Master Constants
// ============================================================

import type { ProjectStatus, ProjectType, Emirate, ProjectSystem, ContactRole, MilestoneStatus } from '@/types/project.types';

// --- Status Labels & Colors ---
export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  SUBMITTED: 'Submitted (Pre-Award)',
  MOBILIZATION: 'Mobilization',
  IN_PROGRESS: 'In Progress',
  TESTING: 'Testing & Commissioning',
  HANDOVER: 'Handover',
  DLP: 'Defects Liability Period',
  CLOSED: 'Closed',
  ON_HOLD: 'On Hold',
  CANCELLED: 'Cancelled',
  LOST: 'Lost Opportunity',
};

export const PROJECT_STATUS_COLORS: Record<ProjectStatus, { bg: string; text: string; border: string }> = {
  SUBMITTED: { bg: 'rgba(192, 132, 252, 0.12)', text: '#c084fc', border: 'rgba(192, 132, 252, 0.25)' },
  MOBILIZATION: { bg: 'rgba(14, 165, 233, 0.12)', text: '#0ea5e9', border: 'rgba(14, 165, 233, 0.25)' },
  IN_PROGRESS: { bg: 'rgba(0, 229, 160, 0.12)', text: '#00E5A0', border: 'rgba(0, 229, 160, 0.25)' },
  TESTING: { bg: 'rgba(168, 85, 247, 0.12)', text: '#a855f7', border: 'rgba(168, 85, 247, 0.25)' },
  HANDOVER: { bg: 'rgba(34, 211, 238, 0.12)', text: '#22d3ee', border: 'rgba(34, 211, 238, 0.25)' },
  DLP: { bg: 'rgba(245, 158, 11, 0.12)', text: '#f59e0b', border: 'rgba(245, 158, 11, 0.25)' },
  CLOSED: { bg: 'rgba(100, 116, 139, 0.12)', text: '#94a3b8', border: 'rgba(100, 116, 139, 0.25)' },
  ON_HOLD: { bg: 'rgba(249, 115, 22, 0.12)', text: '#f97316', border: 'rgba(249, 115, 22, 0.25)' },
  CANCELLED: { bg: 'rgba(239, 68, 68, 0.12)', text: '#ef4444', border: 'rgba(239, 68, 68, 0.25)' },
  LOST: { bg: 'rgba(148, 163, 184, 0.15)', text: '#94a3b8', border: 'rgba(148, 163, 184, 0.3)' },
};

// --- Forward-only transitions (except ON_HOLD ↔ previous) ---
export const PROJECT_STATUS_TRANSITIONS: Record<ProjectStatus, ProjectStatus[]> = {
  SUBMITTED: ['MOBILIZATION', 'LOST', 'CANCELLED'],
  MOBILIZATION: ['IN_PROGRESS', 'ON_HOLD', 'CANCELLED'],
  IN_PROGRESS: ['TESTING', 'ON_HOLD', 'CANCELLED'],
  TESTING: ['HANDOVER', 'ON_HOLD', 'CANCELLED'],
  HANDOVER: ['DLP', 'ON_HOLD', 'CANCELLED'],
  DLP: ['CLOSED', 'ON_HOLD'],
  CLOSED: [], // Terminal
  ON_HOLD: [], // Dynamic: returns to previous_status
  CANCELLED: [], // Terminal
  LOST: [], // Terminal
};

// Status icons (lucide-react icon names)
export const PROJECT_STATUS_ICONS: Record<ProjectStatus, string> = {
  SUBMITTED: 'FileText',
  MOBILIZATION: 'Truck',
  IN_PROGRESS: 'Hammer',
  TESTING: 'FlaskConical',
  HANDOVER: 'HandshakeIcon',
  DLP: 'ShieldCheck',
  CLOSED: 'CheckCircle2',
  ON_HOLD: 'PauseCircle',
  CANCELLED: 'XCircle',
  LOST: 'XOctagon',
};

// --- Project Type Labels ---
export const PROJECT_TYPE_LABELS: Record<ProjectType, string> = {
  SUPPLY_INSTALL: 'Supply & Install',
  SUPPLY_ONLY: 'Supply Only',
  INSTALL_ONLY: 'Installation Only',
  AMC: 'AMC (Annual Maintenance)',
  FITOUT: 'Fitout',
  CONSULTANCY: 'Consultancy',
};

// --- Emirate Labels ---
export const EMIRATE_LABELS: Record<Emirate, string> = {
  DUBAI: 'Dubai',
  ABU_DHABI: 'Abu Dhabi',
  SHARJAH: 'Sharjah',
  AJMAN: 'Ajman',
  RAK: 'Ras Al Khaimah',
  FUJAIRAH: 'Fujairah',
  UAQ: 'Umm Al Quwain',
};

// --- System Labels ---
export const SYSTEM_LABELS: Record<ProjectSystem, string> = {
  CCTV: 'CCTV & Surveillance',
  ACCESS_CONTROL: 'Access Control',
  FIRE_ALARM: 'Fire Alarm',
  BMS: 'BMS (Building Management)',
  STRUCTURED_CABLING: 'Structured Cabling',
  PA_AV_BGM: 'PA / AV / BGM',
  GATE_BARRIER: 'Gate Barrier',
  KNX_SMART_HOME: 'KNX / Smart Home',
  ELECTRICAL: 'Electrical',
  OTHER: 'Other',
};

export const SYSTEM_COLORS: Record<ProjectSystem, string> = {
  CCTV: '#0ea5e9',
  ACCESS_CONTROL: '#00E5A0',
  FIRE_ALARM: '#ef4444',
  BMS: '#a855f7',
  STRUCTURED_CABLING: '#22d3ee',
  PA_AV_BGM: '#f59e0b',
  GATE_BARRIER: '#64748b',
  KNX_SMART_HOME: '#ec4899',
  ELECTRICAL: '#f97316',
  OTHER: '#94a3b8',
};

// --- Contact Role Labels ---
export const CONTACT_ROLE_LABELS: Record<ContactRole, string> = {
  CLIENT_REP: 'Client Representative',
  CONSULTANT: 'Consultant',
  MAIN_CONTRACTOR: 'Main Contractor',
  FM: 'Facility Manager',
  SECURITY_MANAGER: 'Security Manager',
  OTHER: 'Other',
};

// --- Milestone Status Labels ---
export const MILESTONE_STATUS_LABELS: Record<MilestoneStatus, string> = {
  PENDING: 'Pending',
  DONE: 'Completed',
  DELAYED: 'Delayed',
};

export const MILESTONE_STATUS_COLORS: Record<MilestoneStatus, string> = {
  PENDING: '#94a3b8',
  DONE: '#10b981',
  DELAYED: '#ef4444',
};

// --- Default Milestone Templates (for wizard) ---
export const DEFAULT_MILESTONES = [
  { title: 'Mobilization', description: 'Site access and kickoff', payment_linked: false, payment_pct: 0 },
  { title: 'Material Delivery', description: 'Equipment and material delivery to site', payment_linked: true, payment_pct: 30 },
  { title: 'Installation Complete', description: 'Physical installation of all systems', payment_linked: true, payment_pct: 30 },
  { title: 'Testing & Commissioning', description: 'System testing and commissioning', payment_linked: true, payment_pct: 20 },
  { title: 'Handover', description: 'Final handover to client', payment_linked: true, payment_pct: 10 },
];

// --- All Status Options Array ---
export const ALL_PROJECT_STATUSES: ProjectStatus[] = [
  'SUBMITTED', 'MOBILIZATION', 'IN_PROGRESS', 'TESTING', 'HANDOVER', 'DLP', 'CLOSED', 'ON_HOLD', 'CANCELLED', 'LOST'
];

export const ALL_EMIRATES: Emirate[] = [
  'DUBAI', 'ABU_DHABI', 'SHARJAH', 'AJMAN', 'RAK', 'FUJAIRAH', 'UAQ'
];

export const ALL_PROJECT_TYPES: ProjectType[] = [
  'SUPPLY_INSTALL', 'SUPPLY_ONLY', 'INSTALL_ONLY', 'AMC', 'FITOUT', 'CONSULTANCY'
];

export const ALL_SYSTEMS: ProjectSystem[] = [
  'CCTV', 'ACCESS_CONTROL', 'FIRE_ALARM', 'BMS', 'STRUCTURED_CABLING',
  'PA_AV_BGM', 'GATE_BARRIER', 'KNX_SMART_HOME', 'ELECTRICAL', 'OTHER'
];

export const ALL_CONTACT_ROLES: ContactRole[] = [
  'CLIENT_REP', 'CONSULTANT', 'MAIN_CONTRACTOR', 'FM', 'SECURITY_MANAGER', 'OTHER'
];
