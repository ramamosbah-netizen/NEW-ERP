'use client';

// ============================================================
// JEET ERP — HR: Training & Competency Matrix
// Employee × skill competency grid (0–4) + training records.
// Migration adds the tables; degrades gracefully without them.
// ============================================================

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import competencyService, { Skill, Competency, Training } from '@/services/competencyService';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { exportTablePdf, exportTableExcel } from '@/lib/finance-export';
import { GraduationCap, FileDown, Sheet, Plus, Trash2 } from 'lucide-react';

const LEVELS = ['—', 'Basic', 'Working', 'Proficient', 'Expert'];
const levelColor = (l: number) => l === 0 ? 'var(--surface-active)' : l === 1 ? 'rgba(245,158,11,0.25)' : l === 2 ? 'rgba(14,165,233,0.25)' : l === 3 ? 'rgba(34,197,94,0.3)' : 'rgba(34,197,94,0.6)';

export default function CompetencyPage() {
  const [tab, setTab] = useState<'matrix' | 'training'>('matrix');
  const [employees, setEmployees] = useState<{ id: string; name: string }[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [comps, setComps] = useState<Competency[]>([]);
  const [training, setTraining] = useState<Training[]>([]);
  const [userName, setUserName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [skillModal, setSkillModal] = useState(false);
  const [skillForm, setSkillForm] = useState({ name: '', category: '' });
  const [trainModal, setTrainModal] = useState(false);
  const [trainForm, setTrainForm] = useState({ employee_id: '', course_name: '', provider: '', completed_date: '', expiry_date: '', status: 'COMPLETED' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [em, sk, cp, tr] = await Promise.all([
        supabase.from('employees').select('id, full_name_en').eq('is_active', true),
        competencyService.listSkills(),
        competencyService.listCompetencies(),
        competencyService.listTraining(),
      ]);
      setEmployees((em.data || []).map((e: any) => ({ id: e.id, name: e.full_name_en })));
      setSkills(sk); setComps(cp); setTraining(tr);
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); supabase.auth.getUser().then(({ data }) => setUserName((data.user?.user_metadata?.name as string) || data.user?.email || null)); }, [load]);

  const compMap = useMemo(() => { const m = new Map<string, number>(); comps.forEach(c => m.set(`${c.employee_id}:${c.skill_id}`, c.level)); return m; }, [comps]);
  const levelOf = (eid: string, sid: string) => compMap.get(`${eid}:${sid}`) ?? 0;

  const setLevel = async (eid: string, sid: string, level: number) => {
    try { await competencyService.setCompetency(eid, sid, level); setComps(prev => { const i = prev.findIndex(c => c.employee_id === eid && c.skill_id === sid); if (i >= 0) { const n = [...prev]; n[i] = { ...n[i], level }; return n; } return [...prev, { id: `${eid}:${sid}`, employee_id: eid, skill_id: sid, level, notes: null }]; }); }
    catch (e: any) { alert(e?.message || 'Save failed — apply the competency_training migration.'); }
  };

  const addSkill = async () => {
    if (!skillForm.name.trim()) { alert('Skill name is required.'); return; }
    setSaving(true);
    try { await competencyService.addSkill({ name: skillForm.name.trim(), category: skillForm.category.trim() || undefined }); setSkillModal(false); setSkillForm({ name: '', category: '' }); await load(); }
    catch (e: any) { alert(e?.message || 'Save failed — apply the migration.'); } finally { setSaving(false); }
  };
  const addTraining = async () => {
    if (!trainForm.employee_id || !trainForm.course_name.trim()) { alert('Employee and course are required.'); return; }
    setSaving(true);
    try { await competencyService.addTraining({ ...trainForm, course_name: trainForm.course_name.trim(), created_by_name: userName } as any); setTrainModal(false); setTrainForm({ employee_id: '', course_name: '', provider: '', completed_date: '', expiry_date: '', status: 'COMPLETED' }); await load(); }
    catch (e: any) { alert(e?.message || 'Save failed — apply the migration.'); } finally { setSaving(false); }
  };

  const empName = (id: string) => employees.find(e => e.id === id)?.name || '—';
  const avgLevel = comps.length ? Math.round(comps.reduce((s, c) => s + c.level, 0) / comps.length * 10) / 10 : 0;

  const exportCols = ['Employee', ...skills.map(s => s.name)];
  const exportRows = employees.map(e => [e.name, ...skills.map(s => LEVELS[levelOf(e.id, s.id)])]);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Training & Competency Matrix"
        subtitle="Skill levels across the team and training records"
        breadcrumbs={[{ label: 'HR', href: '/hr' }, { label: 'Competency' }]}
        actions={
          <div className="flex gap-2">
            {tab === 'matrix' ? <>
              {skills.length > 0 && employees.length > 0 && <>
                <Button variant="secondary" icon={FileDown} onClick={() => exportTablePdf({ title: 'Competency Matrix', columns: exportCols, rows: exportRows, fileName: 'competency-matrix' })}>PDF</Button>
                <Button variant="secondary" icon={Sheet} onClick={() => exportTableExcel({ title: 'Competency Matrix', columns: exportCols, rows: exportRows, fileName: 'competency-matrix' })}>Excel</Button>
              </>}
              <Button icon={Plus} onClick={() => setSkillModal(true)}>Add skill</Button>
            </> : <Button icon={Plus} onClick={() => setTrainModal(true)}>Add training</Button>}
          </div>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Skills tracked</div><div className="text-2xl font-bold mt-1">{skills.length}</div></Card>
        <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Ratings recorded</div><div className="text-2xl font-bold mt-1">{comps.length}</div></Card>
        <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Avg level</div><div className="text-2xl font-bold mt-1">{avgLevel}<span className="text-sm font-normal text-[var(--text-tertiary)]">/4</span></div></Card>
        <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Training records</div><div className="text-2xl font-bold mt-1">{training.length}</div></Card>
      </div>

      <div className="flex gap-1 border-b border-[var(--border)]">
        {(['matrix', 'training'] as const).map(tk => (
          <button key={tk} onClick={() => setTab(tk)} className="px-4 py-2 text-sm font-medium border-b-2 -mb-px" style={{ borderColor: tab === tk ? 'var(--accent)' : 'transparent', color: tab === tk ? 'var(--accent)' : 'var(--text-tertiary)' }}>{tk === 'matrix' ? 'Competency matrix' : 'Training records'}</button>
        ))}
      </div>

      {loading ? (
        <Card><div className="p-8 text-center text-sm text-[var(--text-tertiary)]">Loading…</div></Card>
      ) : tab === 'matrix' ? (
        skills.length === 0 || employees.length === 0 ? (
          <Card><EmptyState icon={GraduationCap} title="Build the matrix" description="Add skills (and have active employees) to rate competency 0–4. Apply the competency_training migration if saving fails." /></Card>
        ) : (
          <Card className="p-0 overflow-x-auto">
            <table className="text-sm">
              <thead><tr className="border-b border-[var(--border)] text-left text-[var(--text-tertiary)] text-xs">
                <th className="p-3 sticky left-0 bg-[var(--surface)]">Employee</th>
                {skills.map(s => <th key={s.id} className="p-2 text-center min-w-[90px]"><div className="truncate" title={s.name}>{s.name}</div></th>)}
              </tr></thead>
              <tbody>
                {employees.map(e => (
                  <tr key={e.id} className="border-b border-[var(--border)] last:border-0">
                    <td className="p-3 font-medium text-[var(--text-primary)] sticky left-0 bg-[var(--surface)] whitespace-nowrap">{e.name}</td>
                    {skills.map(s => { const lvl = levelOf(e.id, s.id); return (
                      <td key={s.id} className="p-1.5 text-center" style={{ background: levelColor(lvl) }}>
                        <select value={lvl} onChange={ev => setLevel(e.id, s.id, Number(ev.target.value))} className="bg-transparent text-xs text-center w-full cursor-pointer outline-none">
                          {LEVELS.map((l, i) => <option key={i} value={i}>{i === 0 ? '—' : i}</option>)}
                        </select>
                      </td>
                    ); })}
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="p-3 flex gap-3 text-[10px] text-[var(--text-tertiary)] border-t border-[var(--border)]">{LEVELS.map((l, i) => <span key={i} className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded" style={{ background: levelColor(i) }} />{i}{i > 0 ? ` ${l}` : ' none'}</span>)}</div>
          </Card>
        )
      ) : (
        training.length === 0 ? (
          <Card><EmptyState icon={GraduationCap} title="No training records" description="Log completed and planned training for the team." /></Card>
        ) : (
          <Card className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-[var(--border)] text-left text-[var(--text-tertiary)] text-xs"><th className="p-3">Employee</th><th className="p-3">Course</th><th className="p-3">Provider</th><th className="p-3">Completed</th><th className="p-3">Expiry</th><th className="p-3">Status</th><th className="p-3"></th></tr></thead>
              <tbody>
                {training.map(t => (
                  <tr key={t.id} className="border-b border-[var(--border)] last:border-0">
                    <td className="p-3 text-[var(--text-primary)]">{empName(t.employee_id)}</td>
                    <td className="p-3 font-medium text-[var(--text-primary)]">{t.course_name}</td>
                    <td className="p-3 text-xs text-[var(--text-secondary)]">{t.provider || '—'}</td>
                    <td className="p-3 text-xs text-[var(--text-secondary)]">{t.completed_date || '—'}</td>
                    <td className="p-3 text-xs text-[var(--text-secondary)]">{t.expiry_date || '—'}</td>
                    <td className="p-3 text-xs">{t.status}</td>
                    <td className="p-3 text-right"><button onClick={async () => { if (confirm('Remove training record?')) { await competencyService.removeTraining(t.id); load(); } }} className="p-1 text-[var(--text-tertiary)] hover:text-[var(--status-danger-text)]"><Trash2 size={15} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )
      )}

      {skillModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setSkillModal(false)}>
          <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] w-full max-w-sm p-5" onClick={e => e.stopPropagation()}>
            <div className="text-base font-semibold mb-3">Add skill</div>
            <label className="text-xs text-[var(--text-secondary)]">Skill name<input value={skillForm.name} onChange={e => setSkillForm(f => ({ ...f, name: e.target.value }))} className="w-full mt-1 px-2 h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm" /></label>
            <label className="text-xs text-[var(--text-secondary)] block mt-3">Category<input value={skillForm.category} onChange={e => setSkillForm(f => ({ ...f, category: e.target.value }))} placeholder="CCTV / MEP / Safety…" className="w-full mt-1 px-2 h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm" /></label>
            <div className="flex justify-end gap-2 mt-4"><Button variant="secondary" onClick={() => setSkillModal(false)}>Cancel</Button><Button onClick={addSkill} isLoading={saving}>Add</Button></div>
          </div>
        </div>
      )}

      {trainModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setTrainModal(false)}>
          <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] w-full max-w-md p-5" onClick={e => e.stopPropagation()}>
            <div className="text-base font-semibold mb-3">Add training record</div>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs text-[var(--text-secondary)] col-span-2">Employee<select value={trainForm.employee_id} onChange={e => setTrainForm(f => ({ ...f, employee_id: e.target.value }))} className="w-full mt-1 px-2 h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm"><option value="">Select…</option>{employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</select></label>
              <label className="text-xs text-[var(--text-secondary)] col-span-2">Course<input value={trainForm.course_name} onChange={e => setTrainForm(f => ({ ...f, course_name: e.target.value }))} className="w-full mt-1 px-2 h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm" /></label>
              <label className="text-xs text-[var(--text-secondary)]">Provider<input value={trainForm.provider} onChange={e => setTrainForm(f => ({ ...f, provider: e.target.value }))} className="w-full mt-1 px-2 h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm" /></label>
              <label className="text-xs text-[var(--text-secondary)]">Status<select value={trainForm.status} onChange={e => setTrainForm(f => ({ ...f, status: e.target.value }))} className="w-full mt-1 px-2 h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm">{['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'EXPIRED'].map(s => <option key={s} value={s}>{s}</option>)}</select></label>
              <label className="text-xs text-[var(--text-secondary)]">Completed<input type="date" value={trainForm.completed_date} onChange={e => setTrainForm(f => ({ ...f, completed_date: e.target.value }))} className="w-full mt-1 px-2 h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm" /></label>
              <label className="text-xs text-[var(--text-secondary)]">Expiry<input type="date" value={trainForm.expiry_date} onChange={e => setTrainForm(f => ({ ...f, expiry_date: e.target.value }))} className="w-full mt-1 px-2 h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm" /></label>
            </div>
            <div className="flex justify-end gap-2 mt-4"><Button variant="secondary" onClick={() => setTrainModal(false)}>Cancel</Button><Button onClick={addTraining} isLoading={saving}>Add</Button></div>
          </div>
        </div>
      )}
    </div>
  );
}
