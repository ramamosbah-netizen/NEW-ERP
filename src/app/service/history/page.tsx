'use client';

// ============================================================
// JEET ERP — Service: Client / Site Service History
// Unified timeline of contracts, tickets and PPM visits per client.
// Read-only; plain queries (no migration).
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { exportTablePdf, exportTableExcel } from '@/lib/finance-export';
import { History, FileDown, Sheet, Shield, Ticket, CalendarClock } from 'lucide-react';

const aed = (n: number) => `AED ${Number(n || 0).toLocaleString('en-AE', { maximumFractionDigits: 0 })}`;
const OPEN_TICKET = ['NEW', 'ASSIGNED', 'IN_PROGRESS', 'ON_HOLD_PARTS'];

interface Ev { date: string; kind: 'CONTRACT' | 'TICKET' | 'VISIT'; title: string; sub: string; status: string; href?: string; }
const kindMeta = {
  CONTRACT: { icon: Shield, color: 'var(--accent)', label: 'Contract' },
  TICKET: { icon: Ticket, color: 'var(--status-warning-text)', label: 'Ticket' },
  VISIT: { icon: CalendarClock, color: 'var(--status-info-text)', label: 'PPM Visit' },
};

export default function ServiceHistoryPage() {
  const router = useRouter();
  const [clients, setClients] = useState<{ id: string; name: string }[]>([]);
  const [clientId, setClientId] = useState('');
  const [events, setEvents] = useState<Ev[]>([]);
  const [summary, setSummary] = useState({ contracts: 0, tickets: 0, openTickets: 0, visits: 0, contractValue: 0 });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.from('clients').select('id, name').order('name').then(({ data }) => setClients((data || []) as any[]));
  }, []);

  const load = useCallback(async () => {
    if (!clientId) { setEvents([]); return; }
    setLoading(true);
    try {
      const [ctRes, tkRes] = await Promise.all([
        supabase.from('amc_contracts').select('id, contract_number, site_name, status, annual_value, start_date, end_date, created_at').eq('client_id', clientId),
        supabase.from('service_tickets').select('id, ticket_number, title, system, status, created_at, contract_id').eq('client_id', clientId),
      ]);
      const contracts = (ctRes.data || []) as any[];
      const tickets = (tkRes.data || []) as any[];
      const contractIds = contracts.map(c => c.id);
      let visits: any[] = [];
      if (contractIds.length) {
        const { data } = await supabase.from('ppm_visits').select('id, visit_number, status, target_month, scheduled_date, completed_at, contract_id').in('contract_id', contractIds);
        visits = data || [];
      }
      const cNum = new Map(contracts.map(c => [c.id, c.contract_number]));

      const evs: Ev[] = [];
      contracts.forEach(c => evs.push({ date: c.start_date || c.created_at, kind: 'CONTRACT', title: `${c.contract_number} — ${c.site_name || ''}`, sub: `${aed(c.annual_value)} · ${c.start_date || '?'} → ${c.end_date || '?'}`, status: c.status, href: `/amc/${c.id}` }));
      tickets.forEach(t => evs.push({ date: t.created_at, kind: 'TICKET', title: `${t.ticket_number} — ${t.title}`, sub: `${t.system || ''}${t.contract_id ? ` · ${cNum.get(t.contract_id) || ''}` : ''}`, status: t.status, href: `/service-desk/${t.id}` }));
      visits.forEach(v => evs.push({ date: v.completed_at || v.scheduled_date || v.target_month, kind: 'VISIT', title: `${v.visit_number} — PPM`, sub: `${cNum.get(v.contract_id) || ''} · target ${v.target_month?.slice(0, 7) || '?'}`, status: v.status, href: `/ppm/execute/${v.id}` }));
      evs.sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
      setEvents(evs);
      setSummary({
        contracts: contracts.length, tickets: tickets.length,
        openTickets: tickets.filter(t => OPEN_TICKET.includes(t.status)).length, visits: visits.length,
        contractValue: contracts.filter(c => c.status === 'ACTIVE').reduce((s, c) => s + Number(c.annual_value || 0), 0),
      });
    } finally { setLoading(false); }
  }, [clientId]);
  useEffect(() => { load(); }, [load]);

  const clientName = clients.find(c => c.id === clientId)?.name || '';
  const exportCols = ['Date', 'Type', 'Reference', 'Detail', 'Status'];
  const exportRows = events.map(e => [e.date ? e.date.slice(0, 10) : '', kindMeta[e.kind].label, e.title, e.sub, e.status]);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Client / Site Service History"
        subtitle="Unified timeline of contracts, tickets and preventive visits per client"
        breadcrumbs={[{ label: 'Service', href: '/service-desk' }, { label: 'Service History' }]}
        actions={events.length > 0 ? (
          <div className="flex gap-2">
            <Button variant="secondary" icon={FileDown} onClick={() => exportTablePdf({ title: 'Service History', subtitle: clientName, columns: exportCols, rows: exportRows, fileName: 'service-history' })}>PDF</Button>
            <Button variant="secondary" icon={Sheet} onClick={() => exportTableExcel({ title: 'Service History', subtitle: clientName, columns: exportCols, rows: exportRows, fileName: 'service-history' })}>Excel</Button>
          </div>
        ) : undefined}
      />

      <Card className="p-4">
        <label className="text-xs font-medium text-[var(--text-secondary)]">Client</label>
        <select value={clientId} onChange={e => setClientId(e.target.value)} className="w-full md:max-w-md mt-1 px-3 h-10 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm">
          <option value="">Select a client…</option>{clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </Card>

      {!clientId ? (
        <Card><EmptyState icon={History} title="Select a client" description="Choose a client to see their full service history." /></Card>
      ) : loading ? (
        <Card><div className="p-8 text-center text-sm text-[var(--text-tertiary)]">Loading…</div></Card>
      ) : events.length === 0 ? (
        <Card><EmptyState icon={History} title="No history" description="No contracts, tickets or visits for this client yet." /></Card>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Contracts</div><div className="text-2xl font-bold mt-1">{summary.contracts}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Active value</div><div className="text-lg font-bold mt-1">{aed(summary.contractValue)}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Tickets</div><div className="text-2xl font-bold mt-1">{summary.tickets}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Open tickets</div><div className="text-2xl font-bold mt-1" style={{ color: summary.openTickets ? 'var(--status-warning-text)' : 'var(--text-primary)' }}>{summary.openTickets}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">PPM visits</div><div className="text-2xl font-bold mt-1">{summary.visits}</div></Card>
          </div>

          <Card className="p-4">
            <div className="text-sm font-semibold text-[var(--text-primary)] mb-4">Timeline</div>
            <div className="flex flex-col gap-0">
              {events.map((e, i) => {
                const meta = kindMeta[e.kind]; const Icon = meta.icon;
                return (
                  <div key={i} className="flex gap-3 cursor-pointer hover:bg-[var(--surface-hover)] -mx-2 px-2 py-2 rounded" onClick={() => e.href && router.push(e.href)}>
                    <div className="flex flex-col items-center">
                      <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0" style={{ background: 'var(--surface-active)' }}><Icon size={14} style={{ color: meta.color }} /></div>
                      {i < events.length - 1 && <div className="w-px flex-1 my-1" style={{ background: 'var(--border)' }} />}
                    </div>
                    <div className="flex-1 pb-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-[var(--text-primary)]">{e.title}</span>
                        <span className="text-[10px] text-[var(--text-tertiary)] whitespace-nowrap">{e.date ? e.date.slice(0, 10) : '—'}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'var(--surface-active)', color: meta.color }}>{meta.label}</span>
                        <span className="text-xs text-[var(--text-tertiary)]">{e.sub}</span>
                        <span className="text-[10px] text-[var(--text-secondary)] ml-auto">{e.status?.replace(/_/g, ' ')}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
