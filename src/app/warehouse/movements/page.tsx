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
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Truck, Search } from 'lucide-react';

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

  const load = useCallback(async () => {
    setLoading(true);
    try { setRows(await warehouseService.getMovements()); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const filtered = rows.filter(r => {
    if (typeFilter && r.type !== typeFilter) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return r.item_code.toLowerCase().includes(q) || r.description.toLowerCase().includes(q) ||
      (r.project_number || '').toLowerCase().includes(q) || r.transaction_number.toLowerCase().includes(q);
  });

  const types = [...new Set(rows.map(r => r.type))];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Goods Movements"
        subtitle="Material movement across sites and projects — receipts, issues, returns, transfers, adjustments and write-offs"
        breadcrumbs={[{ label: 'Warehouse', href: '/warehouse' }, { label: 'Movements' }]}
      />

      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" size={14} />
          <input className="quote-form-input w-full !pl-9" placeholder="Search item, project, txn…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="quote-form-input max-w-[200px]" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
          <option value="">All movement types</option>
          {types.map(t => <option key={t} value={t}>{TYPE_META[t]?.label || t}</option>)}
        </select>
        <span className="text-xs text-[var(--text-muted)]">{filtered.length} movement{filtered.length === 1 ? '' : 's'}</span>
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
                  <th>Location</th>
                  <th>Project</th>
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
                      <td><span className="text-xs text-[var(--text-secondary)]">{r.location_name}</span></td>
                      <td><span className="font-mono text-xs text-[var(--text-secondary)]">{r.project_number || '—'}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
