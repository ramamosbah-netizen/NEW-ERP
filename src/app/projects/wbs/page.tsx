'use client';

// ============================================================
// JEET ERP — Projects: Work Breakdown Structure (WBS)
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import wbsService, { WbsNode } from '@/services/wbsService';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ListTree, Plus, X, Trash2, Pencil, Layers } from 'lucide-react';

const money = (v: number) => new Intl.NumberFormat('en-AE', { maximumFractionDigits: 0 }).format(v || 0);

export default function WbsPage() {
  const [projects, setProjects] = useState<{ id: string; label: string }[]>([]);
  const [projectId, setProjectId] = useState('');
  const [nodes, setNodes] = useState<WbsNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [parentId, setParentId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', code: '', system_name: '', budget_cost: '', weight_pct: '', progress_pct: '', planned_start: '', planned_end: '' });

  useEffect(() => {
    supabase.from('projects').select('id, project_number, name').order('project_number', { ascending: false })
      .then(({ data }) => setProjects((data || []).map((p: any) => ({ id: p.id, label: `${p.project_number} — ${p.name}` }))));
  }, []);

  const load = useCallback(async () => {
    if (!projectId) { setNodes([]); return; }
    setLoading(true);
    try { setNodes(await wbsService.listFlat(projectId)); setError(null); }
    catch (e: any) { setError(e.message); } finally { setLoading(false); }
  }, [projectId]);
  useEffect(() => { load(); }, [load]);

  const roots = nodes.filter(n => n.level === 0);
  const totalBudget = roots.reduce((s, n) => s + n.budget_cost, 0);
  const overallProgress = (() => {
    if (!roots.length) return 0;
    const tb = roots.reduce((s, n) => s + n.budget_cost, 0);
    if (tb > 0) return Math.round(roots.reduce((s, n) => s + n.progress_pct * n.budget_cost, 0) / tb);
    return Math.round(roots.reduce((s, n) => s + n.progress_pct, 0) / roots.length);
  })();

  const openAdd = (parent: string | null) => { setEditId(null); setParentId(parent); setForm({ name: '', code: '', system_name: '', budget_cost: '', weight_pct: '', progress_pct: '', planned_start: '', planned_end: '' }); setShow(true); };
  const openEdit = (n: WbsNode) => { setEditId(n.id); setParentId(n.parent_id); setForm({ name: n.name, code: n.code || '', system_name: n.system_name || '', budget_cost: String(n.budget_cost || ''), weight_pct: String(n.weight_pct || ''), progress_pct: String(n.progress_pct || ''), planned_start: n.planned_start || '', planned_end: n.planned_end || '' }); setShow(true); };

  const save = async () => {
    setBusy(true);
    try {
      const payload = { name: form.name, code: form.code, system_name: form.system_name, budget_cost: Number(form.budget_cost) || 0, weight_pct: Number(form.weight_pct) || 0, progress_pct: Number(form.progress_pct) || 0, planned_start: form.planned_start || null, planned_end: form.planned_end || null };
      if (editId) await wbsService.update(editId, payload);
      else await wbsService.create({ project_id: projectId, parent_id: parentId, ...payload });
      setShow(false); await load();
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  };

  const del = async (n: WbsNode) => { if (!window.confirm(`Delete "${n.name}" and its sub-items?`)) return; await wbsService.remove(n.id); await load(); };
  const seed = async () => { setBusy(true); try { await wbsService.seedFromSystems(projectId); await load(); } catch (e: any) { setError(e.message); } finally { setBusy(false); } };

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Work Breakdown Structure"
        subtitle="Hierarchical work packages with budget, weight and progress — the basis for schedule and earned value"
        breadcrumbs={[{ label: 'Projects', href: '/projects' }, { label: 'WBS' }]}
        actions={projectId ? (
          <div className="flex gap-2">
            {nodes.length === 0 && <Button size="sm" variant="secondary" icon={Layers} isLoading={busy} onClick={seed}>Seed from systems</Button>}
            <Button size="sm" variant="primary" icon={Plus} onClick={() => openAdd(null)}>Add root item</Button>
          </div>
        ) : undefined}
      />

      {error && <div className="flex items-center justify-between gap-3 bg-[var(--status-danger-bg)] border border-[var(--status-danger-border)] rounded-lg p-3 text-xs text-[var(--status-danger-text)]"><span>{error}</span><button onClick={() => setError(null)} className="cursor-pointer"><X size={13} /></button></div>}

      <Card className="p-4">
        <label className="text-xs font-medium text-[var(--text-secondary)]">Project</label>
        <select value={projectId} onChange={e => setProjectId(e.target.value)} className="w-full md:max-w-md mt-1 px-3 h-10 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm">
          <option value="">Select a project…</option>{projects.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
        </select>
      </Card>

      {projectId && nodes.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <Card className="p-3.5"><div className="text-[11px] uppercase tracking-wide text-[var(--text-tertiary)]">Work packages</div><div className="text-lg font-semibold mt-1 tabular-nums">{nodes.length}</div></Card>
          <Card className="p-3.5"><div className="text-[11px] uppercase tracking-wide text-[var(--text-tertiary)]">Total budget</div><div className="text-lg font-semibold mt-1 tabular-nums">{money(totalBudget)} AED</div></Card>
          <Card className="p-3.5"><div className="text-[11px] uppercase tracking-wide text-[var(--text-tertiary)]">Overall progress</div><div className="text-lg font-semibold mt-1 tabular-nums">{overallProgress}%</div></Card>
        </div>
      )}

      {projectId && (
        <Card className="overflow-hidden">
          {loading ? <div className="p-8 text-center text-sm text-[var(--text-tertiary)]">Loading…</div>
            : nodes.length === 0 ? <EmptyState icon={ListTree} title="No WBS yet" description="Add work packages, or seed top-level items from the project's systems." />
            : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr className="border-b border-[var(--border)] text-left text-[var(--text-tertiary)]"><th className="px-4 py-2.5 font-medium">Code</th><th className="px-4 py-2.5 font-medium">Work package</th><th className="px-4 py-2.5 font-medium">System</th><th className="px-4 py-2.5 font-medium text-right">Budget</th><th className="px-4 py-2.5 font-medium text-right">Weight %</th><th className="px-4 py-2.5 font-medium">Progress</th><th className="px-4 py-2.5 font-medium text-right">Actions</th></tr></thead>
                  <tbody>
                    {nodes.map(n => (
                      <tr key={n.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-hover)]">
                        <td className="px-4 py-2 font-mono text-[var(--text-tertiary)]">{n.code || ''}</td>
                        <td className="px-4 py-2">
                          <span style={{ paddingLeft: `${n.level * 18}px` }} className={n.level === 0 ? 'font-semibold text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}>{n.level > 0 ? '↳ ' : ''}{n.name}</span>
                        </td>
                        <td className="px-4 py-2 text-[var(--text-tertiary)]">{n.system_name || '—'}</td>
                        <td className="px-4 py-2 text-right tabular-nums">{money(n.budget_cost)}</td>
                        <td className="px-4 py-2 text-right tabular-nums">{n.weight_pct || ''}</td>
                        <td className="px-4 py-2">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 rounded-full bg-[var(--surface-active)] overflow-hidden min-w-[50px]"><div className="h-full rounded-full" style={{ width: `${Math.min(100, n.progress_pct)}%`, background: n.progress_pct >= 100 ? 'var(--status-success-text)' : 'var(--accent)' }} /></div>
                            <span className="tabular-nums w-9 text-right">{Math.round(n.progress_pct)}%</span>
                          </div>
                        </td>
                        <td className="px-4 py-2">
                          <div className="flex items-center justify-end gap-1.5">
                            <button title="Add sub-item" onClick={() => openAdd(n.id)} className="p-1 rounded hover:bg-[var(--surface-active)] text-[var(--text-secondary)] cursor-pointer"><Plus size={13} /></button>
                            <button title="Edit" onClick={() => openEdit(n)} className="p-1 rounded hover:bg-[var(--surface-active)] text-[var(--text-secondary)] cursor-pointer"><Pencil size={13} /></button>
                            <button title="Delete" onClick={() => del(n)} className="p-1 rounded hover:bg-[var(--surface-active)] text-[var(--status-danger-text)] cursor-pointer"><Trash2 size={13} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
        </Card>
      )}

      {show && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShow(false)}>
          <Card className="w-full max-w-lg p-5" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3"><h3 className="text-sm font-semibold text-[var(--text-primary)]">{editId ? 'Edit work package' : parentId ? 'Add sub-item' : 'Add root item'}</h3><button onClick={() => setShow(false)} className="cursor-pointer text-[var(--text-tertiary)]"><X size={16} /></button></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><label className="text-xs font-medium text-[var(--text-secondary)]">Name *</label><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full mt-1 px-3 h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm" /></div>
              <div><label className="text-xs font-medium text-[var(--text-secondary)]">Code</label><input value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} placeholder="1.2" className="w-full mt-1 px-3 h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm" /></div>
              <div><label className="text-xs font-medium text-[var(--text-secondary)]">System</label><input value={form.system_name} onChange={e => setForm({ ...form, system_name: e.target.value })} className="w-full mt-1 px-3 h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm" /></div>
              <div><label className="text-xs font-medium text-[var(--text-secondary)]">Budget (AED)</label><input type="number" value={form.budget_cost} onChange={e => setForm({ ...form, budget_cost: e.target.value })} className="w-full mt-1 px-3 h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm text-right" /></div>
              <div><label className="text-xs font-medium text-[var(--text-secondary)]">Weight %</label><input type="number" value={form.weight_pct} onChange={e => setForm({ ...form, weight_pct: e.target.value })} className="w-full mt-1 px-3 h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm text-right" /></div>
              <div><label className="text-xs font-medium text-[var(--text-secondary)]">Progress % (leaf)</label><input type="number" min="0" max="100" value={form.progress_pct} onChange={e => setForm({ ...form, progress_pct: e.target.value })} className="w-full mt-1 px-3 h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm text-right" /></div>
              <div><label className="text-xs font-medium text-[var(--text-secondary)]">Planned start</label><input type="date" value={form.planned_start} onChange={e => setForm({ ...form, planned_start: e.target.value })} className="w-full mt-1 px-3 h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm" /></div>
              <div><label className="text-xs font-medium text-[var(--text-secondary)]">Planned end</label><input type="date" value={form.planned_end} onChange={e => setForm({ ...form, planned_end: e.target.value })} className="w-full mt-1 px-3 h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm" /></div>
            </div>
            <p className="text-[11px] text-[var(--text-tertiary)] mt-2">Progress % applies to leaf items; parent progress is rolled up (budget-weighted).</p>
            <div className="flex justify-end gap-2 mt-3"><Button variant="secondary" size="sm" onClick={() => setShow(false)}>Cancel</Button><Button variant="primary" size="sm" isLoading={busy} disabled={!form.name.trim()} onClick={save}>{editId ? 'Save' : 'Add'}</Button></div>
          </Card>
        </div>
      )}
    </div>
  );
}
