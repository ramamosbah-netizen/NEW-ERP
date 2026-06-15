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
import { ChevronLeft, ChevronRight, Users, CheckSquare, LogOut, Wrench } from 'lucide-react';

type EvType = 'TASK' | 'MEETING' | 'LEAVE' | 'PPM';
interface Ev { date: string; type: EvType; label: string; href: string; }
const TYPE_META: Record<EvType, { color: string; colorName: string; borderL: string; label: string }> = {
  TASK: { color: 'var(--success)', colorName: 'success', borderL: 'border-l-[var(--success)]', label: 'Task due' },
  MEETING: { color: 'var(--accent)', colorName: 'accent', borderL: 'border-l-[var(--accent)]', label: 'Meeting' },
  LEAVE: { color: 'var(--warning)', colorName: 'warning', borderL: 'border-l-[var(--warning)]', label: 'Leave' },
  PPM: { color: 'var(--success)', colorName: 'success', borderL: 'border-l-[var(--success)]', label: 'PPM visit' },
};
const TYPE_ICONS: Record<EvType, React.ComponentType<any>> = {
  TASK: CheckSquare,
  MEETING: Users,
  LEAVE: LogOut,
  PPM: Wrench,
};
const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const iso = (d: Date) => d.toISOString().slice(0, 10);

