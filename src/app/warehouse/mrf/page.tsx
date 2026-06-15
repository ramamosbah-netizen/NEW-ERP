'use client';

// ============================================================
// JEET ERP — Warehouse: Material Requisition (MRF) list
// Surfaces mrfService: raise a requisition from a project, then
// approve / issue on the detail page.
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import mrfService from '@/services/mrfService';
import stockService from '@/services/stockService';
import warehouseService from '@/services/warehouseService';
import { supabase } from '@/lib/supabase';
import type { MaterialRequisition, MRFStatus } from '@/types/stock.types';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ClipboardList, Plus, Trash2 } from 'lucide-react';

const STATUSES: MRFStatus[] = ['DRAFT', 'SUBMITTED', 'APPROVED', 'PARTIALLY_ISSUED', 'ISSUED', 'REJECTED'];
const statusStyle: Record<string, { bg: string; tx: string }> = {
  DRAFT: { bg: 'var(--status-neutral-bg)', tx: 'var(--status-neutral-text)' },
  SUBMITTED: { bg: 'var(--status-info-bg)', tx: 'var(--status-info-text)' },
  APPROVED: { bg: 'var(--status-success-bg)', tx: 'var(--status-success-text)' },
  PARTIALLY_ISSUED: { bg: 'var(--status-warning-bg)', tx: 'var(--status-warning-text)' },
  ISSUED: { bg: 'var(--status-success-bg)', tx: 'var(--status-success-text)' },
  REJECTED: { bg: 'var(--status-danger-bg)', tx: 'var(--status-danger-text)' },
};

interface LineDraft { stock_item_id: string; qty_requested: string; notes: string; }

