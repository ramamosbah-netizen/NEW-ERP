'use client';

// ============================================================
// JEET ERP — Fixed Asset Dashboard
// Portfolio view: NBV vs cost, category mix, depreciation %, status.
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
import { Calculator, FileDown, Sheet } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell, Legend } from 'recharts';

const fmtAED = (n: number) => 'AED ' + (n || 0).toLocaleString('en-AE', { maximumFractionDigits: 0 });
const PIE = ['var(--accent)', 'var(--status-info-text)', 'var(--status-success-text)', 'var(--status-warning-text)', 'var(--status-danger-text)', '#a855f7', '#64748b'];
const STATUS_COLOR: Record<string, string> = { ACTIVE: 'var(--status-success-text)', FULLY_DEPRECIATED: 'var(--status-info-text)', DISPOSED: 'var(--text-tertiary)', WRITTEN_OFF: 'var(--status-danger-text)' };

interface Asset { id: string; asset_number: string; name: string; category: string; acquisition_date: string; acquisition_cost: number; accumulated_depreciation: number; net_book_value: number; status: string; location: string | null; }

export default function AssetDashboardPage() {
  const router = useRouter();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.from('fixed_assets').select('id, asset_number, name, category, acquisition_date, acquisition_cost, accumulated_depreciation, net_book_value, status, location').eq('is_active', true).order('acquisition_cost', { ascending: false });
        setAssets((data || []) as Asset[]);
      } finally { setLoading(false); }
    })();
  }, []);

  const totalCost = assets.reduce((a, x) => a + (x.acquisition_cost || 0), 0);
  const totalNbv = assets.reduce((a, x) => a + (x.net_book_value || 0), 0);
  const totalAccum = assets.reduce((a, x) => a + (x.accumulated_depreciation || 0), 0);
  const deprPct = totalCost ? (totalAccum / totalCost) * 100 : 0;

  const byCategory = useMemo(() => {
    const m = new Map<string, { count: number; cost: number; nbv: number }>();
    assets.forEach(a => { const c = m.get(a.category) || { count: 0, cost: 0, nbv: 0 }; c.count++; c.cost += a.acquisition_cost || 0; c.nbv += a.net_book_value || 0; m.set(a.category, c); });
    return [...m.entries()].map(([name, v]) => ({ name: name.replace(/_/g, ' '), ...v })).sort((a, b) => b.cost - a.cost);
  }, [assets]);
  const byStatus = useMemo(() => { const m = new Map<string, number>(); assets.forEach(a => m.set(a.status, (m.get(a.status) || 0) + 1)); return [...m.entries()].map(([name, value]) => ({ name: name.replace(/_/g, ' '), value, raw: name })); }, [assets]);

  const exportCols = ['Asset #', 'Name', 'Category', 'Acquired', 'Cost', 'Accum. depr.', 'NBV', 'Status'];
  const exportRows = assets.map(a => [a.asset_number, a.name, a.category, a.acquisition_date, a.acquisition_cost, a.accumulated_depreciation, a.net_book_value, a.status]);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Fixed Asset Dashboard"
        subtitle="NBV vs cost, category mix, depreciation and status"
        breadcrumbs={[{ label: 'Fleet & Assets', href: '/fleet/hub' }, { label: 'Asset Dashboard' }]}
        actions={assets.length > 0 ? (
          <div className="flex gap-2">
            <Button variant="secondary" icon={FileDown} onClick={() => exportTablePdf({ title: 'Fixed Asset Register', columns: exportCols, rows: exportRows, fileName: 'fixed-assets' })}>PDF</Button>
            <Button variant="secondary" icon={Sheet} onClick={() => exportTableExcel({ title: 'Fixed Asset Register', columns: exportCols, rows: exportRows, fileName: 'fixed-assets' })}>Excel</Button>
          </div>
        ) : undefined}
      />

      {loading ? (
        <Card><div className="p-8 text-center text-sm text-[var(--text-tertiary)]">Loading…</div></Card>
      ) : assets.length === 0 ? (
        <Card><EmptyState icon={Calculator} title="No fixed assets" description="Register assets to see portfolio value, depreciation and category mix here." /></Card>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Assets</div><div className="text-2xl font-bold mt-1">{assets.length}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Acquisition cost</div><div className="text-xl font-bold mt-1">{fmtAED(totalCost)}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Net book value</div><div className="text-xl font-bold mt-1" style={{ color: 'var(--status-success-text)' }}>{fmtAED(totalNbv)}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Accum. depreciation</div><div className="text-xl font-bold mt-1" style={{ color: 'var(--status-warning-text)' }}>{fmtAED(totalAccum)}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Depreciated</div><div className="text-2xl font-bold mt-1">{deprPct.toFixed(0)}<span className="text-sm font-normal text-[var(--text-tertiary)]">%</span></div></Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <Card className="p-4">
              <div className="text-sm font-semibold text-[var(--text-primary)] mb-3">Cost vs NBV by category</div>
              <div style={{ width: '100%', height: 260 }}>
                <ResponsiveContainer>
                  <BarChart data={byCategory}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }} interval={0} angle={-15} textAnchor="end" height={50} />
                    <YAxis tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} />
                    <Tooltip formatter={(v: any) => fmtAED(Number(v))} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="cost" name="Cost" fill="#64748b" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="nbv" name="NBV" fill="var(--status-success-text)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card className="p-4">
              <div className="text-sm font-semibold text-[var(--text-primary)] mb-3">Assets by status</div>
              <div style={{ width: '100%', height: 260 }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={byStatus} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={85} fontSize={11}>{byStatus.map((e, i) => <Cell key={i} fill={STATUS_COLOR[e.raw] || PIE[i % PIE.length]} />)}</Pie>
                    <Legend wrapperStyle={{ fontSize: 11 }} /><Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          <Card className="p-0 overflow-x-auto">
            <div className="p-3 text-sm font-semibold text-[var(--text-primary)] border-b border-[var(--border)]">Assets ({assets.length})</div>
            <table className="w-full text-sm">
              <thead><tr className="border-b border-[var(--border)] text-left text-[var(--text-tertiary)] text-xs"><th className="p-3">Asset #</th><th className="p-3">Name</th><th className="p-3">Category</th><th className="p-3 text-right">Cost</th><th className="p-3 text-right">NBV</th><th className="p-3">Status</th></tr></thead>
              <tbody>
                {assets.map(a => (
                  <tr key={a.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-hover)] cursor-pointer" onClick={() => router.push(`/assets/${a.id}`)}>
                    <td className="p-3 font-medium text-[var(--text-primary)]">{a.asset_number}</td>
                    <td className="p-3 text-[var(--text-secondary)]">{a.name}</td>
                    <td className="p-3 text-xs text-[var(--text-secondary)]">{a.category?.replace(/_/g, ' ')}</td>
                    <td className="p-3 text-right text-xs text-[var(--text-secondary)]">{fmtAED(a.acquisition_cost)}</td>
                    <td className="p-3 text-right text-xs font-medium text-[var(--text-primary)]">{fmtAED(a.net_book_value)}</td>
                    <td className="p-3"><span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--surface-active)', color: STATUS_COLOR[a.status] || 'var(--text-secondary)' }}>{a.status?.replace(/_/g, ' ')}</span></td>
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
