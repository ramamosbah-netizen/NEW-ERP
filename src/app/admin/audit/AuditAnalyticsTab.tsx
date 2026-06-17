'use client';

// ============================================================
// JEET ERP — Audit & Activity Analytics (tab of /admin/audit)
// Trends over the audit_log with a security lens. Read-only; export.
// ============================================================

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { exportTablePdf, exportTableExcel } from '@/lib/finance-export';
import { Activity, FileDown, Sheet, ShieldAlert } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, AreaChart, Area, PieChart, Pie, Cell, Legend } from 'recharts';

const PIE = ['var(--accent)', 'var(--status-info-text)', 'var(--status-success-text)', 'var(--status-warning-text)', 'var(--status-danger-text)', '#a855f7', '#64748b'];
const ACTION_COLOR: Record<string, string> = { CREATE: 'var(--status-success-text)', UPDATE: 'var(--status-info-text)', DELETE: 'var(--status-danger-text)', APPROVE: 'var(--accent)', CHECK_IN: '#a855f7' };
const SENSITIVE = ['DELETE', 'APPROVE', 'REJECT'];

interface Ev { id: string; occurred_at: string; actor_user_id: string | null; actor_role: string | null; action: string; entity_type: string | null; entity_label: string | null; summary: string | null; module: string | null; source: string | null; ip: string | null; }

