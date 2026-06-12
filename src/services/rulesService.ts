// ============================================================
// JEET ERP — Business Rules Service
// IF/THEN rules configurable from the Admin Center; modules
// call evaluate() at their trigger points.
// ============================================================

import { supabase } from '@/lib/supabase';
import { recordAudit } from '@/lib/audit/recordAudit';
import { evaluateRules, isBlocked } from '@/lib/workflow/engine';
import type { BusinessRule, RuleAction, RuleTriggerEvent } from '@/types/platform.types';

export const rulesService = {
  async getRules(moduleKey?: string): Promise<BusinessRule[]> {
    let q = supabase.from('business_rules').select('*').order('module_key').order('priority');
    if (moduleKey) q = q.eq('module_key', moduleKey);
    const { data, error } = await q;
    if (error) throw error;
    return data as BusinessRule[];
  },

  async upsertRule(rule: Partial<BusinessRule> & {
    module_key: string;
    name: string;
    trigger_event: RuleTriggerEvent;
  }): Promise<BusinessRule> {
    const payload = { ...rule, updated_at: new Date().toISOString() };
    const { data, error } = rule.id
      ? await supabase.from('business_rules').update(payload).eq('id', rule.id).select().single()
      : await supabase.from('business_rules').insert(payload).select().single();
    if (error) throw error;

    await recordAudit({
      action: rule.id ? 'UPDATE' : 'CREATE',
      entity_type: 'BUSINESS_RULE',
      entity_id: data.id,
      entity_label: rule.name,
      summary: `Business rule '${rule.name}' (${rule.module_key} / ${rule.trigger_event})`,
      module: 'SYSTEM',
    });
    return data as BusinessRule;
  },

  async toggleRule(id: string, isActive: boolean): Promise<void> {
    const { error } = await supabase
      .from('business_rules')
      .update({ is_active: isActive, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  },

  async deleteRule(id: string): Promise<void> {
    const { error } = await supabase.from('business_rules').delete().eq('id', id);
    if (error) throw error;
  },

  /**
   * Evaluates active rules for a module + event against a record.
   * Returns matched actions and a blocked flag — callers should
   * abort the operation when blocked.
   *
   * Example:
   *   const { blocked, reason, actions } =
   *     await rulesService.evaluate('PO', 'ON_SUBMIT', { total: 150000, supplier_status: 'NEW' });
   */
  async evaluate(
    moduleKey: string,
    triggerEvent: RuleTriggerEvent,
    context: Record<string, unknown>
  ): Promise<{ blocked: boolean; reason?: string; actions: RuleAction[]; matchedRules: string[] }> {
    const { data, error } = await supabase
      .from('business_rules')
      .select('*')
      .eq('module_key', moduleKey)
      .eq('trigger_event', triggerEvent)
      .eq('is_active', true);
    if (error) throw error;

    const matched = evaluateRules((data || []) as BusinessRule[], triggerEvent, context);
    const block = isBlocked(matched);

    return {
      blocked: block.blocked,
      reason: block.reason,
      actions: matched.flatMap(m => m.actions),
      matchedRules: matched.map(m => m.rule.name),
    };
  },
};

export default rulesService;
