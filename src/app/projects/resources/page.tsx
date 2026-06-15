'use client';

// ============================================================
// JEET ERP — Projects: Resource / Manpower Planning
// Allocate manpower/equipment/subcontractors per project, planned
// cost, and a cross-project utilization view (double-booking).
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import resourcePlanningService, { ResourceAllocation, ResourceType, ResourceStatus } from '@/services/resourcePlanningService';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { exportTablePdf, exportTableExcel } from '@/lib/finance-export';
import { Users, Plus, FileDown, Sheet, Trash2, Pencil, AlertTriangle } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

const aed = (n: number) => `AED ${Number(n || 0).toLocaleString('en-AE', { maximumFractionDigits: 0 })}`;
const TYPES: ResourceType[] = ['MANPOWER', 'EQUIPMENT', 'SUBCONTRACTOR'];
const STATUSES: ResourceStatus[] = ['PLANNED', 'ACTIVE', 'RELEASED'];

const statusStyle = (s: ResourceStatus) => ({
  PLANNED: { bg: 'var(--status-info-bg)', tx: 'var(--status-info-text)' },
  ACTIVE: { bg: 'var(--status-success-bg)', tx: 'var(--status-success-text)' },
  RELEASED: { bg: 'var(--surface-active)', tx: 'var(--text-tertiary)' },
}[s]);

interface FormState { resource_type: ResourceType; resource_name: string; trade: string; quantity: string; unit: string; start_date: string; end_date: string; daily_rate: string; status: ResourceStatus; notes: string; }
const emptyForm: FormState = { resource_type: 'MANPOWER', resource_name: '', trade: '', quantity: '1', unit: 'persons', start_date: '', end_date: '', daily_rate: '0', status: 'PLANNED', notes: '' };

