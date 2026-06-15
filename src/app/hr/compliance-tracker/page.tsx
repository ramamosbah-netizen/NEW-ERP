'use client';

// ============================================================
// JEET ERP — HR: Document Compliance & Expiry Tracker
// Every UAE employment document expiry (visa, labour card, EID,
// passport, insurance, licence) bucketed by urgency. Read-only.
// ============================================================

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { exportTablePdf, exportTableExcel } from '@/lib/finance-export';
import { ShieldCheck, FileDown, Sheet, Search } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';

const DAY = 86400000;
const DOCS: { key: string; label: string }[] = [
  { key: 'visa_expiry', label: 'Visa' },
  { key: 'labour_card_expiry', label: 'Labour card' },
  { key: 'emirates_id_expiry', label: 'Emirates ID' },
  { key: 'passport_expiry', label: 'Passport' },
  { key: 'medical_insurance_expiry', label: 'Medical insurance' },
  { key: 'iloe_insurance_expiry', label: 'ILOE insurance' },
  { key: 'driving_license_expiry', label: 'Driving licence' },
];
const URGENCY = (days: number) => days < 0 ? 'Expired' : days <= 30 ? '≤30 days' : days <= 60 ? '31–60 days' : days <= 90 ? '61–90 days' : 'Valid';
const uColor: Record<string, string> = { 'Expired': 'var(--status-danger-text)', '≤30 days': 'var(--status-danger-text)', '31–60 days': 'var(--status-warning-text)', '61–90 days': 'var(--status-info-text)', 'Valid': 'var(--status-success-text)' };

interface Row { emp_id: string; emp: string; emp_no: string; department: string; doc: string; expiry: string; days: number; urgency: string; }

