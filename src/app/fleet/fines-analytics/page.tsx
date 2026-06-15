'use client';

// ============================================================
// JEET ERP — Traffic Fines Analytics
// Unpaid exposure, driver liability, black points, violation hot-spots
// and monthly trend. Read-only; PDF + Excel export.
// ============================================================

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { exportTablePdf, exportTableExcel } from '@/lib/finance-export';
import { AlertTriangle, FileDown, Sheet } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell, PieChart, Pie, Legend } from 'recharts';

const fmtAED = (n: number) => 'AED ' + (n || 0).toLocaleString('en-AE', { maximumFractionDigits: 0 });
const PIE = ['var(--accent)', 'var(--status-info-text)', 'var(--status-success-text)', 'var(--status-warning-text)', 'var(--status-danger-text)'];
const STATUS_COLOR: Record<string, string> = { UNPAID: 'var(--status-danger-text)', PAID: 'var(--status-success-text)', DISPUTED: 'var(--status-warning-text)', TRANSFERRED_TO_DRIVER: 'var(--status-info-text)' };

interface Fine { id: string; vehicle_id: string; fine_number: string; fine_date: string; location: string; violation_type: string; amount: number; black_points: number; source: string; driver_id: string | null; status: string; }

export default function FinesAnalyticsPage() {
  const [fines, setFines] = useState<Fine[]>([]);
  const [vMap, setVMap] = useState<Map<string, string>>(new Map());
  const [dMap, setDMap] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.from('vehicle_fines').select('id, vehicle_id, fine_number, fine_date, location, violation_type, amount, black_points, source, driver_id, status').order('fine_date', { ascending: false });
        const rows = (data || []) as Fine[];
        setFines(rows);
        const vids = [...new Set(rows.map(r => r.vehicle_id).filter(Boolean))];
        const dids = [...new Set(rows.map(r => r.driver_id).filter(Boolean))] as string[];
        if (vids.length) { const { data: v } = await supabase.from('vehicles').select('id, vehicle_code').in('id', vids); setVMap(new Map((v || []).map((x: any) => [x.id, x.vehicle_code]))); }
        if (dids.length) { const { data: e } = await supabase.from('employees').select('id, full_name_en').in('id', dids); setDMap(new Map((e || []).map((x: any) => [x.id, x.full_name_en]))); }
      } finally { setLoading(false); }
    })();
  }, []);

  const unpaid = fines.filter(f => f.status === 'UNPAID' || f.status === 'DISPUTED');
  const unpaidAmt = unpaid.reduce((a, f) => a + (f.amount || 0), 0);
  const totalAmt = fines.reduce((a, f) => a + (f.amount || 0), 0);
  const totalPoints = fines.reduce((a, f) => a + (f.black_points || 0), 0);
  const driverLiable = fines.filter(f => f.status === 'TRANSFERRED_TO_DRIVER').length;

  const byStatus = useMemo(() => { const m = new Map<string, number>(); fines.forEach(f => m.set(f.status, (m.get(f.status) || 0) + 1)); return [...m.entries()].map(([name, value]) => ({ name: name.replace(/_/g, ' '), value, raw: name })); }, [fines]);
  const byMonth = useMemo(() => { const m = new Map<string, number>(); fines.forEach(f => { if (!f.fine_date) return; const k = f.fine_date.slice(0, 7); m.set(k, (m.get(k) || 0) + (f.amount || 0)); }); return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-12).map(([k, v]) => ({ month: k.slice(2), value: Math.round(v) })); }, [fines]);
  const byViolation = useMemo(() => { const m = new Map<string, number>(); fines.forEach(f => m.set(f.violation_type || '—', (m.get(f.violation_type || '—') || 0) + 1)); return [...m.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 8); }, [fines]);

  const byDriver = useMemo(() => {
    const m = new Map<string, { amount: number; points: number; count: number }>();
    fines.forEach(f => { if (!f.driver_id) return; const c = m.get(f.driver_id) || { amount: 0, points: 0, count: 0 }; c.amount += f.amount || 0; c.points += f.black_points || 0; c.count++; m.set(f.driver_id, c); });
    return [...m.entries()].map(([id, v]) => ({ id, name: dMap.get(id) || '—', ...v })).sort((a, b) => b.amount - a.amount);
  }, [fines, dMap]);

  const exportCols = ['Fine #', 'Date', 'Vehicle', 'Driver', 'Violation', 'Amount', 'Points', 'Source', 'Status'];
  const exportRows = fines.map(f => [f.fine_number, f.fine_date, vMap.get(f.vehicle_id) || '', f.driver_id ? dMap.get(f.driver_id) || '' : '', f.violation_type, f.amount, f.black_points, f.source, f.status]);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Traffic Fines Analytics"
        subtitle="Unpaid exposure, driver liability, black points and hot-spots"
        breadcrumbs={[{ label: 'Fleet & Assets', href: '/fleet/hub' }, { label: 'Fines' }]}
        actions={fines.length > 0 ? (
          <div className="flex gap-2">
            <Button variant="secondary" icon={FileDown} onClick={() => exportTablePdf({ title: 'Traffic Fines', columns: exportCols, rows: exportRows, fileName: 'traffic-fines' })}>PDF</Button>
            <Button variant="secondary" icon={Sheet} onClick={() => exportTableExcel({ title: 'Traffic Fines', columns: exportCols, rows: exportRows, fileName: 'traffic-fines' })}>Excel</Button>
          </div>
        ) : undefined}
      />

      {loading ? (
        <Card><div className="p-8 text-center text-sm text-[var(--text-tertiary)]">Loading…</div></Card>
      ) : fines.length === 0 ? (
        <Card><EmptyState icon={AlertTriangle} title="No fines" description="Traffic-fine exposure, liability and hot-spots will be analysed here once fines are recorded." /></Card>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Total fines</div><div className="text-2xl font-bold mt-1">{fines.length}</div><div className="text-[11px] text-[var(--text-tertiary)]">{fmtAED(totalAmt)}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Unpaid exposure</div><div className="text-xl font-bold mt-1" style={{ color: 'var(--status-danger-text)' }}>{fmtAED(unpaidAmt)}</div><div className="text-[11px] text-[var(--text-tertiary)]">{unpaid.length} open</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Black points</div><div className="text-2xl font-bold mt-1" style={{ color: totalPoints ? 'var(--status-warning-text)' : 'var(--text-primary)' }}>{totalPoints}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Driver-liable</div><div className="text-2xl font-bold mt-1">{driverLiable}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Avg fine</div><div className="text-xl font-bold mt-1">{fmtAED(fines.length ? totalAmt / fines.length : 0)}</div></Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <Card className="p-4">
              <div className="text-sm font-semibold text-[var(--text-primary)] mb-3">By status</div>
              <div style={{ width: '100%', height: 240 }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={byStatus} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={(e: any) => `${e.name} (${e.value})`} labelLine={false} fontSize={11}>{byStatus.map((e, i) => <Cell key={i} fill={STATUS_COLOR[e.raw] || PIE[i % PIE.length]} />)}</Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card className="p-4">
              <div className="text-sm font-semibold text-[var(--text-primary)] mb-3">Fines amount per month</div>
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

          <Card className="p-4">
            <div className="text-sm font-semibold text-[var(--text-primary)] mb-3">Top violation types</div>
            <div style={{ width: '100%', height: 240 }}>
              <ResponsiveContainer>
                <BarChart data={byViolation} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} />
                  <Tooltip />
                  <Bar dataKey="value" fill="var(--status-warning-text)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {byDriver.length > 0 && (
            <Card className="p-0 overflow-x-auto">
              <div className="p-3 text-sm font-semibold text-[var(--text-primary)] border-b border-[var(--border)]">Driver liability ({byDriver.length})</div>
              <table className="w-full text-sm">
                <thead><tr className="border-b border-[var(--border)] text-left text-[var(--text-tertiary)] text-xs"><th className="p-3">Driver</th><th className="p-3">Fines</th><th className="p-3">Amount</th><th className="p-3">Black points</th></tr></thead>
                <tbody>
                  {byDriver.map(d => (
                    <tr key={d.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-hover)]">
                      <td className="p-3 font-medium text-[var(--text-primary)]">{d.name}</td>
                      <td className="p-3 text-xs text-[var(--text-secondary)]">{d.count}</td>
                      <td className="p-3 text-xs text-[var(--text-secondary)]">{fmtAED(d.amount)}</td>
                      <td className="p-3 text-xs font-medium" style={{ color: d.points ? 'var(--status-warning-text)' : 'var(--text-secondary)' }}>{d.points}</td>
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
