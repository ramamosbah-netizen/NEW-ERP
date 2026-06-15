'use client';

// ============================================================
// JEET ERP — Maintenance & Downtime Analytics
// Cost by type & month, downtime days, availability and a
// "service due" radar (next_service_date). Read-only export.
// ============================================================

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { exportTablePdf, exportTableExcel } from '@/lib/finance-export';
import { Wrench, FileDown, Sheet } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell, Legend } from 'recharts';

const fmtAED = (n: number) => 'AED ' + (n || 0).toLocaleString('en-AE', { maximumFractionDigits: 0 });
const PIE = ['var(--accent)', 'var(--status-info-text)', 'var(--status-success-text)', 'var(--status-warning-text)', 'var(--status-danger-text)', '#a855f7'];
const daysUntil = (d?: string | null) => d ? Math.ceil((new Date(d).getTime() - Date.now()) / 86400000) : null;

interface Mt { id: string; vehicle_id: string; type: string; service_date: string; vendor: string; cost: number; next_service_date: string | null; downtime_days: number; status: string; }

export default function MaintenancePage() {
  const router = useRouter();
  const [rows, setRows] = useState<Mt[]>([]);
  const [vMap, setVMap] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.from('vehicle_maintenance').select('id, vehicle_id, type, service_date, vendor, cost, next_service_date, downtime_days, status').order('service_date', { ascending: false });
        const r = (data || []) as Mt[];
        setRows(r);
        const ids = [...new Set(r.map(x => x.vehicle_id).filter(Boolean))];
        if (ids.length) { const { data: v } = await supabase.from('vehicles').select('id, vehicle_code').in('id', ids); setVMap(new Map((v || []).map((x: any) => [x.id, x.vehicle_code]))); }
      } finally { setLoading(false); }
    })();
  }, []);

  const totalCost = rows.reduce((a, r) => a + (r.cost || 0), 0);
  const totalDowntime = rows.reduce((a, r) => a + (r.downtime_days || 0), 0);
  const openJobs = rows.filter(r => r.status === 'SCHEDULED' || r.status === 'IN_PROGRESS');
  const dueSoon = useMemo(() => rows.filter(r => { const d = daysUntil(r.next_service_date); return d !== null && d <= 30; }).sort((a, b) => (daysUntil(a.next_service_date) ?? 0) - (daysUntil(b.next_service_date) ?? 0)), [rows]);

  const byType = useMemo(() => { const m = new Map<string, number>(); rows.forEach(r => m.set(r.type || '—', (m.get(r.type || '—') || 0) + (r.cost || 0))); return [...m.entries()].map(([name, value]) => ({ name: name.replace(/_/g, ' '), value: Math.round(value) })).sort((a, b) => b.value - a.value); }, [rows]);
  const byMonth = useMemo(() => { const m = new Map<string, number>(); rows.forEach(r => { if (!r.service_date) return; const k = r.service_date.slice(0, 7); m.set(k, (m.get(k) || 0) + (r.cost || 0)); }); return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-12).map(([k, v]) => ({ month: k.slice(2), value: Math.round(v) })); }, [rows]);
  const downByVehicle = useMemo(() => { const m = new Map<string, number>(); rows.forEach(r => m.set(r.vehicle_id, (m.get(r.vehicle_id) || 0) + (r.downtime_days || 0))); return [...m.entries()].map(([id, v]) => ({ name: vMap.get(id) || id.slice(0, 6), value: v })).filter(x => x.value > 0).sort((a, b) => b.value - a.value).slice(0, 8); }, [rows, vMap]);

  const exportCols = ['Date', 'Vehicle', 'Type', 'Vendor', 'Cost', 'Downtime (d)', 'Next service', 'Status'];
  const exportRows = rows.map(r => [r.service_date, vMap.get(r.vehicle_id) || '', r.type, r.vendor, r.cost, r.downtime_days, r.next_service_date || '', r.status]);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Maintenance & Downtime"
        subtitle="Cost by type & month, downtime and the service-due radar"
        breadcrumbs={[{ label: 'Fleet & Assets', href: '/fleet/hub' }, { label: 'Maintenance' }]}
        actions={rows.length > 0 ? (
          <div className="flex gap-2">
            <Button variant="secondary" icon={FileDown} onClick={() => exportTablePdf({ title: 'Vehicle Maintenance', columns: exportCols, rows: exportRows, fileName: 'vehicle-maintenance' })}>PDF</Button>
            <Button variant="secondary" icon={Sheet} onClick={() => exportTableExcel({ title: 'Vehicle Maintenance', columns: exportCols, rows: exportRows, fileName: 'vehicle-maintenance' })}>Excel</Button>
          </div>
        ) : undefined}
      />

      {loading ? (
        <Card><div className="p-8 text-center text-sm text-[var(--text-tertiary)]">Loading…</div></Card>
      ) : rows.length === 0 ? (
        <Card><EmptyState icon={Wrench} title="No maintenance records" description="Maintenance cost, downtime and service-due alerts will appear here once records are logged." /></Card>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Total cost</div><div className="text-xl font-bold mt-1">{fmtAED(totalCost)}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Records</div><div className="text-2xl font-bold mt-1">{rows.length}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Downtime days</div><div className="text-2xl font-bold mt-1">{totalDowntime}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Open jobs</div><div className="text-2xl font-bold mt-1" style={{ color: openJobs.length ? 'var(--status-warning-text)' : 'var(--text-primary)' }}>{openJobs.length}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Service due ≤30d</div><div className="text-2xl font-bold mt-1" style={{ color: dueSoon.length ? 'var(--status-danger-text)' : 'var(--text-primary)' }}>{dueSoon.length}</div></Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <Card className="p-4">
              <div className="text-sm font-semibold text-[var(--text-primary)] mb-3">Cost by type</div>
              <div style={{ width: '100%', height: 240 }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={byType} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={80} fontSize={11}>{byType.map((e, i) => <Cell key={i} fill={PIE[i % PIE.length]} />)}</Pie>
                    <Legend wrapperStyle={{ fontSize: 11 }} /><Tooltip formatter={(v: any) => fmtAED(Number(v))} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card className="p-4">
              <div className="text-sm font-semibold text-[var(--text-primary)] mb-3">Cost per month</div>
              <div style={{ width: '100%', height: 240 }}>
                <ResponsiveContainer>
                  <BarChart data={byMonth}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} />
                    <YAxis tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} />
                    <Tooltip formatter={(v: any) => fmtAED(Number(v))} />
                    <Bar dataKey="value" fill="var(--accent)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          {downByVehicle.length > 0 && (
            <Card className="p-4">
              <div className="text-sm font-semibold text-[var(--text-primary)] mb-3">Downtime days by vehicle</div>
              <div style={{ width: '100%', height: 240 }}>
                <ResponsiveContainer>
                  <BarChart data={downByVehicle} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} allowDecimals={false} />
                    <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} />
                    <Tooltip />
                    <Bar dataKey="value" fill="var(--status-danger-text)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          )}

          <Card className="p-0 overflow-x-auto">
            <div className="p-3 text-sm font-semibold text-[var(--text-primary)] border-b border-[var(--border)]">Service due radar ({dueSoon.length})</div>
            {dueSoon.length === 0 ? <div className="p-5 text-center text-sm text-[var(--text-tertiary)]">No vehicles due for service within 30 days.</div> : (
              <table className="w-full text-sm">
                <thead><tr className="border-b border-[var(--border)] text-left text-[var(--text-tertiary)] text-xs"><th className="p-3">Vehicle</th><th className="p-3">Last type</th><th className="p-3">Next service</th><th className="p-3">Due in</th><th className="p-3">Vendor</th></tr></thead>
                <tbody>
                  {dueSoon.map(r => { const d = daysUntil(r.next_service_date); return (
                    <tr key={r.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-hover)] cursor-pointer" onClick={() => router.push(`/fleet/${r.vehicle_id}`)}>
                      <td className="p-3 font-medium text-[var(--text-primary)]">{vMap.get(r.vehicle_id) || '—'}</td>
                      <td className="p-3 text-xs text-[var(--text-secondary)]">{r.type?.replace(/_/g, ' ')}</td>
                      <td className="p-3 text-xs text-[var(--text-secondary)]">{r.next_service_date}</td>
                      <td className="p-3 text-xs font-medium" style={{ color: (d ?? 0) < 0 ? 'var(--status-danger-text)' : 'var(--status-warning-text)' }}>{d !== null && d < 0 ? `${Math.abs(d)}d overdue` : `${d}d`}</td>
                      <td className="p-3 text-xs text-[var(--text-secondary)]">{r.vendor}</td>
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
