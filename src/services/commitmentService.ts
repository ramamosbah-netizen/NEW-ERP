// ============================================================
// JEET ERP — Cost Commitment Tracking Service
// ============================================================

import { supabase } from '@/lib/supabase';

export interface SystemCostSummary {
  system: string;
  systemName: string;
  budgetCost: number;       // BOQ budget
  selectedCost: number;     // Selected supplier cost from comparison sheet
  committedCost: number;    // LPO approved/active cost
  receivedCost: number;     // Delivered cost via GRNs
  remainingBudget: number;  // budgetCost - committedCost
  receivedPercent: number;  // receivedCost / committedCost
}

export const commitmentService = {
  /**
   * Calculates real-time cost commitments and budget comparisons by system for a project.
   */
  async getProjectCostCommitments(projectId: string): Promise<SystemCostSummary[]> {
    try {
      // 1. Fetch Project Details to get tender_id (used as project_id in comparisons)
      const { data: project, error: projErr } = await supabase
        .from('projects')
        .select('id, tender_id, name, budget_cost, contract_value')
        .eq('id', projectId)
        .single();

      if (projErr || !project) {
        throw new Error('Project not found');
      }

      // 2. Fetch Comparison Items (Budget per system)
      let budgetBySystem: Record<string, { budget: number; selected: number }> = {};
      if (project.tender_id) {
        const { data: compItems, error: compErr } = await supabase
          .from('comparison_items')
          .select(`
            system,
            boq_total_material_cost,
            selected_total_cost,
            supplier_comparisons!inner (status, project_id)
          `)
          .eq('supplier_comparisons.project_id', project.tender_id)
          .eq('supplier_comparisons.status', 'APPROVED');

        if (!compErr && compItems) {
          compItems.forEach((item: any) => {
            const sys = item.system || 'OTHER';
            if (!budgetBySystem[sys]) {
              budgetBySystem[sys] = { budget: 0, selected: 0 };
            }
            budgetBySystem[sys].budget += Number(item.boq_total_material_cost) || 0;
            budgetBySystem[sys].selected += Number(item.selected_total_cost) || 0;
          });
        }
      }

      // 3. Fetch PO Items (Committed & Received costs)
      const { data: poItems, error: poErr } = await supabase
        .from('po_items')
        .select(`
          system,
          quantity,
          unit_price,
          discount_pct,
          qty_received,
          line_total,
          purchase_orders!inner (id, status, project_id)
        `)
        .eq('purchase_orders.project_id', projectId)
        .not('purchase_orders.status', 'in', '("DRAFT","CANCELLED","REJECTED")');

      const costBySystem: Record<string, { committed: number; received: number }> = {};
      if (!poErr && poItems) {
        poItems.forEach((item: any) => {
          const sys = item.system || 'OTHER';
          if (!costBySystem[sys]) {
            costBySystem[sys] = { committed: 0, received: 0 };
          }
          // Committed line total (after discounts, ex-VAT since budget is ex-VAT)
          const discountFactor = 1.00 - (Number(item.discount_pct) || 0) / 100.00;
          const qty = Number(item.quantity) || 0;
          const price = Number(item.unit_price) || 0;
          const lineCommitted = qty * price * discountFactor;
          
          // Received total (qty_received * unit_price after discount)
          const qtyRec = Number(item.qty_received) || 0;
          const lineReceived = qtyRec * price * discountFactor;

          costBySystem[sys].committed += lineCommitted;
          costBySystem[sys].received += lineReceived;
        });
      }

      // 4. Map and Merge Systems
      const allSystems = Array.from(
        new Set([...Object.keys(budgetBySystem), ...Object.keys(costBySystem)])
      );

      const systemLabels: Record<string, string> = {
        CCTV: 'CCTV & Surveillance',
        ACCESS_CONTROL: 'Access Control',
        FIRE_ALARM: 'Fire Alarm',
        BMS: 'BMS (Building Management)',
        STRUCTURED_CABLING: 'Structured Cabling',
        PA_AV_BGM: 'PA / AV / BGM',
        GATE_BARRIER: 'Gate Barrier',
        KNX_SMART_HOME: 'KNX / Smart Home',
        ELECTRICAL: 'Electrical',
        OTHER: 'Other / Consumables',
      };

      const summaries: SystemCostSummary[] = allSystems.map(sys => {
        const budgetInfo = budgetBySystem[sys] || { budget: 0, selected: 0 };
        const costInfo = costBySystem[sys] || { committed: 0, received: 0 };
        
        const budgetCost = Number(budgetInfo.budget.toFixed(2));
        const selectedCost = Number(budgetInfo.selected.toFixed(2));
        const committedCost = Number(costInfo.committed.toFixed(2));
        const receivedCost = Number(costInfo.received.toFixed(2));
        
        const remainingBudget = Number((budgetCost - committedCost).toFixed(2));
        const receivedPercent = committedCost > 0 
          ? Number(((receivedCost / committedCost) * 100).toFixed(1)) 
          : 0;

        return {
          system: sys,
          systemName: systemLabels[sys] || sys,
          budgetCost,
          selectedCost,
          committedCost,
          receivedCost,
          remainingBudget,
          receivedPercent
        };
      });

      // Sort summaries (budget/committed order)
      return summaries.sort((a, b) => b.budgetCost - a.budgetCost || b.committedCost - a.committedCost);

    } catch (err) {
      console.error('Error calculating project commitments:', err);
      throw err;
    }
  }
};

export default commitmentService;
