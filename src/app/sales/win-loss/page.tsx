'use client';

// ============================================================
// JEET ERP — Pre-Sales: Win / Loss Analysis
// Won vs lost quotations by value, rejection reasons and client.
// Read-only; plain query (no migration).
// ============================================================

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { exportTablePdf, exportTableExcel } from '@/lib/finance-export';
import { Scale, FileDown, Sheet } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';

const aed = (n: number) => `AED ${Number(n || 0).toLocaleString('en-AE', { maximumFractionDigits: 0 })}`;

interface Qt { quotation_number: string; status: string; grand_total_with_vat: number; client_name: string; rejection_reason: string | null; client_response: string | null; linked_project_id: string | null; actual_project_id: string | null; quotation_date: string | null; created_at: string; }
const isWon = (q: Qt) => q.status === 'ACCEPTED' || q.client_response === 'ACCEPTED' || !!q.linked_project_id || !!q.actual_project_id;
const isLost = (q: Qt) => q.status === 'REJECTED' || (!!q.rejection_reason && !isWon(q));

export default function WinLossPage() {
  const [quotes, setQuotes] = useState<Qt[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from('quotations').select('quotation_number, status, grand_total_with_vat, client_name, rejection_reason, client_response, linked_project_id, actual_project_id, quotation_date, created_at')
      .then(({ data }) => setQuotes((data || []) as Qt[])).then(() => setLoading(false), () => setLoading(false));
  }, []);

  const val = (q: Qt[]) => q.reduce((s, x) => s + Number(x.grand_total_with_vat || 0), 0);
  const won = quotes.filter(isWon), lost = quotes.filter(isLost);
  const decided = won.length + lost.length;
  const winRateCount = decided ? Math.round(won.length / decided * 100) : 0;
  const winRateValue = (val(won) + val(lost)) ? Math.round(val(won) / (val(won) + val(lost)) * 100) : 0;

  const reasons = useMemo(() => {
    const m = new Map<string, { count: number; value: number }>();
    lost.forEach(q => { const r = (q.rejection_reason || 'Unspecified').trim() || 'Unspecified'; const e = m.get(r) || { count: 0, value: 0 }; e.count++; e.value += Number(q.grand_total_with_vat || 0); m.set(r, e); });
    return [...m.entries()].map(([name, v]) => ({ name: name.slice(0, 28), count: v.count, value: Math.round(v.value) })).sort((a, b) => b.count - a.count).slice(0, 8);
  }, [lost]);

  const byClient = useMemo(() => {
    const m = new Map<string, { won: number; lost: number }>();
    quotes.forEach(q => { const k = q.client_name || '—'; const e = m.get(k) || { won: 0, lost: 0 }; if (isWon(q)) e.won += Number(q.grand_total_with_vat || 0); else if (isLost(q)) e.lost += Number(q.grand_total_with_vat || 0); m.set(k, e); });
    return [...m.entries()].map(([name, v]) => ({ name: name.slice(0, 18), Won: Math.round(v.won), Lost: Math.round(v.lost) })).filter(d => d.Won || d.Lost).sort((a, b) => (b.Won + b.Lost) - (a.Won + a.Lost)).slice(0, 8);
  }, [quotes]);

  const exportCols = ['Quotation', 'Client', 'Outcome', 'Value', 'Reason'];
  const exportRows = [...won.map(q => [q.quotation_number, q.client_name, 'Won', q.grand_total_with_vat, '']), ...lost.map(q => [q.quotation_number, q.client_name, 'Lost', q.grand_total_with_vat, q.rejection_reason || ''])];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Win / Loss Analysis"
        subtitle="Won vs lost quotations, value at stake and reasons for loss"
        breadcrumbs={[{ label: 'Pre-Sales', href: '/sales/dashboard' }, { label: 'Win / Loss' }]}
        actions={quotes.length > 0 ? (
          <div className="flex gap-2">
            <Button variant="secondary" icon={FileDown} onClick={() => exportTablePdf({ title: 'Win / Loss Analysis', columns: exportCols, rows: exportRows, fileName: 'win-loss' })}>PDF</Button>
            <Button variant="secondary" icon={Sheet} onClick={() => exportTableExcel({ title: 'Win / Loss Analysis', columns: exportCols, rows: exportRows, fileName: 'win-loss' })}>Excel</Button>
          </div>
        ) : undefined}
      />

      {loading ? (
        <Card><div className="p-8 text-center text-sm text-[var(--text-tertiary)]">Loading…</div></Card>
      ) : decided === 0 ? (
        <Card><EmptyState icon={Scale} title="No decided quotations" description="Won and lost quotations are analysed here once clients respond." /></Card>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Won</div><div className="text-2xl font-bold mt-1" style={{ color: 'var(--status-success-text)' }}>{won.length}</div><div className="text-[11px] text-[var(--text-tertiary)]">{aed(val(won))}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Lost</div><div className="text-2xl font-bold mt-1" style={{ color: 'var(--status-danger-text)' }}>{lost.length}</div><div className="text-[11px] text-[var(--text-tertiary)]">{aed(val(lost))}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Win rate (count)</div><div className="text-2xl font-bold mt-1" style={{ color: winRateCount >= 50 ? 'var(--status-success-text)' : 'var(--status-warning-text)' }}>{winRateCount}%</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Win rate (value)</div><div className="text-2xl font-bold mt-1" style={{ color: winRateValue >= 50 ? 'var(--status-success-text)' : 'var(--status-warning-text)' }}>{winRateValue}%</div></Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <Card className="p-4">
              <div className="text-sm font-semibold text-[var(--text-primary)] mb-3">Reasons for loss</div>
              <div style={{ width: '100%', height: 260 }}>
                <ResponsiveContainer>
                  {reasons.length ? (
                    <BarChart data={reasons} layout="vertical" margin={{ left: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} allowDecimals={false} />
                      <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }} />
                      <Tooltip />
                      <Bar dataKey="count" fill="var(--status-danger-text)" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  ) : <div className="flex items-center justify-center h-full text-sm text-[var(--text-tertiary)]">No loss reasons recorded</div>}
                </ResponsiveContainer>
              </div>
            </Card>
            <Card className="p-4">
              <div className="text-sm font-semibold text-[var(--text-primary)] mb-3">Won vs lost value by client</div>
              <div style={{ width: '100%', height: 260 }}>
                <ResponsiveContainer>
                  <BarChart data={byClient}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="name" tick={{ fontSize: 9, fill: 'var(--text-tertiary)' }} />
                    <YAxis tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v: any) => aed(v)} />
                    <Legend />
                    <Bar dataKey="Won" fill="var(--status-success-text)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Lost" fill="var(--status-danger-text)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          {lost.length > 0 && (
            <Card className="p-0 overflow-x-auto">
              <div className="p-3 text-sm font-semibold text-[var(--text-primary)] border-b border-[var(--border)]">Lost quotations</div>
              <table className="w-full text-sm">
                <thead><tr className="border-b border-[var(--border)] text-left text-[var(--text-tertiary)] text-xs"><th className="p-3">Quotation</th><th className="p-3">Client</th><th className="p-3 text-right">Value</th><th className="p-3">Reason</th></tr></thead>
                <tbody>
                  {lost.map((q, i) => (
                    <tr key={i} className="border-b border-[var(--border)] last:border-0">
                      <td className="p-3 font-medium text-[var(--text-primary)]">{q.quotation_number}</td>
                      <td className="p-3 text-xs text-[var(--text-secondary)]">{q.client_name}</td>
                      <td className="p-3 text-right tabular-nums">{aed(q.grand_total_with_vat)}</td>
                      <td className="p-3 text-xs text-[var(--text-secondary)]">{q.rejection_reason || '—'}</td>
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
