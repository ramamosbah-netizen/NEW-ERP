'use client';

// ============================================================
// JEET ERP — GRN-to-Expense Finance Report
// Received goods value vs. invoiced vs. paid, by project, for a
// chosen period. Surfaces uninvoiced receipts (accrued cost not
// yet billed) and outstanding payables in one view.
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import grnExpenseService, { ExpenseReport, ExpensePeriod } from '@/services/grnExpenseService';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { PackageCheck, Download, X, FileText } from 'lucide-react';

const PERIODS: { key: ExpensePeriod; label: string }[] = [
  { key: 'MONTH', label: 'This month' },
  { key: 'QUARTER', label: 'This quarter' },
  { key: 'YEAR', label: 'This year' },
  { key: 'ALL', label: 'All time' },
];

const money = (v: number) =>
  new Intl.NumberFormat('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v || 0);

export default function GRNExpenseReportPage() {
  const router = useRouter();
  const [period, setPeriod] = useState<ExpensePeriod>('YEAR');
  const [report, setReport] = useState<ExpenseReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setLoading(true); setReport(await grnExpenseService.getReport(period)); setError(null); }
    catch (err: any) { setError(err.message || 'Failed to load report'); }
    finally { setLoading(false); }
  }, [period]);
  useEffect(() => { load(); }, [load]);

  const exportCsv = () => {
    if (!report) return;
    const head = ['Project', 'Received Value', 'Invoiced', 'Paid', 'Outstanding', 'Uninvoiced'];
    const lines = report.rows.map(r => [
      r.project_number, r.received_value, r.invoiced_value, r.paid_value, r.outstanding, r.uninvoiced,
    ].join(','));
    const t = report.totals;
    lines.push(['TOTAL', t.received_value, t.invoiced_value, t.paid_value, t.outstanding, t.uninvoiced].join(','));
    const csv = [head.join(','), ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `grn-expense-${period.toLowerCase()}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const t = report?.totals;
  const kpis = t ? [
    { label: 'Received value', value: t.received_value, hint: 'Goods receipted (GRN)' },
    { label: 'Invoiced', value: t.invoiced_value, hint: 'Supplier invoices booked' },
    { label: 'Paid', value: t.paid_value, hint: 'Settled to suppliers' },
    { label: 'Outstanding', value: t.outstanding, hint: 'Invoiced not yet paid', warn: t.outstanding > 0 },
    { label: 'Uninvoiced', value: t.uninvoiced, hint: 'Received but not yet billed', accrue: t.uninvoiced > 0 },
  ] : [];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="GRN-to-Expense Report"
        subtitle="Received goods value reconciled against supplier invoicing and payment, by project"
        breadcrumbs={[{ label: 'Finance', href: '/finance' }, { label: 'GRN-to-Expense' }]}
        actions={
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => router.push('/procurement/grn/receivables')}>Receivables</Button>
            <Button size="sm" variant="primary" onClick={exportCsv} disabled={!report || report.rows.length === 0}>
              <Download size={14} /> Export CSV
            </Button>
          </div>
        }
      />

      {error && (
        <div className="flex items-center justify-between gap-3 bg-[var(--status-danger-bg)] border border-[var(--status-danger-border)] rounded-lg p-3 text-xs text-[var(--status-danger-text)]">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="cursor-pointer"><X size={13} /></button>
        </div>
      )}

      {/* Period selector */}
      <div className="flex gap-1.5">
        {PERIODS.map(p => (
          <button
            key={p.key}
            onClick={() => setPeriod(p.key)}
            className="px-3 py-1.5 rounded-md text-xs font-medium border transition-colors cursor-pointer"
            style={{
              background: period === p.key ? 'var(--accent)' : 'var(--surface)',
              color: period === p.key ? 'var(--accent-fg, #fff)' : 'var(--text-secondary)',
              borderColor: period === p.key ? 'var(--accent)' : 'var(--border)',
            }}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {kpis.map(k => (
          <Card key={k.label} className="p-3.5">
            <div className="text-[11px] uppercase tracking-wide text-[var(--text-tertiary)]">{k.label}</div>
            <div
              className="text-lg font-semibold mt-1 tabular-nums"
              style={{ color: (k as any).warn ? 'var(--status-warning-text)' : (k as any).accrue ? 'var(--status-info-text)' : 'var(--text-primary)' }}
            >
              {money(k.value)}<span className="text-xs font-normal text-[var(--text-tertiary)]"> AED</span>
            </div>
            <div className="text-[11px] text-[var(--text-tertiary)] mt-0.5">{k.hint}</div>
          </Card>
        ))}
      </div>

      {/* Per-project table */}
      <Card className="overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-[var(--text-tertiary)]">Loading…</div>
        ) : !report || report.rows.length === 0 ? (
          <EmptyState
            icon={PackageCheck}
            title="No receipts in this period"
            description="Goods receipts (GRNs) booked in the selected period will appear here, reconciled against supplier invoices."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[var(--border)] text-left text-[var(--text-tertiary)]">
                  <th className="px-4 py-2.5 font-medium">Project</th>
                  <th className="px-4 py-2.5 font-medium text-right">Received</th>
                  <th className="px-4 py-2.5 font-medium text-right">Invoiced</th>
                  <th className="px-4 py-2.5 font-medium text-right">Paid</th>
                  <th className="px-4 py-2.5 font-medium text-right">Outstanding</th>
                  <th className="px-4 py-2.5 font-medium text-right">Uninvoiced</th>
                </tr>
              </thead>
              <tbody>
                {report.rows.map(r => (
                  <tr key={r.project_id || 'none'} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-hover)]">
                    <td className="px-4 py-2.5 font-medium text-[var(--text-primary)]">
                      <span className="inline-flex items-center gap-1.5"><FileText size={12} className="text-[var(--text-tertiary)]" />{r.project_number}</span>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-[var(--text-primary)]">{money(r.received_value)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{money(r.invoiced_value)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-[var(--status-success-text)]">{money(r.paid_value)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums" style={{ color: r.outstanding > 0 ? 'var(--status-warning-text)' : 'var(--text-tertiary)' }}>{money(r.outstanding)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums" style={{ color: r.uninvoiced > 0.01 ? 'var(--status-info-text)' : 'var(--text-tertiary)' }}>{money(r.uninvoiced)}</td>
                  </tr>
                ))}
              </tbody>
              {t && (
                <tfoot>
                  <tr className="border-t-2 border-[var(--border)] font-semibold text-[var(--text-primary)]">
                    <td className="px-4 py-2.5">Total</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{money(t.received_value)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{money(t.invoiced_value)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{money(t.paid_value)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{money(t.outstanding)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{money(t.uninvoiced)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </Card>

      <p className="text-[11px] text-[var(--text-tertiary)] leading-relaxed">
        <strong>Received value</strong> = receipted quantity × PO unit price. <strong>Uninvoiced</strong> = received − invoiced
        (goods accrued as cost but not yet billed by the supplier). <strong>Outstanding</strong> = invoiced − paid.
        Invoices are matched to projects via the supplier-invoice ↔ LPO ↔ GRN three-way link.
      </p>
    </div>
  );
}
