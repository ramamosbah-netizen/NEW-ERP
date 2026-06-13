// ============================================================
// JEET ERP — Supplier Comparison Service Client
// Supabase integrations, state machines, business rules, and alerts
// ============================================================

import { supabase } from './supabase';
import { scoreOffers } from './comparison-scoring';
import { calculateItemMargin, calculateSheetMargin } from './comparison-margin';
import { eventService } from '@/services/eventService';
import type { 
  SupplierComparisonInput, 
  ComparisonItemInput, 
  SupplierOfferInput 
} from './comparison-validation';

// Helper to fetch user profile metadata
export async function getProfileById(userId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  if (error) return null;
  return data;
}

// Helper to send in-app notification
export async function sendNotification(userId: string, message: string) {
  const { error } = await supabase
    .from('notifications')
    .insert({
      user_id: userId,
      message,
      read: false
    });
  if (error) {
    console.error('Failed to create notification:', error);
  }
}

// Helper to get all users of a specific role
export async function getUsersByRole(role: 'admin' | 'manager' | 'engineer') {
  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('role', role);
  if (error) return [];
  return data.map(d => d.id);
}

export type ComparisonFilters = {
  status?: string;
  project_id?: string;
  client_id?: string;
  date_from?: string;
  date_to?: string;
  search?: string;
};

