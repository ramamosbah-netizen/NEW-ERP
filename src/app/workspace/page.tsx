'use client';

// ============================================================
// Aura ERP — My Workspace
// A personal, Notion-style command center (one per user): a daily greeting,
// today's signals, the things that need you, your agenda, a rule-based daily
// briefing, and quick entry points (Ask AI / Search, Quick Create).
// Reuses useMyDay (tasks / approvals / meetings / expiring docs) — no new tables.
// ============================================================

import React, { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Card } from '@/components/ui/Card';
import { useMyDay } from '@/hooks/useMyDay';
import {
  Sparkles, Plus, CheckSquare, Calendar as CalendarIcon, Clock,
  AlertTriangle, FileWarning, CheckCircle2, Bell, ArrowRight, ChevronDown,
  CalendarClock, Activity,
} from 'lucide-react';

type Row = { title?: string; message?: string; module?: string; due_date?: string; priority?: string; starts_at?: string };

const QUICK_CREATE = [
  { label: 'Task', href: '/tasks' },
  { label: 'Meeting', href: '/meetings' },
  { label: 'Project', href: '/projects/new' },
  { label: 'Purchase Request', href: '/procurement/pr/create' },
  { label: 'Quotation', href: '/quotations' },
  { label: 'Client Invoice', href: '/finance/ar/create' },
];

const fmtTime = (iso?: string) => {
  if (!iso) return '';
  try { return new Date(iso).toLocaleTimeString('en-AE', { hour: '2-digit', minute: '2-digit' }); }
  catch { return ''; }
};
const fmtDay = (iso?: string) => {
  if (!iso) return '';
  try { return new Date(iso).toLocaleDateString('en-AE', { day: '2-digit', month: 'short' }); }
  catch { return ''; }
};

