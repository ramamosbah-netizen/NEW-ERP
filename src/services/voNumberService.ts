// ============================================================
// JEET ERP — Variation Order (VO) Number Sequence Service
// Location: src/services/voNumberService.ts
// Previews sequences before database trigger assignment.
// ============================================================

import { supabase } from '@/lib/supabase';

export const voNumberService = {
  /**
   * Previews the next global Variation Order number.
   * Format: JI-VO-YYYY-NNN
   */
  async getNextVOPreview(): Promise<string> {
    try {
      const currentYear = new Date().getFullYear();
      const { data, error } = await supabase
        .from('vo_number_sequences')
        .select('last_number')
        .eq('year', currentYear)
        .maybeSingle();

      if (error) throw error;
      
      const nextNum = (data?.last_number || 0) + 1;
      return `JI-VO-${currentYear}-${String(nextNum).padStart(3, '0')}`;
    } catch (error) {
      console.error('Error fetching next VO number preview:', error);
      const fallbackYear = new Date().getFullYear();
      return `JI-VO-${fallbackYear}-XXX`;
    }
  },

  /**
   * Previews the next project display sequence number.
   * Format: VO-NN
   */
  async getNextProjectVOSequencePreview(projectId: string): Promise<string> {
    if (!projectId) return 'VO-XX';
    try {
      const { data, error } = await supabase
        .from('variation_orders')
        .select('project_vo_sequence')
        .eq('project_id', projectId)
        .order('project_vo_sequence', { ascending: false })
        .limit(1);

      if (error) throw error;
      
      const nextSeq = (data && data.length > 0 ? data[0].project_vo_sequence : 0) + 1;
      return `VO-${String(nextSeq).padStart(2, '0')}`;
    } catch (error) {
      console.error('Error fetching next project VO sequence preview:', error);
      return 'VO-XX';
    }
  }
};

export default voNumberService;