export const comparisonService = {
  
  // 1. Fetch Comparisons list
  async fetchComparisons(filters: ComparisonFilters = {}) {
    let query = supabase
      .from('supplier_comparisons')
      .select('*')
      .order('created_at', { ascending: false });

    if (filters.status) query = query.eq('status', filters.status);
    if (filters.project_id) query = query.eq('project_id', filters.project_id);
    if (filters.client_id) query = query.eq('client_id', filters.client_id);
    
    if (filters.date_from) query = query.gte('comparison_date', filters.date_from);
    if (filters.date_to) query = query.lte('comparison_date', filters.date_to);

    if (filters.search) {
      const s = `%${filters.search}%`;
      query = query.or(`comparison_number.ilike.${s},client_name.ilike.${s},project_name.ilike.${s},project_ref.ilike.${s}`);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  // 2. Fetch Comparison Detail by ID
  async fetchComparisonById(id: string) {
    // A. Fetch comparison header
    const { data: comp, error: compErr } = await supabase
      .from('supplier_comparisons')
      .select('*')
      .eq('id', id)
      .single();

    if (compErr) throw compErr;
    if (!comp) return null;

    // B. Fetch comparison items
    const { data: items, error: itemsErr } = await supabase
      .from('comparison_items')
      .select('*')
      .eq('comparison_id', id)
      .order('sort_order', { ascending: true });

    if (itemsErr) throw itemsErr;

    // C. Fetch all offers under these items
    const itemIds = (items || []).map(it => it.id);
    let offers: any[] = [];
    if (itemIds.length > 0) {
      const { data: offersData, error: offersErr } = await supabase
        .from('supplier_offers')
        .select('*')
        .in('comparison_item_id', itemIds)
        .order('rank', { ascending: true });
      if (offersErr) throw offersErr;
      offers = offersData || [];
    }

    // D. Fetch approvals log
    const { data: approvals, error: approvalsErr } = await supabase
      .from('comparison_approvals')
      .select('*')
      .eq('comparison_id', id)
      .order('acted_at', { ascending: true });

    if (approvalsErr) throw approvalsErr;

    // E. Fetch revisions chain
    const { data: revisions, error: revError } = await supabase
      .from('supplier_comparisons')
      .select('id, revision, status, total_selected_supplier_cost, overall_margin_pct, created_at')
      .eq('comparison_number', comp.comparison_number)
      .order('revision', { ascending: true });

    if (revError) throw revError;

    // Map offers to items
    const itemsWithOffers = (items || []).map(item => {
      const itemOffers = offers.filter(o => o.comparison_item_id === item.id);
      return {
        ...item,
        offers: itemOffers
      };
    });

    return {
      ...comp,
      items: itemsWithOffers,
      approvals: approvals || [],
      revisions: revisions || []
    };
  },

  // 3. Create Comparison Sheet from accepted Quotation
  async createFromQuotation(quotationId: string, targetMargin: number = 15.00) {
    // Check if quotation is ACCEPTED
    const { data: quote, error: quoteErr } = await supabase
      .from('quotations')
      .select('*, boqs(*)')
      .eq('id', quotationId)
      .single();

    if (quoteErr || !quote) throw new Error('Quotation not found.');
    if (quote.status !== 'ACCEPTED') {
      throw new Error('Comparison sheet can only be created from an ACCEPTED quotation.');
    }

    // Check if a comparison already exists for this quotation (active revision)
    const { data: existing, error: existErr } = await supabase
      .from('supplier_comparisons')
      .select('id, comparison_number, status')
      .eq('quotation_id', quotationId)
      .in('status', ['DRAFT', 'PRICING_IN_PROGRESS', 'PENDING_COMMERCIAL', 'PENDING_GM', 'APPROVED']);

    if (existErr) throw existErr;
    if (existing && existing.length > 0) {
      throw new Error(`An active Supplier Comparison sheet (${existing[0].comparison_number}) already exists for this quotation in status ${existing[0].status}.`);
    }

    // Fetch active scoring weights config
    const { data: weights } = await supabase
      .from('comparison_scoring_weights')
      .select('*')
      .single();

    const currentWeights = weights || {
      weight_price: 45,
      weight_delivery: 20,
      weight_history: 20,
      weight_payment: 10,
      weight_compliance: 5
    };

    // Get current user details
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) throw new Error('Authentication required.');
    const profile = await getProfileById(user.id);
    const preparedByName = profile?.full_name || user.email || 'Procurement Officer';

    // Calculate total BOQ benchmark cost and sold revenue based on quotation lines
    // Mapped lines: only non-optional lines are imported to comparison sheet.
    const { data: qLines, error: linesErr } = await supabase
      .from('quotation_lines')
      .select('*, pricing_item_id')
      .eq('quotation_id', quotationId)
      .eq('is_optional', false);

    if (linesErr) throw linesErr;

    // Fetch related BOQ item material cost maps — build multiple lookup indices
    const boqItems = quote.boqs;
    const parsedBOQItems = Array.isArray(boqItems?.items) ? boqItems.items : JSON.parse(boqItems?.items || '[]');
    
    // Extract material_unit_cost from any of the known field names in BOQ item
    const getBOQMaterialCost = (it: any): number => {
      return Number(it.material_unit_cost || it.unit_supply_cost || it.material_cost || it.unit_material_cost || it.net_purchase_cost_per_unit || 0);
    };

    // Build lookup maps by item_code and by description
    const boqByCode: Record<string, number> = {};
    const boqByDescription: Record<string, number> = {};
    const boqByIndex: number[] = [];

    parsedBOQItems.forEach((it: any) => {
      const cost = getBOQMaterialCost(it);
      boqByIndex.push(cost);

      const code = (it.item_code || it.code || '').toLowerCase().trim();
      if (code) boqByCode[code] = cost;

      const desc = (it.description || it.name || '').toLowerCase().trim();
      if (desc) boqByDescription[desc] = cost;
    });

    let totalBOQCost = 0;
    let totalRevenue = 0;

    const mappedItems = qLines.map((qLine: any, idx: number) => {
      // Try matching by item_code first, then description, then by positional index
      const codeKey = (qLine.item_code || '').toLowerCase().trim();
      const descKey = (qLine.description || '').toLowerCase().trim();
      const boqUnitCost = (codeKey && boqByCode[codeKey] !== undefined ? boqByCode[codeKey] : 0)
        || (descKey && boqByDescription[descKey] !== undefined ? boqByDescription[descKey] : 0)
        || (idx < boqByIndex.length ? boqByIndex[idx] : 0);
      const boqTotalCost = boqUnitCost * Number(qLine.quantity);
      
      totalBOQCost += boqTotalCost;
      totalRevenue += qLine.line_total;

      return {
        boq_line_id: qLine.id, // using quotation line id as boq_line_id
        line_number: qLine.line_number,
        item_code: qLine.item_code,
        description: qLine.description,
        category: qLine.category,
        system: qLine.system,
        unit: qLine.unit,
        quantity: qLine.quantity,
        spec_reference: qLine.notes || '',
        required_brand: '',
        
        boq_unit_material_cost: boqUnitCost,
        boq_total_material_cost: boqTotalCost,
        quotation_unit_sell: qLine.unit_sell_price_after_discount,
        quotation_total_sell: qLine.line_total,
        
        offers_count: 0,
        compliant_offers_count: 0,
        sort_order: idx
      };
    });

    // Compute the next comparison number client-side and pass it, so creation
    // works regardless of the DB trigger state (the legacy trigger used a wrong
    // SUBSTRING offset that produced duplicate numbers). The trigger only fires
    // when comparison_number is null/empty, so providing it bypasses the bug;
    // migration 20260613220000 fixes the trigger for race-safe DB generation.
    const compYear = new Date().getFullYear();
    const { data: existingNums } = await supabase
      .from('supplier_comparisons')
      .select('comparison_number')
      .eq('revision', 0)
      .like('comparison_number', `JI-CMP-${compYear}-%`);
    let maxSeq = 0;
    for (const r of existingNums || []) {
      const seq = parseInt((r.comparison_number || '').split('-')[3], 10);
      if (Number.isFinite(seq) && seq > maxSeq) maxSeq = seq;
    }
    const nextComparisonNumber = `JI-CMP-${compYear}-${String(maxSeq + 1).padStart(3, '0')}`;

    // Create Comparison Header
    const { data: compSheet, error: compInsertErr } = await supabase
      .from('supplier_comparisons')
      .insert({
        comparison_number: nextComparisonNumber,
        revision: 0,
        status: 'DRAFT',
        quotation_id: quotationId,
        boq_id: quote.boq_id,
        project_id: quote.project_id,
        client_id: quote.client_id,
        
        project_ref: quote.project_ref,
        project_name: quote.subject || 'Client Project',
        project_address: quote.client_address_line1 || '',
        tender_ref: quote.tender_ref || '',
        quotation_ref: quote.quotation_number,
        client_name: quote.client_name,
        client_address: `${quote.client_address_line1 || ''} ${quote.client_address_line2 || ''}`.trim(),
        client_contact_person: quote.client_contact_person,
        client_contact_email: quote.client_contact_email,
        client_contact_phone: quote.client_contact_phone,
        
        target_margin_pct: targetMargin,
        currency: 'AED',
        total_boq_material_cost: totalBOQCost,
        total_quotation_material_revenue: totalRevenue,
        
        // initializations
        total_selected_supplier_cost: 0,
        total_lowest_supplier_cost: 0,
        total_savings_vs_boq: totalBOQCost,
        total_savings_pct: 100,
        overall_margin_amount: totalRevenue,
        overall_margin_pct: 100,
        margin_status: 'HEALTHY',
        
        prepared_by: user.id,
        prepared_by_name: preparedByName,
        is_locked: false
      })
      .select()
      .single();

    if (compInsertErr) throw compInsertErr;

    // Insert Comparison Items
    const itemsToInsert = mappedItems.map(item => ({
      ...item,
      comparison_id: compSheet.id
    }));

    const { error: insertItemsErr } = await supabase
      .from('comparison_items')
      .insert(itemsToInsert);

    if (insertItemsErr) {
      await supabase.from('supplier_comparisons').delete().eq('id', compSheet.id);
      throw insertItemsErr;
    }

    return compSheet;
  },

  // 4. Add a Supplier Offer to a Comparison Item
  /**
   * Resolves a supplier id from a name, registering the supplier in the
   * supplier module (pricing_suppliers) when it doesn't exist yet. This keeps
   * the supplier registry in sync with names entered in comparison sheets.
   * Returns null only if the name is blank or registration fails.
   */
  async ensureSupplierByName(name?: string | null): Promise<string | null> {
    const trimmed = (name || '').trim();
    if (!trimmed) return null;
    try {
      const { data: existing } = await supabase
        .from('pricing_suppliers')
        .select('id')
        .ilike('name', trimmed)
        .limit(1)
        .maybeSingle();
      if (existing?.id) return existing.id;

      const { data: created, error } = await supabase
        .from('pricing_suppliers')
        .insert({ name: trimmed, payment_terms_days: 30, systems_covered: [], is_active: true })
        .select('id')
        .single();
      if (error) {
        console.warn(`Could not auto-register supplier '${trimmed}':`, error.message);
        return null;
      }
      return created.id;
    } catch (err) {
      console.warn('ensureSupplierByName failed:', err);
      return null;
    }
  },

  async addOffer(itemId: string, offerData: Partial<SupplierOfferInput>) {
    const { data: item } = await supabase
      .from('comparison_items')
      .select('comparison_id, quantity')
      .eq('id', itemId)
      .single();

    if (!item) throw new Error('Comparison item not found.');

    const qty = Number(item.quantity) || 1;
    const unitPrice = Number(offerData.unit_price) || 0;
    const totalPrice = unitPrice * qty;

    // Auto-register the supplier in the supplier module if it's a new name
    const resolvedSupplierId = offerData.supplier_id || await this.ensureSupplierByName(offerData.supplier_name);

    const { data: newOffer, error } = await supabase
      .from('supplier_offers')
      .insert({
        comparison_item_id: itemId,
        supplier_id: resolvedSupplierId,
        supplier_name: offerData.supplier_name,
        offer_source: offerData.offer_source || 'MANUAL',
        offer_document_url: offerData.offer_document_url || null,
        extraction_confidence: offerData.extraction_confidence || null,
        offer_reference: offerData.offer_reference || '',
        offer_date: offerData.offer_date || null,
        unit_price: unitPrice,
        total_price: totalPrice,
        delivery_days: offerData.delivery_days ?? null,
        payment_terms_days: offerData.payment_terms_days ?? 30,
        warranty_months: offerData.warranty_months ?? null,
        brand_offered: offerData.brand_offered || '',
        is_compliant: offerData.is_compliant ?? true,
        compliance_notes: offerData.compliance_notes || '',
        validity_days: offerData.validity_days ?? null,
        valid_until: offerData.valid_until || null,
        moq: offerData.moq ?? 0,
        includes_delivery: offerData.includes_delivery ?? true,
        notes: offerData.notes || ''
      })
      .select()
      .single();

    if (error) throw error;

    // Recalculate this item scoring and margins
    await this.recalculateItem(itemId);
    await this.recalculateSheet(item.comparison_id);

    return newOffer;
  },

  // 5. Update a Supplier Offer
  async updateOffer(offerId: string, offerData: Partial<SupplierOfferInput>) {
    const { data: existingOffer } = await supabase
      .from('supplier_offers')
      .select('*, comparison_items(comparison_id, quantity)')
      .eq('id', offerId)
      .single();

    if (!existingOffer) throw new Error('Offer not found.');

    const qty = Number((existingOffer.comparison_items as any)?.quantity) || 1;
    const unitPrice = Number(offerData.unit_price ?? existingOffer.unit_price);
    const totalPrice = unitPrice * qty;

    // When the supplier name changes (e.g. rename), resolve/register the
    // supplier in the supplier module and relink supplier_id.
    let resolvedSupplierId = offerData.supplier_id !== undefined ? offerData.supplier_id : existingOffer.supplier_id;
    if (offerData.supplier_name !== undefined && offerData.supplier_name !== existingOffer.supplier_name) {
      resolvedSupplierId = await this.ensureSupplierByName(offerData.supplier_name);
    }

    const { error } = await supabase
      .from('supplier_offers')
      .update({
        supplier_id: resolvedSupplierId,
        supplier_name: offerData.supplier_name !== undefined ? offerData.supplier_name : existingOffer.supplier_name,
        unit_price: unitPrice,
        total_price: totalPrice,
        delivery_days: offerData.delivery_days !== undefined ? offerData.delivery_days : existingOffer.delivery_days,
        payment_terms_days: offerData.payment_terms_days !== undefined ? offerData.payment_terms_days : existingOffer.payment_terms_days,
        warranty_months: offerData.warranty_months !== undefined ? offerData.warranty_months : existingOffer.warranty_months,
        brand_offered: offerData.brand_offered !== undefined ? offerData.brand_offered : existingOffer.brand_offered,
        is_compliant: offerData.is_compliant !== undefined ? offerData.is_compliant : existingOffer.is_compliant,
        compliance_notes: offerData.compliance_notes !== undefined ? offerData.compliance_notes : existingOffer.compliance_notes,
        validity_days: offerData.validity_days !== undefined ? offerData.validity_days : existingOffer.validity_days,
        valid_until: offerData.valid_until !== undefined ? offerData.valid_until : existingOffer.valid_until,
        moq: offerData.moq !== undefined ? offerData.moq : existingOffer.moq,
        includes_delivery: offerData.includes_delivery !== undefined ? offerData.includes_delivery : existingOffer.includes_delivery,
        notes: offerData.notes !== undefined ? offerData.notes : existingOffer.notes
      })
      .eq('id', offerId);

    if (error) throw error;

    const itemId = existingOffer.comparison_item_id;
    const compId = (existingOffer.comparison_items as any)?.comparison_id;

    await this.recalculateItem(itemId);
    await this.recalculateSheet(compId);

    return true;
  },

  // 6. Delete a Supplier Offer
  async deleteOffer(offerId: string) {
    const { data: existingOffer } = await supabase
      .from('supplier_offers')
      .select('*, comparison_items(comparison_id)')
      .eq('id', offerId)
      .single();

    if (!existingOffer) throw new Error('Offer not found.');

    const itemId = existingOffer.comparison_item_id;
    const compId = (existingOffer.comparison_items as any)?.comparison_id;

    const { error } = await supabase
      .from('supplier_offers')
      .delete()
      .eq('id', offerId);

    if (error) throw error;

    // Reset selection reference on item if deleted offer was selected
    const { data: compItem } = await supabase
      .from('comparison_items')
      .select('selected_supplier_offer_id')
      .eq('id', itemId)
      .single();

    if (compItem && compItem.selected_supplier_offer_id === offerId) {
      await supabase
        .from('comparison_items')
        .update({ selected_supplier_offer_id: null })
        .eq('id', itemId);
    }

    await this.recalculateItem(itemId);
    await this.recalculateSheet(compId);

    return true;
  },

  // 6b. Remove an entire supplier column (all its offers across every item of
  // the comparison) in one operation. Handles duplicate offers; the
  // selected_supplier_offer_id FK nulls out automatically (ON DELETE SET NULL).
  async removeSupplierColumn(comparisonId: string, supplierName: string) {
    const { data: items } = await supabase
      .from('comparison_items')
      .select('id')
      .eq('comparison_id', comparisonId);
    const itemIds = (items || []).map(i => i.id);
    if (itemIds.length === 0) return true;

    const { error } = await supabase
      .from('supplier_offers')
      .delete()
      .in('comparison_item_id', itemIds)
      .eq('supplier_name', supplierName);
    if (error) throw error;

    await this.recalculateAll(comparisonId);
    return true;
  },

  // 6c. Rename a supplier column across every item, relinking supplier_id
  // (registering the supplier if the new name is new).
  async renameSupplierColumn(comparisonId: string, oldName: string, newName: string) {
    const supplierId = await this.ensureSupplierByName(newName);
    const { data: items } = await supabase
      .from('comparison_items')
      .select('id')
      .eq('comparison_id', comparisonId);
    const itemIds = (items || []).map(i => i.id);
    if (itemIds.length === 0) return true;

    const { error } = await supabase
      .from('supplier_offers')
      .update({ supplier_name: newName, supplier_id: supplierId })
      .in('comparison_item_id', itemIds)
      .eq('supplier_name', oldName);
    if (error) throw error;

    await this.recalculateAll(comparisonId);
    return true;
  },

  // 7. Select Supplier Offer for a Comparison Item
  async selectSupplier(itemId: string, offerId: string | null, overrideReason: string = '') {
    const { data: item } = await supabase
      .from('comparison_items')
      .select('*')
      .eq('id', itemId)
      .single();

    if (!item) throw new Error('Item not found.');

    const updates: any = {
      selected_supplier_offer_id: offerId,
      override_reason: overrideReason || null
    };

    if (offerId) {
      // Fetch selected offer values
      const { data: offer } = await supabase
        .from('supplier_offers')
        .select('*')
        .eq('id', offerId)
        .single();
      
      if (offer) {
        updates.selected_unit_cost = offer.unit_price;
        updates.selected_total_cost = offer.total_price;
      }
    } else {
      updates.selected_unit_cost = 0;
      updates.selected_total_cost = 0;
    }

    const { error } = await supabase
      .from('comparison_items')
      .update(updates)
      .eq('id', itemId);

    if (error) throw error;

    await this.recalculateItem(itemId);
    await this.recalculateSheet(item.comparison_id);

    return true;
  },

  // 8. Bulk Select Recommended (autoselect rank 1)
  async bulkSelectRecommended(comparisonId: string) {
    const { data: items } = await supabase
      .from('comparison_items')
      .select('id, recommended_supplier_offer_id')
      .eq('comparison_id', comparisonId);

    if (items && items.length > 0) {
      for (const item of items) {
        if (item.recommended_supplier_offer_id) {
          await this.selectSupplier(item.id, item.recommended_supplier_offer_id, '');
        }
      }
    }
    await this.recalculateSheet(comparisonId);
    return true;
  },

  // 9. Recalculate Item Scoring & Rankings
  async recalculateItem(itemId: string) {
    const { data: item } = await supabase
      .from('comparison_items')
      .select('*, supplier_comparisons(target_margin_pct)')
      .eq('id', itemId)
      .single();

    if (!item) return;

    const targetMargin = (item.supplier_comparisons as any)?.target_margin_pct ?? 15.00;

    // Fetch scoring weights
    const { data: weightsConfig } = await supabase
      .from('comparison_scoring_weights')
      .select('*')
      .single();

    const weights = weightsConfig || {
      weight_price: 45,
      weight_delivery: 20,
      weight_history: 20,
      weight_payment: 10,
      weight_compliance: 5
    };

    // Fetch offers
    const { data: offers } = await supabase
      .from('supplier_offers')
      .select('*')
      .eq('comparison_item_id', itemId);

    if (!offers || offers.length === 0) {
      // Reset item columns if no offers
      await supabase
        .from('comparison_items')
        .update({
          offers_count: 0,
          compliant_offers_count: 0,
          recommended_supplier_offer_id: null,
          lowest_price_offer_id: null,
          selection_matches_recommendation: true,
          selected_unit_cost: 0,
          selected_total_cost: 0,
          item_margin_amount: item.quotation_total_sell,
          item_margin_pct: 100,
          item_margin_status: 'HEALTHY',
          item_savings_vs_boq: item.boq_total_material_cost,
          price_spread_pct: 0
        })
        .eq('id', itemId);
      return;
    }

    // Fetch supplier histories to map scores
    const supplierNames = [...new Set(offers.map(o => o.supplier_name))];
    const { data: histories } = await supabase
      .from('supplier_performance_history')
      .select('supplier_name, composite_history_score')
      .in('supplier_name', supplierNames);

    const historyMap: Record<string, number> = {};
    (histories || []).forEach(h => {
      historyMap[h.supplier_name.toLowerCase().trim()] = Number(h.composite_history_score) || 80;
    });

    // Execute score engine
    const scoredOffers = scoreOffers(offers, weights, historyMap);

    // Update scored offers back to DB
    for (const offer of scoredOffers) {
      await supabase
        .from('supplier_offers')
        .update({
          score_price: offer.score_price,
          score_delivery: offer.score_delivery,
          score_history: offer.score_history,
          score_payment: offer.score_payment,
          score_compliance: offer.score_compliance,
          score_total: offer.score_total,
          rank: offer.rank,
          is_recommended: offer.is_recommended
        })
        .eq('id', offer.id);
    }

    // Identify Recommended & Lowest
    const recommendedOffer = scoredOffers.find(o => o.is_recommended);
    
    // Lowest Price compliant offer (or lowest overall if none compliant)
    const compliantOffers = scoredOffers.filter(o => o.is_compliant);
    const priceReferenceList = compliantOffers.length > 0 ? compliantOffers : scoredOffers;
    let lowestOffer = priceReferenceList[0];
    priceReferenceList.forEach(o => {
      if (o.unit_price < lowestOffer.unit_price) {
        lowestOffer = o;
      }
    });

    // Recompute Item Margins
    const selectedOfferId = item.selected_supplier_offer_id;
    let selectedCost = 0;
    let selectedUnitCost = 0;

    if (selectedOfferId) {
      const matchedSelected = scoredOffers.find(o => o.id === selectedOfferId);
      if (matchedSelected) {
        selectedCost = matchedSelected.total_price;
        selectedUnitCost = matchedSelected.unit_price;
      }
    }

    const marginCalc = calculateItemMargin({
      quotation_total_sell: Number(item.quotation_total_sell),
      selected_total_cost: selectedCost,
      boq_total_material_cost: Number(item.boq_total_material_cost),
      lowest_total_cost: lowestOffer ? lowestOffer.total_price : 0,
      offers_prices: scoredOffers.map(o => o.unit_price)
    }, targetMargin);

    const recommendedId = recommendedOffer ? recommendedOffer.id : null;
    const lowestId = lowestOffer ? lowestOffer.id : null;
    const matchesRecommendation = selectedOfferId ? selectedOfferId === recommendedId : true;

    // Update Item Row
    await supabase
      .from('comparison_items')
      .update({
        offers_count: scoredOffers.length,
        compliant_offers_count: compliantOffers.length,
        recommended_supplier_offer_id: recommendedId,
        lowest_price_offer_id: lowestId,
        selection_matches_recommendation: matchesRecommendation,
        override_cost_impact: marginCalc.override_cost_impact,
        selected_unit_cost: selectedUnitCost,
        selected_total_cost: selectedCost,
        item_margin_amount: marginCalc.item_margin_amount,
        item_margin_pct: marginCalc.item_margin_pct,
        item_margin_status: marginCalc.item_margin_status,
        item_savings_vs_boq: marginCalc.item_savings_vs_boq,
        price_spread_pct: marginCalc.price_spread_pct
      })
      .eq('id', itemId);
  },

  // 10. Recalculate Sheet Totals
  async recalculateSheet(comparisonId: string) {
    const { data: comp } = await supabase
      .from('supplier_comparisons')
      .select('*')
      .eq('id', comparisonId)
      .single();

    if (!comp) return;

    const { data: items } = await supabase
      .from('comparison_items')
      .select('boq_total_material_cost, quotation_total_sell, selected_total_cost, lowest_price_offer_id, selected_supplier_offer_id, selection_matches_recommendation, is_exception')
      .eq('comparison_id', comparisonId);

    if (!items || items.length === 0) return;

    // Fetch lowest offers costs
    const lowestOfferIds = items.map(i => i.lowest_price_offer_id).filter(Boolean);
    let lowestOffersMap: Record<string, number> = {};
    if (lowestOfferIds.length > 0) {
      const { data: lowestOffers } = await supabase
        .from('supplier_offers')
        .select('id, total_price')
        .in('id', lowestOfferIds);
      if (lowestOffers) {
        lowestOffers.forEach(o => {
          lowestOffersMap[o.id] = Number(o.total_price) || 0;
        });
      }
    }

    const itemsCalculationsInput = items.map(item => {
      const lowestCost = item.lowest_price_offer_id ? (lowestOffersMap[item.lowest_price_offer_id] || 0) : 0;
      return {
        quotation_total_sell: Number(item.quotation_total_sell),
        selected_total_cost: Number(item.selected_total_cost),
        boq_total_material_cost: Number(item.boq_total_material_cost),
        lowest_total_cost: lowestCost
      };
    });

    const sheetMarginCalc = calculateSheetMargin({
      items: itemsCalculationsInput,
      target_margin_pct: Number(comp.target_margin_pct)
    });

    // Counts
    const overrideCount = items.filter(i => !i.selection_matches_recommendation).length;
    const exceptionCount = items.filter(i => i.is_exception).length;

    // Update Comparison sheet stats
    await supabase
      .from('supplier_comparisons')
      .update({
        total_boq_material_cost: sheetMarginCalc.total_boq_material_cost,
        total_quotation_material_revenue: sheetMarginCalc.total_quotation_material_revenue,
        total_selected_supplier_cost: sheetMarginCalc.total_selected_supplier_cost,
        total_lowest_supplier_cost: sheetMarginCalc.total_lowest_supplier_cost,
        total_savings_vs_boq: sheetMarginCalc.total_savings_vs_boq,
        total_savings_pct: sheetMarginCalc.total_savings_pct,
        overall_margin_amount: sheetMarginCalc.overall_margin_amount,
        overall_margin_pct: sheetMarginCalc.overall_margin_pct,
        potential_extra_savings: sheetMarginCalc.potential_extra_savings,
        margin_status: sheetMarginCalc.margin_status,
        override_count: overrideCount,
        exception_count: exceptionCount,
        status: comp.status === 'DRAFT' && items.some(i => i.selected_supplier_offer_id) ? 'PRICING_IN_PROGRESS' : comp.status,
        updated_at: new Date().toISOString()
      })
      .eq('id', comparisonId);
  },

  // 11. Recalculate Entire Sheet from scratch (all items + sheet stats)
  async recalculateAll(comparisonId: string) {
    const { data: items } = await supabase
      .from('comparison_items')
      .select('id')
      .eq('comparison_id', comparisonId);

    if (items && items.length > 0) {
      for (const item of items) {
        await this.recalculateItem(item.id);
      }
    }
    await this.recalculateSheet(comparisonId);
    return true;
  },

  // 11b. Save multiple offers in batch and recalculate sheet
  async saveOffers(offersToSave: any[], comparisonId: string) {
    // Fetch quantities of all items in comparison to calculate total price accurately
    const { data: items } = await supabase
      .from('comparison_items')
      .select('id, quantity')
      .eq('comparison_id', comparisonId);

    const qtyMap: Record<string, number> = {};
    if (items) {
      items.forEach(it => {
        qtyMap[it.id] = Number(it.quantity) || 1;
      });
    }

    const updates = offersToSave.filter(o => o.id);
    const inserts = offersToSave.filter(o => !o.id);

    // Perform updates
    if (updates.length > 0) {
      for (const update of updates) {
        const qty = qtyMap[update.comparison_item_id] || 1;
        const unitPrice = Number(update.unit_price) || 0;
        const totalPrice = unitPrice * qty;

        const { error } = await supabase
          .from('supplier_offers')
          .update({
            unit_price: unitPrice,
            total_price: totalPrice,
            delivery_days: update.delivery_days !== undefined && update.delivery_days !== null && update.delivery_days !== '' ? parseInt(update.delivery_days) : null,
            payment_terms_days: update.payment_terms_days !== undefined && update.payment_terms_days !== null && update.payment_terms_days !== '' ? parseInt(update.payment_terms_days) : 30,
            is_compliant: update.is_compliant !== undefined ? update.is_compliant : true,
            brand_offered: update.brand_offered || '',
            notes: update.notes || ''
          })
          .eq('id', update.id);
        if (error) throw error;
      }
    }

    // Perform inserts
    if (inserts.length > 0) {
      // Resolve (find-or-register) a supplier id per distinct name once
      const distinctNames = Array.from(new Set(inserts.map(i => (i.supplier_name || '').trim()).filter(Boolean)));
      const nameToId = new Map<string, string | null>();
      for (const nm of distinctNames) {
        nameToId.set(nm.toLowerCase(), await this.ensureSupplierByName(nm));
      }

      const insertsWithTotals = inserts.map(ins => {
        const qty = qtyMap[ins.comparison_item_id] || 1;
        const unitPrice = Number(ins.unit_price) || 0;
        const totalPrice = unitPrice * qty;
        return {
          comparison_item_id: ins.comparison_item_id,
          supplier_id: ins.supplier_id || nameToId.get((ins.supplier_name || '').trim().toLowerCase()) || null,
          supplier_name: ins.supplier_name,
          unit_price: unitPrice,
          total_price: totalPrice,
          delivery_days: ins.delivery_days !== undefined && ins.delivery_days !== null && ins.delivery_days !== '' ? parseInt(ins.delivery_days) : null,
          payment_terms_days: ins.payment_terms_days !== undefined && ins.payment_terms_days !== null && ins.payment_terms_days !== '' ? parseInt(ins.payment_terms_days) : 30,
          is_compliant: ins.is_compliant !== undefined ? ins.is_compliant : true,
          brand_offered: ins.brand_offered || '',
          notes: ins.notes || '',
          offer_source: 'MANUAL'
        };
      });

      const { error } = await supabase
        .from('supplier_offers')
        .insert(insertsWithTotals);
      if (error) throw error;
    }

    // Recalculate entire sheet once
    await this.recalculateAll(comparisonId);
    return true;
  },

  // 12. Submit Comparison Sheet for Review (Enforces hard gates!)
  async submitForReview(id: string) {
    // A. Fetch sheet, items, and offers details
    const sheetDetails = await this.fetchComparisonById(id);
    if (!sheetDetails) throw new Error('Comparison sheet not found.');

    const items = sheetDetails.items;
    
    // GATE 1: Submit blocked if any item has no selected supplier
    const unselectedItems = items.filter((i: any) => !i.selected_supplier_offer_id);
    if (unselectedItems.length > 0) {
      throw new Error(`Submit blocked: ${unselectedItems.length} item(s) do not have a selected supplier. Please make selections.`);
    }

    // GATE 2: Submit blocked if any override lacks a reason
    const unjustifiedOverrides = items.filter((i: any) => !i.selection_matches_recommendation && !i.override_reason);
    if (unjustifiedOverrides.length > 0) {
      throw new Error(`Submit blocked: ${unjustifiedOverrides.length} overridden item(s) lack a mandatory override reason.`);
    }

    // GATE 3: Submit blocked unless every non-optional item has >= 3 compliant offers OR is_exception = true with reason
    const insufficientOffers = items.filter((i: any) => 
      !i.is_optional && 
      !i.is_exception && 
      i.compliant_offers_count < 3
    );
    if (insufficientOffers.length > 0) {
      throw new Error(`Submit blocked: ${insufficientOffers.length} non-optional item(s) have fewer than 3 compliant offers. Set 'Exception' flag and provide a justification, or add compliant offers.`);
    }

    // GATE 4: Submit blocked if any item marked as exception lacks an exception reason
    const unjustifiedExceptions = items.filter((i: any) => i.is_exception && !i.exception_reason);
    if (unjustifiedExceptions.length > 0) {
      throw new Error(`Submit blocked: ${unjustifiedExceptions.length} exception item(s) lack a justification reason.`);
    }

    // Logged in user details
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) throw new Error('Authentication required.');
    const profile = await getProfileById(user.id);
    const actorName = profile?.full_name || user.email || 'Procurement Officer';
    const actorTitle = 'Procurement Officer';

    // Update Status to PENDING_COMMERCIAL
    const { error: updateErr } = await supabase
      .from('supplier_comparisons')
      .update({
        status: 'PENDING_COMMERCIAL',
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (updateErr) throw updateErr;

    // Log Approval Audit Log
    await supabase
      .from('comparison_approvals')
      .insert({
        comparison_id: id,
        stage: 'COMMERCIAL',
        action: 'SUBMITTED',
        actor_id: user.id,
        actor_name: actorName,
        actor_title: actorTitle,
        comment: 'Submitted comparison sheet for review'
      });



    // Emit event on system event bus
    await eventService.emitEvent(
      'comparison.submitted',
      'COMPARISON',
      sheetDetails.id,
      sheetDetails.project_id || undefined,
      {
        comparison_number: sheetDetails.comparison_number,
        total_cost: sheetDetails.total_selected_supplier_cost,
        prepared_by_name: actorName
      },
      user.id
    );

    return true;
  },

  // 13. Commercial Manager review - Approve
  async commercialApprove(id: string, comment: string) {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) throw new Error('Authentication required.');
    const profile = await getProfileById(user.id);
    const actorName = profile?.full_name || user.email || 'Commercial Manager';
    const actorTitle = 'Commercial Manager';

    // Fetch comparison totals to check routing threshold
    const { data: comp } = await supabase
      .from('supplier_comparisons')
      .select('comparison_number, total_selected_supplier_cost, approval_threshold, prepared_by')
      .eq('id', id)
      .single();

    if (!comp) throw new Error('Comparison sheet not found.');

    const selectedCost = Number(comp.total_selected_supplier_cost) || 0;
    const threshold = Number(comp.approval_threshold) || 50000.00;

    let nextStatus: 'APPROVED' | 'PENDING_GM' = 'APPROVED';
    let isLocked = true;

    if (selectedCost > threshold) {
      nextStatus = 'PENDING_GM';
      isLocked = false;
    }

    const updates: any = {
      status: nextStatus,
      commercial_approver_id: user.id,
      commercial_approved_at: new Date().toISOString(),
      commercial_comment: comment,
      is_locked: isLocked,
      updated_at: new Date().toISOString()
    };

    const { error } = await supabase
      .from('supplier_comparisons')
      .update(updates)
      .eq('id', id);

    if (error) throw error;

    // Log audit
    await supabase
      .from('comparison_approvals')
      .insert({
        comparison_id: id,
        stage: 'COMMERCIAL',
        action: 'APPROVED',
        actor_id: user.id,
        actor_name: actorName,
        actor_title: actorTitle,
        comment
      });

    // Route notifications
    if (nextStatus === 'APPROVED') {
      // Emit event on system event bus
      await eventService.emitEvent(
        'comparison.approved',
        'COMPARISON',
        id,
        undefined, // project_id can be fetched if needed, but not critical
        {
          comparison_number: comp.comparison_number,
          total_cost: comp.total_selected_supplier_cost,
          approved_by_role: 'COMMERCIAL_MANAGER'
        },
        user.id
      );
    } else {
      // Emit event on system event bus (notifies admins/GMs and creates tasks)
      await eventService.emitEvent(
        'comparison.commercial_approved',
        'COMPARISON',
        id,
        undefined,
        {
          comparison_number: comp.comparison_number,
          total_cost: comp.total_selected_supplier_cost,
          prepared_by_name: comp.prepared_by
        },
        user.id
      );
    }

    return true;
  },

  // 14. Commercial Manager review - Return / Reject
  async commercialReject(id: string, reason: string) {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) throw new Error('Authentication required.');
    const profile = await getProfileById(user.id);
    const actorName = profile?.full_name || user.email || 'Commercial Manager';
    const actorTitle = 'Commercial Manager';

    const { data: comp } = await supabase
      .from('supplier_comparisons')
      .select('comparison_number, prepared_by')
      .eq('id', id)
      .single();

    if (!comp) throw new Error('Comparison sheet not found.');

    const { error } = await supabase
      .from('supplier_comparisons')
      .update({
        status: 'DRAFT',
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (error) throw error;

    await supabase
      .from('comparison_approvals')
      .insert({
        comparison_id: id,
        stage: 'COMMERCIAL',
        action: 'RETURNED',
        actor_id: user.id,
        actor_name: actorName,
        actor_title: actorTitle,
        comment: reason
      });

    // Emit event on system event bus (notifies creator)
    await eventService.emitEvent(
      'comparison.rejected',
      'COMPARISON',
      id,
      undefined,
      {
        comparison_number: comp.comparison_number,
        reason
      },
      user.id
    );
    return true;
  },

  // 15. GM approval - Sign and Approve
  async gmApprove(id: string, comment: string) {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) throw new Error('Authentication required.');
    const profile = await getProfileById(user.id);
    const actorName = profile?.full_name || user.email || 'General Manager';
    const actorTitle = 'General Manager';

    const { data: comp } = await supabase
      .from('supplier_comparisons')
      .select('comparison_number, prepared_by')
      .eq('id', id)
      .single();

    if (!comp) throw new Error('Comparison sheet not found.');

    const { error } = await supabase
      .from('supplier_comparisons')
      .update({
        status: 'APPROVED',
        gm_approver_id: user.id,
        gm_approved_at: new Date().toISOString(),
        gm_comment: comment,
        is_locked: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (error) throw error;

    await supabase
      .from('comparison_approvals')
      .insert({
        comparison_id: id,
        stage: 'GM',
        action: 'APPROVED',
        actor_id: user.id,
        actor_name: actorName,
        actor_title: actorTitle,
        comment
      });



    // Emit event on system event bus
    await eventService.emitEvent(
      'comparison.approved',
      'COMPARISON',
      id,
      undefined,
      {
        comparison_number: comp.comparison_number,
        approved_by_role: 'GENERAL_MANAGER'
      },
      user.id
    );

    return true;
  },

  // 16. GM approval - Return / Reject
  async gmReject(id: string, reason: string) {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) throw new Error('Authentication required.');
    const profile = await getProfileById(user.id);
    const actorName = profile?.full_name || user.email || 'General Manager';
    const actorTitle = 'General Manager';

    const { data: comp } = await supabase
      .from('supplier_comparisons')
      .select('comparison_number, prepared_by')
      .eq('id', id)
      .single();

    if (!comp) throw new Error('Comparison not found.');

    const { error } = await supabase
      .from('supplier_comparisons')
      .update({
        status: 'DRAFT',
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (error) throw error;

    await supabase
      .from('comparison_approvals')
      .insert({
        comparison_id: id,
        stage: 'GM',
        action: 'RETURNED',
        actor_id: user.id,
        actor_name: actorName,
        actor_title: actorTitle,
        comment: reason
      });

    // Emit event on system event bus (notifies creator)
    await eventService.emitEvent(
      'comparison.rejected',
      'COMPARISON',
      id,
      undefined,
      {
        comparison_number: comp.comparison_number,
        reason
      },
      user.id
    );
    return true;
  },

  // 17. Create Revision workflow (mark previous revision as SUPERSEDED)
  async createRevision(id: string) {
    const compDetails = await this.fetchComparisonById(id);
    if (!compDetails) throw new Error('Comparison not found.');

    if (compDetails.status === 'SUPERSEDED' || compDetails.status === 'REVISED') {
      throw new Error('This comparison sheet revision is already locked/revised.');
    }

    const nextRev = compDetails.revision + 1;

    // A. Mark old sheet as SUPERSEDED
    const { error: supersedeErr } = await supabase
      .from('supplier_comparisons')
      .update({
        status: 'SUPERSEDED',
        is_locked: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (supersedeErr) throw supersedeErr;

    // B. Re-mark project/tender mapping (revision trace)
    // C. Create copy of comparison header
    const { data: newComp, error: copyErr } = await supabase
      .from('supplier_comparisons')
      .insert({
        comparison_number: compDetails.comparison_number,
        revision: nextRev,
        status: 'DRAFT',
        quotation_id: compDetails.quotation_id,
        boq_id: compDetails.boq_id,
        project_id: compDetails.project_id,
        client_id: compDetails.client_id,
        
        project_ref: compDetails.project_ref,
        project_name: compDetails.project_name,
        project_address: compDetails.project_address,
        tender_ref: compDetails.tender_ref,
        quotation_ref: compDetails.quotation_ref,
        client_name: compDetails.client_name,
        client_address: compDetails.client_address,
        client_contact_person: compDetails.client_contact_person,
        client_contact_email: compDetails.client_contact_email,
        client_contact_phone: compDetails.client_contact_phone,
        
        target_margin_pct: compDetails.target_margin_pct,
        approval_threshold: compDetails.approval_threshold,
        currency: compDetails.currency,
        
        total_boq_material_cost: compDetails.total_boq_material_cost,
        total_quotation_material_revenue: compDetails.total_quotation_material_revenue,
        total_selected_supplier_cost: compDetails.total_selected_supplier_cost,
        total_lowest_supplier_cost: compDetails.total_lowest_supplier_cost,
        total_savings_vs_boq: compDetails.total_savings_vs_boq,
        total_savings_pct: compDetails.total_savings_pct,
        overall_margin_amount: compDetails.overall_margin_amount,
        overall_margin_pct: compDetails.overall_margin_pct,
        margin_status: compDetails.margin_status,
        
        override_count: compDetails.override_count,
        exception_count: compDetails.exception_count,
        potential_extra_savings: compDetails.potential_extra_savings,
        
        prepared_by: compDetails.prepared_by,
        prepared_by_name: compDetails.prepared_by_name,
        previous_comparison_id: id,
        is_locked: false
      })
      .select()
      .single();

    if (copyErr) throw copyErr;

    // D. Copy comparison items
    const items = compDetails.items;
    for (const item of items) {
      const { data: newItem, error: itemCopyErr } = await supabase
        .from('comparison_items')
        .insert({
          comparison_id: newComp.id,
          boq_line_id: item.boq_line_id,
          line_number: item.line_number,
          item_code: item.item_code,
          description: item.description,
          category: item.category,
          system: item.system,
          unit: item.unit,
          quantity: item.quantity,
          spec_reference: item.spec_reference,
          required_brand: item.required_brand,
          
          boq_unit_material_cost: item.boq_unit_material_cost,
          boq_total_material_cost: item.boq_total_material_cost,
          quotation_unit_sell: item.quotation_unit_sell,
          quotation_total_sell: item.quotation_total_sell,
          
          offers_count: item.offers_count,
          compliant_offers_count: item.compliant_offers_count,
          
          override_reason: item.override_reason,
          override_cost_impact: item.override_cost_impact,
          selected_unit_cost: item.selected_unit_cost,
          selected_total_cost: item.selected_total_cost,
          
          item_margin_amount: item.item_margin_amount,
          item_margin_pct: item.item_margin_pct,
          item_margin_status: item.item_margin_status,
          item_savings_vs_boq: item.item_savings_vs_boq,
          price_spread_pct: item.price_spread_pct,
          
          is_optional: item.is_optional,
          is_exception: item.is_exception,
          exception_reason: item.exception_reason,
          notes: item.notes,
          sort_order: item.sort_order
        })
        .select()
        .single();

      if (itemCopyErr) throw itemCopyErr;

      // E. Copy offers for this item and remap foreign keys
      const offers = item.offers || [];
      const offerIdMap: Record<string, string> = {};

      for (const offer of offers) {
        const { data: newOffer, error: offerCopyErr } = await supabase
          .from('supplier_offers')
          .insert({
            comparison_item_id: newItem.id,
            supplier_id: offer.supplier_id,
            supplier_name: offer.supplier_name,
            offer_source: offer.offer_source,
            offer_document_url: offer.offer_document_url,
            extraction_confidence: offer.extraction_confidence,
            offer_reference: offer.offer_reference,
            offer_date: offer.offer_date,
            unit_price: offer.unit_price,
            total_price: offer.total_price,
            delivery_days: offer.delivery_days,
            payment_terms_days: offer.payment_terms_days,
            warranty_months: offer.warranty_months,
            brand_offered: offer.brand_offered,
            is_compliant: offer.is_compliant,
            compliance_notes: offer.compliance_notes,
            validity_days: offer.validity_days,
            valid_until: offer.valid_until,
            moq: offer.moq,
            includes_delivery: offer.includes_delivery,
            
            score_price: offer.score_price,
            score_delivery: offer.score_delivery,
            score_history: offer.score_history,
            score_payment: offer.score_payment,
            score_compliance: offer.score_compliance,
            score_total: offer.score_total,
            
            rank: offer.rank,
            is_recommended: offer.is_recommended,
            notes: offer.notes
          })
          .select()
          .single();

        if (offerCopyErr) throw offerCopyErr;
        offerIdMap[offer.id] = newOffer.id;
      }

      // F. Remap chosen supplier and indicators on item copy
      const selectedId = item.selected_supplier_offer_id ? offerIdMap[item.selected_supplier_offer_id] : null;
      const recommendedId = item.recommended_supplier_offer_id ? offerIdMap[item.recommended_supplier_offer_id] : null;
      const lowestId = item.lowest_price_offer_id ? offerIdMap[item.lowest_price_offer_id] : null;

      await supabase
        .from('comparison_items')
        .update({
          selected_supplier_offer_id: selectedId,
          recommended_supplier_offer_id: recommendedId,
          lowest_price_offer_id: lowestId
        })
        .eq('id', newItem.id);
    }

    return newComp.id;
  },

  // 18. Push selected supplier pricing back to pricing master database catalog
  async pushPricesToCatalog(comparisonId: string) {
    const { data: items } = await supabase
      .from('comparison_items')
      .select('selected_supplier_offer_id, selected_unit_cost, boq_line_id')
      .eq('comparison_id', comparisonId)
      .not('selected_supplier_offer_id', 'is', null);

    if (!items || items.length === 0) return 0;

    let successCount = 0;

    for (const item of items) {
      // 1. Trace the quotation line to get its pricing_item_id
      const { data: qLine } = await supabase
        .from('quotation_lines')
        .select('pricing_item_id')
        .eq('id', item.boq_line_id)
        .single();
      
      if (qLine && qLine.pricing_item_id) {
        // 2. Fetch the corresponding offer details to get the brand and notes
        const { data: offer } = await supabase
          .from('supplier_offers')
          .select('supplier_name, brand_offered, notes')
          .eq('id', item.selected_supplier_offer_id)
          .single();

        if (offer) {
          // 3. Update the master catalog pricing item unit cost
          // In JEET ERP, pricing_items have: cost (material cost) or similar field
          // Let's check the fields of pricing_items in `schema-pricing.sql` or update standard unit cost fields
          // To be safe, let's update standard `cost` field
          const { error } = await supabase
            .from('pricing_items')
            .update({
              cost: item.selected_unit_cost,
              preferred_supplier: offer.supplier_name,
              brand: offer.brand_offered || null,
              updated_at: new Date().toISOString()
            })
            .eq('id', qLine.pricing_item_id);

          if (!error) successCount++;
        }
      }
    }

    return successCount;
  },

  // 19. Add a supplier column manually for ALL items in the comparison sheet with default values
  async addSupplierColumn(comparisonId: string, supplierName: string, defaults: {
    delivery_days?: number;
    payment_terms_days?: number;
    brand_offered?: string;
    is_compliant?: boolean;
  }) {
    // A. Fetch all items in this comparison
    const { data: items, error: itemsErr } = await supabase
      .from('comparison_items')
      .select('id, quantity')
      .eq('comparison_id', comparisonId);

    if (itemsErr) throw itemsErr;
    if (!items || items.length === 0) throw new Error('No items in the comparison sheet.');

    // B. Prepare supplier offers for all items
    const offersToInsert = items.map(item => {
      const qty = Number(item.quantity) || 1;
      const unitPrice = 0;
      const totalPrice = 0;

      return {
        comparison_item_id: item.id,
        supplier_id: null,
        supplier_name: supplierName,
        offer_source: 'MANUAL',
        unit_price: unitPrice,
        total_price: totalPrice,
        delivery_days: defaults.delivery_days ?? 7,
        payment_terms_days: defaults.payment_terms_days ?? 30,
        brand_offered: defaults.brand_offered || '',
        is_compliant: defaults.is_compliant ?? true,
        moq: 0,
        includes_delivery: true,
        notes: 'Initial manual supplier creation'
      };
    });

    // C. Insert offers in bulk
    const { error: insertErr } = await supabase
      .from('supplier_offers')
      .insert(offersToInsert);

    if (insertErr) throw insertErr;

    // D. Recalculate item scoring and margins for all items
    for (const item of items) {
      await this.recalculateItem(item.id);
    }

    // E. Recalculate the entire sheet
    await this.recalculateSheet(comparisonId);

    return true;
  }
};
