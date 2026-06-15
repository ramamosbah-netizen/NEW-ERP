'use client';

// ============================================================
// JEET ERP — Procurement: Spend Analysis
// Committed PO spend by supplier / project / type / month.
// Read-only; plain query + batched project lookup (no migration).
// ============================================================

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { exportTablePdf, exportTableExcel } from '@/lib/finance-export';
import { Coins, FileDown, Sheet } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, LineChart, Line } from 'recharts';

const aed = (n: number) => `AED ${Number(n || 0).toLocaleString('en-AE', { maximumFractionDigits: 0 })}`;
const COMMITTED = ['APPROVED', 'SENT', 'ACKNOWLEDGED', 'PARTIALLY_DELIVERED', 'DELIVERED', 'CLOSED'];

interface Po { supplier_id: string | null; supplier_name: string | null; project_id: string | null; total: number; status: string; created_at: string; po_type: string | null; }

export default function SpendAnalysisPage() {
  const [pos, setPos] = useState<Po[]>([]);
  const [projectMap, setProjectMap] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [scope, setScope] = useState<'committed' | 'all'>('committed');

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.from('purchase_orders').select('supplier_id, supplier_name, project_id, total, status, created_at, po_type');
        const rows = (data || []) as Po[];
        setPos(rows);
        const pids = [...new Set(rows.map(r => r.project_id).filter(Boolean))] as string[];
        if (pids.length) { const { data: ps } = await supabase.from('projects').select('id, project_number, name').in('id', pids); setProjectMap(new Map((ps || []).map((p: any) => [p.id, `${p.project_number} — ${p.name}`]))); }
      } finally { setLoading(false); }
    })();
  }, []);

  const rows = useMemo(() => scope === 'committed' ? pos.filter(p => COMMITTED.includes(p.status)) : pos.filter(p => p.status !== 'CANCELLED'), [pos, scope]);
  const total = rows.reduce((s, p) => s + Number(p.total || 0), 0);
  const avg = rows.length ? total / rows.length : 0;

  const group = (keyFn: (p: Po) => string, top = 8) => {
    const m = new Map<string, number>();
    rows.forEach(p => { const k = keyFn(p) || '—'; m.set(k, (m.get(k) || 0) + Number(p.total || 0)); });
    return [...m.entries()].map(([name, value]) => ({ name, value: Math.round(value) })).sort((a, b) => b.value - a.value).slice(0, top);
  };
  const bySupplier = useMemo(() => group(p => p.supplier_name || 'Unknown'), [rows]);
  const byProject = useMemo(() => group(p => p.project_id ? (projectMap.get(p.project_id)?.split(' — ')[0] || 'Project') : 'Unassigned'), [rows, projectMap]);
  const byType = useMemo(() => group(p => p.po_type || 'Standard', 6), [rows]);
  const trend = useMemo(() => {
    const m = new Map<string, number>();
    rows.forEach(p => { if (!p.created_at) return; const d = new Date(p.created_at); const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; m.set(k, (m.get(k) || 0) + Number(p.total || 0)); });
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-6).map(([k, v]) => ({ month: k.slice(2), value: Math.round(v) }));
  }, [rows]);

  const supplierTable = useMemo(() => {
    const m = new Map<string, { count: number; value: number }>();
    rows.forEach(p => { const k = p.supplier_name || 'Unknown'; const e = m.get(k) || { count: 0, value: 0 }; e.count++; e.value += Number(p.total || 0); m.set(k, e); });
    return [...m.entries()].map(([name, v]) => ({ name, ...v })).sort((a, b) => b.value - a.value);
  }, [rows]);

  const exportCols = ['Supplier', 'POs', 'Spend', '% of total'];
  const exportRows = supplierTable.map(s => [s.name, s.count, Math.round(s.value), total ? `${Math.round(s.value / total * 100)}%` : '0%']);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Spend Analysis"
        subtitle="Purchase-order spend by supplier, project, type and month"
        breadcrumbs={[{ label: 'Procurement', href: '/procurement/dashboard' }, { label: 'Spend' }]}
        actions={rows.length > 0 ? (
          <div className="flex gap-2">
            <Button variant="secondary" icon={FileDown} onClick={() => exportTablePdf({ title: 'Procurement Spend by Supplier', columns: exportCols, rows: exportRows, fileName: 'procurement-spend' })}>PDF</Button>
            <Button variant="secondary" icon={Sheet} onClick={() => exportTableExcel({ title: 'Procurement Spend by Supplier', columns: exportCols, rows: exportRows, fileName: 'procurement-spend' })}>Excel</Button>
          </div>
        ) : undefined}
      />

      <Card className="p-4">
        <label className="text-xs font-medium text-[var(--text-secondary)]">Scope</label>
        <select value={scope} onChange={e => setScope(e.target.value as any)} className="w-full md:max-w-xs mt-1 px-3 h-10 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm">
          <option value="committed">Committed POs (approved+)</option><option value="all">All non-cancelled POs</option>
        </select>
      </Card>

      {loading ? (
        <Card><div className="p-8 text-center text-sm text-[var(--text-tertiary)]">Loading…</div></Card>
      ) : rows.length === 0 ? (
        <Card><EmptyState icon={Coins} title="No spend" description="Purchase orders will be analysed here." /></Card>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Total spend</div><div className="text-xl font-bold mt-1">{aed(total)}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Purchase orders</div><div className="text-2xl font-bold mt-1">{rows.length}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Avg PO value</div><div className="text-lg font-bold mt-1">{aed(avg)}</div></Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <Card className="p-4">
              <div className="text-sm font-semibold text-[var(--text-primary)] mb-3">Spend by supplier (top 8)</div>
              <div style={{ width: '100%', height: 240 }}>
                <ResponsiveContainer>
                  <BarChart data={bySupplier} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }} />
                    <Tooltip formatter={(v: any) => aed(v)} />
                    <Bar dataKey="value" fill="var(--accent)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card className="p-4">
              <div className="text-sm font-semibold text-[var(--text-primary)] mb-3">Spend by project (top 8)</div>
              <div style={{ width: '100%', height: 240 }}>
                <ResponsiveContainer>
                  <BarChart data={byProject} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }} />
                    <Tooltip formatter={(v: any) => aed(v)} />
                    <Bar dataKey="value" fill="var(--status-info-text)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card className="p-4 lg:col-span-2">
              <div className="text-sm font-semibold text-[var(--text-primary)] mb-3">Monthly spend trend</div>
              <div style={{ width: '100%', height: 220 }}>
                <ResponsiveContainer>
                  <LineChart data={trend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} />
                    <YAxis tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v: any) => aed(v)} />
                    <Line dataKey="value" stroke="var(--accent)" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          <Card className="p-0 overflow-x-auto">
            <div className="p-3 text-sm font-semibold text-[var(--text-primary)] border-b border-[var(--border)]">Supplier spend</div>
            <table className="w-full text-sm">
              <thead><tr className="border-b border-[var(--border)] text-left text-[var(--text-tertiary)] text-xs"><th className="p-3">Supplier</th><th className="p-3 text-right">POs</th><th className="p-3 text-right">Spend</th><th className="p-3 text-right">% of total</th></tr></thead>
              <tbody>
                {supplierTable.map((s, i) => (
                  <tr key={i} className="border-b border-[var(--border)] last:border-0">
                    <td className="p-3 font-medium text-[var(--text-primary)]">{s.name}</td>
                    <td className="p-3 text-right tabular-nums">{s.count}</td>
                    <td className="p-3 text-right tabular-nums font-medium">{aed(s.value)}</td>
                    <td className="p-3 text-right tabular-nums text-[var(--text-secondary)]">{total ? Math.round(s.value / total * 100) : 0}%</td>
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
