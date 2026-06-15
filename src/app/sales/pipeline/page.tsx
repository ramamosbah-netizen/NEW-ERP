'use client';

// ============================================================
// JEET ERP — Pre-Sales: Sales Pipeline (Opportunities)
// Tenders by stage and value, by discipline, with deadline
// awareness. Read-only; plain query (no migration).
// ============================================================

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { exportTablePdf, exportTableExcel } from '@/lib/finance-export';
import { Briefcase, FileDown, Sheet, Search } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from 'recharts';

const DAY = 86400000;
const aed = (n: number) => `AED ${Number(n || 0).toLocaleString('en-AE', { maximumFractionDigits: 0 })}`;
const STAGES = ['Draft', 'Submitted', 'Under Review', 'Completed'];
const stageColor: Record<string, string> = { Draft: 'var(--text-tertiary)', Submitted: 'var(--status-info-text)', 'Under Review': 'var(--status-warning-text)', Completed: 'var(--status-success-text)' };

interface Tn { id: string; title: string; project_name: string; client_name: string; location: string; deadline_date: string | null; budget: number; status: string; tech_discipline: any; created_at: string; }

const discOf = (t: Tn): string => Array.isArray(t.tech_discipline) ? (t.tech_discipline[0] || '—') : (t.tech_discipline || '—');

