'use client';

// ============================================================
// JEET ERP — AMC: Renewals Pipeline
// Contracts expiring 30/60/90 days, renewal value at risk, SIRA
// expiry. Read-only; plain query (no migration).
// ============================================================

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { exportTablePdf, exportTableExcel } from '@/lib/finance-export';
import { CalendarClock, FileDown, Sheet, RefreshCw } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from 'recharts';

const DAY = 86400000;
const aed = (n: number) => `AED ${Number(n || 0).toLocaleString('en-AE', { maximumFractionDigits: 0 })}`;

interface Ct { id: string; contract_number: string; client_name: string; site_name: string; status: string; annual_value: number; end_date: string; auto_renewal: boolean; sira_linked: boolean; sira_expiry_date: string | null; renewed_to_id: string | null; }

const BUCKETS = [
  { key: 'overdue', label: 'Expired', color: 'var(--status-danger-text)' },
  { key: '0-30', label: '≤30 days', color: 'var(--status-danger-text)' },
  { key: '31-60', label: '31–60 days', color: 'var(--status-warning-text)' },
  { key: '61-90', label: '61–90 days', color: 'var(--status-info-text)' },
];

export default function AmcPipelinePage() {
  const router = useRouter();
  const [contracts, setContracts] = useState<Ct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.from('amc_contracts')
          .select('id, contract_number, client_name, site_name, status, annual_value, end_date, auto_renewal, sira_linked, sira_expiry_date, renewed_to_id')
          .order('end_date', { ascending: true });
        setContracts((data || []) as Ct[]);
      } finally { setLoading(false); }
    })();
  }, []);

  const now = Date.now();
  const daysLeft = (d: string) => Math.ceil((new Date(d).getTime() - now) / DAY);
  const bucketOf = (d: string) => { const dl = daysLeft(d); if (dl < 0) return 'overdue'; if (dl <= 30) return '0-30'; if (dl <= 60) return '31-60'; if (dl <= 90) return '61-90'; return 'beyond'; };

  // pipeline = not terminated/renewed, within 90 days or expired
  const pipeline = useMemo(() => contracts.filter(c =>
    !c.renewed_to_id && c.status !== 'TERMINATED' && c.status !== 'RENEWED' && c.end_date && bucketOf(c.end_date) !== 'beyond'
  ).sort((a, b) => daysLeft(a.end_date) - daysLeft(b.end_date)), [contracts]);

  const valueAtRisk = pipeline.reduce((s, c) => s + Number(c.annual_value || 0), 0);
  const autoRenew = pipeline.filter(c => c.auto_renewal).length;
  const expired = pipeline.filter(c => bucketOf(c.end_date) === 'overdue').length;
  const siraExpiring = contracts.filter(c => c.sira_linked && c.sira_expiry_date && daysLeft(c.sira_expiry_date) <= 90 && daysLeft(c.sira_expiry_date) >= -3650).length;

  const byBucket = BUCKETS.map(b => ({ name: b.label, color: b.color, count: pipeline.filter(c => bucketOf(c.end_date) === b.key).length, value: Math.round(pipeline.filter(c => bucketOf(c.end_date) === b.key).reduce((s, c) => s + Number(c.annual_value || 0), 0)) }));

  const exportCols = ['Contract', 'Client', 'Site', 'End date', 'Days left', 'Annual value', 'Auto-renew', 'SIRA expiry', 'Status'];
  const exportRows = pipeline.map(c => [c.contract_number, c.client_name, c.site_name, c.end_date, daysLeft(c.end_date), c.annual_value, c.auto_renewal ? 'Yes' : 'No', c.sira_expiry_date || '', c.status]);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="AMC Renewals Pipeline"
        subtitle="Contracts expiring within 90 days, renewal value at risk and SIRA expiry"
        breadcrumbs={[{ label: 'AMC', href: '/amc' }, { label: 'Renewals Pipeline' }]}
        actions={
          <div className="flex gap-2">
            {pipeline.length > 0 && <>
              <Button variant="secondary" icon={FileDown} onClick={() => exportTablePdf({ title: 'AMC Renewals Pipeline', columns: exportCols, rows: exportRows, fileName: 'amc-renewals-pipeline' })}>PDF</Button>
              <Button variant="secondary" icon={Sheet} onClick={() => exportTableExcel({ title: 'AMC Renewals Pipeline', columns: exportCols, rows: exportRows, fileName: 'amc-renewals-pipeline' })}>Excel</Button>
            </>}
            <Button variant="secondary" icon={RefreshCw} onClick={() => router.push('/amc/renewal')}>Renewal workspace</Button>
          </div>
        }
      />

      {loading ? (
        <Card><div className="p-8 text-center text-sm text-[var(--text-tertiary)]">Loading…</div></Card>
      ) : pipeline.length === 0 ? (
        <Card><EmptyState icon={CalendarClock} title="No renewals due" description="No active contracts are expiring within 90 days." /></Card>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">In pipeline (≤90d)</div><div className="text-2xl font-bold mt-1">{pipeline.length}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Value at risk</div><div className="text-xl font-bold mt-1" style={{ color: 'var(--status-warning-text)' }}>{aed(valueAtRisk)}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Already expired</div><div className="text-2xl font-bold mt-1" style={{ color: expired ? 'var(--status-danger-text)' : 'var(--text-primary)' }}>{expired}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Auto-renew</div><div className="text-2xl font-bold mt-1">{autoRenew}</div></Card>
          </div>

          <Card className="p-4">
            <div className="text-sm font-semibold text-[var(--text-primary)] mb-3">Renewal value by window</div>
            <div style={{ width: '100%', height: 240 }}>
              <ResponsiveContainer>
                <BarChart data={byBucket}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: any) => aed(v)} />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>{byBucket.map((b, i) => <Cell key={i} fill={b.color} />)}</Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-[var(--border)] text-left text-[var(--text-tertiary)] text-xs">
                <th className="p-3">Contract</th><th className="p-3">Client / site</th><th className="p-3">End date</th><th className="p-3 text-right">Days left</th>
                <th className="p-3 text-right">Annual value</th><th className="p-3">Auto-renew</th><th className="p-3">SIRA expiry</th>
              </tr></thead>
              <tbody>
                {pipeline.map(c => { const dl = daysLeft(c.end_date); const od = dl < 0; const siraDl = c.sira_expiry_date ? daysLeft(c.sira_expiry_date) : null; return (
                  <tr key={c.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-hover)] cursor-pointer" onClick={() => router.push(`/amc/${c.id}`)}>
                    <td className="p-3 font-medium text-[var(--text-primary)]">{c.contract_number}</td>
                    <td className="p-3 text-xs text-[var(--text-secondary)]">{c.client_name}<div className="text-[10px] text-[var(--text-tertiary)]">{c.site_name}</div></td>
                    <td className="p-3 text-xs text-[var(--text-secondary)]">{c.end_date}</td>
                    <td className="p-3 text-right tabular-nums font-medium" style={{ color: od ? 'var(--status-danger-text)' : dl <= 30 ? 'var(--status-danger-text)' : dl <= 60 ? 'var(--status-warning-text)' : 'var(--text-secondary)' }}>{od ? `${Math.abs(dl)}d ago` : `${dl}d`}</td>
                    <td className="p-3 text-right tabular-nums">{aed(c.annual_value)}</td>
                    <td className="p-3 text-xs">{c.auto_renewal ? <span style={{ color: 'var(--status-success-text)' }}>Auto</span> : 'Manual'}</td>
                    <td className="p-3 text-xs" style={{ color: siraDl !== null && siraDl <= 90 ? 'var(--status-warning-text)' : 'var(--text-tertiary)' }}>{c.sira_linked ? (c.sira_expiry_date || '—') : '—'}</td>
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
