'use client';

// ============================================================
// JEET ERP — Finance: Financial Reports (Page 10)
// P&L, Trial Balance, General Ledger, Cost/Revenue by project,
// + links to AR/AP aging. CSV export per report.
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import financialReportsService, { PLRow, TBRow, ProjectAmountRow } from '@/services/financialReportsService';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Download, FileText, FileSpreadsheet } from 'lucide-react';
import { exportTablePdf, exportTableExcel, exportTableCsv, ExportTable } from '@/lib/finance-export';

const money = (v: number) => new Intl.NumberFormat('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v || 0);
type Report = 'PL' | 'TB' | 'GL' | 'COST_PROJ' | 'REV_PROJ';
const TABS: { k: Report; l: string }[] = [
  { k: 'PL', l: 'Profit & Loss' }, { k: 'TB', l: 'Trial Balance' }, { k: 'GL', l: 'General Ledger' },
  { k: 'COST_PROJ', l: 'Cost by Project' }, { k: 'REV_PROJ', l: 'Revenue by Project' },
];

export default function FinancialReportsPage() {
  const now = new Date();
  const [tab, setTab] = useState<Report>('PL');
  const [start, setStart] = useState(new Date(now.getFullYear(), 0, 1).toISOString().slice(0, 10));
  const [end, setEnd] = useState(now.toISOString().slice(0, 10));
  const [loading, setLoading] = useState(false);
  const [pl, setPl] = useState<{ rows: PLRow[]; netProfit: number } | null>(null);
  const [tb, setTb] = useState<TBRow[]>([]);
  const [gl, setGl] = useState<any[]>([]);
  const [proj, setProj] = useState<ProjectAmountRow[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (tab === 'PL') setPl(await financialReportsService.profitAndLoss(start, end));
      else if (tab === 'TB') setTb(await financialReportsService.trialBalance(start, end));
      else if (tab === 'GL') setGl(await financialReportsService.generalLedger(start, end));
      else setProj(await financialReportsService.byProject(start, end, tab === 'COST_PROJ' ? 'COST' : 'REVENUE'));
    } finally { setLoading(false); }
  }, [tab, start, end]);
  useEffect(() => { load(); }, [load]);

  const currentTable = (): ExportTable => {
    const label = TABS.find(t => t.k === tab)?.l || 'Report';
    const meta = { title: `${label} — ${start} to ${end}`, subtitle: 'JEET INTECH L.L.C', fileName: `${label}_${start}_${end}` };
    if (tab === 'PL' && pl) return { ...meta, columns: ['Line', 'Amount (AED)'], rows: pl.rows.map(r => [r.label, r.amount]) };
    if (tab === 'TB') return { ...meta, columns: ['Code', 'Account', 'Debit', 'Credit', 'Balance'], rows: tb.map(r => [r.account_code, r.account_name, r.debit, r.credit, r.balance]) };
    if (tab === 'GL') return { ...meta, columns: ['Date', 'Reference', 'Account', 'Description', 'Debit', 'Credit'], rows: gl.map((l: any) => [l.date, l.reference, `${l.account_code} ${l.account_name}`, l.description, l.debit, l.credit]) };
    return { ...meta, columns: ['Project', 'Name', 'Amount (AED)'], rows: proj.map(r => [r.project_number, r.project_name, r.amount]) };
  };

  const tbTotals = tb.reduce((a, r) => ({ d: a.d + r.debit, c: a.c + r.credit }), { d: 0, c: 0 });
  const projTotal = proj.reduce((s, r) => s + r.amount, 0);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Financial Reports"
        subtitle="P&L, Trial Balance, General Ledger, cost & revenue by project — period-based, exportable"
        breadcrumbs={[{ label: 'Finance', href: '/finance' }, { label: 'Reports' }]}
        actions={
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" icon={FileText} onClick={() => exportTablePdf(currentTable())}>PDF</Button>
            <Button size="sm" variant="secondary" icon={FileSpreadsheet} onClick={() => exportTableExcel(currentTable())}>Excel</Button>
            <Button size="sm" variant="secondary" icon={Download} onClick={() => exportTableCsv(currentTable())}>CSV</Button>
          </div>
        }
      />

      <div className="flex flex-wrap gap-2 items-center">
        <div className="flex gap-1.5 flex-wrap">
          {TABS.map(t => (
            <button key={t.k} onClick={() => setTab(t.k)} className="px-3 py-1.5 rounded-md text-xs font-medium border cursor-pointer"
              style={{ background: tab === t.k ? 'var(--accent)' : 'var(--surface)', color: tab === t.k ? 'var(--accent-fg,#fff)' : 'var(--text-secondary)', borderColor: tab === t.k ? 'var(--accent)' : 'var(--border)' }}>{t.l}</button>
          ))}
        </div>
        <div className="flex gap-2 items-center ml-auto text-xs">
          <input type="date" value={start} onChange={e => setStart(e.target.value)} className="px-2 h-8 rounded-md border border-[var(--border)] bg-[var(--surface)]" />
          <span className="text-[var(--text-tertiary)]">→</span>
          <input type="date" value={end} onChange={e => setEnd(e.target.value)} className="px-2 h-8 rounded-md border border-[var(--border)] bg-[var(--surface)]" />
        </div>
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        <Link href="/finance/ar/aging" className="px-3 py-1.5 rounded-md border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]">Receivable Aging →</Link>
        <Link href="/finance/ap/aging" className="px-3 py-1.5 rounded-md border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]">Payable Aging →</Link>
        <Link href="/finance/cashflow" className="px-3 py-1.5 rounded-md border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]">Cash Flow Statement →</Link>
      </div>

      <Card className="overflow-hidden">
        {loading ? <div className="p-8 text-center text-sm text-[var(--text-tertiary)]">Generating…</div> : (
          <div className="overflow-x-auto">
            {tab === 'PL' && pl && (
              <table className="w-full text-sm">
                <tbody>
                  {pl.rows.map((r, i) => (
                    <tr key={i} className={`border-b border-[var(--border)] last:border-0 ${r.group === 'RESULT' ? 'font-semibold bg-[var(--surface-hover)]' : ''}`}>
                      <td className="px-4 py-2.5">{r.label}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums" style={{ color: r.amount < 0 ? 'var(--status-danger-text)' : r.group === 'RESULT' ? (r.amount < 0 ? 'var(--status-danger-text)' : 'var(--status-success-text)') : 'var(--text-primary)' }}>{money(r.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {tab === 'TB' && (
              <table className="w-full text-xs">
                <thead><tr className="border-b border-[var(--border)] text-left text-[var(--text-tertiary)]"><th className="px-4 py-2.5 font-medium">Code</th><th className="px-4 py-2.5 font-medium">Account</th><th className="px-4 py-2.5 font-medium text-right">Debit</th><th className="px-4 py-2.5 font-medium text-right">Credit</th><th className="px-4 py-2.5 font-medium text-right">Balance</th></tr></thead>
                <tbody>
                  {tb.map((r, i) => (
                    <tr key={i} className="border-b border-[var(--border)] last:border-0"><td className="px-4 py-2 font-mono">{r.account_code}</td><td className="px-4 py-2">{r.account_name}</td><td className="px-4 py-2 text-right tabular-nums">{money(r.debit)}</td><td className="px-4 py-2 text-right tabular-nums">{money(r.credit)}</td><td className="px-4 py-2 text-right tabular-nums">{money(r.balance)}</td></tr>
                  ))}
                  {tb.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-center text-[var(--text-tertiary)]">No journal entries in this period.</td></tr>}
                </tbody>
                {tb.length > 0 && <tfoot><tr className="border-t-2 border-[var(--border)] font-semibold"><td className="px-4 py-2.5" colSpan={2}>Total</td><td className="px-4 py-2.5 text-right tabular-nums">{money(tbTotals.d)}</td><td className="px-4 py-2.5 text-right tabular-nums">{money(tbTotals.c)}</td><td></td></tr></tfoot>}
              </table>
            )}
            {tab === 'GL' && (
              <table className="w-full text-xs">
                <thead><tr className="border-b border-[var(--border)] text-left text-[var(--text-tertiary)]"><th className="px-4 py-2.5 font-medium">Date</th><th className="px-4 py-2.5 font-medium">Ref</th><th className="px-4 py-2.5 font-medium">Account</th><th className="px-4 py-2.5 font-medium">Description</th><th className="px-4 py-2.5 font-medium text-right">Debit</th><th className="px-4 py-2.5 font-medium text-right">Credit</th></tr></thead>
                <tbody>
                  {gl.map((l: any, i: number) => (
                    <tr key={i} className="border-b border-[var(--border)] last:border-0"><td className="px-4 py-2">{l.date}</td><td className="px-4 py-2 font-mono text-[var(--text-tertiary)]">{l.reference}</td><td className="px-4 py-2">{l.account_code} {l.account_name}</td><td className="px-4 py-2 text-[var(--text-secondary)]">{l.description}</td><td className="px-4 py-2 text-right tabular-nums">{l.debit ? money(l.debit) : ''}</td><td className="px-4 py-2 text-right tabular-nums">{l.credit ? money(l.credit) : ''}</td></tr>
                  ))}
                  {gl.length === 0 && <tr><td colSpan={6} className="px-4 py-6 text-center text-[var(--text-tertiary)]">No journal entries in this period.</td></tr>}
                </tbody>
              </table>
            )}
            {(tab === 'COST_PROJ' || tab === 'REV_PROJ') && (
              <table className="w-full text-xs">
                <thead><tr className="border-b border-[var(--border)] text-left text-[var(--text-tertiary)]"><th className="px-4 py-2.5 font-medium">Project</th><th className="px-4 py-2.5 font-medium">Name</th><th className="px-4 py-2.5 font-medium text-right">{tab === 'COST_PROJ' ? 'Cost' : 'Revenue'} (AED)</th></tr></thead>
                <tbody>
                  {proj.map((r, i) => (<tr key={i} className="border-b border-[var(--border)] last:border-0"><td className="px-4 py-2 font-medium text-[var(--text-primary)]">{r.project_number}</td><td className="px-4 py-2 text-[var(--text-secondary)]">{r.project_name}</td><td className="px-4 py-2 text-right tabular-nums">{money(r.amount)}</td></tr>))}
                  {proj.length === 0 && <tr><td colSpan={3} className="px-4 py-6 text-center text-[var(--text-tertiary)]">No data in this period.</td></tr>}
                </tbody>
                {proj.length > 0 && <tfoot><tr className="border-t-2 border-[var(--border)] font-semibold"><td className="px-4 py-2.5" colSpan={2}>Total</td><td className="px-4 py-2.5 text-right tabular-nums">{money(projTotal)}</td></tr></tfoot>}
              </table>
            )}
          </div>
        )}
      </Card>

      <p className="text-[11px] text-[var(--text-tertiary)]">Trial Balance & General Ledger are built from the accounting journal (client/supplier invoices, VAT, payments). Balance Sheet requires a full chart-of-accounts mapping — planned next. For full double-entry Excel, use the journal export in the accounting service.</p>
    </div>
  );
}