export default function ComplianceTrackerPage() {
  const router = useRouter();
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [docFilter, setDocFilter] = useState('');
  const [urgencyFilter, setUrgencyFilter] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    supabase.from('employees').select('*').then(({ data }) => setEmployees((data || []).filter((e: any) => e.is_active !== false))).then(() => setLoading(false), () => setLoading(false));
  }, []);

  const now = Date.now();
  const allRows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    employees.forEach(e => DOCS.forEach(d => {
      const v = e[d.key]; if (!v) return;
      const days = Math.ceil((new Date(v).getTime() - now) / DAY);
      out.push({ emp_id: e.id, emp: e.full_name_en, emp_no: e.employee_number, department: e.department || '—', doc: d.label, expiry: v, days, urgency: URGENCY(days) });
    }));
    return out.sort((a, b) => a.days - b.days);
  }, [employees]);

  const rows = useMemo(() => allRows.filter(r => {
    if (docFilter && r.doc !== docFilter) return false;
    if (urgencyFilter && r.urgency !== urgencyFilter) return false;
    if (search && !`${r.emp} ${r.emp_no}`.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [allRows, docFilter, urgencyFilter, search]);

  const expired = allRows.filter(r => r.urgency === 'Expired').length;
  const soon = allRows.filter(r => r.urgency === '≤30 days').length;
  const d90 = allRows.filter(r => ['31–60 days', '61–90 days'].includes(r.urgency)).length;

  const byDoc = useMemo(() => DOCS.map(d => {
    const items = allRows.filter(r => r.doc === d.label);
    return { name: d.label, Expired: items.filter(r => r.urgency === 'Expired').length, 'Expiring': items.filter(r => ['≤30 days', '31–60 days', '61–90 days'].includes(r.urgency)).length };
  }).filter(d => d.Expired || d.Expiring), [allRows]);

  const exportCols = ['Employee', 'Emp #', 'Department', 'Document', 'Expiry', 'Days left', 'Status'];
  const exportRows = rows.map(r => [r.emp, r.emp_no, r.department, r.doc, r.expiry, r.days, r.urgency]);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Document Compliance & Expiry"
        subtitle="UAE employment-document expiries across the workforce"
        breadcrumbs={[{ label: 'HR', href: '/hr' }, { label: 'Compliance' }]}
        actions={allRows.length > 0 ? (
          <div className="flex gap-2">
            <Button variant="secondary" icon={FileDown} onClick={() => exportTablePdf({ title: 'Document Compliance', columns: exportCols, rows: exportRows, fileName: 'document-compliance' })}>PDF</Button>
            <Button variant="secondary" icon={Sheet} onClick={() => exportTableExcel({ title: 'Document Compliance', columns: exportCols, rows: exportRows, fileName: 'document-compliance' })}>Excel</Button>
          </div>
        ) : undefined}
      />

      {loading ? (
        <Card><div className="p-8 text-center text-sm text-[var(--text-tertiary)]">Loading…</div></Card>
      ) : allRows.length === 0 ? (
        <Card><EmptyState icon={ShieldCheck} title="No documents tracked" description="Employee document expiry dates appear here once recorded." /></Card>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="p-4 cursor-pointer hover:border-[var(--accent)]" onClick={() => setUrgencyFilter('Expired')}><div className="text-xs text-[var(--text-secondary)]">Expired</div><div className="text-2xl font-bold mt-1" style={{ color: expired ? 'var(--status-danger-text)' : 'var(--text-primary)' }}>{expired}</div></Card>
            <Card className="p-4 cursor-pointer hover:border-[var(--accent)]" onClick={() => setUrgencyFilter('≤30 days')}><div className="text-xs text-[var(--text-secondary)]">Expiring ≤30d</div><div className="text-2xl font-bold mt-1" style={{ color: soon ? 'var(--status-danger-text)' : 'var(--text-primary)' }}>{soon}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Expiring 31–90d</div><div className="text-2xl font-bold mt-1" style={{ color: d90 ? 'var(--status-warning-text)' : 'var(--text-primary)' }}>{d90}</div></Card>
            <Card className="p-4 cursor-pointer hover:border-[var(--accent)]" onClick={() => { setUrgencyFilter(''); setDocFilter(''); }}><div className="text-xs text-[var(--text-secondary)]">Documents tracked</div><div className="text-2xl font-bold mt-1">{allRows.length}</div></Card>
          </div>

          {byDoc.length > 0 && (
            <Card className="p-4">
              <div className="text-sm font-semibold text-[var(--text-primary)] mb-3">Expired &amp; expiring by document type</div>
              <div style={{ width: '100%', height: 240 }}>
                <ResponsiveContainer>
                  <BarChart data={byDoc}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="name" tick={{ fontSize: 9, fill: 'var(--text-tertiary)' }} />
                    <YAxis tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} allowDecimals={false} />
                    <Tooltip /><Legend />
                    <Bar dataKey="Expired" stackId="a" fill="var(--status-danger-text)" />
                    <Bar dataKey="Expiring" stackId="a" fill="var(--status-warning-text)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          )}

          <Card className="p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="relative">
              <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search employee…" className="w-full pl-7 pr-2 h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm" />
            </div>
            <select value={docFilter} onChange={e => setDocFilter(e.target.value)} className="px-2 h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm"><option value="">All documents</option>{DOCS.map(d => <option key={d.label} value={d.label}>{d.label}</option>)}</select>
            <select value={urgencyFilter} onChange={e => setUrgencyFilter(e.target.value)} className="px-2 h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm"><option value="">All statuses</option>{['Expired', '≤30 days', '31–60 days', '61–90 days', 'Valid'].map(u => <option key={u} value={u}>{u}</option>)}</select>
          </Card>

          <Card className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-[var(--border)] text-left text-[var(--text-tertiary)] text-xs">
                <th className="p-3">Employee</th><th className="p-3">Department</th><th className="p-3">Document</th><th className="p-3">Expiry</th><th className="p-3 text-right">Days left</th><th className="p-3">Status</th>
              </tr></thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-hover)] cursor-pointer" onClick={() => router.push(`/hr/${r.emp_id}`)}>
                    <td className="p-3"><div className="font-medium text-[var(--text-primary)]">{r.emp}</div><div className="text-[11px] text-[var(--text-tertiary)]">{r.emp_no}</div></td>
                    <td className="p-3 text-xs text-[var(--text-secondary)]">{r.department}</td>
                    <td className="p-3 text-xs">{r.doc}</td>
                    <td className="p-3 text-xs text-[var(--text-secondary)]">{r.expiry}</td>
                    <td className="p-3 text-right tabular-nums font-medium" style={{ color: uColor[r.urgency] }}>{r.days < 0 ? `${Math.abs(r.days)}d ago` : `${r.days}d`}</td>
                    <td className="p-3"><span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: 'var(--surface-active)', color: uColor[r.urgency] }}>{r.urgency}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </div>
  );
}
