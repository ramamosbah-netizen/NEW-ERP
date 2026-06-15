'use client';

// ============================================================
// JEET ERP — Fleet Dashboard
// Vehicles by status / type / ownership / emirate, fleet value,
// odometer and age distribution. Read-only; PDF + Excel export.
// ============================================================

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { exportTablePdf, exportTableExcel } from '@/lib/finance-export';
import { Car, FileDown, Sheet } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell, Legend } from 'recharts';

const fmtAED = (n: number) => 'AED ' + (n || 0).toLocaleString('en-AE', { maximumFractionDigits: 0 });
const PIE = ['var(--accent)', 'var(--status-info-text)', 'var(--status-success-text)', 'var(--status-warning-text)', 'var(--status-danger-text)', '#a855f7', '#64748b'];
const STATUS_COLOR: Record<string, string> = { ACTIVE: 'var(--status-success-text)', IN_WORKSHOP: 'var(--status-warning-text)', OFF_ROAD: 'var(--status-danger-text)', SOLD: 'var(--text-tertiary)', DISPOSED: 'var(--text-tertiary)' };

interface Veh { id: string; vehicle_code: string; plate_number: string; plate_emirate: string; make: string; model: string; year: number; vehicle_type: string; ownership: string; status: string; purchase_cost: number | null; odometer_km: number; assigned_department: string | null; }

