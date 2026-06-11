// ============================================================
// JEET ERP — Rolling 13-Week Cash Flow Forecast Service
// Computes weekly cash inflows (AR + Milestones) vs outflows (AP + POs)
// ============================================================

import { supabase } from '@/lib/supabase';
import { round2 } from './invoiceMathService';

interface CashFlowWeek {
  weekIndex: number;
  startDate: string;
  endDate: string;
  inflows: {
    invoices: number;
    milestones: number;
    total: number;
  };
  outflows: {
    supplierInvoices: number;
    purchaseOrders: number;
    total: number;
  };
  netFlow: number;
  cumulativeBalance: number;
}

export const cashFlowService = {
  /**
   * Computes a rolling 13-week forecast of cash inflows and outflows.
   */
  async get13WeekForecast(startingBalance: number = 500000): Promise<CashFlowWeek[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 1. Define 13 weekly intervals
    const weeks: Array<{ start: Date; end: Date }> = [];
    for (let i = 0; i < 13; i++) {
      const start = new Date(today);
      start.setDate(today.getDate() + i * 7);
      
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);

      weeks.push({ start, end });
    }

    // 2. Fetch outstanding Client Invoices (Inflows)
    const { data: arInvoices } = await supabase
      .from('client_invoices')
      .select('due_date, net_due, amount_paid')
      .in('status', ['APPROVED', 'SENT', 'PARTIALLY_PAID']);

    // 3. Fetch pending Project Milestones linked to payments (Inflows)
    const { data: milestones } = await supabase
      .from('project_milestones')
      .select('planned_date, payment_pct, projects(contract_value)')
      .eq('status', 'PENDING')
      .eq('payment_linked', true);

    // 4. Fetch outstanding Supplier Invoices (Outflows)
    const { data: apInvoices } = await supabase
      .from('supplier_invoices')
      .select('due_date, total, amount_paid')
      .in('status', ['REGISTERED', 'APPROVED', 'SCHEDULED', 'PARTIALLY_PAID']);

    // 5. Fetch approved POs with expected delivery dates (Outflows)
    const { data: pos } = await supabase
      .from('purchase_orders')
      .select('required_delivery_date, subtotal')
      .in('status', ['APPROVED', 'SENT', 'ACKNOWLEDGED']);

    // 6. Bucket items into weeks
    const forecast: CashFlowWeek[] = [];
    let currentBalance = startingBalance;

    for (let i = 0; i < 13; i++) {
      const { start, end } = weeks[i];
      const startMs = start.getTime();
      const endMs = end.getTime();

      let weekInvoiceInflow = 0;
      let weekMilestoneInflow = 0;
      let weekSupplierInvoiceOutflow = 0;
      let weekPOOutflow = 0;

      // Filter AR Invoices
      for (const inv of arInvoices || []) {
        const dueDate = new Date(inv.due_date).getTime();
        if (dueDate >= startMs && dueDate <= endMs) {
          weekInvoiceInflow += Number(inv.net_due || 0) - Number(inv.amount_paid || 0);
        }
      }

      // Filter Milestones
      for (const ms of milestones || []) {
        if (!ms.planned_date) continue;
        const planDate = new Date(ms.planned_date).getTime();
        if (planDate >= startMs && planDate <= endMs) {
          const contractVal = Number((ms.projects as any)?.contract_value || 0);
          const pct = Number(ms.payment_pct || 0);
          weekMilestoneInflow += (contractVal * pct) / 100;
        }
      }

      // Filter AP Invoices
      for (const inv of apInvoices || []) {
        const dueDate = new Date(inv.due_date).getTime();
        if (dueDate >= startMs && dueDate <= endMs) {
          weekSupplierInvoiceOutflow += Number(inv.total || 0) - Number(inv.amount_paid || 0);
        }
      }

      // Filter POs
      for (const po of pos || []) {
        if (!po.required_delivery_date) continue;
        const delDate = new Date(po.required_delivery_date).getTime();
        if (delDate >= startMs && delDate <= endMs) {
          weekPOOutflow += Number(po.subtotal || 0);
        }
      }

      const totalInflow = weekInvoiceInflow + weekMilestoneInflow;
      const totalOutflow = weekSupplierInvoiceOutflow + weekPOOutflow;
      const netFlow = totalInflow - totalOutflow;
      currentBalance += netFlow;

      forecast.push({
        weekIndex: i + 1,
        startDate: start.toISOString().split('T')[0],
        endDate: end.toISOString().split('T')[0],
        inflows: {
          invoices: round2(weekInvoiceInflow),
          milestones: round2(weekMilestoneInflow),
          total: round2(totalInflow)
        },
        outflows: {
          supplierInvoices: round2(weekSupplierInvoiceOutflow),
          purchaseOrders: round2(weekPOOutflow),
          total: round2(totalOutflow)
        },
        netFlow: round2(netFlow),
        cumulativeBalance: round2(currentBalance)
      });
    }

    return forecast;
  }
};
export default cashFlowService;
