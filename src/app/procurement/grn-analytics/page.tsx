'use client';

// ============================================================
// JEET ERP — Procurement: Goods Receipt (GRN) Analytics
// Receipts over time, by project/supplier, and pending receipts.
// Read-only; plain queries (no migration).
// ============================================================

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { exportTablePdf, exportTableExcel } from '@/lib/finance-export';
import { PackageCheck, FileDown, Sheet } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

const PENDING_PO = ['SENT', 'ACKNOWLEDGED', 'PARTIALLY_DELIVERED'];

interface Grn { id: string; grn_number: string; po_id: string | null; project_id: string | null; received_at: string | null; status: string; created_at: string; }
interface Po { id: string; po_number: string; supplier_name: string | null; status: string; delivery_status: string; }

export default function GrnAnalyticsPage() {
  const router = useRouter();
  const [grns, setGrns] = useState<Grn[]>([]);
  const [pos, setPos] = useState<Po[]>([]);
  const [projectMap, setProjectMap] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [gr, po] = await Promise.all([
          supabase.from('grns').select('id, grn_number, po_id, project_id, received_at, status, created_at').order('received_at', { ascending: false }),
          supabase.from('purchase_orders').select('id, po_number, supplier_name, status, delivery_status'),
        ]);
        const grRows = (gr.data || []) as Grn[];
        setGrns(grRows); setPos((po.data || []) as Po[]);
        const pids = [...new Set(grRows.map(r => r.project_id).filter(Boolean))] as string[];
        if (pids.length) { const { data: ps } = await supabase.from('projects').select('id, project_number').in('id', pids); setProjectMap(new Map((ps || []).map((p: any) => [p.id, p.project_number]))); }
      } finally { setLoading(false); }
    })();
  }, []);

  const poMap = useMemo(() => new Map(pos.map(p => [p.id, p])), [pos]);
  const now = new Date();
  const thisMonth = grns.filter(g => { const d = g.received_at || g.created_at; if (!d) return false; const dt = new Date(d); return dt.getFullYear() === now.getFullYear() && dt.getMonth() === now.getMonth(); }).length;
  const pendingReceipts = pos.filter(p => PENDING_PO.includes(p.status) && p.delivery_status !== 'COMPLETE');

  const trend = useMemo(() => {
    const m = new Map<string, number>();
    grns.forEach(g => { const d = g.received_at || g.created_at; if (!d) return; const k = new Date(d).toISOString().slice(0, 7); m.set(k, (m.get(k) || 0) + 1); });
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-6).map(([k, v]) => ({ month: k.slice(2), count: v }));
  }, [grns]);
  const byProject = useMemo(() => {
    const m = new Map<string, number>();
    grns.forEach(g => { const k = g.project_id ? (projectMap.get(g.project_id) || 'Project') : 'Unassigned'; m.set(k, (m.get(k) || 0) + 1); });
    return [...m.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 8);
  }, [grns, projectMap]);

  const exportCols = ['GRN', 'PO', 'Supplier', 'Project', 'Received', 'Status'];
  const exportRows = grns.map(g => { const po = g.po_id ? poMap.get(g.po_id) : null; return [g.grn_number, po?.po_number || '', po?.supplier_name || '', g.project_id ? projectMap.get(g.project_id) || '' : '', g.received_at?.slice(0, 10) || '', g.status]; });

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Goods Receipt Analytics"
        subtitle="Receipts over time, by project, and purchase orders awaiting receipt"
        breadcrumbs={[{ label: 'Procurement', href: '/procurement/dashboard' }, { label: 'GRN Analytics' }]}
        actions={grns.length > 0 ? (
          <div className="flex gap-2">
            <Button variant="secondary" icon={FileDown} onClick={() => exportTablePdf({ title: 'GRN Analytics', columns: exportCols, rows: exportRows, fileName: 'grn-analytics' })}>PDF</Button>
            <Button variant="secondary" icon={Sheet} onClick={() => exportTableExcel({ title: 'GRN Analytics', columns: exportCols, rows: exportRows, fileName: 'grn-analytics' })}>Excel</Button>
          </div>
        ) : undefined}
      />

      {loading ? (
        <Card><div className="p-8 text-center text-sm text-[var(--text-tertiary)]">Loading…</div></Card>
      ) : grns.length === 0 && pendingReceipts.length === 0 ? (
        <Card><EmptyState icon={PackageCheck} title="No goods receipts" description="Goods received against POs will be analysed here." /></Card>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Total GRNs</div><div className="text-2xl font-bold mt-1">{grns.length}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">This month</div><div className="text-2xl font-bold mt-1">{thisMonth}</div></Card>
            <Card className="p-4 cursor-pointer hover:border-[var(--accent)]" onClick={() => router.push('/procurement/deliveries')}><div className="text-xs text-[var(--text-secondary)]">Pending receipts</div><div className="text-2xl font-bold mt-1" style={{ color: pendingReceipts.length ? 'var(--status-warning-text)' : 'var(--text-primary)' }}>{pendingReceipts.length}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Projects receiving</div><div className="text-2xl font-bold mt-1">{byProject.length}</div></Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <Card className="p-4">
              <div className="text-sm font-semibold text-[var(--text-primary)] mb-3">Receipts per month</div>
              <div style={{ width: '100%', height: 240 }}>
                <ResponsiveContainer>
                  {trend.length ? (
                    <BarChart data={trend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} />
                      <YAxis tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="count" fill="var(--status-success-text)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  ) : <div className="flex items-center justify-center h-full text-sm text-[var(--text-tertiary)]">No receipts yet</div>}
                </ResponsiveContainer>
              </div>
            </Card>
            <Card className="p-4">
              <div className="text-sm font-semibold text-[var(--text-primary)] mb-3">Receipts by project</div>
              <div style={{ width: '100%', height: 240 }}>
                <ResponsiveContainer>
                  <BarChart data={byProject} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} allowDecimals={false} />
                    <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }} />
                    <Tooltip />
                    <Bar dataKey="count" fill="var(--accent)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          <Card className="p-0 overflow-x-auto">
            <div className="p-3 text-sm font-semibold text-[var(--text-primary)] border-b border-[var(--border)]">Recent goods receipts</div>
            <table className="w-full text-sm">
              <thead><tr className="border-b border-[var(--border)] text-left text-[var(--text-tertiary)] text-xs">
                <th className="p-3">GRN</th><th className="p-3">PO</th><th className="p-3">Supplier</th><th className="p-3">Project</th><th className="p-3">Received</th><th className="p-3">Status</th>
              </tr></thead>
              <tbody>
                {grns.map(g => { const po = g.po_id ? poMap.get(g.po_id) : null; return (
                  <tr key={g.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-hover)] cursor-pointer" onClick={() => router.push(`/procurement/grn/${g.id}`)}>
                    <td className="p-3 font-medium text-[var(--text-primary)]">{g.grn_number}</td>
                    <td className="p-3 text-xs text-[var(--text-tertiary)]">{po?.po_number || '—'}</td>
                    <td className="p-3 text-xs text-[var(--text-secondary)]">{po?.supplier_name || '—'}</td>
                    <td className="p-3 text-xs text-[var(--text-tertiary)]">{g.project_id ? projectMap.get(g.project_id) || '—' : '—'}</td>
                    <td className="p-3 text-xs text-[var(--text-secondary)]">{g.received_at?.slice(0, 10) || '—'}</td>
                    <td className="p-3 text-xs">{g.status}</td>
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
