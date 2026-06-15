'use client';

// ============================================================
// JEET ERP — HR: Employee Documents Center
// Per-employee document completeness (statutory IDs + certs +
// DMS uploads) and a unified register. Read-only; no migration.
// ============================================================

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { exportTablePdf, exportTableExcel } from '@/lib/finance-export';
import { FolderArchive, FileDown, Sheet } from 'lucide-react';

const DAY = 86400000;
const KEY_DOCS: { key: string; label: string }[] = [
  { key: 'visa_expiry', label: 'Visa' },
  { key: 'labour_card_expiry', label: 'Labour card' },
  { key: 'emirates_id_expiry', label: 'Emirates ID' },
  { key: 'passport_expiry', label: 'Passport' },
];
const ALL_DOCS: { key: string; label: string }[] = [...KEY_DOCS,
  { key: 'medical_insurance_expiry', label: 'Medical insurance' },
  { key: 'iloe_insurance_expiry', label: 'ILOE insurance' },
  { key: 'driving_license_expiry', label: 'Driving licence' },
];

export default function DocumentsCenterPage() {
  const router = useRouter();
  const [emps, setEmps] = useState<any[]>([]);
  const [certCount, setCertCount] = useState<Map<string, number>>(new Map());
  const [docs, setDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string>('');

  useEffect(() => {
    (async () => {
      try {
        const { data: em } = await supabase.from('employees').select('*').eq('is_active', true);
        const active = em || [];
        setEmps(active);
        const ids = active.map((e: any) => e.id);
        const [cr, dc] = await Promise.all([
          ids.length ? supabase.from('employee_certifications').select('employee_id') : Promise.resolve({ data: [] as any[] }),
          ids.length ? supabase.from('documents').select('id, title, category, issue_date, expiry_date, entity_id, storage_path, is_active').in('entity_id', ids) : Promise.resolve({ data: [] as any[] }),
        ]);
        const cc = new Map<string, number>(); (cr.data || []).forEach((c: any) => cc.set(c.employee_id, (cc.get(c.employee_id) || 0) + 1)); setCertCount(cc);
        setDocs((dc.data || []).filter((d: any) => d.is_active !== false));
      } finally { setLoading(false); }
    })();
  }, []);

  const now = Date.now();
  const docCount = useMemo(() => { const m = new Map<string, number>(); docs.forEach(d => m.set(d.entity_id, (m.get(d.entity_id) || 0) + 1)); return m; }, [docs]);

  const completeness = (e: any) => KEY_DOCS.filter(d => e[d.key]).length;
  const complete = emps.filter(e => completeness(e) === KEY_DOCS.length).length;
  const incomplete = emps.length - complete;
  const totalUploads = docs.length;

  const cellState = (e: any, key: string) => {
    const v = e[key]; if (!v) return { label: 'Missing', color: 'var(--status-danger-text)' };
    const days = Math.ceil((new Date(v).getTime() - now) / DAY);
    if (days < 0) return { label: 'Expired', color: 'var(--status-danger-text)' };
    if (days <= 30) return { label: v, color: 'var(--status-warning-text)' };
    return { label: v, color: 'var(--status-success-text)' };
  };

  const selEmp = emps.find(e => e.id === selected);
  const selDocs = useMemo(() => {
    if (!selEmp) return [];
    const out: { type: string; ref: string; issue: string; expiry: string; source: string }[] = [];
    ALL_DOCS.forEach(d => { if (selEmp[d.key]) out.push({ type: d.label, ref: '—', issue: '', expiry: selEmp[d.key], source: 'Statutory' }); });
    docs.filter(d => d.entity_id === selEmp.id).forEach(d => out.push({ type: d.category || 'Document', ref: d.title || '', issue: d.issue_date || '', expiry: d.expiry_date || '', source: 'Upload' }));
    return out;
  }, [selEmp, docs]);

  const exportCols = ['Employee', 'Department', ...KEY_DOCS.map(d => d.label), 'Certs', 'Uploads', 'Complete'];
  const exportRows = emps.map(e => [e.full_name_en, e.department || '', ...KEY_DOCS.map(d => cellState(e, d.key).label), certCount.get(e.id) || 0, docCount.get(e.id) || 0, completeness(e) === KEY_DOCS.length ? 'Yes' : 'No']);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Employee Documents Center"
        subtitle="Document completeness and register across the workforce"
        breadcrumbs={[{ label: 'HR', href: '/hr' }, { label: 'Documents' }]}
        actions={emps.length > 0 ? (
          <div className="flex gap-2">
            <Button variant="secondary" icon={FileDown} onClick={() => exportTablePdf({ title: 'Employee Documents', columns: exportCols, rows: exportRows, fileName: 'employee-documents' })}>PDF</Button>
            <Button variant="secondary" icon={Sheet} onClick={() => exportTableExcel({ title: 'Employee Documents', columns: exportCols, rows: exportRows, fileName: 'employee-documents' })}>Excel</Button>
          </div>
        ) : undefined}
      />

      {loading ? (
        <Card><div className="p-8 text-center text-sm text-[var(--text-tertiary)]">Loading…</div></Card>
      ) : emps.length === 0 ? (
        <Card><EmptyState icon={FolderArchive} title="No employees" description="Employee documents appear here once staff are added." /></Card>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Employees</div><div className="text-2xl font-bold mt-1">{emps.length}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Complete files</div><div className="text-2xl font-bold mt-1" style={{ color: 'var(--status-success-text)' }}>{complete}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Incomplete</div><div className="text-2xl font-bold mt-1" style={{ color: incomplete ? 'var(--status-warning-text)' : 'var(--text-primary)' }}>{incomplete}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Uploaded documents</div><div className="text-2xl font-bold mt-1">{totalUploads}</div></Card>
          </div>

          <Card className="p-0 overflow-x-auto">
            <div className="p-3 text-sm font-semibold text-[var(--text-primary)] border-b border-[var(--border)]">Document completeness</div>
            <table className="w-full text-sm">
              <thead><tr className="border-b border-[var(--border)] text-left text-[var(--text-tertiary)] text-xs">
                <th className="p-3">Employee</th>{KEY_DOCS.map(d => <th key={d.key} className="p-3">{d.label}</th>)}<th className="p-3 text-right">Certs</th><th className="p-3 text-right">Uploads</th>
              </tr></thead>
              <tbody>
                {emps.map(e => (
                  <tr key={e.id} className={`border-b border-[var(--border)] last:border-0 cursor-pointer ${selected === e.id ? 'bg-[var(--surface-hover)]' : 'hover:bg-[var(--surface-hover)]'}`} onClick={() => setSelected(selected === e.id ? '' : e.id)}>
                    <td className="p-3"><div className="font-medium text-[var(--text-primary)]">{e.full_name_en}</div><div className="text-[11px] text-[var(--text-tertiary)]">{e.department || '—'}</div></td>
                    {KEY_DOCS.map(d => { const c = cellState(e, d.key); return <td key={d.key} className="p-3 text-xs" style={{ color: c.color }}>{c.label}</td>; })}
                    <td className="p-3 text-right tabular-nums text-[var(--text-secondary)]">{certCount.get(e.id) || 0}</td>
                    <td className="p-3 text-right tabular-nums text-[var(--text-secondary)]">{docCount.get(e.id) || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          {selEmp && (
            <Card className="p-0 overflow-x-auto">
              <div className="p-3 text-sm font-semibold text-[var(--text-primary)] border-b border-[var(--border)] flex items-center justify-between">
                <span>{selEmp.full_name_en} — document register</span>
                <button onClick={() => router.push(`/hr/${selEmp.id}`)} className="text-xs text-[var(--accent)]">Open profile</button>
              </div>
              {selDocs.length === 0 ? <div className="p-5 text-center text-sm text-[var(--text-tertiary)]">No documents on file.</div> : (
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-[var(--border)] text-left text-[var(--text-tertiary)] text-xs"><th className="p-3">Document</th><th className="p-3">Reference</th><th className="p-3">Issue</th><th className="p-3">Expiry</th><th className="p-3">Source</th></tr></thead>
                  <tbody>
                    {selDocs.map((d, i) => (
                      <tr key={i} className="border-b border-[var(--border)] last:border-0">
                        <td className="p-3 font-medium text-[var(--text-primary)]">{d.type}</td>
                        <td className="p-3 text-xs text-[var(--text-secondary)] line-clamp-1">{d.ref || '—'}</td>
                        <td className="p-3 text-xs text-[var(--text-secondary)]">{d.issue || '—'}</td>
                        <td className="p-3 text-xs text-[var(--text-secondary)]">{d.expiry || '—'}</td>
                        <td className="p-3 text-xs"><span className="px-2 py-0.5 rounded-full" style={{ background: 'var(--surface-active)', color: d.source === 'Upload' ? 'var(--status-info-text)' : 'var(--text-tertiary)' }}>{d.source}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>
          )}
        </>
      )}
    </div>
  );
}
