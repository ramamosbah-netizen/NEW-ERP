'use client';

// ============================================================
// JEET ERP — Vehicle Compliance Tracker
// Registration & insurance expiry radar (expired / ≤30d / ≤60d / OK).
// Prevents driving on lapsed registration/insurance (UAE fine + impound).
// Read-only; PDF + Excel export.
// ============================================================

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { exportTablePdf, exportTableExcel } from '@/lib/finance-export';
import { ShieldAlert, FileDown, Sheet } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from 'recharts';

const daysUntil = (d?: string | null) => d ? Math.ceil((new Date(d).getTime() - Date.now()) / 86400000) : null;
type Bucket = 'EXPIRED' | 'DUE_30' | 'DUE_60' | 'OK';
const bucketOf = (days: number | null): Bucket => days === null ? 'OK' : days < 0 ? 'EXPIRED' : days <= 30 ? 'DUE_30' : days <= 60 ? 'DUE_60' : 'OK';
const BUCKET_META: Record<Bucket, { label: string; color: string; bg: string }> = {
  EXPIRED: { label: 'Expired', color: 'var(--status-danger-text)', bg: 'var(--status-danger-bg)' },
  DUE_30: { label: 'Due ≤30d', color: 'var(--status-warning-text)', bg: 'var(--status-warning-bg)' },
  DUE_60: { label: 'Due ≤60d', color: 'var(--status-info-text)', bg: 'var(--status-info-bg)' },
  OK: { label: 'OK', color: 'var(--status-success-text)', bg: 'var(--status-success-bg)' },
};

interface Veh { id: string; vehicle_code: string; plate_number: string; plate_emirate: string; status: string; registration_expiry: string | null; insurance_expiry: string | null; insurance_company: string | null; }
interface Item { vid: string; code: string; plate: string; kind: 'Registration' | 'Insurance'; expiry: string | null; days: number | null; bucket: Bucket; extra: string; }

