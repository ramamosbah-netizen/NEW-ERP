'use client';

// ============================================================
// JEET ERP — Workspace: Notifications & Alerts Analytics
// Alerts by severity / channel / status, read & actioned rates
// and volume trend. Read-only; plain query (no migration).
// ============================================================

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { exportTablePdf, exportTableExcel } from '@/lib/finance-export';
import { Bell, FileDown, Sheet } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell, LineChart, Line } from 'recharts';

const DAY = 86400000;
const sevColor: Record<string, string> = { CRITICAL: 'var(--status-danger-text)', ACTION_REQUIRED: 'var(--status-warning-text)', INFO: 'var(--status-info-text)' };
const PIE = ['var(--status-danger-text)', 'var(--status-warning-text)', 'var(--status-info-text)', 'var(--accent)'];

interface Nt { severity: string; channel: string; status: string; read_at: string | null; actioned_at: string | null; created_at: string; title: string; user_id: string | null; }

export default function NotificationAnalyticsPage() {
  const [allRows, setAllRows] = useState<Nt[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [scope, setScope] = useState<'mine' | 'all'>('mine');

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id || null));
    supabase.from('notifications').select('severity, channel, status, read_at, actioned_at, created_at, title, user_id').order('created_at', { ascending: false })
      .then(({ data }) => setAllRows((data || []) as Nt[])).then(() => setLoading(false), () => setLoading(false));
  }, []);

  const rows = useMemo(() => scope === 'mine' && userId ? allRows.filter(r => r.user_id === userId) : allRows, [allRows, scope, userId]);

  const unread = rows.filter(r => r.status === 'PENDING').length;
  const critical = rows.filter(r => r.severity === 'CRITICAL').length;
  const actionReq = rows.filter(r => r.severity === 'ACTION_REQUIRED').length;
  const readRate = rows.length ? Math.round(rows.filter(r => r.status === 'READ' || r.read_at).length / rows.length * 100) : 0;
  const actionedRate = actionReq ? Math.round(rows.filter(r => r.severity === 'ACTION_REQUIRED' && r.actioned_at).length / actionReq * 100) : 0;

  const bySeverity = useMemo(() => [...new Set(rows.map(r => r.severity))].map(s => ({ name: s.replace(/_/g, ' '), value: rows.filter(r => r.severity === s).length })), [rows]);
  const byChannel = useMemo(() => [...new Set(rows.map(r => r.channel))].map(c => ({ name: c.replace(/_/g, ' '), value: rows.filter(r => r.channel === c).length })), [rows]);
  const trend = useMemo(() => {
    const now = Date.now(); const m = new Map<string, number>();
    for (let i = 13; i >= 0; i--) m.set(new Date(now - i * DAY).toISOString().slice(5, 10), 0);
    rows.forEach(r => { if (!r.created_at) return; const k = r.created_at.slice(5, 10); if (m.has(k)) m.set(k, (m.get(k) || 0) + 1); });
    return [...m.entries()].map(([day, value]) => ({ day, value }));
  }, [rows]);

  const unreadCritical = rows.filter(r => r.status === 'PENDING' && (r.severity === 'CRITICAL' || r.severity === 'ACTION_REQUIRED')).slice(0, 50);

  const exportCols = ['Severity', 'Channel', 'Status', 'Title', 'Created'];
  const exportRows = rows.slice(0, 500).map(r => [r.severity, r.channel, r.status, r.title, r.created_at?.slice(0, 16) || '']);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Notifications & Alerts Analytics"
        subtitle="Alert volume by severity & channel, read and actioned rates"
        breadcrumbs={[{ label: 'Alerts', href: '/notifications' }, { label: 'Analytics' }]}
        actions={rows.length > 0 ? (
          <div className="flex gap-2">
            <Button variant="secondary" icon={FileDown} onClick={() => exportTablePdf({ title: 'Alerts Analytics', columns: exportCols, rows: exportRows, fileName: 'alerts-analytics' })}>PDF</Button>
            <Button variant="secondary" icon={Sheet} onClick={() => exportTableExcel({ title: 'Alerts Analytics', columns: exportCols, rows: exportRows, fileName: 'alerts-analytics' })}>Excel</Button>
          </div>
        ) : undefined}
      />

      <Card className="p-3 flex items-center gap-2">
        <span className="text-xs text-[var(--text-secondary)]">View:</span>
        <div className="inline-flex rounded-md border border-[var(--border)] overflow-hidden">
          {(['mine', 'all'] as const).map(s => (
            <button key={s} onClick={() => setScope(s)} className="px-3 h-8 text-xs font-medium" style={{ background: scope === s ? 'var(--accent)' : 'var(--surface)', color: scope === s ? '#fff' : 'var(--text-secondary)' }}>{s === 'mine' ? 'My alerts' : 'Everyone'}</button>
          ))}
        </div>
      </Card>

      {loading ? (
        <Card><div className="p-8 text-center text-sm text-[var(--text-tertiary)]">Loading…</div></Card>
      ) : rows.length === 0 ? (
        <Card><EmptyState icon={Bell} title="No alerts" description={scope === 'mine' ? 'You have no alerts.' : 'Notifications will be analysed here.'} /></Card>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Total alerts</div><div className="text-2xl font-bold mt-1">{rows.length}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Unread</div><div className="text-2xl font-bold mt-1" style={{ color: unread ? 'var(--status-warning-text)' : 'var(--text-primary)' }}>{unread}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Critical</div><div className="text-2xl font-bold mt-1" style={{ color: critical ? 'var(--status-danger-text)' : 'var(--text-primary)' }}>{critical}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Read rate</div><div className="text-2xl font-bold mt-1" style={{ color: readRate >= 70 ? 'var(--status-success-text)' : 'var(--status-warning-text)' }}>{readRate}%</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Actioned rate</div><div className="text-2xl font-bold mt-1">{actionedRate}%</div><div className="text-[11px] text-[var(--text-tertiary)]">of action-required</div></Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <Card className="p-4">
              <div className="text-sm font-semibold text-[var(--text-primary)] mb-3">By severity</div>
              <div style={{ width: '100%', height: 220 }}>
                <ResponsiveContainer>
                  <PieChart><Pie data={bySeverity} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={(e: any) => e.name}>{bySeverity.map((d, i) => <Cell key={i} fill={sevColor[d.name.replace(/ /g, '_')] || PIE[i % PIE.length]} />)}</Pie><Tooltip /></PieChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card className="p-4">
              <div className="text-sm font-semibold text-[var(--text-primary)] mb-3">By channel</div>
              <div style={{ width: '100%', height: 220 }}>
                <ResponsiveContainer>
                  <BarChart data={byChannel}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} />
                    <YAxis tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="value" fill="var(--accent)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card className="p-4">
              <div className="text-sm font-semibold text-[var(--text-primary)] mb-3">Volume (14 days)</div>
              <div style={{ width: '100%', height: 220 }}>
                <ResponsiveContainer>
                  <LineChart data={trend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="day" tick={{ fontSize: 9, fill: 'var(--text-tertiary)' }} interval={1} />
                    <YAxis tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} allowDecimals={false} />
                    <Tooltip />
                    <Line dataKey="value" stroke="var(--accent)" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          <Card className="p-0 overflow-x-auto">
            <div className="p-3 text-sm font-semibold text-[var(--text-primary)] border-b border-[var(--border)]">Unread critical / action-required ({unreadCritical.length})</div>
            {unreadCritical.length === 0 ? <div className="p-5 text-center text-sm text-[var(--text-tertiary)]">No unread critical alerts.</div> : (
              <table className="w-full text-sm">
                <thead><tr className="border-b border-[var(--border)] text-left text-[var(--text-tertiary)] text-xs"><th className="p-3">Severity</th><th className="p-3">Title</th><th className="p-3">Channel</th><th className="p-3">Created</th></tr></thead>
                <tbody>
                  {unreadCritical.map((r, i) => (
                    <tr key={i} className="border-b border-[var(--border)] last:border-0">
                      <td className="p-3"><span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: 'var(--surface-active)', color: sevColor[r.severity] }}>{r.severity.replace(/_/g, ' ')}</span></td>
                      <td className="p-3 text-[var(--text-primary)] line-clamp-1">{r.title}</td>
                      <td className="p-3 text-xs text-[var(--text-secondary)]">{r.channel}</td>
                      <td className="p-3 text-xs text-[var(--text-secondary)]">{r.created_at?.slice(0, 16).replace('T', ' ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
