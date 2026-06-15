'use client';

// ============================================================
// JEET ERP — Depreciation Forecast
// Projects straight-line depreciation forward 24 months from each
// active asset's current NBV, charting the monthly charge and the
// NBV run-off. Read-only; PDF + Excel export.
// ============================================================

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { exportTablePdf, exportTableExcel } from '@/lib/finance-export';
import { TrendingDown, FileDown, Sheet } from 'lucide-react';
import { ResponsiveContainer, ComposedChart, Area, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';

const fmtAED = (n: number) => 'AED ' + Math.round(n || 0).toLocaleString('en-AE');
const HORIZON = 24;

interface Asset { id: string; asset_number: string; name: string; acquisition_cost: number; salvage_value: number; useful_life_months: number; net_book_value: number; status: string; }

export default function DepreciationForecastPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.from('fixed_assets').select('id, asset_number, name, acquisition_cost, salvage_value, useful_life_months, net_book_value, status').eq('is_active', true).eq('status', 'ACTIVE');
        setAssets((data || []) as Asset[]);
      } finally { setLoading(false); }
    })();
  }, []);

  // per-asset straight-line monthly charge and months remaining
  const enriched = useMemo(() => assets.map(a => {
    const monthly = a.useful_life_months > 0 ? Math.max(0, (a.acquisition_cost - a.salvage_value) / a.useful_life_months) : 0;
    const depreciable = Math.max(0, (a.net_book_value || 0) - (a.salvage_value || 0));
    const monthsLeft = monthly > 0 ? Math.ceil(depreciable / monthly) : 0;
    return { ...a, monthly, depreciable, monthsLeft };
  }), [assets]);

  const forecast = useMemo(() => {
    const base = new Date(); base.setDate(1);
    const states = enriched.map(a => ({ nbv: a.net_book_value || 0, salvage: a.salvage_value || 0, monthly: a.monthly }));
    const out: { month: string; depreciation: number; nbv: number }[] = [];
    for (let i = 1; i <= HORIZON; i++) {
      const d = new Date(base.getFullYear(), base.getMonth() + i, 1);
      let dep = 0;
      states.forEach(s => { const room = Math.max(0, s.nbv - s.salvage); const charge = Math.min(s.monthly, room); s.nbv -= charge; dep += charge; });
      const nbv = states.reduce((a, s) => a + s.nbv, 0);
      out.push({ month: d.toLocaleDateString('en-AE', { month: 'short', year: '2-digit' }), depreciation: Math.round(dep), nbv: Math.round(nbv) });
    }
    return out;
  }, [enriched]);

  const monthlyRunRate = enriched.reduce((a, x) => a + (x.depreciable > 0 ? x.monthly : 0), 0);
  const next12 = forecast.slice(0, 12).reduce((a, x) => a + x.depreciation, 0);
  const fullyIn12 = enriched.filter(x => x.monthsLeft > 0 && x.monthsLeft <= 12).length;
  const nbv12 = forecast[11]?.nbv ?? enriched.reduce((a, x) => a + (x.net_book_value || 0), 0);

  const exportCols = ['Asset #', 'Name', 'NBV now', 'Monthly charge', 'Salvage', 'Months left'];
  const exportRows = enriched.sort((a, b) => b.monthly - a.monthly).map(a => [a.asset_number, a.name, Math.round(a.net_book_value), Math.round(a.monthly), Math.round(a.salvage_value), a.monthsLeft]);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Depreciation Forecast"
        subtitle="Projected monthly charge and NBV run-off over the next 24 months"
        breadcrumbs={[{ label: 'Fleet & Assets', href: '/fleet/hub' }, { label: 'Depreciation Forecast' }]}
        actions={assets.length > 0 ? (
          <div className="flex gap-2">
            <Button variant="secondary" icon={FileDown} onClick={() => exportTablePdf({ title: 'Depreciation Forecast', columns: exportCols, rows: exportRows, fileName: 'depreciation-forecast' })}>PDF</Button>
            <Button variant="secondary" icon={Sheet} onClick={() => exportTableExcel({ title: 'Depreciation Forecast', columns: exportCols, rows: exportRows, fileName: 'depreciation-forecast' })}>Excel</Button>
          </div>
        ) : undefined}
      />

      {loading ? (
        <Card><div className="p-8 text-center text-sm text-[var(--text-tertiary)]">Loading…</div></Card>
      ) : assets.length === 0 ? (
        <Card><EmptyState icon={TrendingDown} title="No active assets" description="The depreciation forecast projects the monthly charge for active, depreciating assets." /></Card>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Monthly run-rate</div><div className="text-xl font-bold mt-1">{fmtAED(monthlyRunRate)}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Next 12 months</div><div className="text-xl font-bold mt-1" style={{ color: 'var(--status-warning-text)' }}>{fmtAED(next12)}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Projected NBV (12m)</div><div className="text-xl font-bold mt-1" style={{ color: 'var(--status-success-text)' }}>{fmtAED(nbv12)}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Fully depr. ≤12m</div><div className="text-2xl font-bold mt-1">{fullyIn12}</div></Card>
          </div>

          <Card className="p-4">
            <div className="text-sm font-semibold text-[var(--text-primary)] mb-3">Projected NBV & monthly depreciation</div>
            <div style={{ width: '100%', height: 300 }}>
              <ResponsiveContainer>
                <ComposedChart data={forecast}>
                  <defs><linearGradient id="nbvFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--status-success-text)" stopOpacity={0.3} /><stop offset="100%" stopColor="var(--status-success-text)" stopOpacity={0} /></linearGradient></defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }} interval={1} />
                  <YAxis yAxisId="l" tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} />
                  <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} />
                  <Tooltip formatter={(v: any) => fmtAED(Number(v))} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Area yAxisId="l" dataKey="nbv" name="Projected NBV" stroke="var(--status-success-text)" fill="url(#nbvFill)" strokeWidth={2} />
                  <Bar yAxisId="r" dataKey="depreciation" name="Monthly charge" fill="var(--accent)" radius={[3, 3, 0, 0]} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="p-0 overflow-x-auto">
            <div className="p-3 text-sm font-semibold text-[var(--text-primary)] border-b border-[var(--border)]">Per-asset schedule ({enriched.length})</div>
            <table className="w-full text-sm">
              <thead><tr className="border-b border-[var(--border)] text-left text-[var(--text-tertiary)] text-xs"><th className="p-3">Asset #</th><th className="p-3">Name</th><th className="p-3 text-right">NBV now</th><th className="p-3 text-right">Monthly charge</th><th className="p-3 text-right">Months left</th></tr></thead>
              <tbody>
                {exportRows.map((r, i) => (
                  <tr key={i} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-hover)]">
                    <td className="p-3 font-medium text-[var(--text-primary)]">{r[0]}</td>
                    <td className="p-3 text-[var(--text-secondary)]">{r[1]}</td>
                    <td className="p-3 text-right text-xs text-[var(--text-secondary)]">{fmtAED(Number(r[2]))}</td>
                    <td className="p-3 text-right text-xs text-[var(--text-secondary)]">{fmtAED(Number(r[3]))}</td>
                    <td className="p-3 text-right text-xs font-medium" style={{ color: Number(r[5]) > 0 && Number(r[5]) <= 12 ? 'var(--status-warning-text)' : 'var(--text-secondary)' }}>{r[5]}</td>
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
