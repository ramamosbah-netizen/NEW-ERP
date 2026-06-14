'use client';

// ============================================================
// JEET ERP — Finance: Retention Management (Page 5)
// Client-side retention receivable from project_retention_ledger.
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';
import retentionService, { RetentionRow } from '@/services/retentionService';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ShieldCheck, AlertTriangle } from 'lucide-react';

const money = (v: number) => new Intl.NumberFormat('en-AE', { maximumFractionDigits: 0 }).format(v || 0);
const fmtDate = (d?: string | null) => d ? new Date(d).toLocaleDateString('en-AE', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const STATUS: Record<string, { label: string; bg: string; text: string }> = {
  RELEASED: { label: 'Released', bg: 'var(--status-success-bg)', text: 'var(--status-success-text)' },
  OVERDUE: { label: 'Overdue', bg: 'var(--status-danger-bg)', text: 'var(--status-danger-text)' },
  DUE: { label: 'Due this month', bg: 'var(--status-warning-bg)', text: 'var(--status-warning-text)' },
  SCHEDULED: { label: 'Scheduled', bg: 'var(--status-neutral-bg)', text: 'var(--status-neutral-text)' },
};

export default function RetentionsPage() {
  const [rows, setRows] = useState<RetentionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setLoading(true); setRows(await retentionService.list()); setError(null); }
    catch (e: any) { setError(e.message || 'Failed to load retentions'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const open = rows.filter(r => r.status !== 'RELEASED');
  const totalHeld = open.reduce((s, r) => s + r.net, 0);
  const dueThisMonth = open.filter(r => r.status === 'DUE').reduce((s, r) => s + r.net, 0);
  const overdue = open.filter(r => r.status === 'OVERDUE').reduce((s, r) => s + r.net, 0);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Retention Management"
        subtitle="Retention receivable held on client invoices — release schedule and forecast"
        breadcrumbs={[{ label: 'Finance', href: '/finance' }, { label: 'Retentions' }]}
      />

      {error && <div className="bg-[var(--status-danger-bg)] border border-[var(--status-danger-border)] rounded-lg p-3 text-xs text-[var(--status-danger-text)]">{error}</div>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card className="p-3.5"><div className="text-[11px] uppercase tracking-wide text-[var(--text-tertiary)]">Total retention held</div><div className="text-lg font-semibold mt-1 tabular-nums">{money(totalHeld)} AED</div></Card>
        <Card className="p-3.5"><div className="text-[11px] uppercase tracking-wide text-[var(--text-tertiary)]">Due this month</div><div className="text-lg font-semibold mt-1 tabular-nums" style={{ color: dueThisMonth > 0 ? 'var(--status-warning-text)' : 'var(--text-primary)' }}>{money(dueThisMonth)} AED</div></Card>
        <Card className="p-3.5"><div className="text-[11px] uppercase tracking-wide text-[var(--text-tertiary)]">Overdue retention</div><div className="text-lg font-semibold mt-1 tabular-nums" style={{ color: overdue > 0 ? 'var(--status-danger-text)' : 'var(--text-primary)' }}>{money(overdue)} AED</div></Card>
      </div>

      <Card className="overflow-hidden">
        {loading ? <div className="p-8 text-center text-sm text-[var(--text-tertiary)]">Loading…</div>
          : rows.length === 0 ? <EmptyState icon={ShieldCheck} title="No retention held" description="Retention held on approved client invoices appears here with its release schedule." />
          : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead><tr className="border-b border-[var(--border)] text-left text-[var(--text-tertiary)]">
                  <th className="px-4 py-2.5 font-medium">Invoice</th><th className="px-4 py-2.5 font-medium">Project</th><th className="px-4 py-2.5 font-medium">Client</th>
                  <th className="px-4 py-2.5 font-medium text-right">Held</th><th className="px-4 py-2.5 font-medium text-right">Released</th><th className="px-4 py-2.5 font-medium text-right">Net</th>
                  <th className="px-4 py-2.5 font-medium">Expected release</th><th className="px-4 py-2.5 font-medium">Status</th>
                </tr></thead>
                <tbody>
                  {rows.map(r => {
                    const st = STATUS[r.status];
                    return (
                      <tr key={r.invoice_id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-hover)]">
                        <td className="px-4 py-2.5 font-mono text-[var(--text-primary)]">{r.invoice_number}</td>
                        <td className="px-4 py-2.5">{r.project_number}</td>
                        <td className="px-4 py-2.5 text-[var(--text-secondary)]">{r.client_name}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{money(r.held)}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-[var(--status-success-text)]">{money(r.released)}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums font-medium">{money(r.net)}</td>
                        <td className="px-4 py-2.5">{r.status === 'OVERDUE' && <AlertTriangle size={11} className="inline mr-1 text-[var(--status-danger-text)]" />}{fmtDate(r.expected_release_date)}</td>
                        <td className="px-4 py-2.5"><span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: st.bg, color: st.text }}>{st.label}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot><tr className="border-t-2 border-[var(--border)] font-semibold"><td className="px-4 py-2.5" colSpan={5}>Net retention held</td><td className="px-4 py-2.5 text-right tabular-nums">{money(totalHeld)}</td><td colSpan={2}></td></tr></tfoot>
              </table>
            </div>
          )}
      </Card>

      <p className="text-[11px] text-[var(--text-tertiary)]">Shows retention <strong>receivable</strong> (held by clients on our invoices), from the retention ledger. Retention <strong>payable</strong> (withheld from subcontractors) is a future addition.</p>
    </div>
  );
}
