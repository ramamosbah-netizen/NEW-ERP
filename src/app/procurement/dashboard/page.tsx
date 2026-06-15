'use client';

// ============================================================
// JEET ERP — Procurement Dashboard
// Spend, PR/PO/GRN status, pending receipts, match exceptions and
// source-to-pay funnel. Read-only; batched plain queries (no migration).
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

const aed = (n: number) => `AED ${Number(n || 0).toLocaleString('en-AE', { maximumFractionDigits: 0 })}`;
const PR_OPEN = ['DRAFT', 'SUBMITTED', 'PENDING_APPROVAL'];
const PO_OPEN = ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'SENT', 'ACKNOWLEDGED', 'PARTIALLY_DELIVERED'];
const PO_COMMITTED = ['APPROVED', 'SENT', 'ACKNOWLEDGED', 'PARTIALLY_DELIVERED', 'DELIVERED', 'CLOSED'];

interface Pr { status: string; estimated_total: number; created_at: string; converted_po_id: string | null; }
interface Po { status: string; delivery_status: string; total: number; created_at: string; required_delivery_date: string | null; }
interface Grn { status: string; created_at: string; }
interface Inv { status: string; match_status: string; total: number; }

export default function ProcurementDashboard() {
  const router = useRouter();
  const [prs, setPrs] = useState<Pr[]>([]);
  const [pos, setPos] = useState<Po[]>([]);
  const [grns, setGrns] = useState<Grn[]>([]);
  const [invs, setInvs] = useState<Inv[]>([]);
  const [supplierCount, setSupplierCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [pr, po, gr, inv, sup] = await Promise.all([
          supabase.from('purchase_requests').select('status, estimated_total, created_at, converted_po_id'),
          supabase.from('purchase_orders').select('status, delivery_status, total, created_at, required_delivery_date'),
          supabase.from('grns').select('status, created_at'),
          supabase.from('supplier_invoices').select('status, match_status, total'),
          supabase.from('pricing_suppliers').select('id', { count: 'exact', head: true }).eq('is_active', true),
        ]);
        setPrs((pr.data || []) as Pr[]);
        setPos((po.data || []) as Po[]);
        setGrns((gr.data || []) as Grn[]);
        setInvs((inv.data || []) as Inv[]);
        setSupplierCount(sup.count || 0);
      } finally { setLoading(false); }
    })();
  }, []);

  const now = Date.now();
  const prPending = prs.filter(p => PR_OPEN.includes(p.status)).length;
  const committed = pos.filter(p => PO_COMMITTED.includes(p.status)).reduce((s, p) => s + Number(p.total || 0), 0);
  const openPos = pos.filter(p => PO_OPEN.includes(p.status)).length;
  const overdueDel = pos.filter(p => p.required_delivery_date && new Date(p.required_delivery_date).getTime() < now && p.delivery_status !== 'COMPLETE' && p.status !== 'CANCELLED').length;
  const pendingReceipts = pos.filter(p => ['SENT', 'ACKNOWLEDGED', 'PARTIALLY_DELIVERED'].includes(p.status) && p.delivery_status !== 'COMPLETE').length;
  const matchExceptions = invs.filter(i => ['MISMATCH', 'EXCEPTION', 'FAILED'].includes((i.match_status || '').toUpperCase())).length;

  const poByStatus = [...new Set(pos.map(p => p.status))].map(s => ({ name: s.replace(/_/g, ' '), value: pos.filter(p => p.status === s).length })).filter(d => d.value > 0);
  const funnel = [
    { name: 'Purchase Requests', value: prs.length, color: 'var(--status-info-text)' },
    { name: 'Purchase Orders', value: pos.length, color: 'var(--accent)' },
    { name: 'Goods Receipts', value: grns.length, color: 'var(--status-success-text)' },
  ];
  const trend = (() => {
    const m = new Map<string, number>();
    pos.forEach(p => { if (!p.created_at) return; const d = new Date(p.created_at); const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; m.set(k, (m.get(k) || 0) + Number(p.total || 0)); });
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-6).map(([k, v]) => ({ month: k.slice(2), value: Math.round(v) }));
  })();

  const hasData = prs.length || pos.length || grns.length;
  const exportCols = ['Metric', 'Value'];
  const exportRows = [['PRs', prs.length], ['PRs pending', prPending], ['Committed PO spend', committed], ['Open POs', openPos], ['Pending receipts', pendingReceipts], ['Overdue deliveries', overdueDel], ['GRNs', grns.length], ['Supplier invoices', invs.length], ['Match exceptions', matchExceptions], ['Active suppliers', supplierCount]];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Procurement Dashboard"
        subtitle="Source-to-pay health — spend, PR/PO/GRN status and exceptions"
        breadcrumbs={[{ label: 'Procurement', href: '/procurement/po' }, { label: 'Dashboard' }]}
        actions={hasData ? (
          <div className="flex gap-2">
            <Button variant="secondary" icon={FileDown} onClick={() => exportTablePdf({ title: 'Procurement Dashboard', columns: exportCols, rows: exportRows, fileName: 'procurement-dashboard' })}>PDF</Button>
            <Button variant="secondary" icon={Sheet} onClick={() => exportTableExcel({ title: 'Procurement Dashboard', columns: exportCols, rows: exportRows, fileName: 'procurement-dashboard' })}>Excel</Button>
          </div>
        ) : undefined}
      />

      {loading ? (
        <Card><div className="p-8 text-center text-sm text-[var(--text-tertiary)]">Loading…</div></Card>
      ) : !hasData ? (
        <Card><EmptyState icon={LayoutDashboard} title="No procurement data" description="Purchase requests, orders and receipts will be summarised here." /></Card>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Committed PO spend</div><div className="text-xl font-bold mt-1">{aed(committed)}</div></Card>
            <Card className="p-4 cursor-pointer hover:border-[var(--accent)]" onClick={() => router.push('/procurement/po')}><div className="text-xs text-[var(--text-secondary)]">Open POs</div><div className="text-2xl font-bold mt-1">{openPos}</div></Card>
            <Card className="p-4 cursor-pointer hover:border-[var(--accent)]" onClick={() => router.push('/procurement/pr')}><div className="text-xs text-[var(--text-secondary)]">PRs pending</div><div className="text-2xl font-bold mt-1" style={{ color: prPending ? 'var(--status-warning-text)' : 'var(--text-primary)' }}>{prPending}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Active suppliers</div><div className="text-2xl font-bold mt-1">{supplierCount}</div></Card>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="p-4 cursor-pointer hover:border-[var(--accent)]" onClick={() => router.push('/procurement/grn')}><div className="text-xs text-[var(--text-secondary)]">Pending receipts</div><div className="text-2xl font-bold mt-1" style={{ color: pendingReceipts ? 'var(--status-warning-text)' : 'var(--text-primary)' }}>{pendingReceipts}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Overdue deliveries</div><div className="text-2xl font-bold mt-1" style={{ color: overdueDel ? 'var(--status-danger-text)' : 'var(--text-primary)' }}>{overdueDel}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">GRNs</div><div className="text-2xl font-bold mt-1">{grns.length}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Match exceptions</div><div className="text-2xl font-bold mt-1" style={{ color: matchExceptions ? 'var(--status-danger-text)' : 'var(--text-primary)' }}>{matchExceptions}</div></Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <Card className="p-4">
              <div className="text-sm font-semibold text-[var(--text-primary)] mb-3">Source-to-pay funnel</div>
              <div style={{ width: '100%', height: 240 }}>
                <ResponsiveContainer>
                  <BarChart data={funnel} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} allowDecimals={false} />
                    <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }} />
                    <Tooltip />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]}>{funnel.map((f, i) => <Cell key={i} fill={f.color} />)}</Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card className="p-4">
              <div className="text-sm font-semibold text-[var(--text-primary)] mb-3">PO spend trend</div>
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

          {poByStatus.length > 0 && (
            <Card className="p-4">
              <div className="text-sm font-semibold text-[var(--text-primary)] mb-3">Purchase orders by status</div>
              <div style={{ width: '100%', height: 220 }}>
                <ResponsiveContainer>
                  <BarChart data={poByStatus}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }} />
                    <YAxis tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="value" fill="var(--accent)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          )}

          {(prPending > 0 || overdueDel > 0 || pendingReceipts > 0 || matchExceptions > 0) && (
            <Card className="p-4" style={{ background: 'var(--status-warning-bg)' }}>
              <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--status-warning-text)' }}><AlertTriangle size={16} /> Attention needed</div>
              <ul className="mt-2 text-xs space-y-1" style={{ color: 'var(--status-warning-text)' }}>
                {prPending > 0 && <li>• {prPending} purchase request(s) awaiting approval.</li>}
                {overdueDel > 0 && <li>• {overdueDel} PO(s) past their required delivery date.</li>}
                {pendingReceipts > 0 && <li>• {pendingReceipts} PO(s) sent but not yet fully received.</li>}
                {matchExceptions > 0 && <li>• {matchExceptions} supplier invoice(s) with three-way-match exceptions.</li>}
              </ul>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
