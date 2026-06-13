// ============================================================
// JEET ERP — Catalogue Price Auto-Update
// Updates pricing_items.material_cost from real supplier prices
// (supplier invoices, proformas, POs) and keeps a price-history
// trail. sell_price is recomputed from the item's markup so the
// catalogue stays consistent. (AI-driven market pricing later.)
// ============================================================

import { supabase } from '@/lib/supabase';

export type PriceSource = 'SUPPLIER_INVOICE' | 'PROFORMA' | 'PO' | 'MANUAL';

export const priceUpdateService = {
  /**
   * Updates a catalogue item's material cost, recomputes its sell price
   * from the stored markup, stamps last_price_change and records history.
   * No-op when the new cost matches the current cost.
   */
  async updateItemCost(
    pricingItemId: string,
    newCost: number,
    source: PriceSource,
    opts: { sourceRef?: string; supplierId?: string } = {}
  ): Promise<{ changed: boolean; oldCost: number; newCost: number }> {
    const { data: item, error } = await supabase
      .from('pricing_items')
      .select('id, material_cost, markup_pct, vat_amount, is_locked')
      .eq('id', pricingItemId)
      .maybeSingle();
    if (error || !item) throw error || new Error('Pricing item not found');
    if (item.is_locked) return { changed: false, oldCost: Number(item.material_cost) || 0, newCost };

    const oldCost = Number(item.material_cost) || 0;
    const rounded = Math.round(newCost * 100) / 100;
    if (rounded <= 0 || rounded === oldCost) {
      return { changed: false, oldCost, newCost: rounded };
    }

    const markup = Number(item.markup_pct) || 0;
    const sell = Math.round(rounded * (1 + markup / 100) * 100) / 100;
    const vat = Math.round(sell * 0.05 * 100) / 100;

    const { error: upErr } = await supabase
      .from('pricing_items')
      .update({
        material_cost: rounded,
        sell_price: sell,
        vat_amount: vat,
        total_with_vat: Math.round((sell + vat) * 100) / 100,
        last_price_change: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', pricingItemId);
    if (upErr) throw upErr;

    // History (best-effort — table from migration 20260613180000)
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('pricing_price_history').insert({
      pricing_item_id: pricingItemId,
      old_material_cost: oldCost,
      new_material_cost: rounded,
      source,
      source_ref: opts.sourceRef || null,
      supplier_id: opts.supplierId || null,
      changed_by: user?.id || null,
    }).then(({ error: hErr }) => {
      if (hErr) console.warn('Price history not recorded (apply migration 20260613180000):', hErr.message);
    });

    return { changed: true, oldCost, newCost: rounded };
  },

  /**
   * Applies the billed unit prices on a supplier invoice back to the
   * catalogue: each invoice line → po_item → pricing_item gets its
   * material cost refreshed. Returns how many items were updated.
   */
  async applyFromSupplierInvoice(invoiceId: string): Promise<{ updated: number; skipped: number }> {
    const { data: inv } = await supabase
      .from('supplier_invoices')
      .select('id, supplier_invoice_number, supplier_id')
      .eq('id', invoiceId)
      .maybeSingle();

    const { data: lines, error } = await supabase
      .from('supplier_invoice_items')
      .select('unit_price, po_item_id')
      .eq('supplier_invoice_id', invoiceId);
    if (error) throw error;

    // Resolve po_item_id -> pricing_item_id separately (no reliable embed)
    const poItemIds = Array.from(new Set((lines || []).map((l: any) => l.po_item_id).filter(Boolean))) as string[];
    const poItemToPricing = new Map<string, string>();
    if (poItemIds.length > 0) {
      const { data: poItems } = await supabase
        .from('po_items')
        .select('id, pricing_item_id')
        .in('id', poItemIds);
      for (const pi of (poItems || []) as any[]) {
        if (pi.pricing_item_id) poItemToPricing.set(pi.id, pi.pricing_item_id);
      }
    }

    let updated = 0, skipped = 0;
    for (const line of (lines || []) as any[]) {
      const pricingItemId = line.po_item_id ? poItemToPricing.get(line.po_item_id) : undefined;
      const price = Number(line.unit_price) || 0;
      if (!pricingItemId || price <= 0) { skipped++; continue; }
      try {
        const res = await this.updateItemCost(pricingItemId, price, 'SUPPLIER_INVOICE', {
          sourceRef: inv?.supplier_invoice_number,
          supplierId: inv?.supplier_id,
        });
        if (res.changed) updated++; else skipped++;
      } catch {
        skipped++;
      }
    }
    return { updated, skipped };
  },

  /** Recent price-change history for an item. */
  async getHistory(pricingItemId: string, limit = 20) {
    const { data, error } = await supabase
      .from('pricing_price_history')
      .select('*')
      .eq('pricing_item_id', pricingItemId)
      .order('changed_at', { ascending: false })
      .limit(limit);
    if (error) return [];
    return data;
  },
};

export default priceUpdateService;
