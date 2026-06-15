'use client';

// ============================================================
// JEET ERP — Warehouse: MRF detail (approve / issue / return)
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import mrfService from '@/services/mrfService';
import type { MaterialRequisition } from '@/types/stock.types';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { exportTablePdf, exportTableExcel } from '@/lib/finance-export';
import { ArrowLeft, CheckCircle2, PackageCheck, FileDown, Sheet } from 'lucide-react';

const num = (n: number) => Number(n || 0).toLocaleString('en-AE', { maximumFractionDigits: 3 });
const statusStyle: Record<string, { bg: string; tx: string }> = {
  DRAFT: { bg: 'var(--status-neutral-bg)', tx: 'var(--status-neutral-text)' },
  SUBMITTED: { bg: 'var(--status-info-bg)', tx: 'var(--status-info-text)' },
  APPROVED: { bg: 'var(--status-success-bg)', tx: 'var(--status-success-text)' },
  PARTIALLY_ISSUED: { bg: 'var(--status-warning-bg)', tx: 'var(--status-warning-text)' },
  ISSUED: { bg: 'var(--status-success-bg)', tx: 'var(--status-success-text)' },
  REJECTED: { bg: 'var(--status-danger-bg)', tx: 'var(--status-danger-text)' },
};

export default function MRFDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = String(params.id);
  const [mrf, setMrf] = useState<MaterialRequisition | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [approveQty, setApproveQty] = useState<Record<string, string>>({});
  const [issueQty, setIssueQty] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const m = await mrfService.getMRFDetail(id);
      setMrf(m);
      const aq: Record<string, string> = {}, iq: Record<string, string> = {};
      (m.items || []).forEach(it => { aq[it.id] = String(it.qty_approved || it.qty_requested); iq[it.id] = ''; });
      setApproveQty(aq); setIssueQty(iq);
    } finally { setLoading(false); }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const canApprove = mrf?.status === 'DRAFT' || mrf?.status === 'SUBMITTED';
  const canIssue = mrf?.status === 'APPROVED' || mrf?.status === 'PARTIALLY_ISSUED';

  const approve = async () => {
    if (!mrf) return;
    setBusy(true);
    try {
      await mrfService.approveMRF(id, (mrf.items || []).map(it => ({ id: it.id, qty_approved: Number(approveQty[it.id]) || 0 })));
      await load();
    } catch (e: any) { alert(e?.message || 'Approve failed'); } finally { setBusy(false); }
  };

  const issue = async () => {
    if (!mrf) return;
    const toIssue = (mrf.items || []).map(it => ({ id: it.id, qty_to_issue: Number(issueQty[it.id]) || 0 })).filter(x => x.qty_to_issue > 0);
    if (!toIssue.length) { alert('Enter a quantity to issue on at least one line.'); return; }
    setBusy(true);
    try {
      await mrfService.issueMRF(id, toIssue);
      await load();
      alert('Materials issued. Stock decremented and project actual cost updated.');
    } catch (e: any) { alert(e?.message || 'Issue failed'); } finally { setBusy(false); }
  };

  const exportCols = ['Item', 'Description', 'Unit', 'Requested', 'Approved', 'Issued'];
  const exportRows = (mrf?.items || []).map(it => [it.item_code || '', it.description || '', it.unit || '', num(it.qty_requested), num(it.qty_approved), num(it.qty_issued)]);

  if (loading) return <Card><div className="p-8 text-center text-sm text-[var(--text-tertiary)]">Loading requisition…</div></Card>;
  if (!mrf) return <Card><div className="p-8 text-center text-sm text-[var(--text-tertiary)]">Requisition not found.</div></Card>;
  const st = statusStyle[mrf.status] || statusStyle.DRAFT;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={`MRF ${mrf.mrf_number}`}
        subtitle={`${mrf.project_number || mrf.project_name || ''} · from ${mrf.location_name || ''} · needed ${mrf.needed_by || '—'}`}
        breadcrumbs={[{ label: 'Warehouse', href: '/warehouse' }, { label: 'Requisitions', href: '/warehouse/mrf' }, { label: mrf.mrf_number }]}
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" icon={ArrowLeft} onClick={() => router.push('/warehouse/mrf')}>Back</Button>
            <Button variant="secondary" icon={FileDown} onClick={() => exportTablePdf({ title: `MRF ${mrf.mrf_number}`, subtitle: `${mrf.project_number || ''} · ${mrf.location_name || ''}`, columns: exportCols, rows: exportRows, fileName: `mrf-${mrf.mrf_number}` })}>PDF</Button>
            <Button variant="secondary" icon={Sheet} onClick={() => exportTableExcel({ title: `MRF ${mrf.mrf_number}`, columns: exportCols, rows: exportRows, fileName: `mrf-${mrf.mrf_number}` })}>Excel</Button>
            {canApprove && <Button icon={CheckCircle2} onClick={approve} isLoading={busy}>Approve</Button>}
            {canIssue && <Button icon={PackageCheck} onClick={issue} isLoading={busy}>Issue</Button>}
          </div>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Status</div><div className="mt-1"><span className="text-xs px-2 py-0.5 rounded-full" style={{ background: st.bg, color: st.tx }}>{mrf.status.replace('_', ' ')}</span></div></Card>
        <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Items</div><div className="text-2xl font-bold mt-1">{mrf.items?.length || 0}</div></Card>
        <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Requester</div><div className="text-sm font-medium mt-1">{mrf.requester_name || '—'}</div></Card>
        <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Notes</div><div className="text-xs mt-1 text-[var(--text-secondary)] line-clamp-2">{mrf.notes || '—'}</div></Card>
      </div>

      {canApprove && <Card className="p-3" style={{ background: 'var(--status-info-bg)' }}><div className="text-xs" style={{ color: 'var(--status-info-text)' }}>Set approved quantities below, then <strong>Approve</strong> to reserve stock.</div></Card>}
      {canIssue && <Card className="p-3" style={{ background: 'var(--status-warning-bg)' }}><div className="text-xs" style={{ color: 'var(--status-warning-text)' }}>Enter quantities to issue (≤ approved − already issued), then <strong>Issue</strong>.</div></Card>}

      <Card className="p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-[var(--border)] text-left text-[var(--text-tertiary)] text-xs">
            <th className="p-3">Item</th><th className="p-3 text-right">Requested</th>
            <th className="p-3 text-right">Approved</th><th className="p-3 text-right">Issued</th>
            {canIssue && <th className="p-3 text-right">Issue now</th>}
          </tr></thead>
          <tbody>
            {(mrf.items || []).map(it => {
              const remaining = Number(it.qty_approved) - Number(it.qty_issued);
              return (
                <tr key={it.id} className="border-b border-[var(--border)] last:border-0">
                  <td className="p-3"><div className="font-medium text-[var(--text-primary)]">{it.item_code}</div><div className="text-[11px] text-[var(--text-tertiary)] line-clamp-1">{it.description}{it.unit ? ` · ${it.unit}` : ''}</div></td>
                  <td className="p-3 text-right tabular-nums text-[var(--text-secondary)]">{num(it.qty_requested)}</td>
                  <td className="p-3 text-right">
                    {canApprove ? (
                      <input type="number" value={approveQty[it.id] ?? ''} onChange={e => setApproveQty(s => ({ ...s, [it.id]: e.target.value }))} className="w-24 px-2 h-8 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm text-right tabular-nums" />
                    ) : <span className="tabular-nums">{num(it.qty_approved)}</span>}
                  </td>
                  <td className="p-3 text-right tabular-nums text-[var(--text-secondary)]">{num(it.qty_issued)}</td>
                  {canIssue && (
                    <td className="p-3 text-right">
                      <input type="number" max={remaining} placeholder={`≤ ${num(remaining)}`} value={issueQty[it.id] ?? ''} onChange={e => setIssueQty(s => ({ ...s, [it.id]: e.target.value }))} className="w-24 px-2 h-8 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm text-right tabular-nums" disabled={remaining <= 0} />
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
