'use client';

// ============================================================
// JEET ERP — Service: PPM Compliance Dashboard
// Scheduled vs completed preventive visits, overdue & upcoming.
// Read-only; plain queries (no migration).
// ============================================================

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { exportTablePdf, exportTableExcel } from '@/lib/finance-export';
import { CalendarClock, FileDown, Sheet } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, LineChart, Line, PieChart, Pie, Cell } from 'recharts';

const OPEN_VISIT = ['UNSCHEDULED', 'SCHEDULED', 'IN_PROGRESS'];
const PIE = ['var(--text-tertiary)', 'var(--status-info-text)', 'var(--status-warning-text)', 'var(--status-success-text)', 'var(--status-danger-text)', '#8b5cf6'];
const statusStyle: Record<string, { bg: string; tx: string }> = {
  UNSCHEDULED: { bg: 'var(--status-neutral-bg)', tx: 'var(--status-neutral-text)' },
  SCHEDULED: { bg: 'var(--status-info-bg)', tx: 'var(--status-info-text)' },
  IN_PROGRESS: { bg: 'var(--status-warning-bg)', tx: 'var(--status-warning-text)' },
  COMPLETED: { bg: 'var(--status-success-bg)', tx: 'var(--status-success-text)' },
  MISSED: { bg: 'var(--status-danger-bg)', tx: 'var(--status-danger-text)' },
  CANCELLED: { bg: 'var(--status-neutral-bg)', tx: 'var(--status-neutral-text)' },
};

interface Vt { id: string; contract_id: string; visit_number: string; target_month: string; scheduled_date: string | null; status: string; technician_id: string | null; }

