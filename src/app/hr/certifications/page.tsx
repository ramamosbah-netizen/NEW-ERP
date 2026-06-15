'use client';

// ============================================================
// JEET ERP — HR: Certification Tracker
// Employee certifications (SIRA, manufacturer, first-aid, etc.)
// with expiry tracking + add. Read-mostly; no migration.
// ============================================================

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import employeeService from '@/services/employeeService';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { exportTablePdf, exportTableExcel } from '@/lib/finance-export';
import { Award, FileDown, Sheet, Plus, Search } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

const DAY = 86400000;
const CERT_TYPES = ['SIRA_INSTALLATION', 'SIRA_CCTV_OPERATOR', 'MANUFACTURER', 'FIRST_AID', 'WORK_AT_HEIGHT', 'OTHER'];
const URGENCY = (d: number | null) => d === null ? 'No expiry' : d < 0 ? 'Expired' : d <= 60 ? 'Expiring' : 'Valid';
const uColor: Record<string, string> = { 'Expired': 'var(--status-danger-text)', 'Expiring': 'var(--status-warning-text)', 'Valid': 'var(--status-success-text)', 'No expiry': 'var(--text-tertiary)' };

interface Cert { id: string; employee_id: string; cert_type: string; cert_number: string; issue_date: string | null; expiry_date: string | null; }