export default function ResourcePlanningPage() {
  const [userName, setUserName] = useState<string | null>(null);
  const [projects, setProjects] = useState<{ id: string; label: string }[]>([]);
  const [projectId, setProjectId] = useState('');
  const [rows, setRows] = useState<ResourceAllocation[]>([]);
  const [util, setUtil] = useState<{ resource_name: string; resource_type: ResourceType; total_qty: number; projects: number; overbooked: boolean }[]>([]);
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from('projects').select('id, project_number, name').order('project_number', { ascending: false })
      .then(({ data }) => setProjects((data || []).map((p: any) => ({ id: p.id, label: `${p.project_number} — ${p.name}` }))));
    resourcePlanningService.utilization().then(setUtil).catch(() => {});
    supabase.auth.getUser().then(({ data }) => setUserName((data.user?.user_metadata?.name as string) || data.user?.email || null));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try { setRows(await resourcePlanningService.list(projectId ? { projectId } : undefined)); } finally { setLoading(false); }
  }, [projectId]);
  useEffect(() => { load(); }, [load]);

  const openNew = () => { setEditId(null); setForm({ ...emptyForm }); setModal(true); };
  const openEdit = (r: ResourceAllocation) => {
    setEditId(r.id);
    setForm({ resource_type: r.resource_type, resource_name: r.resource_name, trade: r.trade || '', quantity: String(r.quantity), unit: r.unit, start_date: r.start_date || '', end_date: r.end_date || '', daily_rate: String(r.daily_rate), status: r.status, notes: r.notes || '' });
    setModal(true);
  };

  const save = async () => {
    if (!projectId && !editId) { alert('Select a project first.'); return; }
    if (!form.resource_name.trim()) { alert('Resource name is required.'); return; }
    setSaving(true);
    try {
      const patch = {
        resource_type: form.resource_type, resource_name: form.resource_name.trim(), trade: form.trade.trim() || null,
        quantity: Number(form.quantity) || 0, unit: form.unit, start_date: form.start_date || null, end_date: form.end_date || null,
        daily_rate: Number(form.daily_rate) || 0, status: form.status, notes: form.notes.trim() || null,
      };
      if (editId) await resourcePlanningService.update(editId, patch);
      else await resourcePlanningService.create({ ...patch, project_id: projectId, created_by_name: userName } as any);
      setModal(false);
      await load();
      resourcePlanningService.utilization().then(setUtil).catch(() => {});
    } catch (e: any) { alert(e?.message || 'Save failed'); } finally { setSaving(false); }
  };

  const del = async (r: ResourceAllocation) => {
    if (!confirm(`Remove allocation "${r.resource_name}"?`)) return;
    await resourcePlanningService.remove(r.id);
    await load();
    resourcePlanningService.utilization().then(setUtil).catch(() => {});
  };

  const totalManpower = rows.filter(r => r.resource_type === 'MANPOWER' && r.status !== 'RELEASED').reduce((s, r) => s + r.quantity, 0);
  const totalCost = rows.filter(r => r.status !== 'RELEASED').reduce((s, r) => s + r.planned_cost, 0);

  // chart: planned cost by resource (top 8)
  const chartData = [...rows].filter(r => r.status !== 'RELEASED').sort((a, b) => b.planned_cost - a.planned_cost).slice(0, 8)
    .map(r => ({ name: r.resource_name.slice(0, 14), cost: r.planned_cost }));

  const exportCols = ['Project', 'Type', 'Resource', 'Trade', 'Qty', 'Unit', 'Start', 'End', 'Days', 'Daily rate', 'Planned cost', 'Status'];
  const exportRows = rows.map(r => [r.project_label || '', r.resource_type, r.resource_name, r.trade || '', r.quantity, r.unit, r.start_date || '', r.end_date || '', r.days, r.daily_rate, r.planned_cost, r.status]);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Resource & Manpower Planning"
        subtitle="Allocate manpower, equipment and subcontractors; track planned cost and utilization"
        breadcrumbs={[{ label: 'Projects', href: '/projects' }, { label: 'Resources' }]}
        actions={
          <div className="flex gap-2">
            {rows.length > 0 && <>
              <Button variant="secondary" icon={FileDown} onClick={() => exportTablePdf({ title: 'Resource Allocations', columns: exportCols, rows: exportRows, fileName: 'resource-allocations' })}>PDF</Button>
              <Button variant="secondary" icon={Sheet} onClick={() => exportTableExcel({ title: 'Resource Allocations', columns: exportCols, rows: exportRows, fileName: 'resource-allocations' })}>Excel</Button>
            </>}
            <Button icon={Plus} onClick={openNew}>Allocate</Button>
          </div>
        }
      />

      {/* Utilization (cross-project) */}
      {util.length > 0 && (
        <Card className="p-4">
          <div className="text-sm font-semibold text-[var(--text-primary)] mb-2">Today&apos;s utilization (all projects)</div>
          <div className="flex flex-wrap gap-2">
            {util.map((u, i) => (
              <span key={i} className="text-[11px] px-2 py-1 rounded border inline-flex items-center gap-1"
                style={{ borderColor: u.overbooked ? 'var(--status-danger-border)' : 'var(--border)', background: u.overbooked ? 'var(--status-danger-bg)' : 'var(--surface)', color: u.overbooked ? 'var(--status-danger-text)' : 'var(--text-secondary)' }}>
                {u.overbooked && <AlertTriangle size={11} />}{u.resource_name}: {u.total_qty}{u.projects > 1 ? ` · ${u.projects} projects` : ''}
              </span>
            ))}
          </div>
          <p className="text-[10px] text-[var(--text-tertiary)] mt-2">Items in red are committed to more than one project today (possible double-booking).</p>
        </Card>
      )}

      <Card className="p-4">
        <label className="text-xs font-medium text-[var(--text-secondary)]">Project filter</label>
        <select value={projectId} onChange={e => setProjectId(e.target.value)} className="w-full md:max-w-md mt-1 px-3 h-10 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm">
          <option value="">All projects</option>{projects.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
        </select>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Allocations</div><div className="text-2xl font-bold mt-1">{rows.length}</div></Card>
        <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Manpower (active+planned)</div><div className="text-2xl font-bold mt-1">{totalManpower}</div></Card>
        <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Planned cost</div><div className="text-2xl font-bold mt-1">{aed(totalCost)}</div></Card>
      </div>

      {chartData.length > 0 && (
        <Card className="p-4">
          <div className="text-sm font-semibold text-[var(--text-primary)] mb-3">Planned cost by resource</div>
          <div style={{ width: '100%', height: 240 }}>
            <ResponsiveContainer>
              <BarChart data={chartData} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} />
                <Tooltip formatter={(v: any) => aed(v)} />
                <Bar dataKey="cost" fill="var(--accent)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {loading ? (
        <Card><div className="p-8 text-center text-sm text-[var(--text-tertiary)]">Loading…</div></Card>
      ) : rows.length === 0 ? (
        <Card><EmptyState icon={Users} title="No allocations" description="Allocate manpower, equipment or subcontractors to a project." /></Card>
      ) : (
        <Card className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-[var(--border)] text-left text-[var(--text-tertiary)] text-xs">
              {!projectId && <th className="p-3">Project</th>}
              <th className="p-3">Type</th><th className="p-3">Resource</th><th className="p-3">Qty</th>
              <th className="p-3">Window</th><th className="p-3 text-right">Days</th><th className="p-3 text-right">Daily rate</th>
              <th className="p-3 text-right">Planned cost</th><th className="p-3">Status</th><th className="p-3"></th>
            </tr></thead>
            <tbody>
              {rows.map(r => {
                const st = statusStyle(r.status);
                return (
                  <tr key={r.id} className="border-b border-[var(--border)] last:border-0">
                    {!projectId && <td className="p-3 text-xs text-[var(--text-tertiary)]">{r.project_label}</td>}
                    <td className="p-3 text-xs">{r.resource_type}</td>
                    <td className="p-3 text-[var(--text-primary)]">{r.resource_name}{r.trade ? <span className="text-[var(--text-tertiary)]"> · {r.trade}</span> : ''}</td>
                    <td className="p-3 tabular-nums">{r.quantity} {r.unit}</td>
                    <td className="p-3 text-xs text-[var(--text-secondary)]">{r.start_date || '—'} → {r.end_date || '—'}</td>
                    <td className="p-3 text-right tabular-nums">{r.days}</td>
                    <td className="p-3 text-right tabular-nums">{aed(r.daily_rate)}</td>
                    <td className="p-3 text-right tabular-nums font-medium">{aed(r.planned_cost)}</td>
                    <td className="p-3"><span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: st.bg, color: st.tx }}>{r.status}</span></td>
                    <td className="p-3 text-right whitespace-nowrap">
                      <button onClick={() => openEdit(r)} className="p-1 text-[var(--text-tertiary)] hover:text-[var(--accent)]"><Pencil size={15} /></button>
                      <button onClick={() => del(r)} className="p-1 text-[var(--text-tertiary)] hover:text-[var(--status-danger-text)]"><Trash2 size={15} /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setModal(false)}>
          <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] w-full max-w-lg p-5 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="text-base font-semibold mb-3">{editId ? 'Edit allocation' : 'New allocation'}</div>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs text-[var(--text-secondary)]">Type
                <select value={form.resource_type} onChange={e => setForm(f => ({ ...f, resource_type: e.target.value as ResourceType }))} className="w-full mt-1 px-2 h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm">
                  {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </label>
              <label className="text-xs text-[var(--text-secondary)]">Status
                <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as ResourceStatus }))} className="w-full mt-1 px-2 h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm">
                  {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </label>
              <label className="text-xs text-[var(--text-secondary)] col-span-2">Resource name
                <input value={form.resource_name} onChange={e => setForm(f => ({ ...f, resource_name: e.target.value }))} placeholder="Electrician / Crane 50T / ABC Subcontract" className="w-full mt-1 px-2 h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm" />
              </label>
              <label className="text-xs text-[var(--text-secondary)]">Trade (optional)
                <input value={form.trade} onChange={e => setForm(f => ({ ...f, trade: e.target.value }))} className="w-full mt-1 px-2 h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm" />
              </label>
              <label className="text-xs text-[var(--text-secondary)]">Unit
                <input value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))} className="w-full mt-1 px-2 h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm" />
              </label>
              <label className="text-xs text-[var(--text-secondary)]">Quantity
                <input type="number" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} className="w-full mt-1 px-2 h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm" />
              </label>
              <label className="text-xs text-[var(--text-secondary)]">Daily rate (AED)
                <input type="number" value={form.daily_rate} onChange={e => setForm(f => ({ ...f, daily_rate: e.target.value }))} className="w-full mt-1 px-2 h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm" />
              </label>
              <label className="text-xs text-[var(--text-secondary)]">Start date
                <input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} className="w-full mt-1 px-2 h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm" />
              </label>
              <label className="text-xs text-[var(--text-secondary)]">End date
                <input type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} className="w-full mt-1 px-2 h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm" />
              </label>
              <label className="text-xs text-[var(--text-secondary)] col-span-2">Notes
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} className="w-full mt-1 px-2 py-1 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm" />
              </label>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="secondary" onClick={() => setModal(false)}>Cancel</Button>
              <Button onClick={save} isLoading={saving}>{editId ? 'Save' : 'Allocate'}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
