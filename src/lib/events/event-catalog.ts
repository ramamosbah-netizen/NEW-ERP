// ============================================================
// AURA 0.2 — Canonical event taxonomy (compile-time source of truth)
//
// The DB table `event_types` is the RUNTIME registry (severity, is_active)
// and enforces a FK from system_events.event_type. THIS file is the
// COMPILE-TIME catalog so emitters and intelligence engines never drift on
// event names. Keep in sync with supabase/migrations/20260622100000_events_upgrade.sql.
// ============================================================

export type EventSeverity = 'INFO' | 'ACTION_REQUIRED' | 'CRITICAL';

export type EventModule =
  | 'FINANCE' | 'PROCUREMENT' | 'PROJECTS' | 'TENDER' | 'PRICING' | 'SALES'
  | 'INVENTORY' | 'HR' | 'RISK' | 'INTELLIGENCE'
  | 'QUOTATION' | 'COMPARISON' | 'DMS' | 'TASKS' | 'MEETINGS' | 'ESCALATION';

export interface EventTypeDef {
  type: string;
  module: EventModule;
  description: string;
  severity: EventSeverity;
}

/** Core-module catalog added in Phase 1 (legacy quotation/comparison/etc. live in the DB seed). */
export const EVENT_CATALOG: EventTypeDef[] = [
  // FINANCE
  { type: 'invoice.created', module: 'FINANCE', description: 'AP/AR invoice created', severity: 'INFO' },
  { type: 'invoice.approved', module: 'FINANCE', description: 'Invoice approved for payment', severity: 'INFO' },
  { type: 'invoice.overdue', module: 'FINANCE', description: 'Invoice past due, unpaid', severity: 'ACTION_REQUIRED' },
  { type: 'payment.recorded', module: 'FINANCE', description: 'Payment posted against an invoice', severity: 'INFO' },
  { type: 'journal.posted', module: 'FINANCE', description: 'Journal entry posted to the GL', severity: 'INFO' },
  { type: 'budget.exceeded', module: 'FINANCE', description: 'Budget exceeded', severity: 'CRITICAL' },
  // PROCUREMENT
  { type: 'pr.created', module: 'PROCUREMENT', description: 'Purchase requisition raised', severity: 'INFO' },
  { type: 'pr.approved', module: 'PROCUREMENT', description: 'Purchase requisition approved', severity: 'INFO' },
  { type: 'rfq.issued', module: 'PROCUREMENT', description: 'RFQ issued to suppliers', severity: 'INFO' },
  { type: 'comparison.completed', module: 'PROCUREMENT', description: 'Supplier comparison finalised', severity: 'INFO' },
  { type: 'po.created', module: 'PROCUREMENT', description: 'Purchase order created', severity: 'INFO' },
  { type: 'po.approved', module: 'PROCUREMENT', description: 'Purchase order approved', severity: 'INFO' },
  { type: 'po.high_value', module: 'PROCUREMENT', description: 'High-value PO needs elevated authority', severity: 'ACTION_REQUIRED' },
  { type: 'grn.received', module: 'PROCUREMENT', description: 'Goods received against a PO', severity: 'INFO' },
  { type: 'three_way_match.exception', module: 'PROCUREMENT', description: 'PO/GRN/Invoice mismatch', severity: 'ACTION_REQUIRED' },
  // PROJECTS
  { type: 'project.progress_updated', module: 'PROJECTS', description: 'Project progress / EVM updated', severity: 'INFO' },
  { type: 'project.milestone_due', module: 'PROJECTS', description: 'Milestone due soon', severity: 'ACTION_REQUIRED' },
  { type: 'project.budget_overrun', module: 'PROJECTS', description: 'Project cost over budget (CPI < 1)', severity: 'CRITICAL' },
  { type: 'project.risk_raised', module: 'PROJECTS', description: 'Risk added to register', severity: 'ACTION_REQUIRED' },
  { type: 'project.completed', module: 'PROJECTS', description: 'Project completed / handover', severity: 'INFO' },
  // PRE-CONTRACT (deal chain)
  { type: 'tender.received', module: 'TENDER', description: 'New tender intake', severity: 'INFO' },
  { type: 'tender.bid_decided', module: 'TENDER', description: 'Bid / No-bid decision recorded', severity: 'INFO' },
  { type: 'estimation.submitted', module: 'TENDER', description: 'Estimation submitted for review', severity: 'ACTION_REQUIRED' },
  { type: 'pricing.run_completed', module: 'PRICING', description: 'Pricing run calculated', severity: 'INFO' },
  { type: 'pricing.low_margin', module: 'PRICING', description: 'Pricing below margin guardrail', severity: 'ACTION_REQUIRED' },
  { type: 'quote.created', module: 'SALES', description: 'Quotation created from a pricing run', severity: 'INFO' },
  { type: 'quote.sent', module: 'SALES', description: 'Quotation sent to client', severity: 'INFO' },
  { type: 'quote.won', module: 'SALES', description: 'Quotation won', severity: 'INFO' },
  { type: 'quote.lost', module: 'SALES', description: 'Quotation lost', severity: 'ACTION_REQUIRED' },
  { type: 'contract.signed', module: 'SALES', description: 'Sales contract signed → project handoff', severity: 'INFO' },
  // INVENTORY
  { type: 'stock.low', module: 'INVENTORY', description: 'Stock below reorder level', severity: 'ACTION_REQUIRED' },
  { type: 'stock.movement', module: 'INVENTORY', description: 'Goods movement posted', severity: 'INFO' },
  { type: 'stock.dead', module: 'INVENTORY', description: 'Item flagged dead stock', severity: 'INFO' },
  { type: 'material.shortage', module: 'INVENTORY', description: 'Material shortage vs project demand', severity: 'CRITICAL' },
  // HR
  { type: 'leave.requested', module: 'HR', description: 'Employee leave requested', severity: 'INFO' },
  { type: 'employee.visa_expiring', module: 'HR', description: 'Visa / work permit nearing expiry', severity: 'CRITICAL' },
  { type: 'payroll.run', module: 'HR', description: 'Payroll run executed', severity: 'INFO' },
  // RISK / AI
  { type: 'risk.identified', module: 'RISK', description: 'New risk identified', severity: 'ACTION_REQUIRED' },
  { type: 'risk.escalated', module: 'RISK', description: 'Risk severity escalated', severity: 'CRITICAL' },
  { type: 'ai.insight_generated', module: 'INTELLIGENCE', description: 'Intelligence engine produced an insight', severity: 'INFO' },
  { type: 'autonomy.action_proposed', module: 'INTELLIGENCE', description: 'Autonomy engine proposed an action', severity: 'ACTION_REQUIRED' },
];

export const EVENT_TYPE_NAMES: string[] = EVENT_CATALOG.map(e => e.type);

const byType = new Map<string, EventTypeDef>(EVENT_CATALOG.map(e => [e.type, e]));

/** Lookup a catalog definition by event-type name (undefined for legacy/unregistered). */
export function eventDef(type: string): EventTypeDef | undefined {
  return byType.get(type);
}
