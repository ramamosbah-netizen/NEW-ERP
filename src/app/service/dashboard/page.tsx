'use client';

// ============================================================
// JEET ERP — Service & AMC Operations Dashboard
// Unified health across tickets, SLA, PPM and AMC contracts.
// Read-only; batched plain queries (no migration).
// ============================================================

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { exportTablePdf, exportTableExcel } from '@/lib/finance-export';
import { LayoutDashboard, FileDown, Sheet, AlertTriangle } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell } from 'recharts';

const DAY = 86400000;
const aed = (n: number) => `AED ${Number(n || 0).toLocaleString('en-AE', { maximumFractionDigits: 0 })}`;
const OPEN_TICKET = ['NEW', 'ASSIGNED', 'IN_PROGRESS', 'ON_HOLD_PARTS'];
const PIE = ['var(--status-info-text)', 'var(--status-warning-text)', 'var(--status-danger-text)', 'var(--accent)', 'var(--status-success-text)', '#8b5cf6'];

interface Tk { status: string; priority: string; sla_resolution_due: string; response_met: boolean | null; resolution_met: boolean | null; created_at: string; coverage: string; }
interface Ct { status: string; annual_value: number; end_date: string; sira_linked: boolean; sira_expiry_date: string | null; auto_renewal: boolean; }
interface Vt { status: string; target_month: string; scheduled_date: string | null; }

