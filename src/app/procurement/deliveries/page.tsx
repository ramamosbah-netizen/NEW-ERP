'use client';

// ============================================================
// JEET ERP — Procurement: PO Delivery Tracking
// Open POs, delivery status, overdue vs required date, ack status.
// Read-only; plain query (no migration).
// ============================================================

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { exportTablePdf, exportTableExcel } from '@/lib/finance-export';
import { Truck, FileDown, Sheet } from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';

const DAY = 86400000;
const aed = (n: number) => `AED ${Number(n || 0).toLocaleString('en-AE', { maximumFractionDigits: 0 })}`;
const OPEN = ['APPROVED', 'SENT', 'ACKNOWLEDGED', 'PARTIALLY_DELIVERED'];
const PIE = ['var(--status-success-text)', 'var(--status-warning-text)', 'var(--status-info-text)', 'var(--text-tertiary)'];

interface Po { id: string; po_number: string; supplier_name: string | null; project_id: string | null; total: number; status: string; delivery_status: string; required_delivery_date: string | null; sent_at: string | null; acknowledged_at: string | null; }

export default function DeliveryTrackingPage() {
  const router = useRouter();
  const [pos, setPos] = useState<Po[]>([]);
  const [projectMap, setProjectMap] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.from('purchase_orders').select('id, po_number, supplier_name, project_id, total, status, delivery_status, required_delivery_date, sent_at, acknowledged_at').order('required_delivery_date', { ascending: true });
        const rows = ((data || []) as Po[]).filter(p => OPEN.includes(p.status) && p.delivery_status !== 'COMPLETE');
        setPos(rows);
        const pids = [...new Set(rows.map(r => r.project_id).filter(Boolean))] as string[];
        if (pids.length) { const { data: ps } = await supabase.from('projects').select('id, project_number').in('id', pids); setProjectMap(new Map((ps || []).map((p: any) => [p.id, p.project_number]))); }
      } finally { setLoading(false); }
    })();
  }, []);

  const now = Date.now();
  const daysLeft = (d: string | null) => d ? Math.ceil((new Date(d).getTime() - now) / DAY) : null;
  const overdue = pos.filter(p => { const dl = daysLeft(p.required_delivery_date); return dl !== null && dl < 0; });
  const dueSoon = pos.filter(p => { const dl = daysLeft(p.required_delivery_date); return dl !== null && dl >= 0 && dl <= 7; });
  const notAcked = pos.filter(p => p.sent_at && !p.acknowledged_at);
  const openValue = pos.reduce((s, p) => s + Number(p.total || 0), 0);

  const statusDist = useMemo(() => [...new Set(pos.map(p => p.delivery_status || 'NOT_DELIVERED'))].map(s => ({ name: s.replace(/_/g, ' '), value: pos.filter(p => (p.delivery_status || 'NOT_DELIVERED') === s).length })), [pos]);

  const exportCols = ['PO', 'Supplier', 'Project', 'Value', 'Required', 'Days', 'Delivery', 'Acknowledged'];
  const exportRows = pos.map(p => [p.po_number, p.supplier_name || '', p.project_id ? projectMap.get(p.project_id) || '' : '', p.total, p.required_delivery_date || '', daysLeft(p.required_delivery_date) ?? '', p.delivery_status, p.acknowledged_at ? 'Yes' : (p.sent_at ? 'No' : '—')]);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="PO Delivery Tracking"
        subtitle="Open purchase orders, delivery status and overdue deliveries"
        breadcrumbs={[{ label: 'Procurement', href: '/procurement/dashboard' }, { label: 'Deliveries' }]}
        actions={pos.length > 0 ? (
          <div className="flex gap-2">
            <Button variant="secondary" icon={FileDown} onClick={() => exportTablePdf({ title: 'PO Delivery Tracking', columns: exportCols, rows: exportRows, fileName: 'po-deliveries' })}>PDF</Button>
            <Button variant="secondary" icon={Sheet} onClick={() => exportTableExcel({ title: 'PO Delivery Tracking', columns: exportCols, rows: exportRows, fileName: 'po-deliveries' })}>Excel</Button>
          </div>
        ) : undefined}
      />

      {loading ? (
        <Card><div className="p-8 text-center text-sm text-[var(--text-tertiary)]">Loading…</div></Card>
      ) : pos.length === 0 ? (
        <Card><EmptyState icon={Truck} title="No open deliveries" description="Approved/sent POs awaiting delivery appear here." /></Card>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Open deliveries</div><div className="text-2xl font-bold mt-1">{pos.length}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Open value</div><div className="text-lg font-bold mt-1">{aed(openValue)}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Overdue</div><div className="text-2xl font-bold mt-1" style={{ color: overdue.length ? 'var(--status-danger-text)' : 'var(--text-primary)' }}>{overdue.length}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Due ≤7d</div><div className="text-2xl font-bold mt-1" style={{ color: dueSoon.length ? 'var(--status-warning-text)' : 'var(--text-primary)' }}>{dueSoon.length}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Not acknowledged</div><div className="text-2xl font-bold mt-1" style={{ color: notAcked.length ? 'var(--status-warning-text)' : 'var(--text-primary)' }}>{notAcked.length}</div></Card>
          </div>

          {statusDist.length > 0 && (
            <Card className="p-4">
              <div className="text-sm font-semibold text-[var(--text-primary)] mb-3">Delivery status</div>
              <div style={{ width: '100%', height: 220 }}>
                <ResponsiveContainer>
                  <PieChart><Pie data={statusDist} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={(e: any) => `${e.name}: ${e.value}`}>{statusDist.map((_, i) => <Cell key={i} fill={PIE[i % PIE.length]} />)}</Pie><Tooltip /></PieChart>
                </ResponsiveContainer>
              </div>
            </Card>
          )}

          <Card className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-[var(--border)] text-left text-[var(--text-tertiary)] text-xs">
                <th className="p-3">PO</th><th className="p-3">Supplier</th><th className="p-3">Project</th><th className="p-3 text-right">Value</th>
                <th className="p-3">Required</th><th className="p-3 text-right">Days</th><th className="p-3">Delivery</th><th className="p-3">Ack</th>
              </tr></thead>
              <tbody>
                {pos.map(p => { const dl = daysLeft(p.required_delivery_date); const od = dl !== null && dl < 0; const soon = dl !== null && dl >= 0 && dl <= 7; return (
                  <tr key={p.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-hover)] cursor-pointer" onClick={() => router.push(`/procurement/po/${p.id}`)}>
                    <td className="p-3 font-medium text-[var(--text-primary)]">{p.po_number}</td>
                    <td className="p-3 text-xs text-[var(--text-secondary)]">{p.supplier_name}</td>
                    <td className="p-3 text-xs text-[var(--text-tertiary)]">{p.project_id ? projectMap.get(p.project_id) || '—' : '—'}</td>
                    <td className="p-3 text-right tabular-nums">{aed(p.total)}</td>
                    <td className="p-3 text-xs" style={{ color: od ? 'var(--status-danger-text)' : soon ? 'var(--status-warning-text)' : 'var(--text-secondary)' }}>{p.required_delivery_date || '—'}</td>
                    <td className="p-3 text-right text-xs font-medium" style={{ color: od ? 'var(--status-danger-text)' : soon ? 'var(--status-warning-text)' : 'var(--text-tertiary)' }}>{dl === null ? '—' : od ? `${Math.abs(dl)}d late` : `${dl}d`}</td>
                    <td className="p-3 text-xs">{(p.delivery_status || 'NOT_DELIVERED').replace(/_/g, ' ')}</td>
                    <td className="p-3 text-xs">{p.acknowledged_at ? <span style={{ color: 'var(--status-success-text)' }}>Yes</span> : p.sent_at ? <span style={{ color: 'var(--status-warning-text)' }}>Pending</span> : '—'}</td>
                  </tr>
                ); })}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </div>
  );
}
