'use client';

// ============================================================
// JEET ERP — Finance: Commitments ledger (Page 2)
// Outstanding committed cost from LPOs, payroll and manual entries,
// grouped by project / vendor / category.
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import commitmentLedgerService, { CommitmentRow, CommitmentSource } from '@/services/commitmentLedgerService';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { FileSignature, Plus, X, Search, FileText, FileSpreadsheet } from 'lucide-react';
import { exportTablePdf, exportTableExcel, ExportTable } from '@/lib/finance-export';

const money = (v: number) => new Intl.NumberFormat('en-AE', { maximumFractionDigits: 0 }).format(v || 0);
const SRC: Record<string, { bg: string; text: string }> = {
  PO: { bg: 'var(--status-info-bg)', text: 'var(--status-info-text)' },
  PAYROLL: { bg: 'var(--status-warning-bg)', text: 'var(--status-warning-text)' },
  SUBCONTRACT: { bg: 'var(--status-success-bg)', text: 'var(--status-success-text)' },
  RECURRING: { bg: 'var(--status-neutral-bg)', text: 'var(--status-neutral-text)' },
  OTHER: { bg: 'var(--status-neutral-bg)', text: 'var(--status-neutral-text)' },
  PR: { bg: 'var(--status-neutral-bg)', text: 'var(--status-neutral-text)' },
};
const GROUPS = [{ k: 'project', l: 'By project' }, { k: 'vendor', l: 'By vendor' }, { k: 'category', l: 'By category' }, { k: 'none', l: 'All rows' }] as const;

