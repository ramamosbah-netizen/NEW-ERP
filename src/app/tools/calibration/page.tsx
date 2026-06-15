'use client';

// ============================================================
// JEET ERP — Calibration Tracker
// Test instruments requiring calibration, bucketed by next-due
// (overdue / ≤30d / ≤60d / OK) — a compliance radar for measuring
// equipment. Read-only; PDF + Excel export.
// ============================================================

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { exportTablePdf, exportTableExcel } from '@/lib/finance-export';
import { Award, FileDown, Sheet } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from 'recharts';

const daysUntil = (d?: string | null) => d ? Math.ceil((new Date(d).getTime() - Date.now()) / 86400000) : null;
type Bucket = 'OVERDUE' | 'DUE_30' | 'DUE_60' | 'OK' | 'UNSCHEDULED';
const bucketOf = (days: number | null): Bucket => days === null ? 'UNSCHEDULED' : days < 0 ? 'OVERDUE' : days <= 30 ? 'DUE_30' : days <= 60 ? 'DUE_60' : 'OK';
const META: Record<Bucket, { label: string; color: string; bg: string }> = {
  OVERDUE: { label: 'Overdue', color: 'var(--status-danger-text)', bg: 'var(--status-danger-bg)' },
  DUE_30: { label: 'Due ≤30d', color: 'var(--status-warning-text)', bg: 'var(--status-warning-bg)' },
  DUE_60: { label: 'Due ≤60d', color: 'var(--status-info-text)', bg: 'var(--status-info-bg)' },
  OK: { label: 'OK', color: 'var(--status-success-text)', bg: 'var(--status-success-bg)' },
  UNSCHEDULED: { label: 'Unscheduled', color: 'var(--text-tertiary)', bg: 'var(--surface-active)' },
};

interface Tool { id: string; tool_number: string; name: string; category: string; brand_model: string | null; serial_no: string | null; status: string; last_calibration_date: string | null; next_calibration_due: string | null; calibration_interval_months: number | null; current_custodian_id: string | null; }
interface Item extends Tool { days: number | null; bucket: Bucket; custodian: string; }

