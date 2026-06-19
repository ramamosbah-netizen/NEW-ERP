// ============================================================
// JEET ERP — Accounts Receivable (AR) Invoice Registry
// Route: /finance/ar  ·  Design System
// ============================================================

'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useClientInvoices, InvoiceFilters } from '@/hooks/useClientInvoices';
import { useCompany } from '@/lib/company/useCompany';
import { INVOICE_TYPE_LABELS, INVOICE_STATUS_LABELS, INVOICE_STATUS_COLORS } from '@/constants/finance.constants';
import { PageHeader, Card, Button, Toolbar, SearchInput, SelectFilter } from '@/components/ui';
import { Plus, ArrowRight, CheckSquare } from 'lucide-react';

export default function ClientInvoicesListPage() {
  const { activeCompanyId } = useCompany();
  const [filters, setFilters] = useState<InvoiceFilters>({ status: '', search: '' });
  const { invoices, loading } = useClientInvoices({ ...filters, companyId: activeCompanyId || undefined });

  const formatAED = (v: number) =>
    new Intl.NumberFormat('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v) + ' AED';

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Receivables (AR)"
        subtitle="Client invoice registry — progress claims, advances & retention"
        breadcrumbs={[{ label: 'Finance', href: '/finance' }, { label: 'Receivables' }]}
        actions={
          <>
            <Link href="/finance/ar/from-phases" className="no-underline">
              <Button variant="secondary" size="sm" icon={CheckSquare}>Bill Completed Phases</Button>
            </Link>
            <Link href="/finance/ar/create" className="no-underline">
              <Button variant="primary" size="sm" icon={Plus}>New Invoice Draft</Button>
            </Link>
          </>
        }
      />

      <Toolbar>
        <SearchInput
          placeholder="Search by invoice # or client…"
          value={filters.search}
          onChange={e => setFilters(prev => ({ ...prev, search: e.target.value }))}
        />
        <SelectFilter
          value={filters.status}
          onChange={e => setFilters(prev => ({ ...prev, status: e.target.value }))}
        >
          <option value="">All Statuses</option>
          {Object.entries(INVOICE_STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </SelectFilter>
      </Toolbar>

      <Card padding={false}>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-[var(--border-color)] text-[var(--text-muted)] font-mono uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4">Invoice Number</th>
                <th className="py-3 px-4">Client Name</th>
                <th className="py-3 px-4">Billing Date</th>
                <th className="py-3 px-4">Invoice Type</th>
                <th className="py-3 px-4 text-right">Net Due</th>
                <th className="py-3 px-4 text-right">Amount Paid</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-[var(--text-muted)] font-mono">Querying invoices…</td>
                </tr>
              ) : invoices.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-[var(--text-muted)] font-mono">No invoices registered.</td>
                </tr>
              ) : (
                invoices.map(inv => {
                  const statusColor = INVOICE_STATUS_COLORS[inv.status] || { bg: 'var(--surface-hover)', text: 'var(--text-primary)', border: 'transparent' };
                  return (
                    <tr
                      key={inv.id}
                      className="border-b border-[var(--border-color)] hover:bg-[var(--bg-card-hover)] transition-colors cursor-pointer"
                      onClick={() => (window.location.href = `/finance/ar/${inv.id}`)}
                    >
                      <td className="py-3.5 px-4 font-mono font-bold text-[var(--text-primary)]">{inv.invoice_number}</td>
                      <td className="py-3.5 px-4 font-semibold text-[var(--text-secondary)]">{inv.client_name}</td>
                      <td className="py-3.5 px-4 text-[var(--text-secondary)]">{new Date(inv.invoice_date).toLocaleDateString('en-GB')}</td>
                      <td className="py-3.5 px-4 text-[var(--text-secondary)]">{INVOICE_TYPE_LABELS[inv.invoice_type]}</td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-[var(--text-primary)]">{formatAED(inv.net_due)}</td>
                      <td className="py-3.5 px-4 text-right font-mono text-[var(--text-secondary)]">{formatAED(inv.amount_paid)}</td>
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className="px-2 py-0.5 rounded-[var(--radius-full)] text-[10px] font-bold uppercase tracking-wider border"
                          style={{ backgroundColor: statusColor.bg, color: statusColor.text, borderColor: statusColor.border }}
                        >
                          {INVOICE_STATUS_LABELS[inv.status]}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <Link href={`/finance/ar/${inv.id}`} className="text-[var(--accent)]" onClick={e => e.stopPropagation()}>
                          <ArrowRight size={14} />
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
