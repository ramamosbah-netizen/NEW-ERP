'use client';

// ============================================================
// JEET ERP — Pre-Sales: Client 360
// One client's tenders, quotations and AMC contracts in one view.
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import clientService, { Client } from '@/services/clientService';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ArrowLeft, Briefcase, FileText, Shield, Mail, Phone, Globe } from 'lucide-react';

const aed = (n: number) => `AED ${Number(n || 0).toLocaleString('en-AE', { maximumFractionDigits: 0 })}`;
const isWonQ = (q: any) => q.status === 'ACCEPTED' || q.client_response === 'ACCEPTED' || !!q.linked_project_id || !!q.actual_project_id;

export default function Client360Page() {
  const params = useParams();
  const router = useRouter();
  const id = String(params.id);
  const [client, setClient] = useState<Client | null>(null);
  const [data, setData] = useState<{ tenders: any[]; quotations: any[]; contracts: any[] }>({ tenders: [], quotations: [], contracts: [] });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const c = await clientService.get(id);
      setClient(c);
      if (c) setData(await clientService.get360(id, c.name));
    } finally { setLoading(false); }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  if (loading) return <Card><div className="p-8 text-center text-sm text-[var(--text-tertiary)]">Loading…</div></Card>;
  if (!client) return <Card><div className="p-8 text-center text-sm text-[var(--text-tertiary)]">Client not found.</div></Card>;

  const quotedValue = data.quotations.reduce((s, q) => s + Number(q.grand_total_with_vat || 0), 0);
  const wonValue = data.quotations.filter(isWonQ).reduce((s, q) => s + Number(q.grand_total_with_vat || 0), 0);
  const amcValue = data.contracts.filter(c => c.status === 'ACTIVE').reduce((s, c) => s + Number(c.annual_value || 0), 0);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={client.name}
        subtitle={[client.segment, client.industry, client.status].filter(Boolean).join(' · ') || 'Client 360'}
        breadcrumbs={[{ label: 'Pre-Sales', href: '/sales/dashboard' }, { label: 'Clients', href: '/sales/clients' }, { label: client.name }]}
        actions={<Button variant="secondary" icon={ArrowLeft} onClick={() => router.push('/sales/clients')}>Back</Button>}
      />

      {/* Profile + KPIs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card className="p-4">
          <div className="text-sm font-semibold text-[var(--text-primary)] mb-2">Profile</div>
          <div className="space-y-1.5 text-sm">
            {client.contact_person && <div className="text-[var(--text-secondary)]">{client.contact_person}</div>}
            {client.contact_phone && <div className="flex items-center gap-2 text-[var(--text-secondary)]"><Phone size={13} />{client.contact_phone}</div>}
            {client.contact_email && <div className="flex items-center gap-2 text-[var(--text-secondary)]"><Mail size={13} />{client.contact_email}</div>}
            {client.website && <div className="flex items-center gap-2 text-[var(--text-secondary)]"><Globe size={13} />{client.website}</div>}
            {client.trn && <div className="text-xs text-[var(--text-tertiary)]">TRN {client.trn}</div>}
            {client.owner_name && <div className="text-xs text-[var(--text-tertiary)]">Owner: {client.owner_name}</div>}
            {(client.city || client.country) && <div className="text-xs text-[var(--text-tertiary)]">{[client.city, client.country].filter(Boolean).join(', ')}</div>}
            {client.notes && <div className="text-xs text-[var(--text-tertiary)] mt-2 pt-2 border-t border-[var(--border)]">{client.notes}</div>}
          </div>
        </Card>
        <div className="lg:col-span-2 grid grid-cols-2 md:grid-cols-4 gap-3 content-start">
          <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Tenders</div><div className="text-2xl font-bold mt-1">{data.tenders.length}</div></Card>
          <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Quoted value</div><div className="text-lg font-bold mt-1">{aed(quotedValue)}</div></Card>
          <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Won value</div><div className="text-lg font-bold mt-1" style={{ color: 'var(--status-success-text)' }}>{aed(wonValue)}</div></Card>
          <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Active AMC</div><div className="text-lg font-bold mt-1">{aed(amcValue)}</div></Card>
        </div>
      </div>

      {/* Tenders */}
      <Card className="p-0 overflow-x-auto">
        <div className="p-3 text-sm font-semibold text-[var(--text-primary)] border-b border-[var(--border)] flex items-center gap-2"><Briefcase size={15} /> Tenders ({data.tenders.length})</div>
        {data.tenders.length === 0 ? <div className="p-5 text-center text-sm text-[var(--text-tertiary)]">No tenders.</div> : (
          <table className="w-full text-sm">
            <thead><tr className="border-b border-[var(--border)] text-left text-[var(--text-tertiary)] text-xs"><th className="p-3">Tender</th><th className="p-3 text-right">Budget</th><th className="p-3">Deadline</th><th className="p-3">Status</th></tr></thead>
            <tbody>
              {data.tenders.map(t => (
                <tr key={t.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-hover)] cursor-pointer" onClick={() => router.push(`/tenders/${t.id}`)}>
                  <td className="p-3 text-[var(--text-primary)]">{t.title || t.project_name}</td>
                  <td className="p-3 text-right tabular-nums">{aed(t.budget)}</td>
                  <td className="p-3 text-xs text-[var(--text-secondary)]">{t.deadline_date || '—'}</td>
                  <td className="p-3 text-xs">{t.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {/* Quotations */}
      <Card className="p-0 overflow-x-auto">
        <div className="p-3 text-sm font-semibold text-[var(--text-primary)] border-b border-[var(--border)] flex items-center gap-2"><FileText size={15} /> Quotations ({data.quotations.length})</div>
        {data.quotations.length === 0 ? <div className="p-5 text-center text-sm text-[var(--text-tertiary)]">No quotations.</div> : (
          <table className="w-full text-sm">
            <thead><tr className="border-b border-[var(--border)] text-left text-[var(--text-tertiary)] text-xs"><th className="p-3">Quotation</th><th className="p-3">Date</th><th className="p-3 text-right">Value</th><th className="p-3">Status</th></tr></thead>
            <tbody>
              {data.quotations.map(q => (
                <tr key={q.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-hover)] cursor-pointer" onClick={() => router.push(`/quotations/${q.id}`)}>
                  <td className="p-3 font-medium text-[var(--text-primary)]">{q.quotation_number}</td>
                  <td className="p-3 text-xs text-[var(--text-secondary)]">{q.quotation_date || '—'}</td>
                  <td className="p-3 text-right tabular-nums">{aed(q.grand_total_with_vat)}</td>
                  <td className="p-3"><span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: isWonQ(q) ? 'var(--status-success-bg)' : 'var(--surface-active)', color: isWonQ(q) ? 'var(--status-success-text)' : 'var(--text-secondary)' }}>{q.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {/* AMC */}
      <Card className="p-0 overflow-x-auto">
        <div className="p-3 text-sm font-semibold text-[var(--text-primary)] border-b border-[var(--border)] flex items-center gap-2"><Shield size={15} /> AMC contracts ({data.contracts.length})</div>
        {data.contracts.length === 0 ? <div className="p-5 text-center text-sm text-[var(--text-tertiary)]">No contracts.</div> : (
          <table className="w-full text-sm">
            <thead><tr className="border-b border-[var(--border)] text-left text-[var(--text-tertiary)] text-xs"><th className="p-3">Contract</th><th className="p-3">Site</th><th className="p-3 text-right">Annual value</th><th className="p-3">End</th><th className="p-3">Status</th></tr></thead>
            <tbody>
              {data.contracts.map(c => (
                <tr key={c.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-hover)] cursor-pointer" onClick={() => router.push(`/amc/${c.id}`)}>
                  <td className="p-3 font-medium text-[var(--text-primary)]">{c.contract_number}</td>
                  <td className="p-3 text-xs text-[var(--text-secondary)]">{c.site_name || '—'}</td>
                  <td className="p-3 text-right tabular-nums">{aed(c.annual_value)}</td>
                  <td className="p-3 text-xs text-[var(--text-secondary)]">{c.end_date || '—'}</td>
                  <td className="p-3 text-xs">{c.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
