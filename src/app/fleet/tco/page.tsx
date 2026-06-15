'use client';

// ============================================================
// JEET ERP — Total Cost of Ownership (Fleet)
// Per vehicle: purchase + fuel + fines + maintenance, and the
// operating cost per kilometre. Read-only; PDF + Excel export.
// ============================================================

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { exportTablePdf, exportTableExcel } from '@/lib/finance-export';
import { Gauge, FileDown, Sheet } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';

const fmtAED = (n: number) => 'AED ' + (n || 0).toLocaleString('en-AE', { maximumFractionDigits: 0 });

interface Row { id: string; code: string; plate: string; purchase: number; fuel: number; fines: number; maint: number; odo: number; opex: number; tco: number; costPerKm: number; }

export default function TcoPage() {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [veh, fuel, fine, maint] = await Promise.all([
          supabase.from('vehicles').select('id, vehicle_code, plate_number, plate_emirate, purchase_cost, odometer_km').eq('is_active', true),
          supabase.from('fuel_logs').select('vehicle_id, amount'),
          supabase.from('vehicle_fines').select('vehicle_id, amount'),
          supabase.from('vehicle_maintenance').select('vehicle_id, cost'),
        ]);
        const sum = (arr: any[], k: string) => { const m = new Map<string, number>(); (arr || []).forEach(r => m.set(r.vehicle_id, (m.get(r.vehicle_id) || 0) + (r[k] || 0))); return m; };
        const fuelM = sum(fuel.data || [], 'amount');
        const fineM = sum(fine.data || [], 'amount');
        const maintM = sum(maint.data || [], 'cost');
        const out: Row[] = (veh.data || []).map((v: any) => {
          const purchase = v.purchase_cost || 0;
          const f = fuelM.get(v.id) || 0, fn = fineM.get(v.id) || 0, mt = maintM.get(v.id) || 0;
          const opex = f + fn + mt;
          const odo = v.odometer_km || 0;
          return { id: v.id, code: v.vehicle_code, plate: `${(v.plate_emirate || '').replace(/_/g, ' ')} ${v.plate_number}`, purchase, fuel: f, fines: fn, maint: mt, odo, opex, tco: purchase + opex, costPerKm: odo ? opex / odo : 0 };
        }).sort((a, b) => b.tco - a.tco);
        setRows(out);
      } finally { setLoading(false); }
    })();
  }, []);

  const totals = useMemo(() => rows.reduce((a, r) => ({ purchase: a.purchase + r.purchase, fuel: a.fuel + r.fuel, fines: a.fines + r.fines, maint: a.maint + r.maint, tco: a.tco + r.tco, opex: a.opex + r.opex, odo: a.odo + r.odo }), { purchase: 0, fuel: 0, fines: 0, maint: 0, tco: 0, opex: 0, odo: 0 }), [rows]);
  const avgCostPerKm = totals.odo ? totals.opex / totals.odo : 0;

  const chartData = rows.slice(0, 8).map(r => ({ name: r.code, Fuel: Math.round(r.fuel), Fines: Math.round(r.fines), Maintenance: Math.round(r.maint), Purchase: Math.round(r.purchase) }));

  const exportCols = ['Vehicle', 'Plate', 'Purchase', 'Fuel', 'Fines', 'Maintenance', 'Opex', 'TCO', 'Odometer (km)', 'Opex/km'];
  const exportRows = rows.map(r => [r.code, r.plate, r.purchase, Math.round(r.fuel), Math.round(r.fines), Math.round(r.maint), Math.round(r.opex), Math.round(r.tco), r.odo, r.costPerKm.toFixed(2)]);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Total Cost of Ownership"
        subtitle="Purchase + fuel + fines + maintenance, and cost per kilometre"
        breadcrumbs={[{ label: 'Fleet & Assets', href: '/fleet/hub' }, { label: 'TCO' }]}
        actions={rows.length > 0 ? (
          <div className="flex gap-2">
            <Button variant="secondary" icon={FileDown} onClick={() => exportTablePdf({ title: 'Fleet TCO', columns: exportCols, rows: exportRows, fileName: 'fleet-tco' })}>PDF</Button>
            <Button variant="secondary" icon={Sheet} onClick={() => exportTableExcel({ title: 'Fleet TCO', columns: exportCols, rows: exportRows, fileName: 'fleet-tco' })}>Excel</Button>
          </div>
        ) : undefined}
      />

      {loading ? (
        <Card><div className="p-8 text-center text-sm text-[var(--text-tertiary)]">Loading…</div></Card>
      ) : rows.length === 0 ? (
        <Card><EmptyState icon={Gauge} title="No vehicles" description="Total cost of ownership is computed from vehicles plus their fuel, fines and maintenance." /></Card>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Total TCO</div><div className="text-xl font-bold mt-1">{fmtAED(totals.tco)}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Operating cost</div><div className="text-xl font-bold mt-1">{fmtAED(totals.opex)}</div><div className="text-[11px] text-[var(--text-tertiary)]">fuel + fines + maint</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Fuel</div><div className="text-xl font-bold mt-1" style={{ color: 'var(--accent)' }}>{fmtAED(totals.fuel)}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Maintenance</div><div className="text-xl font-bold mt-1" style={{ color: 'var(--status-warning-text)' }}>{fmtAED(totals.maint)}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Avg opex / km</div><div className="text-xl font-bold mt-1">{avgCostPerKm ? `AED ${avgCostPerKm.toFixed(2)}` : '—'}</div></Card>
          </div>

          <Card className="p-4">
            <div className="text-sm font-semibold text-[var(--text-primary)] mb-3">Cost breakdown — top vehicles by TCO</div>
            <div style={{ width: '100%', height: 300 }}>
              <ResponsiveContainer>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} />
                  <Tooltip formatter={(v: any) => fmtAED(Number(v))} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="Purchase" stackId="a" fill="#64748b" />
                  <Bar dataKey="Fuel" stackId="a" fill="var(--accent)" />
                  <Bar dataKey="Maintenance" stackId="a" fill="var(--status-warning-text)" />
                  <Bar dataKey="Fines" stackId="a" fill="var(--status-danger-text)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="p-0 overflow-x-auto">
            <div className="p-3 text-sm font-semibold text-[var(--text-primary)] border-b border-[var(--border)]">Per-vehicle TCO ({rows.length})</div>
            <table className="w-full text-sm">
              <thead><tr className="border-b border-[var(--border)] text-left text-[var(--text-tertiary)] text-xs"><th className="p-3">Vehicle</th><th className="p-3 text-right">Purchase</th><th className="p-3 text-right">Fuel</th><th className="p-3 text-right">Fines</th><th className="p-3 text-right">Maint.</th><th className="p-3 text-right">TCO</th><th className="p-3 text-right">Opex/km</th></tr></thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-hover)] cursor-pointer" onClick={() => router.push(`/fleet/${r.id}`)}>
                    <td className="p-3"><div className="font-medium text-[var(--text-primary)]">{r.code}</div><div className="text-[11px] text-[var(--text-tertiary)]">{r.plate}</div></td>
                    <td className="p-3 text-right text-xs text-[var(--text-secondary)]">{fmtAED(r.purchase)}</td>
                    <td className="p-3 text-right text-xs text-[var(--text-secondary)]">{fmtAED(r.fuel)}</td>
                    <td className="p-3 text-right text-xs" style={{ color: r.fines ? 'var(--status-danger-text)' : 'var(--text-secondary)' }}>{fmtAED(r.fines)}</td>
                    <td className="p-3 text-right text-xs text-[var(--text-secondary)]">{fmtAED(r.maint)}</td>
                    <td className="p-3 text-right text-sm font-semibold text-[var(--text-primary)]">{fmtAED(r.tco)}</td>
                    <td className="p-3 text-right text-xs text-[var(--text-secondary)]">{r.costPerKm ? `AED ${r.costPerKm.toFixed(2)}` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </div>
  );
}
