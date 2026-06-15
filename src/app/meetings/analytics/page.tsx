'use client';

// ============================================================
// JEET ERP — Workspace: Meeting Analytics & Action Items
// Meetings by status + month, minutes published, and action-item
// tracking (open/overdue). Read-only; plain queries (no migration).
// ============================================================

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { exportTablePdf, exportTableExcel } from '@/lib/finance-export';
import { Calendar, FileDown, Sheet } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

const DONE = ['DONE', 'COMPLETED', 'CLOSED'];

interface Mt { id: string; title: string; status: string; starts_at: string | null; minutes_published_at: string | null; }
interface Ai { id: string; meeting_id: string | null; description: string; assignee_id: string | null; due_date: string | null; status: string; }

export default function MeetingAnalyticsPage() {
  const router = useRouter();
  const [meetings, setMeetings] = useState<Mt[]>([]);
  const [actions, setActions] = useState<Ai[]>([]);
  const [nameMap, setNameMap] = useState<Map<string, string>>(new Map());
  const [meetingTitle, setMeetingTitle] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [mt, ai] = await Promise.all([
          supabase.from('meetings').select('id, title, status, starts_at, minutes_published_at').order('starts_at', { ascending: false }),
          supabase.from('meeting_action_items').select('*'),
        ]);
        const mtRows = (mt.data || []) as Mt[];
        const aiRows = (ai.data || []) as Ai[];
        setMeetings(mtRows); setActions(aiRows);
        setMeetingTitle(new Map(mtRows.map(m => [m.id, m.title])));
        const ids = [...new Set(aiRows.map(a => a.assignee_id).filter(Boolean))] as string[];
        if (ids.length) { const { data: p } = await supabase.from('profiles').select('id, full_name').in('id', ids); setNameMap(new Map((p || []).map((x: any) => [x.id, x.full_name]))); }
      } finally { setLoading(false); }
    })();
  }, []);

  const now = Date.now();
  const completed = meetings.filter(m => m.status === 'COMPLETED').length;
  const upcoming = meetings.filter(m => m.status === 'SCHEDULED' && m.starts_at && new Date(m.starts_at).getTime() >= now).length;
  const published = meetings.filter(m => m.minutes_published_at).length;
  const openActions = actions.filter(a => !DONE.includes((a.status || '').toUpperCase()));
  const overdueActions = openActions.filter(a => a.due_date && new Date(a.due_date).getTime() < now);

  const byStatus = useMemo(() => [...new Set(meetings.map(m => m.status))].map(s => ({ name: s.replace(/_/g, ' '), value: meetings.filter(m => m.status === s).length })), [meetings]);
  const byMonth = useMemo(() => { const m = new Map<string, number>(); meetings.forEach(x => { if (!x.starts_at) return; const k = x.starts_at.slice(0, 7); m.set(k, (m.get(k) || 0) + 1); }); return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-6).map(([k, v]) => ({ month: k.slice(2), value: v })); }, [meetings]);

  const exportCols = ['Action', 'Meeting', 'Assignee', 'Due', 'Status'];
  const exportRows = actions.map(a => [a.description, a.meeting_id ? meetingTitle.get(a.meeting_id) || '' : '', a.assignee_id ? nameMap.get(a.assignee_id) || '' : '', a.due_date || '', a.status]);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Meeting Analytics & Action Items"
        subtitle="Meetings by status, minutes published, and action-item tracking"
        breadcrumbs={[{ label: 'Meetings', href: '/meetings' }, { label: 'Analytics' }]}
        actions={meetings.length > 0 ? (
          <div className="flex gap-2">
            <Button variant="secondary" icon={FileDown} onClick={() => exportTablePdf({ title: 'Meeting Action Items', columns: exportCols, rows: exportRows, fileName: 'meeting-actions' })}>PDF</Button>
            <Button variant="secondary" icon={Sheet} onClick={() => exportTableExcel({ title: 'Meeting Action Items', columns: exportCols, rows: exportRows, fileName: 'meeting-actions' })}>Excel</Button>
          </div>
        ) : undefined}
      />

      {loading ? (
        <Card><div className="p-8 text-center text-sm text-[var(--text-tertiary)]">Loading…</div></Card>
      ) : meetings.length === 0 ? (
        <Card><EmptyState icon={Calendar} title="No meetings" description="Meetings and their action items will be analysed here." /></Card>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Meetings</div><div className="text-2xl font-bold mt-1">{meetings.length}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Upcoming</div><div className="text-2xl font-bold mt-1">{upcoming}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Minutes published</div><div className="text-2xl font-bold mt-1">{published}<span className="text-sm font-normal text-[var(--text-tertiary)]">/{completed}</span></div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Open actions</div><div className="text-2xl font-bold mt-1" style={{ color: openActions.length ? 'var(--status-warning-text)' : 'var(--text-primary)' }}>{openActions.length}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Overdue actions</div><div className="text-2xl font-bold mt-1" style={{ color: overdueActions.length ? 'var(--status-danger-text)' : 'var(--text-primary)' }}>{overdueActions.length}</div></Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <Card className="p-4">
              <div className="text-sm font-semibold text-[var(--text-primary)] mb-3">Meetings by status</div>
              <div style={{ width: '100%', height: 240 }}>
                <ResponsiveContainer>
                  <BarChart data={byStatus}>
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
              <div className="text-sm font-semibold text-[var(--text-primary)] mb-3">Meetings per month</div>
              <div style={{ width: '100%', height: 240 }}>
                <ResponsiveContainer>
                  {byMonth.length ? (
                    <BarChart data={byMonth}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} />
                      <YAxis tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="value" fill="var(--status-info-text)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  ) : <div className="flex items-center justify-center h-full text-sm text-[var(--text-tertiary)]">No dated meetings</div>}
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          <Card className="p-0 overflow-x-auto">
            <div className="p-3 text-sm font-semibold text-[var(--text-primary)] border-b border-[var(--border)]">Open action items ({openActions.length})</div>
            {openActions.length === 0 ? <div className="p-5 text-center text-sm text-[var(--text-tertiary)]">No open action items.</div> : (
              <table className="w-full text-sm">
                <thead><tr className="border-b border-[var(--border)] text-left text-[var(--text-tertiary)] text-xs"><th className="p-3">Action</th><th className="p-3">Meeting</th><th className="p-3">Assignee</th><th className="p-3">Due</th></tr></thead>
                <tbody>
                  {openActions.map(a => { const od = a.due_date && new Date(a.due_date).getTime() < now; return (
                    <tr key={a.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-hover)] cursor-pointer" onClick={() => a.meeting_id && router.push(`/meetings`)}>
                      <td className="p-3 text-[var(--text-primary)]">{a.description}</td>
                      <td className="p-3 text-xs text-[var(--text-secondary)] line-clamp-1">{a.meeting_id ? meetingTitle.get(a.meeting_id) || '—' : '—'}</td>
                      <td className="p-3 text-xs text-[var(--text-secondary)]">{a.assignee_id ? nameMap.get(a.assignee_id) || '—' : '—'}</td>
                      <td className="p-3 text-xs" style={{ color: od ? 'var(--status-danger-text)' : 'var(--text-secondary)' }}>{a.due_date || '—'}{od ? ' ⚠' : ''}</td>
                    </tr>
                  ); })}
                </tbody>
              </table>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
