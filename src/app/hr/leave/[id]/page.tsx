'use client';

// ============================================================
// JEET ERP — Leave Request detail / approval
// Single-record surface for a leave request: details, approve/reject,
// and the configurable LEAVE workflow panel. Additive.
// ============================================================

import React, { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import WorkflowPanel from '@/components/workflow/WorkflowPanel';
import { leaveService } from '@/services/leaveService';
import { CalendarOff, CheckCircle, XCircle, User, CalendarDays, Clock } from 'lucide-react';

const TYPE_LABEL: Record<string, string> = { ANNUAL: 'Annual', SICK: 'Sick', MATERNITY: 'Maternity', PARENTAL: 'Parental' };
const STATUS_COLOR: Record<string, { bg: string; text: string }> = {
  PENDING: { bg: 'var(--status-warning-bg)', text: 'var(--status-warning-text)' },
  APPROVED: { bg: 'var(--status-success-bg)', text: 'var(--status-success-text)' },
  REJECTED: { bg: 'var(--status-danger-bg)', text: 'var(--status-danger-text)' },
  CANCELLED: { bg: 'var(--surface-active)', text: 'var(--text-tertiary)' },
};
const fmt = (d?: string | null) => d ? new Date(d).toLocaleDateString('en-AE', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : '—';

export default function LeaveRequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [leave, setLeave] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('leave_requests')
      .select('*, employee:employees(full_name_en, employee_number, department)')
      .eq('id', id).limit(1);
    if (error) setError(error.message);
    setLeave(data?.[0] || null);
    setLoading(false);
  };
  useEffect(() => { load(); }, [id]);

  const act = async (fn: () => Promise<any>) => {
    setBusy(true); setError(null);
    try { await fn(); await load(); }
    catch (e: any) { setError(e?.message || 'Action failed'); }
    finally { setBusy(false); }
  };

  if (loading) return <div className="p-8 text-center text-sm text-[var(--text-tertiary)]">Loading…</div>;
  if (!leave) return <div className="p-6"><Card><EmptyState icon={CalendarOff} title="Leave request not found" description="It may have been removed, or the HR migration is not applied yet." /></Card></div>;

  const empName = leave.employee?.full_name_en || 'Employee';
  const st = STATUS_COLOR[leave.status] || STATUS_COLOR.PENDING;
  const isPending = leave.status === 'PENDING';

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={`${empName} — ${TYPE_LABEL[leave.leave_type] || leave.leave_type} Leave`}
        subtitle={leave.employee?.employee_number ? `${leave.employee.employee_number}${leave.employee.department ? ' · ' + leave.employee.department : ''}` : undefined}
        breadcrumbs={[{ label: 'HR', href: '/hr' }, { label: 'Leave', href: '/hr/leave-analytics' }, { label: 'Request' }]}
        actions={isPending ? (
          <div className="flex gap-2">
            <Button size="sm" variant="success" icon={CheckCircle} isLoading={busy} onClick={() => act(() => leaveService.approveLeaveRequest(id))}>Approve</Button>
            <Button size="sm" variant="danger" icon={XCircle} disabled={busy} onClick={() => { if (window.confirm('Reject this leave request?')) act(() => leaveService.rejectLeaveRequest(id)); }}>Reject</Button>
          </div>
        ) : (
          <span className="text-xs px-2.5 py-1 rounded-full" style={{ background: st.bg, color: st.text }}>{leave.status}</span>
        )}
      />

      {error && <Card className="p-3 text-xs" style={{ background: 'var(--status-danger-bg)', color: 'var(--status-danger-text)' }}>{error}</Card>}

      {/* Configurable workflow (Admin Center → Workflows) */}
      <WorkflowPanel moduleKey="LEAVE" entityId={id} context={{ status: leave.status, days: Number(leave.days) || 0 }} />

      <Card className="p-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Field icon={User} label="Employee" value={empName} />
          <Field icon={CalendarOff} label="Leave type" value={TYPE_LABEL[leave.leave_type] || leave.leave_type} />
          <Field icon={Clock} label="Working days" value={`${leave.days ?? '—'}`} />
          <Field icon={CalendarDays} label="Status" value={leave.status} valueColor={st.text} />
          <Field icon={CalendarDays} label="From" value={fmt(leave.from_date)} />
          <Field icon={CalendarDays} label="To" value={fmt(leave.to_date)} />
          <Field icon={Clock} label="Requested" value={fmt(leave.created_at)} />
        </div>
        {leave.reason && (
          <div className="mt-4 p-3 rounded-lg border border-[var(--border)] bg-[var(--surface-hover)]">
            <div className="text-[10px] uppercase tracking-wide text-[var(--text-tertiary)] mb-0.5">Reason</div>
            <div className="text-sm text-[var(--text-primary)]">{leave.reason}</div>
          </div>
        )}
      </Card>
    </div>
  );
}

function Field({ icon: Icon, label, value, valueColor }: { icon: React.ComponentType<{ size?: number; className?: string }>; label: string; value: string; valueColor?: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-[var(--text-tertiary)] flex items-center gap-1 mb-1"><Icon size={12} />{label}</div>
      <div className="text-sm font-medium text-[var(--text-primary)]" style={valueColor ? { color: valueColor } : undefined}>{value}</div>
    </div>
  );
}
