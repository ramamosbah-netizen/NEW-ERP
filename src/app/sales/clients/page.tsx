'use client';

// ============================================================
// JEET ERP — Pre-Sales: Client Directory (CRM)
// Client list with CRM segmentation, per-client rollups and
// create/edit. Drill to the 360 view. Migration adds CRM fields
// (page degrades gracefully without them).
// ============================================================

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import clientService, { Client } from '@/services/clientService';
import { useCompany } from '@/lib/company/useCompany';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { exportTablePdf, exportTableExcel } from '@/lib/finance-export';
import { Building2, Plus, FileDown, Sheet, Search, Pencil } from 'lucide-react';

const aed = (n: number) => `AED ${Number(n || 0).toLocaleString('en-AE', { maximumFractionDigits: 0 })}`;
const SEGMENTS = ['ENTERPRISE', 'SME', 'GOVERNMENT', 'DEVELOPER', 'CONSULTANT', 'OTHER'];
const STATUSES = ['LEAD', 'PROSPECT', 'ACTIVE', 'INACTIVE'];
const statusStyle: Record<string, { bg: string; tx: string }> = {
  LEAD: { bg: 'var(--status-info-bg)', tx: 'var(--status-info-text)' },
  PROSPECT: { bg: 'var(--status-warning-bg)', tx: 'var(--status-warning-text)' },
  ACTIVE: { bg: 'var(--status-success-bg)', tx: 'var(--status-success-text)' },
  INACTIVE: { bg: 'var(--status-neutral-bg)', tx: 'var(--status-neutral-text)' },
};

type Form = { name: string; segment: string; industry: string; owner_name: string; status: string; contact_person: string; contact_email: string; contact_phone: string; trn: string; website: string; notes: string; };
const empty: Form = { name: '', segment: '', industry: '', owner_name: '', status: 'ACTIVE', contact_person: '', contact_email: '', contact_phone: '', trn: '', website: '', notes: '' };