export default function CertificationTrackerPage() {
  const router = useRouter();
  const [certs, setCerts] = useState<Cert[]>([]);
  const [empMap, setEmpMap] = useState<Map<string, string>>(new Map());
  const [employees, setEmployees] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('');
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ employee_id: '', cert_type: 'SIRA_INSTALLATION', cert_number: '', issue_date: '', expiry_date: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [cr, em] = await Promise.all([
        supabase.from('employee_certifications').select('*').order('expiry_date', { ascending: true }),
        supabase.from('employees').select('id, full_name_en').eq('is_active', true),
      ]);
      setCerts((cr.data || []) as Cert[]);
      setEmpMap(new Map((em.data || []).map((e: any) => [e.id, e.full_name_en])));
      setEmployees((em.data || []).map((e: any) => ({ id: e.id, name: e.full_name_en })));
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const now = Date.now();
  const daysOf = (d: string | null) => d ? Math.ceil((new Date(d).getTime() - now) / DAY) : null;
  const expired = certs.filter(c => { const d = daysOf(c.expiry_date); return d !== null && d < 0; }).length;
  const expiring = certs.filter(c => { const d = daysOf(c.expiry_date); return d !== null && d >= 0 && d <= 60; }).length;

  const rows = useMemo(() => certs.filter(c => {
    if (typeFilter && c.cert_type !== typeFilter) return false;
    if (search) { const h = `${empMap.get(c.employee_id) || ''} ${c.cert_number}`.toLowerCase(); if (!h.includes(search.toLowerCase())) return false; }
    return true;
  }), [certs, typeFilter, search, empMap]);

  const byType = useMemo(() => CERT_TYPES.map(t => ({ name: t.replace(/_/g, ' '), value: certs.filter(c => c.cert_type === t).length })).filter(d => d.value > 0), [certs]);

  const save = async () => {
    if (!form.employee_id || !form.cert_number.trim()) { alert('Employee and certificate number are required.'); return; }
    setSaving(true);
    try { await employeeService.addCertification({ employee_id: form.employee_id, cert_type: form.cert_type, cert_number: form.cert_number.trim(), issue_date: form.issue_date || null, expiry_date: form.expiry_date || null, document_id: null } as any); setModal(false); setForm({ employee_id: '', cert_type: 'SIRA_INSTALLATION', cert_number: '', issue_date: '', expiry_date: '' }); await load(); }
    catch (e: any) { alert(e?.message || 'Save failed'); } finally { setSaving(false); }
  };

  const exportCols = ['Employee', 'Type', 'Number', 'Issued', 'Expiry', 'Status'];
  const exportRows = rows.map(c => [empMap.get(c.employee_id) || '', c.cert_type, c.cert_number, c.issue_date || '', c.expiry_date || '', URGENCY(daysOf(c.expiry_date))]);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Certification Tracker"
        subtitle="Employee certifications (SIRA, manufacturer, safety) and their expiry"
        breadcrumbs={[{ label: 'HR', href: '/hr' }, { label: 'Certifications' }]}
        actions={
          <div className="flex gap-2">
            {certs.length > 0 && <>
              <Button variant="secondary" icon={FileDown} onClick={() => exportTablePdf({ title: 'Certifications', columns: exportCols, rows: exportRows, fileName: 'certifications' })}>PDF</Button>
              <Button variant="secondary" icon={Sheet} onClick={() => exportTableExcel({ title: 'Certifications', columns: exportCols, rows: exportRows, fileName: 'certifications' })}>Excel</Button>
            </>}
            <Button icon={Plus} onClick={() => setModal(true)}>Add certification</Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Certifications</div><div className="text-2xl font-bold mt-1">{certs.length}</div></Card>
        <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Expired</div><div className="text-2xl font-bold mt-1" style={{ color: expired ? 'var(--status-danger-text)' : 'var(--text-primary)' }}>{expired}</div></Card>
        <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Expiring ≤60d</div><div className="text-2xl font-bold mt-1" style={{ color: expiring ? 'var(--status-warning-text)' : 'var(--text-primary)' }}>{expiring}</div></Card>
        <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Certified employees</div><div className="text-2xl font-bold mt-1">{new Set(certs.map(c => c.employee_id)).size}</div></Card>
      </div>

      {loading ? (
        <Card><div className="p-8 text-center text-sm text-[var(--text-tertiary)]">Loading…</div></Card>
      ) : certs.length === 0 ? (
        <Card><EmptyState icon={Award} title="No certifications" description="Add employee certifications to track validity and expiry." /></Card>
      ) : (
        <>
          {byType.length > 0 && (
            <Card className="p-4">
              <div className="text-sm font-semibold text-[var(--text-primary)] mb-3">Certifications by type</div>
              <div style={{ width: '100%', height: 220 }}>
                <ResponsiveContainer>
                  <BarChart data={byType} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} allowDecimals={false} />
                    <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }} />
                    <Tooltip />
                    <Bar dataKey="value" fill="var(--accent)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          )}

          <Card className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="relative">
              <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search employee / number…" className="w-full pl-7 pr-2 h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm" />
            </div>
            <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="px-2 h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm"><option value="">All types</option>{CERT_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}</select>
          </Card>

          <Card className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-[var(--border)] text-left text-[var(--text-tertiary)] text-xs">
                <th className="p-3">Employee</th><th className="p-3">Type</th><th className="p-3">Number</th><th className="p-3">Expiry</th><th className="p-3 text-right">Days</th><th className="p-3">Status</th>
              </tr></thead>
              <tbody>
                {rows.map(c => { const d = daysOf(c.expiry_date); const u = URGENCY(d); return (
                  <tr key={c.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-hover)] cursor-pointer" onClick={() => router.push(`/hr/${c.employee_id}`)}>
                    <td className="p-3 font-medium text-[var(--text-primary)]">{empMap.get(c.employee_id) || '—'}</td>
                    <td className="p-3 text-xs">{c.cert_type.replace(/_/g, ' ')}</td>
                    <td className="p-3 text-xs text-[var(--text-secondary)]">{c.cert_number}</td>
                    <td className="p-3 text-xs text-[var(--text-secondary)]">{c.expiry_date || '—'}</td>
                    <td className="p-3 text-right tabular-nums font-medium" style={{ color: uColor[u] }}>{d === null ? '—' : d < 0 ? `${Math.abs(d)}d ago` : `${d}d`}</td>
                    <td className="p-3"><span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: 'var(--surface-active)', color: uColor[u] }}>{u}</span></td>
                  </tr>
                ); })}
              </tbody>
            </table>
          </Card>
        </>
      )}

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setModal(false)}>
          <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] w-full max-w-md p-5" onClick={e => e.stopPropagation()}>
            <div className="text-base font-semibold mb-3">Add certification</div>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs text-[var(--text-secondary)] col-span-2">Employee<select value={form.employee_id} onChange={e => setForm(f => ({ ...f, employee_id: e.target.value }))} className="w-full mt-1 px-2 h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm"><option value="">Select…</option>{employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</select></label>
              <label className="text-xs text-[var(--text-secondary)]">Type<select value={form.cert_type} onChange={e => setForm(f => ({ ...f, cert_type: e.target.value }))} className="w-full mt-1 px-2 h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm">{CERT_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}</select></label>
              <label className="text-xs text-[var(--text-secondary)]">Number<input value={form.cert_number} onChange={e => setForm(f => ({ ...f, cert_number: e.target.value }))} className="w-full mt-1 px-2 h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm" /></label>
              <label className="text-xs text-[var(--text-secondary)]">Issue date<input type="date" value={form.issue_date} onChange={e => setForm(f => ({ ...f, issue_date: e.target.value }))} className="w-full mt-1 px-2 h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm" /></label>
              <label className="text-xs text-[var(--text-secondary)]">Expiry date<input type="date" value={form.expiry_date} onChange={e => setForm(f => ({ ...f, expiry_date: e.target.value }))} className="w-full mt-1 px-2 h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm" /></label>
            </div>
            <div className="flex justify-end gap-2 mt-4"><Button variant="secondary" onClick={() => setModal(false)}>Cancel</Button><Button onClick={save} isLoading={saving}>Add</Button></div>
          </div>
        </div>
      )}
    </div>
  );
}
