'use client';

// ============================================================
// JEET ERP — GRN Receivables
// Every line item awaiting receipt across open LPOs and approved/
// direct-purchased PRs, with project, supplier, delivery status
// and payment status. Receive or cancel per item.
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import grnReceivablesService, { ReceivableItem } from '@/services/grnReceivablesService';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { PackageCheck, Search, X, Truck, Ban } from 'lucide-react';

const STATUS_COLOR: Record<string, { bg: string; text: string; border: string }> = {
  PENDING: { bg: 'var(--status-warning-bg)', text: 'var(--status-warning-text)', border: 'var(--status-warning-border)' },
  PARTIAL: { bg: 'var(--status-info-bg)', text: 'var(--status-info-text)', border: 'var(--status-info-border)' },
  REQUESTED: { bg: 'var(--status-neutral-bg)', text: 'var(--status-neutral-text)', border: 'var(--status-neutral-border)' },
  DIRECT_PURCHASED: { bg: 'var(--status-success-bg)', text: 'var(--status-success-text)', border: 'var(--status-success-border)' },
};
const PAY_COLOR: Record<string, { label: string; bg: string; text: string; border: string }> = {
  PAID: { label: 'Paid', bg: 'var(--status-success-bg)', text: 'var(--status-success-text)', border: 'var(--status-success-border)' },
  PARTIAL: { label: 'Partly paid', bg: 'var(--status-info-bg)', text: 'var(--status-info-text)', border: 'var(--status-info-border)' },
  PENDING: { label: 'Payment due', bg: 'var(--status-warning-bg)', text: 'var(--status-warning-text)', border: 'var(--status-warning-border)' },
  NOT_INVOICED: { label: 'Not invoiced', bg: 'var(--status-neutral-bg)', text: 'var(--status-neutral-text)', border: 'var(--status-neutral-border)' },
};

