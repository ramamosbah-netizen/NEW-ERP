// ============================================================
// JEET ERP — PO & GRN Sequence Number Service
// ============================================================

import { supabase } from '@/lib/supabase';

export const poNumberService = {
  /**
   * Generates a preview of the next PO number.
   * Note: The actual PO number is assigned race-safely via DB insert triggers.
   */
  async getNextPOPreview(): Promise<string> {
    try {
      const currentYear = new Date().getFullYear();
      const { data, error } = await supabase
        .from('po_number_sequences')
        .select('last_number')
        .eq('year', currentYear)
        .maybeSingle();

      if (error) throw error;
      
      const nextNum = (data?.last_number || 0) + 1;
      return `JI-PO-${currentYear}-${String(nextNum).padStart(3, '0')}`;
    } catch (error) {
      console.error('Error fetching next PO number preview:', error);
      const fallbackYear = new Date().getFullYear();
      return `JI-PO-${fallbackYear}-XXX`;
    }
  },

  /**
   * Generates a preview of the next GRN number.
   * Note: The actual GRN number is assigned race-safely via DB insert triggers.
   */
  async getNextGRNPreview(): Promise<string> {
    try {
      const currentYear = new Date().getFullYear();
      const { data, error } = await supabase
        .from('grn_number_sequences')
        .select('last_number')
        .eq('year', currentYear)
        .maybeSingle();

      if (error) throw error;
      
      const nextNum = (data?.last_number || 0) + 1;
      return `JI-GRN-${currentYear}-${String(nextNum).padStart(3, '0')}`;
    } catch (error) {
      console.error('Error fetching next GRN number preview:', error);
      const fallbackYear = new Date().getFullYear();
      return `JI-GRN-${fallbackYear}-XXX`;
    }
  }
};

export default poNumberService;
