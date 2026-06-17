// ============================================================
// JEET ERP — Dynamic Numbering Service
// Configurable document numbering per module. Generation is
// atomic via the generate_document_number RPC (see migration).
// ============================================================

import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';
import { recordAudit } from '@/lib/audit/recordAudit';
import type { NumberingRule, ResetPeriod } from '@/types/platform.types';

export function previewNumber(rule: Pick<NumberingRule, 'prefix' | 'separator' | 'include_year' | 'include_month' | 'padding' | 'next_sequence'>): string {
  const parts: string[] = [];
  if (rule.prefix) parts.push(rule.prefix);
  if (rule.include_year) parts.push(String(new Date().getFullYear()));
  if (rule.include_month) parts.push(String(new Date().getMonth() + 1).padStart(2, '0'));
  parts.push(String(rule.next_sequence ?? 1).padStart(Math.max(rule.padding || 1, 1), '0'));
  return parts.join(rule.separator || '-');
}

export const numberingService = {
  async getRules(): Promise<NumberingRule[]> {
    const { data, error } = await supabase
      .from('numbering_rules')
      .select('*')
      .order('module_key');
    if (error) throw error;
    return data as NumberingRule[];
  },

  async getRule(moduleKey: string): Promise<NumberingRule | null> {
    const { data, error } = await supabase
      .from('numbering_rules')
      .select('*')
      .eq('module_key', moduleKey)
      .maybeSingle();
    if (error) throw error;
    return data as NumberingRule | null;
  },

  async upsertRule(rule: {
    id?: string;
    module_key: string;
    prefix: string;
    separator?: string;
    include_year?: boolean;
    include_month?: boolean;
    padding?: number;
    next_sequence?: number;
    reset_period?: ResetPeriod;
    is_active?: boolean;
  }): Promise<NumberingRule> {
    const payload = { ...rule, updated_at: new Date().toISOString() };
    const { data, error } = await supabase
      .from('numbering_rules')
      .upsert(payload, { onConflict: 'module_key' })
      .select()
      .single();
    if (error) throw error;

    await recordAudit({
      action: rule.id ? 'UPDATE' : 'CREATE',
      entity_type: 'NUMBERING_RULE',
      entity_id: data.id,
      entity_label: rule.module_key,
      summary: `Numbering rule for ${rule.module_key}: ${previewNumber(data as NumberingRule)}`,
      module: 'SYSTEM',
    });
    return data as NumberingRule;
  },

  async deleteRule(id: string): Promise<void> {
    const { error } = await supabase.from('numbering_rules').delete().eq('id', id);
    if (error) throw error;
  },

  /**
   * Generates the next document number for a module (atomic, race-safe).
   * Falls back to a timestamp-based number if the RPC is unavailable
   * (e.g. migration not applied yet) so callers never break.
   */
  async generateNumber(moduleKey: string): Promise<string> {
    try {
      const { data, error } = await supabase.rpc('generate_document_number', {
        p_module_key: moduleKey,
      });
      if (error) throw error;
      return data as string;
    } catch (err) {
      logger.warn(`generate_document_number RPC unavailable for ${moduleKey}, using fallback:`, err);
      const now = new Date();
      return `${moduleKey}-${now.getFullYear()}-${String(now.getTime()).slice(-6)}`;
    }
  },

  /** Preview of the next number without consuming the sequence. */
  async previewNext(moduleKey: string): Promise<string> {
    const rule = await this.getRule(moduleKey);
    if (!rule) return `${moduleKey}-${new Date().getFullYear()}-XXXX`;
    return previewNumber(rule);
  },
};

export default numberingService;
