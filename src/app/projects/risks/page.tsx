'use client';

// ============================================================
// JEET ERP — Projects: Risk Register
// 5x5 likelihood x impact matrix, mitigation, owner, status.
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import riskRegisterService, { ProjectRisk, RiskCategory, RiskStatus, ratingFor } from '@/services/riskRegisterService';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { exportTablePdf, exportTableExcel } from '@/lib/finance-export';
import { AlertTriangle, Plus, FileDown, Sheet, Trash2, Pencil } from 'lucide-react';

const CATEGORIES: RiskCategory[] = ['TECHNICAL', 'COMMERCIAL', 'SCHEDULE', 'SAFETY', 'EXTERNAL', 'RESOURCE'];
const STATUSES: RiskStatus[] = ['OPEN', 'MITIGATING', 'CLOSED'];

const ratingColor = (r: ProjectRisk['rating']) => ({
  Low: { bg: 'var(--status-success-bg)', tx: 'var(--status-success-text)' },
  Medium: { bg: 'var(--status-warning-bg)', tx: 'var(--status-warning-text)' },
  High: { bg: 'var(--status-danger-bg)', tx: 'var(--status-danger-text)' },
  Critical: { bg: 'var(--status-danger-text)', tx: '#fff' },
}[r]);

// matrix cell colour by score
function cellColor(score: number): string {
  const r = ratingFor(score);
  if (r === 'Critical') return 'rgba(220,38,38,0.85)';
  if (r === 'High') return 'rgba(239,68,68,0.5)';
  if (r === 'Medium') return 'rgba(245,158,11,0.45)';
  return 'rgba(34,197,94,0.35)';
}

interface FormState { ref_code: string; title: string; description: string; category: RiskCategory; likelihood: number; impact: number; mitigation: string; owner_name: string; status: RiskStatus; due_date: string; }
const emptyForm: FormState = { ref_code: '', title: '', description: '', category: 'TECHNICAL', likelihood: 3, impact: 3, mitigation: '', owner_name: '', status: 'OPEN', due_date: '' };

