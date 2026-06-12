// ============================================================
// JEET ERP — PO & GRN Sequence Number Service
// Consumes admin-configured numbering rules (numbering_rules
// table) when available; falls back to the legacy per-module
// sequence tables otherwise.
// ============================================================

import { supabase } from '@/lib/supabase';
import numberingService, { previewNumber } from '@/services/numberingService';

async function legacyPreview(table: string, prefix: string): Promise<string> {
  const currentYear = new Date().getFullYear();
  const { data, error } = await supabase
    .from(table)
    .select('last_number')
    .eq('year', currentYear)
    .maybeSingle();
  if (error) throw error;
  const nextNum = (data?.last_number || 0) + 1;
  return `${prefix}-${currentYear}-${String(nextNum).padStart(3, '0')}`;
}

export const poNumberService = {
  /**
   * Generates a preview of the next PO number.
   * Prefers the admin-configured numbering rule; falls back to
   * the legacy po_number_sequences table.
   */
  async getNextPOPreview(): Promise<string> {
    try {
      const rule = await numberingService.getRule('PO');
      if (rule && rule.is_active) return previewNumber(rule);
    } catch {
      // numbering_rules not available — fall through to legacy
    }
    try {
      return await legacyPreview('po_number_sequences', 'JI-PO');
    } catch (error) {
      console.error('Error fetching next PO number preview:', error);
      return `JI-PO-${new Date().getFullYear()}-XXX`;
    }
  },

  /**
   * Generates a preview of the next GRN number.
   * Prefers the admin-configured numbering rule; falls back to
   * the legacy grn_number_sequences table.
   */
  async getNextGRNPreview(): Promise<string> {
    try {
      const rule = await numberingService.getRule('GRN');
      if (rule && rule.is_active) return previewNumber(rule);
    } catch {
      // numbering_rules not available — fall through to legacy
    }
    try {
      return await legacyPreview('grn_number_sequences', 'JI-GRN');
    } catch (error) {
      console.error('Error fetching next GRN number preview:', error);
      return `JI-GRN-${new Date().getFullYear()}-XXX`;
    }
  },
};

export default poNumberService;
