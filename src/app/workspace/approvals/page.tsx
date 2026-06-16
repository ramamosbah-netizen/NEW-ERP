'use client';

// ============================================================
// JEET ERP — Workspace: Approvals Inbox
// "What needs my approval?" — pending items from every module in
// one place, scoped to the current user. Approvers see everything
// pending; everyone else sees their own submissions awaiting
// approval. Read-only aggregation; no migration.
// ============================================================

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { exportTablePdf, exportTableExcel } from '@/lib/finance-export';
import { CheckCircle2, FileDown, Sheet } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from 'recharts';

const DAY = 86400000;
const aed = (n: number) => `AED ${Number(n || 0).toLocaleString('en-AE', { maximumFractionDigits: 0 })}`;
const N = (v: any) => Number(v || 0);
// roles that approve things (lowercased); everyone else sees only their own submissions
const APPROVER_ROLES = ['admin', 'administrator', 'manager', 'general manager', 'commercial manager', 'project manager', 'accountant', 'hr manager', 'finance', 'finance manager', 'financial director'];

type Cat = 'Procurement' | 'Sales' | 'HR' | 'Service' | 'Finance';
interface Item { category: Cat; type: string; ref: string; label: string; value: number; date: string | null; href: string; creatorId: string | null; employeeId: string | null; }
const catColor: Record<Cat, string> = { Procurement: 'var(--accent)', Sales: 'var(--status-info-text)', HR: 'var(--status-warning-text)', Service: 'var(--status-success-text)', Finance: '#8b5cf6' };

