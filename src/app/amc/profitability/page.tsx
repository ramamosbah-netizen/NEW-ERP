'use client';

// ============================================================
// JEET ERP — AMC: Contract Profitability
// Annual value vs service activity & covered-parts cost per contract.
// Read-only; plain queries (no migration). Margin excludes labour
// (no per-visit labour rate in the data model).
// ============================================================

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { exportTablePdf, exportTableExcel } from '@/lib/finance-export';
import { TrendingUp, FileDown, Sheet } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';

const aed = (n: number) => `AED ${Number(n || 0).toLocaleString('en-AE', { maximumFractionDigits: 0 })}`;
const OPEN_TICKET = ['NEW', 'ASSIGNED', 'IN_PROGRESS', 'ON_HOLD_PARTS'];

interface Row { id: string; number: string; client: string; status: string; revenue: number; partsCost: number; tickets: number; openTickets: number; visits: number; margin: number; marginPct: number; }

export default function ContractProfitabilityPage() {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [ct, tk, vt] = await Promise.all([
          supabase.from('amc_contracts').select('id, contract_number, client_name, status, annual_value'),
          supabase.from('service_tickets').select('contract_id, parts_used, status'),
          supabase.from('ppm_visits').select('contract_id, status'),
        ]);
        const contracts = (ct.data || []) as any[];
        const tickets = (tk.data || []) as any[];
        const visits = (vt.data || []) as any[];

        const tByC = new Map<string, { count: number; open: number; parts: number }>();
        tickets.forEach(t => {
          if (!t.contract_id) return;
          const e = tByC.get(t.contract_id) || { count: 0, open: 0, parts: 0 };
          e.count++;
          if (OPEN_TICKET.includes(t.status)) e.open++;
          const parts = Array.isArray(t.parts_used) ? t.parts_used : [];
          // covered (non-chargeable) parts are an AMC cost
          e.parts += parts.filter((p: any) => !p.chargeable).reduce((s: number, p: any) => s + Number(p.quantity || 0) * Number(p.unit_price || 0), 0);
          tByC.set(t.contract_id, e);
        });
        const vByC = new Map<string, number>();
        visits.forEach(v => { if (v.contract_id) vByC.set(v.contract_id, (vByC.get(v.contract_id) || 0) + 1); });

        const out: Row[] = contracts.map(c => {
          const t = tByC.get(c.id) || { count: 0, open: 0, parts: 0 };
          const revenue = Number(c.annual_value || 0);
          const partsCost = Math.round(t.parts * 100) / 100;
          const margin = revenue - partsCost;
          return { id: c.id, number: c.contract_number, client: c.client_name, status: c.status, revenue, partsCost, tickets: t.count, openTickets: t.open, visits: vByC.get(c.id) || 0, margin, marginPct: revenue ? Math.round(margin / revenue * 100) : 0 };
        }).filter(r => r.revenue > 0 || r.tickets > 0 || r.visits > 0);
        setRows(out.sort((a, b) => b.revenue - a.revenue));
      } finally { setLoading(false); }
    })();
  }, []);

  const totalRevenue = rows.reduce((s, r) => s + r.revenue, 0);
  const totalParts = rows.reduce((s, r) => s + r.partsCost, 0);
  const totalMargin = totalRevenue - totalParts;
  const lowMargin = rows.filter(r => r.revenue > 0 && r.marginPct < 50).length;

  const chart = useMemo(() => rows.slice(0, 10).map(r => ({ name: r.number, Revenue: r.revenue, 'Parts cost': r.partsCost })), [rows]);

  const exportCols = ['Contract', 'Client', 'Status', 'Annual value', 'Covered parts cost', 'Tickets', 'Visits', 'Margin (excl. labour)', 'Margin %'];
  const exportRows = rows.map(r => [r.number, r.client, r.status, r.revenue, r.partsCost, r.tickets, r.visits, r.margin, `${r.marginPct}%`]);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Contract Profitability"
        subtitle="Annual value vs service activity and covered-parts cost (margin excludes labour)"
        breadcrumbs={[{ label: 'AMC', href: '/amc' }, { label: 'Profitability' }]}
        actions={rows.length > 0 ? (
          <div className="flex gap-2">
            <Button variant="secondary" icon={FileDown} onClick={() => exportTablePdf({ title: 'Contract Profitability', columns: exportCols, rows: exportRows, fileName: 'contract-profitability' })}>PDF</Button>
            <Button variant="secondary" icon={Sheet} onClick={() => exportTableExcel({ title: 'Contract Profitability', columns: exportCols, rows: exportRows, fileName: 'contract-profitability' })}>Excel</Button>
          </div>
        ) : undefined}
      />

      {loading ? (
        <Card><div className="p-8 text-center text-sm text-[var(--text-tertiary)]">Loading…</div></Card>
      ) : rows.length === 0 ? (
        <Card><EmptyState icon={TrendingUp} title="No contract activity" description="Active AMC contracts with value or service activity appear here." /></Card>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Portfolio annual value</div><div className="text-xl font-bold mt-1">{aed(totalRevenue)}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Covered parts cost</div><div className="text-xl font-bold mt-1" style={{ color: 'var(--status-warning-text)' }}>{aed(totalParts)}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Margin (excl. labour)</div><div className="text-xl font-bold mt-1" style={{ color: 'var(--status-success-text)' }}>{aed(totalMargin)}</div><div className="text-[11px] text-[var(--text-tertiary)]">{totalRevenue ? Math.round(totalMargin / totalRevenue * 100) : 0}%</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Margin &lt; 50%</div><div className="text-2xl font-bold mt-1" style={{ color: lowMargin ? 'var(--status-danger-text)' : 'var(--text-primary)' }}>{lowMargin}</div></Card>
          </div>

          <Card className="p-3" style={{ background: 'var(--status-info-bg)' }}><div className="text-[11px]" style={{ color: 'var(--status-info-text)' }}>Cost here = AMC-<strong>covered</strong> (non-chargeable) spare parts consumed on tickets. Labour is not costed per visit in the data model, so margin is indicative.</div></Card>

          <Card className="p-4">
            <div className="text-sm font-semibold text-[var(--text-primary)] mb-3">Revenue vs covered-parts cost (top 10)</div>
            <div style={{ width: '100%', height: 260 }}>
              <ResponsiveContainer>
                <BarChart data={chart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: any) => aed(v)} />
                  <Legend />
                  <Bar dataKey="Revenue" fill="var(--accent)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Parts cost" fill="var(--status-warning-text)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-[var(--border)] text-left text-[var(--text-tertiary)] text-xs">
                <th className="p-3">Contract</th><th className="p-3">Status</th><th className="p-3 text-right">Annual value</th>
                <th className="p-3 text-right">Parts cost</th><th className="p-3 text-right">Tickets</th><th className="p-3 text-right">Visits</th>
                <th className="p-3 text-right">Margin</th><th className="p-3 text-right">Margin %</th>
              </tr></thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-hover)] cursor-pointer" onClick={() => router.push(`/amc/${r.id}`)}>
                    <td className="p-3"><div className="font-medium text-[var(--text-primary)]">{r.number}</div><div className="text-[11px] text-[var(--text-tertiary)] line-clamp-1">{r.client}</div></td>
                    <td className="p-3 text-xs">{r.status}</td>
                    <td className="p-3 text-right tabular-nums">{aed(r.revenue)}</td>
                    <td className="p-3 text-right tabular-nums text-[var(--text-secondary)]">{aed(r.partsCost)}</td>
                    <td className="p-3 text-right tabular-nums">{r.tickets}{r.openTickets ? <span className="text-[10px] text-[var(--status-warning-text)]"> ({r.openTickets} open)</span> : ''}</td>
                    <td className="p-3 text-right tabular-nums">{r.visits}</td>
                    <td className="p-3 text-right tabular-nums font-medium">{aed(r.margin)}</td>
                    <td className="p-3 text-right tabular-nums font-medium" style={{ color: r.marginPct >= 60 ? 'var(--status-success-text)' : r.marginPct >= 40 ? 'var(--status-warning-text)' : 'var(--status-danger-text)' }}>{r.revenue ? `${r.marginPct}%` : '—'}</td>
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
