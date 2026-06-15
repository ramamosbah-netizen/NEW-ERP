'use client';

// ============================================================
// JEET ERP — Warehouse: Stock Count sheet (detail)
// Enter physical counts, see live variance + value, save, post.
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import stockCountService from '@/services/stockCountService';
import type { StockCount, StockCountLine } from '@/types/stock.types';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { exportTablePdf, exportTableExcel } from '@/lib/finance-export';
import { Save, CheckCircle2, FileDown, Sheet, ArrowLeft } from 'lucide-react';

const aed = (n: number) => `AED ${Number(n || 0).toLocaleString('en-AE', { maximumFractionDigits: 2 })}`;
const num = (n: number) => Number(n || 0).toLocaleString('en-AE', { maximumFractionDigits: 3 });

export default function StockCountSheetPage() {
  const params = useParams();
  const router = useRouter();
  const id = String(params.id);
  const [count, setCount] = useState<StockCount | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [posting, setPosting] = useState(false);
  // editable state keyed by stock_item_id
  const [edits, setEdits] = useState<Record<string, { counted_qty: string; recount: boolean }>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const c = await stockCountService.getStockCountDetail(id);
      setCount(c);
      const e: Record<string, { counted_qty: string; recount: boolean }> = {};
      (c.lines || []).forEach(l => { e[l.stock_item_id] = { counted_qty: String(l.counted_qty), recount: l.recount_flag }; });
      setEdits(e);
    } finally { setLoading(false); }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const editable = count?.status === 'IN_PROGRESS' || count?.status === 'PENDING_REVIEW';

  const lineCalc = (l: StockCountLine) => {
    const edit = edits[l.stock_item_id];
    const counted = edit ? Number(edit.counted_qty) || 0 : Number(l.counted_qty);
    const variance = counted - Number(l.system_qty);
    const varianceValue = variance * Number(l.avg_unit_cost || 0);
    return { counted, variance, varianceValue, recount: edit?.recount || false };
  };

  const totals = (count?.lines || []).reduce((acc, l) => {
    const c = lineCalc(l);
    if (c.variance !== 0) acc.varianceItems++;
    acc.netVariance += c.varianceValue;
    return acc;
  }, { varianceItems: 0, netVariance: 0 });
  const hasRecount = (count?.lines || []).some(l => lineCalc(l).recount);

  const save = async () => {
    if (!count) return;
    setSaving(true);
    try {
      const lines = (count.lines || []).map(l => ({ stock_item_id: l.stock_item_id, counted_qty: Number(edits[l.stock_item_id]?.counted_qty) || 0, recount_flag: edits[l.stock_item_id]?.recount || false }));
      await stockCountService.saveCountLines(id, lines);
      await load();
    } catch (e: any) { alert(e?.message || 'Save failed'); } finally { setSaving(false); }
  };

  const post = async () => {
    if (!count) return;
    if (hasRecount) { alert('Resolve recount flags before posting.'); return; }
    const reason = prompt('Reason / note for posting these variance adjustments:', `Inventory count ${count.count_number}`);
    if (reason === null) return;
    setPosting(true);
    try {
      await save(); // persist latest edits first
      await stockCountService.postStockCount(id, reason || `Inventory count ${count.count_number}`);
      await load();
      alert('Stock count posted. Variance adjustments written to the ledger.');
    } catch (e: any) { alert(e?.message || 'Post failed'); } finally { setPosting(false); }
  };

  const exportCols = ['Item', 'Description', 'Unit', 'System qty', 'Counted qty', 'Variance', 'Avg cost', 'Variance value'];
  const exportRows = (count?.lines || []).map(l => { const c = lineCalc(l); return [l.item_code || '', l.description || '', l.unit || '', num(l.system_qty), num(c.counted), num(c.variance), l.avg_unit_cost || 0, Math.round(c.varianceValue * 100) / 100]; });

  if (loading) return <Card><div className="p-8 text-center text-sm text-[var(--text-tertiary)]">Loading count…</div></Card>;
  if (!count) return <Card><div className="p-8 text-center text-sm text-[var(--text-tertiary)]">Count not found.</div></Card>;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={`Stock Count ${count.count_number}`}
        subtitle={`${count.location_name} · ${count.count_date} · ${count.counter_name || ''}`}
        breadcrumbs={[{ label: 'Warehouse', href: '/warehouse' }, { label: 'Stock Count', href: '/warehouse/stock-count' }, { label: count.count_number }]}
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" icon={ArrowLeft} onClick={() => router.push('/warehouse/stock-count')}>Back</Button>
            <Button variant="secondary" icon={FileDown} onClick={() => exportTablePdf({ title: `Stock Count ${count.count_number}`, subtitle: count.location_name, columns: exportCols, rows: exportRows, fileName: `stock-count-${count.count_number}` })}>PDF</Button>
            <Button variant="secondary" icon={Sheet} onClick={() => exportTableExcel({ title: `Stock Count ${count.count_number}`, subtitle: count.location_name, columns: exportCols, rows: exportRows, fileName: `stock-count-${count.count_number}` })}>Excel</Button>
            {editable && <>
              <Button variant="secondary" icon={Save} onClick={save} isLoading={saving}>Save</Button>
              <Button icon={CheckCircle2} onClick={post} isLoading={posting} disabled={hasRecount}>Post</Button>
            </>}
          </div>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Status</div><div className="text-lg font-semibold mt-1">{count.status.replace('_', ' ')}</div></Card>
        <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Items</div><div className="text-2xl font-bold mt-1">{count.lines?.length || 0}</div></Card>
        <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Items with variance</div><div className="text-2xl font-bold mt-1" style={{ color: totals.varianceItems ? 'var(--status-warning-text)' : 'var(--text-primary)' }}>{totals.varianceItems}</div></Card>
        <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Net variance value</div><div className="text-lg font-semibold mt-1" style={{ color: totals.netVariance < 0 ? 'var(--status-danger-text)' : totals.netVariance > 0 ? 'var(--status-success-text)' : 'var(--text-primary)' }}>{aed(totals.netVariance)}</div></Card>
      </div>

      {hasRecount && <Card className="p-3" style={{ background: 'var(--status-warning-bg)' }}><div className="text-xs" style={{ color: 'var(--status-warning-text)' }}>Some lines are flagged for recount — clear the flags before posting.</div></Card>}

      <Card className="p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-[var(--border)] text-left text-[var(--text-tertiary)] text-xs">
            <th className="p-3">Item</th><th className="p-3 text-right">System</th><th className="p-3 text-right">Counted</th>
            <th className="p-3 text-right">Variance</th><th className="p-3 text-right">Variance value</th><th className="p-3 text-center">Recount</th>
          </tr></thead>
          <tbody>
            {(count.lines || []).map(l => {
              const c = lineCalc(l);
              return (
                <tr key={l.stock_item_id} className="border-b border-[var(--border)] last:border-0">
                  <td className="p-3"><div className="font-medium text-[var(--text-primary)]">{l.item_code}</div><div className="text-[11px] text-[var(--text-tertiary)] line-clamp-1">{l.description}{l.unit ? ` · ${l.unit}` : ''}</div></td>
                  <td className="p-3 text-right tabular-nums text-[var(--text-secondary)]">{num(l.system_qty)}</td>
                  <td className="p-3 text-right">
                    {editable ? (
                      <input type="number" value={edits[l.stock_item_id]?.counted_qty ?? ''} onChange={e => setEdits(s => ({ ...s, [l.stock_item_id]: { counted_qty: e.target.value, recount: s[l.stock_item_id]?.recount || false } }))}
                        className="w-24 px-2 h-8 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm text-right tabular-nums" />
                    ) : <span className="tabular-nums">{num(c.counted)}</span>}
                  </td>
                  <td className="p-3 text-right tabular-nums font-medium" style={{ color: c.variance < 0 ? 'var(--status-danger-text)' : c.variance > 0 ? 'var(--status-success-text)' : 'var(--text-tertiary)' }}>{c.variance > 0 ? '+' : ''}{num(c.variance)}</td>
                  <td className="p-3 text-right tabular-nums" style={{ color: c.varianceValue < 0 ? 'var(--status-danger-text)' : c.varianceValue > 0 ? 'var(--status-success-text)' : 'var(--text-tertiary)' }}>{aed(c.varianceValue)}</td>
                  <td className="p-3 text-center">
                    <input type="checkbox" disabled={!editable} checked={edits[l.stock_item_id]?.recount || false} onChange={e => setEdits(s => ({ ...s, [l.stock_item_id]: { counted_qty: s[l.stock_item_id]?.counted_qty ?? String(l.counted_qty), recount: e.target.checked } }))} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
