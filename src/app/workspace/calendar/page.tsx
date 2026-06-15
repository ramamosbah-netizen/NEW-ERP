'use client';

// ============================================================
// JEET ERP — Workspace: Unified Calendar
// Tasks (due), meetings, leave and PPM visits in one month view.
// Read-only; batched plain queries (no migration).
// ============================================================

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ChevronLeft, ChevronRight } from 'lucide-react';

type EvType = 'TASK' | 'MEETING' | 'LEAVE' | 'PPM';
interface Ev { date: string; type: EvType; label: string; href: string; }
const TYPE_META: Record<EvType, { color: string; label: string }> = {
  TASK: { color: 'var(--accent)', label: 'Task due' },
  MEETING: { color: 'var(--status-info-text)', label: 'Meeting' },
  LEAVE: { color: 'var(--status-warning-text)', label: 'Leave' },
  PPM: { color: 'var(--status-success-text)', label: 'PPM visit' },
};
const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const iso = (d: Date) => d.toISOString().slice(0, 10);

export default function UnifiedCalendarPage() {
  const router = useRouter();
  const [cursor, setCursor] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [events, setEvents] = useState<Ev[]>([]);
  const [loading, setLoading] = useState(true);

  const monthStart = useMemo(() => new Date(cursor.getFullYear(), cursor.getMonth(), 1), [cursor]);
  const monthEnd = useMemo(() => new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0), [cursor]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const s = iso(monthStart), e = iso(monthEnd), eEnd = e + 'T23:59:59';
      const [tk, mt, lv, pv] = await Promise.all([
        supabase.from('tasks').select('id, title, due_date, status').gte('due_date', s).lte('due_date', eEnd).eq('is_active', true),
        supabase.from('meetings').select('id, title, starts_at').gte('starts_at', s).lte('starts_at', eEnd),
        supabase.from('leave_requests').select('id, employee_id, leave_type, from_date, to_date').lte('from_date', e).gte('to_date', s),
        supabase.from('ppm_visits').select('id, visit_number, scheduled_date, target_month').or(`scheduled_date.gte.${s},target_month.gte.${s}`),
      ]);
      const evs: Ev[] = [];
      (tk.data || []).forEach((t: any) => { if (t.status === 'DONE' || t.status === 'DONE_AUTO' || t.status === 'CANCELLED') return; evs.push({ date: t.due_date.slice(0, 10), type: 'TASK', label: t.title, href: `/tasks` }); });
      (mt.data || []).forEach((m: any) => evs.push({ date: m.starts_at.slice(0, 10), type: 'MEETING', label: m.title, href: `/meetings` }));
      // leave names
      const leaveRows = (lv.data || []);
      const eids = [...new Set(leaveRows.map((l: any) => l.employee_id).filter(Boolean))] as string[];
      const nameMap = new Map<string, string>();
      if (eids.length) { const { data: em } = await supabase.from('employees').select('id, full_name_en').in('id', eids); (em || []).forEach((x: any) => nameMap.set(x.id, x.full_name_en)); }
      leaveRows.forEach((l: any) => {
        const from = new Date(l.from_date), to = new Date(l.to_date);
        for (let d = new Date(Math.max(from.getTime(), monthStart.getTime())); d <= to && d <= monthEnd; d.setDate(d.getDate() + 1)) {
          evs.push({ date: iso(new Date(d)), type: 'LEAVE', label: `${nameMap.get(l.employee_id) || 'Leave'} (${l.leave_type})`, href: '/hr/leave-analytics' });
        }
      });
      (pv.data || []).forEach((p: any) => { const dt = (p.scheduled_date || p.target_month || '').slice(0, 10); if (dt >= s && dt <= e) evs.push({ date: dt, type: 'PPM', label: p.visit_number || 'PPM', href: `/ppm/execute/${p.id}` }); });
      setEvents(evs);
    } finally { setLoading(false); }
  }, [monthStart, monthEnd]);
  useEffect(() => { load(); }, [load]);

  const byDate = useMemo(() => { const m = new Map<string, Ev[]>(); events.forEach(e => { if (!m.has(e.date)) m.set(e.date, []); m.get(e.date)!.push(e); }); return m; }, [events]);

  // build 6-week grid
  const cells = useMemo(() => {
    const firstWeekday = monthStart.getDay();
    const start = new Date(monthStart); start.setDate(start.getDate() - firstWeekday);
    return Array.from({ length: 42 }, (_, i) => { const d = new Date(start); d.setDate(d.getDate() + i); return d; });
  }, [monthStart]);
  const todayStr = iso(new Date());

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Unified Calendar"
        subtitle="Tasks, meetings, leave and PPM visits in one view"
        breadcrumbs={[{ label: 'Workspace', href: '/workspace' }, { label: 'Calendar' }]}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="secondary" icon={ChevronLeft} onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}>Prev</Button>
            <span className="text-sm font-semibold text-[var(--text-primary)] w-32 text-center">{cursor.toLocaleDateString('en-AE', { month: 'long', year: 'numeric' })}</span>
            <Button variant="secondary" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}>Next <ChevronRight size={15} /></Button>
          </div>
        }
      />

      <div className="flex flex-wrap gap-3">
        {(Object.keys(TYPE_META) as EvType[]).map(t => <span key={t} className="inline-flex items-center gap-1 text-xs text-[var(--text-secondary)]"><span className="w-2.5 h-2.5 rounded-full" style={{ background: TYPE_META[t].color }} />{TYPE_META[t].label}</span>)}
        {loading && <span className="text-xs text-[var(--text-tertiary)]">Loading…</span>}
      </div>

      <Card className="p-2 overflow-x-auto">
        <div className="min-w-[760px]">
          <div className="grid grid-cols-7">
            {WD.map(w => <div key={w} className="p-2 text-center text-xs font-medium text-[var(--text-tertiary)]">{w}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-px bg-[var(--border)] rounded overflow-hidden">
            {cells.map((d, i) => {
              const ds = iso(d); const inMonth = d.getMonth() === cursor.getMonth(); const evs = byDate.get(ds) || [];
              return (
                <div key={i} className="bg-[var(--surface)] min-h-[92px] p-1.5" style={{ opacity: inMonth ? 1 : 0.4 }}>
                  <div className="text-[11px] font-medium mb-1" style={{ color: ds === todayStr ? 'var(--accent)' : 'var(--text-secondary)' }}>{d.getDate()}{ds === todayStr ? ' •' : ''}</div>
                  <div className="flex flex-col gap-0.5">
                    {evs.slice(0, 3).map((e, j) => (
                      <button key={j} onClick={() => router.push(e.href)} className="text-left text-[10px] truncate px-1 py-0.5 rounded" style={{ background: 'var(--surface-active)', borderLeft: `2px solid ${TYPE_META[e.type].color}` }} title={e.label}>{e.label}</button>
                    ))}
                    {evs.length > 3 && <span className="text-[9px] text-[var(--text-tertiary)] px-1">+{evs.length - 3} more</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Card>
    </div>
  );
}