export default function SalesPipelinePage() {
  const router = useRouter();
  const [tenders, setTenders] = useState<Tn[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    supabase.from('tenders').select('id, title, project_name, client_name, location, deadline_date, budget, status, tech_discipline, created_at').order('deadline_date', { ascending: true })
      .then(({ data }) => setTenders((data || []) as Tn[])).then(() => setLoading(false), () => setLoading(false));
  }, []);

  const rows = useMemo(() => tenders.filter(t => {
    if (statusFilter && t.status !== statusFilter) return false;
    if (search) { const h = `${t.title} ${t.project_name} ${t.client_name} ${t.location}`.toLowerCase(); if (!h.includes(search.toLowerCase())) return false; }
    return true;
  }), [tenders, statusFilter, search]);

  const now = Date.now();
  const open = tenders.filter(t => t.status !== 'Completed');
  const openValue = open.reduce((s, t) => s + Number(t.budget || 0), 0);
  const stages = useMemo(() => {
    const known = STAGES.filter(s => tenders.some(t => t.status === s));
    const others = [...new Set(tenders.map(t => t.status))].filter(s => !STAGES.includes(s));
    return [...known, ...others];
  }, [tenders]);

  const byStage = stages.map(s => ({ name: s, count: tenders.filter(t => t.status === s).length, value: Math.round(tenders.filter(t => t.status === s).reduce((a, t) => a + Number(t.budget || 0), 0)) }));
  const byDiscipline = useMemo(() => {
    const m = new Map<string, number>();
    tenders.forEach(t => { const k = discOf(t); m.set(k, (m.get(k) || 0) + Number(t.budget || 0)); });
    return [...m.entries()].map(([name, value]) => ({ name, value: Math.round(value) })).sort((a, b) => b.value - a.value).slice(0, 8);
  }, [tenders]);

  const exportCols = ['Tender', 'Client', 'Location', 'Discipline', 'Budget', 'Deadline', 'Stage'];
  const exportRows = rows.map(t => [t.title || t.project_name, t.client_name, t.location, discOf(t), t.budget, t.deadline_date || '', t.status]);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Sales Pipeline"
        subtitle="Tender opportunities by stage and value, with submission deadlines"
        breadcrumbs={[{ label: 'Pre-Sales', href: '/sales/dashboard' }, { label: 'Pipeline' }]}
        actions={tenders.length > 0 ? (
          <div className="flex gap-2">
            <Button variant="secondary" icon={FileDown} onClick={() => exportTablePdf({ title: 'Sales Pipeline', columns: exportCols, rows: exportRows, fileName: 'sales-pipeline' })}>PDF</Button>
            <Button variant="secondary" icon={Sheet} onClick={() => exportTableExcel({ title: 'Sales Pipeline', columns: exportCols, rows: exportRows, fileName: 'sales-pipeline' })}>Excel</Button>
          </div>
        ) : undefined}
      />

      {loading ? (
        <Card><div className="p-8 text-center text-sm text-[var(--text-tertiary)]">Loading…</div></Card>
      ) : tenders.length === 0 ? (
        <Card><EmptyState icon={Briefcase} title="No tenders" description="Tender opportunities appear here once created." /></Card>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Total tenders</div><div className="text-2xl font-bold mt-1">{tenders.length}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Open</div><div className="text-2xl font-bold mt-1">{open.length}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Open pipeline value</div><div className="text-xl font-bold mt-1">{aed(openValue)}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Stages</div><div className="text-2xl font-bold mt-1">{stages.length}</div></Card>
          </div>

          {/* Stage summary strip */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {byStage.map(s => (
              <Card key={s.name} className="p-4">
                <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full" style={{ background: stageColor[s.name] || 'var(--accent)' }} /><span className="text-xs text-[var(--text-secondary)]">{s.name}</span></div>
                <div className="text-lg font-bold mt-1">{s.count}</div>
                <div className="text-[11px] text-[var(--text-tertiary)]">{aed(s.value)}</div>
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <Card className="p-4">
              <div className="text-sm font-semibold text-[var(--text-primary)] mb-3">Value by stage</div>
              <div style={{ width: '100%', height: 240 }}>
                <ResponsiveContainer>
                  <BarChart data={byStage}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }} />
                    <YAxis tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v: any) => aed(v)} />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>{byStage.map((s, i) => <Cell key={i} fill={stageColor[s.name] || 'var(--accent)'} />)}</Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card className="p-4">
              <div className="text-sm font-semibold text-[var(--text-primary)] mb-3">Value by discipline</div>
              <div style={{ width: '100%', height: 240 }}>
                <ResponsiveContainer>
                  <BarChart data={byDiscipline} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }} />
                    <Tooltip formatter={(v: any) => aed(v)} />
                    <Bar dataKey="value" fill="var(--accent)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          <Card className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="relative">
              <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search tender / client…" className="w-full pl-7 pr-2 h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm" />
            </div>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-2 h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm"><option value="">All stages</option>{stages.map(s => <option key={s} value={s}>{s}</option>)}</select>
          </Card>

          <Card className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-[var(--border)] text-left text-[var(--text-tertiary)] text-xs">
                <th className="p-3">Tender</th><th className="p-3">Client</th><th className="p-3">Discipline</th><th className="p-3 text-right">Budget</th><th className="p-3">Deadline</th><th className="p-3">Stage</th>
              </tr></thead>
              <tbody>
                {rows.map(t => { const dl = t.deadline_date ? Math.ceil((new Date(t.deadline_date).getTime() - now) / DAY) : null; const od = dl !== null && dl < 0 && t.status !== 'Completed'; const soon = dl !== null && dl >= 0 && dl <= 14 && t.status !== 'Completed'; return (
                  <tr key={t.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-hover)] cursor-pointer" onClick={() => router.push(`/tenders/${t.id}`)}>
                    <td className="p-3"><div className="font-medium text-[var(--text-primary)] line-clamp-1">{t.title || t.project_name}</div><div className="text-[11px] text-[var(--text-tertiary)]">{t.location}</div></td>
                    <td className="p-3 text-xs text-[var(--text-secondary)]">{t.client_name}</td>
                    <td className="p-3 text-xs text-[var(--text-secondary)]">{discOf(t)}</td>
                    <td className="p-3 text-right tabular-nums">{aed(t.budget)}</td>
                    <td className="p-3 text-xs" style={{ color: od ? 'var(--status-danger-text)' : soon ? 'var(--status-warning-text)' : 'var(--text-secondary)' }}>{t.deadline_date || '—'}{od ? ' ⚠' : soon ? ` (${dl}d)` : ''}</td>
                    <td className="p-3"><span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: 'var(--surface-active)', color: stageColor[t.status] || 'var(--text-secondary)' }}>{t.status}</span></td>
                  </tr>
                ); })}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </div>
  );
}
