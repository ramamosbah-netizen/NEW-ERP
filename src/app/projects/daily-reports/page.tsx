'use client';

// ============================================================
// JEET ERP — Projects: Daily Site Reports (DSR)
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import dailySiteReportService, { DailySiteReport, ManpowerLine } from '@/services/dailySiteReportService';
import dailyReportPDF from '@/lib/daily-report-pdf';
import { runUploadPipeline } from '@/lib/document-upload-service';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ClipboardList, Plus, X, FileText, Check, Trash2, Paperclip } from 'lucide-react';

const WEATHER = ['SUNNY', 'CLOUDY', 'RAINY', 'WINDY', 'HOT', 'HUMID'];
const fmtDate = (d?: string | null) => d ? new Date(d).toLocaleDateString('en-AE', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

export default function DailySiteReportsPage() {
  const [rows, setRows] = useState<DailySiteReport[]>([]);
  const [projects, setProjects] = useState<{ id: string; label: string }[]>([]);
  const [projectFilter, setProjectFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [show, setShow] = useState(false);

  const blank = {
    project_id: '', report_date: new Date().toISOString().slice(0, 10), weather: 'SUNNY', temperature_c: '',
    work_done: '', materials_received: '', equipment_on_site: '', delays_issues: '', safety_notes: '', visitors: '', prepared_by_name: '',
  };
  const [form, setForm] = useState({ ...blank });
  const [manpower, setManpower] = useState<ManpowerLine[]>([{ trade: '', count: 0 }]);
  const [photos, setPhotos] = useState<{ id: string; name: string }[]>([]);

  const load = useCallback(async () => {
    try { setLoading(true); setRows(await dailySiteReportService.list({ projectId: projectFilter || undefined })); setError(null); }
    catch (e: any) { setError(e.message || 'Failed to load'); } finally { setLoading(false); }
  }, [projectFilter]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    supabase.from('projects').select('id, project_number, name').order('project_number', { ascending: false })
      .then(({ data }) => setProjects((data || []).map((p: any) => ({ id: p.id, label: `${p.project_number} — ${p.name}` }))));
  }, []);

  const totalMp = manpower.reduce((s, m) => s + (Number(m.count) || 0), 0);
  const weekStart = new Date(); weekStart.setDate(weekStart.getDate() - 7);
  const thisWeek = rows.filter(r => new Date(r.report_date) >= weekStart).length;
  const drafts = rows.filter(r => r.status === 'DRAFT').length;

  const reset = () => { setForm({ ...blank }); setManpower([{ trade: '', count: 0 }]); setPhotos([]); };

  const uploadPhotos = async (files: FileList | null) => {
    if (!files || !files.length) return;
    setUploading(true); setError(null);
    try {
      for (const file of Array.from(files)) {
        try {
          const doc = await runUploadPipeline(file, 'PROJECT', form.project_id || undefined, ['dsr', 'site-photo']);
          setPhotos(p => [...p, { id: doc.id, name: file.name }]);
        } catch (e: any) {
          const m = /^DUPLICATE_FOUND:([^:]+):(.*)$/.exec(e?.message || '');
          if (m) setPhotos(p => [...p, { id: m[1], name: m[2] || file.name }]);
        }
      }
    } finally { setUploading(false); }
  };

  const save = async (status: 'DRAFT' | 'SUBMITTED') => {
    if (!form.project_id) { setError('Select a project.'); return; }
    setBusy(true);
    try {
      await dailySiteReportService.create({
        project_id: form.project_id, report_date: form.report_date, weather: form.weather,
        temperature_c: form.temperature_c ? Number(form.temperature_c) : null,
        manpower, work_done: form.work_done, materials_received: form.materials_received,
        equipment_on_site: form.equipment_on_site, delays_issues: form.delays_issues,
        safety_notes: form.safety_notes, visitors: form.visitors, prepared_by_name: form.prepared_by_name,
        photo_document_ids: photos.map(p => p.id), status,
      });
      setShow(false); reset(); await load();
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  };

  const submit = async (r: DailySiteReport) => { await dailySiteReportService.setStatus(r.id, 'SUBMITTED'); await load(); };

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Daily Site Reports"
        subtitle="Per-day site log — manpower, weather, work done, materials, delays, safety and photos"
        breadcrumbs={[{ label: 'Projects', href: '/projects' }, { label: 'Daily Site Reports' }]}
        actions={<Button size="sm" variant="primary" icon={Plus} onClick={() => { reset(); setShow(true); }}>New report</Button>}
      />

      {error && <div className="flex items-center justify-between gap-3 bg-[var(--status-danger-bg)] border border-[var(--status-danger-border)] rounded-lg p-3 text-xs text-[var(--status-danger-text)]"><span>{error}</span><button onClick={() => setError(null)} className="cursor-pointer"><X size={13} /></button></div>}

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Card className="p-3.5"><div className="text-[11px] uppercase tracking-wide text-[var(--text-tertiary)]">Reports (7 days)</div><div className="text-lg font-semibold mt-1 tabular-nums">{thisWeek}</div></Card>
        <Card className="p-3.5"><div className="text-[11px] uppercase tracking-wide text-[var(--text-tertiary)]">Total reports</div><div className="text-lg font-semibold mt-1 tabular-nums">{rows.length}</div></Card>
        <Card className="p-3.5"><div className="text-[11px] uppercase tracking-wide text-[var(--text-tertiary)]">Open drafts</div><div className="text-lg font-semibold mt-1 tabular-nums" style={{ color: drafts ? 'var(--status-warning-text)' : 'var(--text-primary)' }}>{drafts}</div></Card>
      </div>

      <div className="max-w-sm">
        <select value={projectFilter} onChange={e => setProjectFilter(e.target.value)} className="w-full px-3 h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm">
          <option value="">All projects</option>{projects.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
        </select>
      </div>

      <Card className="overflow-hidden">
        {loading ? <div className="p-8 text-center text-sm text-[var(--text-tertiary)]">Loading…</div>
          : rows.length === 0 ? <EmptyState icon={ClipboardList} title="No site reports" description="Log a daily site report — manpower, work done, materials and photos." />
          : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead><tr className="border-b border-[var(--border)] text-left text-[var(--text-tertiary)]"><th className="px-4 py-2.5 font-medium">Date</th><th className="px-4 py-2.5 font-medium">Project</th><th className="px-4 py-2.5 font-medium">Weather</th><th className="px-4 py-2.5 font-medium text-right">Manpower</th><th className="px-4 py-2.5 font-medium">Photos</th><th className="px-4 py-2.5 font-medium">Status</th><th className="px-4 py-2.5 font-medium text-right">Actions</th></tr></thead>
                <tbody>
                  {rows.map(r => (
                    <tr key={r.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-hover)]">
                      <td className="px-4 py-2.5">{fmtDate(r.report_date)}</td>
                      <td className="px-4 py-2.5"><div className="font-medium text-[var(--text-primary)]">{r.project_number}</div><div className="text-[var(--text-tertiary)]">{r.project_name}</div></td>
                      <td className="px-4 py-2.5 text-[var(--text-secondary)]">{r.weather || '—'}{r.temperature_c != null ? ` ${r.temperature_c}°` : ''}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{r.total_manpower}</td>
                      <td className="px-4 py-2.5 text-[var(--text-tertiary)]">{r.photo_document_ids.length || '—'}</td>
                      <td className="px-4 py-2.5"><span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: r.status === 'SUBMITTED' ? 'var(--status-success-bg)' : 'var(--status-warning-bg)', color: r.status === 'SUBMITTED' ? 'var(--status-success-text)' : 'var(--status-warning-text)' }}>{r.status}</span></td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center justify-end gap-1.5">
                          <button title="PDF" onClick={() => dailyReportPDF.download(r)} className="p-1.5 rounded hover:bg-[var(--surface-active)] text-[var(--text-secondary)] cursor-pointer"><FileText size={14} /></button>
                          {r.status === 'DRAFT' && <button title="Submit" onClick={() => submit(r)} className="p-1.5 rounded hover:bg-[var(--surface-active)] text-[var(--status-success-text)] cursor-pointer"><Check size={14} /></button>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </Card>

      {show && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShow(false)}>
          <Card className="w-full max-w-2xl p-5 max-h-[90vh] overflow-y-auto" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3"><h3 className="text-sm font-semibold text-[var(--text-primary)]">New daily site report</h3><button onClick={() => setShow(false)} className="cursor-pointer text-[var(--text-tertiary)]"><X size={16} /></button></div>
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs font-medium text-[var(--text-secondary)]">Project *</label>
                  <select value={form.project_id} onChange={e => setForm({ ...form, project_id: e.target.value })} className="w-full mt-1 px-3 h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm"><option value="">Select…</option>{projects.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}</select></div>
                <div><label className="text-xs font-medium text-[var(--text-secondary)]">Date</label><input type="date" value={form.report_date} onChange={e => setForm({ ...form, report_date: e.target.value })} className="w-full mt-1 px-3 h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm" /></div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div><label className="text-xs font-medium text-[var(--text-secondary)]">Weather</label><select value={form.weather} onChange={e => setForm({ ...form, weather: e.target.value })} className="w-full mt-1 px-3 h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm">{WEATHER.map(w => <option key={w} value={w}>{w}</option>)}</select></div>
                <div><label className="text-xs font-medium text-[var(--text-secondary)]">Temp °C</label><input type="number" value={form.temperature_c} onChange={e => setForm({ ...form, temperature_c: e.target.value })} className="w-full mt-1 px-3 h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm" /></div>
                <div><label className="text-xs font-medium text-[var(--text-secondary)]">Prepared by</label><input value={form.prepared_by_name} onChange={e => setForm({ ...form, prepared_by_name: e.target.value })} className="w-full mt-1 px-3 h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm" /></div>
              </div>

              <div>
                <div className="flex items-center justify-between"><label className="text-xs font-medium text-[var(--text-secondary)]">Manpower by trade ({totalMp})</label><button type="button" onClick={() => setManpower(m => [...m, { trade: '', count: 0 }])} className="text-[11px] text-[var(--accent)] cursor-pointer">+ row</button></div>
                <div className="flex flex-col gap-1.5 mt-1">
                  {manpower.map((m, i) => (
                    <div key={i} className="flex gap-2">
                      <input value={m.trade} onChange={e => setManpower(arr => arr.map((x, j) => j === i ? { ...x, trade: e.target.value } : x))} placeholder="e.g. Technician" className="flex-1 px-2 h-8 rounded border border-[var(--border)] bg-[var(--surface)] text-xs" />
                      <input type="number" min="0" value={m.count} onChange={e => setManpower(arr => arr.map((x, j) => j === i ? { ...x, count: Number(e.target.value) } : x))} className="w-24 px-2 h-8 rounded border border-[var(--border)] bg-[var(--surface)] text-xs text-right" />
                      <button type="button" onClick={() => setManpower(arr => arr.filter((_, j) => j !== i))} className="text-[var(--text-tertiary)] cursor-pointer"><Trash2 size={13} /></button>
                    </div>
                  ))}
                </div>
              </div>

              {([['work_done', 'Work executed'], ['materials_received', 'Materials received'], ['equipment_on_site', 'Equipment on site'], ['delays_issues', 'Delays / issues'], ['safety_notes', 'Safety / HSE'], ['visitors', 'Visitors']] as const).map(([key, label]) => (
                <div key={key}><label className="text-xs font-medium text-[var(--text-secondary)]">{label}</label>
                  <textarea rows={2} value={(form as any)[key]} onChange={e => setForm({ ...form, [key]: e.target.value })} className="w-full mt-1 px-3 py-2 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm" /></div>
              ))}

              <div>
                <label className="text-xs font-medium text-[var(--text-secondary)]">Photos</label>
                <div className="flex flex-wrap gap-2 mt-1 items-center">
                  {photos.map((p, i) => (
                    <span key={i} className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded border border-[var(--border)] bg-[var(--surface)]">{p.name}<button onClick={() => setPhotos(arr => arr.filter((_, j) => j !== i))} className="cursor-pointer text-[var(--text-tertiary)]"><X size={11} /></button></span>
                  ))}
                  <label className="inline-flex items-center gap-1.5 px-3 h-8 rounded-md border border-dashed border-[var(--border)] text-xs text-[var(--text-tertiary)] cursor-pointer hover:border-[var(--accent)]">
                    <Paperclip size={13} /> {uploading ? 'Uploading…' : 'Add photos'}
                    <input type="file" accept="image/*" multiple className="hidden" disabled={uploading} onChange={e => uploadPhotos(e.target.files)} />
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-1">
                <Button variant="secondary" size="sm" onClick={() => setShow(false)}>Cancel</Button>
                <Button variant="secondary" size="sm" isLoading={busy} disabled={!form.project_id} onClick={() => save('DRAFT')}>Save draft</Button>
                <Button variant="primary" size="sm" icon={Check} isLoading={busy} disabled={!form.project_id} onClick={() => save('SUBMITTED')}>Submit</Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
