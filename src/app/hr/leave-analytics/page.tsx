'use client';

// ============================================================
// JEET ERP — HR: Leave Analytics
// Leave by type/status/department, pending queue and trend.
// Read-only; plain queries (no migration).
// ============================================================

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { exportTablePdf, exportTableExcel } from '@/lib/finance-export';
import { CalendarOff, FileDown, Sheet } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell } from 'recharts';

const PIE = ['var(--accent)', 'var(--status-info-text)', 'var(--status-warning-text)', 'var(--status-success-text)', 'var(--status-danger-text)', '#8b5cf6', '#14b8a6'];
const TYPES = ['ANNUAL', 'SICK', 'UNPAID', 'MATERNITY', 'PARENTAL', 'HAJJ', 'COMPASSIONATE'];

interface Lr { id: string; employee_id: string; leave_type: string; from_date: string; to_date: string; days: number; status: string; }

export default function LeaveAnalyticsPage() {
  const router = useRouter();
  const [reqs, setReqs] = useState<Lr[]>([]);
  const [empMap, setEmpMap] = useState<Map<string, { name: string; dept: string }>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.from('leave_requests').select('id, employee_id, leave_type, from_date, to_date, days, status').order('from_date', { ascending: false });
        const rows = (data || []) as Lr[];
        setReqs(rows);
        const ids = [...new Set(rows.map(r => r.employee_id).filter(Boolean))] as string[];
        if (ids.length) { const { data: em } = await supabase.from('employees').select('id, full_name_en, department').in('id', ids); setEmpMap(new Map((em || []).map((e: any) => [e.id, { name: e.full_name_en, dept: e.department || '—' }]))); }
      } finally { setLoading(false); }
    })();
  }, []);

  const now = Date.now();
  const pending = reqs.filter(r => r.status === 'PENDING');
  const approved = reqs.filter(r => r.status === 'APPROVED');
  const approvedDays = approved.reduce((s, r) => s + Number(r.days || 0), 0);
  const upcoming = approved.filter(r => r.from_date && new Date(r.from_date).getTime() >= now).length;

  const byType = useMemo(() => TYPES.map(t => ({ name: t, value: approved.filter(r => r.leave_type === t).reduce((s, r) => s + Number(r.days || 0), 0) })).filter(d => d.value > 0), [approved]);
  const byStatus = useMemo(() => [...new Set(reqs.map(r => r.status))].map(s => ({ name: s, value: reqs.filter(r => r.status === s).length })), [reqs]);
  const byDept = useMemo(() => { const m = new Map<string, number>(); approved.forEach(r => { const k = empMap.get(r.employee_id)?.dept || '—'; m.set(k, (m.get(k) || 0) + Number(r.days || 0)); }); return [...m.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 8); }, [approved, empMap]);

  const exportCols = ['Employee', 'Type', 'From', 'To', 'Days', 'Status'];
  const exportRows = reqs.map(r => [empMap.get(r.employee_id)?.name || '', r.leave_type, r.from_date, r.to_date, r.days, r.status]);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Leave Analytics"
        subtitle="Leave by type, status and department with the pending queue"
        breadcrumbs={[{ label: 'HR', href: '/hr' }, { label: 'Leave' }]}
        actions={reqs.length > 0 ? (
          <div className="flex gap-2">
            <Button variant="secondary" icon={FileDown} onClick={() => exportTablePdf({ title: 'Leave Analytics', columns: exportCols, rows: exportRows, fileName: 'leave-analytics' })}>PDF</Button>
            <Button variant="secondary" icon={Sheet} onClick={() => exportTableExcel({ title: 'Leave Analytics', columns: exportCols, rows: exportRows, fileName: 'leave-analytics' })}>Excel</Button>
          </div>
        ) : undefined}
      />

      {loading ? (
        <Card><div className="p-8 text-center text-sm text-[var(--text-tertiary)]">Loading…</div></Card>
      ) : reqs.length === 0 ? (
        <Card><EmptyState icon={CalendarOff} title="No leave requests" description="Leave requests will be analysed here." /></Card>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Requests</div><div className="text-2xl font-bold mt-1">{reqs.length}</div></Card>
            <Card className="p-4 cursor-pointer hover:border-[var(--accent)]" onClick={() => router.push('/hr/approvals')}><div className="text-xs text-[var(--text-secondary)]">Pending</div><div className="text-2xl font-bold mt-1" style={{ color: pending.length ? 'var(--status-warning-text)' : 'var(--text-primary)' }}>{pending.length}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Approved days</div><div className="text-2xl font-bold mt-1">{approvedDays}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Upcoming leave</div><div className="text-2xl font-bold mt-1">{upcoming}</div></Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <Card className="p-4">
              <div className="text-sm font-semibold text-[var(--text-primary)] mb-3">Days by leave type</div>
              <div style={{ width: '100%', height: 240 }}>
                <ResponsiveContainer>
                  {byType.length ? <PieChart><Pie data={byType} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={85} label={(e: any) => e.name}>{byType.map((_, i) => <Cell key={i} fill={PIE[i % PIE.length]} />)}</Pie><Tooltip /></PieChart> : <div className="flex items-center justify-center h-full text-sm text-[var(--text-tertiary)]">No approved leave</div>}
                </ResponsiveContainer>
              </div>
            </Card>
            <Card className="p-4">
              <div className="text-sm font-semibold text-[var(--text-primary)] mb-3">By status</div>
              <div style={{ width: '100%', height: 240 }}>
                <ResponsiveContainer>
                  <BarChart data={byStatus}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }} />
                    <YAxis tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="value" fill="var(--accent)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card className="p-4">
              <div className="text-sm font-semibold text-[var(--text-primary)] mb-3">Approved days by department</div>
              <div style={{ width: '100%', height: 240 }}>
                <ResponsiveContainer>
                  <BarChart data={byDept} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} allowDecimals={false} />
                    <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }} />
                    <Tooltip />
                    <Bar dataKey="value" fill="var(--status-info-text)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          {pending.length > 0 && (
            <Card className="p-0 overflow-x-auto">
              <div className="p-3 text-sm font-semibold text-[var(--text-primary)] border-b border-[var(--border)]">Pending approval ({pending.length})</div>
              <table className="w-full text-sm">
                <thead><tr className="border-b border-[var(--border)] text-left text-[var(--text-tertiary)] text-xs"><th className="p-3">Employee</th><th className="p-3">Type</th><th className="p-3">From</th><th className="p-3">To</th><th className="p-3 text-right">Days</th></tr></thead>
                <tbody>
                  {pending.map(r => (
                    <tr key={r.id} className="border-b border-[var(--border)] last:border-0">
                      <td className="p-3 text-[var(--text-primary)]">{empMap.get(r.employee_id)?.name || '—'}</td>
                      <td className="p-3 text-xs">{r.leave_type}</td>
                      <td className="p-3 text-xs text-[var(--text-secondary)]">{r.from_date}</td>
                      <td className="p-3 text-xs text-[var(--text-secondary)]">{r.to_date}</td>
                      <td className="p-3 text-right tabular-nums">{r.days}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
