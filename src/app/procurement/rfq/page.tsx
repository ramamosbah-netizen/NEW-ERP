'use client';

// ============================================================
// JEET ERP — RFQ Log
// Every quotation request sent to suppliers/subcontractors, with
// the items asked, recipients, status and PDF re-export. The AI
// reply-reader (next step) will attach suggested prices here.
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import rfqService, { RFQ } from '@/services/rfqService';
import rfqPDFService from '@/lib/rfq-pdf';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Mail, Download, Search, X, FileText, Send } from 'lucide-react';

const STATUS: Record<string, { label: string; bg: string; text: string }> = {
  DRAFT: { label: 'Draft', bg: 'var(--status-neutral-bg)', text: 'var(--status-neutral-text)' },
  SENT: { label: 'Sent', bg: 'var(--status-info-bg)', text: 'var(--status-info-text)' },
  AWAITING: { label: 'Awaiting replies', bg: 'var(--status-warning-bg)', text: 'var(--status-warning-text)' },
  CLOSED: { label: 'Closed', bg: 'var(--status-success-bg)', text: 'var(--status-success-text)' },
};

const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString('en-AE', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

export default function RFQLogPage() {
  const router = useRouter();
  const [rows, setRows] = useState<RFQ[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    try { setLoading(true); setRows(await rfqService.list()); setError(null); }
    catch (err: any) { setError(err.message || 'Failed to load RFQs'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const reopenMail = (rfq: RFQ) => {
    const emails = (rfq.suppliers || []).map(s => s.email).filter(Boolean) as string[];
    const href = `mailto:?bcc=${encodeURIComponent(emails.join(','))}&subject=${encodeURIComponent(rfq.subject)}`;
    window.location.href = href;
  };

  const filtered = rows.filter(r =>
    !search ||
    r.rfq_number.toLowerCase().includes(search.toLowerCase()) ||
    (r.subject || '').toLowerCase().includes(search.toLowerCase()) ||
    (r.project_title || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Requests for Quotation"
        subtitle="Sourcing requests sent to suppliers and subcontractors — recorded, re-exportable, and (next) AI-priced from replies"
        breadcrumbs={[{ label: 'Procurement', href: '/procurement/po' }, { label: 'RFQ' }]}
        actions={<Button size="sm" variant="secondary" onClick={() => router.push('/procurement/comparisons')}>Comparisons</Button>}
      />

      {error && (
        <div className="flex items-center justify-between gap-3 bg-[var(--status-danger-bg)] border border-[var(--status-danger-border)] rounded-lg p-3 text-xs text-[var(--status-danger-text)]">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="cursor-pointer"><X size={13} /></button>
        </div>
      )}

      <div className="relative max-w-sm">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search RFQ no, subject, project…"
          className="w-full pl-9 pr-3 h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm" />
      </div>

      <Card className="overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-[var(--text-tertiary)]">Loading…</div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Mail}
            title="No RFQs yet"
            description="Open a BOQ and use “Request Quotation” to draft your first sourcing request to suppliers."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[var(--border)] text-left text-[var(--text-tertiary)]">
                  <th className="px-4 py-2.5 font-medium">RFQ No</th>
                  <th className="px-4 py-2.5 font-medium">Subject / Project</th>
                  <th className="px-4 py-2.5 font-medium text-center">Items</th>
                  <th className="px-4 py-2.5 font-medium text-center">Suppliers</th>
                  <th className="px-4 py-2.5 font-medium">Quote by</th>
                  <th className="px-4 py-2.5 font-medium">Date</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => {
                  const st = STATUS[r.status] || STATUS.DRAFT;
                  return (
                    <tr key={r.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-hover)]">
                      <td className="px-4 py-2.5 font-mono font-medium text-[var(--text-primary)]">{r.rfq_number}</td>
                      <td className="px-4 py-2.5">
                        <div className="text-[var(--text-primary)]">{r.subject}</div>
                        {r.project_title && <div className="text-[var(--text-tertiary)]">{r.project_title}</div>}
                      </td>
                      <td className="px-4 py-2.5 text-center tabular-nums">{(r.items || []).length}</td>
                      <td className="px-4 py-2.5 text-center tabular-nums">{(r.suppliers || []).length}</td>
                      <td className="px-4 py-2.5">{fmtDate(r.due_date)}</td>
                      <td className="px-4 py-2.5">{fmtDate(r.created_at)}</td>
                      <td className="px-4 py-2.5">
                        <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: st.bg, color: st.text }}>{st.label}</span>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center justify-end gap-1.5">
                          <button title="Download PDF" onClick={() => rfqPDFService.download(r)}
                            className="p-1.5 rounded hover:bg-[var(--surface-active)] text-[var(--text-secondary)] cursor-pointer"><Download size={14} /></button>
                          <button title="Open mail" onClick={() => reopenMail(r)}
                            className="p-1.5 rounded hover:bg-[var(--surface-active)] text-[var(--text-secondary)] cursor-pointer"><Mail size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <p className="text-[11px] text-[var(--text-tertiary)] leading-relaxed">
        <Send size={11} className="inline mr-1" />
        Next step: connect a mailbox so the AI agent reads supplier replies against each RFQ’s items and suggests prices,
        feeding the supplier comparison automatically.
      </p>
    </div>
  );
}
