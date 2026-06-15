'use client';

// ============================================================
// JEET ERP — Pre-Sales: Quotation Analytics
// Status & value distribution, conversion, revisions, monthly
// trend and aging of pending quotes. Read-only (no migration).
// ============================================================

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { exportTablePdf, exportTableExcel } from '@/lib/finance-export';
import { FileText, FileDown, Sheet } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, LineChart, Line, PieChart, Pie, Cell } from 'recharts';

const DAY = 86400000;
const aed = (n: number) => `AED ${Number(n || 0).toLocaleString('en-AE', { maximumFractionDigits: 0 })}`;
const PIE = ['var(--text-tertiary)', 'var(--status-info-text)', 'var(--status-success-text)', 'var(--status-danger-text)', 'var(--status-warning-text)', '#8b5cf6'];

interface Qt { status: string; grand_total_with_vat: number; revision: number; quotation_date: string | null; valid_until: string | null; client_response: string | null; linked_project_id: string | null; actual_project_id: string | null; rejection_reason: string | null; created_at: string; }
const isWon = (q: Qt) => q.status === 'ACCEPTED' || q.client_response === 'ACCEPTED' || !!q.linked_project_id || !!q.actual_project_id;
const isLost = (q: Qt) => q.status === 'REJECTED' || (!!q.rejection_reason && !isWon(q));
const isPending = (q: Qt) => !isWon(q) && !isLost(q) && q.status !== 'SUPERSEDED';

