'use client';

// ============================================================
// JEET ERP — Fuel Analytics
// Spend & litres trend, efficiency (km/l), cost-per-km, fuel-type mix,
// station spend, top consumers and an anomaly board. Read-only export.
// ============================================================

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { exportTablePdf, exportTableExcel } from '@/lib/finance-export';
import { Fuel, FileDown, Sheet, AlertTriangle } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ComposedChart, Line, PieChart, Pie, Cell, Legend } from 'recharts';

const fmtAED = (n: number) => 'AED ' + (n || 0).toLocaleString('en-AE', { maximumFractionDigits: 0 });
const PIE = ['var(--accent)', 'var(--status-info-text)', 'var(--status-success-text)', 'var(--status-warning-text)', 'var(--status-danger-text)'];

interface Log { id: string; vehicle_id: string; log_date: string; litres: number; amount: number; fuel_type: string; station: string | null; efficiency_km_l: number; is_anomaly: boolean; }

export default function FuelAnalyticsPage() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [vMap, setVMap] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.from('fuel_logs').select('id, vehicle_id, log_date, litres, amount, fuel_type, station, efficiency_km_l, is_anomaly').order('log_date', { ascending: false });
        const rows = (data || []) as Log[];
        setLogs(rows);
        const ids = [...new Set(rows.map(r => r.vehicle_id).filter(Boolean))];
        if (ids.length) { const { data: v } = await supabase.from('vehicles').select('id, vehicle_code').in('id', ids); setVMap(new Map((v || []).map((x: any) => [x.id, x.vehicle_code]))); }
      } finally { setLoading(false); }
    })();
  }, []);

  const totalSpend = logs.reduce((a, l) => a + (l.amount || 0), 0);
  const totalLitres = logs.reduce((a, l) => a + (l.litres || 0), 0);
  const estKm = logs.reduce((a, l) => a + (l.litres || 0) * (l.efficiency_km_l || 0), 0);
  const avgEff = logs.length ? logs.reduce((a, l) => a + (l.efficiency_km_l || 0), 0) / logs.filter(l => l.efficiency_km_l).length : 0;
  const costPerKm = estKm ? totalSpend / estKm : 0;
  const anomalies = logs.filter(l => l.is_anomaly);

  const byMonth = useMemo(() => {
    const m = new Map<string, { spend: number; litres: number }>();
    logs.forEach(l => { if (!l.log_date) return; const k = l.log_date.slice(0, 7); const cur = m.get(k) || { spend: 0, litres: 0 }; cur.spend += l.amount || 0; cur.litres += l.litres || 0; m.set(k, cur); });
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-12).map(([k, v]) => ({ month: k.slice(2), spend: Math.round(v.spend), litres: Math.round(v.litres) }));
  }, [logs]);

  const byType = useMemo(() => {
    const m = new Map<string, number>();
    logs.forEach(l => m.set(l.fuel_type || '—', (m.get(l.fuel_type || '—') || 0) + (l.amount || 0)));
    return [...m.entries()].map(([name, value]) => ({ name: name.replace(/_/g, ' '), value: Math.round(value) }));
  }, [logs]);

  const topVehicles = useMemo(() => {
    const m = new Map<string, number>();
    logs.forEach(l => m.set(l.vehicle_id, (m.get(l.vehicle_id) || 0) + (l.amount || 0)));
    return [...m.entries()].map(([id, v]) => ({ name: vMap.get(id) || id.slice(0, 6), value: Math.round(v) })).sort((a, b) => b.value - a.value).slice(0, 8);
  }, [logs, vMap]);

  const exportCols = ['Date', 'Vehicle', 'Litres', 'Amount', 'Fuel', 'Efficiency (km/l)', 'Station', 'Anomaly'];
  const exportRows = logs.map(l => [l.log_date, vMap.get(l.vehicle_id) || '', l.litres, l.amount, l.fuel_type, l.efficiency_km_l, l.station || '', l.is_anomaly ? 'YES' : '']);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Fuel Analytics"
        subtitle="Spend, litres, efficiency, cost-per-km and anomalies"
        breadcrumbs={[{ label: 'Fleet & Assets', href: '/fleet/hub' }, { label: 'Fuel' }]}
        actions={logs.length > 0 ? (
          <div className="flex gap-2">
            <Button variant="secondary" icon={FileDown} onClick={() => exportTablePdf({ title: 'Fuel Logs', columns: exportCols, rows: exportRows, fileName: 'fuel-logs' })}>PDF</Button>
            <Button variant="secondary" icon={Sheet} onClick={() => exportTableExcel({ title: 'Fuel Logs', columns: exportCols, rows: exportRows, fileName: 'fuel-logs' })}>Excel</Button>
          </div>
        ) : undefined}
      />

      {loading ? (
        <Card><div className="p-8 text-center text-sm text-[var(--text-tertiary)]">Loading…</div></Card>
      ) : logs.length === 0 ? (
        <Card><EmptyState icon={Fuel} title="No fuel logs" description="Fuel spend, efficiency and anomalies will be analysed here once logs are recorded." /></Card>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Total spend</div><div className="text-xl font-bold mt-1">{fmtAED(totalSpend)}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Litres</div><div className="text-2xl font-bold mt-1">{Math.round(totalLitres).toLocaleString()}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Avg efficiency</div><div className="text-2xl font-bold mt-1">{avgEff.toFixed(1)}<span className="text-sm font-normal text-[var(--text-tertiary)]"> km/l</span></div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Cost / km</div><div className="text-2xl font-bold mt-1">{costPerKm ? `AED ${costPerKm.toFixed(2)}` : '—'}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Anomalies</div><div className="text-2xl font-bold mt-1" style={{ color: anomalies.length ? 'var(--status-danger-text)' : 'var(--text-primary)' }}>{anomalies.length}</div></Card>
          </div>

          <Card className="p-4">
            <div className="text-sm font-semibold text-[var(--text-primary)] mb-3">Spend & litres per month</div>
            <div style={{ width: '100%', height: 260 }}>
              <ResponsiveContainer>
                <ComposedChart data={byMonth}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} />
                  <YAxis yAxisId="l" tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} />
                  <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} />
                  <Tooltip />
                  <Bar yAxisId="l" dataKey="spend" name="Spend (AED)" fill="var(--accent)" radius={[4, 4, 0, 0]} />
                  <Line yAxisId="r" dataKey="litres" name="Litres" stroke="var(--status-info-text)" strokeWidth={2} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <Card className="p-4">
              <div className="text-sm font-semibold text-[var(--text-primary)] mb-3">Spend by fuel type</div>
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
              <div className="text-sm font-semibold text-[var(--text-primary)] mb-3">Top consumers (spend)</div>
              <div style={{ width: '100%', height: 240 }}>
                <ResponsiveContainer>
                  <BarChart data={topVehicles} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} />
                    <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} />
                    <Tooltip formatter={(v: any) => fmtAED(Number(v))} />
                    <Bar dataKey="value" fill="var(--status-success-text)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          {anomalies.length > 0 && (
            <Card className="p-0 overflow-x-auto">
              <div className="p-3 text-sm font-semibold border-b border-[var(--border)] flex items-center gap-2" style={{ color: 'var(--status-danger-text)' }}><AlertTriangle size={15} /> Flagged anomalies ({anomalies.length})</div>
              <table className="w-full text-sm">
                <thead><tr className="border-b border-[var(--border)] text-left text-[var(--text-tertiary)] text-xs"><th className="p-3">Date</th><th className="p-3">Vehicle</th><th className="p-3">Litres</th><th className="p-3">Amount</th><th className="p-3">Efficiency</th><th className="p-3">Station</th></tr></thead>
                <tbody>
                  {anomalies.map(l => (
                    <tr key={l.id} className="border-b border-[var(--border)] last:border-0">
                      <td className="p-3 text-xs text-[var(--text-secondary)]">{l.log_date}</td>
                      <td className="p-3 font-medium text-[var(--text-primary)]">{vMap.get(l.vehicle_id) || '—'}</td>
                      <td className="p-3 text-xs text-[var(--text-secondary)]">{l.litres}</td>
                      <td className="p-3 text-xs text-[var(--text-secondary)]">{fmtAED(l.amount)}</td>
                      <td className="p-3 text-xs text-[var(--text-secondary)]">{l.efficiency_km_l?.toFixed(1)} km/l</td>
                      <td className="p-3 text-xs text-[var(--text-secondary)]">{l.station || '—'}</td>
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
