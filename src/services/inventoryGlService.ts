// ============================================================
// JEET ERP — Warehouse: Inventory GL Integration service
// Maps stock movement types to GL accounts and builds a period
// journal from the movement ledger. Degrades gracefully to built-in
// defaults if the mapping table isn't applied yet. Audit-logged.
// ============================================================

import { supabase } from '@/lib/supabase';
import { auditService } from './auditService';

export interface GlMapping {
  transaction_type: string;
  debit_account_code: string;
  debit_account_name: string;
  credit_account_code: string;
  credit_account_name: string;
}

export interface JournalLine extends GlMapping {
  count: number;
  amount: number;            // sum of |total_value|
}

// Built-in defaults (mirror the migration seed) so the page works pre-migration.
export const DEFAULT_MAPPINGS: GlMapping[] = [
  { transaction_type: 'GRN_RECEIPT', debit_account_code: '1300', debit_account_name: 'Inventory', credit_account_code: '2100', credit_account_name: 'GRNI Accrual' },
  { transaction_type: 'ISSUE_TO_PROJECT', debit_account_code: '1400', debit_account_name: 'WIP - Project Materials', credit_account_code: '1300', credit_account_name: 'Inventory' },
  { transaction_type: 'ISSUE_TO_TICKET', debit_account_code: '5100', debit_account_name: 'Service COGS', credit_account_code: '1300', credit_account_name: 'Inventory' },
  { transaction_type: 'RETURN_FROM_SITE', debit_account_code: '1300', debit_account_name: 'Inventory', credit_account_code: '1400', credit_account_name: 'WIP - Project Materials' },
  { transaction_type: 'RETURN_TO_SUPPLIER', debit_account_code: '2100', debit_account_name: 'GRNI Accrual', credit_account_code: '1300', credit_account_name: 'Inventory' },
  { transaction_type: 'TRANSFER_OUT', debit_account_code: '1300', debit_account_name: 'Inventory', credit_account_code: '1300', credit_account_name: 'Inventory' },
  { transaction_type: 'TRANSFER_IN', debit_account_code: '1300', debit_account_name: 'Inventory', credit_account_code: '1300', credit_account_name: 'Inventory' },
  { transaction_type: 'ADJUSTMENT_IN', debit_account_code: '1300', debit_account_name: 'Inventory', credit_account_code: '4900', credit_account_name: 'Inventory Gain' },
  { transaction_type: 'ADJUSTMENT_OUT', debit_account_code: '5900', debit_account_name: 'Inventory Loss', credit_account_code: '1300', credit_account_name: 'Inventory' },
  { transaction_type: 'WRITE_OFF', debit_account_code: '5910', debit_account_name: 'Inventory Write-off', credit_account_code: '1300', credit_account_name: 'Inventory' },
];

const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

export const inventoryGlService = {
  async getMappings(): Promise<GlMapping[]> {
    const { data, error } = await supabase.from('inventory_gl_mappings').select('*');
    if (error || !data || !data.length) return DEFAULT_MAPPINGS; // table missing / empty → defaults
    // merge: any default type missing from the table falls back to default
    const byType = new Map(data.map((d: any) => [d.transaction_type, d]));
    return DEFAULT_MAPPINGS.map(d => (byType.get(d.transaction_type) as GlMapping) || d);
  },

  async upsertMapping(m: GlMapping): Promise<void> {
    const { error } = await supabase.from('inventory_gl_mappings')
      .upsert({ ...m, updated_at: new Date().toISOString() }, { onConflict: 'transaction_type' });
    if (error) throw error;
    auditService.logEvent({ module: 'Warehouse', action: 'UPDATE', entity_type: 'gl_mapping', entity_id: m.transaction_type, summary: `GL mapping for ${m.transaction_type}` });
  },

  async getPeriodJournal(opts: { date_from?: string; date_to?: string }): Promise<{ lines: JournalLine[]; totalDebit: number; totalCredit: number }> {
    const mappings = await this.getMappings();
    const mapByType = new Map(mappings.map(m => [m.transaction_type, m]));

    let q = supabase.from('stock_transactions').select('type, total_value, created_at');
    if (opts.date_from) q = q.gte('created_at', opts.date_from);
    if (opts.date_to) q = q.lte('created_at', opts.date_to);
    const { data, error } = await q;
    if (error) throw error;

    const agg = new Map<string, { count: number; amount: number }>();
    (data || []).forEach((t: any) => {
      const e = agg.get(t.type) || { count: 0, amount: 0 };
      e.count++; e.amount += Math.abs(Number(t.total_value || 0));
      agg.set(t.type, e);
    });

    const lines: JournalLine[] = [];
    let totalDebit = 0, totalCredit = 0;
    agg.forEach((v, type) => {
      const m = mapByType.get(type) || { transaction_type: type, debit_account_code: '', debit_account_name: 'Unmapped', credit_account_code: '', credit_account_name: 'Unmapped' };
      const amount = r2(v.amount);
      // transfers net to zero (same account both sides) — keep for transparency but they don't move the P&L/BS
      lines.push({ ...m, count: v.count, amount });
      if (m.debit_account_code !== m.credit_account_code) { totalDebit += amount; totalCredit += amount; }
    });

    return { lines: lines.sort((a, b) => b.amount - a.amount), totalDebit: r2(totalDebit), totalCredit: r2(totalCredit) };
  },
};

export default inventoryGlService;