export default function CalibrationTrackerPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Bucket | 'ALL'>('ALL');

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.from('tools').select('id, tool_number, name, category, brand_model, serial_no, status, last_calibration_date, next_calibration_due, calibration_interval_months, current_custodian_id').eq('is_active', true).eq('requires_calibration', true).neq('status', 'RETIRED');
        const r = (data || []) as Tool[];
        const cids = [...new Set(r.map(x => x.current_custodian_id).filter(Boolean))] as string[];
        const cm = new Map<string, string>();
        if (cids.length) { const { data: e } = await supabase.from('employees').select('id, full_name_en').in('id', cids); (e || []).forEach((x: any) => cm.set(x.id, x.full_name_en)); }
        const order: Record<Bucket, number> = { OVERDUE: 0, DUE_30: 1, DUE_60: 2, UNSCHEDULED: 3, OK: 4 };
        const out = r.map(t => { const days = daysUntil(t.next_calibration_due); return { ...t, days, bucket: bucketOf(days), custodian: t.current_custodian_id ? cm.get(t.current_custodian_id) || '—' : '—' }; })
          .sort((a, b) => order[a.bucket] - order[b.bucket] || (a.days ?? 1e9) - (b.days ?? 1e9));
        setItems(out);
      } finally { setLoading(false); }
    })();
  }, []);

  const counts = useMemo(() => { const c: Record<Bucket, number> = { OVERDUE: 0, DUE_30: 0, DUE_60: 0, OK: 0, UNSCHEDULED: 0 }; items.forEach(i => c[i.bucket]++); return c; }, [items]);
  const shown = filter === 'ALL' ? items.filter(i => i.bucket !== 'OK') : items.filter(i => i.bucket === filter);
  const chartData = (['OVERDUE', 'DUE_30', 'DUE_60', 'OK', 'UNSCHEDULED'] as Bucket[]).map(b => ({ name: META[b].label, value: counts[b], b }));

  const exportCols = ['Tool #', 'Name', 'Serial', 'Last calibration', 'Next due', 'Days', 'Status', 'Custodian'];
  const exportRows = items.map(i => [i.tool_number, i.name, i.serial_no || '', i.last_calibration_date || '', i.next_calibration_due || '', i.days ?? '—', META[i.bucket].label, i.custodian]);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Calibration Tracker"
        subtitle="Test instruments due / overdue for calibration"
        breadcrumbs={[{ label: 'Fleet & Assets', href: '/fleet/hub' }, { label: 'Tools', href: '/tools' }, { label: 'Calibration' }]}
        actions={items.length > 0 ? (
          <div className="flex gap-2">
            <Button variant="secondary" icon={FileDown} onClick={() => exportTablePdf({ title: 'Calibration Tracker', columns: exportCols, rows: exportRows, fileName: 'calibration-tracker' })}>PDF</Button>
            <Button variant="secondary" icon={Sheet} onClick={() => exportTableExcel({ title: 'Calibration Tracker', columns: exportCols, rows: exportRows, fileName: 'calibration-tracker' })}>Excel</Button>
          </div>
        ) : undefined}
      />

      {loading ? (
        <Card><div className="p-8 text-center text-sm text-[var(--text-tertiary)]">Loading…</div></Card>
      ) : items.length === 0 ? (
        <Card><EmptyState icon={Award} title="No calibrated instruments" description="Tools flagged as requiring calibration will be tracked here with due-date alerts." /></Card>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {(['OVERDUE', 'DUE_30', 'DUE_60', 'OK', 'UNSCHEDULED'] as Bucket[]).map(b => (
              <button key={b} onClick={() => setFilter(filter === b ? 'ALL' : b)} className="text-left">
                <Card className="p-4" style={{ outline: filter === b ? `2px solid ${META[b].color}` : 'none' }}>
                  <div className="text-xs text-[var(--text-secondary)]">{META[b].label}</div>
                  <div className="text-2xl font-bold mt-1" style={{ color: META[b].color }}>{counts[b]}</div>
                </Card>
              </button>
            ))}
          </div>

          <Card className="p-4">
            <div className="text-sm font-semibold text-[var(--text-primary)] mb-3">Instruments by calibration urgency</div>
            <div style={{ width: '100%', height: 220 }}>
              <ResponsiveContainer>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>{chartData.map((e, i) => <Cell key={i} fill={META[e.b].color} />)}</Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="p-0 overflow-x-auto">
            <div className="p-3 text-sm font-semibold text-[var(--text-primary)] border-b border-[var(--border)] flex items-center justify-between">
              <span>{filter === 'ALL' ? 'Action required (excludes OK)' : META[filter].label} ({shown.length})</span>
              {filter !== 'ALL' && <button onClick={() => setFilter('ALL')} className="text-xs text-[var(--accent)]">Clear filter</button>}
            </div>
            {shown.length === 0 ? <div className="p-5 text-center text-sm text-[var(--text-tertiary)]">Nothing here — all calibrations current.</div> : (
              <table className="w-full text-sm">
                <thead><tr className="border-b border-[var(--border)] text-left text-[var(--text-tertiary)] text-xs"><th className="p-3">Tool #</th><th className="p-3">Name</th><th className="p-3">Last calibration</th><th className="p-3">Next due</th><th className="p-3">Days</th><th className="p-3">Custodian</th><th className="p-3">Status</th></tr></thead>
                <tbody>
                  {shown.map(i => (
                    <tr key={i.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-hover)]">
                      <td className="p-3 font-medium text-[var(--text-primary)]">{i.tool_number}</td>
                      <td className="p-3 text-[var(--text-secondary)]">{i.name}{i.brand_model ? <span className="text-[11px] text-[var(--text-tertiary)]"> · {i.brand_model}</span> : ''}</td>
                      <td className="p-3 text-xs text-[var(--text-secondary)]">{i.last_calibration_date || '—'}</td>
                      <td className="p-3 text-xs text-[var(--text-secondary)]">{i.next_calibration_due || '—'}</td>
                      <td className="p-3 text-xs font-medium" style={{ color: META[i.bucket].color }}>{i.days === null ? '—' : i.days < 0 ? `${Math.abs(i.days)}d overdue` : `${i.days}d`}</td>
                      <td className="p-3 text-xs text-[var(--text-secondary)]">{i.custodian}</td>
                      <td className="p-3"><span className="text-xs px-2 py-0.5 rounded-full" style={{ background: META[i.bucket].bg, color: META[i.bucket].color }}>{META[i.bucket].label}</span></td>
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
