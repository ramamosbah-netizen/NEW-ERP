'use client';

// ============================================================
// JEET ERP — My Workspace Hub
// Personal entry point with a live "needs attention" strip
// (my tasks, unread alerts, today's meetings) + module grid.
// ============================================================

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import {
  LayoutDashboard, Sun, CheckSquare, Users, Calendar, Bell,
  CalendarClock, Activity,
} from 'lucide-react';

const DAY = 86400000;
const OPEN = ['TODO', 'IN_PROGRESS', 'BLOCKED'];

const MODULES = [
  { href: '/dashboard', icon: LayoutDashboard, title: 'Dashboard', desc: 'Executive KPIs' },
  { href: '/myday', icon: Sun, title: 'My Day', desc: 'Your day at a glance' },
  { href: '/tasks', icon: CheckSquare, title: 'Tasks', desc: 'Task board' },
  { href: '/tasks/analytics', icon: CheckSquare, title: 'Task Analytics', desc: 'Status, throughput, overdue' },
  { href: '/tasks/team', icon: Users, title: 'Team Workload', desc: 'Load per assignee' },
  { href: '/meetings', icon: Calendar, title: 'Meetings', desc: 'Agenda & minutes' },
  { href: '/meetings/analytics', icon: Calendar, title: 'Meeting Analytics', desc: 'Action items & overdue' },
  { href: '/notifications', icon: Bell, title: 'Alerts & Logs', desc: 'Notification inbox' },
  { href: '/notifications/analytics', icon: Bell, title: 'Alerts Analytics', desc: 'Severity & read rates' },
  { href: '/workspace/calendar', icon: CalendarClock, title: 'Unified Calendar', desc: 'Tasks + meetings + leave + PPM' },
  { href: '/workspace/activity', icon: Activity, title: 'Activity Timeline', desc: 'Recent system activity' },
];

export default function WorkspaceHub() {
  const [counts, setCounts] = useState<{ myOpen: number; myOverdue: number; unread: number; todayMeetings: number } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        const uid = user?.id;
        const now = Date.now(); const todayStr = new Date().toISOString().slice(0, 10);
        const [tk, nt, mt] = await Promise.all([
          uid ? supabase.from('tasks').select('status, due_date').eq('assignee_id', uid).eq('is_active', true) : Promise.resolve({ data: [] as any[] }),
          uid ? supabase.from('notifications').select('status').eq('user_id', uid).eq('status', 'PENDING') : Promise.resolve({ data: [] as any[] }),
          supabase.from('meetings').select('starts_at, status').gte('starts_at', todayStr).lte('starts_at', todayStr + 'T23:59:59'),
        ]);
        const myTasks = (tk.data || []).filter((t: any) => OPEN.includes(t.status));
        setCounts({
          myOpen: myTasks.length,
          myOverdue: myTasks.filter((t: any) => t.due_date && new Date(t.due_date).getTime() < now).length,
          unread: (nt.data || []).length,
          todayMeetings: (mt.data || []).length,
        });
      } catch { /* best effort */ }
    })();
  }, []);

  const attention = counts ? [
    { label: 'My open tasks', value: counts.myOpen, href: '/tasks', warn: false },
    { label: 'My overdue tasks', value: counts.myOverdue, href: '/tasks/analytics', warn: counts.myOverdue > 0 },
    { label: 'Unread alerts', value: counts.unread, href: '/notifications', warn: counts.unread > 0 },
    { label: "Today's meetings", value: counts.todayMeetings, href: '/meetings', warn: false },
  ] : [];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="My Workspace" subtitle="Your tasks, meetings, alerts, calendar and activity in one place" />

      {counts && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {attention.map((a, i) => (
            <Link key={i} href={a.href}>
              <Card className="p-4 hover:border-[var(--accent)] transition-colors">
                <div className="text-xs text-[var(--text-secondary)]">{a.label}</div>
                <div className="text-2xl font-bold mt-1" style={{ color: a.warn ? 'var(--status-danger-text)' : 'var(--text-primary)' }}>{a.value}</div>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {MODULES.map(m => {
          const Icon = m.icon;
          return (
            <Link key={m.href} href={m.href}>
              <Card className="p-4 h-full hover:border-[var(--accent)] transition-colors flex items-start gap-3">
                <div className="p-2 rounded-lg shrink-0" style={{ background: 'var(--surface-active)' }}><Icon size={20} className="text-[var(--accent)]" /></div>
                <div>
                  <div className="font-semibold text-[var(--text-primary)]">{m.title}</div>
                  <div className="text-[12px] text-[var(--text-tertiary)] mt-0.5">{m.desc}</div>
                </div>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
