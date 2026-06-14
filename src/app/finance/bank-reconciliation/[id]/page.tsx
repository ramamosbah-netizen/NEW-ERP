'use client';

// ============================================================
// JEET ERP — Finance: Bank Reconciliation (Page 4, detail)
// Import CSV/Excel, auto-match, manual match / charge / adjustment.
// ============================================================

import React, { useState, useEffect, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';
import bankReconciliationService, { ReconHeader, ReconLine, ImportRow } from '@/services/bankReconciliationService';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Upload, Wand2, X, Check, CircleDollarSign, SlidersHorizontal, Unlink } from 'lucide-react';

const money = (v: number) => new Intl.NumberFormat('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v || 0);
const pick = (row: any, keys: string[]) => { for (const k of Object.keys(row)) { const lk = k.toLowerCase().trim(); if (keys.some(x => lk.includes(x))) return row[k]; } return undefined; };
const MATCH_LABEL: Record<string, string> = { NONE: 'Unmatched', CLIENT_PAYMENT: 'Client receipt', SUPPLIER_PAYMENT: 'Supplier payment', EXPENSE: 'Expense', CHARGE: 'Bank charge', ADJUSTMENT: 'Adjustment' };

export default function BankReconDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [header, setHeader] = useState<ReconHeader | null>(null);
  const [lines, setLines] = useState<ReconLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setLoading(true); const d = await bankReconciliationService.get(id); if (d) { setHeader(d.header); setLines(d.lines); } setError(null); }
    catch (e: any) { setError(e.message || 'Failed to load'); } finally { setLoading(false); }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true); setMsg(null); setError(null);
    try {
      const wb = XLSX.read(await file.arrayBuffer(), { cellDates: true });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const json: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });
      const rows: ImportRow[] = json.map(r => {
        const amountRaw = pick(r, ['amount']);
        const debit = Number(pick(r, ['debit', 'withdrawal']) || 0);
        const credit = Number(pick(r, ['credit', 'deposit']) || 0);
        const amount = amountRaw !== undefined && amountRaw !== '' ? Number(amountRaw) : (credit - debit);
        const dRaw = pick(r, ['date']);
        const date = dRaw instanceof Date ? dRaw.toISOString().slice(0, 10) : (dRaw ? String(dRaw).slice(0, 10) : undefined);
        return { date, description: String(pick(r, ['description', 'narrative', 'details', 'particular']) || ''), reference: String(pick(r, ['reference', 'ref', 'cheque']) || ''), amount: Number(amount) || 0 };
      });
      const n = await bankReconciliationService.importLines(id, rows);
      setMsg(`Imported ${n} statement line(s).`);
      await load();
    } catch (e: any) { setError(e.message || 'Import failed — check the file has Date/Description/Amount (or Debit/Credit) columns.'); }
    finally { setBusy(false); }
  };

  const autoMatch = async () => { setBusy(true); try { const n = await bankReconciliationService.autoMatch(id); setMsg(`Auto-matched ${n} line(s).`); await load(); } catch (e: any) { setError(e.message); } finally { setBusy(false); } };
  const setLine = async (lineId: string, patch: any) => { await bankReconciliationService.setLine(lineId, patch); await load(); };
  const complete = async () => { await bankReconciliationService.complete(id); await load(); };

  const matchedTotal = lines.filter(l => l.matched).reduce((s, l) => s + l.amount, 0);
  const unmatched = lines.filter(l => !l.matched);
  const stmtMovement = header ? header.closing_balance - header.opening_balance : 0;
  const diff = (matchedTotal + unmatched.reduce((s, l) => s + l.amount, 0)) - stmtMovement;

  if (loading) return <div className="p-8 text-sm text-[var(--text-tertiary)]">Loading…</div>;
  if (!header) return <div className="p-8 text-sm text-[var(--text-tertiary)]">Not found.</div>;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={`Reconciliation — ${header.account_name || 'Account'}`}
        subtitle={`Statement ${header.statement_date} · Opening ${money(header.opening_balance)} → Closing ${money(header.closing_balance)} AED · ${header.status}`}
        breadcrumbs={[{ label: 'Finance', href: '/finance' }, { label: 'Bank Reconciliation', href: '/finance/bank-reconciliation' }, { label: 'Detail' }]}
        actions={
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => router.push('/finance/bank-reconciliation')}>Back</Button>
            {header.status === 'DRAFT' && unmatched.length === 0 && lines.length > 0 && <Button size="sm" variant="primary" icon={Check} onClick={complete}>Mark complete</Button>}
          </div>
        }
      />

      {error && <div className="bg-[var(--status-danger-bg)] border border-[var(--status-danger-border)] rounded-lg p-3 text-xs text-[var(--status-danger-text)]">{error}</div>}
      {msg && <div className="bg-[var(--status-success-bg)] border border-[var(--status-success-border)] rounded-lg p-3 text-xs text-[var(--status-success-text)]">{msg}</div>}

      <div className="flex flex-wrap gap-2 items-center">
        <label className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-dashed border-[var(--border)] text-xs text-[var(--text-secondary)] cursor-pointer hover:border-[var(--accent)]">
          <Upload size={14} /> {busy ? 'Working…' : 'Import statement (CSV / Excel)'}
          <input type="file" accept=".csv,.xlsx,.xls" className="hidden" disabled={busy} onChange={e => onFile(e.target.files?.[0])} />
        </label>
        <Button size="sm" variant="secondary" icon={Wand2} onClick={autoMatch} disabled={busy || lines.length === 0}>Auto-match</Button>
        <div className="ml-auto flex gap-3 text-xs text-[var(--text-tertiary)]">
          <span>Lines: <strong className="text-[var(--text-primary)]">{lines.length}</strong></span>
          <span>Unmatched: <strong style={{ color: unmatched.length ? 'var(--status-warning-text)' : 'var(--status-success-text)' }}>{unmatched.length}</strong></span>
          <span>Difference: <strong style={{ color: Math.abs(diff) > 0.01 ? 'var(--status-danger-text)' : 'var(--status-success-text)' }}>{money(diff)}</strong></span>
        </div>
      </div>

      <Card className="overflow-hidden">
        {lines.length === 0 ? (
          <div className="p-8 text-center text-sm text-[var(--text-tertiary)]">No lines yet — import a bank statement (columns: Date, Description, Amount or Debit/Credit).</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr className="border-b border-[var(--border)] text-left text-[var(--text-tertiary)]"><th className="px-4 py-2.5 font-medium">Date</th><th className="px-4 py-2.5 font-medium">Description</th><th className="px-4 py-2.5 font-medium text-right">Amount</th><th className="px-4 py-2.5 font-medium">Match</th><th className="px-4 py-2.5 font-medium text-right">Actions</th></tr></thead>
              <tbody>
                {lines.map(l => (
                  <tr key={l.id} className="border-b border-[var(--border)] last:border-0">
                    <td className="px-4 py-2">{l.txn_date || '—'}</td>
                    <td className="px-4 py-2 text-[var(--text-secondary)]">{l.description || '—'}{l.matched_ref ? <span className="text-[var(--text-tertiary)]"> · {l.matched_ref}</span> : ''}</td>
                    <td className="px-4 py-2 text-right tabular-nums" style={{ color: l.amount < 0 ? 'var(--status-danger-text)' : 'var(--status-success-text)' }}>{money(l.amount)}</td>
                    <td className="px-4 py-2">
                      <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: l.matched ? 'var(--status-success-bg)' : 'var(--status-warning-bg)', color: l.matched ? 'var(--status-success-text)' : 'var(--status-warning-text)' }}>{MATCH_LABEL[l.match_type] || (l.matched ? 'Matched' : 'Unmatched')}</span>
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex items-center justify-end gap-1.5">
                        {!l.matched ? (
                          <>
                            <button title="Mark matched" onClick={() => setLine(l.id, { matched: true, match_type: l.amount > 0 ? 'CLIENT_PAYMENT' : 'SUPPLIER_PAYMENT' })} className="p-1 rounded border border-[var(--border)] text-[var(--status-success-text)] hover:bg-[var(--surface-hover)] cursor-pointer"><Check size={12} /></button>
                            <button title="Bank charge" onClick={() => setLine(l.id, { matched: true, match_type: 'CHARGE' })} className="p-1 rounded border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] cursor-pointer"><CircleDollarSign size={12} /></button>
                            <button title="Adjustment" onClick={() => setLine(l.id, { matched: true, match_type: 'ADJUSTMENT' })} className="p-1 rounded border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] cursor-pointer"><SlidersHorizontal size={12} /></button>
                          </>
                        ) : (
                          <button title="Unmatch" onClick={() => setLine(l.id, { matched: false, match_type: 'NONE', matched_ref: null })} className="p-1 rounded border border-[var(--border)] text-[var(--text-tertiary)] hover:bg-[var(--surface-hover)] cursor-pointer"><Unlink size={12} /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