const fmtQty = (v: number) => new Intl.NumberFormat('en-AE', { maximumFractionDigits: 3 }).format(v);
const fmtDate = (d?: string | null) => d ? new Date(d).toLocaleDateString('en-AE', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

export default function GRNReceivablesPage() {
  const router = useRouter();
  const [rows, setRows] = useState<ReceivableItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setLoading(true); setRows(await grnReceivablesService.getReceivables()); setError(null); }
    catch (err: any) { setError(err.message || 'Failed to load receivables'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const cancelItem = async (it: ReceivableItem) => {
    if (!it.po_item_id) return;
    const what = it.source === 'LPO'
      ? `Cancel "${it.description}" from ${it.source_ref}? It will be closed short; if it is the last open line the LPO is cancelled too.`
      : `Cancel "${it.description}" from ${it.source_ref}? If it is the last open line the PR is cancelled too.`;
    if (!window.confirm(what)) return;
    setBusy(it.po_item_id);
    try {
      if (it.source === 'LPO') await grnReceivablesService.cancelLineItem(it.po_item_id);
      else await grnReceivablesService.cancelPRLineItem(it.po_item_id);
      await load();
    } catch (err: any) { setError(err.message || 'Cancel failed'); }
    finally { setBusy(null); }
  };

  const filtered = rows.filter(r =>
    !search ||
    r.description.toLowerCase().includes(search.toLowerCase()) ||
    r.source_ref.toLowerCase().includes(search.toLowerCase()) ||
    (r.project_number || '').toLowerCase().includes(search.toLowerCase()) ||
    (r.supplier_name || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="GRN Receivables"
        subtitle="All items awaiting receipt across open LPOs and approved/direct-purchased PRs — with project, delivery and payment status"
        breadcrumbs={[{ label: 'Procurement', href: '/procurement/po' }, { label: 'Goods Receipt', href: '/procurement/grn' }, { label: 'Receivables' }]}
        actions={<Button size="sm" variant="secondary" onClick={() => router.push('/procurement/grn')}>Back to GRNs</Button>}
      />

      {error && (
        <div className="flex items-center justify-between gap-3 bg-[var(--status-danger-bg)] border border-[var(--status-danger-border)] rounded-lg p-3 text-xs text-[var(--status-danger-text)]">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="cursor-pointer"><X size={13} /></button>
        </div>
      )}

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" size={14} />
        <input className="quote-form-input w-full !pl-9" placeholder="Search item, LPO/PR, project, supplier…" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {loading ? (
        <div className="py-20 flex justify-center"><div className="h-7 w-7 border-2 border-[var(--border-color)] border-t-[var(--text-primary)] animate-spin rounded-full" /></div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={PackageCheck} title="Nothing awaiting receipt" description="Items from approved LPOs and PRs that still have outstanding quantity appear here." />
      ) : (
        <Card padding={false}>
          <div className="quote-table-wrap !border-0 !rounded-none">
            <table className="quote-table">
              <thead>
                <tr>
                  <th>Source</th>
                  <th>Item</th>
                  <th>Project</th>
                  <th>Supplier</th>
                  <th>Ordered</th>
                  <th>Received</th>
                  <th>Outstanding</th>
                  <th>Required</th>
                  <th>Line status</th>
                  <th>Payment</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((it, idx) => {
                  const sc = STATUS_COLOR[it.line_status] || STATUS_COLOR.PENDING;
                  const pc = PAY_COLOR[it.payment_status] || PAY_COLOR.NOT_INVOICED;
                  return (
                    <tr key={(it.po_item_id || it.source_id) + idx}>
                      <td>
                        <Link href={it.source === 'LPO' ? `/procurement/po/${it.source_id}` : `/procurement/pr/${it.source_id}`} className="font-mono text-xs font-medium text-[var(--primary)] hover:underline">
                          {it.source_ref}
                        </Link>
                        <div className="text-[0.625rem] text-[var(--text-muted)]">{it.source}</div>
                      </td>
                      <td>
                        <div className="text-xs text-[var(--text-primary)]">{it.description}</div>
                        {it.system && <div className="text-[0.625rem] text-[var(--text-muted)]">{it.system}</div>}
                      </td>
                      <td><span className="font-mono text-xs text-[var(--text-secondary)]">{it.project_number || (it.project_id ? '—' : 'Overhead')}</span></td>
                      <td><span className="text-xs text-[var(--text-secondary)]">{it.supplier_name || '—'}</span></td>
                      <td><span className="font-mono text-xs">{fmtQty(it.ordered_qty)} {it.unit}</span></td>
                      <td><span className="font-mono text-xs text-[var(--text-muted)]">{fmtQty(it.received_qty)}</span></td>
                      <td><span className="font-mono text-xs font-medium">{fmtQty(it.outstanding_qty)}</span></td>
                      <td><span className="font-mono text-[0.6875rem] text-[var(--text-muted)]">{fmtDate(it.required_delivery_date)}</span></td>
                      <td>
                        <span className="inline-flex px-2 py-0.5 rounded-md text-[0.625rem] font-medium border" style={{ backgroundColor: sc.bg, color: sc.text, borderColor: sc.border }}>
                          {it.line_status.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td>
                        <span className="inline-flex flex-col">
                          <span className="inline-flex px-2 py-0.5 rounded-md text-[0.625rem] font-medium border w-fit" style={{ backgroundColor: pc.bg, color: pc.text, borderColor: pc.border }}>
                            {pc.label}
                          </span>
                          {it.payment_status === 'PENDING' && it.payment_due_date && (
                            <span className="text-[0.6rem] text-[var(--text-muted)] mt-0.5">due {fmtDate(it.payment_due_date)}</span>
                          )}
                        </span>
                      </td>
                      <td>
                        <div className="flex gap-1 justify-end">
                          {it.source === 'LPO' && (
                            <Button size="sm" variant="muted" icon={Truck} onClick={() => router.push(`/procurement/grn/create?po_id=${it.source_id}`)} title="Receive against this LPO" />
                          )}
                          {it.po_item_id && (
                            <Button size="sm" variant="muted" icon={Ban} disabled={busy !== null} onClick={() => cancelItem(it)} title="Cancel this line" />
                          )}
                        </div>
                      </td>
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
