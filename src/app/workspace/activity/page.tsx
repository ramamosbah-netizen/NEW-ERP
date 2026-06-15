'use client';

// ============================================================
// JEET ERP — Workspace: Activity Timeline
// Recent cross-module activity from the audit log as a feed.
// Read-only; plain query + batched actor lookup (no migration).
// ============================================================

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { exportTablePdf, exportTableExcel } from '@/lib/finance-export';
import { Activity, FileDown, Sheet } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

const DAY = 86400000;
interface Ev { id: string; occurred_at: string; actor_user_id: string | null; actor_role: string | null; action: string; entity_type: string; entity_label: string | null; summary: string; module: string; }
const actionColor = (a: string) => /DELETE|REMOVE|CANCEL|REJECT/.test(a) ? 'var(--status-danger-text)' : /CREATE|ADD|APPROVE|CHECK_IN/.test(a) ? 'var(--status-success-text)' : /UPDATE|EDIT|ISSUE|POST/.test(a) ? 'var(--status-info-text)' : 'var(--accent)';

export default function ActivityTimelinePage() {
  const [rows, setRows] = useState<Ev[]>([]);
  const [nameMap, setNameMap] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [moduleFilter, setModuleFilter] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.from('audit_log').select('id, occurred_at, actor_user_id, actor_role, action, entity_type, entity_label, summary, module').order('occurred_at', { ascending: false }).limit(300);
        const evs = (data || []) as Ev[];
        setRows(evs);
        const ids = [...new Set(evs.map(e => e.actor_user_id).filter(Boolean))] as string[];
        if (ids.length) { const { data: p } = await supabase.from('profiles').select('id, full_name').in('id', ids); setNameMap(new Map((p || []).map((x: any) => [x.id, x.full_name]))); }
      } finally { setLoading(false); }
    })();
  }, []);

  const now = Date.now();
  const today = rows.filter(r => r.occurred_at && now - new Date(r.occurred_at).getTime() <= DAY).length;
  const week = rows.filter(r => r.occurred_at && now - new Date(r.occurred_at).getTime() <= 7 * DAY).length;
  const modules = [...new Set(rows.map(r => r.module).filter(Boolean))];
  const actors = new Set(rows.map(r => r.actor_user_id).filter(Boolean)).size;

  const filtered = useMemo(() => moduleFilter ? rows.filter(r => r.module === moduleFilter) : rows, [rows, moduleFilter]);

  const byModule = useMemo(() => { const m = new Map<string, number>(); rows.forEach(r => m.set(r.module || '—', (m.get(r.module || '—') || 0) + 1)); return [...m.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 8); }, [rows]);

  // group filtered by day
  const groups = useMemo(() => {
    const m = new Map<string, Ev[]>();
    filtered.forEach(e => { const k = (e.occurred_at || '').slice(0, 10); if (!m.has(k)) m.set(k, []); m.get(k)!.push(e); });
    return [...m.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [filtered]);

  const exportCols = ['When', 'Module', 'Action', 'Entity', 'Summary', 'Actor'];
  const exportRows = filtered.map(e => [e.occurred_at?.slice(0, 16).replace('T', ' ') || '', e.module, e.action, e.entity_label || e.entity_type, e.summary, e.actor_user_id ? nameMap.get(e.actor_user_id) || e.actor_role || '' : '']);

  const dayLabel = (d: string) => { const dt = new Date(d); const diff = Math.floor((now - dt.getTime()) / DAY); return diff === 0 ? 'Today' : diff === 1 ? 'Yesterday' : dt.toLocaleDateString('en-AE', { weekday: 'short', day: 'numeric', month: 'short' }); };

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Activity Timeline"
        subtitle="Recent cross-module activity across the system"
        breadcrumbs={[{ label: 'Workspace', href: '/workspace' }, { label: 'Activity' }]}
        actions={rows.length > 0 ? (
          <div className="flex gap-2">
            <Button variant="secondary" icon={FileDown} onClick={() => exportTablePdf({ title: 'Activity Timeline', columns: exportCols, rows: exportRows, fileName: 'activity-timeline' })}>PDF</Button>
            <Button variant="secondary" icon={Sheet} onClick={() => exportTableExcel({ title: 'Activity Timeline', columns: exportCols, rows: exportRows, fileName: 'activity-timeline' })}>Excel</Button>
          </div>
        ) : undefined}
      />

      {loading ? (
        <Card><div className="p-8 text-center text-sm text-[var(--text-tertiary)]">Loading…</div></Card>
      ) : rows.length === 0 ? (
        <Card><EmptyState icon={Activity} title="No activity" description="System activity from the audit log appears here." /></Card>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Last 24h</div><div className="text-2xl font-bold mt-1">{today}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Last 7 days</div><div className="text-2xl font-bold mt-1">{week}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Modules active</div><div className="text-2xl font-bold mt-1">{modules.length}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Actors</div><div className="text-2xl font-bold mt-1">{actors}</div></Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <Card className="p-4 lg:col-span-1">
              <div className="text-sm font-semibold text-[var(--text-primary)] mb-3">Activity by module</div>
              <div style={{ width: '100%', height: 240 }}>
                <ResponsiveContainer>
                  <BarChart data={byModule} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} allowDecimals={false} />
                    <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }} />
                    <Tooltip />
                    <Bar dataKey="value" fill="var(--accent)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card className="p-4 lg:col-span-2">
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm font-semibold text-[var(--text-primary)]">Feed</div>
                <select value={moduleFilter} onChange={e => setModuleFilter(e.target.value)} className="px-2 h-8 rounded-md border border-[var(--border)] bg-[var(--surface)] text-xs"><option value="">All modules</option>{modules.map(m => <option key={m} value={m}>{m}</option>)}</select>
              </div>
              <div className="max-h-[420px] overflow-y-auto pr-1">
                {groups.map(([day, evs]) => (
                  <div key={day} className="mb-3">
                    <div className="text-[11px] font-semibold text-[var(--text-tertiary)] sticky top-0 bg-[var(--surface)] py-1">{dayLabel(day)}</div>
                    <div className="flex flex-col gap-1.5 mt-1">
                      {evs.map(e => (
                        <div key={e.id} className="flex gap-2 items-start">
                          <span className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ background: actionColor(e.action) }} />
                          <div className="flex-1 min-w-0">
                            <div className="text-xs text-[var(--text-primary)] truncate">{e.summary}</div>
                            <div className="text-[10px] text-[var(--text-tertiary)]"><span style={{ color: actionColor(e.action) }}>{e.action}</span> · {e.module} · {e.actor_user_id ? nameMap.get(e.actor_user_id) || e.actor_role || 'system' : 'system'} · {e.occurred_at?.slice(11, 16)}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
