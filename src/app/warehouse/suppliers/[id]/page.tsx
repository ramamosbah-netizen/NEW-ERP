'use client';

// ============================================================
// JEET ERP — Supplier / Subcontractor Scorecard
// Profile, computed performance score, and PO-by-PO history.
// ============================================================

import React, { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import warehouseService, { SupplierDetail } from '@/services/warehouseService';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatusChip } from '@/components/ui/StatusChip';
import { Award, Star, CheckCircle2, XCircle, Phone, Mail, Wrench } from 'lucide-react';

const fmtAED = (v: number) => new Intl.NumberFormat('en-AE', { maximumFractionDigits: 0 }).format(v) + ' AED';
const fmtDate = (d?: string | null) => d ? new Date(d).toLocaleDateString('en-AE', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const TYPE_LABEL: Record<string, string> = { SUPPLIER: 'Supplier', SUBCONTRACTOR: 'Subcontractor', BOTH: 'Supplier + Subcon' };

export default function SupplierScorecard({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [data, setData] = useState<SupplierDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    warehouseService.getSupplierDetail(id)
      .then(setData)
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return <div className="py-24 flex justify-center"><div className="h-7 w-7 border-2 border-[var(--border-color)] border-t-[var(--text-primary)] animate-spin rounded-full" /></div>;
  }
  if (!data) {
    return <div className="py-24 text-center text-sm text-[var(--text-muted)]">Supplier not found.</div>;
  }

  const scoreColor = data.score >= 75 ? 'var(--success)' : data.score >= 50 ? 'var(--warning)' : 'var(--error)';
  const onTimeCount = data.history.filter(h => h.on_time === true).length;
  const ratedCount = data.history.filter(h => h.on_time !== null).length;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={data.name}
        referenceId={TYPE_LABEL[data.supplier_type]}
        status={data.is_active ? 'ACTIVE' : 'INACTIVE'}
        subtitle={data.trade ? `Trade: ${data.trade}` : 'Supplier performance scorecard'}
        breadcrumbs={[{ label: 'Warehouse', href: '/warehouse' }, { label: 'Suppliers', href: '/warehouse/suppliers' }, { label: data.name }]}
        actions={<Button size="sm" variant="secondary" onClick={() => router.push('/warehouse/suppliers')}>Back</Button>}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Score gauge */}
        <Card className="flex flex-col items-center justify-center gap-2 py-6">
          <div className="relative h-28 w-28">
            <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
              <circle cx="50" cy="50" r="42" fill="none" stroke="var(--border-color)" strokeWidth="8" />
              <circle cx="50" cy="50" r="42" fill="none" stroke={scoreColor} strokeWidth="8" strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 42} strokeDashoffset={2 * Math.PI * 42 * (1 - data.score / 100)} />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-semibold" style={{ color: scoreColor }}>{data.score}</span>
              <span className="text-[0.6875rem] text-[var(--text-muted)]">/ 100</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
            <Award size={13} /> Composite score
          </div>
          {data.preferred && (
            <span className="inline-flex items-center gap-1 text-[0.6875rem] text-[var(--warning)]"><Star size={11} fill="currentColor" /> Preferred</span>
          )}
        </Card>

        {/* KPIs */}
        <Card className="lg:col-span-2">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Orders', value: data.po_count },
              { label: 'Total spend', value: data.total_value > 0 ? fmtAED(data.total_value) : '—' },
              { label: 'On-time', value: data.on_time_pct != null ? data.on_time_pct + '%' : '—' },
              { label: 'Last order', value: fmtDate(data.last_order_at) },
            ].map(k => (
              <div key={k.label} className="bg-[var(--bg-card-hover)] rounded-md p-3">
                <span className="text-xs text-[var(--text-muted)] block">{k.label}</span>
                <span className="text-base font-semibold text-[var(--text-primary)]">{k.value}</span>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4 text-xs">
            <div className="flex items-center gap-2 text-[var(--text-secondary)]"><Phone size={13} className="text-[var(--text-muted)]" /> {data.phone || '—'}</div>
            <div className="flex items-center gap-2 text-[var(--text-secondary)]"><Mail size={13} className="text-[var(--text-muted)]" /> {data.email || '—'}</div>
            <div className="flex items-center gap-2 text-[var(--text-secondary)]">Contact: {data.contact_person || '—'}</div>
            <div className="flex items-center gap-2 text-[var(--text-secondary)]">Terms: {data.payment_terms_days ?? 30} days</div>
            {(data.supplier_type === 'SUBCONTRACTOR' || data.supplier_type === 'BOTH') && (
              <>
                <div className="flex items-center gap-2 text-[var(--text-secondary)]"><Wrench size={13} className="text-[var(--text-muted)]" /> Trade: {data.trade || '—'}</div>
                <div className="flex items-center gap-2 text-[var(--text-secondary)]">Day rate: {data.day_rate != null ? fmtAED(data.day_rate) : '—'}</div>
              </>
            )}
            {data.systems_covered && data.systems_covered.length > 0 && (
              <div className="flex items-center gap-2 text-[var(--text-secondary)] sm:col-span-2">Systems: {data.systems_covered.join(', ')}</div>
            )}
          </div>
        </Card>
      </div>

      {/* PO-by-PO history */}
      <Card
        title="Purchase order history"
        subtitle={ratedCount > 0 ? `${onTimeCount}/${ratedCount} orders delivered on time` : 'All purchase orders raised to this supplier'}
        padding={false}
      >
        {data.history.length === 0 ? (
          <p className="text-xs text-[var(--text-muted)] py-10 text-center">No purchase orders raised to this supplier yet.</p>
        ) : (
          <div className="quote-table-wrap !border-0 !rounded-none">
            <table className="quote-table">
              <thead>
                <tr>
                  <th>PO number</th>
                  <th>Date</th>
                  <th>Project</th>
                  <th>Status</th>
                  <th>Required</th>
                  <th>Acknowledged</th>
                  <th>On-time</th>
                  <th style={{ textAlign: 'right' }}>Value</th>
                </tr>
              </thead>
              <tbody>
                {data.history.map(h => (
                  <tr key={h.id}>
                    <td>
                      <Link href={`/procurement/po/${h.id}`} className="font-mono text-xs font-medium text-[var(--primary)] hover:underline">{h.po_number}</Link>
                    </td>
                    <td><span className="font-mono text-xs text-[var(--text-secondary)]">{fmtDate(h.created_at)}</span></td>
                    <td><span className="font-mono text-xs text-[var(--text-secondary)]">{h.project_number || '—'}</span></td>
                    <td><StatusChip status={String(h.status).toUpperCase()} /></td>
                    <td><span className="font-mono text-xs text-[var(--text-muted)]">{fmtDate(h.required_delivery_date)}</span></td>
                    <td><span className="font-mono text-xs text-[var(--text-muted)]">{fmtDate(h.acknowledged_at)}</span></td>
                    <td>
                      {h.on_time === null ? <span className="text-xs text-[var(--text-muted)]">—</span>
                        : h.on_time ? <CheckCircle2 size={14} className="text-[var(--success)]" />
                        : <XCircle size={14} className="text-[var(--error)]" />}
                    </td>
                    <td style={{ textAlign: 'right' }}><span className="font-mono text-xs">{fmtAED(h.total)}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