export default function AuditAnalyticsTab() {
  const [events, setEvents] = useState<Ev[]>([]);
  const [nameMap, setNameMap] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.from('audit_log').select('id, occurred_at, actor_user_id, actor_role, action, entity_type, entity_label, summary, module, source, ip').order('occurred_at', { ascending: false }).limit(2000);
        const rows = (data || []) as Ev[];
        setEvents(rows);
        const ids = [...new Set(rows.map(r => r.actor_user_id).filter(Boolean))] as string[];
        if (ids.length) { const { data: p } = await supabase.from('profiles').select('id, full_name').in('id', ids); setNameMap(new Map((p || []).map((x: any) => [x.id, x.full_name]))); }
      } finally { setLoading(false); }
    })();
  }, []);

  const now = Date.now();
  const d30 = now - 30 * 864e5, d7 = now - 7 * 864e5;
  const e30 = events.filter(e => new Date(e.occurred_at).getTime() >= d30);
  const e7 = events.filter(e => new Date(e.occurred_at).getTime() >= d7);
  const actors = new Set(events.map(e => e.actor_user_id).filter(Boolean)).size;
  const sensitive = events.filter(e => SENSITIVE.includes(e.action));

  const byDay = useMemo(() => {
    const m = new Map<string, number>();
    for (let i = 29; i >= 0; i--) { const d = new Date(now - i * 864e5).toISOString().slice(0, 10); m.set(d, 0); }
    events.forEach(e => { const k = e.occurred_at.slice(0, 10); if (m.has(k)) m.set(k, (m.get(k) || 0) + 1); });
    return [...m.entries()].map(([d, v]) => ({ day: d.slice(5), value: v }));
  }, [events]);
  const byModule = useMemo(() => { const m = new Map<string, number>(); events.forEach(e => { const k = (e.module || '—').toUpperCase(); m.set(k, (m.get(k) || 0) + 1); }); return [...m.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value); }, [events]);
  const byAction = useMemo(() => { const m = new Map<string, number>(); events.forEach(e => m.set(e.action, (m.get(e.action) || 0) + 1)); return [...m.entries()].map(([name, value]) => ({ name, value })); }, [events]);
  const topActors = useMemo(() => { const m = new Map<string, number>(); events.forEach(e => { if (!e.actor_user_id) return; m.set(e.actor_user_id, (m.get(e.actor_user_id) || 0) + 1); }); return [...m.entries()].map(([id, v]) => ({ name: nameMap.get(id) || id.slice(0, 6), value: v })).sort((a, b) => b.value - a.value).slice(0, 8); }, [events, nameMap]);

  const fmtDate = (s: string) => new Date(s).toLocaleString('en-AE', { dateStyle: 'short', timeStyle: 'short' });
  const exportCols = ['When', 'Actor', 'Role', 'Action', 'Module', 'Entity', 'Summary', 'Source'];
  const exportRows = events.map(e => [fmtDate(e.occurred_at), e.actor_user_id ? nameMap.get(e.actor_user_id) || '' : '', e.actor_role || '', e.action, e.module || '', e.entity_label || '', e.summary || '', e.source || '']);

  if (loading) return <Card><div className="p-8 text-center text-sm text-[var(--text-tertiary)]">Loading…</div></Card>;
  if (events.length === 0) return <Card><EmptyState icon={Activity} title="No audit events" description="Platform activity will be analysed here as users create, update and approve records." /></Card>;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex justify-end gap-2">
        <Button variant="secondary" size="sm" icon={FileDown} onClick={() => exportTablePdf({ title: 'Audit Log', columns: exportCols, rows: exportRows, fileName: 'audit-log' })}>PDF</Button>
        <Button variant="secondary" size="sm" icon={Sheet} onClick={() => exportTableExcel({ title: 'Audit Log', columns: exportCols, rows: exportRows, fileName: 'audit-log' })}>Excel</Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Total events</div><div className="text-2xl font-bold mt-1">{events.length}</div></Card>
        <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Last 30 days</div><div className="text-2xl font-bold mt-1">{e30.length}</div></Card>
        <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Last 7 days</div><div className="text-2xl font-bold mt-1">{e7.length}</div></Card>
        <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Active actors</div><div className="text-2xl font-bold mt-1">{actors}</div></Card>
        <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Sensitive actions</div><div className="text-2xl font-bold mt-1" style={{ color: sensitive.length ? 'var(--status-danger-text)' : 'var(--text-primary)' }}>{sensitive.length}</div></Card>
      </div>

      <Card className="p-4">
        <div className="text-sm font-semibold text-[var(--text-primary)] mb-3">Activity — last 30 days</div>
        <div style={{ width: '100%', height: 240 }}>
          <ResponsiveContainer>
            <AreaChart data={byDay}>
              <defs><linearGradient id="auFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--accent)" stopOpacity={0.3} /><stop offset="100%" stopColor="var(--accent)" stopOpacity={0} /></linearGradient></defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="day" tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }} interval={3} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} allowDecimals={false} />
              <Tooltip />
              <Area dataKey="value" stroke="var(--accent)" fill="url(#auFill)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card className="p-4">
          <div className="text-sm font-semibold text-[var(--text-primary)] mb-3">By module</div>
          <div style={{ width: '100%', height: 220 }}>
            <ResponsiveContainer>
              <BarChart data={byModule} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} allowDecimals={false} />
                <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }} />
                <Tooltip />
                <Bar dataKey="value" fill="var(--accent)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-sm font-semibold text-[var(--text-primary)] mb-3">By action</div>
          <div style={{ width: '100%', height: 220 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie data={byAction} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75} fontSize={10}>{byAction.map((e, i) => <Cell key={i} fill={ACTION_COLOR[e.name] || PIE[i % PIE.length]} />)}</Pie>
                <Legend wrapperStyle={{ fontSize: 10 }} /><Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-sm font-semibold text-[var(--text-primary)] mb-3">Top actors</div>
          <div style={{ width: '100%', height: 220 }}>
            <ResponsiveContainer>
              <BarChart data={topActors} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} allowDecimals={false} />
                <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }} />
                <Tooltip />
                <Bar dataKey="value" fill="var(--status-info-text)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card className="p-0 overflow-x-auto">
        <div className="p-3 text-sm font-semibold border-b border-[var(--border)] flex items-center gap-2" style={{ color: sensitive.length ? 'var(--status-danger-text)' : 'var(--text-primary)' }}><ShieldAlert size={15} /> Security-sensitive actions ({sensitive.length})</div>
        {sensitive.length === 0 ? <div className="p-5 text-center text-sm text-[var(--text-tertiary)]">No deletes or approvals recorded.</div> : (
          <table className="w-full text-sm">
            <thead><tr className="border-b border-[var(--border)] text-left text-[var(--text-tertiary)] text-xs"><th className="p-3">When</th><th className="p-3">Actor</th><th className="p-3">Action</th><th className="p-3">Module</th><th className="p-3">Entity</th></tr></thead>
            <tbody>
              {sensitive.slice(0, 30).map(e => (
                <tr key={e.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-hover)]">
                  <td className="p-3 text-xs text-[var(--text-secondary)] whitespace-nowrap">{fmtDate(e.occurred_at)}</td>
                  <td className="p-3 text-[var(--text-primary)]">{e.actor_user_id ? nameMap.get(e.actor_user_id) || '—' : '—'}<span className="text-[11px] text-[var(--text-tertiary)]">{e.actor_role ? ` · ${e.actor_role}` : ''}</span></td>
                  <td className="p-3"><span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: 'var(--surface-active)', color: ACTION_COLOR[e.action] || 'var(--text-secondary)' }}>{e.action}</span></td>
                  <td className="p-3 text-xs text-[var(--text-secondary)]">{(e.module || '—').toUpperCase()}</td>
                  <td className="p-3 text-xs text-[var(--text-secondary)]">{e.entity_label || e.summary || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
