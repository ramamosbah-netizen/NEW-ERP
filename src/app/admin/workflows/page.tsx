'use client';

// ============================================================
// JEET ERP — Workflow Builder: definitions list
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import workflowService from '@/services/workflowService';
import { MODULE_CATALOG } from '@/types/platform.types';
import type { WorkflowDefinition } from '@/types/platform.types';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { GitBranch, Plus, Copy, Power, Trash2, PencilLine, X } from 'lucide-react';

export default function WorkflowsPage() {
  const router = useRouter();
  const [defs, setDefs] = useState<WorkflowDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [newModule, setNewModule] = useState('PO');
  const [customModule, setCustomModule] = useState('');
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const list = await workflowService.getDefinitions();
      setDefs(list);
      setError(null);
    } catch (err: any) {
      setError(err.message?.includes('relation')
        ? 'Workflow tables not found — apply the platform migration first (see Admin Center).'
        : err.message || 'Failed to load workflows');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const moduleLabel = (key: string) =>
    MODULE_CATALOG.find(m => m.key === key)?.label || key;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const moduleKey = newModule === '__CUSTOM__' ? customModule.trim().toUpperCase().replace(/\s+/g, '_') : newModule;
    if (!moduleKey || !newName.trim()) return;
    setBusy('create');
    try {
      const def = await workflowService.createDefinition({
        module_key: moduleKey,
        name: newName.trim(),
        description: newDesc.trim() || undefined,
      });
      setShowCreate(false);
      setNewName(''); setNewDesc(''); setCustomModule('');
      router.push(`/admin/workflows/${def.id}`);
    } catch (err: any) {
      setError(err.message || 'Failed to create workflow');
    } finally {
      setBusy(null);
    }
  };

  const handleClone = async (id: string) => {
    setBusy(id);
    try {
      const copy = await workflowService.cloneDefinition(id);
      router.push(`/admin/workflows/${copy.id}`);
    } catch (err: any) {
      setError(err.message || 'Clone failed');
      setBusy(null);
    }
  };

  const handleToggleActive = async (def: WorkflowDefinition) => {
    setBusy(def.id);
    try {
      if (def.is_active) await workflowService.deactivateDefinition(def.id);
      else await workflowService.activateDefinition(def.id);
      await load();
    } catch (err: any) {
      setError(err.message || 'Toggle failed');
    } finally {
      setBusy(null);
    }
  };

  const handleDelete = async (def: WorkflowDefinition) => {
    if (!window.confirm(`Delete workflow "${def.name}"? This also removes its statuses and transitions.`)) return;
    setBusy(def.id);
    try {
      await workflowService.deleteDefinition(def.id);
      await load();
    } catch (err: any) {
      setError(err.message || 'Delete failed');
    } finally {
      setBusy(null);
    }
  };

  // Group by module
  const grouped = defs.reduce<Record<string, WorkflowDefinition[]>>((acc, d) => {
    (acc[d.module_key] = acc[d.module_key] || []).push(d);
    return acc;
  }, {});

  const catalogGroups = [...new Set(MODULE_CATALOG.map(m => m.group))];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Workflow Builder"
        subtitle="Define status pipelines, transitions, approval matrices, SLAs and escalations per process — no code required"
        breadcrumbs={[{ label: 'Admin', href: '/admin' }, { label: 'Workflows' }]}
        actions={
          <Button variant="primary" size="sm" icon={Plus} onClick={() => setShowCreate(true)}>
            New workflow
          </Button>
        }
      />

      {error && (
        <div className="flex items-center justify-between gap-3 bg-[var(--status-danger-bg)] border border-[var(--status-danger-border)] rounded-lg p-3 text-xs text-[var(--status-danger-text)]">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="cursor-pointer"><X size={13} /></button>
        </div>
      )}

      {loading ? (
        <div className="py-24 flex justify-center">
          <div className="h-7 w-7 border-2 border-[var(--border-color)] border-t-[var(--text-primary)] animate-spin rounded-full" />
        </div>
      ) : defs.length === 0 ? (
        <EmptyState
          icon={GitBranch}
          title="No workflows configured"
          description="Create your first workflow to control how documents move through statuses and approvals."
          actionText="Create workflow"
          onAction={() => setShowCreate(true)}
        />
      ) : (
        <div className="flex flex-col gap-4">
          {Object.entries(grouped).map(([moduleKey, list]) => (
            <Card key={moduleKey} title={moduleLabel(moduleKey)} subtitle={`Module key: ${moduleKey}`} padding={false}>
              <div className="divide-y divide-[var(--border-color)]">
                {list.map(def => (
                  <div key={def.id} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-[var(--bg-card-hover)] transition-colors">
                    <div className="min-w-0 flex items-center gap-3">
                      <GitBranch size={15} className="text-[var(--text-muted)] flex-shrink-0" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <Link href={`/admin/workflows/${def.id}`} className="text-sm font-medium text-[var(--text-primary)] hover:underline truncate">
                            {def.name}
                          </Link>
                          <span className="text-xs font-mono text-[var(--text-muted)]">v{def.version}</span>
                          {def.is_active && (
                            <span className="text-[0.6875rem] font-medium px-2 py-0.5 rounded-md bg-[var(--status-success-bg)] text-[var(--status-success-text)] border border-[var(--status-success-border)]">
                              Active
                            </span>
                          )}
                        </div>
                        {def.description && (
                          <p className="text-xs text-[var(--text-muted)] truncate mt-0.5">{def.description}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <Button size="sm" variant="muted" icon={PencilLine} onClick={() => router.push(`/admin/workflows/${def.id}`)}>
                        Design
                      </Button>
                      <Button size="sm" variant="muted" icon={Copy} disabled={busy !== null} isLoading={busy === def.id} onClick={() => handleClone(def.id)}>
                        Clone
                      </Button>
                      <Button size="sm" variant={def.is_active ? 'warning' : 'success'} icon={Power} disabled={busy !== null} onClick={() => handleToggleActive(def)}>
                        {def.is_active ? 'Deactivate' : 'Activate'}
                      </Button>
                      <Button size="sm" variant="muted" icon={Trash2} disabled={busy !== null || def.is_active} onClick={() => handleDelete(def)} title={def.is_active ? 'Deactivate before deleting' : 'Delete'} />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <div className="quote-modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="quote-modal" onClick={e => e.stopPropagation()}>
            <div className="quote-modal-header">
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">New workflow</h3>
              <button onClick={() => setShowCreate(false)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"><X size={16} /></button>
            </div>
            <form onSubmit={handleCreate} className="quote-modal-body flex flex-col gap-4">
              <div className="quote-form-group">
                <label>Process / module</label>
                <select value={newModule} onChange={e => setNewModule(e.target.value)} className="quote-form-input">
                  {catalogGroups.map(g => (
                    <optgroup key={g} label={g}>
                      {MODULE_CATALOG.filter(m => m.group === g).map(m => (
                        <option key={m.key} value={m.key}>{m.label} ({m.key})</option>
                      ))}
                    </optgroup>
                  ))}
                  <option value="__CUSTOM__">Custom process…</option>
                </select>
              </div>
              {newModule === '__CUSTOM__' && (
                <div className="quote-form-group">
                  <label>Custom module key</label>
                  <input
                    className="quote-form-input"
                    placeholder="e.g. EQUIPMENT_CALIBRATION"
                    value={customModule}
                    onChange={e => setCustomModule(e.target.value)}
                  />
                </div>
              )}
              <div className="quote-form-group">
                <label>Workflow name</label>
                <input className="quote-form-input" placeholder="e.g. Purchase Order Approval" value={newName} onChange={e => setNewName(e.target.value)} />
              </div>
              <div className="quote-form-group">
                <label>Description (optional)</label>
                <textarea className="quote-form-textarea" rows={2} value={newDesc} onChange={e => setNewDesc(e.target.value)} />
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
