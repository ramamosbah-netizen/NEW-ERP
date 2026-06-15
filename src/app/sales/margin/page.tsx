'use client';

// ============================================================
// JEET ERP — Pre-Sales: Estimation & Margin Analysis
// BOQ cost vs estimated profit (from boqs.financials), margin
// distribution and cost-component breakdown. Read-only (no migration).
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
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell } from 'recharts';

const aed = (n: number) => `AED ${Number(n || 0).toLocaleString('en-AE', { maximumFractionDigits: 0 })}`;
const N = (v: any) => Number(v || 0);
const PIE = ['var(--accent)', 'var(--status-info-text)', 'var(--status-warning-text)', 'var(--status-success-text)', 'var(--status-danger-text)', '#8b5cf6'];

interface Row { id: string; tender_id: string; label: string; cost: number; profit: number; sell: number; marginPct: number; quoteValue: number; }

export default function MarginAnalysisPage() {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([]);
  const [components, setComponents] = useState<{ name: string; value: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data: boqs } = await supabase.from('boqs').select('id, tender_id, financials');
        const list = (boqs || []) as any[];
        const tids = [...new Set(list.map(b => b.tender_id).filter(Boolean))];
        const [tRes, qRes] = await Promise.all([
          tids.length ? supabase.from('tenders').select('id, title, project_name, client_name').in('id', tids) : Promise.resolve({ data: [] as any[] }),
          supabase.from('quotations').select('boq_id, grand_total_with_vat'),
        ]);
        const tMap = new Map((tRes.data || []).map((t: any) => [t.id, t.title || t.project_name || t.client_name || 'Tender']));
        const qMap = new Map<string, number>();
        (qRes.data || []).forEach((q: any) => { if (q.boq_id) qMap.set(q.boq_id, (qMap.get(q.boq_id) || 0) + N(q.grand_total_with_vat)); });

        const comp = { Supply: 0, Labour: 0, Equipment: 0, Subcontract: 0, Logistics: 0, Overhead: 0 };
        const out: Row[] = list.map(b => {
          const f = b.financials || {};
          const cost = N(f.direct_total) + N(f.indirect_total);
          const profit = N(f.profit_value);
          const sell = cost + profit;
          comp.Supply += N(f.supply_total); comp.Labour += N(f.labor_total); comp.Equipment += N(f.equipment_cost);
          comp.Subcontract += N(f.subcontract_cost); comp.Logistics += N(f.logistics_cost); comp.Overhead += N(f.overhead_value) + N(f.indirect_total);
          return { id: b.id, tender_id: b.tender_id, label: tMap.get(b.tender_id) || 'BOQ', cost, profit, sell, marginPct: sell > 0 ? Math.round(profit / sell * 100) : N(f.profit_pct), quoteValue: qMap.get(b.id) || 0 };
        }).filter(r => r.cost > 0 || r.sell > 0);
        setRows(out.sort((a, b) => b.sell - a.sell));
        setComponents(Object.entries(comp).map(([name, value]) => ({ name, value: Math.round(value) })).filter(d => d.value > 0));
      } finally { setLoading(false); }
    })();
  }, []);

  const totalCost = rows.reduce((s, r) => s + r.cost, 0);
  const totalProfit = rows.reduce((s, r) => s + r.profit, 0);
  const totalSell = rows.reduce((s, r) => s + r.sell, 0);
  const avgMargin = totalSell ? Math.round(totalProfit / totalSell * 100) : 0;
  const lowMargin = rows.filter(r => r.marginPct < 10).length;

  const marginDist = useMemo(() => {
    const buckets = [{ name: '<10%', count: 0 }, { name: '10–15%', count: 0 }, { name: '15–20%', count: 0 }, { name: '20%+', count: 0 }];
    rows.forEach(r => { const m = r.marginPct; const i = m < 10 ? 0 : m < 15 ? 1 : m < 20 ? 2 : 3; buckets[i].count++; });
    return buckets;
  }, [rows]);

  const exportCols = ['Opportunity', 'Est. cost', 'Est. profit', 'Sell', 'Margin %', 'Quotation value'];
  const exportRows = rows.map(r => [r.label, Math.round(r.cost), Math.round(r.profit), Math.round(r.sell), `${r.marginPct}%`, Math.round(r.quoteValue)]);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Estimation & Margin Analysis"
        subtitle="BOQ estimated cost, profit and margin across opportunities"
        breadcrumbs={[{ label: 'Pre-Sales', href: '/sales/dashboard' }, { label: 'Margin' }]}
        actions={rows.length > 0 ? (
          <div className="flex gap-2">
            <Button variant="secondary" icon={FileDown} onClick={() => exportTablePdf({ title: 'Estimation & Margin', columns: exportCols, rows: exportRows, fileName: 'margin-analysis' })}>PDF</Button>
            <Button variant="secondary" icon={Sheet} onClick={() => exportTableExcel({ title: 'Estimation & Margin', columns: exportCols, rows: exportRows, fileName: 'margin-analysis' })}>Excel</Button>
          </div>
        ) : undefined}
      />

      {loading ? (
        <Card><div className="p-8 text-center text-sm text-[var(--text-tertiary)]">Loading…</div></Card>
      ) : rows.length === 0 ? (
        <Card><EmptyState icon={Calculator} title="No priced BOQs" description="BOQs with a costed financials breakdown appear here." /></Card>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Priced BOQs</div><div className="text-2xl font-bold mt-1">{rows.length}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Est. cost</div><div className="text-lg font-bold mt-1">{aed(totalCost)}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Est. profit</div><div className="text-lg font-bold mt-1" style={{ color: 'var(--status-success-text)' }}>{aed(totalProfit)}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Avg margin</div><div className="text-2xl font-bold mt-1" style={{ color: avgMargin >= 15 ? 'var(--status-success-text)' : avgMargin >= 10 ? 'var(--status-warning-text)' : 'var(--status-danger-text)' }}>{avgMargin}%</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Margin &lt;10%</div><div className="text-2xl font-bold mt-1" style={{ color: lowMargin ? 'var(--status-danger-text)' : 'var(--text-primary)' }}>{lowMargin}</div></Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <Card className="p-4">
              <div className="text-sm font-semibold text-[var(--text-primary)] mb-3">Margin distribution</div>
              <div style={{ width: '100%', height: 240 }}>
                <ResponsiveContainer>
                  <BarChart data={marginDist}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} />
                    <YAxis tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>{marginDist.map((_, i) => <Cell key={i} fill={i === 0 ? 'var(--status-danger-text)' : i === 1 ? 'var(--status-warning-text)' : 'var(--status-success-text)'} />)}</Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card className="p-4">
              <div className="text-sm font-semibold text-[var(--text-primary)] mb-3">Cost components</div>
              <div style={{ width: '100%', height: 240 }}>
                <ResponsiveContainer>
                  {components.length ? (
                    <PieChart><Pie data={components} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={85} label={(e: any) => e.name}>{components.map((_, i) => <Cell key={i} fill={PIE[i % PIE.length]} />)}</Pie><Tooltip formatter={(v: any) => aed(v)} /></PieChart>
                  ) : <div className="flex items-center justify-center h-full text-sm text-[var(--text-tertiary)]">No component breakdown</div>}
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          <Card className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-[var(--border)] text-left text-[var(--text-tertiary)] text-xs">
                <th className="p-3">Opportunity</th><th className="p-3 text-right">Est. cost</th><th className="p-3 text-right">Est. profit</th><th className="p-3 text-right">Sell</th><th className="p-3 text-right">Margin %</th><th className="p-3 text-right">Quotation</th>
              </tr></thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-hover)] cursor-pointer" onClick={() => r.tender_id && router.push(`/tenders/${r.tender_id}/boq`)}>
                    <td className="p-3 font-medium text-[var(--text-primary)] line-clamp-1">{r.label}</td>
                    <td className="p-3 text-right tabular-nums text-[var(--text-secondary)]">{aed(r.cost)}</td>
                    <td className="p-3 text-right tabular-nums">{aed(r.profit)}</td>
                    <td className="p-3 text-right tabular-nums">{aed(r.sell)}</td>
                    <td className="p-3 text-right tabular-nums font-medium" style={{ color: r.marginPct >= 15 ? 'var(--status-success-text)' : r.marginPct >= 10 ? 'var(--status-warning-text)' : 'var(--status-danger-text)' }}>{r.marginPct}%</td>
                    <td className="p-3 text-right tabular-nums text-[var(--text-secondary)]">{r.quoteValue ? aed(r.quoteValue) : '—'}</td>
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
