'use client';

// ============================================================
// JEET ERP — Document Numbering Configuration
// Per-module numbering formats with live preview.
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';
import numberingService, { previewNumber } from '@/services/numberingService';
import { MODULE_CATALOG } from '@/types/platform.types';
import type { NumberingRule, ResetPeriod } from '@/types/platform.types';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Hash, Plus, Save, Trash2, X } from 'lucide-react';

type EditableRule = Partial<NumberingRule> & { module_key: string; prefix: string };

export default function NumberingPage() {
  const [rules, setRules] = useState<NumberingRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [editing, setEditing] = useState<EditableRule | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setRules(await numberingService.getRules());
      setError(null);
    } catch (err: any) {
      setError(err.message?.includes('relation')
        ? 'Numbering tables not found — apply the platform migration first (see Admin Center).'
        : err.message || 'Failed to load numbering rules');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const flash = (msg: string) => { setNotice(msg); setTimeout(() => setNotice(null), 2500); };

  const moduleLabel = (key: string) => MODULE_CATALOG.find(m => m.key === key)?.label || key;

  const save = async () => {
    if (!editing?.module_key || !editing.prefix) return;
    setBusy('save');
    try {
      await numberingService.upsertRule({
        id: editing.id,
        module_key: editing.module_key.toUpperCase().replace(/\s+/g, '_'),
        prefix: editing.prefix,
        separator: editing.separator ?? '-',
        include_year: editing.include_year ?? true,
        include_month: editing.include_month ?? false,
        padding: editing.padding ?? 4,
        next_sequence: editing.next_sequence ?? 1,
        reset_period: (editing.reset_period ?? 'YEARLY') as ResetPeriod,
        is_active: editing.is_active ?? true,
      });
      setEditing(null);
      await load();
      flash('Numbering rule saved');
    } catch (err: any) {
      setError(err.message || 'Save failed');
    } finally {
      setBusy(null);
    }
  };

  const remove = async (rule: NumberingRule) => {
    if (!window.confirm(`Delete numbering rule for ${rule.module_key}?`)) return;
    setBusy(rule.id);
    try {
      await numberingService.deleteRule(rule.id);
      await load();
    } finally {
      setBusy(null);
    }
  };

  const livePreview = editing ? previewNumber({
    prefix: editing.prefix || '',
    separator: editing.separator ?? '-',
    include_year: editing.include_year ?? true,
    include_month: editing.include_month ?? false,
    padding: editing.padding ?? 4,
    next_sequence: editing.next_sequence ?? 1,
  }) : '';

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Document Numbering"
        subtitle="Configure document number formats per module — generation is atomic and race-safe"
        breadcrumbs={[{ label: 'Admin', href: '/admin' }, { label: 'Numbering' }]}
        actions={
          <Button variant="primary" size="sm" icon={Plus} onClick={() => setEditing({ module_key: '', prefix: '', include_year: true, padding: 4, next_sequence: 1, reset_period: 'YEARLY', is_active: true })}>
            New rule
          </Button>
        }
      />

      {error && (
        <div className="flex items-center justify-between gap-3 bg-[var(--status-danger-bg)] border border-[var(--status-danger-border)] rounded-lg p-3 text-xs text-[var(--status-danger-text)]">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="cursor-pointer"><X size={13} /></button>
        </div>
      )}
      {notice && (
        <div className="bg-[var(--status-success-bg)] border border-[var(--status-success-border)] rounded-lg p-3 text-xs text-[var(--status-success-text)]">{notice}</div>
      )}

      {loading ? (
        <div className="py-24 flex justify-center"><div className="h-7 w-7 border-2 border-[var(--border-color)] border-t-[var(--text-primary)] animate-spin rounded-full" /></div>
      ) : rules.length === 0 ? (
        <EmptyState icon={Hash} title="No numbering rules" description="Create rules to control how document numbers are generated per module." />
      ) : (
        <Card padding={false}>
          <div className="quote-table-wrap !border-0 !rounded-none">
            <table className="quote-table">
              <thead>
                <tr>
                  <th>Module</th>
                  <th>Format preview</th>
                  <th>Next #</th>
                  <th>Reset</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rules.map(r => (
                  <tr key={r.id}>
                    <td>
                      <div className="flex flex-col">
                        <span className="font-medium text-[var(--text-primary)] text-xs">{moduleLabel(r.module_key)}</span>
                        <span className="font-mono text-xs text-[var(--text-muted)]">{r.module_key}</span>
                      </div>
                    </td>
                    <td><span className="font-mono text-xs font-medium text-[var(--text-primary)]">{previewNumber(r)}</span></td>
                    <td><span className="font-mono text-xs">{r.next_sequence}</span></td>
                    <td><span className="text-xs text-[var(--text-secondary)]">{r.reset_period.toLowerCase()}</span></td>
                    <td>
                      <span className={`q-badge ${r.is_active ? 'q-badge-approved' : 'q-badge-draft'}`}>
                        {r.is_active ? 'Active' : 'Disabled'}
                      </span>
                    </td>
                    <td>
                      <div className="flex gap-1 justify-end">
                        <Button size="sm" variant="muted" onClick={() => setEditing({ ...r })}>Edit</Button>
                        <Button size="sm" variant="muted" icon={Trash2} disabled={busy !== null} onClick={() => remove(r)} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Edit modal */}
      {editing && (
        <div className="quote-modal-overlay" onClick={() => setEditing(null)}>
          <div className="quote-modal" onClick={e => e.stopPropagation()}>
            <div className="quote-modal-header">
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">{editing.id ? `Edit rule — ${editing.module_key}` : 'New numbering rule'}</h3>
              <button onClick={() => setEditing(null)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"><X size={16} /></button>
            </div>
            <div className="quote-modal-body flex flex-col gap-4">
              <div className="bg-[var(--bg-card-hover)] border border-[var(--border-color)] rounded-lg p-4 text-center">
                <span className="text-xs text-[var(--text-muted)] block mb-1">Live preview</span>
                <span className="font-mono text-lg font-semibold text-[var(--text-primary)]">{livePreview}</span>
              </div>

              <div className="quote-form-grid">
                {!editing.id && (
                  <div className="quote-form-group">
                    <label>Module</label>
                    <select className="quote-form-input" value={editing.module_key} onChange={e => setEditing({ ...editing, module_key: e.target.value })}>
                      <option value="">Select module…</option>
                      {MODULE_CATALOG.filter(m => !rules.some(r => r.module_key === m.key)).map(m => (
                        <option key={m.key} value={m.key}>{m.label} ({m.key})</option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="quote-form-group">
                  <label>Prefix</label>
                  <input className="quote-form-input font-mono" value={editing.prefix} onChange={e => setEditing({ ...editing, prefix: e.target.value })} placeholder="e.g. JI-PO" />
                </div>
                <div className="quote-form-group">
                  <label>Separator</label>
                  <input className="quote-form-input font-mono" maxLength={3} value={editing.separator ?? '-'} onChange={e => setEditing({ ...editing, separator: e.target.value })} />
                </div>
                <div className="quote-form-group">
                  <label>Digits (padding)</label>
                  <input type="number" min={1} max={10} className="quote-form-input" value={editing.padding ?? 4} onChange={e => setEditing({ ...editing, padding: Number(e.target.value) })} />
                </div>
                <div className="quote-form-group">
                  <label>Next sequence</label>
                  <input type="number" min={1} className="quote-form-input" value={editing.next_sequence ?? 1} onChange={e => setEditing({ ...editing, next_sequence: Number(e.target.value) })} />
                </div>
                <div className="quote-form-group">
                  <label>Reset period</label>
                  <select className="quote-form-input" value={editing.reset_period ?? 'YEARLY'} onChange={e => setEditing({ ...editing, reset_period: e.target.value as ResetPeriod })}>
                    <option value="YEARLY">Yearly (restart at 1 each year)</option>
                    <option value="MONTHLY">Monthly</option>
                    <option value="NEVER">Never</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-5">
                <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)] cursor-pointer">
                  <input type="checkbox" checked={editing.include_year ?? true} onChange={e => setEditing({ ...editing, include_year: e.target.checked })} />
                  Include year
                </label>
                <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)] cursor-pointer">
                  <input type="checkbox" checked={editing.include_month ?? false} onChange={e => setEditing({ ...editing, include_month: e.target.checked })} />
                  Include month
                </label>
                <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)] cursor-pointer">
                  <input type="checkbox" checked={editing.is_active ?? true} onChange={e => setEditing({ ...editing, is_active: e.target.checked })} />
                  Active
                </label>
              </div>

              <div className="flex justify-end gap-2">
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
