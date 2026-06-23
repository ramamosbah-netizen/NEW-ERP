'use client';

// ============================================================
// JEET ERP — Business Rules (tab of /admin/workflows)
// IF <conditions> THEN <actions> rules per module/event.
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';
import rulesService from '@/services/rulesService';
import userRoleService from '@/services/userRoleService';
import { MODULE_CATALOG } from '@/types/platform.types';
import type { BusinessRule, RuleCondition, RuleAction, RuleTriggerEvent, RuleActionType } from '@/types/platform.types';
import type { Role } from '@/types/rbac.types';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Scale, Plus, Save, Trash2, X, Power } from 'lucide-react';

const TRIGGERS: { value: RuleTriggerEvent; label: string }[] = [
  { value: 'ON_CREATE', label: 'On create' },
  { value: 'ON_SUBMIT', label: 'On submit' },
  { value: 'ON_APPROVE', label: 'On approve' },
  { value: 'ON_REJECT', label: 'On reject' },
  { value: 'ON_CLOSE', label: 'On close' },
  { value: 'ON_UPDATE', label: 'On update' },
];

const ACTION_TYPES: { value: RuleActionType; label: string; hint: string }[] = [
  { value: 'REQUIRE_APPROVAL', label: 'Require approval', hint: 'role key, e.g. gm' },
  { value: 'NOTIFY', label: 'Send notification', hint: 'role key or user, e.g. finance_mgr' },
  { value: 'ESCALATE', label: 'Escalate', hint: 'hours until escalation, e.g. 24' },
  { value: 'BLOCK', label: 'Block operation', hint: 'message shown to the user' },
  { value: 'SET_FIELD', label: 'Set field value', hint: 'field=value, e.g. priority=HIGH' },
];

const OPERATORS = ['=', '!=', '>', '>=', '<', '<=', 'contains', 'not_contains', 'in', 'not_in', 'is_empty', 'not_empty'];

