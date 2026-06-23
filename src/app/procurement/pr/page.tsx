'use client';

// ============================================================
// JEET ERP — Purchase Requests list
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import prService from '@/services/prService';
import { useCompany } from '@/lib/company/useCompany';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { StatusChip } from '@/components/ui/StatusChip';
import { EmptyState } from '@/components/ui/EmptyState';
import { ClipboardList, Plus, X } from 'lucide-react';

const CATEGORY_LABEL: Record<string, string> = {
  PROJECT_MATERIAL: 'Project material', TOOLS: 'Tools', IT_EQUIPMENT: 'IT equipment',
  FURNITURE: 'Furniture', CONSUMABLES: 'Consumables', SAMPLE: 'Sample', SERVICES: 'Services', OTHER: 'Other',
};
const fmtAED = (v: number) => new Intl.NumberFormat('en-AE', { maximumFractionDigits: 0 }).format(v) + ' AED';
const fmtDate = (d?: string | null) => d ? new Date(d).toLocaleDateString('en-AE', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

export default function PurchaseRequestsPage() {
  const router = useRouter();
  const { activeCompanyId } = useCompany();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setRows(await prService.list({ ...(statusFilter ? { status: statusFilter } : {}), companyId: activeCompanyId || undefined }));
      setError(null);
    } catch (err: any) {
      setError(err.message?.includes('relation') || err.message?.includes('does not exist')
        ? 'Purchase Request tables not found — apply migration 20260613260000.'
        : err.message || 'Failed to load purchase requests');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, activeCompanyId]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Purchase Requests"
        subtitle="Raise material/tool/consumable requests (with or without a project), get them approved, then convert to an LPO"
        breadcrumbs={[{ label: 'Procurement', href: '/procurement/po' }, { label: 'Purchase Requests' }]}
        actions={<Button variant="primary" size="sm" icon={Plus} onClick={() => router.push('/procurement/pr/create')}>New request</Button>}
      />

      {error && (
        <div className="flex items-center justify-between gap-3 bg-[var(--status-danger-bg)] border border-[var(--status-danger-border)] rounded-lg p-3 text-xs text-[var(--status-danger-text)]">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="cursor-pointer"><X size={13} /></button>
        </div>
      )}

      <div className="flex gap-2 items-center">
        <select className="quote-form-input max-w-[200px]" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          {['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'CONVERTED', 'CANCELLED'].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <span className="text-xs text-[var(--text-muted)]">{rows.length} request{rows.length === 1 ? '' : 's'}</span>
      </div>

      {loading ? (
        <div className="py-20 flex justify-center"><div className="h-7 w-7 border-2 border-[var(--border-color)] border-t-[var(--text-primary)] animate-spin rounded-full" /></div>
      ) : rows.length === 0 ? (
        <EmptyState icon={ClipboardList} title="No purchase requests" description="Raise a request for materials, tools, IT, furniture, consumables or samples." actionText="New request" onAction={() => router.push('/procurement/pr/create')} />
      ) : (
        <Card padding={false}>
          <div className="quote-table-wrap !border-0 !rounded-none">
            <table className="quote-table">
              <thead>
                <tr>
                  <th>PR No.</th>
                  <th>Title</th>
                  <th>Category</th>
                  <th>Project</th>
                  <th>Est. value</th>
                  <th>Required by</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(pr => (
                  <tr key={pr.id} className="cursor-pointer" onClick={() => router.push(`/procurement/pr/${pr.id}`)}>
                    <td><span className="font-mono text-xs font-medium text-[var(--primary)]">{pr.pr_number}</span></td>
                    <td><span className="text-xs text-[var(--text-primary)]">{pr.title}</span></td>
                    <td><span className="q-badge q-badge-draft">{CATEGORY_LABEL[pr.category] || pr.category}</span></td>
                    <td><span className="text-xs text-[var(--text-secondary)]">{pr.project_id ? '—' : 'Overhead'}</span></td>
                    <td><span className="font-mono text-xs">{fmtAED(Number(pr.estimated_total) || 0)}</span></td>
                    <td><span className="font-mono text-xs text-[var(--text-muted)]">{fmtDate(pr.required_by_date)}</span></td>
                    <td><StatusChip status={String(pr.status)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