export default function ServiceOpsDashboard() {
  const router = useRouter();
  const [tickets, setTickets] = useState<Tk[]>([]);
  const [contracts, setContracts] = useState<Ct[]>([]);
  const [visits, setVisits] = useState<Vt[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [tk, ct, vt] = await Promise.all([
          supabase.from('service_tickets').select('status, priority, sla_resolution_due, response_met, resolution_met, created_at, coverage'),
          supabase.from('amc_contracts').select('status, annual_value, end_date, sira_linked, sira_expiry_date, auto_renewal'),
          supabase.from('ppm_visits').select('status, target_month, scheduled_date'),
        ]);
        setTickets((tk.data || []) as Tk[]);
        setContracts((ct.data || []) as Ct[]);
        setVisits((vt.data || []) as Vt[]);
      } finally { setLoading(false); }
    })();
  }, []);

  const now = Date.now();
  const openTickets = tickets.filter(t => OPEN_TICKET.includes(t.status));
  const slaBreaches = openTickets.filter(t => t.sla_resolution_due && new Date(t.sla_resolution_due).getTime() < now).length;
  const resolved = tickets.filter(t => t.resolution_met !== null && t.resolution_met !== undefined);
  const slaCompliance = resolved.length ? Math.round(resolved.filter(t => t.resolution_met).length / resolved.length * 100) : 100;
  const emergencyOpen = openTickets.filter(t => t.priority === 'EMERGENCY').length;

  const startOfMonth = new Date(); startOfMonth.setDate(1); startOfMonth.setHours(0, 0, 0, 0);
  const ppmOpen = visits.filter(v => v.status !== 'COMPLETED' && v.status !== 'CANCELLED');
  const ppmOverdue = ppmOpen.filter(v => v.target_month && new Date(v.target_month).getTime() < startOfMonth.getTime()).length;
  const ppmCompleted = visits.filter(v => v.status === 'COMPLETED').length;
  const ppmRate = visits.length ? Math.round(ppmCompleted / visits.length * 100) : 0;

  const activeContracts = contracts.filter(c => c.status === 'ACTIVE');
  const amcRevenue = activeContracts.reduce((s, c) => s + Number(c.annual_value || 0), 0);
  const expiring = contracts.filter(c => c.status === 'EXPIRING' || (c.status === 'ACTIVE' && c.end_date && new Date(c.end_date).getTime() - now <= 60 * DAY && new Date(c.end_date).getTime() >= now)).length;
  const siraExpiring = contracts.filter(c => c.sira_linked && c.sira_expiry_date && new Date(c.sira_expiry_date).getTime() - now <= 60 * DAY).length;

  const ticketsByStatus = ['NEW', 'ASSIGNED', 'IN_PROGRESS', 'ON_HOLD_PARTS', 'RESOLVED', 'CLOSED'].map(s => ({ name: s.replace(/_/g, ' '), value: tickets.filter(t => t.status === s).length })).filter(d => d.value > 0);
  const ticketsByPriority = ['EMERGENCY', 'HIGH', 'MEDIUM', 'LOW'].map(p => ({ name: p, value: openTickets.filter(t => t.priority === p).length })).filter(d => d.value > 0);
  const ppmByStatus = ['UNSCHEDULED', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'MISSED', 'CANCELLED'].map(s => ({ name: s.replace(/_/g, ' '), value: visits.filter(v => v.status === s).length })).filter(d => d.value > 0);

  const exportCols = ['Metric', 'Value'];
  const exportRows = [
    ['Open tickets', openTickets.length], ['SLA breaches (open)', slaBreaches], ['SLA compliance %', slaCompliance],
    ['Emergency open', emergencyOpen], ['PPM open', ppmOpen.length], ['PPM overdue', ppmOverdue], ['PPM completion %', ppmRate],
    ['Active contracts', activeContracts.length], ['AMC annual revenue', amcRevenue], ['Contracts expiring (60d)', expiring], ['SIRA expiring (60d)', siraExpiring],
  ];

  const hasData = tickets.length || contracts.length || visits.length;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Service & AMC Operations"
        subtitle="Live health across tickets, SLA, preventive maintenance and contracts"
        breadcrumbs={[{ label: 'Service', href: '/service-desk' }, { label: 'Operations' }]}
        actions={hasData ? (
          <div className="flex gap-2">
            <Button variant="secondary" icon={FileDown} onClick={() => exportTablePdf({ title: 'Service & AMC Operations', columns: exportCols, rows: exportRows, fileName: 'service-ops' })}>PDF</Button>
            <Button variant="secondary" icon={Sheet} onClick={() => exportTableExcel({ title: 'Service & AMC Operations', columns: exportCols, rows: exportRows, fileName: 'service-ops' })}>Excel</Button>
          </div>
        ) : undefined}
      />

      {loading ? (
        <Card><div className="p-8 text-center text-sm text-[var(--text-tertiary)]">Loading operations…</div></Card>
      ) : !hasData ? (
        <Card><EmptyState icon={LayoutDashboard} title="No service data yet" description="Tickets, PPM visits and AMC contracts will be summarised here." /></Card>
      ) : (
        <>
          {/* Service KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="p-4 cursor-pointer hover:border-[var(--accent)]" onClick={() => router.push('/service-desk')}><div className="text-xs text-[var(--text-secondary)]">Open tickets</div><div className="text-2xl font-bold mt-1">{openTickets.length}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">SLA breaches (open)</div><div className="text-2xl font-bold mt-1" style={{ color: slaBreaches ? 'var(--status-danger-text)' : 'var(--text-primary)' }}>{slaBreaches}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">SLA compliance</div><div className="text-2xl font-bold mt-1" style={{ color: slaCompliance >= 90 ? 'var(--status-success-text)' : slaCompliance >= 75 ? 'var(--status-warning-text)' : 'var(--status-danger-text)' }}>{slaCompliance}%</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Emergency open</div><div className="text-2xl font-bold mt-1" style={{ color: emergencyOpen ? 'var(--status-danger-text)' : 'var(--text-primary)' }}>{emergencyOpen}</div></Card>
          </div>
          {/* AMC + PPM KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="p-4 cursor-pointer hover:border-[var(--accent)]" onClick={() => router.push('/amc')}><div className="text-xs text-[var(--text-secondary)]">Active contracts</div><div className="text-2xl font-bold mt-1">{activeContracts.length}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">AMC annual revenue</div><div className="text-xl font-bold mt-1">{aed(amcRevenue)}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Expiring ≤60d</div><div className="text-2xl font-bold mt-1" style={{ color: expiring ? 'var(--status-warning-text)' : 'var(--text-primary)' }}>{expiring}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">SIRA expiring ≤60d</div><div className="text-2xl font-bold mt-1" style={{ color: siraExpiring ? 'var(--status-warning-text)' : 'var(--text-primary)' }}>{siraExpiring}</div></Card>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="p-4 cursor-pointer hover:border-[var(--accent)]" onClick={() => router.push('/ppm/calendar')}><div className="text-xs text-[var(--text-secondary)]">PPM open</div><div className="text-2xl font-bold mt-1">{ppmOpen.length}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">PPM overdue</div><div className="text-2xl font-bold mt-1" style={{ color: ppmOverdue ? 'var(--status-danger-text)' : 'var(--text-primary)' }}>{ppmOverdue}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">PPM completion</div><div className="text-2xl font-bold mt-1">{ppmRate}%</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Total tickets</div><div className="text-2xl font-bold mt-1">{tickets.length}</div></Card>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <Card className="p-4 lg:col-span-1">
              <div className="text-sm font-semibold text-[var(--text-primary)] mb-3">Tickets by status</div>
              <div style={{ width: '100%', height: 240 }}>
                <ResponsiveContainer>
                  <BarChart data={ticketsByStatus} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} allowDecimals={false} />
                    <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }} />
                    <Tooltip />
                    <Bar dataKey="value" fill="var(--accent)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card className="p-4">
              <div className="text-sm font-semibold text-[var(--text-primary)] mb-3">Open tickets by priority</div>
              <div style={{ width: '100%', height: 240 }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={ticketsByPriority} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={85} label={(e: any) => e.name}>
                      {ticketsByPriority.map((_, i) => <Cell key={i} fill={PIE[i % PIE.length]} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card className="p-4">
              <div className="text-sm font-semibold text-[var(--text-primary)] mb-3">PPM visits by status</div>
              <div style={{ width: '100%', height: 240 }}>
                <ResponsiveContainer>
                  <BarChart data={ppmByStatus}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="name" tick={{ fontSize: 9, fill: 'var(--text-tertiary)' }} />
                    <YAxis tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="value" fill="var(--status-info-text)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          {(slaBreaches > 0 || ppmOverdue > 0 || siraExpiring > 0) && (
            <Card className="p-4" style={{ background: 'var(--status-warning-bg)' }}>
              <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--status-warning-text)' }}><AlertTriangle size={16} /> Attention needed</div>
              <ul className="mt-2 text-xs space-y-1" style={{ color: 'var(--status-warning-text)' }}>
                {slaBreaches > 0 && <li>• {slaBreaches} open ticket(s) past their SLA resolution deadline.</li>}
                {ppmOverdue > 0 && <li>• {ppmOverdue} PPM visit(s) overdue (target month passed).</li>}
                {siraExpiring > 0 && <li>• {siraExpiring} contract(s) with SIRA approval expiring within 60 days.</li>}
              </ul>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
