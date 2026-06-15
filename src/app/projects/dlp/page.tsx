'use client';

// ============================================================
// JEET ERP — Projects: DLP & Warranty Tracking
// Warranty register (with expiry reminders) + DLP-period defects.
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import warrantyService, { Warranty, WarrantyType, WarrantyStatus, DlpDefect, DefectSeverity, DefectStatus } from '@/services/warrantyService';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { exportTablePdf, exportTableExcel } from '@/lib/finance-export';
import { ShieldCheck, Plus, FileDown, Sheet, Trash2, Pencil, Wrench } from 'lucide-react';

const WTYPES: WarrantyType[] = ['DLP', 'MANUFACTURER', 'SUPPLIER', 'CONTRACTOR'];
const SEVERITIES: DefectSeverity[] = ['MINOR', 'MAJOR', 'CRITICAL'];
const DSTATUSES: DefectStatus[] = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];

const wStatusStyle = (s: WarrantyStatus) => ({
  ACTIVE: { bg: 'var(--status-success-bg)', tx: 'var(--status-success-text)', label: 'Active' },
  EXPIRING: { bg: 'var(--status-warning-bg)', tx: 'var(--status-warning-text)', label: 'Expiring' },
  EXPIRED: { bg: 'var(--status-danger-bg)', tx: 'var(--status-danger-text)', label: 'Expired' },
  NO_DATE: { bg: 'var(--surface-active)', tx: 'var(--text-tertiary)', label: 'No date' },
}[s]);

const sevStyle = (s: DefectSeverity) => ({
  MINOR: { bg: 'var(--status-info-bg)', tx: 'var(--status-info-text)' },
  MAJOR: { bg: 'var(--status-warning-bg)', tx: 'var(--status-warning-text)' },
  CRITICAL: { bg: 'var(--status-danger-bg)', tx: 'var(--status-danger-text)' },
}[s]);

type WForm = { item_name: string; warranty_type: WarrantyType; provider: string; start_date: string; end_date: string; duration_months: string; notes: string; };
const emptyW: WForm = { item_name: '', warranty_type: 'DLP', provider: '', start_date: '', end_date: '', duration_months: '12', notes: '' };
type DForm = { title: string; description: string; severity: DefectSeverity; reported_date: string; status: DefectStatus; assigned_to_name: string; warranty_id: string; notes: string; };
const emptyD: DForm = { title: '', description: '', severity: 'MINOR', reported_date: new Date().toISOString().slice(0, 10), status: 'OPEN', assigned_to_name: '', warranty_id: '', notes: '' };

