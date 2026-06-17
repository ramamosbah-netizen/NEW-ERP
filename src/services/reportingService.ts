import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';
import { projectFinancialsService } from './projectFinancialsService';

export interface FinancialSummary {
  receivables: number;
  payables: number;
  marginAverage: number;
  projectBudgetTotal: number;
  projectActualTotal: number;
}

export interface AgingBucket {
  bucket: '0-30' | '31-60' | '61-90' | '90+';
  amount: number;
}

export interface ProjectMarginKPI {
  project_id: string;
  project_name: string;
  project_number: string;
  budget_cost: number;
  committed_cost: number;
  actual_cost: number;
  variance: number;
  margin_percentage: number;
}

export interface TicketSLAStats {
  resolved_on_time: number;
  resolved_breached: number;
  open_active: number;
  open_breached: number;
  sla_compliance_rate: number;
}

export const reportingService = {
  /**
   * Retrieves high-level company-wide financial performance metrics.
   */
  async getFinancialSummary(): Promise<FinancialSummary> {
    // 1. Receivables: Sum of Client Invoices where status = 'SENT' or 'PARTIALLY_PAID' (net_due)
    // 2. Payables: Sum of Supplier Invoices where status = 'APPROVED' or 'PARTIALLY_PAID'

    // Invoices count
    const { data: arData, error: arErr } = await supabase
      .from('client_invoices')
      .select('total_incl_vat, amount_paid')
      .in('status', ['SENT', 'PARTIALLY_PAID']);

    if (arErr) logger.error('Receivables calculation error:', arErr.message);

    // Supplier invoices count
    const { data: apData, error: apErr } = await supabase
      .from('supplier_invoices')
      .select('total, amount_paid')
      .in('status', ['APPROVED', 'PARTIALLY_PAID']);

    if (apErr) logger.error('Payables calculation error:', apErr.message);

    // Projects margins sum
    const { data: projData, error: projErr } = await supabase
      .from('projects')
      .select('id, contract_value')
      .neq('status', 'SUBMITTED')
      .neq('status', 'LOST');

    if (projErr) logger.error('Project financials calculation error:', projErr.message);

    let receivables = 0;
    if (arData) {
      for (const inv of arData) {
        const total = inv.total_incl_vat || 0;
        const paid = inv.amount_paid || 0;
        receivables += Math.max(0, total - paid);
      }
    }

    let payables = 0;
    if (apData) {
      for (const sinv of apData) {
        const total = sinv.total || 0;
        const paid = sinv.amount_paid || 0;
        payables += Math.max(0, total - paid);
      }
    }

    let projectBudgetTotal = 0;
    let projectActualTotal = 0;
    if (projData) {
      projectBudgetTotal = projData.reduce((sum, p) => sum + (p.contract_value || 0), 0);
      const actualCosts = await Promise.all(
        projData.map(p =>
          projectFinancialsService
            .computeProjectFinancials(p.id)
            .then(f => f.actualCost)
            .catch(e => {
              logger.error(`Failed to calculate actual cost for project ${p.id}:`, e);
              return 0;
            })
        )
      );
      projectActualTotal = actualCosts.reduce((sum, c) => sum + c, 0);
    }

    const marginAverage = projectBudgetTotal > 0
      ? Math.round(((projectBudgetTotal - projectActualTotal) / projectBudgetTotal) * 100)
      : 0;

    return {
      receivables,
      payables,
      marginAverage,
      projectBudgetTotal,
      projectActualTotal
    };
  },

  /**
   * Generates AR (Accounts Receivable) and AP (Accounts Payable) Aging Buckets.
   */
  async getAgingReport(type: 'AR' | 'AP'): Promise<AgingBucket[]> {
    const today = new Date();
    const buckets: Record<'0-30' | '31-60' | '61-90' | '90+', number> = {
      '0-30': 0,
      '31-60': 0,
      '61-90': 0,
      '90+': 0
    };

    if (type === 'AR') {
      const { data, error } = await supabase
        .from('client_invoices')
        .select('due_date, total_incl_vat, amount_paid')
        .in('status', ['SENT', 'PARTIALLY_PAID']);

      if (error) throw error;

      if (data) {
        for (const inv of data) {
          const unpaid = (inv.total_incl_vat || 0) - (inv.amount_paid || 0);
          if (unpaid <= 0) continue;

          const dueDate = new Date(inv.due_date);
          const diffDays = Math.ceil((today.getTime() - dueDate.getTime()) / (1000 * 3600 * 24));

          if (diffDays <= 30) buckets['0-30'] += unpaid;
          else if (diffDays <= 60) buckets['31-60'] += unpaid;
          else if (diffDays <= 90) buckets['61-90'] += unpaid;
          else buckets['90+'] += unpaid;
        }
      }
    } else {
      const { data, error } = await supabase
        .from('supplier_invoices')
        .select('due_date, total, amount_paid')
        .in('status', ['APPROVED', 'PARTIALLY_PAID']);

      if (error) throw error;

      if (data) {
        for (const sinv of data) {
          const unpaid = (sinv.total || 0) - (sinv.amount_paid || 0);
          if (unpaid <= 0) continue;

          const dueDate = new Date(sinv.due_date);
          const diffDays = Math.ceil((today.getTime() - dueDate.getTime()) / (1000 * 3600 * 24));

          if (diffDays <= 30) buckets['0-30'] += unpaid;
          else if (diffDays <= 60) buckets['31-60'] += unpaid;
          else if (diffDays <= 90) buckets['61-90'] += unpaid;
          else buckets['90+'] += unpaid;
        }
      }
    }

    return Object.entries(buckets).map(([bucket, amount]) => ({
      bucket: bucket as any,
      amount
    }));
  },

  /**
   * Analyzes project budgets, committed costs (Purchase Orders), and actual costs (GRNs / supplier invoices).
   */
  async getProjectMarginKPIs(): Promise<ProjectMarginKPI[]> {
    const { data: projects, error: pErr } = await supabase
      .from('projects')
      .select('id, name, project_number, contract_value')
      .neq('status', 'SUBMITTED')
      .neq('status', 'LOST');

    if (pErr) throw pErr;

    const result: ProjectMarginKPI[] = await Promise.all(
      (projects || []).map(async (p) => {
        let committed_cost = 0;
        let actual_cost = 0;
        try {
          const financials = await projectFinancialsService.computeProjectFinancials(p.id);
          committed_cost = financials.committedCost;
          actual_cost = financials.actualCost;
        } catch (e) {
          logger.error(`Failed to calculate financials for project ${p.id}:`, e);
        }
        const budget_cost = p.contract_value || 0;
        const variance = budget_cost - committed_cost;
        const margin_percentage = budget_cost > 0
          ? Math.round(((budget_cost - actual_cost) / budget_cost) * 100)
          : 0;

        return {
          project_id: p.id,
          project_name: p.name,
          project_number: p.project_number,
          budget_cost,
          committed_cost,
          actual_cost,
          variance,
          margin_percentage
        };
      })
    );

    return result;
  },

  /**
   * Generates SLA Response/Resolution speed metrics for reactive tickets.
   */
  async getTicketSLAStats(): Promise<TicketSLAStats> {
    const { data: tickets, error } = await supabase
      .from('service_tickets')
      .select('status, resolution_met, sla_resolution_due');

    if (error) throw error;

    let resolved_on_time = 0;
    let resolved_breached = 0;
    let open_active = 0;
    let open_breached = 0;

    const today = new Date();

    if (tickets) {
      for (const t of tickets) {
        const isClosed = t.status === 'CLOSED' || t.status === 'RESOLVED';

        if (isClosed) {
          if (t.resolution_met) {
            resolved_on_time++;
          } else {
            resolved_breached++;
          }
        } else {
          // Open
          const deadline = t.sla_resolution_due ? new Date(t.sla_resolution_due) : null;
          if (deadline && today <= deadline) {
            open_active++;
          } else {
            open_breached++;
          }
        }
      }
    }

    const totalResolved = resolved_on_time + resolved_breached;
    const sla_compliance_rate = totalResolved > 0
      ? Math.round((resolved_on_time / totalResolved) * 100)
      : 100;

    return {
      resolved_on_time,
      resolved_breached,
      open_active,
      open_breached,
      sla_compliance_rate
    };
  }
};

export default reportingService;