export default function RulesTab() {
  const [rules, setRules] = useState<BusinessRule[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [moduleFilter, setModuleFilter] = useState<string>('');
  const [editing, setEditing] = useState<Partial<BusinessRule> | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [r, ro] = await Promise.all([rulesService.getRules(), userRoleService.getRoles()]);
      setRules(r);
      setRoles(ro);
      setError(null);
    } catch (err: any) {
      setError(err.message?.includes('relation')
        ? 'Rules tables not found — apply the platform migration first (see Admin Center).'
        : err.message || 'Failed to load rules');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const moduleLabel = (key: string) => MODULE_CATALOG.find(m => m.key === key)?.label || key;

  const newRule = () => setEditing({
    module_key: 'PO',
    name: '',
    trigger_event: 'ON_SUBMIT',
    conditions: [{ field: '', operator: '>', value: '' }],
    actions: [{ type: 'REQUIRE_APPROVAL', params: { value: '' } }],
    priority: 100,
    is_active: true,
  });

  const save = async () => {
    if (!editing?.module_key || !editing.name?.trim()) return;
    setBusy('save');
    try {
      await rulesService.upsertRule({
        id: editing.id,
        module_key: editing.module_key,
        name: editing.name.trim(),
        description: editing.description || null,
        trigger_event: editing.trigger_event as RuleTriggerEvent,
        conditions: (editing.conditions || []).filter(c => c.field),
        actions: editing.actions || [],
        priority: editing.priority ?? 100,
        is_active: editing.is_active ?? true,
      });
      setEditing(null);
      await load();
    } catch (err: any) {
      setError(err.message || 'Save failed');
    } finally {
      setBusy(null);
    }
  };

  const toggle = async (rule: BusinessRule) => {
    setBusy(rule.id);
    try {
      await rulesService.toggleRule(rule.id, !rule.is_active);
      await load();
    } finally {
      setBusy(null);
    }
  };

  const remove = async (rule: BusinessRule) => {
    if (!window.confirm(`Delete rule "${rule.name}"?`)) return;
    setBusy(rule.id);
    try {
      await rulesService.deleteRule(rule.id);
      await load();
    } finally {
      setBusy(null);
    }
  };

  const describeRule = (rule: BusinessRule): string => {
    const conds = rule.conditions.map(c => `${c.field} ${c.operator} ${c.value ?? ''}`).join(' AND ');
    const acts = rule.actions.map(a => {
      const t = ACTION_TYPES.find(x => x.value === a.type)?.label || a.type;
      return `${t}${a.params?.value ? `: ${a.params.value}` : ''}`;
    }).join(', ');
    return `IF ${conds || '(always)'} THEN ${acts || '(no action)'}`;
  };

  const filtered = moduleFilter ? rules.filter(r => r.module_key === moduleFilter) : rules;
  const usedModules = [...new Set(rules.map(r => r.module_key))];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-2 items-center">
          <select className="quote-form-input max-w-xs" value={moduleFilter} onChange={e => setModuleFilter(e.target.value)}>
            <option value="">All modules</option>
            {usedModules.map(m => <option key={m} value={m}>{moduleLabel(m)}</option>)}
          </select>
          <span className="text-xs text-[var(--text-muted)]">{filtered.length} rule{filtered.length === 1 ? '' : 's'}</span>
        </div>
        <Button variant="primary" size="sm" icon={Plus} onClick={newRule}>New rule</Button>
      </div>

      {error && (
        <div className="flex items-center justify-between gap-3 bg-[var(--status-danger-bg)] border border-[var(--status-danger-border)] rounded-lg p-3 text-xs text-[var(--status-danger-text)]">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="cursor-pointer"><X size={13} /></button>
        </div>
      )}

      {loading ? (
        <div className="py-24 flex justify-center"><div className="h-7 w-7 border-2 border-[var(--border-color)] border-t-[var(--text-primary)] animate-spin rounded-full" /></div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={Scale} title="No business rules" description='Example: IF total > 100,000 AED THEN approval = General Manager.' actionText="Create rule" onAction={newRule} />
      ) : (
        <div className="flex flex-col gap-2.5">
          {filtered.map(rule => (
            <Card key={rule.id} padding={false}>
              <div className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-[var(--text-primary)]">{rule.name}</span>
                    <span className="q-badge q-badge-draft">{moduleLabel(rule.module_key)}</span>
                    <span className="text-xs text-[var(--text-muted)]">{TRIGGERS.find(t => t.value === rule.trigger_event)?.label}</span>
                    <span className={`q-badge ${rule.is_active ? 'q-badge-approved' : 'q-badge-draft'}`}>{rule.is_active ? 'Active' : 'Disabled'}</span>
                  </div>
                  <p className="text-xs text-[var(--text-muted)] font-mono mt-1 truncate">{describeRule(rule)}</p>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <Button size="sm" variant="muted" onClick={() => setEditing({ ...rule })}>Edit</Button>
                  <Button size="sm" variant="muted" icon={Power} disabled={busy !== null} onClick={() => toggle(rule)} />
                  <Button size="sm" variant="muted" icon={Trash2} disabled={busy !== null} onClick={() => remove(rule)} />
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {editing && (
        <div className="quote-modal-overlay" onClick={() => setEditing(null)}>
          <div className="quote-modal !max-w-[720px]" onClick={e => e.stopPropagation()}>
            <div className="quote-modal-header">
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">{editing.id ? 'Edit rule' : 'New business rule'}</h3>
              <button onClick={() => setEditing(null)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"><X size={16} /></button>
            </div>
            <div className="quote-modal-body flex flex-col gap-4">
              <div className="quote-form-grid">
                <div className="quote-form-group">
                  <label>Rule name</label>
                  <input className="quote-form-input" value={editing.name || ''} onChange={e => setEditing({ ...editing, name: e.target.value })} placeholder="e.g. GM approval above 100k" />
                </div>
                <div className="quote-form-group">
                  <label>Module</label>
                  <select className="quote-form-input" value={editing.module_key} onChange={e => setEditing({ ...editing, module_key: e.target.value })}>
                    {MODULE_CATALOG.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
                  </select>
                </div>
                <div className="quote-form-group">
                  <label>Trigger</label>
                  <select className="quote-form-input" value={editing.trigger_event} onChange={e => setEditing({ ...editing, trigger_event: e.target.value as RuleTriggerEvent })}>
                    {TRIGGERS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div className="quote-form-group">
                  <label>Priority (lower runs first)</label>
                  <input type="number" className="quote-form-input" value={editing.priority ?? 100} onChange={e => setEditing({ ...editing, priority: Number(e.target.value) })} />
                </div>
              </div>

              <div className="quote-form-group">
                <label>IF — conditions</label>
                <div className="flex flex-col gap-2">
                  {(editing.conditions || []).map((c, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      {idx > 0 && (
                        <select className="quote-form-input !w-20" value={c.join || 'AND'}
                          onChange={e => {
                            const conds = [...(editing.conditions || [])];
                            conds[idx] = { ...c, join: e.target.value as 'AND' | 'OR' };
                            setEditing({ ...editing, conditions: conds });
                          }}>
                          <option>AND</option><option>OR</option>
                        </select>
                      )}
                      <input className="quote-form-input flex-1" placeholder="field e.g. total" value={c.field}
                        onChange={e => {
                          const conds = [...(editing.conditions || [])];
                          conds[idx] = { ...c, field: e.target.value };
                          setEditing({ ...editing, conditions: conds });
                        }} />
                      <select className="quote-form-input !w-32" value={c.operator}
                        onChange={e => {
                          const conds = [...(editing.conditions || [])];
                          conds[idx] = { ...c, operator: e.target.value as RuleCondition['operator'] };
                          setEditing({ ...editing, conditions: conds });
                        }}>
                        {OPERATORS.map(op => <option key={op} value={op}>{op}</option>)}
                      </select>
                      <input className="quote-form-input flex-1" placeholder="value e.g. 100000" value={String(c.value ?? '')}
                        onChange={e => {
                          const conds = [...(editing.conditions || [])];
                          conds[idx] = { ...c, value: e.target.value };
                          setEditing({ ...editing, conditions: conds });
                        }} />
                      <button type="button" className="text-[var(--text-muted)] hover:text-[var(--error)] cursor-pointer"
                        onClick={() => setEditing({ ...editing, conditions: (editing.conditions || []).filter((_, i) => i !== idx) })}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                  <Button size="sm" variant="secondary" icon={Plus}
                    onClick={() => setEditing({ ...editing, conditions: [...(editing.conditions || []), { field: '', operator: '=', value: '', join: 'AND' }] })}>
                    Add condition
                  </Button>
                </div>
              </div>

              <div className="quote-form-group">
                <label>THEN — actions</label>
                <div className="flex flex-col gap-2">
                  {(editing.actions || []).map((a, idx) => {
                    const meta = ACTION_TYPES.find(t => t.value === a.type);
                    return (
                      <div key={idx} className="flex gap-2 items-center">
                        <select className="quote-form-input !w-48" value={a.type}
                          onChange={e => {
                            const acts = [...(editing.actions || [])];
                            acts[idx] = { type: e.target.value as RuleActionType, params: { value: '' } };
                            setEditing({ ...editing, actions: acts });
                          }}>
                          {ACTION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                        </select>
                        {a.type === 'REQUIRE_APPROVAL' || a.type === 'NOTIFY' ? (
                          <select className="quote-form-input flex-1" value={String(a.params?.value ?? '')}
                            onChange={e => {
                              const acts = [...(editing.actions || [])];
                              acts[idx] = { ...a, params: { ...a.params, value: e.target.value } };
                              setEditing({ ...editing, actions: acts });
                            }}>
                            <option value="">Select role…</option>
                            {roles.map(r => <option key={r.id} value={r.role_key}>{r.name}</option>)}
                          </select>
                        ) : (
                          <input className="quote-form-input flex-1" placeholder={meta?.hint} value={String(a.params?.value ?? '')}
                            onChange={e => {
                              const acts = [...(editing.actions || [])];
                              acts[idx] = { ...a, params: { ...a.params, value: e.target.value, message: e.target.value } };
                              setEditing({ ...editing, actions: acts });
                            }} />
                        )}
                        <button type="button" className="text-[var(--text-muted)] hover:text-[var(--error)] cursor-pointer"
                          onClick={() => setEditing({ ...editing, actions: (editing.actions || []).filter((_, i) => i !== idx) })}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    );
                  })}
                  <Button size="sm" variant="secondary" icon={Plus}
                    onClick={() => setEditing({ ...editing, actions: [...(editing.actions || []), { type: 'NOTIFY', params: { value: '' } }] })}>
                    Add action
                  </Button>
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t border-[var(--border-color)] pt-4">
                <Button variant="secondary" size="sm" onClick={() => setEditing(null)}>Cancel</Button>
                <Button variant="primary" size="sm" icon={Save} isLoading={busy === 'save'} onClick={save}>Save rule</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
