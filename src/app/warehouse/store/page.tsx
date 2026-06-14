'use client';

// ============================================================
// JEET ERP — Store (Stock on hand + risk)
// Registered goods/materials with quantities across locations
// and stock-risk indicators (out / below reorder level).
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';
import warehouseService, { StockRow } from '@/services/warehouseService';
import stockTransactionService from '@/services/stockTransactionService';
import type { StockTransactionType } from '@/types/stock.types';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Package, Search, AlertTriangle, Plus, MapPin, X, Save, ArrowLeftRight } from 'lucide-react';

// Movement types offered from the Store, mapped to ledger transaction types.
// dir OUT => stock leaves (negative qty); IN => stock enters (positive qty).
type MoveDef = {
  value: StockTransactionType; label: string; dir: 'IN' | 'OUT';
  needsProject?: boolean; needsCounterparty?: boolean; allowProject?: boolean;
};
const MOVEMENT_TYPES: MoveDef[] = [
  { value: 'ISSUE_TO_PROJECT', label: 'Issue to project / site', dir: 'OUT', needsProject: true },
  { value: 'RETURN_FROM_SITE', label: 'Return from site', dir: 'IN', allowProject: true },
  { value: 'RETURN_TO_SUPPLIER', label: 'Return to supplier (refund / replace)', dir: 'OUT' },
  { value: 'WRITE_OFF', label: 'Damaged / write-off', dir: 'OUT' },
  { value: 'TRANSFER_OUT', label: 'Transfer to another store', dir: 'OUT', needsCounterparty: true },
  { value: 'ADJUSTMENT_IN', label: 'Adjustment — add (+)', dir: 'IN' },
  { value: 'ADJUSTMENT_OUT', label: 'Adjustment — remove (−)', dir: 'OUT' },
];

const RISK: Record<string, { label: string; bg: string; text: string; border: string }> = {
  OUT: { label: 'Out of stock', bg: 'var(--status-danger-bg)', text: 'var(--status-danger-text)', border: 'var(--status-danger-border)' },
  LOW: { label: 'Below reorder', bg: 'var(--status-warning-bg)', text: 'var(--status-warning-text)', border: 'var(--status-warning-border)' },
  OK: { label: 'In stock', bg: 'var(--status-success-bg)', text: 'var(--status-success-text)', border: 'var(--status-success-border)' },
  NONE: { label: '—', bg: 'var(--status-neutral-bg)', text: 'var(--status-neutral-text)', border: 'var(--status-neutral-border)' },
};

const fmtAED = (v: number) => new Intl.NumberFormat('en-AE', { maximumFractionDigits: 0 }).format(v) + ' AED';
const fmtQty = (v: number) => new Intl.NumberFormat('en-AE', { maximumFractionDigits: 3 }).format(v);