export default function CommitmentsPage() {
  const [rows, setRows] = useState<CommitmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [group, setGroup] = useState<'project' | 'vendor' | 'category' | 'none'>('project');
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [projects, setProjects] = useState<{ id: string; label: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ project_id: '', source_type: 'SUBCONTRACT' as CommitmentSource, vendor_name: '', category: '', amount: '', expected_payment_date: '' });

  const load = useCallback(async () => {
    try { setLoading(true); setRows(await commitmentLedgerService.list()); setError(null); }
    catch (e: any) { setError(e.message || 'Failed to load commitments'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    supabase.from('projects').select('id, project_number, name').order('project_number', { ascending: false })
      .then(({ data }) => setProjects((data || []).map((p: any) => ({ id: p.id, label: `${p.project_number} — ${p.name}` }))));
  }, []);

  const filtered = rows.filter(r => !search || r.vendor_name.toLowerCase().includes(search.toLowerCase()) || r.project_number.toLowerCase().includes(search.toLowerCase()) || r.category.toLowerCase().includes(search.toLowerCase()));
  const total = filtered.reduce((s, r) => s + r.amount, 0);
  const projectsCount = new Set(filtered.map(r => r.project_number)).size;
  const vendorsCount = new Set(filtered.map(r => r.vendor_name)).size;

  const grouped = group === 'none' ? null : Array.from(filtered.reduce((m, r) => {
    const key = group === 'project' ? r.project_number : group === 'vendor' ? r.vendor_name : r.category;
    const e = m.get(key) || { key, amount: 0, count: 0 };
    e.amount += r.amount; e.count++; m.set(key, e); return m;
  }, new Map<string, { key: string; amount: number; count: number }>()).values()).sort((a, b) => b.amount - a.amount);

  const commitTable = (): ExportTable => ({
    title: 'Commitments', subtitle: 'JEET INTECH L.L.C', fileName: 'commitments',
    columns: ['Source', 'Project', 'Vendor', 'Category', 'Expected pay', 'Committed (AED)'],
    rows: filtered.map(r => [r.source_type, r.project_number, r.vendor_name, r.category, r.expected_payment_date || '', r.amount]),
  });

  const add = async () => {
    setBusy(true);
    try {
      await commitmentLedgerService.addManual({
        project_id: form.project_id || null, source_type: form.source_type, vendor_name: form.vendor_name,
        category: form.category || form.source_type, amount: Number(form.amount), expected_payment_date: form.expected_payment_date || null,
      });
      setShowAdd(false); setForm({ project_id: '', source_type: 'SUBCONTRACT', vendor_name: '', category: '', amount: '', expected_payment_date: '' });
      await load();
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  };

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Commitments"
        subtitle="Outstanding committed cost — approved LPOs, payroll and manual commitments (subcontracts, recurring)"
        breadcrumbs={[{ label: 'Finance', href: '/finance' }, { label: 'Commitments' }]}
        actions={
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" icon={FileText} onClick={() => exportTablePdf(commitTable())} disabled={filtered.length === 0}>PDF</Button>
            <Button size="sm" variant="secondary" icon={FileSpreadsheet} onClick={() => exportTableExcel(commitTable())} disabled={filtered.length === 0}>Excel</Button>
            <Button size="sm" variant="primary" icon={Plus} onClick={() => setShowAdd(true)}>Add commitment</Button>
          </div>
        }
      />

      {error && (
        <div className="flex items-center justify-between gap-3 bg-[var(--status-danger-bg)] border border-[var(--status-danger-border)] rounded-lg p-3 text-xs text-[var(--status-danger-text)]">
          <span>{error}</span><button onClick={() => setError(null)} className="cursor-pointer"><X size={13} /></button>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Card className="p-3.5"><div className="text-[11px] uppercase tracking-wide text-[var(--text-tertiary)]">Total commitments</div><div className="text-lg font-semibold mt-1 tabular-nums">{money(total)} AED</div></Card>
        <Card className="p-3.5"><div className="text-[11px] uppercase tracking-wide text-[var(--text-tertiary)]">Projects</div><div className="text-lg font-semibold mt-1 tabular-nums">{projectsCount}</div></Card>
        <Card className="p-3.5"><div className="text-[11px] uppercase tracking-wide text-[var(--text-tertiary)]">Vendors</div><div className="text-lg font-semibold mt-1 tabular-nums">{vendorsCount}</div></Card>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative max-w-xs flex-1 min-w-[180px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search vendor, project, category…" className="w-full pl-9 pr-3 h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm" />
        </div>
        <div className="flex gap-1.5 ml-auto">
          {GROUPS.map(g => (
            <button key={g.k} onClick={() => setGroup(g.k)} className="px-3 py-1.5 rounded-md text-xs font-medium border cursor-pointer"
              style={{ background: group === g.k ? 'var(--accent)' : 'var(--surface)', color: group === g.k ? 'var(--accent-fg,#fff)' : 'var(--text-secondary)', borderColor: group === g.k ? 'var(--accent)' : 'var(--border)' }}>{g.l}</button>
          ))}
        </div>
      </div>

      <Card className="overflow-hidden">
        {loading ? <div className="p-8 text-center text-sm text-[var(--text-tertiary)]">Loading…</div>
          : filtered.length === 0 ? <EmptyState icon={FileSignature} title="No commitments" description="Approved LPOs and payroll appear here automatically; add subcontracts/recurring manually." />
          : grouped ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead><tr className="border-b border-[var(--border)] text-left text-[var(--text-tertiary)]"><th className="px-4 py-2.5 font-medium">{GROUPS.find(g => g.k === group)?.l}</th><th className="px-4 py-2.5 font-medium text-center">Items</th><th className="px-4 py-2.5 font-medium text-right">Committed (AED)</th></tr></thead>
                <tbody>
                  {grouped.map(g => (
                    <tr key={g.key} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-hover)]">
                      <td className="px-4 py-2.5 font-medium text-[var(--text-primary)]">{g.key}</td>
                      <td className="px-4 py-2.5 text-center tabular-nums">{g.count}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{money(g.amount)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot><tr className="border-t-2 border-[var(--border)] font-semibold"><td className="px-4 py-2.5">Total</td><td></td><td className="px-4 py-2.5 text-right tabular-nums">{money(total)}</td></tr></tfoot>
              </table>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead><tr className="border-b border-[var(--border)] text-left text-[var(--text-tertiary)]"><th className="px-4 py-2.5 font-medium">Source</th><th className="px-4 py-2.5 font-medium">Project</th><th className="px-4 py-2.5 font-medium">Vendor</th><th className="px-4 py-2.5 font-medium">Category</th><th className="px-4 py-2.5 font-medium">Expected pay</th><th className="px-4 py-2.5 font-medium text-right">Committed</th></tr></thead>
                <tbody>
                  {filtered.map(r => {
                    const s = SRC[r.source_type] || SRC.OTHER;
                    return (
                      <tr key={r.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-hover)]">
                        <td className="px-4 py-2.5"><span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: s.bg, color: s.text }}>{r.source_type}{r.manual ? ' ✎' : ''}</span></td>
                        <td className="px-4 py-2.5">{r.project_number}</td>
                        <td className="px-4 py-2.5 text-[var(--text-primary)]">{r.vendor_name}</td>
                        <td className="px-4 py-2.5 text-[var(--text-tertiary)]">{r.category}</td>
                        <td className="px-4 py-2.5">{r.expected_payment_date || '—'}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{money(r.amount)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot><tr className="border-t-2 border-[var(--border)] font-semibold"><td className="px-4 py-2.5" colSpan={5}>Total</td><td className="px-4 py-2.5 text-right tabular-nums">{money(total)}</td></tr></tfoot>
              </table>
            </div>
          )}
      </Card>

      {showAdd && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowAdd(false)}>
          <Card className="w-full max-w-md p-5" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3"><h3 className="text-sm font-semibold text-[var(--text-primary)]">Add commitment</h3><button onClick={() => setShowAdd(false)} className="cursor-pointer text-[var(--text-tertiary)]"><X size={16} /></button></div>
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs font-medium text-[var(--text-secondary)]">Type</label>
                  <select value={form.source_type} onChange={e => setForm({ ...form, source_type: e.target.value as CommitmentSource })} className="w-full mt-1 px-3 h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm">
                    <option value="SUBCONTRACT">Subcontract</option><option value="RECURRING">Recurring expense</option><option value="OTHER">Other</option>
                  </select></div>
                <div><label className="text-xs font-medium text-[var(--text-secondary)]">Amount (AED)</label>
                  <input type="number" step="any" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} className="w-full mt-1 px-3 h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm text-right" /></div>
              </div>
              <div><label className="text-xs font-medium text-[var(--text-secondary)]">Project</label>
                <select value={form.project_id} onChange={e => setForm({ ...form, project_id: e.target.value })} className="w-full mt-1 px-3 h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm">
                  <option value="">Overhead (no project)</option>{projects.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                </select></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs font-medium text-[var(--text-secondary)]">Vendor</label>
                  <input value={form.vendor_name} onChange={e => setForm({ ...form, vendor_name: e.target.value })} className="w-full mt-1 px-3 h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm" /></div>
                <div><label className="text-xs font-medium text-[var(--text-secondary)]">Expected pay date</label>
                  <input type="date" value={form.expected_payment_date} onChange={e => setForm({ ...form, expected_payment_date: e.target.value })} className="w-full mt-1 px-3 h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm" /></div>
              </div>
              <div className="flex justify-end gap-2 mt-1"><Button variant="secondary" size="sm" onClick={() => setShowAdd(false)}>Cancel</Button><Button variant="primary" size="sm" icon={Plus} isLoading={busy} disabled={!(Number(form.amount) > 0)} onClick={add}>Add</Button></div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
