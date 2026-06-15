'use client';

// ============================================================
// JEET ERP — HR & Workforce Dashboard
// Headcount, demographics, UAE compliance-expiry alerts, payroll
// cost and pending approvals. Read-only; batched plain queries.
// ============================================================

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { exportTablePdf, exportTableExcel } from '@/lib/finance-export';
import { LayoutDashboard, FileDown, Sheet, AlertTriangle } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell } from 'recharts';

const DAY = 86400000;
const aed = (n: number) => `AED ${Number(n || 0).toLocaleString('en-AE', { maximumFractionDigits: 0 })}`;
const PIE = ['var(--accent)', 'var(--status-info-text)', 'var(--status-warning-text)', 'var(--status-success-text)', 'var(--status-danger-text)', '#8b5cf6'];
const DOC_FIELDS: { key: string; label: string }[] = [
  { key: 'visa_expiry', label: 'Visa' },
  { key: 'labour_card_expiry', label: 'Labour card' },
  { key: 'emirates_id_expiry', label: 'Emirates ID' },
  { key: 'passport_expiry', label: 'Passport' },
  { key: 'medical_insurance_expiry', label: 'Medical ins.' },
  { key: 'iloe_insurance_expiry', label: 'ILOE ins.' },
  { key: 'driving_license_expiry', label: 'Licence' },
];

