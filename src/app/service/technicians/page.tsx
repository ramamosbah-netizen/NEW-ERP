'use client';

// ============================================================
// JEET ERP — Service: Technician Utilization & Dispatch
// Workload (open tickets + PPM visits) and throughput per technician.
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
import { Users, FileDown, Sheet } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';

const OPEN_TICKET = ['NEW', 'ASSIGNED', 'IN_PROGRESS', 'ON_HOLD_PARTS'];
const OPEN_VISIT = ['UNSCHEDULED', 'SCHEDULED', 'IN_PROGRESS'];

interface Tk { technician_id: string | null; status: string; resolution_met: boolean | null; }
interface Vt { technician_id: string | null; second_technician_id: string | null; status: string; }
interface Row { id: string; name: string; openTickets: number; openVisits: number; load: number; doneTickets: number; doneVisits: number; resScored: number; resMet: number; }

export default function TechnicianUtilizationPage() {
  const router = useRouter();
  const [tickets, setTickets] = useState<Tk[]>([]);
  const [visits, setVisits] = useState<Vt[]>([]);
  const [nameMap, setNameMap] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [tk, vt] = await Promise.all([
          supabase.from('service_tickets').select('technician_id, status, resolution_met'),
          supabase.from('ppm_visits').select('technician_id, second_technician_id, status'),
        ]);
        const tkRows = (tk.data || []) as Tk[];
        const vtRows = (vt.data || []) as Vt[];
        setTickets(tkRows); setVisits(vtRows);
        const ids = [...new Set([
          ...tkRows.map(t => t.technician_id),
          ...vtRows.map(v => v.technician_id),
          ...vtRows.map(v => v.second_technician_id),
        ].filter(Boolean))] as string[];
        if (ids.length) {
          const { data: profs } = await supabase.from('profiles').select('id, full_name').in('id', ids);
          setNameMap(new Map((profs || []).map((p: any) => [p.id, p.full_name])));
        }
      } finally { setLoading(false); }
    })();
  }, []);

  const rows = useMemo<Row[]>(() => {
    const m = new Map<string, Row>();
    const ensure = (id: string) => { if (!m.has(id)) m.set(id, { id, name: nameMap.get(id) || 'Unknown', openTickets: 0, openVisits: 0, load: 0, doneTickets: 0, doneVisits: 0, resScored: 0, resMet: 0 }); return m.get(id)!; };
    tickets.forEach(t => {
      if (!t.technician_id) return;
      const r = ensure(t.technician_id);
      if (OPEN_TICKET.includes(t.status)) r.openTickets++;
      if (t.status === 'RESOLVED' || t.status === 'CLOSED') r.doneTickets++;
      if (t.resolution_met !== null && t.resolution_met !== undefined) { r.resScored++; if (t.resolution_met) r.resMet++; }
    });
    visits.forEach(v => {
      [v.technician_id, v.second_technician_id].filter(Boolean).forEach(id => {
        const r = ensure(id as string);
        if (OPEN_VISIT.includes(v.status)) r.openVisits++;
        if (v.status === 'COMPLETED') r.doneVisits++;
      });
    });
    m.forEach(r => { r.load = r.openTickets + r.openVisits; });
    return [...m.values()].sort((a, b) => b.load - a.load);
  }, [tickets, visits, nameMap]);

  const unassigned = tickets.filter(t => !t.technician_id && OPEN_TICKET.includes(t.status)).length;
  const totalLoad = rows.reduce((s, r) => s + r.load, 0);
  const avgLoad = rows.length ? Math.round(totalLoad / rows.length * 10) / 10 : 0;

  const chart = rows.slice(0, 10).map(r => ({ name: r.name.split(' ')[0], Tickets: r.openTickets, Visits: r.openVisits }));

  const exportCols = ['Technician', 'Open tickets', 'Open PPM', 'Total load', 'Tickets done', 'Visits done', 'Resolution compliance %'];
  const exportRows = rows.map(r => [r.name, r.openTickets, r.openVisits, r.load, r.doneTickets, r.doneVisits, r.resScored ? Math.round(r.resMet / r.resScored * 100) : 100]);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Technician Utilization & Dispatch"
        subtitle="Open workload and throughput per technician"
        breadcrumbs={[{ label: 'Service', href: '/service-desk' }, { label: 'Technicians' }]}
        actions={rows.length > 0 ? (
          <div className="flex gap-2">
            <Button variant="secondary" icon={FileDown} onClick={() => exportTablePdf({ title: 'Technician Utilization', columns: exportCols, rows: exportRows, fileName: 'technician-utilization' })}>PDF</Button>
            <Button variant="secondary" icon={Sheet} onClick={() => exportTableExcel({ title: 'Technician Utilization', columns: exportCols, rows: exportRows, fileName: 'technician-utilization' })}>Excel</Button>
          </div>
        ) : undefined}
      />

      {loading ? (
        <Card><div className="p-8 text-center text-sm text-[var(--text-tertiary)]">Loading…</div></Card>
      ) : rows.length === 0 ? (
        <Card><EmptyState icon={Users} title="No assignments" description="Once tickets and PPM visits are assigned to technicians, workload appears here." /></Card>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Technicians active</div><div className="text-2xl font-bold mt-1">{rows.length}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Open assignments</div><div className="text-2xl font-bold mt-1">{totalLoad}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Avg load / tech</div><div className="text-2xl font-bold mt-1">{avgLoad}</div></Card>
            <Card className="p-4 cursor-pointer hover:border-[var(--accent)]" onClick={() => router.push('/service-desk')}><div className="text-xs text-[var(--text-secondary)]">Unassigned tickets</div><div className="text-2xl font-bold mt-1" style={{ color: unassigned ? 'var(--status-warning-text)' : 'var(--text-primary)' }}>{unassigned}</div></Card>
          </div>

          <Card className="p-4">
            <div className="text-sm font-semibold text-[var(--text-primary)] mb-3">Open workload by technician</div>
            <div style={{ width: '100%', height: 260 }}>
              <ResponsiveContainer>
                <BarChart data={chart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="Tickets" stackId="a" fill="var(--accent)" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="Visits" stackId="a" fill="var(--status-info-text)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-[var(--border)] text-left text-[var(--text-tertiary)] text-xs">
                <th className="p-3">Technician</th><th className="p-3 text-right">Open tickets</th><th className="p-3 text-right">Open PPM</th>
                <th className="p-3 text-right">Load</th><th className="p-3 text-right">Tickets done</th><th className="p-3 text-right">Visits done</th><th className="p-3 text-right">SLA compliance</th>
              </tr></thead>
              <tbody>
                {rows.map(r => { const comp = r.resScored ? Math.round(r.resMet / r.resScored * 100) : 100; return (
                  <tr key={r.id} className="border-b border-[var(--border)] last:border-0">
                    <td className="p-3 font-medium text-[var(--text-primary)]">{r.name}</td>
                    <td className="p-3 text-right tabular-nums">{r.openTickets}</td>
                    <td className="p-3 text-right tabular-nums">{r.openVisits}</td>
                    <td className="p-3 text-right tabular-nums font-medium">{r.load}</td>
                    <td className="p-3 text-right tabular-nums text-[var(--text-secondary)]">{r.doneTickets}</td>
                    <td className="p-3 text-right tabular-nums text-[var(--text-secondary)]">{r.doneVisits}</td>
                    <td className="p-3 text-right tabular-nums" style={{ color: comp >= 90 ? 'var(--status-success-text)' : comp >= 75 ? 'var(--status-warning-text)' : 'var(--status-danger-text)' }}>{r.resScored ? `${comp}%` : '—'}</td>
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
