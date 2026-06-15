'use client';

// ============================================================
// JEET ERP — Pre-Sales: Quotation Follow-ups & Validity
// Pending quotes awaiting client response, days since sent, and
// validity (expiring/expired). Read-only (no migration).
// ============================================================

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { exportTablePdf, exportTableExcel } from '@/lib/finance-export';
import { BellRing, FileDown, Sheet } from 'lucide-react';

const DAY = 86400000;
const aed = (n: number) => `AED ${Number(n || 0).toLocaleString('en-AE', { maximumFractionDigits: 0 })}`;

interface Qt { id: string; quotation_number: string; client_name: string; status: string; grand_total_with_vat: number; sent_to_client_at: string | null; valid_until: string | null; client_response: string | null; linked_project_id: string | null; actual_project_id: string | null; rejection_reason: string | null; }
const isWon = (q: Qt) => q.status === 'ACCEPTED' || q.client_response === 'ACCEPTED' || !!q.linked_project_id || !!q.actual_project_id;
const isLost = (q: Qt) => q.status === 'REJECTED' || (!!q.rejection_reason && !isWon(q));
const isPending = (q: Qt) => !isWon(q) && !isLost(q) && q.status !== 'SUPERSEDED';

export default function FollowUpsPage() {
  const router = useRouter();
  const [quotes, setQuotes] = useState<Qt[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from('quotations').select('id, quotation_number, client_name, status, grand_total_with_vat, sent_to_client_at, valid_until, client_response, linked_project_id, actual_project_id, rejection_reason')
      .then(({ data }) => setQuotes((data || []) as Qt[])).then(() => setLoading(false), () => setLoading(false));
  }, []);

  const now = Date.now();
  const pending = useMemo(() => quotes.filter(isPending), [quotes]);
  const daysSince = (d: string | null) => d ? Math.floor((now - new Date(d).getTime()) / DAY) : null;
  const daysToExpiry = (d: string | null) => d ? Math.ceil((new Date(d).getTime() - now) / DAY) : null;

  const awaiting = pending.filter(q => q.sent_to_client_at).sort((a, b) => (daysSince(b.sent_to_client_at) || 0) - (daysSince(a.sent_to_client_at) || 0));
  const notSent = pending.filter(q => !q.sent_to_client_at);
  const expiringSoon = pending.filter(q => { const d = daysToExpiry(q.valid_until); return d !== null && d >= 0 && d <= 14; });
  const expired = pending.filter(q => { const d = daysToExpiry(q.valid_until); return d !== null && d < 0; });

  const exportCols = ['Quotation', 'Client', 'Value', 'Sent', 'Days waiting', 'Valid until', 'Validity'];
  const exportRows = pending.map(q => { const dte = daysToExpiry(q.valid_until); return [q.quotation_number, q.client_name, q.grand_total_with_vat, q.sent_to_client_at ? q.sent_to_client_at.slice(0, 10) : 'not sent', daysSince(q.sent_to_client_at) ?? '', q.valid_until || '', dte === null ? '' : dte < 0 ? 'expired' : `${dte}d`]; });

  const Section = ({ title, items, accent, sentCol }: { title: string; items: Qt[]; accent: string; sentCol?: boolean }) => (
    <Card className="p-0 overflow-x-auto">
      <div className="p-3 text-sm font-semibold border-b border-[var(--border)] flex items-center gap-2" style={{ color: accent }}><span className="w-2.5 h-2.5 rounded-full" style={{ background: accent }} />{title} ({items.length})</div>
      {items.length === 0 ? <div className="p-5 text-center text-sm text-[var(--text-tertiary)]">Nothing here.</div> : (
        <table className="w-full text-sm">
          <thead><tr className="border-b border-[var(--border)] text-left text-[var(--text-tertiary)] text-xs">
            <th className="p-3">Quotation</th><th className="p-3">Client</th><th className="p-3 text-right">Value</th>
            {sentCol && <th className="p-3 text-right">Waiting</th>}<th className="p-3">Valid until</th>
          </tr></thead>
          <tbody>
            {items.map(q => { const dte = daysToExpiry(q.valid_until); const ds = daysSince(q.sent_to_client_at); return (
              <tr key={q.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-hover)] cursor-pointer" onClick={() => router.push(`/quotations/${q.id}`)}>
                <td className="p-3 font-medium text-[var(--text-primary)]">{q.quotation_number}</td>
                <td className="p-3 text-xs text-[var(--text-secondary)]">{q.client_name}</td>
                <td className="p-3 text-right tabular-nums">{aed(q.grand_total_with_vat)}</td>
                {sentCol && <td className="p-3 text-right text-xs font-medium" style={{ color: (ds || 0) > 14 ? 'var(--status-warning-text)' : 'var(--text-secondary)' }}>{ds !== null ? `${ds}d` : '—'}</td>}
                <td className="p-3 text-xs" style={{ color: dte !== null && dte < 0 ? 'var(--status-danger-text)' : dte !== null && dte <= 14 ? 'var(--status-warning-text)' : 'var(--text-secondary)' }}>{q.valid_until || '—'}{dte !== null && dte < 0 ? ' (expired)' : dte !== null && dte <= 14 ? ` (${dte}d)` : ''}</td>
              </tr>
            ); })}
          </tbody>
        </table>
      )}
    </Card>
  );

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Quotation Follow-ups & Validity"
        subtitle="Pending quotations awaiting a response and approaching expiry"
        breadcrumbs={[{ label: 'Pre-Sales', href: '/sales/dashboard' }, { label: 'Follow-ups' }]}
        actions={pending.length > 0 ? (
          <div className="flex gap-2">
            <Button variant="secondary" icon={FileDown} onClick={() => exportTablePdf({ title: 'Quotation Follow-ups', columns: exportCols, rows: exportRows, fileName: 'quotation-followups' })}>PDF</Button>
            <Button variant="secondary" icon={Sheet} onClick={() => exportTableExcel({ title: 'Quotation Follow-ups', columns: exportCols, rows: exportRows, fileName: 'quotation-followups' })}>Excel</Button>
          </div>
        ) : undefined}
      />

      {loading ? (
        <Card><div className="p-8 text-center text-sm text-[var(--text-tertiary)]">Loading…</div></Card>
      ) : pending.length === 0 ? (
        <Card><EmptyState icon={BellRing} title="No pending quotations" description="Quotations awaiting a client response will appear here for follow-up." /></Card>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Awaiting response</div><div className="text-2xl font-bold mt-1">{awaiting.length}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Not sent yet</div><div className="text-2xl font-bold mt-1" style={{ color: notSent.length ? 'var(--status-warning-text)' : 'var(--text-primary)' }}>{notSent.length}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Expiring ≤14d</div><div className="text-2xl font-bold mt-1" style={{ color: expiringSoon.length ? 'var(--status-warning-text)' : 'var(--text-primary)' }}>{expiringSoon.length}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Expired</div><div className="text-2xl font-bold mt-1" style={{ color: expired.length ? 'var(--status-danger-text)' : 'var(--text-primary)' }}>{expired.length}</div></Card>
          </div>

          <Section title="Awaiting client response" items={awaiting} accent="var(--accent)" sentCol />
          {expiringSoon.length > 0 && <Section title="Expiring soon" items={expiringSoon} accent="var(--status-warning-text)" />}
          {expired.length > 0 && <Section title="Expired (still pending)" items={expired} accent="var(--status-danger-text)" />}
          {notSent.length > 0 && <Section title="Not sent to client yet" items={notSent} accent="var(--status-info-text)" />}
        </>
      )}
    </div>
  );
}
