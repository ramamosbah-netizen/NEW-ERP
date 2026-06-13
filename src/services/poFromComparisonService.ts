// ============================================================
// JEET ERP — PO Generator From Comparison Service
// ============================================================

import { supabase } from '@/lib/supabase';
import type { PurchaseOrder, POItem } from '@/types/po.types';

export interface POProposal {
  supplier_id: string;
  supplier_name: string;
  payment_terms_days: number;
  subtotal: number;
  vat_amount: number;
  total: number;
  items: Array<{
    comparison_item_id: string;
    description: string;
    brand: string;
    unit: string;
    quantity: number;
    unit_price: number;
    vat_applicable: boolean;
    line_total: number;
    system: string;
  }>;
  supplier_details?: {
    trn?: string | null;
    contact_person?: string | null;
    email?: string | null;
    phone?: string | null;
  };
}

export const poFromComparisonService = {
  /**
   * Loads an approved comparison sheet and builds PO draft proposals grouped by selected supplier.
   */
  async generatePOProposalsFromComparison(comparisonId: string): Promise<{
    comparison: any;
    proposals: POProposal[];
  }> {
    try {
      // 1. Fetch Comparison Sheet Header
      const { data: comparison, error: compErr } = await supabase
        .from('supplier_comparisons')
        .select('*')
        .eq('id', comparisonId)
        .single();

      if (compErr) throw compErr;
      if (!comparison) throw new Error('Comparison sheet not found');

      // 2. Fetch Comparison Items
      const { data: compItems, error: itemsErr } = await supabase
        .from('comparison_items')
        .select('*')
        .eq('comparison_id', comparisonId);

      if (itemsErr) throw itemsErr;
      if (!compItems || compItems.length === 0) {
        return { comparison, proposals: [] };
      }

      // 3. Fetch Selected Supplier Offers
      // Extract all selected supplier offer IDs
      const selectedOfferIds = compItems
        .map(item => item.selected_supplier_offer_id)
        .filter(id => !!id) as string[];

      if (selectedOfferIds.length === 0) {
        return { comparison, proposals: [] };
      }

      const { data: offers, error: offersErr } = await supabase
        .from('supplier_offers')
        .select('*')
        .in('id', selectedOfferIds);

      if (offersErr) throw offersErr;
      const offersList = offers || [];

      // 3b. Some selected offers were entered as free-text (supplier_name set
      // but supplier_id null). A PO requires a real pricing_suppliers id, so
      // backfill those offers by finding or creating the supplier by name.
      const unlinked = offersList.filter(o => !o.supplier_id && (o.supplier_name || '').trim());
      if (unlinked.length > 0) {
        const distinctNames = Array.from(new Set(unlinked.map(o => o.supplier_name.trim())));
        for (const name of distinctNames) {
          // Find existing supplier by name (case-insensitive), else create one
          const { data: existing } = await supabase
            .from('pricing_suppliers')
            .select('id')
            .ilike('name', name)
            .limit(1)
            .maybeSingle();

          let resolvedId = existing?.id as string | undefined;
          if (!resolvedId) {
            const sample = unlinked.find(o => o.supplier_name.trim() === name);
            const { data: created, error: createErr } = await supabase
              .from('pricing_suppliers')
              .insert({
                name,
                contact_person: sample?.contact_person || null,
                phone: sample?.phone || null,
                email: sample?.email || null,
                systems_covered: [],
                payment_terms_days: sample?.payment_terms_days ?? 30,
                is_active: true,
              })
              .select('id')
              .single();
            if (createErr) {
              console.warn(`Could not auto-create supplier '${name}':`, createErr.message);
              continue;
            }
            resolvedId = created.id;
          }

          // Stamp the resolved id back onto the in-memory offers and persist it
          for (const o of unlinked) {
            if (o.supplier_name.trim() === name) {
              o.supplier_id = resolvedId;
              await supabase.from('supplier_offers').update({ supplier_id: resolvedId }).eq('id', o.id);
            }
          }
        }
      }

      const offersMap = new Map<string, any>(offersList.map(o => [o.id, o]));

      // 4. Extract unique supplier IDs and fetch supplier contact details from pricing_suppliers
      const supplierIds = Array.from(
        new Set(
          offersList
            .map(o => o.supplier_id)
            .filter(id => !!id)
        )
      ) as string[];

      let suppliersMap = new Map<string, any>();
      if (supplierIds.length > 0) {
        const { data: suppliers, error: supErr } = await supabase
          .from('pricing_suppliers')
          .select('*')
          .in('id', supplierIds);
        if (!supErr && suppliers) {
          suppliersMap = new Map<string, any>(suppliers.map(s => [s.id, s]));
        }
      }

      // 5. Group items by Supplier ID
      const groups = new Map<string, POProposal>();

      for (const item of compItems) {
        if (!item.selected_supplier_offer_id) continue;
        const offer = offersMap.get(item.selected_supplier_offer_id);
        if (!offer) continue;

        const supplierId = offer.supplier_id;
        if (!supplierId) continue; // Skip if no valid supplier ID linked

        const supplier = suppliersMap.get(supplierId);
        const supplierName = supplier?.name || offer.supplier_name || 'Unknown Supplier';

        if (!groups.has(supplierId)) {
          groups.set(supplierId, {
            supplier_id: supplierId,
            supplier_name: supplierName,
            payment_terms_days: supplier?.payment_terms_days ?? offer.payment_terms_days ?? 30,
            subtotal: 0,
            vat_amount: 0,
            total: 0,
            items: [],
            supplier_details: {
              trn: null, // TRN will be set or can be filled from supplier profile later
              contact_person: supplier?.contact_person || null,
              email: supplier?.email || null,
              phone: supplier?.phone || null
            }
          });
        }

        const group = groups.get(supplierId)!;
        
        // Calculate line total: unit price * quantity
        const quantity = Number(item.quantity) || 0;
        const unitPrice = Number(offer.unit_price) || 0;
        const lineTotal = quantity * unitPrice;
        
        // Standard VAT calculation: 5% VAT rate
        const vatRate = 0.05;
        const lineVat = item.is_optional ? 0 : (lineTotal * vatRate);

        group.items.push({
          comparison_item_id: item.id,
          description: item.description || '',
          brand: offer.brand_offered || item.required_brand || '',
          unit: item.unit || 'Pcs',
          quantity,
          unit_price: unitPrice,
          vat_applicable: true,
          line_total: lineTotal,
          system: item.system || 'OTHER'
        });

        // Accumulate totals (only for non-optional items)
        if (!item.is_optional) {
          group.subtotal += lineTotal;
          group.vat_amount += lineVat;
          group.total += (lineTotal + lineVat);
        }
      }

      // Round totals to 2 decimal places
      const proposals = Array.from(groups.values()).map(p => ({
        ...p,
        subtotal: Number(p.subtotal.toFixed(2)),
        vat_amount: Number(p.vat_amount.toFixed(2)),
        total: Number(p.total.toFixed(2)),
        items: p.items.map(it => ({
          ...it,
          line_total: Number(it.line_total.toFixed(2))
        }))
      }));

      return {
        comparison,
        proposals
      };

    } catch (error) {
      console.error('Error generating PO proposals from comparison:', error);
      throw error;
    }
  }
};

export default poFromComparisonService;