export default function DlpWarrantyPage() {
  const [userName, setUserName] = useState<string | null>(null);
  const [projects, setProjects] = useState<{ id: string; label: string }[]>([]);
  const [projectId, setProjectId] = useState('');
  const [tab, setTab] = useState<'warranties' | 'defects'>('warranties');
  const [warranties, setWarranties] = useState<Warranty[]>([]);
  const [defects, setDefects] = useState<DlpDefect[]>([]);
  const [loading, setLoading] = useState(false);

  const [wModal, setWModal] = useState(false); const [wEditId, setWEditId] = useState<string | null>(null); const [wForm, setWForm] = useState<WForm>(emptyW);
  const [dModal, setDModal] = useState(false); const [dEditId, setDEditId] = useState<string | null>(null); const [dForm, setDForm] = useState<DForm>(emptyD);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from('projects').select('id, project_number, name').order('project_number', { ascending: false })
      .then(({ data }) => setProjects((data || []).map((p: any) => ({ id: p.id, label: `${p.project_number} — ${p.name}` }))));
    supabase.auth.getUser().then(({ data }) => setUserName((data.user?.user_metadata?.name as string) || data.user?.email || null));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const o = projectId ? { projectId } : undefined;
      const [w, d] = await Promise.all([warrantyService.listWarranties(o), warrantyService.listDefects(o)]);
      setWarranties(w); setDefects(d);
    } finally { setLoading(false); }
  }, [projectId]);
  useEffect(() => { load(); }, [load]);

  // ---- warranty CRUD ----
  const openWNew = () => { setWEditId(null); setWForm({ ...emptyW }); setWModal(true); };
  const openWEdit = (w: Warranty) => { setWEditId(w.id); setWForm({ item_name: w.item_name, warranty_type: w.warranty_type, provider: w.provider || '', start_date: w.start_date || '', end_date: w.end_date || '', duration_months: w.duration_months ? String(w.duration_months) : '', notes: w.notes || '' }); setWModal(true); };
  const saveW = async () => {
    if (!projectId && !wEditId) { alert('Select a project first.'); return; }
    if (!wForm.item_name.trim()) { alert('Item / system is required.'); return; }
    setSaving(true);
    try {
      const patch = { item_name: wForm.item_name.trim(), warranty_type: wForm.warranty_type, provider: wForm.provider.trim() || null, start_date: wForm.start_date || null, end_date: wForm.end_date || null, duration_months: wForm.duration_months ? Number(wForm.duration_months) : null, notes: wForm.notes.trim() || null };
      if (wEditId) await warrantyService.updateWarranty(wEditId, patch as any);
      else await warrantyService.createWarranty({ ...patch, project_id: projectId, created_by_name: userName } as any);
      setWModal(false); await load();
    } catch (e: any) { alert(e?.message || 'Save failed'); } finally { setSaving(false); }
  };
  const delW = async (w: Warranty) => { if (!confirm(`Remove warranty "${w.item_name}"?`)) return; await warrantyService.removeWarranty(w.id); await load(); };

  // ---- defect CRUD ----
  const openDNew = () => { setDEditId(null); setDForm({ ...emptyD }); setDModal(true); };
  const openDEdit = (d: DlpDefect) => { setDEditId(d.id); setDForm({ title: d.title, description: d.description || '', severity: d.severity, reported_date: d.reported_date || '', status: d.status, assigned_to_name: d.assigned_to_name || '', warranty_id: d.warranty_id || '', notes: d.notes || '' }); setDModal(true); };
  const saveD = async () => {
    if (!projectId && !dEditId) { alert('Select a project first.'); return; }
    if (!dForm.title.trim()) { alert('Defect title is required.'); return; }
    setSaving(true);
    try {
      const patch = { title: dForm.title.trim(), description: dForm.description.trim() || null, severity: dForm.severity, reported_date: dForm.reported_date || null, status: dForm.status, assigned_to_name: dForm.assigned_to_name.trim() || null, warranty_id: dForm.warranty_id || null, notes: dForm.notes.trim() || null };
      if (dEditId) await warrantyService.updateDefect(dEditId, patch as any);
      else await warrantyService.createDefect({ ...patch, project_id: projectId, created_by_name: userName } as any);
      setDModal(false); await load();
    } catch (e: any) { alert(e?.message || 'Save failed'); } finally { setSaving(false); }
  };
  const delD = async (d: DlpDefect) => { if (!confirm(`Remove defect "${d.title}"?`)) return; await warrantyService.removeDefect(d.id); await load(); };

  const expiringSoon = warranties.filter(w => w.status === 'EXPIRING').length;
  const expired = warranties.filter(w => w.status === 'EXPIRED').length;
  const openDefects = defects.filter(d => d.status !== 'CLOSED').length;

  const wCols = ['Project', 'Item', 'Type', 'Provider', 'Start', 'End', 'Days to expiry', 'Status'];
  const wRows = warranties.map(w => [w.project_label || '', w.item_name, w.warranty_type, w.provider || '', w.start_date || '', w.end_date || '', w.days_to_expiry ?? '', wStatusStyle(w.status).label]);
  const dCols = ['Ref', 'Project', 'Title', 'Severity', 'Reported', 'Status', 'Assigned', 'Resolved'];
  const dRows = defects.map(d => [d.ref_code || '', d.project_label || '', d.title, d.severity, d.reported_date || '', d.status, d.assigned_to_name || '', d.resolved_date || '']);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="DLP & Warranty Tracking"
        subtitle="Warranty register with expiry reminders, plus defects raised during the DLP period"
        breadcrumbs={[{ label: 'Projects', href: '/projects' }, { label: 'DLP & Warranty' }]}
        actions={
          <div className="flex gap-2">
            {tab === 'warranties' ? <>
              {warranties.length > 0 && <>
                <Button variant="secondary" icon={FileDown} onClick={() => exportTablePdf({ title: 'Warranty Register', columns: wCols, rows: wRows, fileName: 'warranty-register' })}>PDF</Button>
                <Button variant="secondary" icon={Sheet} onClick={() => exportTableExcel({ title: 'Warranty Register', columns: wCols, rows: wRows, fileName: 'warranty-register' })}>Excel</Button>
              </>}
              <Button icon={Plus} onClick={openWNew}>Add warranty</Button>
            </> : <>
              {defects.length > 0 && <>
                <Button variant="secondary" icon={FileDown} onClick={() => exportTablePdf({ title: 'DLP Defects', columns: dCols, rows: dRows, fileName: 'dlp-defects' })}>PDF</Button>
                <Button variant="secondary" icon={Sheet} onClick={() => exportTableExcel({ title: 'DLP Defects', columns: dCols, rows: dRows, fileName: 'dlp-defects' })}>Excel</Button>
              </>}
              <Button icon={Plus} onClick={openDNew}>Log defect</Button>
            </>}
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
        <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Warranties</div><div className="text-2xl font-bold mt-1">{warranties.length}</div></Card>
        <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Expiring ≤30d</div><div className="text-2xl font-bold mt-1" style={{ color: expiringSoon ? 'var(--status-warning-text)' : 'var(--text-primary)' }}>{expiringSoon}</div></Card>
        <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Expired</div><div className="text-2xl font-bold mt-1" style={{ color: expired ? 'var(--status-danger-text)' : 'var(--text-primary)' }}>{expired}</div></Card>
        <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Open DLP defects</div><div className="text-2xl font-bold mt-1" style={{ color: openDefects ? 'var(--status-danger-text)' : 'var(--text-primary)' }}>{openDefects}</div></Card>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[var(--border)]">
        {(['warranties', 'defects'] as const).map(tk => (
          <button key={tk} onClick={() => setTab(tk)} className="px-4 py-2 text-sm font-medium border-b-2 -mb-px" style={{ borderColor: tab === tk ? 'var(--accent)' : 'transparent', color: tab === tk ? 'var(--accent)' : 'var(--text-tertiary)' }}>
            {tk === 'warranties' ? 'Warranty register' : 'DLP defects'}
          </button>
        ))}
      </div>

      {loading ? (
        <Card><div className="p-8 text-center text-sm text-[var(--text-tertiary)]">Loading…</div></Card>
      ) : tab === 'warranties' ? (
        warranties.length === 0 ? (
          <Card><EmptyState icon={ShieldCheck} title="No warranties" description="Record DLP, manufacturer or supplier warranties to track expiry." /></Card>
        ) : (
          <Card className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-[var(--border)] text-left text-[var(--text-tertiary)] text-xs">
                {!projectId && <th className="p-3">Project</th>}<th className="p-3">Item / system</th><th className="p-3">Type</th>
                <th className="p-3">Provider</th><th className="p-3">Period</th><th className="p-3 text-right">Days left</th><th className="p-3">Status</th><th className="p-3"></th>
              </tr></thead>
              <tbody>
                {warranties.map(w => { const st = wStatusStyle(w.status); return (
                  <tr key={w.id} className="border-b border-[var(--border)] last:border-0">
                    {!projectId && <td className="p-3 text-xs text-[var(--text-tertiary)]">{w.project_label}</td>}
                    <td className="p-3 text-[var(--text-primary)]">{w.item_name}</td>
                    <td className="p-3 text-xs">{w.warranty_type}</td>
                    <td className="p-3 text-xs text-[var(--text-secondary)]">{w.provider || '—'}</td>
                    <td className="p-3 text-xs text-[var(--text-secondary)]">{w.start_date || '—'} → {w.end_date || '—'}</td>
                    <td className="p-3 text-right tabular-nums text-xs">{w.days_to_expiry ?? '—'}</td>
                    <td className="p-3"><span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: st.bg, color: st.tx }}>{st.label}</span></td>
                    <td className="p-3 text-right whitespace-nowrap">
                      <button onClick={() => openWEdit(w)} className="p-1 text-[var(--text-tertiary)] hover:text-[var(--accent)]"><Pencil size={15} /></button>
                      <button onClick={() => delW(w)} className="p-1 text-[var(--text-tertiary)] hover:text-[var(--status-danger-text)]"><Trash2 size={15} /></button>
                    </td>
                  </tr>
                ); })}
              </tbody>
            </table>
          </Card>
        )
      ) : (
        defects.length === 0 ? (
          <Card><EmptyState icon={Wrench} title="No DLP defects" description="Log defects reported during the defects-liability period." /></Card>
        ) : (
          <Card className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-[var(--border)] text-left text-[var(--text-tertiary)] text-xs">
                <th className="p-3">Ref</th>{!projectId && <th className="p-3">Project</th>}<th className="p-3">Defect</th>
                <th className="p-3">Severity</th><th className="p-3">Reported</th><th className="p-3">Status</th><th className="p-3">Assigned</th><th className="p-3"></th>
              </tr></thead>
              <tbody>
                {defects.map(d => { const sv = sevStyle(d.severity); return (
                  <tr key={d.id} className="border-b border-[var(--border)] last:border-0">
                    <td className="p-3 text-xs text-[var(--text-tertiary)]">{d.ref_code}</td>
                    {!projectId && <td className="p-3 text-xs text-[var(--text-tertiary)]">{d.project_label}</td>}
                    <td className="p-3 text-[var(--text-primary)]">{d.title}</td>
                    <td className="p-3"><span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: sv.bg, color: sv.tx }}>{d.severity}</span></td>
                    <td className="p-3 text-xs text-[var(--text-secondary)]">{d.reported_date || '—'}</td>
                    <td className="p-3 text-xs">{d.status}{d.resolved_date ? <span className="text-[var(--text-tertiary)]"> · {d.resolved_date}</span> : ''}</td>
                    <td className="p-3 text-xs text-[var(--text-secondary)]">{d.assigned_to_name || '—'}</td>
                    <td className="p-3 text-right whitespace-nowrap">
                      <button onClick={() => openDEdit(d)} className="p-1 text-[var(--text-tertiary)] hover:text-[var(--accent)]"><Pencil size={15} /></button>
                      <button onClick={() => delD(d)} className="p-1 text-[var(--text-tertiary)] hover:text-[var(--status-danger-text)]"><Trash2 size={15} /></button>
                    </td>
                  </tr>
                ); })}
              </tbody>
            </table>
          </Card>
        )
      )}

      {/* Warranty modal */}
      {wModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setWModal(false)}>
          <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] w-full max-w-lg p-5 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="text-base font-semibold mb-3">{wEditId ? 'Edit warranty' : 'New warranty'}</div>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs text-[var(--text-secondary)] col-span-2">Item / system
                <input value={wForm.item_name} onChange={e => setWForm(f => ({ ...f, item_name: e.target.value }))} placeholder="CCTV system / Crane / Civil works" className="w-full mt-1 px-2 h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm" />
              </label>
              <label className="text-xs text-[var(--text-secondary)]">Type
                <select value={wForm.warranty_type} onChange={e => setWForm(f => ({ ...f, warranty_type: e.target.value as WarrantyType }))} className="w-full mt-1 px-2 h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm">{WTYPES.map(t => <option key={t} value={t}>{t}</option>)}</select>
              </label>
              <label className="text-xs text-[var(--text-secondary)]">Provider
                <input value={wForm.provider} onChange={e => setWForm(f => ({ ...f, provider: e.target.value }))} className="w-full mt-1 px-2 h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm" />
              </label>
              <label className="text-xs text-[var(--text-secondary)]">Start date
                <input type="date" value={wForm.start_date} onChange={e => setWForm(f => ({ ...f, start_date: e.target.value }))} className="w-full mt-1 px-2 h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm" />
              </label>
              <label className="text-xs text-[var(--text-secondary)]">Duration (months)
                <input type="number" value={wForm.duration_months} onChange={e => setWForm(f => ({ ...f, duration_months: e.target.value }))} className="w-full mt-1 px-2 h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm" />
              </label>
              <label className="text-xs text-[var(--text-secondary)] col-span-2">End date <span className="text-[var(--text-tertiary)]">(auto from start + duration if blank)</span>
                <input type="date" value={wForm.end_date} onChange={e => setWForm(f => ({ ...f, end_date: e.target.value }))} className="w-full mt-1 px-2 h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm" />
              </label>
              <label className="text-xs text-[var(--text-secondary)] col-span-2">Notes
                <textarea value={wForm.notes} onChange={e => setWForm(f => ({ ...f, notes: e.target.value }))} rows={2} className="w-full mt-1 px-2 py-1 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm" />
              </label>
            </div>
            <div className="flex justify-end gap-2 mt-4"><Button variant="secondary" onClick={() => setWModal(false)}>Cancel</Button><Button onClick={saveW} isLoading={saving}>{wEditId ? 'Save' : 'Add'}</Button></div>
          </div>
        </div>
      )}

      {/* Defect modal */}
      {dModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setDModal(false)}>
          <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] w-full max-w-lg p-5 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="text-base font-semibold mb-3">{dEditId ? 'Edit DLP defect' : 'Log DLP defect'}</div>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs text-[var(--text-secondary)] col-span-2">Title
                <input value={dForm.title} onChange={e => setDForm(f => ({ ...f, title: e.target.value }))} className="w-full mt-1 px-2 h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm" />
              </label>
              <label className="text-xs text-[var(--text-secondary)]">Severity
                <select value={dForm.severity} onChange={e => setDForm(f => ({ ...f, severity: e.target.value as DefectSeverity }))} className="w-full mt-1 px-2 h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm">{SEVERITIES.map(s => <option key={s} value={s}>{s}</option>)}</select>
              </label>
              <label className="text-xs text-[var(--text-secondary)]">Status
                <select value={dForm.status} onChange={e => setDForm(f => ({ ...f, status: e.target.value as DefectStatus }))} className="w-full mt-1 px-2 h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm">{DSTATUSES.map(s => <option key={s} value={s}>{s}</option>)}</select>
              </label>
              <label className="text-xs text-[var(--text-secondary)]">Reported date
                <input type="date" value={dForm.reported_date} onChange={e => setDForm(f => ({ ...f, reported_date: e.target.value }))} className="w-full mt-1 px-2 h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm" />
              </label>
              <label className="text-xs text-[var(--text-secondary)]">Assigned to
                <input value={dForm.assigned_to_name} onChange={e => setDForm(f => ({ ...f, assigned_to_name: e.target.value }))} className="w-full mt-1 px-2 h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm" />
              </label>
              <label className="text-xs text-[var(--text-secondary)] col-span-2">Linked warranty (optional)
                <select value={dForm.warranty_id} onChange={e => setDForm(f => ({ ...f, warranty_id: e.target.value }))} className="w-full mt-1 px-2 h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm">
                  <option value="">—</option>{warranties.map(w => <option key={w.id} value={w.id}>{w.item_name} ({w.warranty_type})</option>)}
                </select>
              </label>
              <label className="text-xs text-[var(--text-secondary)] col-span-2">Description
                <textarea value={dForm.description} onChange={e => setDForm(f => ({ ...f, description: e.target.value }))} rows={2} className="w-full mt-1 px-2 py-1 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm" />
              </label>
            </div>
            <div className="flex justify-end gap-2 mt-4"><Button variant="secondary" onClick={() => setDModal(false)}>Cancel</Button><Button onClick={saveD} isLoading={saving}>{dEditId ? 'Save' : 'Log defect'}</Button></div>
          </div>
        </div>
      )}
    </div>
  );
}
