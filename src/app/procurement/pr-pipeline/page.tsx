'use client';

// ============================================================
// JEET ERP — Procurement: PR Pipeline & Cycle Time
// Purchase-request status funnel, approval turnaround and
// conversion to PO. Read-only; plain query (no migration).
// ============================================================

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { exportTablePdf, exportTableExcel } from '@/lib/finance-export';
import { ClipboardList, FileDown, Sheet } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

const DAY = 86400000;
const aed = (n: number) => `AED ${Number(n || 0).toLocaleString('en-AE', { maximumFractionDigits: 0 })}`;
const PENDING = ['DRAFT', 'SUBMITTED', 'PENDING_APPROVAL'];

interface Pr { id: string; pr_number: string; status: string; category: string | null; estimated_total: number; created_at: string; approved_at: string | null; converted_po_id: string | null; converted_at: string | null; is_direct_purchase: boolean; }

export default function PrPipelinePage() {
  const router = useRouter();
  const [prs, setPrs] = useState<Pr[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from('purchase_requests').select('id, pr_number, status, category, estimated_total, created_at, approved_at, converted_po_id, converted_at, is_direct_purchase').order('created_at', { ascending: false })
      .then(({ data }) => setPrs((data || []) as Pr[])).then(() => setLoading(false), () => setLoading(false));
  }, []);

  const now = Date.now();
  const pending = prs.filter(p => PENDING.includes(p.status));
  const approved = prs.filter(p => !!p.approved_at);
  const converted = prs.filter(p => !!p.converted_po_id || p.is_direct_purchase);
  const conversionRate = prs.length ? Math.round(converted.length / prs.length * 100) : 0;

  const approvalTimes = approved.filter(p => p.created_at && p.approved_at).map(p => (new Date(p.approved_at!).getTime() - new Date(p.created_at).getTime()) / DAY);
  const avgApproval = approvalTimes.length ? Math.round(approvalTimes.reduce((s, d) => s + d, 0) / approvalTimes.length * 10) / 10 : 0;

  const byStatus = useMemo(() => [...new Set(prs.map(p => p.status))].map(s => ({ name: s.replace(/_/g, ' '), value: prs.filter(p => p.status === s).length })).filter(d => d.value > 0), [prs]);
  const byCategory = useMemo(() => { const m = new Map<string, number>(); prs.forEach(p => m.set(p.category || 'Uncategorised', (m.get(p.category || 'Uncategorised') || 0) + 1)); return [...m.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 8); }, [prs]);

  const exportCols = ['PR', 'Status', 'Category', 'Est. total', 'Raised', 'Approval days', 'Converted'];
  const exportRows = prs.map(p => [p.pr_number, p.status, p.category || '', p.estimated_total, p.created_at?.slice(0, 10) || '', p.approved_at && p.created_at ? Math.round((new Date(p.approved_at).getTime() - new Date(p.created_at).getTime()) / DAY) : '', (p.converted_po_id || p.is_direct_purchase) ? 'Yes' : '']);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="PR Pipeline & Cycle Time"
        subtitle="Purchase-request status, approval turnaround and conversion to PO"
        breadcrumbs={[{ label: 'Procurement', href: '/procurement/dashboard' }, { label: 'PR Pipeline' }]}
        actions={prs.length > 0 ? (
          <div className="flex gap-2">
            <Button variant="secondary" icon={FileDown} onClick={() => exportTablePdf({ title: 'PR Pipeline', columns: exportCols, rows: exportRows, fileName: 'pr-pipeline' })}>PDF</Button>
            <Button variant="secondary" icon={Sheet} onClick={() => exportTableExcel({ title: 'PR Pipeline', columns: exportCols, rows: exportRows, fileName: 'pr-pipeline' })}>Excel</Button>
          </div>
        ) : undefined}
      />

      {loading ? (
        <Card><div className="p-8 text-center text-sm text-[var(--text-tertiary)]">Loading…</div></Card>
      ) : prs.length === 0 ? (
        <Card><EmptyState icon={ClipboardList} title="No purchase requests" description="Purchase requests will be analysed here." /></Card>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Total PRs</div><div className="text-2xl font-bold mt-1">{prs.length}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Pending</div><div className="text-2xl font-bold mt-1" style={{ color: pending.length ? 'var(--status-warning-text)' : 'var(--text-primary)' }}>{pending.length}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Converted to PO</div><div className="text-2xl font-bold mt-1">{converted.length}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Conversion rate</div><div className="text-2xl font-bold mt-1">{conversionRate}%</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Avg approval time</div><div className="text-2xl font-bold mt-1">{avgApproval}<span className="text-sm font-normal text-[var(--text-tertiary)]">d</span></div></Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <Card className="p-4">
              <div className="text-sm font-semibold text-[var(--text-primary)] mb-3">PRs by status</div>
              <div style={{ width: '100%', height: 240 }}>
                <ResponsiveContainer>
                  <BarChart data={byStatus}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }} />
                    <YAxis tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="value" fill="var(--accent)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card className="p-4">
              <div className="text-sm font-semibold text-[var(--text-primary)] mb-3">PRs by category</div>
              <div style={{ width: '100%', height: 240 }}>
                <ResponsiveContainer>
                  <BarChart data={byCategory} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} allowDecimals={false} />
                    <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }} />
                    <Tooltip />
                    <Bar dataKey="value" fill="var(--status-info-text)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          <Card className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-[var(--border)] text-left text-[var(--text-tertiary)] text-xs">
                <th className="p-3">PR</th><th className="p-3">Status</th><th className="p-3">Category</th><th className="p-3 text-right">Est. total</th><th className="p-3 text-right">Approval</th><th className="p-3">Converted</th>
              </tr></thead>
              <tbody>
                {prs.map(p => { const at = p.approved_at && p.created_at ? Math.round((new Date(p.approved_at).getTime() - new Date(p.created_at).getTime()) / DAY) : null; return (
                  <tr key={p.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-hover)] cursor-pointer" onClick={() => router.push(`/procurement/pr/${p.id}`)}>
                    <td className="p-3 font-medium text-[var(--text-primary)]">{p.pr_number}</td>
                    <td className="p-3 text-xs">{p.status.replace(/_/g, ' ')}</td>
                    <td className="p-3 text-xs text-[var(--text-secondary)]">{p.category || '—'}</td>
                    <td className="p-3 text-right tabular-nums">{aed(p.estimated_total)}</td>
                    <td className="p-3 text-right text-xs text-[var(--text-secondary)]">{at !== null ? `${at}d` : '—'}</td>
                    <td className="p-3 text-xs">{(p.converted_po_id || p.is_direct_purchase) ? <span style={{ color: 'var(--status-success-text)' }}>Yes</span> : '—'}</td>
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