export default function ClientDirectoryPage() {
  const router = useRouter();
  const { activeCompanyId } = useCompany();
  const [clients, setClients] = useState<Client[]>([]);
  const [quoteByClient, setQuoteByClient] = useState<Map<string, number>>(new Map());
  const [amcByClient, setAmcByClient] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [segFilter, setSegFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [modal, setModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<Form>(empty);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [list, qt, amc] = await Promise.all([
        clientService.list(activeCompanyId || undefined),
        supabase.from('quotations').select('client_id, grand_total_with_vat'),
        supabase.from('amc_contracts').select('client_id, annual_value, status'),
      ]);
      setClients(list);
      const qm = new Map<string, number>(); (qt.data || []).forEach((q: any) => { if (q.client_id) qm.set(q.client_id, (qm.get(q.client_id) || 0) + Number(q.grand_total_with_vat || 0)); });
      const am = new Map<string, number>(); (amc.data || []).forEach((a: any) => { if (a.client_id && a.status === 'ACTIVE') am.set(a.client_id, (am.get(a.client_id) || 0) + Number(a.annual_value || 0)); });
      setQuoteByClient(qm); setAmcByClient(am);
    } finally { setLoading(false); }
  }, [activeCompanyId]);
  useEffect(() => { load(); }, [load]);

  const openNew = () => { setEditId(null); setForm({ ...empty }); setModal(true); };
  const openEdit = (c: Client) => { setEditId(c.id); setForm({ name: c.name, segment: c.segment || '', industry: c.industry || '', owner_name: c.owner_name || '', status: c.status || 'ACTIVE', contact_person: c.contact_person || '', contact_email: c.contact_email || '', contact_phone: c.contact_phone || '', trn: c.trn || '', website: c.website || '', notes: c.notes || '' }); setModal(true); };
  const save = async () => {
    if (!form.name.trim()) { alert('Client name is required.'); return; }
    setSaving(true);
    try { await clientService.save({ ...form, name: form.name.trim(), company_id: activeCompanyId || undefined }, editId || undefined); setModal(false); await load(); }
    catch (e: any) { alert(e?.message || 'Save failed'); } finally { setSaving(false); }
  };

  const segments = useMemo(() => [...new Set(clients.map(c => c.segment).filter(Boolean))] as string[], [clients]);
  const rows = useMemo(() => clients.filter(c => {
    if (segFilter && c.segment !== segFilter) return false;
    if (statusFilter && (c.status || 'ACTIVE') !== statusFilter) return false;
    if (search) { const h = `${c.name} ${c.contact_person || ''} ${c.industry || ''} ${c.owner_name || ''}`.toLowerCase(); if (!h.includes(search.toLowerCase())) return false; }
    return true;
  }), [clients, segFilter, statusFilter, search]);

  const activeAmc = clients.reduce((s, c) => s + (amcByClient.get(c.id) || 0), 0);
  const exportCols = ['Client', 'Segment', 'Status', 'Owner', 'Contact', 'Quoted value', 'Active AMC'];
  const exportRows = rows.map(c => [c.name, c.segment || '', c.status || 'ACTIVE', c.owner_name || '', c.contact_person || '', Math.round(quoteByClient.get(c.id) || 0), Math.round(amcByClient.get(c.id) || 0)]);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Client Directory"
        subtitle="Accounts with CRM segmentation, quoted value and active AMC"
        breadcrumbs={[{ label: 'Pre-Sales', href: '/sales/dashboard' }, { label: 'Clients' }]}
        actions={
          <div className="flex gap-2">
            {rows.length > 0 && <>
              <Button variant="secondary" icon={FileDown} onClick={() => exportTablePdf({ title: 'Client Directory', columns: exportCols, rows: exportRows, fileName: 'client-directory' })}>PDF</Button>
              <Button variant="secondary" icon={Sheet} onClick={() => exportTableExcel({ title: 'Client Directory', columns: exportCols, rows: exportRows, fileName: 'client-directory' })}>Excel</Button>
            </>}
            <Button icon={Plus} onClick={openNew}>New client</Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Clients</div><div className="text-2xl font-bold mt-1">{clients.length}</div></Card>
        <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Active</div><div className="text-2xl font-bold mt-1">{clients.filter(c => (c.status || 'ACTIVE') === 'ACTIVE').length}</div></Card>
        <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Leads / Prospects</div><div className="text-2xl font-bold mt-1">{clients.filter(c => c.status === 'LEAD' || c.status === 'PROSPECT').length}</div></Card>
        <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Active AMC value</div><div className="text-lg font-bold mt-1">{aed(activeAmc)}</div></Card>
      </div>

      <Card className="p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="relative">
          <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search client / contact…" className="w-full pl-7 pr-2 h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm" />
        </div>
        <select value={segFilter} onChange={e => setSegFilter(e.target.value)} className="px-2 h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm"><option value="">All segments</option>{(segments.length ? segments : SEGMENTS).map(s => <option key={s} value={s}>{s}</option>)}</select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-2 h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm"><option value="">All statuses</option>{STATUSES.map(s => <option key={s} value={s}>{s}</option>)}</select>
      </Card>

      {loading ? (
        <Card><div className="p-8 text-center text-sm text-[var(--text-tertiary)]">Loading…</div></Card>
      ) : clients.length === 0 ? (
        <Card><EmptyState icon={Building2} title="No clients" description="Add your first client to build the directory." /></Card>
      ) : (
        <Card className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-[var(--border)] text-left text-[var(--text-tertiary)] text-xs">
              <th className="p-3">Client</th><th className="p-3">Segment</th><th className="p-3">Owner</th><th className="p-3">Contact</th>
              <th className="p-3 text-right">Quoted</th><th className="p-3 text-right">Active AMC</th><th className="p-3">Status</th><th className="p-3"></th>
            </tr></thead>
            <tbody>
              {rows.map(c => { const st = statusStyle[c.status || 'ACTIVE'] || statusStyle.ACTIVE; return (
                <tr key={c.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-hover)] cursor-pointer" onClick={() => router.push(`/sales/clients/${c.id}`)}>
                  <td className="p-3"><div className="font-medium text-[var(--text-primary)]">{c.name}</div>{c.industry && <div className="text-[11px] text-[var(--text-tertiary)]">{c.industry}</div>}</td>
                  <td className="p-3 text-xs text-[var(--text-secondary)]">{c.segment || '—'}</td>
                  <td className="p-3 text-xs text-[var(--text-secondary)]">{c.owner_name || '—'}</td>
                  <td className="p-3 text-xs text-[var(--text-secondary)]">{c.contact_person || '—'}{c.contact_phone ? <div className="text-[10px] text-[var(--text-tertiary)]">{c.contact_phone}</div> : ''}</td>
                  <td className="p-3 text-right tabular-nums">{quoteByClient.get(c.id) ? aed(quoteByClient.get(c.id)!) : '—'}</td>
                  <td className="p-3 text-right tabular-nums">{amcByClient.get(c.id) ? aed(amcByClient.get(c.id)!) : '—'}</td>
                  <td className="p-3"><span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: st.bg, color: st.tx }}>{c.status || 'ACTIVE'}</span></td>
                  <td className="p-3 text-right"><button onClick={e => { e.stopPropagation(); openEdit(c); }} className="p-1 text-[var(--text-tertiary)] hover:text-[var(--accent)]"><Pencil size={15} /></button></td>
                </tr>
              ); })}
            </tbody>
          </table>
        </Card>
      )}

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setModal(false)}>
          <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] w-full max-w-lg p-5 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="text-base font-semibold mb-3">{editId ? 'Edit client' : 'New client'}</div>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs text-[var(--text-secondary)] col-span-2">Name<input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="w-full mt-1 px-2 h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm" /></label>
              <label className="text-xs text-[var(--text-secondary)]">Segment<select value={form.segment} onChange={e => setForm(f => ({ ...f, segment: e.target.value }))} className="w-full mt-1 px-2 h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm"><option value="">—</option>{SEGMENTS.map(s => <option key={s} value={s}>{s}</option>)}</select></label>
              <label className="text-xs text-[var(--text-secondary)]">Status<select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className="w-full mt-1 px-2 h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm">{STATUSES.map(s => <option key={s} value={s}>{s}</option>)}</select></label>
              <label className="text-xs text-[var(--text-secondary)]">Industry<input value={form.industry} onChange={e => setForm(f => ({ ...f, industry: e.target.value }))} className="w-full mt-1 px-2 h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm" /></label>
              <label className="text-xs text-[var(--text-secondary)]">Account owner<input value={form.owner_name} onChange={e => setForm(f => ({ ...f, owner_name: e.target.value }))} className="w-full mt-1 px-2 h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm" /></label>
              <label className="text-xs text-[var(--text-secondary)]">Contact person<input value={form.contact_person} onChange={e => setForm(f => ({ ...f, contact_person: e.target.value }))} className="w-full mt-1 px-2 h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm" /></label>
              <label className="text-xs text-[var(--text-secondary)]">Contact phone<input value={form.contact_phone} onChange={e => setForm(f => ({ ...f, contact_phone: e.target.value }))} className="w-full mt-1 px-2 h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm" /></label>
              <label className="text-xs text-[var(--text-secondary)]">Contact email<input value={form.contact_email} onChange={e => setForm(f => ({ ...f, contact_email: e.target.value }))} className="w-full mt-1 px-2 h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm" /></label>
              <label className="text-xs text-[var(--text-secondary)]">TRN<input value={form.trn} onChange={e => setForm(f => ({ ...f, trn: e.target.value }))} className="w-full mt-1 px-2 h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm" /></label>
              <label className="text-xs text-[var(--text-secondary)] col-span-2">Website<input value={form.website} onChange={e => setForm(f => ({ ...f, website: e.target.value }))} className="w-full mt-1 px-2 h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm" /></label>
              <label className="text-xs text-[var(--text-secondary)] col-span-2">Notes<textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} className="w-full mt-1 px-2 py-1 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm" /></label>
            </div>
            <div className="flex justify-end gap-2 mt-4"><Button variant="secondary" onClick={() => setModal(false)}>Cancel</Button><Button onClick={save} isLoading={saving}>{editId ? 'Save' : 'Create'}</Button></div>
          </div>
        </div>
      )}
    </div>
  );
}
