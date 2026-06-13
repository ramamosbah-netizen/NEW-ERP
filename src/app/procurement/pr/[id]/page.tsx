'use client';

// ============================================================
// JEET ERP — Purchase Request detail + lifecycle + convert to LPO
// ============================================================

import React, { useState, useEffect, useCallback, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import prService from '@/services/prService';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { StatusChip } from '@/components/ui/StatusChip';
import { Send, CheckCircle, XCircle, ArrowRight, X, Download, Eye } from 'lucide-react';
import { prPDFService } from '@/lib/pr-pdf';

const fmtAED = (v: number) => new Intl.NumberFormat('en-AE', { minimumFractionDigits: 2 }).format(v) + ' AED';
const fmtDate = (d?: string | null) => d ? new Date(d).toLocaleDateString('en-AE', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const CATEGORY_LABEL: Record<string, string> = {
  PROJECT_MATERIAL: 'Project material', TOOLS: 'Tools', IT_EQUIPMENT: 'IT equipment',
  FURNITURE: 'Furniture', CONSUMABLES: 'Consumables', SAMPLE: 'Sample', SERVICES: 'Services', OTHER: 'Other',
};

export default function PRDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [pr, setPr] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [threshold, setThreshold] = useState(10000);

  const load = useCallback(async () => {
    try { setPr(await prService.get(id)); setError(null); }
    catch (err: any) { setError(err.message || 'Failed to load'); }
    finally { setLoading(false); }
  }, [id]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { prService.getDirectPurchaseThreshold().then(setThreshold).catch(() => {}); }, []);

  const act = async (fn: () => Promise<any>) => {
    setBusy(true);
    try { await fn(); await load(); }
    catch (err: any) { setError(err.message || 'Action failed'); }
    finally { setBusy(false); }
  };

  if (loading) return <div className="py-24 flex justify-center"><div className="h-7 w-7 border-2 border-[var(--border-color)] border-t-[var(--text-primary)] animate-spin rounded-full" /></div>;
  if (!pr) return <div className="py-24 text-center text-sm text-[var(--text-muted)]">{error || 'Not found'}</div>;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={pr.title}
        referenceId={pr.pr_number}
        status={pr.status}
        subtitle={`${CATEGORY_LABEL[pr.category] || pr.category}${pr.project_number ? ' · ' + pr.project_number : ' · Overhead (no project)'}`}
        breadcrumbs={[{ label: 'Procurement', href: '/procurement/po' }, { label: 'Purchase Requests', href: '/procurement/pr' }, { label: pr.pr_number }]}
        actions={
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" icon={Eye} onClick={() => prPDFService.open(pr)}>View</Button>
            <Button size="sm" variant="secondary" icon={Download} onClick={() => prPDFService.download(pr)}>Export PDF</Button>
            {pr.status === 'DRAFT' && <Button size="sm" variant="primary" icon={Send} isLoading={busy} onClick={() => act(() => prService.submit(id))}>Submit</Button>}
            {pr.status === 'SUBMITTED' && (
              <>
                <Button size="sm" variant="success" icon={CheckCircle} isLoading={busy} onClick={() => act(() => prService.approve(id))}>Approve</Button>
                <Button size="sm" variant="danger" icon={XCircle} disabled={busy} onClick={() => {
                  const r = window.prompt('Rejection reason:'); if (r && r.trim()) act(() => prService.reject(id, r.trim()));
                }}>Reject</Button>
              </>
            )}
            {pr.status === 'APPROVED' && (
              <>
                {Number(pr.estimated_total) <= threshold && (
                  <Button size="sm" variant="success" isLoading={busy} onClick={() => {
                    if (window.confirm(`Record this as a direct purchase (no LPO)? Allowed under ${threshold.toLocaleString()} AED.`)) act(() => prService.markDirectPurchased(id));
                  }}>Direct Purchase (no LPO)</Button>
                )}
                <Button size="sm" variant="primary" icon={ArrowRight} onClick={() => router.push(`/procurement/po/create?pr_id=${id}`)}>Convert to LPO</Button>
              </>
            )}
            {pr.status === 'DIRECT_PURCHASED' && (
              <span className="q-badge q-badge-approved">Direct purchased</span>
            )}
            {pr.status === 'CONVERTED' && pr.converted_po_id && (
              <Link href={`/procurement/po/${pr.converted_po_id}`} className="no-underline">
                <Button size="sm" variant="secondary">View LPO &rarr;</Button>
              </Link>
            )}
          </div>
        }
      />

      {error && (
        <div className="flex items-center justify-between gap-3 bg-[var(--status-danger-bg)] border border-[var(--status-danger-border)] rounded-lg p-3 text-xs text-[var(--status-danger-text)]">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="cursor-pointer"><X size={13} /></button>
        </div>
      )}

      {pr.status === 'REJECTED' && pr.rejection_reason && (
        <div className="bg-[var(--status-danger-bg)] border border-[var(--status-danger-border)] rounded-lg p-3 text-xs text-[var(--status-danger-text)]">
          <strong>Rejected:</strong> {pr.rejection_reason}
        </div>
      )}

      <Card title="Details">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <div><span className="text-xs text-[var(--text-muted)] block">Requested by</span>{pr.requested_by_name || '—'}</div>
          <div><span className="text-xs text-[var(--text-muted)] block">Required by</span>{fmtDate(pr.required_by_date)}</div>
          <div><span className="text-xs text-[var(--text-muted)] block">Estimated total</span><span className="font-mono">{fmtAED(Number(pr.estimated_total) || 0)}</span></div>
          <div><span className="text-xs text-[var(--text-muted)] block">Status</span><StatusChip status={pr.status} /></div>
        </div>
        {pr.justification && <p className="text-xs text-[var(--text-secondary)] mt-3 border-t border-[var(--border-color)] pt-3"><strong>Justification:</strong> {pr.justification}</p>}
      </Card>

      <Card title={`Requested items (${pr.items.length})`} padding={false}>
        <div className="quote-table-wrap !border-0 !rounded-none">
          <table className="quote-table">
            <thead>
              <tr><th>#</th><th>Description</th><th>Brand</th><th>Unit</th><th>Qty</th><th>Est. unit cost</th><th>Line total</th></tr>
            </thead>
            <tbody>
              {pr.items.map((it: any) => (
                <tr key={it.id}>
                  <td className="text-xs text-[var(--text-muted)]">{it.line_no}</td>
                  <td className="text-xs text-[var(--text-primary)]">{it.description}</td>
                  <td className="text-xs text-[var(--text-secondary)]">{it.brand || '—'}</td>
                  <td className="text-xs">{it.unit}</td>
                  <td className="text-xs font-mono">{it.quantity}</td>
                  <td className="text-xs font-mono">{Number(it.estimated_unit_cost).toFixed(2)}</td>
                  <td className="text-xs font-mono">{Number(it.estimated_line_total).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