export default function FleetDashboardEnterprisePage() {
  const router = useRouter();
  const [vehicles, setVehicles] = useState<Veh[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.from('vehicles').select('id, vehicle_code, plate_number, plate_emirate, make, model, year, vehicle_type, ownership, status, purchase_cost, odometer_km, assigned_department').eq('is_active', true).order('vehicle_code');
        setVehicles((data || []) as Veh[]);
      } finally { setLoading(false); }
    })();
  }, []);

  const { byStatus, byType, byOwnership, byEmirate } = useMemo(() => {
    const dist = (key: keyof Veh) => {
      const m = new Map<string, number>();
      vehicles.forEach(v => { const k = String(v[key] || '—'); m.set(k, (m.get(k) || 0) + 1); });
      return [...m.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
    };
    return { byStatus: dist('status'), byType: dist('vehicle_type'), byOwnership: dist('ownership'), byEmirate: dist('plate_emirate') };
  }, [vehicles]);

  const fleetValue = vehicles.reduce((a, v) => a + (v.purchase_cost || 0), 0);
  const avgOdo = vehicles.length ? Math.round(vehicles.reduce((a, v) => a + (v.odometer_km || 0), 0) / vehicles.length) : 0;
  const nowYear = new Date().getFullYear();
  const avgAge = vehicles.length ? (vehicles.reduce((a, v) => a + (nowYear - (v.year || nowYear)), 0) / vehicles.length).toFixed(1) : '0';
  const active = byStatus.find(s => s.name === 'ACTIVE')?.value || 0;

  const exportCols = ['Code', 'Plate', 'Make/Model', 'Year', 'Type', 'Ownership', 'Status', 'Odometer (km)', 'Purchase cost'];
  const exportRows = vehicles.map(v => [v.vehicle_code, `${v.plate_emirate} ${v.plate_number}`, `${v.make} ${v.model}`, v.year, v.vehicle_type, v.ownership, v.status, v.odometer_km, v.purchase_cost || 0]);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Fleet Dashboard"
        subtitle="Vehicles by status, type, ownership and emirate"
        breadcrumbs={[{ label: 'Fleet & Assets', href: '/fleet/hub' }, { label: 'Dashboard' }]}
        actions={vehicles.length > 0 ? (
          <div className="flex gap-2">
            <Button variant="secondary" icon={FileDown} onClick={() => exportTablePdf({ title: 'Fleet Register', columns: exportCols, rows: exportRows, fileName: 'fleet-register' })}>PDF</Button>
            <Button variant="secondary" icon={Sheet} onClick={() => exportTableExcel({ title: 'Fleet Register', columns: exportCols, rows: exportRows, fileName: 'fleet-register' })}>Excel</Button>
          </div>
        ) : undefined}
      />

      {loading ? (
        <Card><div className="p-8 text-center text-sm text-[var(--text-tertiary)]">Loading…</div></Card>
      ) : vehicles.length === 0 ? (
        <Card><EmptyState icon={Car} title="No vehicles" description="Add vehicles in the Fleet Registry to see fleet analytics here." /></Card>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Vehicles</div><div className="text-2xl font-bold mt-1">{vehicles.length}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Active</div><div className="text-2xl font-bold mt-1" style={{ color: 'var(--status-success-text)' }}>{active}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Fleet value</div><div className="text-xl font-bold mt-1">{fmtAED(fleetValue)}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Avg odometer</div><div className="text-2xl font-bold mt-1">{avgOdo.toLocaleString()}<span className="text-sm font-normal text-[var(--text-tertiary)]"> km</span></div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Avg age</div><div className="text-2xl font-bold mt-1">{avgAge}<span className="text-sm font-normal text-[var(--text-tertiary)]"> yrs</span></div></Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <Card className="p-4">
              <div className="text-sm font-semibold text-[var(--text-primary)] mb-3">By status</div>
              <div style={{ width: '100%', height: 240 }}>
                <ResponsiveContainer>
                  <BarChart data={byStatus}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} tickFormatter={(v: string) => v.replace(/_/g, ' ')} />
                    <YAxis tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>{byStatus.map((e, i) => <Cell key={i} fill={STATUS_COLOR[e.name] || 'var(--accent)'} />)}</Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card className="p-4">
              <div className="text-sm font-semibold text-[var(--text-primary)] mb-3">By vehicle type</div>
              <div style={{ width: '100%', height: 240 }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={byType} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={(e: any) => `${String(e.name).replace(/_/g, ' ')} (${e.value})`} labelLine={false} fontSize={11}>
                      {byType.map((e, i) => <Cell key={i} fill={PIE[i % PIE.length]} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card className="p-4">
              <div className="text-sm font-semibold text-[var(--text-primary)] mb-3">By ownership</div>
              <div style={{ width: '100%', height: 220 }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={byOwnership} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={80} fontSize={11}>
                      {byOwnership.map((e, i) => <Cell key={i} fill={PIE[i % PIE.length]} />)}
                    </Pie>
                    <Legend wrapperStyle={{ fontSize: 11 }} /><Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card className="p-4">
              <div className="text-sm font-semibold text-[var(--text-primary)] mb-3">By plate emirate</div>
              <div style={{ width: '100%', height: 220 }}>
                <ResponsiveContainer>
                  <BarChart data={byEmirate} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} allowDecimals={false} />
                    <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} tickFormatter={(v: string) => v.replace(/_/g, ' ')} />
                    <Tooltip />
                    <Bar dataKey="value" fill="var(--status-info-text)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          <Card className="p-0 overflow-x-auto">
            <div className="p-3 text-sm font-semibold text-[var(--text-primary)] border-b border-[var(--border)]">Vehicles ({vehicles.length})</div>
            <table className="w-full text-sm">
              <thead><tr className="border-b border-[var(--border)] text-left text-[var(--text-tertiary)] text-xs"><th className="p-3">Code</th><th className="p-3">Plate</th><th className="p-3">Make / Model</th><th className="p-3">Type</th><th className="p-3">Ownership</th><th className="p-3">Odometer</th><th className="p-3">Status</th></tr></thead>
              <tbody>
                {vehicles.map(v => (
                  <tr key={v.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-hover)] cursor-pointer" onClick={() => router.push(`/fleet/${v.id}`)}>
                    <td className="p-3 font-medium text-[var(--text-primary)]">{v.vehicle_code}</td>
                    <td className="p-3 text-xs text-[var(--text-secondary)]">{v.plate_emirate?.replace(/_/g, ' ')} {v.plate_number}</td>
                    <td className="p-3 text-[var(--text-secondary)]">{v.make} {v.model} <span className="text-[var(--text-tertiary)]">{v.year}</span></td>
                    <td className="p-3 text-xs text-[var(--text-secondary)]">{v.vehicle_type?.replace(/_/g, ' ')}</td>
                    <td className="p-3 text-xs text-[var(--text-secondary)]">{v.ownership}</td>
                    <td className="p-3 text-xs text-[var(--text-secondary)]">{(v.odometer_km || 0).toLocaleString()} km</td>
                    <td className="p-3"><span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--surface-active)', color: STATUS_COLOR[v.status] || 'var(--text-secondary)' }}>{v.status?.replace(/_/g, ' ')}</span></td>
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