export default function QuotationAnalyticsPage() {
  const [quotes, setQuotes] = useState<Qt[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from('quotations').select('status, grand_total_with_vat, revision, quotation_date, valid_until, client_response, linked_project_id, actual_project_id, rejection_reason, created_at')
      .then(({ data }) => setQuotes((data || []) as Qt[])).then(() => setLoading(false), () => setLoading(false));
  }, []);

  const val = (q: Qt[]) => q.reduce((s, x) => s + Number(x.grand_total_with_vat || 0), 0);
  const won = quotes.filter(isWon), lost = quotes.filter(isLost), pending = quotes.filter(isPending);
  const winRate = (won.length + lost.length) ? Math.round(won.length / (won.length + lost.length) * 100) : 0;
  const avgRevision = quotes.length ? (quotes.reduce((s, q) => s + Number(q.revision || 0), 0) / quotes.length) : 0;
  const revised = quotes.filter(q => Number(q.revision || 0) > 0).length;

  const byStatusCount = useMemo(() => [...new Set(quotes.map(q => q.status))].map(s => ({ name: s, value: quotes.filter(q => q.status === s).length })), [quotes]);
  const byStatusValue = useMemo(() => [...new Set(quotes.map(q => q.status))].map(s => ({ name: s, value: Math.round(val(quotes.filter(q => q.status === s))) })).filter(d => d.value > 0), [quotes]);
  const trend = useMemo(() => {
    const m = new Map<string, number>();
    quotes.forEach(q => { const d = q.quotation_date || q.created_at; if (!d) return; const k = d.slice(0, 7); m.set(k, (m.get(k) || 0) + Number(q.grand_total_with_vat || 0)); });
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-6).map(([k, v]) => ({ month: k.slice(2), value: Math.round(v) }));
  }, [quotes]);
  const aging = useMemo(() => {
    const buckets = [{ name: '0–15d', count: 0, value: 0 }, { name: '16–30d', count: 0, value: 0 }, { name: '31–60d', count: 0, value: 0 }, { name: '60d+', count: 0, value: 0 }];
    pending.forEach(q => { const base = q.quotation_date || q.created_at; if (!base) return; const age = (Date.now() - new Date(base).getTime()) / DAY; const v = Number(q.grand_total_with_vat || 0); const i = age <= 15 ? 0 : age <= 30 ? 1 : age <= 60 ? 2 : 3; buckets[i].count++; buckets[i].value += v; });
    return buckets.map(b => ({ ...b, value: Math.round(b.value) }));
  }, [pending]);

  const exportCols = ['Status', 'Count', 'Value'];
  const exportRows = byStatusValue.map(s => [s.name, quotes.filter(q => q.status === s.name).length, s.value]);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Quotation Analytics"
        subtitle="Status, value, conversion, revisions and aging across quotations"
        breadcrumbs={[{ label: 'Pre-Sales', href: '/sales/dashboard' }, { label: 'Quotations' }]}
        actions={quotes.length > 0 ? (
          <div className="flex gap-2">
            <Button variant="secondary" icon={FileDown} onClick={() => exportTablePdf({ title: 'Quotation Analytics', columns: exportCols, rows: exportRows, fileName: 'quotation-analytics' })}>PDF</Button>
            <Button variant="secondary" icon={Sheet} onClick={() => exportTableExcel({ title: 'Quotation Analytics', columns: exportCols, rows: exportRows, fileName: 'quotation-analytics' })}>Excel</Button>
          </div>
        ) : undefined}
      />

      {loading ? (
        <Card><div className="p-8 text-center text-sm text-[var(--text-tertiary)]">Loading…</div></Card>
      ) : quotes.length === 0 ? (
        <Card><EmptyState icon={FileText} title="No quotations" description="Quotations appear here once created from a BOQ." /></Card>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Quotations</div><div className="text-2xl font-bold mt-1">{quotes.length}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Total value</div><div className="text-lg font-bold mt-1">{aed(val(quotes))}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Won value</div><div className="text-lg font-bold mt-1" style={{ color: 'var(--status-success-text)' }}>{aed(val(won))}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Win rate</div><div className="text-2xl font-bold mt-1" style={{ color: winRate >= 50 ? 'var(--status-success-text)' : 'var(--status-warning-text)' }}>{winRate}%</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Revised</div><div className="text-2xl font-bold mt-1">{revised}</div><div className="text-[11px] text-[var(--text-tertiary)]">avg rev {avgRevision.toFixed(1)}</div></Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <Card className="p-4">
              <div className="text-sm font-semibold text-[var(--text-primary)] mb-3">Count by status</div>
              <div style={{ width: '100%', height: 240 }}>
                <ResponsiveContainer>
                  <PieChart><Pie data={byStatusCount} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={85} label={(e: any) => e.name}>{byStatusCount.map((_, i) => <Cell key={i} fill={PIE[i % PIE.length]} />)}</Pie><Tooltip /></PieChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card className="p-4 lg:col-span-2">
              <div className="text-sm font-semibold text-[var(--text-primary)] mb-3">Issued value trend</div>
              <div style={{ width: '100%', height: 240 }}>
                <ResponsiveContainer>
                  {trend.length ? (
                    <LineChart data={trend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} />
                      <YAxis tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                      <Tooltip formatter={(v: any) => aed(v)} />
                      <Line dataKey="value" stroke="var(--accent)" strokeWidth={2} dot={{ r: 3 }} />
                    </LineChart>
                  ) : <div className="flex items-center justify-center h-full text-sm text-[var(--text-tertiary)]">Not enough data</div>}
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <Card className="p-4">
              <div className="text-sm font-semibold text-[var(--text-primary)] mb-3">Value by status</div>
              <div style={{ width: '100%', height: 240 }}>
                <ResponsiveContainer>
                  <BarChart data={byStatusValue}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }} />
                    <YAxis tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v: any) => aed(v)} />
                    <Bar dataKey="value" fill="var(--accent)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card className="p-4">
              <div className="text-sm font-semibold text-[var(--text-primary)] mb-3">Pending quote aging</div>
              <div style={{ width: '100%', height: 240 }}>
                <ResponsiveContainer>
                  <BarChart data={aging}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} />
                    <YAxis tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v: any, n: any) => n === 'value' ? aed(v) : v} />
                    <Bar dataKey="value" name="value" fill="var(--status-warning-text)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