export default function VehicleCompliancePage() {
  const router = useRouter();
  const [vehicles, setVehicles] = useState<Veh[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Bucket | 'ALL'>('ALL');

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.from('vehicles').select('id, vehicle_code, plate_number, plate_emirate, status, registration_expiry, insurance_expiry, insurance_company').eq('is_active', true).neq('status', 'DISPOSED').neq('status', 'SOLD');
        setVehicles((data || []) as Veh[]);
      } finally { setLoading(false); }
    })();
  }, []);

  const items = useMemo<Item[]>(() => {
    const out: Item[] = [];
    vehicles.forEach(v => {
      const rd = daysUntil(v.registration_expiry); const id = daysUntil(v.insurance_expiry);
      out.push({ vid: v.id, code: v.vehicle_code, plate: `${v.plate_emirate?.replace(/_/g, ' ')} ${v.plate_number}`, kind: 'Registration', expiry: v.registration_expiry, days: rd, bucket: bucketOf(rd), extra: '' });
      out.push({ vid: v.id, code: v.vehicle_code, plate: `${v.plate_emirate?.replace(/_/g, ' ')} ${v.plate_number}`, kind: 'Insurance', expiry: v.insurance_expiry, days: id, bucket: bucketOf(id), extra: v.insurance_company || '' });
    });
    const order: Record<Bucket, number> = { EXPIRED: 0, DUE_30: 1, DUE_60: 2, OK: 3 };
    return out.sort((a, b) => order[a.bucket] - order[b.bucket] || (a.days ?? 1e9) - (b.days ?? 1e9));
  }, [vehicles]);

  const counts = useMemo(() => {
    const c: Record<Bucket, number> = { EXPIRED: 0, DUE_30: 0, DUE_60: 0, OK: 0 };
    items.forEach(i => c[i.bucket]++);
    return c;
  }, [items]);

  const shown = filter === 'ALL' ? items.filter(i => i.bucket !== 'OK') : items.filter(i => i.bucket === filter);
  const chartData = (['EXPIRED', 'DUE_30', 'DUE_60', 'OK'] as Bucket[]).map(b => ({ name: BUCKET_META[b].label, value: counts[b], b }));

  const exportCols = ['Vehicle', 'Plate', 'Item', 'Expiry', 'Days left', 'Status', 'Insurer'];
  const exportRows = items.map(i => [i.code, i.plate, i.kind, i.expiry || '—', i.days ?? '—', BUCKET_META[i.bucket].label, i.extra]);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Vehicle Compliance Tracker"
        subtitle="Registration & insurance expiry — expired, due-soon and OK"
        breadcrumbs={[{ label: 'Fleet & Assets', href: '/fleet/hub' }, { label: 'Compliance' }]}
        actions={vehicles.length > 0 ? (
          <div className="flex gap-2">
            <Button variant="secondary" icon={FileDown} onClick={() => exportTablePdf({ title: 'Vehicle Compliance', columns: exportCols, rows: exportRows, fileName: 'vehicle-compliance' })}>PDF</Button>
            <Button variant="secondary" icon={Sheet} onClick={() => exportTableExcel({ title: 'Vehicle Compliance', columns: exportCols, rows: exportRows, fileName: 'vehicle-compliance' })}>Excel</Button>
          </div>
        ) : undefined}
      />

      {loading ? (
        <Card><div className="p-8 text-center text-sm text-[var(--text-tertiary)]">Loading…</div></Card>
      ) : vehicles.length === 0 ? (
        <Card><EmptyState icon={ShieldAlert} title="No vehicles" description="Registration and insurance expiry will be tracked here once vehicles are added." /></Card>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {(['EXPIRED', 'DUE_30', 'DUE_60', 'OK'] as Bucket[]).map(b => (
              <button key={b} onClick={() => setFilter(filter === b ? 'ALL' : b)} className="text-left">
                <Card className="p-4" style={{ outline: filter === b ? `2px solid ${BUCKET_META[b].color}` : 'none' }}>
                  <div className="text-xs text-[var(--text-secondary)]">{BUCKET_META[b].label}</div>
                  <div className="text-2xl font-bold mt-1" style={{ color: BUCKET_META[b].color }}>{counts[b]}</div>
                </Card>
              </button>
            ))}
          </div>

          <Card className="p-4">
            <div className="text-sm font-semibold text-[var(--text-primary)] mb-3">Compliance items by urgency</div>
            <div style={{ width: '100%', height: 220 }}>
              <ResponsiveContainer>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>{chartData.map((e, i) => <Cell key={i} fill={BUCKET_META[e.b].color} />)}</Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="p-0 overflow-x-auto">
            <div className="p-3 text-sm font-semibold text-[var(--text-primary)] border-b border-[var(--border)] flex items-center justify-between">
              <span>{filter === 'ALL' ? 'Action required (excludes OK)' : BUCKET_META[filter].label} ({shown.length})</span>
              {filter !== 'ALL' && <button onClick={() => setFilter('ALL')} className="text-xs text-[var(--accent)]">Clear filter</button>}
            </div>
            {shown.length === 0 ? <div className="p-5 text-center text-sm text-[var(--text-tertiary)]">Nothing here — all clear.</div> : (
              <table className="w-full text-sm">
                <thead><tr className="border-b border-[var(--border)] text-left text-[var(--text-tertiary)] text-xs"><th className="p-3">Vehicle</th><th className="p-3">Plate</th><th className="p-3">Item</th><th className="p-3">Expiry</th><th className="p-3">Days left</th><th className="p-3">Status</th></tr></thead>
                <tbody>
                  {shown.map((i, idx) => (
                    <tr key={idx} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-hover)] cursor-pointer" onClick={() => router.push(`/fleet/${i.vid}`)}>
                      <td className="p-3 font-medium text-[var(--text-primary)]">{i.code}</td>
                      <td className="p-3 text-xs text-[var(--text-secondary)]">{i.plate}</td>
                      <td className="p-3 text-[var(--text-secondary)]">{i.kind}{i.extra ? <span className="text-[var(--text-tertiary)]"> · {i.extra}</span> : ''}</td>
                      <td className="p-3 text-xs text-[var(--text-secondary)]">{i.expiry || '—'}</td>
                      <td className="p-3 text-xs font-medium" style={{ color: BUCKET_META[i.bucket].color }}>{i.days === null ? '—' : i.days < 0 ? `${Math.abs(i.days)}d overdue` : `${i.days}d`}</td>
                      <td className="p-3"><span className="text-xs px-2 py-0.5 rounded-full" style={{ background: BUCKET_META[i.bucket].bg, color: BUCKET_META[i.bucket].color }}>{BUCKET_META[i.bucket].label}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