export default function StorePage() {
  const [rows, setRows] = useState<StockRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [riskOnly, setRiskOnly] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Register stock item modal
  const [showRegister, setShowRegister] = useState(false);
  const [registerable, setRegisterable] = useState<{ id: string; item_code: string; description: string; unit: string }[]>([]);
  const [regForm, setRegForm] = useState({ pricing_item_id: '', reorder_level: '', reorder_qty: '' });

  // Location modal
  const [showLocation, setShowLocation] = useState(false);
  const [locForm, setLocForm] = useState({ name: '', location_code: '', type: 'MAIN_STORE' });

  // Movement modal
  const [moveRow, setMoveRow] = useState<StockRow | null>(null);
  const [moveBalances, setMoveBalances] = useState<{ location_id: string; location_name: string; qty_on_hand: number; qty_available: number; avg_unit_cost: number }[]>([]);
  const [projects, setProjects] = useState<{ id: string; project_number: string }[]>([]);
  const [locations, setLocations] = useState<{ id: string; name: string; location_code: string; type: string }[]>([]);
  const [moveForm, setMoveForm] = useState({
    type: 'ISSUE_TO_PROJECT' as StockTransactionType,
    location_id: '', qty: '', project_id: '', counterparty_location_id: '', reason: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    try { setRows(await warehouseService.getStock()); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const openRegister = async () => {
    try {
      setRegisterable(await warehouseService.getRegisterableItems());
      setShowRegister(true);
    } catch (err: any) { setError(err.message); }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regForm.pricing_item_id) return;
    setBusy(true);
    try {
      await warehouseService.registerStockItem({
        pricing_item_id: regForm.pricing_item_id,
        reorder_level: regForm.reorder_level ? Number(regForm.reorder_level) : null,
        reorder_qty: regForm.reorder_qty ? Number(regForm.reorder_qty) : null,
      });
      setShowRegister(false);
      setRegForm({ pricing_item_id: '', reorder_level: '', reorder_qty: '' });
      await load();
    } catch (err: any) {
      setError(err.message?.includes('audit_log') || err.message?.includes('table_name')
        ? 'Could not register — apply migration 20260613160000 (pricing audit trigger fix).'
        : err.message || 'Failed to register stock item');
    } finally { setBusy(false); }
  };

  const handleCreateLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!locForm.name.trim() || !locForm.location_code.trim()) return;
    setBusy(true);
    try {
      await warehouseService.createLocation(locForm);
      setShowLocation(false);
      setLocForm({ name: '', location_code: '', type: 'MAIN_STORE' });
    } catch (err: any) {
      setError(err.message || 'Failed to create location');
    } finally { setBusy(false); }
  };

  const openMove = async (row: StockRow) => {
    setMoveRow(row);
    setMoveForm({ type: 'ISSUE_TO_PROJECT', location_id: '', qty: '', project_id: '', counterparty_location_id: '', reason: '' });
    try {
      const [bals, projs, locs] = await Promise.all([
        warehouseService.getItemBalances(row.stock_item_id),
        warehouseService.getProjects(),
        warehouseService.getLocations(),
      ]);
      setMoveBalances(bals);
      setProjects(projs);
      setLocations(locs);
      // default to the location holding the most stock
      const best = [...bals].sort((a, b) => b.qty_on_hand - a.qty_on_hand)[0];
      if (best) setMoveForm(f => ({ ...f, location_id: best.location_id }));
    } catch (err: any) {
      setError(err.message || 'Failed to load movement data');
    }
  };

  const moveDef = MOVEMENT_TYPES.find(m => m.value === moveForm.type)!;
  const srcBalance = moveBalances.find(b => b.location_id === moveForm.location_id);

  const handleMove = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!moveRow) return;
    const qty = Number(moveForm.qty);
    if (!moveForm.location_id) { setError('Choose the store location.'); return; }
    if (!(qty > 0)) { setError('Enter a quantity greater than zero.'); return; }
    if (moveDef.needsProject && !moveForm.project_id) { setError('Select the project this is issued to.'); return; }
    if (moveDef.needsCounterparty && !moveForm.counterparty_location_id) { setError('Select the destination store.'); return; }

    setBusy(true);
    try {
      const unitCost = srcBalance?.avg_unit_cost || moveRow.avg_unit_cost || 0;
      const signedQty = moveDef.dir === 'OUT' ? -Math.abs(qty) : Math.abs(qty);
      const isTransfer = moveForm.type === 'TRANSFER_OUT';

      await stockTransactionService.recordTransaction({
        type: moveForm.type,
        stock_item_id: moveRow.stock_item_id,
        location_id: moveForm.location_id,
        qty: signedQty,
        unit_cost: unitCost,
        total_value: Math.abs(qty) * unitCost,
        source_type: isTransfer ? 'TRANSFER' : 'MANUAL',
        source_id: null,
        project_id: (moveDef.needsProject || moveDef.allowProject) && moveForm.project_id ? moveForm.project_id : null,
        counterparty_location_id: isTransfer ? moveForm.counterparty_location_id : null,
        reason: moveForm.reason || null,
      } as any);

      // For a transfer, post the matching inbound leg at the destination store
      if (isTransfer) {
        await stockTransactionService.recordTransaction({
          type: 'TRANSFER_IN',
          stock_item_id: moveRow.stock_item_id,
          location_id: moveForm.counterparty_location_id,
          qty: Math.abs(qty),
          unit_cost: unitCost,
          total_value: Math.abs(qty) * unitCost,
          source_type: 'TRANSFER',
          source_id: null,
          project_id: null,
          counterparty_location_id: moveForm.location_id,
          reason: moveForm.reason || null,
        } as any);
      }

      setMoveRow(null);
      await load();
    } catch (err: any) {
      setError(err.message || 'Failed to record movement');
    } finally { setBusy(false); }
  };

  const filtered = rows.filter(r => {
    if (riskOnly && !(r.risk === 'OUT' || r.risk === 'LOW')) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return r.item_code.toLowerCase().includes(q) || r.description.toLowerCase().includes(q);
  });

  const totalValue = rows.reduce((s, r) => s + r.stock_value, 0);
  const atRisk = rows.filter(r => r.risk === 'OUT' || r.risk === 'LOW').length;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Store"
        subtitle="Registered goods and materials on hand, valuation and stock-risk alerts"
        breadcrumbs={[{ label: 'Warehouse', href: '/warehouse' }, { label: 'Store' }]}
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" icon={MapPin} onClick={() => setShowLocation(true)}>New location</Button>
            <Button variant="primary" size="sm" icon={Plus} onClick={openRegister}>Register item</Button>
          </div>
        }
      />

      {error && (
        <div className="flex items-center justify-between gap-3 bg-[var(--status-danger-bg)] border border-[var(--status-danger-border)] rounded-lg p-3 text-xs text-[var(--status-danger-text)]">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="cursor-pointer"><X size={13} /></button>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Stock items', value: rows.length },
          { label: 'Stock value', value: fmtAED(totalValue) },
          { label: 'At risk', value: atRisk, alert: atRisk > 0 },
          { label: 'Out of stock', value: rows.filter(r => r.risk === 'OUT').length, alert: rows.some(r => r.risk === 'OUT') },
        ].map(k => (
          <div key={k.label} className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg p-3">
            <span className="text-xs text-[var(--text-muted)] block">{k.label}</span>
            <span className={`text-lg font-semibold ${k.alert ? 'text-[var(--error)]' : 'text-[var(--text-primary)]'}`}>{k.value}</span>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" size={14} />
          <input className="quote-form-input w-full !pl-9" placeholder="Search item code or description…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)] cursor-pointer">
          <input type="checkbox" checked={riskOnly} onChange={e => setRiskOnly(e.target.checked)} /> At-risk only
        </label>
      </div>

      {loading ? (
        <div className="py-20 flex justify-center"><div className="h-7 w-7 border-2 border-[var(--border-color)] border-t-[var(--text-primary)] animate-spin rounded-full" /></div>
      ) : rows.length === 0 ? (
        <EmptyState icon={Package} title="No stock registered yet" description="Stock appears here automatically as goods are received (GRN) into store locations. Register stock items and locations to begin tracking on-hand quantities and risk." />
      ) : filtered.length === 0 ? (
        <EmptyState icon={Search} title="No matches" description="No stock items match your filters." />
      ) : (
        <Card padding={false}>
          <div className="quote-table-wrap !border-0 !rounded-none">
            <table className="quote-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>On hand</th>
                  <th>Available</th>
                  <th>Reserved</th>
                  <th>Avg cost</th>
                  <th>Value</th>
                  <th>Reorder</th>
                  <th>Status</th>
                  <th>Movement</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => {
                  const rk = RISK[r.risk];
                  return (
                    <tr key={r.stock_item_id}>
                      <td>
                        <div className="flex flex-col">
                          <span className="font-medium text-[var(--text-primary)] text-xs">{r.description}</span>
                          <span className="font-mono text-[0.6875rem] text-[var(--text-muted)]">{r.item_code} · {r.unit}</span>
                        </div>
                      </td>
                      <td><span className="font-mono text-xs">{fmtQty(r.qty_on_hand)}</span></td>
                      <td><span className="font-mono text-xs">{fmtQty(r.qty_available)}</span></td>
                      <td><span className="font-mono text-xs text-[var(--text-muted)]">{fmtQty(r.qty_reserved)}</span></td>
                      <td><span className="font-mono text-xs">{r.avg_unit_cost.toFixed(2)}</span></td>
                      <td><span className="font-mono text-xs">{fmtAED(r.stock_value)}</span></td>
                      <td><span className="font-mono text-xs text-[var(--text-muted)]">{r.reorder_level != null ? fmtQty(r.reorder_level) : '—'}</span></td>
                      <td>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[0.6875rem] font-medium border"
                          style={{ backgroundColor: rk.bg, color: rk.text, borderColor: rk.border }}>
                          {(r.risk === 'OUT' || r.risk === 'LOW') && <AlertTriangle size={10} />}
                          {rk.label}
                        </span>
                      </td>
                      <td>
                        <button
                          onClick={() => openMove(r)}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[0.6875rem] font-medium border border-[var(--border-color)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] cursor-pointer"
                          title="Record a stock movement (issue, return, transfer, write-off…)"
                        >
                          <ArrowLeftRight size={11} /> Move
                        </button>
                        {r.last_movement_at && (
                          <div className="text-[0.625rem] text-[var(--text-muted)] mt-0.5">
                            {new Date(r.last_movement_at).toLocaleDateString('en-AE', { day: '2-digit', month: 'short' })}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Register stock item modal */}
      {showRegister && (
        <div className="quote-modal-overlay" onClick={() => setShowRegister(false)}>
          <div className="quote-modal" onClick={e => e.stopPropagation()}>
            <div className="quote-modal-header">
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">Register stock item</h3>
              <button onClick={() => setShowRegister(false)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"><X size={16} /></button>
            </div>
            <form onSubmit={handleRegister} className="quote-modal-body flex flex-col gap-4">
              <div className="quote-form-group">
                <label>Catalogue item *</label>
                <select className="quote-form-input" value={regForm.pricing_item_id} onChange={e => setRegForm({ ...regForm, pricing_item_id: e.target.value })}>
                  <option value="">Select an item…</option>
                  {registerable.map(it => <option key={it.id} value={it.id}>{it.item_code} — {it.description}</option>)}
                </select>
                {registerable.length === 0 && <span className="text-xs text-[var(--text-muted)] mt-1">All catalogue items are already registered as stock items.</span>}
              </div>
              <div className="quote-form-grid">
                <div className="quote-form-group">
                  <label>Reorder level</label>
                  <input type="number" className="quote-form-input" value={regForm.reorder_level} onChange={e => setRegForm({ ...regForm, reorder_level: e.target.value })} placeholder="e.g. 10" />
                </div>
                <div className="quote-form-group">
                  <label>Reorder qty</label>
                  <input type="number" className="quote-form-input" value={regForm.reorder_qty} onChange={e => setRegForm({ ...regForm, reorder_qty: e.target.value })} placeholder="e.g. 50" />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="secondary" size="sm" onClick={() => setShowRegister(false)}>Cancel</Button>
                <Button variant="primary" size="sm" type="submit" icon={Save} isLoading={busy} disabled={!regForm.pricing_item_id}>Register</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New location modal */}
      {showLocation && (
        <div className="quote-modal-overlay" onClick={() => setShowLocation(false)}>
          <div className="quote-modal" onClick={e => e.stopPropagation()}>
            <div className="quote-modal-header">
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">New store location</h3>
              <button onClick={() => setShowLocation(false)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"><X size={16} /></button>
            </div>
            <form onSubmit={handleCreateLocation} className="quote-modal-body flex flex-col gap-4">
              <div className="quote-form-grid">
                <div className="quote-form-group">
                  <label>Location code *</label>
                  <input className="quote-form-input font-mono" value={locForm.location_code} onChange={e => setLocForm({ ...locForm, location_code: e.target.value })} placeholder="e.g. MAIN-DXB" />
                </div>
                <div className="quote-form-group">
                  <label>Name *</label>
                  <input className="quote-form-input" value={locForm.name} onChange={e => setLocForm({ ...locForm, name: e.target.value })} placeholder="e.g. Main Store Dubai" />
                </div>
                <div className="quote-form-group">
                  <label>Type</label>
                  <select className="quote-form-input" value={locForm.type} onChange={e => setLocForm({ ...locForm, type: e.target.value })}>
                    <option value="MAIN_STORE">Main store</option>
                    <option value="SUB_STORE">Sub store</option>
                    <option value="PROJECT_SITE">Project site</option>
                    <option value="VAN">Van</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="secondary" size="sm" onClick={() => setShowLocation(false)}>Cancel</Button>
                <Button variant="primary" size="sm" type="submit" icon={Save} isLoading={busy}>Create location</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stock movement modal */}
      {moveRow && (
        <div className="quote-modal-overlay" onClick={() => setMoveRow(null)}>
          <div className="quote-modal" onClick={e => e.stopPropagation()}>
            <div className="quote-modal-header">
              <div>
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">Record stock movement</h3>
                <p className="text-[0.6875rem] text-[var(--text-muted)] mt-0.5">{moveRow.description} · {moveRow.item_code}</p>
              </div>
              <button onClick={() => setMoveRow(null)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"><X size={16} /></button>
            </div>
            <form onSubmit={handleMove} className="quote-modal-body flex flex-col gap-4">
              <div className="quote-form-group">
                <label>Movement / status *</label>
                <select className="quote-form-input" value={moveForm.type}
                  onChange={e => setMoveForm({ ...moveForm, type: e.target.value as StockTransactionType })}>
                  {MOVEMENT_TYPES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>

              <div className="quote-form-grid">
                <div className="quote-form-group">
                  <label>{moveDef.dir === 'IN' ? 'Into store' : 'From store'} *</label>
                  <select className="quote-form-input" value={moveForm.location_id}
                    onChange={e => setMoveForm({ ...moveForm, location_id: e.target.value })}>
                    <option value="">Select location…</option>
                    {(moveDef.dir === 'OUT' ? moveBalances.map(b => ({ id: b.location_id, label: `${b.location_name} (on hand ${b.qty_on_hand})` }))
                      : locations.map(l => ({ id: l.id, label: l.name }))
                    ).map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                  </select>
                  {moveDef.dir === 'OUT' && srcBalance && (
                    <span className="text-[0.6875rem] text-[var(--text-muted)] mt-1">Available: {srcBalance.qty_available} · avg cost {srcBalance.avg_unit_cost.toFixed(2)}</span>
                  )}
                </div>
                <div className="quote-form-group">
                  <label>Quantity *</label>
                  <input type="number" min="0" step="any" className="quote-form-input" value={moveForm.qty}
                    onChange={e => setMoveForm({ ...moveForm, qty: e.target.value })} placeholder="0" />
                </div>
              </div>

              {moveDef.needsCounterparty && (
                <div className="quote-form-group">
                  <label>Destination store *</label>
                  <select className="quote-form-input" value={moveForm.counterparty_location_id}
                    onChange={e => setMoveForm({ ...moveForm, counterparty_location_id: e.target.value })}>
                    <option value="">Select destination…</option>
                    {locations.filter(l => l.id !== moveForm.location_id).map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                </div>
              )}

              {(moveDef.needsProject || moveDef.allowProject) && (
                <div className="quote-form-group">
                  <label>Project {moveDef.needsProject ? '*' : '(for cost allocation)'}</label>
                  <select className="quote-form-input" value={moveForm.project_id}
                    onChange={e => setMoveForm({ ...moveForm, project_id: e.target.value })}>
                    <option value="">{moveDef.needsProject ? 'Select project…' : 'No project'}</option>
                    {projects.map(p => <option key={p.id} value={p.id}>{p.project_number}</option>)}
                  </select>
                </div>
              )}

              <div className="quote-form-group">
                <label>Reason / note</label>
                <input className="quote-form-input" value={moveForm.reason}
                  onChange={e => setMoveForm({ ...moveForm, reason: e.target.value })}
                  placeholder={moveForm.type === 'WRITE_OFF' ? 'e.g. damaged on site' : moveForm.type === 'RETURN_TO_SUPPLIER' ? 'e.g. faulty, returned for refund' : 'optional'} />
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="secondary" size="sm" onClick={() => setMoveRow(null)}>Cancel</Button>
                <Button variant="primary" size="sm" type="submit" icon={ArrowLeftRight} isLoading={busy}>Record movement</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
