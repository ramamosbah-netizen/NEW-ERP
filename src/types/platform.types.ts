// ============================================================
// JEET ERP — Admin Platform Engine Types
// Workflow, business rules, numbering, forms, templates,
// notification rules.
// ============================================================

// ---------- Workflow ----------
export type StatusColor = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

export interface WorkflowDefinition {
  id: string;
  module_key: string;
  name: string;
  description: string | null;
  is_active: boolean;
  version: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkflowStatus {
  id: string;
  workflow_id: string;
  status_key: string;
  label: string;
  color: StatusColor;
  is_initial: boolean;
  is_terminal: boolean;
  sort_order: number;
}

export type ApprovalMode = 'NONE' | 'SINGLE' | 'SEQUENTIAL' | 'PARALLEL';
export type ApproverType = 'ROLE' | 'USER' | 'DEPARTMENT';

export interface Approver {
  type: ApproverType;
  value: string;
}

export interface ApprovalConfig {
  mode: ApprovalMode;
  approvers: Approver[];
  min_approvals: number;
}

export type NotificationChannel = 'IN_APP' | 'EMAIL' | 'SMS' | 'WHATSAPP';

export type RecipientType = 'ROLE' | 'USER' | 'DEPARTMENT' | 'CREATOR' | 'ASSIGNEE';

export interface NotificationRecipient {
  type: RecipientType;
  value?: string;
}

export interface TransitionNotification {
  event: string;
  channels: NotificationChannel[];
  recipients: NotificationRecipient[];
  template?: string;
}

export type ConditionOperator =
  | '=' | '!=' | '>' | '>=' | '<' | '<='
  | 'contains' | 'not_contains' | 'in' | 'not_in'
  | 'is_empty' | 'not_empty';

export interface RuleCondition {
  field: string;
  operator: ConditionOperator;
  value?: unknown;
  join?: 'AND' | 'OR';
}

export interface EscalationConfig {
  after_hours: number;
  to: NotificationRecipient;
  channels: NotificationChannel[];
}

export interface WorkflowTransition {
  id: string;
  workflow_id: string;
  from_status_id: string;
  to_status_id: string;
  action_key: string;
  label: string;
  allowed_roles: string[];
  approval: ApprovalConfig;
  notifications: TransitionNotification[];
  conditions: RuleCondition[];
  sla_hours: number | null;
  escalation: EscalationConfig | null;
  sort_order: number;
}

export interface WorkflowHistoryEntry {
  at: string;
  by: string | null;
  by_name: string;
  action: string;
  from: string;
  to: string;
  comment?: string;
}

export interface PendingApproval extends Approver {
  approved_by: string | null;
  approved_at?: string | null;
}

export interface WorkflowInstance {
  id: string;
  workflow_id: string;
  entity_type: string;
  entity_id: string;
  current_status_key: string;
  history: WorkflowHistoryEntry[];
  pending_approvals: PendingApproval[];
  sla_due_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkflowWithGraph extends WorkflowDefinition {
  statuses: WorkflowStatus[];
  transitions: WorkflowTransition[];
}

// ---------- Business rules ----------
export type RuleTriggerEvent =
  | 'ON_CREATE' | 'ON_SUBMIT' | 'ON_APPROVE' | 'ON_REJECT' | 'ON_CLOSE' | 'ON_UPDATE';

export type RuleActionType =
  | 'REQUIRE_APPROVAL' | 'NOTIFY' | 'ESCALATE' | 'BLOCK' | 'SET_FIELD';

export interface RuleAction {
  type: RuleActionType;
  params: Record<string, unknown>;
}

export interface BusinessRule {
  id: string;
  module_key: string;
  name: string;
  description: string | null;
  trigger_event: RuleTriggerEvent;
  conditions: RuleCondition[];
  actions: RuleAction[];
  priority: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ---------- Numbering ----------
export type ResetPeriod = 'NEVER' | 'YEARLY' | 'MONTHLY';

export interface NumberingRule {
  id: string;
  module_key: string;
  prefix: string;
  separator: string;
  include_year: boolean;
  include_month: boolean;
  padding: number;
  next_sequence: number;
  reset_period: ResetPeriod;
  period_marker: string | null;
  is_active: boolean;
  updated_at: string;
}

// ---------- Forms ----------
export type FormFieldType =
  | 'text' | 'number' | 'currency' | 'date' | 'time'
  | 'dropdown' | 'multiselect' | 'checkbox' | 'radio'
  | 'file' | 'signature' | 'image' | 'table' | 'richtext' | 'textarea';

export interface FormFieldOption {
  value: string;
  label: string;
}

export interface FormFieldValidation {
  min?: number;
  max?: number;
  pattern?: string;
  message?: string;
}

export interface FormFieldConditional {
  field: string;
  operator: ConditionOperator;
  value?: unknown;
}

export interface FormFieldDef {
  id: string;
  key: string;
  label: string;
  type: FormFieldType;
  required?: boolean;
  hidden?: boolean;
  readonly?: boolean;
  placeholder?: string;
  default_value?: unknown;
  options?: FormFieldOption[];
  validation?: FormFieldValidation;
  conditional?: FormFieldConditional;
}

export interface FormSection {
  id: string;
  label: string;
  columns: number;
  fields: FormFieldDef[];
}

export interface FormTab {
  id: string;
  label: string;
  sections: FormSection[];
}

export interface FormSchema {
  tabs: FormTab[];
}

export interface FormDefinition {
  id: string;
  module_key: string;
  name: string;
  description: string | null;
  schema: FormSchema;
  version: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ---------- Document templates ----------
export interface TemplateHeader {
  show_logo: boolean;
  title: string;
  subtitle: string;
  show_qr: boolean;
}

export interface TemplateFooter {
  text: string;
  show_page_numbers: boolean;
}

export interface TemplateWatermark {
  enabled: boolean;
  text: string;
}

export interface TemplateSignatureBlock {
  label: string;
}

export interface TemplateContent {
  header: TemplateHeader;
  body_html: string;
  footer: TemplateFooter;
  watermark: TemplateWatermark;
  signature_blocks: TemplateSignatureBlock[];
  variables: string[];
}

export interface DocumentTemplate {
  id: string;
  template_key: string;
  name: string;
  module_key: string | null;
  description: string | null;
  content: TemplateContent;
  paper_size: string;
  orientation: 'portrait' | 'landscape';
  version: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ---------- Notification rules ----------
// Matches the EXISTING notification_rules table used by the
// notifications system (do not redefine it in migrations).
export interface NotificationRule {
  id: string;
  event_type: string;                  // e.g. 'quotation.submitted'
  recipient_strategy: 'ROLE' | 'USER' | 'CREATOR' | 'ASSIGNEE';
  recipient_value: string | null;
  channels: NotificationChannel[];
  severity: string;
  title_template: string | null;
  body_template: string | null;
  link_template: string | null;
  is_digest_eligible: boolean;
  escalation_hours: number | null;
  escalation_to_role: string | null;
  is_active: boolean;
}

// ---------- Module catalog (for pickers) ----------
export interface ModuleCatalogEntry {
  key: string;
  label: string;
  group: string;
}

export const MODULE_CATALOG: ModuleCatalogEntry[] = [
  // Procurement
  { key: 'MAR', label: 'Material Approval Request', group: 'Procurement' },
  { key: 'MIR', label: 'Material Inspection Request', group: 'Procurement' },
  { key: 'PR', label: 'Purchase Request', group: 'Procurement' },
  { key: 'RFQ', label: 'Request for Quotation', group: 'Procurement' },
  { key: 'COMPARISON', label: 'Vendor Comparison', group: 'Procurement' },
  { key: 'PO', label: 'Purchase Order (LPO)', group: 'Procurement' },
  { key: 'GRN', label: 'Goods Receipt Note', group: 'Procurement' },
  { key: 'SUPPLIER_EVAL', label: 'Supplier Evaluation', group: 'Procurement' },
  // Finance
  { key: 'QTN', label: 'Quotation', group: 'Finance' },
  { key: 'INV', label: 'Invoice', group: 'Finance' },
  { key: 'PROFORMA', label: 'Proforma Invoice', group: 'Finance' },
  { key: 'PAYMENT_REQ', label: 'Payment Request', group: 'Finance' },
  { key: 'EXP', label: 'Expense Claim', group: 'Finance' },
  { key: 'PETTY_CASH', label: 'Petty Cash', group: 'Finance' },
  { key: 'BUDGET', label: 'Budget Approval', group: 'Finance' },
  // Projects
  { key: 'PRJ', label: 'Project', group: 'Projects' },
  { key: 'VO', label: 'Variation Order', group: 'Projects' },
  { key: 'SITE_INSPECTION', label: 'Site Inspection', group: 'Projects' },
  { key: 'SNAG', label: 'Snag List', group: 'Projects' },
  { key: 'HANDOVER', label: 'Project Handover', group: 'Projects' },
  // Tenders
  { key: 'TND', label: 'Tender', group: 'Tenders' },
  { key: 'BID', label: 'Bid Submission', group: 'Tenders' },
  // Assets
  { key: 'ASSET', label: 'Asset Registration', group: 'Assets' },
  { key: 'ASSET_TRANSFER', label: 'Asset Transfer', group: 'Assets' },
  { key: 'ASSET_DISPOSAL', label: 'Asset Disposal', group: 'Assets' },
  // Maintenance
  { key: 'PPM', label: 'Preventive Maintenance', group: 'Maintenance' },
  { key: 'WO', label: 'Maintenance Work Order', group: 'Maintenance' },
  { key: 'SERVICE_REQ', label: 'Service Request', group: 'Maintenance' },
  // HR
  { key: 'LEAVE', label: 'Leave Request', group: 'HR' },
  { key: 'OVERTIME', label: 'Overtime Request', group: 'HR' },
  { key: 'TRAINING', label: 'Training Request', group: 'HR' },
  { key: 'ONBOARDING', label: 'Employee Onboarding', group: 'HR' },
  { key: 'RESIGNATION', label: 'Resignation', group: 'HR' },
  // Meetings
  { key: 'MEETING', label: 'Meeting', group: 'Meetings' },
  { key: 'MOM', label: 'Meeting Minutes', group: 'Meetings' },
  // Quality & HSE
  { key: 'NCR', label: 'Non-Conformance Report', group: 'Quality & HSE' },
  { key: 'AUDIT_REPORT', label: 'Audit Report', group: 'Quality & HSE' },
  { key: 'INCIDENT', label: 'Incident Report', group: 'Quality & HSE' },
  { key: 'PTW', label: 'Permit To Work', group: 'Quality & HSE' },
  { key: 'RISK_ASSESSMENT', label: 'Risk Assessment', group: 'Quality & HSE' },
  // Documents
  { key: 'DOC', label: 'Document Control', group: 'Documents' },
  // CRM
  { key: 'LEAD', label: 'Lead', group: 'CRM' },
  { key: 'OPPORTUNITY', label: 'Opportunity', group: 'CRM' },
];
