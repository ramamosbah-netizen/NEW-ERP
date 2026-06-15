'use client';

// ============================================================
// JEET ERP — Pre-Sales Hub
// Single entry point to the pre-sales suite with a live
// "needs attention" strip. Read-only; reuses existing tables.
// ============================================================

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import {
  LayoutDashboard, Briefcase, FileText, Scale, Calculator, Building2,
  CalendarClock, Bell, Trophy, Tag,
} from 'lucide-react';

const DAY = 86400000;

const MODULES = [
  { href: '/sales/dashboard', icon: LayoutDashboard, title: 'Pre-Sales Dashboard', desc: 'Funnel, pipeline value, win rate & conversion' },
  { href: '/sales/pipeline', icon: Briefcase, title: 'Sales Pipeline', desc: 'Tender opportunities by stage and value' },
  { href: '/sales/quotations', icon: FileText, title: 'Quotation Analytics', desc: 'Status, value, conversion, aging' },
  { href: '/sales/win-loss', icon: Scale, title: 'Win / Loss Analysis', desc: 'Won vs lost, reasons, by client' },
  { href: '/sales/margin', icon: Calculator, title: 'Margin Analysis', desc: 'BOQ cost vs profit and margin %' },
  { href: '/sales/clients', icon: Building2, title: 'Client Directory & 360', desc: 'CRM accounts and per-client history' },
  { href: '/sales/deadlines', icon: CalendarClock, title: 'Tender Deadlines', desc: 'Upcoming & overdue submissions' },
  { href: '/sales/follow-ups', icon: Bell, title: 'Quote Follow-ups', desc: 'Awaiting response & expiring quotes' },
  { href: '/sales/performance', icon: Trophy, title: 'Sales Performance', desc: 'By owner — win rate and value' },
  { href: '/pricing', icon: Tag, title: 'Pricing Catalogue', desc: 'Master rates feeding BOQ & quotes' },
];

export default function PreSalesHub() {
  const [counts, setCounts] = useState<{ overdue: number; deadlinesSoon: number; expiringQuotes: number; awaiting: number } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const now = Date.now();
        const [tn, qt] = await Promise.all([
          supabase.from('tenders').select('deadline_date, status'),
          supabase.from('quotations').select('status, valid_until, sent_to_client_at, client_response, linked_project_id, actual_project_id, rejection_reason'),
        ]);
        const tenders = (tn.data || []).filter((t: any) => t.status !== 'Completed' && t.deadline_date);
        const overdue = tenders.filter((t: any) => new Date(t.deadline_date).getTime() < now).length;
        const deadlinesSoon = tenders.filter((t: any) => { const d = new Date(t.deadline_date).getTime(); return d >= now && d - now <= 7 * DAY; }).length;
        const isWon = (q: any) => q.status === 'ACCEPTED' || q.client_response === 'ACCEPTED' || q.linked_project_id || q.actual_project_id;
        const isLost = (q: any) => q.status === 'REJECTED' || (q.rejection_reason && !isWon(q));
        const pending = (qt.data || []).filter((q: any) => !isWon(q) && !isLost(q) && q.status !== 'SUPERSEDED');
        const expiringQuotes = pending.filter((q: any) => { if (!q.valid_until) return false; const d = new Date(q.valid_until).getTime(); return d >= now && d - now <= 14 * DAY; }).length;
        const awaiting = pending.filter((q: any) => q.sent_to_client_at).length;
        setCounts({ overdue, deadlinesSoon, expiringQuotes, awaiting });
      } catch { /* best effort */ }
    })();
  }, []);

  const attention = counts ? [
    { label: 'Overdue deadlines', value: counts.overdue, href: '/sales/deadlines', warn: counts.overdue > 0 },
    { label: 'Deadlines ≤7 days', value: counts.deadlinesSoon, href: '/sales/deadlines', warn: counts.deadlinesSoon > 0 },
    { label: 'Quotes expiring ≤14d', value: counts.expiringQuotes, href: '/sales/follow-ups', warn: counts.expiringQuotes > 0 },
    { label: 'Awaiting response', value: counts.awaiting, href: '/sales/follow-ups', warn: false },
  ] : [];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Pre-Sales" subtitle="Tenders, BOQ estimation, quotations, CRM and pipeline analytics in one place" />

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
