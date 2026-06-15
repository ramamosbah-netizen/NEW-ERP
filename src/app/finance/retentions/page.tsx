'use client';

// ============================================================
// JEET ERP — Finance: Retention Management (Page 5)
// Receivable (held by clients on our invoices) and Payable (withheld
// from subcontractors), with release schedule.
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import retentionService, { RetentionRow } from '@/services/retentionService';
import supplierRetentionService, { SupplierRetentionRow } from '@/services/supplierRetentionService';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ShieldCheck, AlertTriangle, FileText, FileSpreadsheet, Plus, X } from 'lucide-react';
import { exportTablePdf, exportTableExcel, ExportTable } from '@/lib/finance-export';

const money = (v: number) => new Intl.NumberFormat('en-AE', { maximumFractionDigits: 0 }).format(v || 0);
const fmtDate = (d?: string | null) => d ? new Date(d).toLocaleDateString('en-AE', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const STATUS: Record<string, { label: string; bg: string; text: string }> = {
  RELEASED: { label: 'Released', bg: 'var(--status-success-bg)', text: 'var(--status-success-text)' },
  OVERDUE: { label: 'Overdue', bg: 'var(--status-danger-bg)', text: 'var(--status-danger-text)' },
  DUE: { label: 'Due this month', bg: 'var(--status-warning-bg)', text: 'var(--status-warning-text)' },
  SCHEDULED: { label: 'Scheduled', bg: 'var(--status-neutral-bg)', text: 'var(--status-neutral-text)' },
};

export default function RetentionsPage() {
  const [mode, setMode] = useState<'AR' | 'AP'>('AR');
  const [arRows, setArRows] = useState<RetentionRow[]>([]);
  const [apRows, setApRows] = useState<SupplierRetentionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Add retention-payable modal
  const [showAdd, setShowAdd] = useState(false);
  const [subs, setSubs] = useState<{ id: string; name: string }[]>([]);
  const [projects, setProjects] = useState<{ id: string; label: string }[]>([]);
  const [form, setForm] = useState({ supplier_id: '', project_id: '', amount: '', expected_release_date: '' });

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [ar, ap] = await Promise.all([retentionService.list(), supplierRetentionService.list()]);
      setArRows(ar); setApRows(ap); setError(null);
    } catch (e: any) { setError(e.message || 'Failed to load retentions'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    supabase.from('pricing_suppliers').select('id, name, supplier_type').in('supplier_type', ['SUBCONTRACTOR', 'BOTH']).eq('is_active', true).order('name')
      .then(({ data }) => setSubs((data || []).map((s: any) => ({ id: s.id, name: s.name }))));
    supabase.from('projects').select('id, project_number, name').order('project_number', { ascending: false })
      .then(({ data }) => setProjects((data || []).map((p: any) => ({ id: p.id, label: `${p.project_number} — ${p.name}` }))));
  }, []);

  const isAR = mode === 'AR';
  const rows: any[] = isAR ? arRows : apRows;
  const open = rows.filter(r => r.status !== 'RELEASED');
  const totalHeld = open.reduce((s, r) => s + r.net, 0);
  const dueThisMonth = open.filter(r => r.status === 'DUE').reduce((s, r) => s + r.net, 0);
  const overdue = open.filter(r => r.status === 'OVERDUE').reduce((s, r) => s + r.net, 0);

  const table = (): ExportTable => isAR ? {
    title: 'Retention Receivable', subtitle: 'JEET INTECH L.L.C', fileName: 'retention_receivable',
    columns: ['Invoice', 'Project', 'Client', 'Held', 'Released', 'Net', 'Expected release', 'Status'],
    rows: arRows.map(r => [r.invoice_number, r.project_number, r.client_name, r.held, r.released, r.net, r.expected_release_date || '', r.status]),
  } : {
    title: 'Retention Payable', subtitle: 'JEET INTECH L.L.C', fileName: 'retention_payable',
    columns: ['Subcontractor', 'Project', 'Held', 'Released', 'Net', 'Expected release', 'Status'],
    rows: apRows.map(r => [r.supplier_name, r.project_number, r.held, r.released, r.net, r.expected_release_date || '', r.status]),
  };

  const addHold = async () => {
    const sub = subs.find(s => s.id === form.supplier_id);
    setBusy(true);
    try {
      await supplierRetentionService.addHold({
        supplier_id: form.supplier_id || null, supplier_name: sub?.name || 'Subcontractor',
        project_id: form.project_id || null, amount: Number(form.amount), expected_release_date: form.expected_release_date || null,
      });
      setShowAdd(false); setForm({ supplier_id: '', project_id: '', amount: '', expected_release_date: '' });
      await load();
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  };

  const release = async (r: SupplierRetentionRow) => {
    if (!window.confirm(`Release ${money(r.net)} AED retention to ${r.supplier_name}?`)) return;
    try { await supplierRetentionService.release({ supplier_id: r.supplier_id, supplier_name: r.supplier_name, project_id: r.project_id, amount: r.net }); await load(); }
    catch (e: any) { setError(e.message); }
  };

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Retention Management"
        subtitle="Retention receivable (clients) and payable (subcontractors) — release schedule and forecast"
        breadcrumbs={[{ label: 'Finance', href: '/finance' }, { label: 'Retentions' }]}
        actions={
          <div className="flex gap-2">
            {!isAR && <Button size="sm" variant="primary" icon={Plus} onClick={() => setShowAdd(true)}>Hold retention</Button>}
            <Button size="sm" variant="secondary" icon={FileText} onClick={() => exportTablePdf(table())} disabled={rows.length === 0}>PDF</Button>
            <Button size="sm" variant="secondary" icon={FileSpreadsheet} onClick={() => exportTableExcel(table())} disabled={rows.length === 0}>Excel</Button>
          </div>
        }
      />

      {error && <div className="flex items-center justify-between gap-3 bg-[var(--status-danger-bg)] border border-[var(--status-danger-border)] rounded-lg p-3 text-xs text-[var(--status-danger-text)]"><span>{error}</span><button onClick={() => setError(null)} className="cursor-pointer"><X size={13} /></button></div>}

      <div className="flex gap-1.5">
        {[{ k: 'AR', l: 'Receivable (clients)' }, { k: 'AP', l: 'Payable (subcontractors)' }].map(t => (
          <button key={t.k} onClick={() => setMode(t.k as 'AR' | 'AP')} className="px-3 py-1.5 rounded-md text-xs font-medium border cursor-pointer"
            style={{ background: mode === t.k ? 'var(--accent)' : 'var(--surface)', color: mode === t.k ? 'var(--accent-fg,#fff)' : 'var(--text-secondary)', borderColor: mode === t.k ? 'var(--accent)' : 'var(--border)' }}>{t.l}</button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card className="p-3.5"><div className="text-[11px] uppercase tracking-wide text-[var(--text-tertiary)]">Total retention {isAR ? 'receivable' : 'payable'}</div><div className="text-lg font-semibold mt-1 tabular-nums">{money(totalHeld)} AED</div></Card>
        <Card className="p-3.5"><div className="text-[11px] uppercase tracking-wide text-[var(--text-tertiary)]">Due this month</div><div className="text-lg font-semibold mt-1 tabular-nums" style={{ color: dueThisMonth > 0 ? 'var(--status-warning-text)' : 'var(--text-primary)' }}>{money(dueThisMonth)} AED</div></Card>
        <Card className="p-3.5"><div className="text-[11px] uppercase tracking-wide text-[var(--text-tertiary)]">Overdue</div><div className="text-lg font-semibold mt-1 tabular-nums" style={{ color: overdue > 0 ? 'var(--status-danger-text)' : 'var(--text-primary)' }}>{money(overdue)} AED</div></Card>
      </div>

      <Card className="overflow-hidden">
        {loading ? <div className="p-8 text-center text-sm text-[var(--text-tertiary)]">Loading…</div>
          : rows.length === 0 ? <EmptyState icon={ShieldCheck} title={`No retention ${isAR ? 'receivable' : 'payable'}`} description={isAR ? 'Retention held on approved client invoices appears here.' : 'Hold retention from a subcontractor to track it here.'} />
          : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead><tr className="border-b border-[var(--border)] text-left text-[var(--text-tertiary)]">
                  <th className="px-4 py-2.5 font-medium">{isAR ? 'Invoice' : 'Subcontractor'}</th><th className="px-4 py-2.5 font-medium">{isAR ? 'Client' : 'Project'}</th>
                  <th className="px-4 py-2.5 font-medium text-right">Held</th><th className="px-4 py-2.5 font-medium text-right">Released</th><th className="px-4 py-2.5 font-medium text-right">Net</th>
                  <th className="px-4 py-2.5 font-medium">Expected release</th><th className="px-4 py-2.5 font-medium">Status</th>{!isAR && <th className="px-4 py-2.5 font-medium text-right">Action</th>}
                </tr></thead>
                <tbody>
                  {isAR ? arRows.map(r => {
                    const st = STATUS[r.status];
                    return (
                      <tr key={r.invoice_id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-hover)]">
                        <td className="px-4 py-2.5 font-mono text-[var(--text-primary)]">{r.invoice_number}<div className="text-[var(--text-tertiary)] font-sans">{r.project_number}</div></td>
                        <td className="px-4 py-2.5 text-[var(--text-secondary)]">{r.client_name}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{money(r.held)}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-[var(--status-success-text)]">{money(r.released)}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums font-medium">{money(r.net)}</td>
                        <td className="px-4 py-2.5">{r.status === 'OVERDUE' && <AlertTriangle size={11} className="inline mr-1 text-[var(--status-danger-text)]" />}{fmtDate(r.expected_release_date)}</td>
                        <td className="px-4 py-2.5"><span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: st.bg, color: st.text }}>{st.label}</span></td>
                      </tr>
                    );
                  }) : apRows.map(r => {
                    const st = STATUS[r.status];
                    return (
                      <tr key={r.key} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-hover)]">
                        <td className="px-4 py-2.5 font-medium text-[var(--text-primary)]">{r.supplier_name}</td>
                        <td className="px-4 py-2.5 text-[var(--text-secondary)]">{r.project_number}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{money(r.held)}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-[var(--status-success-text)]">{money(r.released)}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums font-medium">{money(r.net)}</td>
                        <td className="px-4 py-2.5">{r.status === 'OVERDUE' && <AlertTriangle size={11} className="inline mr-1 text-[var(--status-danger-text)]" />}{fmtDate(r.expected_release_date)}</td>
                        <td className="px-4 py-2.5"><span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: st.bg, color: st.text }}>{st.label}</span></td>
                        <td className="px-4 py-2.5 text-right">{r.net > 0.01 && <button onClick={() => release(r)} className="px-2 py-1 rounded border border-[var(--border)] text-[10px] text-[var(--status-success-text)] hover:bg-[var(--surface-hover)] cursor-pointer">Release</button>}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot><tr className="border-t-2 border-[var(--border)] font-semibold"><td className="px-4 py-2.5" colSpan={4}>Net retention {isAR ? 'receivable' : 'payable'}</td><td className="px-4 py-2.5 text-right tabular-nums">{money(totalHeld)}</td><td colSpan={isAR ? 2 : 3}></td></tr></tfoot>
              </table>
            </div>
          )}
      </Card>

      <p className="text-[11px] text-[var(--text-tertiary)]">
        <strong>Receivable</strong> = retention clients hold on our invoices (from the retention ledger).
        <strong> Payable</strong> = retention we withhold from subcontractors; hold and release it here.
      </p>

      {showAdd && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowAdd(false)}>
          <Card className="w-full max-w-md p-5" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3"><h3 className="text-sm font-semibold text-[var(--text-primary)]">Hold subcontractor retention</h3><button onClick={() => setShowAdd(false)} className="cursor-pointer text-[var(--text-tertiary)]"><X size={16} /></button></div>
            <div className="flex flex-col gap-3">
              <div><label className="text-xs font-medium text-[var(--text-secondary)]">Subcontractor *</label>
                <select value={form.supplier_id} onChange={e => setForm({ ...form, supplier_id: e.target.value })} className="w-full mt-1 px-3 h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm">
                  <option value="">Select…</option>{subs.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select></div>
              <div><label className="text-xs font-medium text-[var(--text-secondary)]">Project</label>
                <select value={form.project_id} onChange={e => setForm({ ...form, project_id: e.target.value })} className="w-full mt-1 px-3 h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm">
                  <option value="">—</option>{projects.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                </select></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs font-medium text-[var(--text-secondary)]">Amount (AED) *</label><input type="number" step="any" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} className="w-full mt-1 px-3 h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm text-right" /></div>
                <div><label className="text-xs font-medium text-[var(--text-secondary)]">Expected release</label><input type="date" value={form.expected_release_date} onChange={e => setForm({ ...form, expected_release_date: e.target.value })} className="w-full mt-1 px-3 h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm" /></div>
              </div>
              <div className="flex justify-end gap-2 mt-1"><Button variant="secondary" size="sm" onClick={() => setShowAdd(false)}>Cancel</Button><Button variant="primary" size="sm" isLoading={busy} disabled={!form.supplier_id || !(Number(form.amount) > 0)} onClick={addHold}>Hold</Button></div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