export default function RiskRegisterPage() {
  const [userName, setUserName] = useState<string | null>(null);
  const [projects, setProjects] = useState<{ id: string; label: string }[]>([]);
  const [projectId, setProjectId] = useState('');
  const [rows, setRows] = useState<ProjectRisk[]>([]);
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from('projects').select('id, project_number, name').order('project_number', { ascending: false })
      .then(({ data }) => setProjects((data || []).map((p: any) => ({ id: p.id, label: `${p.project_number} — ${p.name}` }))));
    supabase.auth.getUser().then(({ data }) => setUserName((data.user?.user_metadata?.name as string) || data.user?.email || null));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try { setRows(await riskRegisterService.list(projectId ? { projectId } : undefined)); } finally { setLoading(false); }
  }, [projectId]);
  useEffect(() => { load(); }, [load]);

  const openNew = () => { setEditId(null); setForm({ ...emptyForm }); setModal(true); };
  const openEdit = (r: ProjectRisk) => {
    setEditId(r.id);
    setForm({ ref_code: r.ref_code || '', title: r.title, description: r.description || '', category: r.category, likelihood: r.likelihood, impact: r.impact, mitigation: r.mitigation || '', owner_name: r.owner_name || '', status: r.status, due_date: r.due_date || '' });
    setModal(true);
  };

  const save = async () => {
    if (!projectId && !editId) { alert('Select a project first.'); return; }
    if (!form.title.trim()) { alert('Risk title is required.'); return; }
    setSaving(true);
    try {
      const patch = { ...form, title: form.title.trim(), ref_code: form.ref_code.trim() || undefined, description: form.description.trim() || null, mitigation: form.mitigation.trim() || null, owner_name: form.owner_name.trim() || null, due_date: form.due_date || null };
      if (editId) await riskRegisterService.update(editId, patch as any);
      else await riskRegisterService.create({ ...patch, project_id: projectId, created_by_name: userName } as any);
      setModal(false); await load();
    } catch (e: any) { alert(e?.message || 'Save failed'); } finally { setSaving(false); }
  };

  const del = async (r: ProjectRisk) => { if (!confirm(`Remove risk "${r.title}"?`)) return; await riskRegisterService.remove(r.id); await load(); };

  const open = rows.filter(r => r.status !== 'CLOSED');
  const high = open.filter(r => r.rating === 'High' || r.rating === 'Critical').length;
  const avg = open.length ? Math.round(open.reduce((s, r) => s + r.score, 0) / open.length) : 0;

  // matrix counts (only open/mitigating)
  const matrix: number[][] = Array.from({ length: 5 }, () => Array(5).fill(0)); // [impact-1][likelihood-1]
  open.forEach(r => { if (r.impact >= 1 && r.impact <= 5 && r.likelihood >= 1 && r.likelihood <= 5) matrix[r.impact - 1][r.likelihood - 1]++; });

  const exportCols = ['Ref', 'Project', 'Title', 'Category', 'Likelihood', 'Impact', 'Score', 'Rating', 'Owner', 'Status', 'Due', 'Mitigation'];
  const exportRows = rows.map(r => [r.ref_code || '', r.project_label || '', r.title, r.category, r.likelihood, r.impact, r.score, r.rating, r.owner_name || '', r.status, r.due_date || '', r.mitigation || '']);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Risk Register"
        subtitle="Project risks scored on a 5×5 likelihood × impact matrix"
        breadcrumbs={[{ label: 'Projects', href: '/projects' }, { label: 'Risks' }]}
        actions={
          <div className="flex gap-2">
            {rows.length > 0 && <>
              <Button variant="secondary" icon={FileDown} onClick={() => exportTablePdf({ title: 'Risk Register', columns: exportCols, rows: exportRows, fileName: 'risk-register' })}>PDF</Button>
              <Button variant="secondary" icon={Sheet} onClick={() => exportTableExcel({ title: 'Risk Register', columns: exportCols, rows: exportRows, fileName: 'risk-register' })}>Excel</Button>
            </>}
            <Button icon={Plus} onClick={openNew}>Add risk</Button>
          </div>
        }
      />

      <Card className="p-4">
        <label className="text-xs font-medium text-[var(--text-secondary)]">Project filter</label>
        <select value={projectId} onChange={e => setProjectId(e.target.value)} className="w-full md:max-w-md mt-1 px-3 h-10 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm">
          <option value="">All projects</option>{projects.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
        </select>
      </Card>

      <div className="grid grid-cols-3 gap-3">
        <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Open risks</div><div className="text-2xl font-bold mt-1">{open.length}</div></Card>
        <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">High / Critical</div><div className="text-2xl font-bold mt-1" style={{ color: high ? 'var(--status-danger-text)' : 'var(--text-primary)' }}>{high}</div></Card>
        <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Avg score</div><div className="text-2xl font-bold mt-1">{avg}</div></Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Matrix */}
        <Card className="p-4">
          <div className="text-sm font-semibold text-[var(--text-primary)] mb-3">Heat map (open risks)</div>
          <div className="flex">
            <div className="flex flex-col justify-around mr-1 text-[10px] text-[var(--text-tertiary)] -rotate-0">
              <span className="writing-mode-vertical" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>Impact →</span>
            </div>
            <div className="flex-1">
              <table className="w-full border-collapse">
                <tbody>
                  {[5, 4, 3, 2, 1].map(imp => (
                    <tr key={imp}>
                      <td className="text-[10px] text-[var(--text-tertiary)] pr-1 text-right w-5">{imp}</td>
                      {[1, 2, 3, 4, 5].map(lik => {
                        const score = imp * lik;
                        const cnt = matrix[imp - 1][lik - 1];
                        return (
                          <td key={lik} className="text-center align-middle border border-[var(--surface)]" style={{ background: cellColor(score), height: 40 }}>
                            <span className="text-xs font-semibold" style={{ color: cnt ? '#fff' : 'rgba(255,255,255,0.55)' }}>{cnt || ''}</span>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                  <tr><td></td>{[1, 2, 3, 4, 5].map(l => <td key={l} className="text-[10px] text-[var(--text-tertiary)] text-center pt-1">{l}</td>)}</tr>
                </tbody>
              </table>
              <div className="text-[10px] text-[var(--text-tertiary)] text-center mt-1">Likelihood →</div>
            </div>
          </div>
        </Card>

        {/* Legend / counts by rating */}
        <Card className="p-4">
          <div className="text-sm font-semibold text-[var(--text-primary)] mb-3">By rating</div>
          {(['Critical', 'High', 'Medium', 'Low'] as const).map(rt => {
            const c = ratingColor(rt); const cnt = open.filter(r => r.rating === rt).length;
            return (
              <div key={rt} className="flex items-center justify-between py-1.5 border-b border-[var(--border)] last:border-0">
                <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: c.bg, color: c.tx }}>{rt}</span>
                <span className="text-sm font-semibold tabular-nums">{cnt}</span>
              </div>
            );
          })}
        </Card>
      </div>

      {loading ? (
        <Card><div className="p-8 text-center text-sm text-[var(--text-tertiary)]">Loading…</div></Card>
      ) : rows.length === 0 ? (
        <Card><EmptyState icon={AlertTriangle} title="No risks logged" description="Add risks to build the register and heat map." /></Card>
      ) : (
        <Card className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-[var(--border)] text-left text-[var(--text-tertiary)] text-xs">
              <th className="p-3">Ref</th>{!projectId && <th className="p-3">Project</th>}<th className="p-3">Risk</th>
              <th className="p-3">Category</th><th className="p-3 text-center">L×I</th><th className="p-3 text-center">Score</th>
              <th className="p-3">Owner</th><th className="p-3">Status</th><th className="p-3"></th>
            </tr></thead>
            <tbody>
              {rows.map(r => {
                const c = ratingColor(r.rating);
                return (
                  <tr key={r.id} className="border-b border-[var(--border)] last:border-0">
                    <td className="p-3 text-xs text-[var(--text-tertiary)]">{r.ref_code}</td>
                    {!projectId && <td className="p-3 text-xs text-[var(--text-tertiary)]">{r.project_label}</td>}
                    <td className="p-3 text-[var(--text-primary)]"><div className="font-medium">{r.title}</div>{r.mitigation && <div className="text-[11px] text-[var(--text-tertiary)] mt-0.5 line-clamp-1">↳ {r.mitigation}</div>}</td>
                    <td className="p-3 text-xs">{r.category}</td>
                    <td className="p-3 text-center text-xs tabular-nums">{r.likelihood}×{r.impact}</td>
                    <td className="p-3 text-center"><span className="text-[11px] px-2 py-0.5 rounded-full font-semibold" style={{ background: c.bg, color: c.tx }}>{r.score}</span></td>
                    <td className="p-3 text-xs text-[var(--text-secondary)]">{r.owner_name || '—'}</td>
                    <td className="p-3 text-xs">{r.status}</td>
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
            <div className="text-base font-semibold mb-3">{editId ? 'Edit risk' : 'New risk'}</div>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs text-[var(--text-secondary)] col-span-2">Title
                <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="w-full mt-1 px-2 h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm" />
              </label>
              <label className="text-xs text-[var(--text-secondary)]">Category
                <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value as RiskCategory }))} className="w-full mt-1 px-2 h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm">
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </label>
              <label className="text-xs text-[var(--text-secondary)]">Status
                <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as RiskStatus }))} className="w-full mt-1 px-2 h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm">
                  {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </label>
              <label className="text-xs text-[var(--text-secondary)]">Likelihood (1–5)
                <select value={form.likelihood} onChange={e => setForm(f => ({ ...f, likelihood: Number(e.target.value) }))} className="w-full mt-1 px-2 h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm">
                  {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </label>
              <label className="text-xs text-[var(--text-secondary)]">Impact (1–5)
                <select value={form.impact} onChange={e => setForm(f => ({ ...f, impact: Number(e.target.value) }))} className="w-full mt-1 px-2 h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm">
                  {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </label>
              <div className="col-span-2 text-xs text-[var(--text-tertiary)]">Score: <strong style={{ color: ratingColor(ratingFor(form.likelihood * form.impact)).tx }}>{form.likelihood * form.impact} · {ratingFor(form.likelihood * form.impact)}</strong></div>
              <label className="text-xs text-[var(--text-secondary)]">Owner
                <input value={form.owner_name} onChange={e => setForm(f => ({ ...f, owner_name: e.target.value }))} className="w-full mt-1 px-2 h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm" />
              </label>
              <label className="text-xs text-[var(--text-secondary)]">Due date
                <input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} className="w-full mt-1 px-2 h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm" />
              </label>
              <label className="text-xs text-[var(--text-secondary)] col-span-2">Description
                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} className="w-full mt-1 px-2 py-1 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm" />
              </label>
              <label className="text-xs text-[var(--text-secondary)] col-span-2">Mitigation
                <textarea value={form.mitigation} onChange={e => setForm(f => ({ ...f, mitigation: e.target.value }))} rows={2} className="w-full mt-1 px-2 py-1 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm" />
              </label>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="secondary" onClick={() => setModal(false)}>Cancel</Button>
              <Button onClick={save} isLoading={saving}>{editId ? 'Save' : 'Add risk'}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