export default function ApprovalsPage() {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [catFilter, setCatFilter] = useState<Cat | ''>('');
  const [userId, setUserId] = useState<string | null>(null);
  const [myEmployeeId, setMyEmployeeId] = useState<string | null>(null);
  const [role, setRole] = useState<string>('');
  const [scope, setScope] = useState<'mine' | 'all'>('mine');

  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        const uid = user?.id || null; setUserId(uid);
        if (uid) {
          const [{ data: prof }, { data: emp }] = await Promise.all([
            supabase.from('profiles').select('role').eq('id', uid).maybeSingle(),
            supabase.from('employees').select('id').eq('user_id', uid).maybeSingle(),
          ]);
          const r = (prof?.role || '').toLowerCase(); setRole(prof?.role || '');
          setMyEmployeeId(emp?.id || null);
          setScope(APPROVER_ROLES.includes(r) ? 'all' : 'mine');
        }
        const [pr, po, cmp, qt, inv, pay, lv, ts, mrf, amc] = await Promise.all([
          supabase.from('purchase_requests').select('id, pr_number, estimated_total, created_at, status, requested_by').in('status', ['SUBMITTED', 'PENDING_APPROVAL']),
          supabase.from('purchase_orders').select('id, po_number, total, created_at, status, created_by').in('status', ['PENDING_APPROVAL']),
          supabase.from('supplier_comparisons').select('id, comparison_number, total_selected_supplier_cost, created_at, status, prepared_by').in('status', ['PENDING_APPROVAL', 'PENDING_REVIEW', 'SUBMITTED', 'REVIEW']),
          supabase.from('quotations').select('id, quotation_number, grand_total_with_vat, created_at, status, prepared_by').in('status', ['PENDING_REVIEW', 'PENDING_APPROVAL', 'PENDING_GM', 'SUBMITTED']),
          supabase.from('supplier_invoices').select('id, internal_ref, supplier_invoice_number, total, created_at, status, created_by').in('status', ['PENDING_APPROVAL', 'REGISTERED']),
          supabase.from('payroll_runs').select('id, period_month, gross_total, created_at, status, created_by').in('status', ['REVIEW']),
          supabase.from('leave_requests').select('id, employee_id, leave_type, days, created_at, status').in('status', ['PENDING']),
          supabase.from('timesheets').select('id, employee_id, week_start, created_at, status').in('status', ['SUBMITTED']),
          supabase.from('material_requisitions').select('id, mrf_number, created_at, status, requested_by').in('status', ['SUBMITTED']),
          supabase.from('amc_contracts').select('id, contract_number, annual_value, created_at, status, created_by').in('status', ['PENDING_APPROVAL']),
        ]);
        const out: Item[] = [];
        const add = (category: Cat, type: string, ref: string, value: number, date: string | null, href: string, creatorId: string | null = null, employeeId: string | null = null, label = '') => out.push({ category, type, ref, label, value, date, href, creatorId, employeeId });
        (pr.data || []).forEach((r: any) => add('Procurement', 'Purchase Request', r.pr_number, N(r.estimated_total), r.created_at, `/procurement/pr/${r.id}`, r.requested_by));
        (po.data || []).forEach((r: any) => add('Procurement', 'Purchase Order', r.po_number, N(r.total), r.created_at, `/procurement/po/${r.id}`, r.created_by));
        (cmp.data || []).forEach((r: any) => add('Procurement', 'Quote Comparison', r.comparison_number, N(r.total_selected_supplier_cost), r.created_at, `/procurement/comparisons/${r.id}`, r.prepared_by));
        (mrf.data || []).forEach((r: any) => add('Procurement', 'Material Requisition', r.mrf_number, 0, r.created_at, `/warehouse/mrf/${r.id}`, r.requested_by));
        (inv.data || []).forEach((r: any) => add('Finance', 'Supplier Invoice', r.supplier_invoice_number || r.internal_ref || '—', N(r.total), r.created_at, `/finance/ap`, r.created_by));
        (qt.data || []).forEach((r: any) => add('Sales', 'Quotation', r.quotation_number, N(r.grand_total_with_vat), r.created_at, `/quotations/${r.id}`, r.prepared_by));
        (pay.data || []).forEach((r: any) => add('HR', 'Payroll Run', (r.period_month || '').slice(0, 7), N(r.gross_total), r.created_at, `/payroll`, r.created_by));
        (amc.data || []).forEach((r: any) => add('Service', 'AMC Contract', r.contract_number, N(r.annual_value), r.created_at, `/amc/${r.id}`, r.created_by));
        const leaveRows = (lv.data || []); const tsRows = (ts.data || []);
        const eids = [...new Set([...leaveRows.map((r: any) => r.employee_id), ...tsRows.map((r: any) => r.employee_id)].filter(Boolean))] as string[];
        const nameMap = new Map<string, string>();
        if (eids.length) { const { data: em } = await supabase.from('employees').select('id, full_name_en').in('id', eids); (em || []).forEach((x: any) => nameMap.set(x.id, x.full_name_en)); }
        leaveRows.forEach((r: any) => add('HR', 'Leave Request', `${r.leave_type} (${r.days}d)`, 0, r.created_at, `/hr/leave/${r.id}`, null, r.employee_id, nameMap.get(r.employee_id) || ''));
        tsRows.forEach((r: any) => add('HR', 'Timesheet', `Week ${r.week_start}`, 0, r.created_at, `/timesheets/approvals`, null, r.employee_id, nameMap.get(r.employee_id) || ''));
        setItems(out.sort((a, b) => new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime()));
      } finally { setLoading(false); }
    })();
  }, []);

  const now = Date.now();
  const ageOf = (d: string | null) => d ? Math.floor((now - new Date(d).getTime()) / DAY) : 0;
  const isApprover = APPROVER_ROLES.includes((role || '').toLowerCase());
  const mineFilter = (i: Item) => (i.creatorId && i.creatorId === userId) || (i.employeeId && i.employeeId === myEmployeeId);

  const scoped = useMemo(() => scope === 'mine' ? items.filter(mineFilter) : items, [items, scope, userId, myEmployeeId]);
  const rows = useMemo(() => catFilter ? scoped.filter(i => i.category === catFilter) : scoped, [scoped, catFilter]);
  const totalValue = scoped.reduce((s, i) => s + i.value, 0);
  const oldest = scoped.reduce((m, i) => Math.max(m, ageOf(i.date)), 0);
  const cats = (['Procurement', 'Sales', 'HR', 'Service', 'Finance'] as Cat[]);
  const byCat = cats.map(c => ({ name: c, value: scoped.filter(i => i.category === c).length })).filter(d => d.value > 0);

  const exportCols = ['Category', 'Type', 'Reference', 'Requester', 'Value', 'Age (days)'];
  const exportRows = rows.map(i => [i.category, i.type, i.ref, i.label, i.value, ageOf(i.date)]);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Approvals"
        subtitle={isApprover ? 'Everything across the system that needs your approval' : 'Your submissions awaiting approval'}
        breadcrumbs={[{ label: 'Workspace', href: '/workspace' }, { label: 'Approvals' }]}
        actions={items.length > 0 ? (
          <div className="flex gap-2">
            <Button variant="secondary" icon={FileDown} onClick={() => exportTablePdf({ title: 'Pending Approvals', columns: exportCols, rows: exportRows, fileName: 'approvals' })}>PDF</Button>
            <Button variant="secondary" icon={Sheet} onClick={() => exportTableExcel({ title: 'Pending Approvals', columns: exportCols, rows: exportRows, fileName: 'approvals' })}>Excel</Button>
          </div>
        ) : undefined}
      />

      <Card className="p-3 flex items-center gap-2">
        <span className="text-xs text-[var(--text-secondary)]">View:</span>
        <div className="inline-flex rounded-md border border-[var(--border)] overflow-hidden">
          {(['mine', 'all'] as const).map(s => (
            <button key={s} onClick={() => setScope(s)} className="px-3 h-8 text-xs font-medium" style={{ background: scope === s ? 'var(--accent)' : 'var(--surface)', color: scope === s ? '#fff' : 'var(--text-secondary)' }}>
              {s === 'mine' ? (isApprover ? 'For me to approve' : 'My submissions') : 'Everyone'}
            </button>
          ))}
        </div>
        {role && <span className="text-[11px] text-[var(--text-tertiary)] ml-auto">Role: {role}</span>}
      </Card>

      {loading ? (
        <Card><div className="p-8 text-center text-sm text-[var(--text-tertiary)]">Loading…</div></Card>
      ) : scoped.length === 0 ? (
        <Card><EmptyState icon={CheckCircle2} title="All clear" description={scope === 'mine' ? 'Nothing of yours is waiting right now.' : 'Nothing is waiting for approval right now.'} /></Card>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="p-4 cursor-pointer hover:border-[var(--accent)]" onClick={() => setCatFilter('')}><div className="text-xs text-[var(--text-secondary)]">Pending approvals</div><div className="text-2xl font-bold mt-1">{scoped.length}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Value at stake</div><div className="text-lg font-bold mt-1">{aed(totalValue)}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Oldest waiting</div><div className="text-2xl font-bold mt-1" style={{ color: oldest > 7 ? 'var(--status-danger-text)' : 'var(--text-primary)' }}>{oldest}<span className="text-sm font-normal text-[var(--text-tertiary)]">d</span></div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Categories</div><div className="text-2xl font-bold mt-1">{byCat.length}</div></Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <Card className="p-4">
              <div className="text-sm font-semibold text-[var(--text-primary)] mb-3">By category</div>
              <div style={{ width: '100%', height: 220 }}>
                <ResponsiveContainer>
                  <BarChart data={byCat}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }} />
                    <YAxis tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>{byCat.map((c, i) => <Cell key={i} fill={catColor[c.name as Cat]} />)}</Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card className="p-2 lg:col-span-2 overflow-x-auto">
              <div className="flex items-center justify-between p-2">
                <div className="text-sm font-semibold text-[var(--text-primary)]">Approval queue</div>
                <select value={catFilter} onChange={e => setCatFilter(e.target.value as Cat | '')} className="px-2 h-8 rounded-md border border-[var(--border)] bg-[var(--surface)] text-xs"><option value="">All categories</option>{cats.map(c => <option key={c} value={c}>{c}</option>)}</select>
              </div>
              <table className="w-full text-sm">
                <thead><tr className="border-b border-[var(--border)] text-left text-[var(--text-tertiary)] text-xs">
                  <th className="p-2">Type</th><th className="p-2">Reference</th><th className="p-2 text-right">Value</th><th className="p-2 text-right">Age</th>
                </tr></thead>
                <tbody>
                  {rows.map((i, idx) => { const age = ageOf(i.date); return (
                    <tr key={idx} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-hover)] cursor-pointer" onClick={() => router.push(i.href)}>
                      <td className="p-2"><span className="inline-flex items-center gap-1.5 text-xs"><span className="w-2 h-2 rounded-full" style={{ background: catColor[i.category] }} />{i.type}</span></td>
                      <td className="p-2 text-xs"><span className="font-medium text-[var(--text-primary)]">{i.ref}</span>{i.label ? <span className="text-[var(--text-tertiary)]"> · {i.label}</span> : ''}</td>
                      <td className="p-2 text-right tabular-nums text-[var(--text-secondary)]">{i.value ? aed(i.value) : '—'}</td>
                      <td className="p-2 text-right tabular-nums text-xs" style={{ color: age > 7 ? 'var(--status-danger-text)' : age > 3 ? 'var(--status-warning-text)' : 'var(--text-tertiary)' }}>{age}d</td>
                    </tr>
                  ); })}
                </tbody>
              </table>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