export default function PpmCompliancePage() {
  const router = useRouter();
  const [visits, setVisits] = useState<Vt[]>([]);
  const [contractMap, setContractMap] = useState<Map<string, { number: string; client: string; site: string }>>(new Map());
  const [techMap, setTechMap] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.from('ppm_visits').select('id, contract_id, visit_number, target_month, scheduled_date, status, technician_id').order('target_month', { ascending: true });
        const rows = (data || []) as Vt[];
        setVisits(rows);
        const cids = [...new Set(rows.map(r => r.contract_id).filter(Boolean))] as string[];
        const tids = [...new Set(rows.map(r => r.technician_id).filter(Boolean))] as string[];
        const [cRes, tRes] = await Promise.all([
          cids.length ? supabase.from('amc_contracts').select('id, contract_number, client_name, site_name').in('id', cids) : Promise.resolve({ data: [] as any[] }),
          tids.length ? supabase.from('profiles').select('id, full_name').in('id', tids) : Promise.resolve({ data: [] as any[] }),
        ]);
        setContractMap(new Map((cRes.data || []).map((c: any) => [c.id, { number: c.contract_number, client: c.client_name, site: c.site_name }])));
        setTechMap(new Map((tRes.data || []).map((p: any) => [p.id, p.full_name])));
      } finally { setLoading(false); }
    })();
  }, []);

  const startOfMonth = useMemo(() => { const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d.getTime(); }, []);
  const endOfMonth = useMemo(() => { const d = new Date(); d.setMonth(d.getMonth() + 1, 0); d.setHours(23, 59, 59, 999); return d.getTime(); }, []);

  const completed = visits.filter(v => v.status === 'COMPLETED').length;
  const open = visits.filter(v => OPEN_VISIT.includes(v.status));
  const overdue = open.filter(v => v.target_month && new Date(v.target_month).getTime() < startOfMonth);
  const thisMonth = open.filter(v => v.target_month && new Date(v.target_month).getTime() >= startOfMonth && new Date(v.target_month).getTime() <= endOfMonth);
  const rate = visits.length ? Math.round(completed / visits.length * 100) : 0;

  const byStatus = ['UNSCHEDULED', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'MISSED', 'CANCELLED'].map(s => ({ name: s.replace(/_/g, ' '), value: visits.filter(v => v.status === s).length })).filter(d => d.value > 0);

  const trend = useMemo(() => {
    const m = new Map<string, { total: number; done: number }>();
    visits.forEach(v => { if (!v.target_month) return; const k = v.target_month.slice(0, 7); const e = m.get(k) || { total: 0, done: 0 }; e.total++; if (v.status === 'COMPLETED') e.done++; m.set(k, e); });
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-8).map(([k, v]) => ({ month: k.slice(2), rate: v.total ? Math.round(v.done / v.total * 100) : 0 }));
  }, [visits]);

  const byContract = useMemo(() => {
    const m = new Map<string, { total: number; done: number }>();
    visits.forEach(v => { const k = contractMap.get(v.contract_id)?.number || '—'; const e = m.get(k) || { total: 0, done: 0 }; e.total++; if (v.status === 'COMPLETED') e.done++; m.set(k, e); });
    return [...m.entries()].map(([name, v]) => ({ name, rate: v.total ? Math.round(v.done / v.total * 100) : 0, total: v.total })).sort((a, b) => a.rate - b.rate).slice(0, 8);
  }, [visits, contractMap]);

  const actionList = [...overdue, ...thisMonth];
  const exportCols = ['Visit', 'Contract', 'Client', 'Site', 'Target month', 'Scheduled', 'Status', 'Technician'];
  const exportRows = actionList.map(v => { const c = contractMap.get(v.contract_id); return [v.visit_number, c?.number || '', c?.client || '', c?.site || '', v.target_month?.slice(0, 7) || '', v.scheduled_date || '', v.status, v.technician_id ? techMap.get(v.technician_id) || '' : '']; });

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="PPM Compliance"
        subtitle="Preventive maintenance: scheduled vs completed, overdue and upcoming"
        breadcrumbs={[{ label: 'Service', href: '/service-desk' }, { label: 'PPM Compliance' }]}
        actions={visits.length > 0 ? (
          <div className="flex gap-2">
            <Button variant="secondary" icon={FileDown} onClick={() => exportTablePdf({ title: 'PPM Compliance', columns: exportCols, rows: exportRows, fileName: 'ppm-compliance' })}>PDF</Button>
            <Button variant="secondary" icon={Sheet} onClick={() => exportTableExcel({ title: 'PPM Compliance', columns: exportCols, rows: exportRows, fileName: 'ppm-compliance' })}>Excel</Button>
          </div>
        ) : undefined}
      />

      {loading ? (
        <Card><div className="p-8 text-center text-sm text-[var(--text-tertiary)]">Loading…</div></Card>
      ) : visits.length === 0 ? (
        <Card><EmptyState icon={CalendarClock} title="No PPM visits" description="Visits generated from AMC contracts will be tracked here." /></Card>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Total visits</div><div className="text-2xl font-bold mt-1">{visits.length}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Completed</div><div className="text-2xl font-bold mt-1" style={{ color: 'var(--status-success-text)' }}>{completed}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Completion rate</div><div className="text-2xl font-bold mt-1" style={{ color: rate >= 90 ? 'var(--status-success-text)' : rate >= 75 ? 'var(--status-warning-text)' : 'var(--status-danger-text)' }}>{rate}%</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Overdue</div><div className="text-2xl font-bold mt-1" style={{ color: overdue.length ? 'var(--status-danger-text)' : 'var(--text-primary)' }}>{overdue.length}</div></Card>
            <Card className="p-4 cursor-pointer hover:border-[var(--accent)]" onClick={() => router.push('/ppm/calendar')}><div className="text-xs text-[var(--text-secondary)]">Due this month</div><div className="text-2xl font-bold mt-1" style={{ color: thisMonth.length ? 'var(--status-warning-text)' : 'var(--text-primary)' }}>{thisMonth.length}</div></Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <Card className="p-4">
              <div className="text-sm font-semibold text-[var(--text-primary)] mb-3">Visits by status</div>
              <div style={{ width: '100%', height: 240 }}>
                <ResponsiveContainer>
                  <PieChart><Pie data={byStatus} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={85} label={(e: any) => e.name}>{byStatus.map((_, i) => <Cell key={i} fill={PIE[i % PIE.length]} />)}</Pie><Tooltip /></PieChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card className="p-4 lg:col-span-2">
              <div className="text-sm font-semibold text-[var(--text-primary)] mb-3">Completion rate trend</div>
              <div style={{ width: '100%', height: 240 }}>
                <ResponsiveContainer>
                  {trend.length ? (
                    <LineChart data={trend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} tickFormatter={(v) => `${v}%`} />
                      <Tooltip formatter={(v: any) => `${v}%`} />
                      <Line dataKey="rate" stroke="var(--status-success-text)" strokeWidth={2} dot={{ r: 3 }} />
                    </LineChart>
                  ) : <div className="flex items-center justify-center h-full text-sm text-[var(--text-tertiary)]">Not enough data</div>}
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          {byContract.length > 0 && (
            <Card className="p-4">
              <div className="text-sm font-semibold text-[var(--text-primary)] mb-3">Lowest completion by contract</div>
              <div style={{ width: '100%', height: 220 }}>
                <ResponsiveContainer>
                  <BarChart data={byContract} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} tickFormatter={(v) => `${v}%`} />
                    <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }} />
                    <Tooltip formatter={(v: any) => `${v}%`} />
                    <Bar dataKey="rate" fill="var(--accent)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          )}

          <Card className="p-0 overflow-x-auto">
            <div className="p-3 text-sm font-semibold text-[var(--text-primary)] border-b border-[var(--border)]">Overdue &amp; due this month ({actionList.length})</div>
            {actionList.length === 0 ? <div className="p-6 text-center text-sm text-[var(--text-tertiary)]">Nothing overdue or due this month.</div> : (
              <table className="w-full text-sm">
                <thead><tr className="border-b border-[var(--border)] text-left text-[var(--text-tertiary)] text-xs">
                  <th className="p-3">Visit</th><th className="p-3">Contract</th><th className="p-3">Site</th><th className="p-3">Target</th><th className="p-3">Scheduled</th><th className="p-3">Status</th><th className="p-3">Technician</th>
                </tr></thead>
                <tbody>
                  {actionList.map(v => { const c = contractMap.get(v.contract_id); const st = statusStyle[v.status] || statusStyle.SCHEDULED; const od = v.target_month && new Date(v.target_month).getTime() < startOfMonth; return (
                    <tr key={v.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-hover)] cursor-pointer" onClick={() => router.push(`/ppm/execute/${v.id}`)}>
                      <td className="p-3 font-medium text-[var(--text-primary)]">{v.visit_number}</td>
                      <td className="p-3 text-xs text-[var(--text-secondary)]">{c?.number}<div className="text-[10px] text-[var(--text-tertiary)]">{c?.client}</div></td>
                      <td className="p-3 text-xs text-[var(--text-secondary)]">{c?.site || '—'}</td>
                      <td className="p-3 text-xs" style={{ color: od ? 'var(--status-danger-text)' : 'var(--text-secondary)' }}>{v.target_month?.slice(0, 7)}{od ? ' ⚠' : ''}</td>
                      <td className="p-3 text-xs text-[var(--text-secondary)]">{v.scheduled_date || '—'}</td>
                      <td className="p-3"><span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: st.bg, color: st.tx }}>{v.status.replace('_', ' ')}</span></td>
                      <td className="p-3 text-xs text-[var(--text-secondary)]">{v.technician_id ? techMap.get(v.technician_id) || '—' : '—'}</td>
                    </tr>
                  ); })}
                </tbody>
              </table>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
