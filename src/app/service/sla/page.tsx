'use client';

// ============================================================
// JEET ERP — Service: SLA Analytics & Compliance
// Response/resolution compliance, breaches by priority/system/
// technician, MTTR. Read-only; plain queries (no migration).
// ============================================================

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { exportTablePdf, exportTableExcel } from '@/lib/finance-export';
import { Gauge, FileDown, Sheet } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, LineChart, Line, Legend } from 'recharts';

const HOUR = 3600000;
const PRIORITIES = ['EMERGENCY', 'HIGH', 'MEDIUM', 'LOW'];
const pct = (a: number, b: number) => b ? Math.round(a / b * 100) : 100;
const cColor = (p: number) => p >= 90 ? 'var(--status-success-text)' : p >= 75 ? 'var(--status-warning-text)' : 'var(--status-danger-text)';

interface Tk { status: string; priority: string; system: string; technician_id: string | null; response_met: boolean | null; resolution_met: boolean | null; created_at: string; updated_at: string; }

export default function SlaAnalyticsPage() {
  const [tickets, setTickets] = useState<Tk[]>([]);
  const [techMap, setTechMap] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [priorityFilter, setPriorityFilter] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.from('service_tickets').select('status, priority, system, technician_id, response_met, resolution_met, created_at, updated_at');
        const rows = (data || []) as Tk[];
        setTickets(rows);
        const ids = [...new Set(rows.map(r => r.technician_id).filter(Boolean))] as string[];
        if (ids.length) {
          const { data: profs } = await supabase.from('profiles').select('id, full_name').in('id', ids);
          setTechMap(new Map((profs || []).map((p: any) => [p.id, p.full_name])));
        }
      } finally { setLoading(false); }
    })();
  }, []);

  const rows = useMemo(() => priorityFilter ? tickets.filter(t => t.priority === priorityFilter) : tickets, [tickets, priorityFilter]);

  const respScored = rows.filter(t => t.response_met !== null && t.response_met !== undefined);
  const resScored = rows.filter(t => t.resolution_met !== null && t.resolution_met !== undefined);
  const respCompliance = pct(respScored.filter(t => t.response_met).length, respScored.length);
  const resCompliance = pct(resScored.filter(t => t.resolution_met).length, resScored.length);
  const breaches = resScored.filter(t => !t.resolution_met).length;

  // MTTR (hours) for resolved/closed
  const closed = rows.filter(t => (t.status === 'RESOLVED' || t.status === 'CLOSED') && t.created_at && t.updated_at);
  const mttr = closed.length ? Math.round(closed.reduce((s, t) => s + (new Date(t.updated_at).getTime() - new Date(t.created_at).getTime()) / HOUR, 0) / closed.length) : 0;

  const byPriority = PRIORITIES.map(p => {
    const scored = resScored.filter(t => t.priority === p);
    return { name: p, compliance: pct(scored.filter(t => t.resolution_met).length, scored.length), breaches: scored.filter(t => !t.resolution_met).length };
  }).filter(d => resScored.some(t => t.priority === d.name));

  const bySystem = useMemo(() => {
    const m = new Map<string, { total: number; breach: number }>();
    resScored.forEach(t => { const k = t.system || '—'; const e = m.get(k) || { total: 0, breach: 0 }; e.total++; if (!t.resolution_met) e.breach++; m.set(k, e); });
    return [...m.entries()].map(([name, v]) => ({ name, breaches: v.breach, compliance: pct(v.total - v.breach, v.total) })).sort((a, b) => b.breaches - a.breaches).slice(0, 8);
  }, [resScored]);

  const byTech = useMemo(() => {
    const m = new Map<string, { total: number; met: number }>();
    resScored.forEach(t => { if (!t.technician_id) return; const e = m.get(t.technician_id) || { total: 0, met: 0 }; e.total++; if (t.resolution_met) e.met++; m.set(t.technician_id, e); });
    return [...m.entries()].map(([id, v]) => ({ name: techMap.get(id) || 'Unknown', total: v.total, compliance: pct(v.met, v.total) })).sort((a, b) => b.total - a.total).slice(0, 10);
  }, [resScored, techMap]);

  const trend = useMemo(() => {
    const m = new Map<string, { total: number; met: number }>();
    resScored.forEach(t => { const d = new Date(t.created_at); const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; const e = m.get(k) || { total: 0, met: 0 }; e.total++; if (t.resolution_met) e.met++; m.set(k, e); });
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-6).map(([k, v]) => ({ month: k.slice(2), compliance: pct(v.met, v.total) }));
  }, [resScored]);

  const exportCols = ['Scope', 'Resolution compliance %', 'Breaches'];
  const exportRows = [['Overall', resCompliance, breaches], ...byPriority.map(p => [p.name, p.compliance, p.breaches]), ...bySystem.map(s => [s.name, s.compliance, s.breaches])];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="SLA Analytics & Compliance"
        subtitle="Response and resolution performance against SLA targets"
        breadcrumbs={[{ label: 'Service', href: '/service-desk' }, { label: 'SLA Analytics' }]}
        actions={tickets.length > 0 ? (
          <div className="flex gap-2">
            <Button variant="secondary" icon={FileDown} onClick={() => exportTablePdf({ title: 'SLA Compliance', columns: exportCols, rows: exportRows, fileName: 'sla-compliance' })}>PDF</Button>
            <Button variant="secondary" icon={Sheet} onClick={() => exportTableExcel({ title: 'SLA Compliance', columns: exportCols, rows: exportRows, fileName: 'sla-compliance' })}>Excel</Button>
          </div>
        ) : undefined}
      />

      {loading ? (
        <Card><div className="p-8 text-center text-sm text-[var(--text-tertiary)]">Loading…</div></Card>
      ) : tickets.length === 0 ? (
        <Card><EmptyState icon={Gauge} title="No tickets yet" description="SLA performance is computed from resolved tickets." /></Card>
      ) : (
        <>
          <Card className="p-4">
            <label className="text-xs font-medium text-[var(--text-secondary)]">Priority filter</label>
            <select value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)} className="w-full md:max-w-xs mt-1 px-3 h-10 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm">
              <option value="">All priorities</option>{PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </Card>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Response compliance</div><div className="text-2xl font-bold mt-1" style={{ color: cColor(respCompliance) }}>{respCompliance}%</div><div className="text-[11px] text-[var(--text-tertiary)]">{respScored.length} scored</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Resolution compliance</div><div className="text-2xl font-bold mt-1" style={{ color: cColor(resCompliance) }}>{resCompliance}%</div><div className="text-[11px] text-[var(--text-tertiary)]">{resScored.length} scored</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Breaches</div><div className="text-2xl font-bold mt-1" style={{ color: breaches ? 'var(--status-danger-text)' : 'var(--text-primary)' }}>{breaches}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Avg resolution time</div><div className="text-2xl font-bold mt-1">{mttr}<span className="text-sm font-normal text-[var(--text-tertiary)]">h</span></div></Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <Card className="p-4">
              <div className="text-sm font-semibold text-[var(--text-primary)] mb-3">Resolution compliance trend (6 mo)</div>
              <div style={{ width: '100%', height: 240 }}>
                <ResponsiveContainer>
                  {trend.length ? (
                    <LineChart data={trend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} tickFormatter={(v) => `${v}%`} />
                      <Tooltip formatter={(v: any) => `${v}%`} />
                      <Line dataKey="compliance" stroke="var(--accent)" strokeWidth={2} dot={{ r: 3 }} />
                    </LineChart>
                  ) : <div className="flex items-center justify-center h-full text-sm text-[var(--text-tertiary)]">Not enough data</div>}
                </ResponsiveContainer>
              </div>
            </Card>
            <Card className="p-4">
              <div className="text-sm font-semibold text-[var(--text-primary)] mb-3">Compliance by priority</div>
              <div style={{ width: '100%', height: 240 }}>
                <ResponsiveContainer>
                  <BarChart data={byPriority}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} tickFormatter={(v) => `${v}%`} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="compliance" name="Compliance %" fill="var(--status-success-text)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="breaches" name="Breaches" fill="var(--status-danger-text)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          {byTech.length > 0 && (
            <Card className="p-0 overflow-x-auto">
              <div className="p-3 text-sm font-semibold text-[var(--text-primary)] border-b border-[var(--border)]">Technician resolution compliance</div>
              <table className="w-full text-sm">
                <thead><tr className="border-b border-[var(--border)] text-left text-[var(--text-tertiary)] text-xs"><th className="p-3">Technician</th><th className="p-3 text-right">Resolved (scored)</th><th className="p-3 text-right">Compliance</th></tr></thead>
                <tbody>
                  {byTech.map((t, i) => (
                    <tr key={i} className="border-b border-[var(--border)] last:border-0">
                      <td className="p-3 text-[var(--text-primary)]">{t.name}</td>
                      <td className="p-3 text-right tabular-nums">{t.total}</td>
                      <td className="p-3 text-right tabular-nums font-medium" style={{ color: cColor(t.compliance) }}>{t.compliance}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
