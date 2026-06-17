'use client';

// ============================================================
// Aura ERP — General Ledger / Trial Balance
// Reads the POSTED double-entry ledger: trial balance, period close,
// and any auto-post DRAFTs that need finance review.
// ============================================================

import { useMemo } from 'react';
import { AlertTriangle, Lock, Unlock, BookOpen } from 'lucide-react';
import { PageHeader, KPICard } from '@/components/ui';
import { useTrialBalance, useAccountingPeriods, useDraftEntries, usePeriodActions } from '@/hooks/useLedger';
import type { AccountType } from '@/services/glService';

const aed = (v: number) =>
  new Intl.NumberFormat('en-AE', { style: 'currency', currency: 'AED', maximumFractionDigits: 2 }).format(v || 0);

export default function LedgerPage() {
  const { data: tb = [], isPending: tbLoading, error: tbError } = useTrialBalance();
  const { data: periods = [] } = useAccountingPeriods();
  const { data: drafts = [] } = useDraftEntries();
  const { close, reopen } = usePeriodActions();

  const totals = useMemo(() => {
    const sumByType = (t: AccountType, pick: (r: { debit: number; credit: number }) => number) =>
      tb.filter(r => r.type === t).reduce((s, r) => s + pick(r), 0);
    const revenue = sumByType('REVENUE', r => r.credit - r.debit);
    const expense = sumByType('EXPENSE', r => r.debit - r.credit);
    const debits = tb.reduce((s, r) => s + r.debit, 0);
    const credits = tb.reduce((s, r) => s + r.credit, 0);
    return { revenue, expense, netIncome: revenue - expense, debits, credits, outOfBalance: debits - credits };
  }, [tb]);

  return (
    <div className="p-6 max-w-[1200px] mx-auto">
      <PageHeader
        title="General Ledger"
        subtitle="Trial balance and statements from the posted double-entry ledger."
        breadcrumbs={[{ label: 'Finance', href: '/finance' }, { label: 'General Ledger' }]}
      />

      {/* Drafts that failed to auto-post */}
      {drafts.length > 0 && (
        <div className="mb-5 flex items-center gap-3 rounded-lg border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] p-3 text-sm text-[var(--status-warning-text)]">
          <AlertTriangle size={18} />
          <span>
            {drafts.length} journal {drafts.length === 1 ? 'entry' : 'entries'} could not auto-post and {drafts.length === 1 ? 'is' : 'are'} held as DRAFT for review.
          </span>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <KPICard title="Total Debits" value={aed(totals.debits)} icon={BookOpen} />
        <KPICard title="Total Credits" value={aed(totals.credits)} />
        <KPICard
          title="Net Income"
          value={aed(totals.netIncome)}
          trend={totals.netIncome >= 0 ? 'up' : 'down'}
          borderAccent={totals.netIncome >= 0 ? 'success' : 'danger'}
        />
        <KPICard
          title="Out of Balance"
          value={aed(totals.outOfBalance)}
          borderAccent={Math.abs(totals.outOfBalance) < 0.01 ? 'success' : 'danger'}
          changeText={Math.abs(totals.outOfBalance) < 0.01 ? 'Balanced' : 'Review required'}
        />
      </div>

      {/* Trial balance */}
      <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] overflow-hidden mb-6">
        <div className="px-4 py-3 border-b border-[var(--border-color)] font-semibold text-sm text-[var(--text-primary)]">
          Trial Balance
        </div>
        {tbError ? (
          <div className="p-4 text-sm text-[var(--status-danger-text)]">Failed to load: {(tbError as Error).message}</div>
        ) : tbLoading ? (
          <div className="p-4 text-sm text-[var(--text-muted)]">Loading…</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-[var(--text-muted)] border-b border-[var(--border-color)]">
                  <th className="px-4 py-2 font-medium">Code</th>
                  <th className="px-4 py-2 font-medium">Account</th>
                  <th className="px-4 py-2 font-medium">Type</th>
                  <th className="px-4 py-2 font-medium text-right">Debit</th>
                  <th className="px-4 py-2 font-medium text-right">Credit</th>
                  <th className="px-4 py-2 font-medium text-right">Balance</th>
                </tr>
              </thead>
              <tbody>
                {tb.filter(r => r.debit !== 0 || r.credit !== 0).map(r => (
                  <tr key={r.code} className="border-b border-[var(--border-color)] last:border-0">
                    <td className="px-4 py-2 font-mono text-xs text-[var(--text-muted)]">{r.code}</td>
                    <td className="px-4 py-2 text-[var(--text-primary)]">{r.name}</td>
                    <td className="px-4 py-2 text-xs text-[var(--text-muted)]">{r.type}</td>
                    <td className="px-4 py-2 text-right font-mono">{r.debit ? aed(r.debit) : '—'}</td>
                    <td className="px-4 py-2 text-right font-mono">{r.credit ? aed(r.credit) : '—'}</td>
                    <td className="px-4 py-2 text-right font-mono">{aed(r.balance)}</td>
                  </tr>
                ))}
                {tb.every(r => r.debit === 0 && r.credit === 0) && (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-sm text-[var(--text-muted)]">
                      No posted entries yet. Apply the auto-post + backfill migrations to populate the ledger.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Accounting periods */}
      <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] overflow-hidden">
        <div className="px-4 py-3 border-b border-[var(--border-color)] font-semibold text-sm text-[var(--text-primary)]">
          Accounting Periods
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-[var(--text-muted)] border-b border-[var(--border-color)]">
                <th className="px-4 py-2 font-medium">Period</th>
                <th className="px-4 py-2 font-medium">Range</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {periods.map(p => (
                <tr key={p.code} className="border-b border-[var(--border-color)] last:border-0">
                  <td className="px-4 py-2 font-mono text-xs">{p.code}</td>
                  <td className="px-4 py-2 text-xs text-[var(--text-muted)]">{p.start_date} → {p.end_date}</td>
                  <td className="px-4 py-2">
                    <span className={`text-xs font-medium ${p.status === 'OPEN' ? 'text-[var(--success)]' : 'text-[var(--text-muted)]'}`}>
                      {p.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right">
                    {p.status === 'OPEN' ? (
                      <button
                        onClick={() => close.mutate(p.code)}
                        disabled={close.isPending}
                        className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded border border-[var(--border-color)] hover:bg-[var(--surface-hover)] transition-colors disabled:opacity-50"
                      >
                        <Lock size={12} /> Close
                      </button>
                    ) : p.status === 'CLOSED' ? (
                      <button
                        onClick={() => reopen.mutate(p.code)}
                        disabled={reopen.isPending}
                        className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded border border-[var(--border-color)] hover:bg-[var(--surface-hover)] transition-colors disabled:opacity-50"
                      >
                        <Unlock size={12} /> Reopen
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
              {periods.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-sm text-[var(--text-muted)]">No periods.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
