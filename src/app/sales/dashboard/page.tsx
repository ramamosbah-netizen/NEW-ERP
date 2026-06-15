'use client';

// ============================================================
// JEET ERP — Pre-Sales Dashboard
// Funnel (tenders -> BOQs -> quotations -> won), pipeline value,
// win rate, conversion and deadline/validity alerts. Read-only;
// batched plain queries (no migration).
// ============================================================

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { exportTablePdf, exportTableExcel } from '@/lib/finance-export';
import { LayoutDashboard, FileDown, Sheet, AlertTriangle } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell, LineChart, Line } from 'recharts';

const DAY = 86400000;
const aed = (n: number) => `AED ${Number(n || 0).toLocaleString('en-AE', { maximumFractionDigits: 0 })}`;

interface Tn { status: string; budget: number; deadline_date: string | null; created_at: string; }
interface Qt { status: string; grand_total_with_vat: number; client_response: string | null; linked_project_id: string | null; actual_project_id: string | null; rejection_reason: string | null; valid_until: string | null; sent_to_client_at: string | null; created_at: string; }

const isWon = (q: Qt) => q.status === 'ACCEPTED' || q.client_response === 'ACCEPTED' || !!q.linked_project_id || !!q.actual_project_id;
const isLost = (q: Qt) => q.status === 'REJECTED' || (!!q.rejection_reason && !isWon(q));