export default function HrDashboard() {
  const router = useRouter();
  const [emps, setEmps] = useState<any[]>([]);
  const [latestRun, setLatestRun] = useState<any | null>(null);
  const [leavePending, setLeavePending] = useState(0);
  const [tsPending, setTsPending] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [em, pr, lv, ts] = await Promise.all([
          supabase.from('employees').select('*'),
          supabase.from('payroll_runs').select('period_month, status, gross_total, net_total').order('period_month', { ascending: false }).limit(1),
          supabase.from('leave_requests').select('status').in('status', ['PENDING', 'SUBMITTED']),
          supabase.from('timesheets').select('status').in('status', ['SUBMITTED', 'PENDING']),
        ]);
        setEmps(em.data || []);
        setLatestRun((pr.data || [])[0] || null);
        setLeavePending((lv.data || []).length);
        setTsPending((ts.data || []).length);
      } finally { setLoading(false); }
    })();
  }, []);

  const now = Date.now();
  const active = emps.filter(e => e.is_active !== false && (e.status || 'ACTIVE') !== 'EXITED');
  const departments = [...new Set(active.map(e => e.department).filter(Boolean))];

  // compliance: count docs expiring per urgency
  const compliance = useMemo(() => {
    let exp = 0, d30 = 0, d60 = 0, d90 = 0;
    active.forEach(e => DOC_FIELDS.forEach(f => {
      const v = e[f.key]; if (!v) return;
      const days = Math.ceil((new Date(v).getTime() - now) / DAY);
      if (days < 0) exp++; else if (days <= 30) d30++; else if (days <= 60) d60++; else if (days <= 90) d90++;
    }));
    return { exp, d30, d60, d90 };
  }, [active]);

  const byDept = useMemo(() => { const m = new Map<string, number>(); active.forEach(e => m.set(e.department || '—', (m.get(e.department || '—') || 0) + 1)); return [...m.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 8); }, [active]);
  const byType = useMemo(() => { const m = new Map<string, number>(); active.forEach(e => m.set(e.employment_type || 'Unspecified', (m.get(e.employment_type || 'Unspecified') || 0) + 1)); return [...m.entries()].map(([name, value]) => ({ name, value })); }, [active]);

  const payrollCost = latestRun ? Number(latestRun.net_total || latestRun.gross_total || 0) : 0;

  const hasData = emps.length > 0;
  const exportCols = ['Metric', 'Value'];
  const exportRows = [['Active headcount', active.length], ['Departments', departments.length], ['Docs expired', compliance.exp], ['Docs expiring <=30d', compliance.d30], ['Latest payroll cost', payrollCost], ['Leave pending', leavePending], ['Timesheets pending', tsPending]];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="HR & Workforce Dashboard"
        subtitle="Headcount, compliance, payroll cost and pending approvals"
        breadcrumbs={[{ label: 'HR', href: '/hr' }, { label: 'Dashboard' }]}
        actions={hasData ? (
          <div className="flex gap-2">
            <Button variant="secondary" icon={FileDown} onClick={() => exportTablePdf({ title: 'HR Dashboard', columns: exportCols, rows: exportRows, fileName: 'hr-dashboard' })}>PDF</Button>
            <Button variant="secondary" icon={Sheet} onClick={() => exportTableExcel({ title: 'HR Dashboard', columns: exportCols, rows: exportRows, fileName: 'hr-dashboard' })}>Excel</Button>
          </div>
        ) : undefined}
      />

      {loading ? (
        <Card><div className="p-8 text-center text-sm text-[var(--text-tertiary)]">Loading…</div></Card>
      ) : !hasData ? (
        <Card><EmptyState icon={LayoutDashboard} title="No employees" description="Add employees to see workforce analytics." /></Card>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="p-4 cursor-pointer hover:border-[var(--accent)]" onClick={() => router.push('/hr')}><div className="text-xs text-[var(--text-secondary)]">Active headcount</div><div className="text-2xl font-bold mt-1">{active.length}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Departments</div><div className="text-2xl font-bold mt-1">{departments.length}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Latest payroll</div><div className="text-lg font-bold mt-1">{payrollCost ? aed(payrollCost) : '—'}</div><div className="text-[11px] text-[var(--text-tertiary)]">{latestRun?.period_month?.slice(0, 7) || ''}</div></Card>
            <Card className="p-4 cursor-pointer hover:border-[var(--accent)]" onClick={() => router.push('/hr/compliance-tracker')}><div className="text-xs text-[var(--text-secondary)]">Docs expiring ≤30d</div><div className="text-2xl font-bold mt-1" style={{ color: (compliance.exp + compliance.d30) ? 'var(--status-danger-text)' : 'var(--text-primary)' }}>{compliance.exp + compliance.d30}</div></Card>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Docs expired</div><div className="text-2xl font-bold mt-1" style={{ color: compliance.exp ? 'var(--status-danger-text)' : 'var(--text-primary)' }}>{compliance.exp}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Expiring 31–90d</div><div className="text-2xl font-bold mt-1" style={{ color: (compliance.d60 + compliance.d90) ? 'var(--status-warning-text)' : 'var(--text-primary)' }}>{compliance.d60 + compliance.d90}</div></Card>
            <Card className="p-4 cursor-pointer hover:border-[var(--accent)]" onClick={() => router.push('/hr/approvals')}><div className="text-xs text-[var(--text-secondary)]">Leave pending</div><div className="text-2xl font-bold mt-1" style={{ color: leavePending ? 'var(--status-warning-text)' : 'var(--text-primary)' }}>{leavePending}</div></Card>
            <Card className="p-4 cursor-pointer hover:border-[var(--accent)]" onClick={() => router.push('/timesheets/approvals')}><div className="text-xs text-[var(--text-secondary)]">Timesheets pending</div><div className="text-2xl font-bold mt-1" style={{ color: tsPending ? 'var(--status-warning-text)' : 'var(--text-primary)' }}>{tsPending}</div></Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <Card className="p-4">
              <div className="text-sm font-semibold text-[var(--text-primary)] mb-3">Headcount by department</div>
              <div style={{ width: '100%', height: 240 }}>
                <ResponsiveContainer>
                  <BarChart data={byDept} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} allowDecimals={false} />
                    <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }} />
                    <Tooltip />
                    <Bar dataKey="value" fill="var(--accent)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card className="p-4">
              <div className="text-sm font-semibold text-[var(--text-primary)] mb-3">By employment type</div>
              <div style={{ width: '100%', height: 240 }}>
                <ResponsiveContainer>
                  <PieChart><Pie data={byType} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={85} label={(e: any) => e.name}>{byType.map((_, i) => <Cell key={i} fill={PIE[i % PIE.length]} />)}</Pie><Tooltip /></PieChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          {(compliance.exp > 0 || compliance.d30 > 0 || leavePending > 0 || tsPending > 0) && (
            <Card className="p-4" style={{ background: 'var(--status-warning-bg)' }}>
              <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--status-warning-text)' }}><AlertTriangle size={16} /> Attention needed</div>
              <ul className="mt-2 text-xs space-y-1" style={{ color: 'var(--status-warning-text)' }}>
                {compliance.exp > 0 && <li>• {compliance.exp} document(s) already expired — renew urgently.</li>}
                {compliance.d30 > 0 && <li>• {compliance.d30} document(s) expiring within 30 days.</li>}
                {leavePending > 0 && <li>• {leavePending} leave request(s) awaiting approval.</li>}
                {tsPending > 0 && <li>• {tsPending} timesheet(s) awaiting approval.</li>}
              </ul>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