export default function UnifiedCalendarPage() {
  const router = useRouter();
  const [cursor, setCursor] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [events, setEvents] = useState<Ev[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [scope, setScope] = useState<'mine' | 'all'>('mine');

  useEffect(() => { supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id || null)); }, []);

  const monthStart = useMemo(() => new Date(cursor.getFullYear(), cursor.getMonth(), 1), [cursor]);
  const monthEnd = useMemo(() => new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0), [cursor]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const s = iso(monthStart), e = iso(monthEnd), eEnd = e + 'T23:59:59';
      const mine = scope === 'mine' && userId;
      const [tk, mt, lv, pv] = await Promise.all([
        supabase.from('tasks').select('id, title, due_date, status, assignee_id').gte('due_date', s).lte('due_date', eEnd).eq('is_active', true),
        supabase.from('meetings').select('id, title, starts_at, organizer_id').gte('starts_at', s).lte('starts_at', eEnd),
        supabase.from('leave_requests').select('id, employee_id, leave_type, from_date, to_date').lte('from_date', e).gte('to_date', s),
        supabase.from('ppm_visits').select('id, visit_number, scheduled_date, target_month').or(`scheduled_date.gte.${s},target_month.gte.${s}`),
      ]);
      const evs: Ev[] = [];
      (tk.data || []).forEach((t: any) => { if (t.status === 'DONE' || t.status === 'DONE_AUTO' || t.status === 'CANCELLED') return; if (mine && t.assignee_id !== userId) return; evs.push({ date: t.due_date.slice(0, 10), type: 'TASK', label: t.title, href: `/tasks` }); });
      (mt.data || []).forEach((m: any) => { if (mine && m.organizer_id !== userId) return; evs.push({ date: m.starts_at.slice(0, 10), type: 'MEETING', label: m.title, href: `/meetings` }); });
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
  }, [monthStart, monthEnd, scope, userId]);
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
            <button
              onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
              className="quote-btn quote-btn-secondary text-xs flex items-center gap-1.5 cursor-pointer"
            >
              <ChevronLeft size={14} />
              Prev
            </button>
            <span className="text-sm font-semibold text-[var(--text-primary)] w-32 text-center">
              {cursor.toLocaleDateString('en-AE', { month: 'long', year: 'numeric' })}
            </span>
            <button
              onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
              className="quote-btn quote-btn-secondary text-xs flex items-center gap-1.5 cursor-pointer"
            >
              Next
              <ChevronRight size={14} />
            </button>
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        {(Object.keys(TYPE_META) as EvType[]).map(t => <span key={t} className="inline-flex items-center gap-1 text-xs text-[var(--text-secondary)]"><span className="w-2.5 h-2.5 rounded-full" style={{ background: TYPE_META[t].color }} />{TYPE_META[t].label}</span>)}
        {loading && <span className="text-xs text-[var(--text-muted)]">Loading…</span>}
        <div className="flex bg-[var(--bg-card-hover)] border border-[var(--border-color)] p-0.5 rounded-lg ml-auto">
          {(['mine', 'all'] as const).map(s => (
            <button
              key={s}
              onClick={() => setScope(s)}
              className={`px-3 py-1 rounded text-xs font-semibold transition-all cursor-pointer ${
                scope === s
                  ? 'bg-[var(--primary)] text-[var(--bg-card)] font-bold'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {s === 'mine' ? 'My Tasks & Meetings' : 'Everyone'}
            </button>
          ))}
        </div>
      </div>

      <Card className="p-4 overflow-x-auto">
        <div className="min-w-[760px]">
          <div className="grid grid-cols-7 text-center font-mono text-[10px] font-extrabold uppercase tracking-widest pb-2.5 border-b border-[var(--border-color)]">
            {WD.map(w => (
              <div key={w} className={w === 'Fri' || w === 'Sat' ? 'text-[var(--text-secondary)] opacity-85' : 'text-[var(--text-primary)]'}>
                {w}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1.5 mt-2.5">
            {cells.map((d, i) => {
              const ds = iso(d);
              const inMonth = d.getMonth() === cursor.getMonth();
              const evs = byDate.get(ds) || [];
              const isToday = ds === todayStr;

              if (!inMonth) {
                return (
                  <div
                    key={i}
                    className="min-h-[105px] p-2 rounded-lg bg-[var(--bg-card-hover)]/40 border border-transparent opacity-45 flex flex-col justify-between"
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-[11px] font-mono font-bold text-[var(--text-muted)]">
                        {String(d.getDate()).padStart(2, '0')}
                      </span>
                    </div>
                    <div className="flex-1 mt-1 overflow-y-auto space-y-1 custom-scrollbar max-h-[72px]">
                      {evs.map((e, j) => (
                        <button
                          key={j}
                          onClick={() => router.push(e.href)}
                          className="w-full text-left text-[10px] truncate p-1 rounded bg-[var(--bg-card)] border border-[var(--border-color)] border-l-2 border-l-[var(--text-muted)]/50 text-[var(--text-secondary)] opacity-60 font-medium cursor-pointer"
                          title={e.label}
                        >
                          {e.label}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={i}
                  className={`min-h-[105px] p-2 rounded-lg border flex flex-col justify-between transition-all bg-[var(--bg-card-hover)] ${
                    isToday
                      ? 'border-[var(--accent)] bg-[var(--accent-glow)]'
                      : 'border-[var(--border-color)] hover:border-[var(--text-secondary)]'
                  }`}
                >
                  {/* Day Number */}
                  <div className="flex justify-between items-center">
                    {isToday ? (
                      <span className="flex items-center justify-center h-5 w-5 rounded-full bg-[var(--accent)] text-[var(--bg-card)] text-[10px] font-mono font-bold">
                        {d.getDate()}
                      </span>
                    ) : (
                      <span className="text-[11px] font-mono font-bold text-[var(--text-primary)]">
                        {String(d.getDate()).padStart(2, '0')}
                      </span>
                    )}
                    {evs.length > 0 && (
                      <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
                    )}
                  </div>

                  {/* Items Display */}
                  <div className="mt-1 flex-1 overflow-y-auto space-y-1 custom-scrollbar pr-0.5 max-h-[72px]">
                    {evs.map((e, j) => {
                      const Icon = TYPE_ICONS[e.type];
                      return (
                        <button
                          key={j}
                          onClick={() => router.push(e.href)}
                          className={`w-full text-left text-[10px] truncate p-1 rounded bg-[var(--bg-card)] border border-[var(--border-color)] border-l-2 ${TYPE_META[e.type].borderL} text-[var(--text-primary)] font-bold cursor-pointer flex items-center gap-1 font-sans hover:border-[var(--accent)] transition-all`}
                          title={`${TYPE_META[e.type].label}: ${e.label}`}
                        >
                          {Icon && <Icon size={8} className="flex-shrink-0" style={{ color: TYPE_META[e.type].color }} />}
                          <span className="truncate">{e.label}</span>
                        </button>
                      );
                    })}
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