export default function MyWorkspacePage() {
  const router = useRouter();
  const { needsAction, urgentOverdueTasks, tasksToday, meetingsToday, tasksThisWeek, expiringDocs, recentlyCompleted, loading } = useMyDay();

  const [now] = useState(() => new Date());
  const [firstName, setFirstName] = useState('there');
  const [createOpen, setCreateOpen] = useState(false);
  const createRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle()
        .then(({ data }) => { if (data?.full_name) setFirstName(String(data.full_name).split(' ')[0]); });
    });
  }, []);

  useEffect(() => {
    const onClick = (e: MouseEvent) => { if (createRef.current && !createRef.current.contains(e.target as Node)) setCreateOpen(false); };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const hour = now.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const dateStr = now.toLocaleDateString('en-AE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  const signals = [
    { label: 'Due today', value: tasksToday.length, href: '/tasks', icon: CheckSquare, tone: tasksToday.length ? 'var(--accent)' : 'var(--text-primary)' },
    { label: 'Overdue / urgent', value: urgentOverdueTasks.length, href: '/tasks', icon: AlertTriangle, tone: urgentOverdueTasks.length ? 'var(--status-danger-text)' : 'var(--status-success-text)' },
    { label: 'Needs action', value: needsAction.length, href: '/workspace/approvals', icon: CheckCircle2, tone: needsAction.length ? 'var(--status-warning-text)' : 'var(--text-primary)' },
    { label: 'Meetings today', value: meetingsToday.length, href: '/meetings', icon: CalendarIcon, tone: 'var(--text-primary)' },
    { label: 'Due this week', value: tasksThisWeek.length, href: '/tasks', icon: Clock, tone: 'var(--text-primary)' },
    { label: 'Docs expiring', value: expiringDocs.length, href: '/documents', icon: FileWarning, tone: expiringDocs.length ? 'var(--status-warning-text)' : 'var(--text-primary)' },
  ];

  // Rule-based daily briefing (the deterministic v1 of AI suggestions).
  const briefing = useMemo(() => {
    const b: { tone: 'danger' | 'warning' | 'info' | 'success'; text: string; href: string }[] = [];
    if (urgentOverdueTasks.length) b.push({ tone: 'danger', text: `${urgentOverdueTasks.length} task${urgentOverdueTasks.length === 1 ? '' : 's'} overdue or urgent — clear these first.`, href: '/tasks' });
    if (needsAction.length) b.push({ tone: 'warning', text: `${needsAction.length} item${needsAction.length === 1 ? '' : 's'} waiting on your action.`, href: '/workspace/approvals' });
    if (meetingsToday.length) b.push({ tone: 'info', text: `${meetingsToday.length} meeting${meetingsToday.length === 1 ? '' : 's'} on your calendar today.`, href: '/meetings' });
    if (expiringDocs.length) b.push({ tone: 'warning', text: `${expiringDocs.length} document${expiringDocs.length === 1 ? '' : 's'} on your projects expire within 30 days.`, href: '/documents' });
    if (tasksThisWeek.length) b.push({ tone: 'info', text: `${tasksThisWeek.length} task${tasksThisWeek.length === 1 ? '' : 's'} due later this week — plan ahead.`, href: '/tasks' });
    if (recentlyCompleted.length) b.push({ tone: 'success', text: `You closed ${recentlyCompleted.length} task${recentlyCompleted.length === 1 ? '' : 's'} in the last 48h. Nice momentum.`, href: '/tasks' });
    if (b.length === 0) b.push({ tone: 'success', text: 'You are all caught up — nothing needs you right now.', href: '/tasks' });
    return b;
  }, [urgentOverdueTasks, needsAction, meetingsToday, expiringDocs, tasksThisWeek, recentlyCompleted]);

  const askAi = () => window.dispatchEvent(new Event('open-command-palette'));

  return (
    <div className="flex flex-col gap-5">
      {/* Greeting + actions */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[var(--text-primary)]">{greeting}, {firstName}</h1>
          <p className="text-sm text-[var(--text-tertiary)] mt-0.5">{dateStr}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={askAi}
            className="inline-flex items-center gap-2 h-9 px-3 rounded-lg border text-sm font-medium transition-colors"
            style={{ background: 'var(--surface-active)', borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}
          >
            <Sparkles size={15} className="text-[var(--accent)]" /> Ask AI / Search
            <kbd className="ml-1 text-[10px] font-mono px-1 py-0.5 rounded border border-[var(--border-color)] text-[var(--text-tertiary)]">⌘K</kbd>
          </button>
          <div className="relative" ref={createRef}>
            <button
              onClick={() => setCreateOpen(o => !o)}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-sm font-semibold text-white transition-colors"
              style={{ background: 'var(--accent)' }}
            >
              <Plus size={15} /> Create <ChevronDown size={13} />
            </button>
            {createOpen && (
              <div className="absolute right-0 mt-2 w-52 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl shadow-2xl p-1.5 z-50">
                <div className="px-2 py-1 text-[10px] font-mono uppercase tracking-wider text-[var(--text-tertiary)]">Quick create</div>
                {QUICK_CREATE.map(q => (
                  <button key={q.href} onClick={() => { setCreateOpen(false); router.push(q.href); }}
                    className="flex items-center justify-between w-full px-2.5 py-2 rounded-lg text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)] transition-colors">
                    {q.label} <ArrowRight size={13} className="opacity-50" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Today signals */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {signals.map(s => {
          const Icon = s.icon;
          return (
            <Link key={s.label} href={s.href}>
              <Card className="p-4 h-full hover:border-[var(--accent)] transition-colors">
                <div className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]"><Icon size={13} /> {s.label}</div>
                <div className="text-2xl font-bold mt-1" style={{ color: s.tone }}>{loading ? '—' : s.value}</div>
              </Card>
            </Link>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: needs you + agenda */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          <Card className="p-0 overflow-hidden">
            <div className="p-3 border-b border-[var(--border-color)] text-sm font-semibold text-[var(--text-primary)] flex items-center justify-between">
              <span className="inline-flex items-center gap-2"><CheckCircle2 size={15} className="text-[var(--status-warning-text)]" /> Needs you</span>
              <Link href="/workspace/approvals" className="text-xs text-[var(--accent)]">View all</Link>
            </div>
            <div className="divide-y divide-[var(--border-color)] max-h-[280px] overflow-y-auto">
              {loading ? (
                <div className="p-4 text-xs text-[var(--text-tertiary)]">Loading…</div>
              ) : (needsAction.length === 0 && urgentOverdueTasks.length === 0) ? (
                <div className="p-6 text-xs text-[var(--text-tertiary)] flex items-center gap-2"><CheckCircle2 size={14} className="text-[var(--status-success-text)]" /> Nothing needs your action.</div>
              ) : (
                <>
                  {needsAction.slice(0, 6).map((n: Row, i: number) => (
                    <Link key={`n${i}`} href="/workspace/approvals" className="flex items-start gap-2.5 px-3 py-2.5 hover:bg-[var(--bg-card-hover)] transition-colors">
                      <Bell size={14} className="text-[var(--status-warning-text)] mt-0.5 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-medium text-[var(--text-primary)] truncate">{n.title || n.message || 'Action required'}</div>
                        <div className="text-[11px] text-[var(--text-tertiary)] truncate">{n.message || n.module || 'Pending action'}</div>
                      </div>
                    </Link>
                  ))}
                  {urgentOverdueTasks.slice(0, 6).map((t: Row, i: number) => (
                    <Link key={`t${i}`} href="/tasks" className="flex items-start gap-2.5 px-3 py-2.5 hover:bg-[var(--bg-card-hover)] transition-colors">
                      <AlertTriangle size={14} className="text-[var(--status-danger-text)] mt-0.5 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-medium text-[var(--text-primary)] truncate">{t.title || 'Task'}</div>
                        <div className="text-[11px] text-[var(--text-tertiary)]">{t.due_date ? `Due ${fmtDay(t.due_date)}` : 'Urgent'}{t.priority ? ` · ${t.priority}` : ''}</div>
                      </div>
                    </Link>
                  ))}
                </>
              )}
            </div>
          </Card>

          <Card className="p-0 overflow-hidden">
            <div className="p-3 border-b border-[var(--border-color)] text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
              <CalendarClock size={15} className="text-[var(--accent)]" /> Today’s agenda
            </div>
            <div className="divide-y divide-[var(--border-color)] max-h-[280px] overflow-y-auto">
              {loading ? (
                <div className="p-4 text-xs text-[var(--text-tertiary)]">Loading…</div>
              ) : (meetingsToday.length === 0 && tasksToday.length === 0) ? (
                <div className="p-6 text-xs text-[var(--text-tertiary)]">No meetings or tasks due today.</div>
              ) : (
                <>
                  {meetingsToday.map((m: Row, i: number) => (
                    <Link key={`m${i}`} href="/meetings" className="flex items-center gap-2.5 px-3 py-2.5 hover:bg-[var(--bg-card-hover)] transition-colors">
                      <span className="text-xs font-mono text-[var(--accent)] w-14 shrink-0">{fmtTime(m.starts_at)}</span>
                      <CalendarIcon size={14} className="text-[var(--text-tertiary)] shrink-0" />
                      <div className="text-xs font-medium text-[var(--text-primary)] truncate">{m.title || 'Meeting'}</div>
                    </Link>
                  ))}
                  {tasksToday.map((t: Row, i: number) => (
                    <Link key={`tt${i}`} href="/tasks" className="flex items-center gap-2.5 px-3 py-2.5 hover:bg-[var(--bg-card-hover)] transition-colors">
                      <span className="text-xs font-mono text-[var(--text-tertiary)] w-14 shrink-0">Task</span>
                      <CheckSquare size={14} className="text-[var(--text-tertiary)] shrink-0" />
                      <div className="text-xs font-medium text-[var(--text-primary)] truncate">{t.title || 'Task'}</div>
                    </Link>
                  ))}
                </>
              )}
            </div>
          </Card>
        </div>

        {/* Right: daily briefing + completed */}
        <div className="flex flex-col gap-4">
          <Card className="p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)] mb-3">
              <Sparkles size={15} className="text-[var(--accent)]" /> Today’s briefing
            </div>
            <div className="flex flex-col gap-2.5">
              {briefing.map((b, i) => (
                <Link key={i} href={b.href} className="flex items-start gap-2 group">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0" style={{ background: `var(--status-${b.tone}-text)` }} />
                  <span className="text-xs text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors leading-relaxed">{b.text}</span>
                </Link>
              ))}
            </div>
            <div className="mt-3 pt-3 border-t border-[var(--border-color)]">
              <button onClick={askAi} className="text-xs text-[var(--accent)] inline-flex items-center gap-1">
                <Sparkles size={12} /> Ask AI about your day
              </button>
            </div>
          </Card>

          <Card className="p-0 overflow-hidden">
            <div className="p-3 border-b border-[var(--border-color)] text-sm font-semibold text-[var(--text-primary)] flex items-center justify-between">
              <span className="inline-flex items-center gap-2"><Activity size={15} /> Recently completed</span>
              <Link href="/workspace/activity" className="text-xs text-[var(--accent)]">Activity</Link>
            </div>
            <div className="divide-y divide-[var(--border-color)] max-h-[200px] overflow-y-auto">
              {recentlyCompleted.length === 0 ? (
                <div className="p-4 text-xs text-[var(--text-tertiary)]">{loading ? 'Loading…' : 'Nothing completed in the last 48h.'}</div>
              ) : recentlyCompleted.slice(0, 6).map((t: Row, i: number) => (
                <div key={i} className="flex items-center gap-2.5 px-3 py-2">
                  <CheckCircle2 size={13} className="text-[var(--status-success-text)] shrink-0" />
                  <div className="text-xs text-[var(--text-secondary)] truncate line-through">{t.title || 'Task'}</div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
