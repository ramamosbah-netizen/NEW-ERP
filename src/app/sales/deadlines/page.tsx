'use client';

// ============================================================
// JEET ERP — Pre-Sales: Tender Deadline Tracker
// Upcoming & overdue tender submission deadlines. Read-only.
// ============================================================

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { exportTablePdf, exportTableExcel } from '@/lib/finance-export';
import { CalendarClock, FileDown, Sheet } from 'lucide-react';

const DAY = 86400000;
const aed = (n: number) => `AED ${Number(n || 0).toLocaleString('en-AE', { maximumFractionDigits: 0 })}`;

interface Tn { id: string; title: string; project_name: string; client_name: string; deadline_date: string; budget: number; status: string; }

const GROUPS = [
  { key: 'overdue', label: 'Overdue', color: 'var(--status-danger-text)' },
  { key: 'week', label: 'Next 7 days', color: 'var(--status-warning-text)' },
  { key: 'month', label: '8–30 days', color: 'var(--status-info-text)' },
  { key: 'later', label: 'Later', color: 'var(--text-tertiary)' },
];

export default function DeadlineTrackerPage() {
  const router = useRouter();
  const [tenders, setTenders] = useState<Tn[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from('tenders').select('id, title, project_name, client_name, deadline_date, budget, status').order('deadline_date', { ascending: true })
      .then(({ data }) => setTenders(((data || []) as Tn[]).filter(t => t.deadline_date && t.status !== 'Completed')))
      .then(() => setLoading(false), () => setLoading(false));
  }, []);

  const now = Date.now();
  const daysLeft = (d: string) => Math.ceil((new Date(d).getTime() - now) / DAY);
  const groupOf = (d: string) => { const dl = daysLeft(d); if (dl < 0) return 'overdue'; if (dl <= 7) return 'week'; if (dl <= 30) return 'month'; return 'later'; };

  const grouped = useMemo(() => GROUPS.map(g => ({ ...g, items: tenders.filter(t => groupOf(t.deadline_date) === g.key) })), [tenders]);
  const overdue = grouped.find(g => g.key === 'overdue')?.items.length || 0;
  const week = grouped.find(g => g.key === 'week')?.items.length || 0;
  const month = grouped.find(g => g.key === 'month')?.items.length || 0;
  const upcomingValue = tenders.filter(t => daysLeft(t.deadline_date) >= 0).reduce((s, t) => s + Number(t.budget || 0), 0);

  const exportCols = ['Tender', 'Client', 'Deadline', 'Days left', 'Budget', 'Stage'];
  const exportRows = tenders.map(t => [t.title || t.project_name, t.client_name, t.deadline_date, daysLeft(t.deadline_date), t.budget, t.status]);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Tender Deadline Tracker"
        subtitle="Upcoming and overdue tender submission deadlines"
        breadcrumbs={[{ label: 'Pre-Sales', href: '/sales/dashboard' }, { label: 'Deadlines' }]}
        actions={tenders.length > 0 ? (
          <div className="flex gap-2">
            <Button variant="secondary" icon={FileDown} onClick={() => exportTablePdf({ title: 'Tender Deadlines', columns: exportCols, rows: exportRows, fileName: 'tender-deadlines' })}>PDF</Button>
            <Button variant="secondary" icon={Sheet} onClick={() => exportTableExcel({ title: 'Tender Deadlines', columns: exportCols, rows: exportRows, fileName: 'tender-deadlines' })}>Excel</Button>
          </div>
        ) : undefined}
      />

      {loading ? (
        <Card><div className="p-8 text-center text-sm text-[var(--text-tertiary)]">Loading…</div></Card>
      ) : tenders.length === 0 ? (
        <Card><EmptyState icon={CalendarClock} title="No upcoming deadlines" description="Open tenders with submission deadlines appear here." /></Card>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Overdue</div><div className="text-2xl font-bold mt-1" style={{ color: overdue ? 'var(--status-danger-text)' : 'var(--text-primary)' }}>{overdue}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Next 7 days</div><div className="text-2xl font-bold mt-1" style={{ color: week ? 'var(--status-warning-text)' : 'var(--text-primary)' }}>{week}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">8–30 days</div><div className="text-2xl font-bold mt-1">{month}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Upcoming value</div><div className="text-lg font-bold mt-1">{aed(upcomingValue)}</div></Card>
          </div>

          {grouped.filter(g => g.items.length > 0).map(g => (
            <Card key={g.key} className="p-0 overflow-x-auto">
              <div className="p-3 text-sm font-semibold border-b border-[var(--border)] flex items-center gap-2" style={{ color: g.color }}><span className="w-2.5 h-2.5 rounded-full" style={{ background: g.color }} />{g.label} ({g.items.length})</div>
              <table className="w-full text-sm">
                <tbody>
                  {g.items.map(t => { const dl = daysLeft(t.deadline_date); return (
                    <tr key={t.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-hover)] cursor-pointer" onClick={() => router.push(`/tenders/${t.id}`)}>
                      <td className="p-3"><div className="font-medium text-[var(--text-primary)] line-clamp-1">{t.title || t.project_name}</div><div className="text-[11px] text-[var(--text-tertiary)]">{t.client_name}</div></td>
                      <td className="p-3 text-right tabular-nums text-[var(--text-secondary)] whitespace-nowrap">{aed(t.budget)}</td>
                      <td className="p-3 text-xs text-[var(--text-secondary)] whitespace-nowrap">{t.deadline_date}</td>
                      <td className="p-3 text-right text-xs font-medium whitespace-nowrap" style={{ color: g.color }}>{dl < 0 ? `${Math.abs(dl)}d overdue` : `${dl}d left`}</td>
                    </tr>
                  ); })}
                </tbody>
              </table>
            </Card>
          ))}
        </>
      )}
    </div>
  );
}