export default function MRFListPage() {
  const router = useRouter();
  const [mrfs, setMrfs] = useState<MaterialRequisition[]>([]);
  const [projects, setProjects] = useState<{ id: string; label: string }[]>([]);
  const [locations, setLocations] = useState<{ id: string; name: string; location_code: string }[]>([]);
  const [items, setItems] = useState<{ id: string; item_code?: string; description?: string; unit?: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [projectFilter, setProjectFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [modal, setModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ project_id: '', location_id: '', needed_by: '', notes: '' });
  const [lines, setLines] = useState<LineDraft[]>([{ stock_item_id: '', qty_requested: '', notes: '' }]);

  useEffect(() => {
    supabase.from('projects').select('id, project_number, name').order('project_number', { ascending: false })
      .then(({ data }) => setProjects((data || []).map((p: any) => ({ id: p.id, label: `${p.project_number} — ${p.name}` }))));
    warehouseService.getLocations().then(setLocations).catch(() => {});
    stockService.getStockItems().then(d => setItems(d as any)).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try { setMrfs(await mrfService.getMRFs({ project_id: projectFilter || undefined, status: (statusFilter || undefined) as MRFStatus | undefined })); }
    finally { setLoading(false); }
  }, [projectFilter, statusFilter]);
  useEffect(() => { load(); }, [load]);

  const openNew = () => { setForm({ project_id: '', location_id: '', needed_by: '', notes: '' }); setLines([{ stock_item_id: '', qty_requested: '', notes: '' }]); setModal(true); };

  const save = async (status: 'DRAFT' | 'SUBMITTED') => {
    if (!form.project_id || !form.location_id) { alert('Project and source location are required.'); return; }
    const validLines = lines.filter(l => l.stock_item_id && Number(l.qty_requested) > 0);
    if (!validLines.length) { alert('Add at least one item with a quantity.'); return; }
    setSaving(true);
    try {
      const id = await mrfService.createMRF(
        { project_id: form.project_id, location_id: form.location_id, status, needed_by: form.needed_by || new Date().toISOString().slice(0, 10), notes: form.notes || null } as any,
        validLines.map(l => ({ stock_item_id: l.stock_item_id, qty_requested: Number(l.qty_requested), notes: l.notes || null })) as any
      );
      setModal(false);
      router.push(`/warehouse/mrf/${id}`);
    } catch (e: any) { alert(e?.message || 'Could not create MRF'); setSaving(false); }
  };

  const open = mrfs.filter(m => m.status !== 'ISSUED' && m.status !== 'REJECTED').length;
  const toApprove = mrfs.filter(m => m.status === 'SUBMITTED').length;
  const toIssue = mrfs.filter(m => m.status === 'APPROVED' || m.status === 'PARTIALLY_ISSUED').length;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Material Requisitions (MRF)"
        subtitle="Request materials from a store, approve quantities, and issue to projects"
        breadcrumbs={[{ label: 'Warehouse', href: '/warehouse' }, { label: 'Requisitions' }]}
        actions={<Button icon={Plus} onClick={openNew}>New MRF</Button>}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Open</div><div className="text-2xl font-bold mt-1">{open}</div></Card>
        <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Awaiting approval</div><div className="text-2xl font-bold mt-1" style={{ color: toApprove ? 'var(--status-info-text)' : 'var(--text-primary)' }}>{toApprove}</div></Card>
        <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Ready to issue</div><div className="text-2xl font-bold mt-1" style={{ color: toIssue ? 'var(--status-warning-text)' : 'var(--text-primary)' }}>{toIssue}</div></Card>
        <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Total</div><div className="text-2xl font-bold mt-1">{mrfs.length}</div></Card>
      </div>

      <Card className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
        <label className="text-xs text-[var(--text-secondary)]">Project
          <select value={projectFilter} onChange={e => setProjectFilter(e.target.value)} className="w-full mt-1 px-2 h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm"><option value="">All projects</option>{projects.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}</select>
        </label>
        <label className="text-xs text-[var(--text-secondary)]">Status
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="w-full mt-1 px-2 h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm"><option value="">All</option>{STATUSES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}</select>
        </label>
      </Card>

      {loading ? (
        <Card><div className="p-8 text-center text-sm text-[var(--text-tertiary)]">Loading…</div></Card>
      ) : mrfs.length === 0 ? (
        <Card><EmptyState icon={ClipboardList} title="No requisitions" description="Raise a material requisition to request stock for a project." /></Card>
      ) : (
        <Card className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-[var(--border)] text-left text-[var(--text-tertiary)] text-xs">
              <th className="p-3">MRF #</th><th className="p-3">Project</th><th className="p-3">From store</th><th className="p-3">Needed by</th><th className="p-3">Requester</th><th className="p-3">Status</th>
            </tr></thead>
            <tbody>
              {mrfs.map(m => { const st = statusStyle[m.status] || statusStyle.DRAFT; return (
                <tr key={m.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-hover)] cursor-pointer" onClick={() => router.push(`/warehouse/mrf/${m.id}`)}>
                  <td className="p-3 font-medium text-[var(--text-primary)]">{m.mrf_number}</td>
                  <td className="p-3 text-xs text-[var(--text-secondary)]">{m.project_number || m.project_name || '—'}</td>
                  <td className="p-3 text-xs text-[var(--text-secondary)]">{m.location_name || '—'}</td>
                  <td className="p-3 text-xs text-[var(--text-secondary)]">{m.needed_by || '—'}</td>
                  <td className="p-3 text-xs text-[var(--text-secondary)]">{m.requester_name || '—'}</td>
                  <td className="p-3"><span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: st.bg, color: st.tx }}>{m.status.replace('_', ' ')}</span></td>
                </tr>
              ); })}
            </tbody>
          </table>
        </Card>
      )}

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setModal(false)}>
          <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] w-full max-w-2xl p-5 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="text-base font-semibold mb-3">New material requisition</div>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs text-[var(--text-secondary)]">Project
                <select value={form.project_id} onChange={e => setForm(f => ({ ...f, project_id: e.target.value }))} className="w-full mt-1 px-2 h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm"><option value="">Select…</option>{projects.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}</select>
              </label>
              <label className="text-xs text-[var(--text-secondary)]">From store (source)
                <select value={form.location_id} onChange={e => setForm(f => ({ ...f, location_id: e.target.value }))} className="w-full mt-1 px-2 h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm"><option value="">Select…</option>{locations.map(l => <option key={l.id} value={l.id}>{l.location_code} — {l.name}</option>)}</select>
              </label>
              <label className="text-xs text-[var(--text-secondary)]">Needed by
                <input type="date" value={form.needed_by} onChange={e => setForm(f => ({ ...f, needed_by: e.target.value }))} className="w-full mt-1 px-2 h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm" />
              </label>
              <label className="text-xs text-[var(--text-secondary)]">Notes
                <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="w-full mt-1 px-2 h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm" />
              </label>
            </div>

            <div className="mt-4 text-xs font-semibold text-[var(--text-primary)]">Items</div>
            <div className="flex flex-col gap-2 mt-2">
              {lines.map((l, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <select value={l.stock_item_id} onChange={e => setLines(ls => ls.map((x, j) => j === i ? { ...x, stock_item_id: e.target.value } : x))} className="flex-1 px-2 h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm">
                    <option value="">Select item…</option>{items.map(it => <option key={it.id} value={it.id}>{it.item_code} — {it.description}</option>)}
                  </select>
                  <input type="number" placeholder="Qty" value={l.qty_requested} onChange={e => setLines(ls => ls.map((x, j) => j === i ? { ...x, qty_requested: e.target.value } : x))} className="w-24 px-2 h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm" />
                  <button onClick={() => setLines(ls => ls.filter((_, j) => j !== i))} className="p-1 text-[var(--text-tertiary)] hover:text-[var(--status-danger-text)]"><Trash2 size={15} /></button>
                </div>
              ))}
              <button onClick={() => setLines(ls => [...ls, { stock_item_id: '', qty_requested: '', notes: '' }])} className="text-xs text-[var(--accent)] self-start">+ Add item</button>
            </div>

            <div className="flex justify-end gap-2 mt-4">
              <Button variant="secondary" onClick={() => setModal(false)}>Cancel</Button>
              <Button variant="secondary" onClick={() => save('DRAFT')} isLoading={saving}>Save draft</Button>
              <Button onClick={() => save('SUBMITTED')} isLoading={saving}>Submit</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
