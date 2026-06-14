// ============================================================
// JEET ERP — Form Builder Service
// Dynamic form definitions per module. Modules render the
// active form via getActiveForm() — no code changes needed
// when admins reconfigure layouts/fields.
// ============================================================

import { supabase } from '@/lib/supabase';
import { recordAudit } from '@/lib/audit/recordAudit';
import { evaluateCondition } from '@/lib/workflow/engine';
import type { FormDefinition, FormSchema, FormFieldDef } from '@/types/platform.types';

export const formBuilderService = {
  async getDefinitions(): Promise<FormDefinition[]> {
    const { data, error } = await supabase
      .from('form_definitions')
      .select('*')
      .order('module_key')
      .order('version', { ascending: false });
    if (error) throw error;
    return data as FormDefinition[];
  },

  async getDefinition(id: string): Promise<FormDefinition> {
    const { data, error } = await supabase.from('form_definitions').select('*').eq('id', id).single();
    if (error) throw error;
    return data as FormDefinition;
  },

  /** Returns the active form schema for a module, or null when none configured. */
  async getActiveForm(moduleKey: string): Promise<FormDefinition | null> {
    const { data, error } = await supabase
      .from('form_definitions')
      .select('*')
      .eq('module_key', moduleKey)
      .eq('is_active', true)
      .maybeSingle();
    if (error) throw error;
    return data as FormDefinition | null;
  },

  async createDefinition(input: { module_key: string; name: string; description?: string; schema?: FormSchema }): Promise<FormDefinition> {
    const { data, error } = await supabase
      .from('form_definitions')
      .insert({
        ...input,
        schema: input.schema || {
          tabs: [{
            id: 'tab-1', label: 'General',
            sections: [{ id: 'sec-1', label: 'Details', columns: 2, fields: [] }],
          }],
        },
      })
      .select()
      .single();
    if (error) throw error;

    await recordAudit({
      action: 'CREATE', entity_type: 'FORM_DEFINITION', entity_id: data.id,
      entity_label: input.name, summary: `Created form '${input.name}' for module ${input.module_key}`,
      module: 'SYSTEM',
    });
    return data as FormDefinition;
  },

  async updateSchema(id: string, schema: FormSchema): Promise<void> {
    const { error } = await supabase
      .from('form_definitions')
      .update({ schema, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  },

  async updateMeta(id: string, patch: { name?: string; description?: string }): Promise<void> {
    const { error } = await supabase
      .from('form_definitions')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  },

  async activateDefinition(id: string): Promise<void> {
    const { data: def, error: e1 } = await supabase
      .from('form_definitions').select('module_key').eq('id', id).single();
    if (e1) throw e1;

    await supabase
      .from('form_definitions')
      .update({ is_active: false })
      .eq('module_key', def.module_key)
      .eq('is_active', true);

    const { error } = await supabase
      .from('form_definitions')
      .update({ is_active: true, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  },

  async deleteDefinition(id: string): Promise<void> {
    const { error } = await supabase.from('form_definitions').delete().eq('id', id);
    if (error) throw error;
  },

  // ---------- Runtime helpers ----------
  /** Returns all fields of a schema flattened. */
  flattenFields(schema: FormSchema): FormFieldDef[] {
    return (schema?.tabs || []).flatMap(t => (t.sections || []).flatMap(s => s.fields || []));
  },

  /** Resolves field visibility against current form values (conditional logic). */
  isFieldVisible(field: FormFieldDef, values: Record<string, unknown>): boolean {
    if (field.hidden) return false;
    if (!field.conditional) return true;
    return evaluateCondition(
      { field: field.conditional.field, operator: field.conditional.operator, value: field.conditional.value },
      values
    );
  },

  /** Validates values against a schema; returns field-keyed error messages. */
  validate(schema: FormSchema, values: Record<string, unknown>): Record<string, string> {
    const errors: Record<string, string> = {};
    for (const field of this.flattenFields(schema)) {
      if (!this.isFieldVisible(field, values)) continue;
      const val = values[field.key];
      const empty = val === null || val === undefined || String(val).trim() === '';

      if (field.required && empty) {
        errors[field.key] = `${field.label} is required`;
        continue;
      }
      if (empty || !field.validation) continue;

      const v = field.validation;
      if (field.type === 'number' || field.type === 'currency') {
        const n = Number(val);
        if (v.min !== undefined && n < v.min) errors[field.key] = v.message || `${field.label} must be ≥ ${v.min}`;
        if (v.max !== undefined && n > v.max) errors[field.key] = v.message || `${field.label} must be ≤ ${v.max}`;
      } else if (typeof val === 'string') {
        if (v.min !== undefined && val.length < v.min) errors[field.key] = v.message || `${field.label} is too short`;
        if (v.max !== undefined && val.length > v.max) errors[field.key] = v.message || `${field.label} is too long`;
        if (v.pattern) {
          try {
            if (!new RegExp(v.pattern).test(val)) errors[field.key] = v.message || `${field.label} format is invalid`;
          } catch { /* invalid pattern configured — skip */ }
        }
      }
    }
    return errors;
  },
};

export default formBuilderService;
