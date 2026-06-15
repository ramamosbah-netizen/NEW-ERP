'use client';

// ============================================================
// JEET ERP — Projects: RFI / SI / NCR register
// Requests for Information, Site Instructions, Non-Conformance.
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import siteRecordsService, { SiteRecord, SiteDocType, SitePriority, SiteStatus } from '@/services/siteRecordsService';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { exportTablePdf, exportTableExcel } from '@/lib/finance-export';
import { MessageSquare, Plus, FileDown, Sheet, Trash2, Pencil } from 'lucide-react';

const TYPES: SiteDocType[] = ['RFI', 'SI', 'NCR'];
const PRIORITIES: SitePriority[] = ['LOW', 'MEDIUM', 'HIGH'];
const STATUSES: SiteStatus[] = ['OPEN', 'IN_PROGRESS', 'ANSWERED', 'CLOSED', 'VOID'];
const aed = (n: number) => `AED ${Number(n || 0).toLocaleString('en-AE', { maximumFractionDigits: 0 })}`;

const typeLabel: Record<SiteDocType, string> = { RFI: 'RFIs', SI: 'Site Instructions', NCR: 'Non-Conformance' };
const prioStyle = (p: SitePriority) => ({ LOW: { bg: 'var(--status-info-bg)', tx: 'var(--status-info-text)' }, MEDIUM: { bg: 'var(--status-warning-bg)', tx: 'var(--status-warning-text)' }, HIGH: { bg: 'var(--status-danger-bg)', tx: 'var(--status-danger-text)' } }[p]);
const statusStyle = (s: SiteStatus) => ({
  OPEN: { bg: 'var(--status-info-bg)', tx: 'var(--status-info-text)' },
  IN_PROGRESS: { bg: 'var(--status-warning-bg)', tx: 'var(--status-warning-text)' },
  ANSWERED: { bg: 'var(--status-success-bg)', tx: 'var(--status-success-text)' },
  CLOSED: { bg: 'var(--surface-active)', tx: 'var(--text-tertiary)' },
  VOID: { bg: 'var(--surface-active)', tx: 'var(--text-tertiary)' },
}[s]);

type Form = { doc_type: SiteDocType; title: string; description: string; discipline: string; raised_by_name: string; directed_to: string; date_raised: string; date_required: string; priority: SitePriority; status: SiteStatus; response: string; cost_impact: string; time_impact_days: string; };
const emptyForm = (t: SiteDocType): Form => ({ doc_type: t, title: '', description: '', discipline: '', raised_by_name: '', directed_to: '', date_raised: new Date().toISOString().slice(0, 10), date_required: '', priority: 'MEDIUM', status: 'OPEN', response: '', cost_impact: '0', time_impact_days: '0' });

