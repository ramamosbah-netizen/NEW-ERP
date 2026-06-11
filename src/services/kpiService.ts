// ============================================================
// JEET ERP — Centralized KPI Aggregation Service
// Computes executive COE-level indicators and module stats
// ============================================================

import { supabase } from '@/lib/supabase';
import { projectFinancialsService } from './projectFinancialsService';
import { reportingService } from './reportingService';
import { cashFlowService } from './cashFlowService';

export interface ExecutiveKPIs {
  portfolioValue: number;
  averageMargin: number;
  cashPosition: number;
  activePipelineValue: number;
  activePipelineCount: number;
  slaComplianceRate: number;
  complianceWarningsCount: number;
  projectStatusCounts: {
    mobilization: number;
    inProgress: number;
    testing: number;
    handover: number;
    dlp: number;
    onHold: number;
  };
  monthlyPerformance: Array<{
    month: string;
    billed: number;
    spent: number;
  }>;
}

export interface FinanceKPIs {
  receivablesTotal: number;
  receivablesOverdue: number;
  payablesTotal: number;
  payablesOverdue: number;
  cashPosition: number;
  netWeeklyProjectedFlow: number;
  weeklyInflows: number;
  weeklyOutflows: number;
  vatLiability: number;
  agingAR: Array<{ bucket: string; amount: number }>;
  agingAP: Array<{ bucket: string; amount: number }>;
}

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const kpiService = {
  /**
   * Fetches all high-level executive KPIs.
   */
  async getExecutiveKPIs(): Promise<ExecutiveKPIs> {
    // 1. Fetch active projects for contract value & margins
    const { data: projects, error: projErr } = await supabase
      .from('projects')
      .select('id, contract_value, status')
      .eq('is_active', true);

    if (projErr) throw projErr;

    const activeProjects = (projects || []).filter(
      p => !['SUBMITTED', 'LOST', 'CANCELLED'].includes(p.status)
    );

    let portfolioValue = 0;
    let totalActualCost = 0;

    for (const p of activeProjects) {
      portfolioValue += Number(p.contract_value || 0);
      try {
        const financials = await projectFinancialsService.computeProjectFinancials(p.id);
        totalActualCost += financials.actualCost;
      } catch (err) {
        console.error(`Error computing financials for project ${p.id}:`, err);
      }
    }

    const averageMargin = portfolioValue > 0
      ? Math.round(((portfolioValue - totalActualCost) / portfolioValue) * 100)
      : 0;

    // 2. Cash Position: 500,000 + client payments - supplier payments
    const { data: clientPays } = await supabase
      .from('client_payments')
      .select('amount');
    const { data: supplierPays } = await supabase
      .from('supplier_payments')
      .select('amount');

    const totalInflows = (clientPays || []).reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const totalOutflows = (supplierPays || []).reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const cashPosition = 500000 + totalInflows - totalOutflows;

    // 3. Active Pipeline: status = 'SUBMITTED' joined with quotations
    const { data: pipelineData } = await supabase
      .from('projects')
      .select('id, quotation_id, quotations(subtotal_after_discount, grand_total_with_vat)')
      .eq('status', 'SUBMITTED')
      .eq('is_active', true);

    const activePipelineCount = (pipelineData || []).length;
    const activePipelineValue = (pipelineData || []).reduce((sum, item) => {
      const val = Number(
        (item.quotations as any)?.subtotal_after_discount || 
        (item.quotations as any)?.grand_total_with_vat || 
        0
      );
      return sum + val;
    }, 0);

    // 4. Ticket SLA compliance rate
    let slaComplianceRate = 100;
    try {
      const slaStats = await reportingService.getTicketSLAStats();
      slaComplianceRate = slaStats.sla_compliance_rate;
    } catch (err) {
      console.error('Error fetching SLA stats:', err);
    }

    // 5. Compliance warnings count
    const { count: complianceWarningsCount } = await supabase
      .from('document_expiry_alerts')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'PENDING');

    // 6. Project Status Counts
    const projectStatusCounts = {
      mobilization: 0,
      inProgress: 0,
      testing: 0,
      handover: 0,
      dlp: 0,
      onHold: 0,
    };

    (projects || []).forEach(p => {
      if (p.status === 'MOBILIZATION') projectStatusCounts.mobilization++;
      else if (p.status === 'IN_PROGRESS') projectStatusCounts.inProgress++;
      else if (p.status === 'TESTING') projectStatusCounts.testing++;
      else if (p.status === 'HANDOVER') projectStatusCounts.handover++;
      else if (p.status === 'DLP') projectStatusCounts.dlp++;
      else if (p.status === 'ON_HOLD') projectStatusCounts.onHold++;
    });

    // 7. Monthly Performance: Last 6 months billed vs spent
    const monthlyPerformance: Array<{ month: string; billed: number; spent: number }> = [];
    const today = new Date();
    
    // Initialize last 6 months
    for (let i = 5; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      monthlyPerformance.push({
        month: `${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear().toString().slice(-2)}`,
        billed: 0,
        spent: 0
      });
    }

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const startStr = sixMonthsAgo.toISOString().split('T')[0];

    const { data: arInvoices } = await supabase
      .from('client_invoices')
      .select('invoice_date, taxable_amount')
      .gte('invoice_date', startStr)
      .in('status', ['APPROVED', 'SENT', 'PARTIALLY_PAID', 'PAID']);

    const { data: apInvoices } = await supabase
      .from('supplier_invoices')
      .select('invoice_date, taxable_amount')
      .gte('invoice_date', startStr)
      .in('status', ['REGISTERED', 'APPROVED', 'SCHEDULED', 'PARTIALLY_PAID', 'PAID']);

    arInvoices?.forEach(inv => {
      const d = new Date(inv.invoice_date);
      const label = `${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear().toString().slice(-2)}`;
      const bucket = monthlyPerformance.find(x => x.month === label);
      if (bucket) {
        bucket.billed += Number(inv.taxable_amount || 0);
      }
    });

    apInvoices?.forEach(inv => {
      const d = new Date(inv.invoice_date);
      const label = `${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear().toString().slice(-2)}`;
      const bucket = monthlyPerformance.find(x => x.month === label);
      if (bucket) {
        bucket.spent += Number(inv.taxable_amount || 0);
      }
    });

    return {
      portfolioValue: Math.round(portfolioValue),
      averageMargin,
      cashPosition: Math.round(cashPosition),
      activePipelineValue: Math.round(activePipelineValue),
      activePipelineCount,
      slaComplianceRate,
      complianceWarningsCount: complianceWarningsCount || 0,
      projectStatusCounts,
      monthlyPerformance
    };
  },

  /**
   * Fetches Finance module-specific KPIs.
   */
  async getFinanceKPIs(): Promise<FinanceKPIs> {
    // 1. Receivables (AR) Aging Summary
    const arAgingReport = await reportingService.getAgingReport('AR');
    const arSummary = arAgingReport.reduce((acc, curr) => {
      acc.totalOutstanding += curr.amount;
      if (curr.bucket !== '0-30') {
        acc.totalOverdue += curr.amount;
      }
      return acc;
    }, { totalOutstanding: 0, totalOverdue: 0 });

    // 2. Payables (AP) Aging Summary
    const apAgingReport = await reportingService.getAgingReport('AP');
    const apSummary = apAgingReport.reduce((acc, curr) => {
      acc.totalOutstanding += curr.amount;
      if (curr.bucket !== '0-30') {
        acc.totalOverdue += curr.amount;
      }
      return acc;
    }, { totalOutstanding: 0, totalOverdue: 0 });

    // 3. Cash Position (Real Transactions ledger)
    const { data: clientPays } = await supabase
      .from('client_payments')
      .select('amount');
    const { data: supplierPays } = await supabase
      .from('supplier_payments')
      .select('amount');

    const totalInflows = (clientPays || []).reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const totalOutflows = (supplierPays || []).reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const cashPosition = 500000 + totalInflows - totalOutflows;

    // 4. Cash Flow Forecast (Week 1 projected net flow, inflow, outflow)
    let netWeeklyProjectedFlow = 0;
    let weeklyInflows = 0;
    let weeklyOutflows = 0;
    try {
      const forecast = await cashFlowService.get13WeekForecast(cashPosition);
      if (forecast && forecast.length > 0) {
        netWeeklyProjectedFlow = forecast[0].netFlow;
        weeklyInflows = forecast[0].inflows.total;
        weeklyOutflows = forecast[0].outflows.total;
      }
    } catch (err) {
      console.error('Error computing cashflow forecast:', err);
    }

    // 5. VAT Liability: Billed Output VAT minus Input VAT
    // Standard-rated output VAT (5%) on all sent/paid client invoices in active periods
    const { data: activeClientVAT } = await supabase
      .from('client_invoices')
      .select('vat_amount')
      .in('status', ['SENT', 'PARTIALLY_PAID', 'PAID']);
    const outputVAT = (activeClientVAT || []).reduce((sum, i) => sum + Number(i.vat_amount || 0), 0);

    // Input VAT recovery (5%) on all approved/registered supplier invoices
    const { data: activeSupplierVAT } = await supabase
      .from('supplier_invoices')
      .select('vat_amount')
      .in('status', ['REGISTERED', 'APPROVED', 'SCHEDULED', 'PARTIALLY_PAID', 'PAID']);
    const inputVAT = (activeSupplierVAT || []).reduce((sum, i) => sum + Number(i.vat_amount || 0), 0);

    const vatLiability = Math.max(0, outputVAT - inputVAT);

    // 6. Aging distributions
    const agingAR = arAgingReport.map(b => ({ bucket: b.bucket, amount: Math.round(b.amount) }));
    const agingAP = apAgingReport.map(b => ({ bucket: b.bucket, amount: Math.round(b.amount) }));

    return {
      receivablesTotal: Math.round(arSummary.totalOutstanding),
      receivablesOverdue: Math.round(arSummary.totalOverdue),
      payablesTotal: Math.round(apSummary.totalOutstanding),
      payablesOverdue: Math.round(apSummary.totalOverdue),
      cashPosition: Math.round(cashPosition),
      netWeeklyProjectedFlow: Math.round(netWeeklyProjectedFlow),
      weeklyInflows: Math.round(weeklyInflows),
      weeklyOutflows: Math.round(weeklyOutflows),
      vatLiability: Math.round(vatLiability),
      agingAR,
      agingAP
    };
  }
};

export default kpiService;
