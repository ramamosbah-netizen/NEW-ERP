'use client';

// ============================================================
// JEET ERP — AMC: Equipment / Asset Register
// Consolidated AMC equipment across contracts, condition, and
// service history (ticket count). Read-only; plain queries.
// ============================================================

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { exportTablePdf, exportTableExcel } from '@/lib/finance-export';
import { Cpu, FileDown, Sheet, Search } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell } from 'recharts';

const CONDITIONS = ['GOOD', 'FAIR', 'POOR', 'FAULTY'];
const condColor: Record<string, string> = { GOOD: 'var(--status-success-text)', FAIR: 'var(--status-info-text)', POOR: 'var(--status-warning-text)', FAULTY: 'var(--status-danger-text)' };
const PIE = ['var(--status-success-text)', 'var(--status-info-text)', 'var(--status-warning-text)', 'var(--status-danger-text)'];

interface Eq { id: string; contract_id: string; system: string; equipment_type: string; brand: string; model: string; serial_no: string | null; location_label: string; install_date: string | null; condition: string; }

export default function EquipmentRegisterPage() {
  const [equipment, setEquipment] = useState<Eq[]>([]);
  const [contractMap, setContractMap] = useState<Map<string, { number: string; client: string; site: string }>>(new Map());
  const [ticketCount, setTicketCount] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [systemFilter, setSystemFilter] = useState('');
  const [conditionFilter, setConditionFilter] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.from('amc_equipment').select('id, contract_id, system, equipment_type, brand, model, serial_no, location_label, install_date, condition');
        const rows = (data || []) as Eq[];
        setEquipment(rows);
        const cids = [...new Set(rows.map(r => r.contract_id).filter(Boolean))] as string[];
        const [cRes, tRes] = await Promise.all([
          cids.length ? supabase.from('amc_contracts').select('id, contract_number, client_name, site_name').in('id', cids) : Promise.resolve({ data: [] as any[] }),
          supabase.from('service_tickets').select('equipment_id'),
        ]);
        setContractMap(new Map((cRes.data || []).map((c: any) => [c.id, { number: c.contract_number, client: c.client_name, site: c.site_name }])));
        const tc = new Map<string, number>();
        (tRes.data || []).forEach((t: any) => { if (t.equipment_id) tc.set(t.equipment_id, (tc.get(t.equipment_id) || 0) + 1); });
        setTicketCount(tc);
      } finally { setLoading(false); }
    })();
  }, []);

  const systems = useMemo(() => [...new Set(equipment.map(e => e.system).filter(Boolean))].sort(), [equipment]);
  const rows = useMemo(() => equipment.filter(e => {
    if (systemFilter && e.system !== systemFilter) return false;
    if (conditionFilter && e.condition !== conditionFilter) return false;
    if (search) { const h = `${e.equipment_type} ${e.brand} ${e.model} ${e.serial_no || ''} ${e.location_label}`.toLowerCase(); if (!h.includes(search.toLowerCase())) return false; }
    return true;
  }), [equipment, systemFilter, conditionFilter, search]);

  const faulty = equipment.filter(e => e.condition === 'FAULTY').length;
  const bySystem = useMemo(() => { const m = new Map<string, number>(); equipment.forEach(e => m.set(e.system || '—', (m.get(e.system || '—') || 0) + 1)); return [...m.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 8); }, [equipment]);
  const byCondition = useMemo(() => CONDITIONS.map(c => ({ name: c, value: equipment.filter(e => e.condition === c).length })).filter(d => d.value > 0), [equipment]);

  const exportCols = ['Type', 'Brand', 'Model', 'Serial', 'System', 'Location', 'Condition', 'Contract', 'Client', 'Install date', 'Tickets'];
  const exportRows = rows.map(e => { const c = contractMap.get(e.contract_id); return [e.equipment_type, e.brand, e.model, e.serial_no || '', e.system, e.location_label, e.condition, c?.number || '', c?.client || '', e.install_date || '', ticketCount.get(e.id) || 0]; });

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Equipment / Asset Register"
        subtitle="All AMC-covered equipment across contracts, condition and service history"
        breadcrumbs={[{ label: 'AMC', href: '/amc' }, { label: 'Equipment' }]}
        actions={rows.length > 0 ? (
          <div className="flex gap-2">
            <Button variant="secondary" icon={FileDown} onClick={() => exportTablePdf({ title: 'AMC Equipment Register', columns: exportCols, rows: exportRows, fileName: 'amc-equipment' })}>PDF</Button>
            <Button variant="secondary" icon={Sheet} onClick={() => exportTableExcel({ title: 'AMC Equipment Register', columns: exportCols, rows: exportRows, fileName: 'amc-equipment' })}>Excel</Button>
          </div>
        ) : undefined}
      />

      {loading ? (
        <Card><div className="p-8 text-center text-sm text-[var(--text-tertiary)]">Loading…</div></Card>
      ) : equipment.length === 0 ? (
        <Card><EmptyState icon={Cpu} title="No equipment registered" description="Equipment added to AMC contracts appears here." /></Card>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Total equipment</div><div className="text-2xl font-bold mt-1">{equipment.length}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Faulty</div><div className="text-2xl font-bold mt-1" style={{ color: faulty ? 'var(--status-danger-text)' : 'var(--text-primary)' }}>{faulty}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Contracts</div><div className="text-2xl font-bold mt-1">{contractMap.size}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Systems</div><div className="text-2xl font-bold mt-1">{systems.length}</div></Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <Card className="p-4">
              <div className="text-sm font-semibold text-[var(--text-primary)] mb-3">By system</div>
              <div style={{ width: '100%', height: 240 }}>
                <ResponsiveContainer>
                  <BarChart data={bySystem} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} allowDecimals={false} />
                    <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }} />
                    <Tooltip />
                    <Bar dataKey="count" fill="var(--accent)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card className="p-4">
              <div className="text-sm font-semibold text-[var(--text-primary)] mb-3">By condition</div>
              <div style={{ width: '100%', height: 240 }}>
                <ResponsiveContainer>
                  <PieChart><Pie data={byCondition} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={85} label={(e: any) => e.name}>{byCondition.map((d, i) => <Cell key={i} fill={condColor[d.name] || PIE[i]} />)}</Pie><Tooltip /></PieChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          <Card className="p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="relative">
              <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search brand / model / serial…" className="w-full pl-7 pr-2 h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm" />
            </div>
            <select value={systemFilter} onChange={e => setSystemFilter(e.target.value)} className="px-2 h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm"><option value="">All systems</option>{systems.map(s => <option key={s} value={s}>{s}</option>)}</select>
            <select value={conditionFilter} onChange={e => setConditionFilter(e.target.value)} className="px-2 h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm"><option value="">All conditions</option>{CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}</select>
          </Card>

          <Card className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-[var(--border)] text-left text-[var(--text-tertiary)] text-xs">
                <th className="p-3">Equipment</th><th className="p-3">System</th><th className="p-3">Location</th><th className="p-3">Contract</th>
                <th className="p-3">Condition</th><th className="p-3 text-right">Tickets</th><th className="p-3">Installed</th>
              </tr></thead>
              <tbody>
                {rows.map(e => { const c = contractMap.get(e.contract_id); return (
                  <tr key={e.id} className="border-b border-[var(--border)] last:border-0">
                    <td className="p-3"><div className="font-medium text-[var(--text-primary)]">{e.equipment_type}</div><div className="text-[11px] text-[var(--text-tertiary)]">{e.brand} {e.model}{e.serial_no ? ` · ${e.serial_no}` : ''}</div></td>
                    <td className="p-3 text-xs text-[var(--text-secondary)]">{e.system}</td>
                    <td className="p-3 text-xs text-[var(--text-secondary)]">{e.location_label}</td>
                    <td className="p-3 text-xs text-[var(--text-secondary)]">{c?.number || '—'}<div className="text-[10px] text-[var(--text-tertiary)]">{c?.client}</div></td>
                    <td className="p-3"><span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: 'var(--surface-active)', color: condColor[e.condition] || 'var(--text-secondary)' }}>{e.condition}</span></td>
                    <td className="p-3 text-right tabular-nums">{ticketCount.get(e.id) || 0}</td>
                    <td className="p-3 text-xs text-[var(--text-secondary)]">{e.install_date || '—'}</td>
                  </tr>
                ); })}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </div>
  );
}