export default function PreSalesDashboard() {
  const router = useRouter();
  const [tenders, setTenders] = useState<Tn[]>([]);
  const [boqCount, setBoqCount] = useState(0);
  const [quotes, setQuotes] = useState<Qt[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [tn, bq, qt] = await Promise.all([
          supabase.from('tenders').select('status, budget, deadline_date, created_at'),
          supabase.from('boqs').select('id', { count: 'exact', head: true }),
          supabase.from('quotations').select('status, grand_total_with_vat, client_response, linked_project_id, actual_project_id, rejection_reason, valid_until, sent_to_client_at, created_at'),
        ]);
        setTenders((tn.data || []) as Tn[]);
        setBoqCount(bq.count || 0);
        setQuotes((qt.data || []) as Qt[]);
      } finally { setLoading(false); }
    })();
  }, []);

  const now = Date.now();
  const openTenders = tenders.filter(t => t.status !== 'Completed');
  const pipelineValue = openTenders.reduce((s, t) => s + Number(t.budget || 0), 0);
  const won = quotes.filter(isWon);
  const lost = quotes.filter(isLost);
  const pending = quotes.filter(q => !isWon(q) && !isLost(q) && q.status !== 'SUPERSEDED');
  const wonValue = won.reduce((s, q) => s + Number(q.grand_total_with_vat || 0), 0);
  const winRate = (won.length + lost.length) ? Math.round(won.length / (won.length + lost.length) * 100) : 0;
  const conversion = tenders.length ? Math.round(won.length / tenders.length * 100) : 0;

  const deadlinesSoon = openTenders.filter(t => t.deadline_date && new Date(t.deadline_date).getTime() - now <= 14 * DAY && new Date(t.deadline_date).getTime() >= now).length;
  const expiringQuotes = pending.filter(q => q.valid_until && new Date(q.valid_until).getTime() - now <= 14 * DAY && new Date(q.valid_until).getTime() >= now).length;
  const expiredQuotes = pending.filter(q => q.valid_until && new Date(q.valid_until).getTime() < now).length;

  const funnel = [
    { name: 'Tenders', value: tenders.length, color: 'var(--status-info-text)' },
    { name: 'BOQs', value: boqCount, color: 'var(--accent)' },
    { name: 'Quotations', value: quotes.length, color: 'var(--status-warning-text)' },
    { name: 'Won', value: won.length, color: 'var(--status-success-text)' },
  ];
  const quoteByStatus = [...new Set(quotes.map(q => q.status))].map(s => ({ name: s, value: quotes.filter(q => q.status === s).reduce((a, q) => a + Number(q.grand_total_with_vat || 0), 0) })).filter(d => d.value > 0);

  const trend = (() => {
    const m = new Map<string, number>();
    quotes.forEach(q => { if (!q.created_at) return; const d = new Date(q.created_at); const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; m.set(k, (m.get(k) || 0) + Number(q.grand_total_with_vat || 0)); });
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-6).map(([k, v]) => ({ month: k.slice(2), value: Math.round(v) }));
  })();

  const hasData = tenders.length || quotes.length || boqCount;
  const exportCols = ['Metric', 'Value'];
  const exportRows = [['Tenders', tenders.length], ['Open tenders', openTenders.length], ['Pipeline value', pipelineValue], ['BOQs', boqCount], ['Quotations', quotes.length], ['Won', won.length], ['Won value', wonValue], ['Lost', lost.length], ['Win rate %', winRate], ['Conversion %', conversion]];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Pre-Sales Dashboard"
        subtitle="Funnel, pipeline value, win rate and conversion across tenders and quotations"
        breadcrumbs={[{ label: 'Pre-Sales', href: '/tenders' }, { label: 'Dashboard' }]}
        actions={hasData ? (
          <div className="flex gap-2">
            <Button variant="secondary" icon={FileDown} onClick={() => exportTablePdf({ title: 'Pre-Sales Dashboard', columns: exportCols, rows: exportRows, fileName: 'presales-dashboard' })}>PDF</Button>
            <Button variant="secondary" icon={Sheet} onClick={() => exportTableExcel({ title: 'Pre-Sales Dashboard', columns: exportCols, rows: exportRows, fileName: 'presales-dashboard' })}>Excel</Button>
          </div>
        ) : undefined}
      />

      {loading ? (
        <Card><div className="p-8 text-center text-sm text-[var(--text-tertiary)]">Loading…</div></Card>
      ) : !hasData ? (
        <Card><EmptyState icon={LayoutDashboard} title="No pre-sales data" description="Tenders and quotations will be summarised here." /></Card>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="p-4 cursor-pointer hover:border-[var(--accent)]" onClick={() => router.push('/tenders')}><div className="text-xs text-[var(--text-secondary)]">Open tenders</div><div className="text-2xl font-bold mt-1">{openTenders.length}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Pipeline value</div><div className="text-xl font-bold mt-1">{aed(pipelineValue)}</div></Card>
            <Card className="p-4 cursor-pointer hover:border-[var(--accent)]" onClick={() => router.push('/quotations')}><div className="text-xs text-[var(--text-secondary)]">Quotations</div><div className="text-2xl font-bold mt-1">{quotes.length}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Won value</div><div className="text-xl font-bold mt-1" style={{ color: 'var(--status-success-text)' }}>{aed(wonValue)}</div></Card>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Win rate</div><div className="text-2xl font-bold mt-1" style={{ color: winRate >= 50 ? 'var(--status-success-text)' : 'var(--status-warning-text)' }}>{winRate}%</div><div className="text-[11px] text-[var(--text-tertiary)]">{won.length}W / {lost.length}L</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Tender→Won conversion</div><div className="text-2xl font-bold mt-1">{conversion}%</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Pending quotes</div><div className="text-2xl font-bold mt-1">{pending.length}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Deadlines ≤14d</div><div className="text-2xl font-bold mt-1" style={{ color: deadlinesSoon ? 'var(--status-warning-text)' : 'var(--text-primary)' }}>{deadlinesSoon}</div></Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <Card className="p-4">
              <div className="text-sm font-semibold text-[var(--text-primary)] mb-3">Pre-sales funnel</div>
              <div style={{ width: '100%', height: 260 }}>
                <ResponsiveContainer>
                  <BarChart data={funnel} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} allowDecimals={false} />
                    <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} />
                    <Tooltip />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]}>{funnel.map((f, i) => <Cell key={i} fill={f.color} />)}</Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card className="p-4">
              <div className="text-sm font-semibold text-[var(--text-primary)] mb-3">Quotation value trend</div>
              <div style={{ width: '100%', height: 260 }}>
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

          {quoteByStatus.length > 0 && (
            <Card className="p-4">
              <div className="text-sm font-semibold text-[var(--text-primary)] mb-3">Quotation value by status</div>
              <div style={{ width: '100%', height: 220 }}>
                <ResponsiveContainer>
                  <BarChart data={quoteByStatus}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }} />
                    <YAxis tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v: any) => aed(v)} />
                    <Bar dataKey="value" fill="var(--accent)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          )}

          {(deadlinesSoon > 0 || expiringQuotes > 0 || expiredQuotes > 0) && (
            <Card className="p-4" style={{ background: 'var(--status-warning-bg)' }}>
              <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--status-warning-text)' }}><AlertTriangle size={16} /> Attention needed</div>
              <ul className="mt-2 text-xs space-y-1" style={{ color: 'var(--status-warning-text)' }}>
                {deadlinesSoon > 0 && <li>• {deadlinesSoon} tender submission deadline(s) within 14 days.</li>}
                {expiringQuotes > 0 && <li>• {expiringQuotes} quotation(s) expiring within 14 days — follow up.</li>}
                {expiredQuotes > 0 && <li>• {expiredQuotes} pending quotation(s) already past validity.</li>}
              </ul>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
