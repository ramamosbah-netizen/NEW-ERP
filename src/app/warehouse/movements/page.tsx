'use client';

// ============================================================
// JEET ERP — Goods Movements
// Tracks every material movement across sites and projects:
// receipts, issues to project/ticket, returns, transfers,
// adjustments and write-offs. Populated automatically by the
// GRN, MRF and stock-transfer flows.
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';
import warehouseService, { MovementRow } from '@/services/warehouseService';
import { supabase } from '@/lib/supabase';
import { exportMovementsExcel } from '@/lib/stock-export';
import stockMovementPDF from '@/lib/stock-movement-pdf';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Truck, Search, Plus, X, Save, FileSpreadsheet, FileText } from 'lucide-react';
import type { StockTransactionType } from '@/types/stock.types';

const TYPE_META: Record<string, { label: string; tone: 'in' | 'out' | 'neutral' }> = {
  GRN_RECEIPT: { label: 'Receipt', tone: 'in' },
  ISSUE_TO_PROJECT: { label: 'Issue → Project', tone: 'out' },
  ISSUE_TO_TICKET: { label: 'Issue → Ticket', tone: 'out' },
  RETURN_FROM_SITE: { label: 'Return from site', tone: 'in' },
  TRANSFER_OUT: { label: 'Transfer out', tone: 'out' },
  TRANSFER_IN: { label: 'Transfer in', tone: 'in' },
  ADJUSTMENT_IN: { label: 'Adjustment +', tone: 'in' },
  ADJUSTMENT_OUT: { label: 'Adjustment −', tone: 'out' },
  WRITE_OFF: { label: 'Write-off / damaged', tone: 'out' },
};

const TONE: Record<string, { bg: string; text: string; border: string }> = {
  in: { bg: 'var(--status-success-bg)', text: 'var(--status-success-text)', border: 'var(--status-success-border)' },
  out: { bg: 'var(--status-warning-bg)', text: 'var(--status-warning-text)', border: 'var(--status-warning-border)' },
  neutral: { bg: 'var(--status-neutral-bg)', text: 'var(--status-neutral-text)', border: 'var(--status-neutral-border)' },
};

const fmtQty = (v: number) => new Intl.NumberFormat('en-AE', { maximumFractionDigits: 3, signDisplay: 'exceptZero' }).format(v);
const fmtAED = (v: number) => new Intl.NumberFormat('en-AE', { maximumFractionDigits: 2 }).format(v) + ' AED';
const fmtDate = (d: string) => new Date(d).toLocaleString('en-AE', { dateStyle: 'medium', timeStyle: 'short' });

