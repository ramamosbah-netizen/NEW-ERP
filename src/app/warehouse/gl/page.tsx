'use client';

// ============================================================
// JEET ERP — Warehouse: Inventory GL Integration
// Period journal (inventory / WIP / COGS) from the movement ledger
// + editable account mappings. Export for accounting. No migration
// required to view (falls back to default mappings).
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';
import inventoryGlService, { GlMapping, JournalLine } from '@/services/inventoryGlService';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { exportTablePdf, exportTableExcel } from '@/lib/finance-export';
import { Landmark, FileDown, Sheet, Save, Settings2 } from 'lucide-react';

const aed = (n: number) => `AED ${Number(n || 0).toLocaleString('en-AE', { maximumFractionDigits: 2 })}`;
const firstOfMonth = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10); };
const today = () => new Date().toISOString().slice(0, 10);

export default function InventoryGlPage() {
  const [from, setFrom] = useState(firstOfMonth());
  const [to, setTo] = useState(today());
  const [lines, setLines] = useState<JournalLine[]>([]);
  const [totals, setTotals] = useState({ totalDebit: 0, totalCredit: 0 });
  const [loading, setLoading] = useState(true);
  const [showMap, setShowMap] = useState(false);
  const [mappings, setMappings] = useState<GlMapping[]>([]);
  const [savingType, setSavingType] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const j = await inventoryGlService.getPeriodJournal({ date_from: from, date_to: to + 'T23:59:59' });
      setLines(j.lines); setTotals({ totalDebit: j.totalDebit, totalCredit: j.totalCredit });
    } finally { setLoading(false); }
  }, [from, to]);
  useEffect(() => { load(); }, [load]);

  useEffect(() => { inventoryGlService.getMappings().then(setMappings).catch(() => {}); }, []);

  const saveMapping = async (m: GlMapping) => {
    setSavingType(m.transaction_type);
    try { await inventoryGlService.upsertMapping(m); await load(); }
    catch (e: any) { alert(e?.message || 'Save failed (apply the migration first).'); }
    finally { setSavingType(null); }
  };

  const exportCols = ['Movement type', 'Count', 'Dr account', 'Cr account', 'Amount'];
  const exportRows = lines.map(l => [l.transaction_type.replace(/_/g, ' '), l.count, `${l.debit_account_code} ${l.debit_account_name}`, `${l.credit_account_code} ${l.credit_account_name}`, l.amount]);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Inventory GL Integration"
        subtitle="Period journal of inventory, WIP and COGS postings from the movement ledger"
        breadcrumbs={[{ label: 'Warehouse', href: '/warehouse' }, { label: 'GL Integration' }]}
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" icon={Settings2} onClick={() => setShowMap(s => !s)}>{showMap ? 'Hide mapping' : 'Account mapping'}</Button>
            {lines.length > 0 && <>
              <Button variant="secondary" icon={FileDown} onClick={() => exportTablePdf({ title: 'Inventory GL Journal', subtitle: `${from} → ${to}`, columns: exportCols, rows: exportRows, fileName: 'inventory-gl-journal' })}>PDF</Button>
              <Button variant="secondary" icon={Sheet} onClick={() => exportTableExcel({ title: 'Inventory GL Journal', subtitle: `${from} → ${to}`, columns: exportCols, rows: exportRows, fileName: 'inventory-gl-journal' })}>Excel</Button>
            </>}
          </div>
        }
      />

      <Card className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
        <label className="text-xs text-[var(--text-secondary)]">From<input type="date" value={from} onChange={e => setFrom(e.target.value)} className="w-full mt-1 px-2 h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm" /></label>
        <label className="text-xs text-[var(--text-secondary)]">To<input type="date" value={to} onChange={e => setTo(e.target.value)} className="w-full mt-1 px-2 h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm" /></label>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Total debits</div><div className="text-xl font-bold mt-1">{aed(totals.totalDebit)}</div></Card>
        <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Total credits</div><div className="text-xl font-bold mt-1">{aed(totals.totalCredit)}</div></Card>
      </div>

      {showMap && (
        <Card className="p-0 overflow-x-auto">
          <div className="p-3 text-sm font-semibold text-[var(--text-primary)] border-b border-[var(--border)]">Account mapping (editable — requires the migration to persist)</div>
          <table className="w-full text-sm">
            <thead><tr className="border-b border-[var(--border)] text-left text-[var(--text-tertiary)] text-xs">
              <th className="p-2">Movement</th><th className="p-2">Dr code</th><th className="p-2">Dr name</th><th className="p-2">Cr code</th><th className="p-2">Cr name</th><th className="p-2"></th>
            </tr></thead>
            <tbody>
              {mappings.map((m, i) => (
                <tr key={m.transaction_type} className="border-b border-[var(--border)] last:border-0">
                  <td className="p-2 text-xs font-medium">{m.transaction_type.replace(/_/g, ' ')}</td>
                  {(['debit_account_code', 'debit_account_name', 'credit_account_code', 'credit_account_name'] as const).map(f => (
                    <td key={f} className="p-2"><input value={(m as any)[f] || ''} onChange={e => setMappings(ms => ms.map((x, j) => j === i ? { ...x, [f]: e.target.value } : x))} className="w-full px-2 h-8 rounded-md border border-[var(--border)] bg-[var(--surface)] text-xs" /></td>
                  ))}
                  <td className="p-2 text-right"><button onClick={() => saveMapping(m)} disabled={savingType === m.transaction_type} className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded border border-[var(--border)] hover:border-[var(--accent)] disabled:opacity-50"><Save size={12} />{savingType === m.transaction_type ? '…' : 'Save'}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {loading ? (
        <Card><div className="p-8 text-center text-sm text-[var(--text-tertiary)]">Loading journal…</div></Card>
      ) : lines.length === 0 ? (
        <Card><div className="p-8 text-center text-sm text-[var(--text-tertiary)]">No stock movements in this period.</div></Card>
      ) : (
        <Card className="p-0 overflow-x-auto">
          <div className="p-3 text-sm font-semibold text-[var(--text-primary)] border-b border-[var(--border)] flex items-center gap-2"><Landmark size={15} /> Journal — {from} to {to}</div>
          <table className="w-full text-sm">
            <thead><tr className="border-b border-[var(--border)] text-left text-[var(--text-tertiary)] text-xs">
              <th className="p-3">Movement</th><th className="p-3 text-right">Lines</th><th className="p-3">Debit account</th><th className="p-3">Credit account</th><th className="p-3 text-right">Amount</th>
            </tr></thead>
            <tbody>
              {lines.map(l => {
                const noImpact = l.debit_account_code === l.credit_account_code;
                return (
                  <tr key={l.transaction_type} className="border-b border-[var(--border)] last:border-0" style={{ opacity: noImpact ? 0.6 : 1 }}>
                    <td className="p-3 text-xs font-medium">{l.transaction_type.replace(/_/g, ' ')}</td>
                    <td className="p-3 text-right tabular-nums text-[var(--text-tertiary)]">{l.count}</td>
                    <td className="p-3 text-xs"><span className="font-mono text-[var(--text-tertiary)]">{l.debit_account_code}</span> {l.debit_account_name}</td>
                    <td className="p-3 text-xs"><span className="font-mono text-[var(--text-tertiary)]">{l.credit_account_code}</span> {l.credit_account_name}</td>
                    <td className="p-3 text-right tabular-nums font-medium">{aed(l.amount)}{noImpact && <span className="text-[10px] text-[var(--text-tertiary)]"> (no GL impact)</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