export default function SiteRecordsPage() {
  const [userName, setUserName] = useState<string | null>(null);
  const [projects, setProjects] = useState<{ id: string; label: string }[]>([]);
  const [projectId, setProjectId] = useState('');
  const [tab, setTab] = useState<SiteDocType | 'ALL'>('ALL');
  const [rows, setRows] = useState<SiteRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<Form>(emptyForm('RFI'));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from('projects').select('id, project_number, name').order('project_number', { ascending: false })
      .then(({ data }) => setProjects((data || []).map((p: any) => ({ id: p.id, label: `${p.project_number} — ${p.name}` }))));
    supabase.auth.getUser().then(({ data }) => setUserName((data.user?.user_metadata?.name as string) || data.user?.email || null));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try { setRows(await siteRecordsService.list({ projectId: projectId || undefined, docType: tab === 'ALL' ? undefined : tab })); } finally { setLoading(false); }
  }, [projectId, tab]);
  useEffect(() => { load(); }, [load]);

  const openNew = () => { setEditId(null); setForm(emptyForm(tab === 'ALL' ? 'RFI' : tab)); setModal(true); };
  const openEdit = (r: SiteRecord) => {
    setEditId(r.id);
    setForm({ doc_type: r.doc_type, title: r.title, description: r.description || '', discipline: r.discipline || '', raised_by_name: r.raised_by_name || '', directed_to: r.directed_to || '', date_raised: r.date_raised || '', date_required: r.date_required || '', priority: r.priority, status: r.status, response: r.response || '', cost_impact: String(r.cost_impact), time_impact_days: String(r.time_impact_days) });
    setModal(true);
  };

  const save = async () => {
    if (!projectId && !editId) { alert('Select a project first.'); return; }
    if (!form.title.trim()) { alert('Title is required.'); return; }
    setSaving(true);
    try {
      const patch = { doc_type: form.doc_type, title: form.title.trim(), description: form.description.trim() || null, discipline: form.discipline.trim() || null, raised_by_name: form.raised_by_name.trim() || null, directed_to: form.directed_to.trim() || null, date_raised: form.date_raised || null, date_required: form.date_required || null, priority: form.priority, status: form.status, response: form.response.trim() || null, cost_impact: Number(form.cost_impact) || 0, time_impact_days: Number(form.time_impact_days) || 0 };
      if (editId) await siteRecordsService.update(editId, patch as any);
      else await siteRecordsService.create({ ...patch, project_id: projectId, created_by_name: userName } as any);
      setModal(false); await load();
    } catch (e: any) { alert(e?.message || 'Save failed'); } finally { setSaving(false); }
  };
  const del = async (r: SiteRecord) => { if (!confirm(`Remove ${r.doc_type} "${r.title}"?`)) return; await siteRecordsService.remove(r.id); await load(); };

  const openCount = (t: SiteDocType) => rows.filter(r => r.doc_type === t && (r.status === 'OPEN' || r.status === 'IN_PROGRESS')).length;
  const overdue = rows.filter(r => r.overdue).length;
  const showCostCol = tab !== 'RFI';

  const exportCols = ['Type', 'Ref', 'Project', 'Title', 'Discipline', 'Directed to', 'Raised', 'Required', 'Priority', 'Status', 'Cost impact', 'Time (d)'];
  const exportRows = rows.map(r => [r.doc_type, r.ref_code || '', r.project_label || '', r.title, r.discipline || '', r.directed_to || '', r.date_raised || '', r.date_required || '', r.priority, r.status, r.cost_impact, r.time_impact_days]);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="RFI / SI / NCR Register"
        subtitle="Requests for Information, Site Instructions and Non-Conformance Reports"
        breadcrumbs={[{ label: 'Projects', href: '/projects' }, { label: 'RFI / SI / NCR' }]}
        actions={
          <div className="flex gap-2">
            {rows.length > 0 && <>
              <Button variant="secondary" icon={FileDown} onClick={() => exportTablePdf({ title: 'RFI / SI / NCR Register', columns: exportCols, rows: exportRows, fileName: 'site-records' })}>PDF</Button>
              <Button variant="secondary" icon={Sheet} onClick={() => exportTableExcel({ title: 'RFI / SI / NCR Register', columns: exportCols, rows: exportRows, fileName: 'site-records' })}>Excel</Button>
            </>}
            <Button icon={Plus} onClick={openNew}>New {tab === 'ALL' ? 'record' : tab}</Button>
          </div>
        }
      />

      <Card className="p-4">
        <label className="text-xs font-medium text-[var(--text-secondary)]">Project filter</label>
        <select value={projectId} onChange={e => setProjectId(e.target.value)} className="w-full md:max-w-md mt-1 px-3 h-10 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm">
          <option value="">All projects</option>{projects.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
        </select>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Open RFIs</div><div className="text-2xl font-bold mt-1">{openCount('RFI')}</div></Card>
        <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Open SIs</div><div className="text-2xl font-bold mt-1">{openCount('SI')}</div></Card>
        <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Open NCRs</div><div className="text-2xl font-bold mt-1">{openCount('NCR')}</div></Card>
        <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Overdue</div><div className="text-2xl font-bold mt-1" style={{ color: overdue ? 'var(--status-danger-text)' : 'var(--text-primary)' }}>{overdue}</div></Card>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[var(--border)] overflow-x-auto">
        {(['ALL', ...TYPES] as const).map(tk => (
          <button key={tk} onClick={() => setTab(tk)} className="px-4 py-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap" style={{ borderColor: tab === tk ? 'var(--accent)' : 'transparent', color: tab === tk ? 'var(--accent)' : 'var(--text-tertiary)' }}>
            {tk === 'ALL' ? 'All' : typeLabel[tk]}
          </button>
        ))}
      </div>

      {loading ? (
        <Card><div className="p-8 text-center text-sm text-[var(--text-tertiary)]">Loading…</div></Card>
      ) : rows.length === 0 ? (
        <Card><EmptyState icon={MessageSquare} title="No records" description="Raise an RFI, issue a Site Instruction, or log a Non-Conformance." /></Card>
      ) : (
        <Card className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-[var(--border)] text-left text-[var(--text-tertiary)] text-xs">
              {tab === 'ALL' && <th className="p-3">Type</th>}<th className="p-3">Ref</th>{!projectId && <th className="p-3">Project</th>}
              <th className="p-3">Title</th><th className="p-3">Directed to</th><th className="p-3">Required</th>
              <th className="p-3">Priority</th><th className="p-3">Status</th>{showCostCol && <th className="p-3 text-right">Cost / time</th>}<th className="p-3"></th>
            </tr></thead>
            <tbody>
              {rows.map(r => { const ps = prioStyle(r.priority); const ss = statusStyle(r.status); return (
                <tr key={r.id} className="border-b border-[var(--border)] last:border-0">
                  {tab === 'ALL' && <td className="p-3 text-xs font-medium">{r.doc_type}</td>}
                  <td className="p-3 text-xs text-[var(--text-tertiary)]">{r.ref_code}</td>
                  {!projectId && <td className="p-3 text-xs text-[var(--text-tertiary)]">{r.project_label}</td>}
                  <td className="p-3 text-[var(--text-primary)]"><div className="font-medium">{r.title}</div>{r.discipline && <div className="text-[11px] text-[var(--text-tertiary)]">{r.discipline}</div>}</td>
                  <td className="p-3 text-xs text-[var(--text-secondary)]">{r.directed_to || '—'}</td>
                  <td className="p-3 text-xs" style={{ color: r.overdue ? 'var(--status-danger-text)' : 'var(--text-secondary)' }}>{r.date_required || '—'}{r.overdue ? ' ⚠' : ''}</td>
                  <td className="p-3"><span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: ps.bg, color: ps.tx }}>{r.priority}</span></td>
                  <td className="p-3"><span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: ss.bg, color: ss.tx }}>{r.status}</span></td>
                  {showCostCol && <td className="p-3 text-right text-xs tabular-nums">{r.cost_impact ? aed(r.cost_impact) : '—'}{r.time_impact_days ? <span className="text-[var(--text-tertiary)]"> · {r.time_impact_days}d</span> : ''}</td>}
                  <td className="p-3 text-right whitespace-nowrap">
                    <button onClick={() => openEdit(r)} className="p-1 text-[var(--text-tertiary)] hover:text-[var(--accent)]"><Pencil size={15} /></button>
                    <button onClick={() => del(r)} className="p-1 text-[var(--text-tertiary)] hover:text-[var(--status-danger-text)]"><Trash2 size={15} /></button>
                  </td>
                </tr>
              ); })}
            </tbody>
          </table>
        </Card>
      )}

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setModal(false)}>
          <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] w-full max-w-lg p-5 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="text-base font-semibold mb-3">{editId ? `Edit ${form.doc_type}` : `New ${form.doc_type}`}</div>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs text-[var(--text-secondary)]">Type
                <select value={form.doc_type} onChange={e => setForm(f => ({ ...f, doc_type: e.target.value as SiteDocType }))} disabled={!!editId} className="w-full mt-1 px-2 h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm disabled:opacity-60">{TYPES.map(t => <option key={t} value={t}>{t}</option>)}</select>
              </label>
              <label className="text-xs text-[var(--text-secondary)]">Discipline
                <input value={form.discipline} onChange={e => setForm(f => ({ ...f, discipline: e.target.value }))} placeholder="CCTV / MEP / Civil" className="w-full mt-1 px-2 h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm" />
              </label>
              <label className="text-xs text-[var(--text-secondary)] col-span-2">Title
                <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="w-full mt-1 px-2 h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm" />
              </label>
              <label className="text-xs text-[var(--text-secondary)]">Raised by
                <input value={form.raised_by_name} onChange={e => setForm(f => ({ ...f, raised_by_name: e.target.value }))} className="w-full mt-1 px-2 h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm" />
              </label>
              <label className="text-xs text-[var(--text-secondary)]">Directed to
                <input value={form.directed_to} onChange={e => setForm(f => ({ ...f, directed_to: e.target.value }))} placeholder="Consultant / Client / Subcontractor" className="w-full mt-1 px-2 h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm" />
              </label>
              <label className="text-xs text-[var(--text-secondary)]">Date raised
                <input type="date" value={form.date_raised} onChange={e => setForm(f => ({ ...f, date_raised: e.target.value }))} className="w-full mt-1 px-2 h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm" />
              </label>
              <label className="text-xs text-[var(--text-secondary)]">Required by
                <input type="date" value={form.date_required} onChange={e => setForm(f => ({ ...f, date_required: e.target.value }))} className="w-full mt-1 px-2 h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm" />
              </label>
              <label className="text-xs text-[var(--text-secondary)]">Priority
                <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value as SitePriority }))} className="w-full mt-1 px-2 h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm">{PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}</select>
              </label>
              <label className="text-xs text-[var(--text-secondary)]">Status
                <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as SiteStatus }))} className="w-full mt-1 px-2 h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm">{STATUSES.map(s => <option key={s} value={s}>{s}</option>)}</select>
              </label>
              {form.doc_type !== 'RFI' && <>
                <label className="text-xs text-[var(--text-secondary)]">Cost impact (AED)
                  <input type="number" value={form.cost_impact} onChange={e => setForm(f => ({ ...f, cost_impact: e.target.value }))} className="w-full mt-1 px-2 h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm" />
                </label>
                <label className="text-xs text-[var(--text-secondary)]">Time impact (days)
                  <input type="number" value={form.time_impact_days} onChange={e => setForm(f => ({ ...f, time_impact_days: e.target.value }))} className="w-full mt-1 px-2 h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm" />
                </label>
              </>}
              <label className="text-xs text-[var(--text-secondary)] col-span-2">Description
                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} className="w-full mt-1 px-2 py-1 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm" />
              </label>
              <label className="text-xs text-[var(--text-secondary)] col-span-2">Response / closeout
                <textarea value={form.response} onChange={e => setForm(f => ({ ...f, response: e.target.value }))} rows={2} className="w-full mt-1 px-2 py-1 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm" />
              </label>
            </div>
            <div className="flex justify-end gap-2 mt-4"><Button variant="secondary" onClick={() => setModal(false)}>Cancel</Button><Button onClick={save} isLoading={saving}>{editId ? 'Save' : 'Create'}</Button></div>
          </div>
        </div>
      )}
    </div>
  );
}
