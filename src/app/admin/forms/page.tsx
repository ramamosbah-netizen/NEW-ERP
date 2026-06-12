'use client';

// ============================================================
// JEET ERP — Forms Builder: definitions list
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import formBuilderService from '@/services/formBuilderService';
import { MODULE_CATALOG } from '@/types/platform.types';
import type { FormDefinition } from '@/types/platform.types';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { FormInput, Plus, Power, Trash2, X } from 'lucide-react';

export default function FormsPage() {
  const router = useRouter();
  const [defs, setDefs] = useState<FormDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newModule, setNewModule] = useState('PO');
  const [newName, setNewName] = useState('');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setDefs(await formBuilderService.getDefinitions());
      setError(null);
    } catch (err: any) {
      setError(err.message?.includes('relation')
        ? 'Forms tables not found — apply the platform migration first (see Admin Center).'
        : err.message || 'Failed to load forms');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const moduleLabel = (key: string) => MODULE_CATALOG.find(m => m.key === key)?.label || key;

  const fieldCount = (def: FormDefinition) =>
    (def.schema?.tabs || []).reduce((n, t) => n + t.sections.reduce((m, s) => m + s.fields.length, 0), 0);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setBusy('create');
    try {
      const def = await formBuilderService.createDefinition({ module_key: newModule, name: newName.trim() });
      router.push(`/admin/forms/${def.id}`);
    } catch (err: any) {
      setError(err.message || 'Create failed');
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Forms Builder"
        subtitle="Dynamic form layouts per module: tabs, sections, fields, validation, conditional logic"
        breadcrumbs={[{ label: 'Admin', href: '/admin' }, { label: 'Forms' }]}
        actions={<Button variant="primary" size="sm" icon={Plus} onClick={() => setShowCreate(true)}>New form</Button>}
      />

      {error && (
        <div className="flex items-center justify-between gap-3 bg-[var(--status-danger-bg)] border border-[var(--status-danger-border)] rounded-lg p-3 text-xs text-[var(--status-danger-text)]">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="cursor-pointer"><X size={13} /></button>
        </div>
      )}

      {loading ? (
        <div className="py-24 flex justify-center"><div className="h-7 w-7 border-2 border-[var(--border-color)] border-t-[var(--text-primary)] animate-spin rounded-full" /></div>
      ) : defs.length === 0 ? (
        <EmptyState icon={FormInput} title="No form definitions" description="Design custom forms that modules render automatically." actionText="Create form" onAction={() => setShowCreate(true)} />
      ) : (
        <Card padding={false}>
          <div className="divide-y divide-[var(--border-color)]">
            {defs.map(def => (
              <div key={def.id} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-[var(--bg-card-hover)]">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Link href={`/admin/forms/${def.id}`} className="text-sm font-medium text-[var(--text-primary)] hover:underline">{def.name}</Link>
                    <span className="q-badge q-badge-draft">{moduleLabel(def.module_key)}</span>
                    <span className="text-xs font-mono text-[var(--text-muted)]">v{def.version}</span>
                    {def.is_active && <span className="q-badge q-badge-approved">Active</span>}
                  </div>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">
                    {(def.schema?.tabs || []).length} tab(s) · {fieldCount(def)} field(s)
                  </p>
                </div>
                <div className="flex gap-1.5 flex-shrink-0">
                  <Button size="sm" variant="muted" onClick={() => router.push(`/admin/forms/${def.id}`)}>Design</Button>
                  <Button size="sm" variant={def.is_active ? 'warning' : 'success'} icon={Power} disabled={busy !== null}
                    onClick={async () => {
                      setBusy(def.id);
                      try {
                        if (def.is_active) {
                          await supabaseToggleOff(def.id);
                        } else {
                          await formBuilderService.activateDefinition(def.id);
                        }
                        await load();
                      } finally { setBusy(null); }
                    }}>
                    {def.is_active ? 'Deactivate' : 'Activate'}
                  </Button>
                  <Button size="sm" variant="muted" icon={Trash2} disabled={busy !== null || def.is_active}
                    onClick={async () => {
                      if (!window.confirm(`Delete form "${def.name}"?`)) return;
                      setBusy(def.id);
                      try { await formBuilderService.deleteDefinition(def.id); await load(); }
                      finally { setBusy(null); }
                    }} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {showCreate && (
        <div className="quote-modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="quote-modal" onClick={e => e.stopPropagation()}>
            <div className="quote-modal-header">
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">New form definition</h3>
              <button onClick={() => setShowCreate(false)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"><X size={16} /></button>
            </div>
            <form onSubmit={handleCreate} className="quote-modal-body flex flex-col gap-4">
              <div className="quote-form-group">
                <label>Module</label>
                <select className="quote-form-input" value={newModule} onChange={e => setNewModule(e.target.value)}>
                  {MODULE_CATALOG.map(m => <option key={m.key} value={m.key}>{m.label} ({m.key})</option>)}
                </select>
              </div>
              <div className="quote-form-group">
                <label>Form name</label>
                <input className="quote-form-input" value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. MAR Entry Form" />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="secondary" size="sm" onClick={() => setShowCreate(false)}>Cancel</Button>
                <Button variant="primary" size="sm" type="submit" isLoading={busy === 'create'}>Create & open designer</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// Local helper: deactivate by clearing is_active
async function supabaseToggleOff(id: string) {
  const { supabase } = await import('@/lib/supabase');
  const { error } = await supabase.from('form_definitions').update({ is_active: false }).eq('id', id);
  if (error) throw error;
}