export default function MovementsPage() {
  const [rows, setRows] = useState<MovementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [period, setPeriod] = useState<'ALL' | 'WEEK' | 'MONTH' | 'YEAR'>('ALL');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // New movement modal
  const [showAdd, setShowAdd] = useState(false);
  const [items, setItems] = useState<{ id: string; item_code: string; description: string; unit: string }[]>([]);
  const [locations, setLocations] = useState<{ id: string; name: string; location_code: string; type: string }[]>([]);
  const [projects, setProjects] = useState<{ id: string; project_number: string }[]>([]);
  const [mForm, setMForm] = useState({ type: 'GRN_RECEIPT' as StockTransactionType, stock_item_id: '', location_id: '', quantity: '', unit_cost: '', project_id: '', reason: '', received_by: '' });

  const load = useCallback(async () => {
    setLoading(true);
    try { setRows(await warehouseService.getMovements()); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const openAdd = async () => {
    try {
      const [its, locs, projData] = await Promise.all([
        warehouseService.getStockItemOptions(),
        warehouseService.getLocations(),
        supabase.from('projects').select('id, project_number').order('project_number'),
      ]);
      setItems(its);
      setLocations(locs);
      setProjects((projData.data as any[]) || []);
      setShowAdd(true);
    } catch (err: any) { setError(err.message); }
  };

  const handleRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mForm.stock_item_id || !mForm.location_id || !mForm.quantity) {
      setError('Item, location and quantity are required.');
      return;
    }
    setBusy(true);
    try {
      await warehouseService.recordManualMovement({
        type: mForm.type,
        stock_item_id: mForm.stock_item_id,
        location_id: mForm.location_id,
        quantity: Number(mForm.quantity),
        unit_cost: Number(mForm.unit_cost) || 0,
        project_id: mForm.project_id || null,
        reason: mForm.reason || null,
        received_by_name: mForm.received_by || null,
      });
      setShowAdd(false);
      setMForm({ type: 'GRN_RECEIPT', stock_item_id: '', location_id: '', quantity: '', unit_cost: '', project_id: '', reason: '', received_by: '' });
      await load();
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to record movement');
    } finally { setBusy(false); }
  };

  const periodStart = (() => {
    const now = new Date();
    if (period === 'WEEK') { const d = new Date(now); d.setDate(d.getDate() - 7); return d; }
    if (period === 'MONTH') { const d = new Date(now); d.setMonth(d.getMonth() - 1); return d; }
    if (period === 'YEAR') { const d = new Date(now); d.setFullYear(d.getFullYear() - 1); return d; }
    return null;
  })();

  const filtered = rows.filter(r => {
    if (typeFilter && r.type !== typeFilter) return false;
    if (periodStart && new Date(r.created_at) < periodStart) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return r.item_code.toLowerCase().includes(q) || r.description.toLowerCase().includes(q) ||
      (r.project_number || '').toLowerCase().includes(q) || r.transaction_number.toLowerCase().includes(q);
  });

  const types = [...new Set(rows.map(r => r.type))];

  // CSV export of the current (filtered) goods log
  const exportCSV = () => {
    const headers = ['Date', 'Transaction', 'Type', 'Item Code', 'Description', 'Qty', 'Unit Cost', 'Total Value', 'Location', 'Project', 'Reason'];
    const esc = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = filtered.map(r => [
      new Date(r.created_at).toISOString(), r.transaction_number, r.type, r.item_code, r.description,
      r.qty, r.unit_cost, r.total_value, r.location_name, r.project_number || '', r.reason || '',
    ].map(esc).join(','));
    const csv = [headers.map(esc).join(','), ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `goods_movements_${period.toLowerCase()}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const PERIOD_LABEL: Record<string, string> = { ALL: 'All time', WEEK: 'This week', MONTH: 'This month', YEAR: 'This year' };
  const exportExcel = () => exportMovementsExcel(filtered, { period: PERIOD_LABEL[period] });

  const downloadReceipt = (r: MovementRow) => {
    stockMovementPDF.download({
      receipt_no: r.transaction_number,
      type: r.type,
      date: r.created_at,
      item_code: r.item_code,
      description: r.description,
      unit: '',
      qty: r.qty,
      unit_cost: r.unit_cost,
      from_name: r.from_name,
      to_name: r.to_name,
      project_number: r.project_number,
      issued_by: r.issued_by || '—',
      received_by: r.received_by || '—',
      reason: r.reason,
    });
  };

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Goods Movements"
        subtitle="Material movement across sites and projects — receipts, issues, returns, transfers, adjustments and write-offs"
        breadcrumbs={[{ label: 'Warehouse', href: '/warehouse' }, { label: 'Movements' }]}
        actions={<Button variant="primary" size="sm" icon={Plus} onClick={openAdd}>New movement</Button>}
      />

      {error && (
        <div className="flex items-center justify-between gap-3 bg-[var(--status-danger-bg)] border border-[var(--status-danger-border)] rounded-lg p-3 text-xs text-[var(--status-danger-text)]">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="cursor-pointer"><X size={13} /></button>
        </div>
      )}

      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" size={14} />
          <input className="quote-form-input w-full !pl-9" placeholder="Search item, project, txn…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="quote-form-input max-w-[200px]" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
          <option value="">All movement types</option>
          {types.map(t => <option key={t} value={t}>{TYPE_META[t]?.label || t}</option>)}
        </select>
        <select className="quote-form-input max-w-[150px]" value={period} onChange={e => setPeriod(e.target.value as any)}>
          <option value="ALL">All time</option>
          <option value="WEEK">This week</option>
          <option value="MONTH">This month</option>
          <option value="YEAR">This year</option>
        </select>
        <span className="text-xs text-[var(--text-muted)]">{filtered.length} movement{filtered.length === 1 ? '' : 's'}</span>
        <div className="ml-auto flex gap-2">
          <Button size="sm" variant="secondary" onClick={exportCSV} disabled={filtered.length === 0}>CSV</Button>
          <Button size="sm" variant="secondary" icon={FileSpreadsheet} onClick={exportExcel} disabled={filtered.length === 0}>Export Excel</Button>
        </div>
      </div>

      {loading ? (
        <div className="py-20 flex justify-center"><div className="h-7 w-7 border-2 border-[var(--border-color)] border-t-[var(--text-primary)] animate-spin rounded-full" /></div>
      ) : rows.length === 0 ? (
        <EmptyState icon={Truck} title="No movements yet" description="Goods movements appear here automatically as you receive (GRN), issue to projects/tickets, transfer between locations, or write off damaged stock." />
      ) : (
        <Card padding={false}>
          <div className="quote-table-wrap !border-0 !rounded-none">
            <table className="quote-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Txn</th>
                  <th>Type</th>
                  <th>Item</th>
                  <th>Qty</th>
                  <th>Value</th>
                  <th>From</th>
                  <th>To</th>
                  <th>Received by</th>
                  <th>Project</th>
                  <th>Receipt</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => {
                  const meta = TYPE_META[r.type] || { label: r.type, tone: 'neutral' as const };
                  const tone = TONE[meta.tone];
                  return (
                    <tr key={r.id}>
                      <td><span className="font-mono text-[0.6875rem] text-[var(--text-muted)] whitespace-nowrap">{fmtDate(r.created_at)}</span></td>
                      <td><span className="font-mono text-xs text-[var(--text-secondary)]">{r.transaction_number}</span></td>
                      <td>
                        <span className="inline-flex px-2 py-0.5 rounded-md text-[0.6875rem] font-medium border whitespace-nowrap"
                          style={{ backgroundColor: tone.bg, color: tone.text, borderColor: tone.border }}>
                          {meta.label}
                        </span>
                      </td>
                      <td>
                        <div className="flex flex-col">
                          <span className="text-xs text-[var(--text-primary)]">{r.description}</span>
                          <span className="font-mono text-[0.6875rem] text-[var(--text-muted)]">{r.item_code}</span>
                        </div>
                      </td>
                      <td><span className={`font-mono text-xs font-medium ${r.qty < 0 ? 'text-[var(--warning)]' : 'text-[var(--success)]'}`}>{fmtQty(r.qty)}</span></td>
                      <td><span className="font-mono text-xs">{fmtAED(r.total_value)}</span></td>
                      <td><span className="text-xs text-[var(--text-secondary)]">{r.from_name}</span></td>
                      <td><span className="text-xs text-[var(--text-secondary)]">{r.to_name}</span></td>
                      <td><span className="text-xs text-[var(--text-secondary)]">{r.received_by || '—'}</span></td>
                      <td><span className="font-mono text-xs text-[var(--text-secondary)]">{r.project_number || '—'}</span></td>
                      <td>
                        <button onClick={() => downloadReceipt(r)} title="Download handover receipt"
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[0.6875rem] border border-[var(--border-color)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] cursor-pointer">
                          <FileText size={11} /> Receipt
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* New movement modal */}
      {showAdd && (
        <div className="quote-modal-overlay" onClick={() => setShowAdd(false)}>
          <div className="quote-modal" onClick={e => e.stopPropagation()}>
            <div className="quote-modal-header">
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">Record goods movement</h3>
              <button onClick={() => setShowAdd(false)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"><X size={16} /></button>
            </div>
            <form onSubmit={handleRecord} className="quote-modal-body flex flex-col gap-4">
              {items.length === 0 && (
                <div className="text-xs text-[var(--status-warning-text)] bg-[var(--status-warning-bg)] border border-[var(--status-warning-border)] rounded-md p-2.5">
                  No stock items registered yet. Register items in the Store page first.
                </div>
              )}
              <div className="quote-form-grid">
                <div className="quote-form-group">
                  <label>Movement type</label>
                  <select className="quote-form-input" value={mForm.type} onChange={e => setMForm({ ...mForm, type: e.target.value as StockTransactionType })}>
                    <option value="GRN_RECEIPT">Receipt (+)</option>
                    <option value="RETURN_FROM_SITE">Return from site (+)</option>
                    <option value="ADJUSTMENT_IN">Adjustment in (+)</option>
                    <option value="ISSUE_TO_PROJECT">Issue to project (−)</option>
                    <option value="ISSUE_TO_TICKET">Issue to ticket (−)</option>
                    <option value="ADJUSTMENT_OUT">Adjustment out (−)</option>
                    <option value="WRITE_OFF">Write-off / damaged (−)</option>
                  </select>
                </div>
                <div className="quote-form-group">
                  <label>Item</label>
                  <select className="quote-form-input" value={mForm.stock_item_id} onChange={e => setMForm({ ...mForm, stock_item_id: e.target.value })}>
                    <option value="">Select item…</option>
                    {items.map(it => <option key={it.id} value={it.id}>{it.item_code} — {it.description}</option>)}
                  </select>
                </div>
                <div className="quote-form-group">
                  <label>Location</label>
                  <select className="quote-form-input" value={mForm.location_id} onChange={e => setMForm({ ...mForm, location_id: e.target.value })}>
                    <option value="">Select location…</option>
                    {locations.map(l => <option key={l.id} value={l.id}>{l.location_code} — {l.name}</option>)}
                  </select>
                </div>
                <div className="quote-form-group">
                  <label>Quantity</label>
                  <input type="number" step="any" className="quote-form-input" value={mForm.quantity} onChange={e => setMForm({ ...mForm, quantity: e.target.value })} placeholder="Positive amount" />
                </div>
                <div className="quote-form-group">
                  <label>Unit cost (AED)</label>
                  <input type="number" step="any" className="quote-form-input" value={mForm.unit_cost} onChange={e => setMForm({ ...mForm, unit_cost: e.target.value })} placeholder="0.00" />
                </div>
                <div className="quote-form-group">
                  <label>Project (optional)</label>
                  <select className="quote-form-input" value={mForm.project_id} onChange={e => setMForm({ ...mForm, project_id: e.target.value })}>
                    <option value="">—</option>
                    {projects.map(p => <option key={p.id} value={p.id}>{p.project_number}</option>)}
                  </select>
                </div>
              </div>
              <div className="quote-form-group">
                <label>Received by (handover receipt)</label>
                <input className="quote-form-input" value={mForm.received_by} onChange={e => setMForm({ ...mForm, received_by: e.target.value })} placeholder="Name of person receiving the goods" />
              </div>
              <div className="quote-form-group">
                <label>Reason / note (optional)</label>
                <input className="quote-form-input" value={mForm.reason} onChange={e => setMForm({ ...mForm, reason: e.target.value })} placeholder="e.g. transferred to site, damaged in transit…" />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="secondary" size="sm" onClick={() => setShowAdd(false)}>Cancel</Button>
                <Button variant="primary" size="sm" type="submit" icon={Save} isLoading={busy} disabled={items.length === 0 || locations.length === 0}>Record movement</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
