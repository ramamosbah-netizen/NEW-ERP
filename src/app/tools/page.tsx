'use client';

// ============================================================
// JEET ERP — Tools & Equipment Register
// First UI over the existing tools tables: inventory by category,
// status, condition and custody. Read-only; PDF + Excel export.
// ============================================================

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { exportTablePdf, exportTableExcel } from '@/lib/finance-export';
import { LayoutGrid, FileDown, Sheet, Search } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell, Legend } from 'recharts';

const fmtAED = (n: number) => 'AED ' + (n || 0).toLocaleString('en-AE', { maximumFractionDigits: 0 });
const PIE = ['var(--accent)', 'var(--status-info-text)', 'var(--status-success-text)', 'var(--status-warning-text)', 'var(--status-danger-text)', '#a855f7'];
const STATUS_COLOR: Record<string, string> = { AVAILABLE: 'var(--status-success-text)', ISSUED: 'var(--status-info-text)', UNDER_MAINTENANCE: 'var(--status-warning-text)', UNDER_CALIBRATION: 'var(--status-warning-text)', LOST: 'var(--status-danger-text)', RETIRED: 'var(--text-tertiary)' };
const COND_COLOR: Record<string, string> = { GOOD: 'var(--status-success-text)', FAIR: 'var(--status-warning-text)', NEEDS_REPAIR: 'var(--status-danger-text)' };

interface Tool { id: string; tool_number: string; name: string; category: string; brand_model: string | null; status: string; condition: string; purchase_cost: number | null; current_custodian_id: string | null; current_location_id: string | null; requires_calibration: boolean; }

export default function ToolsRegisterPage() {
  const [tools, setTools] = useState<Tool[]>([]);
  const [custMap, setCustMap] = useState<Map<string, string>>(new Map());
  const [locMap, setLocMap] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.from('tools').select('id, tool_number, name, category, brand_model, status, condition, purchase_cost, current_custodian_id, current_location_id, requires_calibration').eq('is_active', true).order('tool_number');
        const r = (data || []) as Tool[];
        setTools(r);
        const cids = [...new Set(r.map(x => x.current_custodian_id).filter(Boolean))] as string[];
        const lids = [...new Set(r.map(x => x.current_location_id).filter(Boolean))] as string[];
        if (cids.length) { const { data: e } = await supabase.from('employees').select('id, full_name_en').in('id', cids); setCustMap(new Map((e || []).map((x: any) => [x.id, x.full_name_en]))); }
        if (lids.length) { const { data: l } = await supabase.from('stock_locations').select('id, name').in('id', lids); setLocMap(new Map((l || []).map((x: any) => [x.id, x.name]))); }
      } finally { setLoading(false); }
    })();
  }, []);

  const available = tools.filter(t => t.status === 'AVAILABLE').length;
  const issued = tools.filter(t => t.status === 'ISSUED').length;
  const servicing = tools.filter(t => t.status === 'UNDER_MAINTENANCE' || t.status === 'UNDER_CALIBRATION').length;
  const totalValue = tools.reduce((a, t) => a + (t.purchase_cost || 0), 0);

  const byCategory = useMemo(() => { const m = new Map<string, number>(); tools.forEach(t => m.set(t.category, (m.get(t.category) || 0) + 1)); return [...m.entries()].map(([name, value]) => ({ name: name.replace(/_/g, ' '), value })).sort((a, b) => b.value - a.value); }, [tools]);
  const byStatus = useMemo(() => { const m = new Map<string, number>(); tools.forEach(t => m.set(t.status, (m.get(t.status) || 0) + 1)); return [...m.entries()].map(([name, value]) => ({ name: name.replace(/_/g, ' '), value, raw: name })); }, [tools]);
  const byCondition = useMemo(() => { const m = new Map<string, number>(); tools.forEach(t => m.set(t.condition, (m.get(t.condition) || 0) + 1)); return [...m.entries()].map(([name, value]) => ({ name: name.replace(/_/g, ' '), value, raw: name })); }, [tools]);

  const filtered = useMemo(() => tools.filter(t => {
    if (statusFilter && t.status !== statusFilter) return false;
    if (q) { const s = q.toLowerCase(); return t.tool_number.toLowerCase().includes(s) || t.name.toLowerCase().includes(s) || (t.brand_model || '').toLowerCase().includes(s); }
    return true;
  }), [tools, q, statusFilter]);

  const exportCols = ['Tool #', 'Name', 'Category', 'Brand/Model', 'Status', 'Condition', 'Custodian', 'Location', 'Cost'];
  const exportRows = filtered.map(t => [t.tool_number, t.name, t.category, t.brand_model || '', t.status, t.condition, t.current_custodian_id ? custMap.get(t.current_custodian_id) || '' : '', t.current_location_id ? locMap.get(t.current_location_id) || '' : '', t.purchase_cost || 0]);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Tools & Equipment Register"
        subtitle="Inventory by category, status, condition and custody"
        breadcrumbs={[{ label: 'Fleet & Assets', href: '/fleet/hub' }, { label: 'Tools' }]}
        actions={tools.length > 0 ? (
          <div className="flex gap-2">
            <Button variant="secondary" icon={FileDown} onClick={() => exportTablePdf({ title: 'Tools & Equipment', columns: exportCols, rows: exportRows, fileName: 'tools-register' })}>PDF</Button>
            <Button variant="secondary" icon={Sheet} onClick={() => exportTableExcel({ title: 'Tools & Equipment', columns: exportCols, rows: exportRows, fileName: 'tools-register' })}>Excel</Button>
          </div>
        ) : undefined}
      />

      {loading ? (
        <Card><div className="p-8 text-center text-sm text-[var(--text-tertiary)]">Loading…</div></Card>
      ) : tools.length === 0 ? (
        <Card><EmptyState icon={LayoutGrid} title="No tools" description="Tools and equipment — power tools, test instruments, access equipment — will be listed here once added." /></Card>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Tools</div><div className="text-2xl font-bold mt-1">{tools.length}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Available</div><div className="text-2xl font-bold mt-1" style={{ color: 'var(--status-success-text)' }}>{available}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Issued</div><div className="text-2xl font-bold mt-1" style={{ color: 'var(--status-info-text)' }}>{issued}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Servicing</div><div className="text-2xl font-bold mt-1" style={{ color: servicing ? 'var(--status-warning-text)' : 'var(--text-primary)' }}>{servicing}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Register value</div><div className="text-xl font-bold mt-1">{fmtAED(totalValue)}</div></Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <Card className="p-4">
              <div className="text-sm font-semibold text-[var(--text-primary)] mb-3">By category</div>
              <div style={{ width: '100%', height: 220 }}>
                <ResponsiveContainer>
                  <BarChart data={byCategory} layout="vertical">
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
              <div className="text-sm font-semibold text-[var(--text-primary)] mb-3">By status</div>
              <div style={{ width: '100%', height: 220 }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={byStatus} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75} fontSize={10}>{byStatus.map((e, i) => <Cell key={i} fill={STATUS_COLOR[e.raw] || PIE[i % PIE.length]} />)}</Pie>
                    <Legend wrapperStyle={{ fontSize: 10 }} /><Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card className="p-4">
              <div className="text-sm font-semibold text-[var(--text-primary)] mb-3">By condition</div>
              <div style={{ width: '100%', height: 220 }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={byCondition} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75} fontSize={10}>{byCondition.map((e, i) => <Cell key={i} fill={COND_COLOR[e.raw] || PIE[i % PIE.length]} />)}</Pie>
                    <Legend wrapperStyle={{ fontSize: 10 }} /><Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          <Card className="p-3 flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[180px]">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
              <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search tools…" className="w-full h-9 pl-8 pr-3 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm" />
            </div>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="h-9 px-3 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm">
              <option value="">All statuses</option>
              {byStatus.map(s => <option key={s.raw} value={s.raw}>{s.name}</option>)}
            </select>
          </Card>

          <Card className="p-0 overflow-x-auto">
            <div className="p-3 text-sm font-semibold text-[var(--text-primary)] border-b border-[var(--border)]">Tools ({filtered.length})</div>
            <table className="w-full text-sm">
              <thead><tr className="border-b border-[var(--border)] text-left text-[var(--text-tertiary)] text-xs"><th className="p-3">Tool #</th><th className="p-3">Name</th><th className="p-3">Category</th><th className="p-3">Custodian</th><th className="p-3">Condition</th><th className="p-3">Status</th></tr></thead>
              <tbody>
                {filtered.map(t => (
                  <tr key={t.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-hover)]">
                    <td className="p-3 font-medium text-[var(--text-primary)]">{t.tool_number}</td>
                    <td className="p-3 text-[var(--text-secondary)]">{t.name}{t.brand_model ? <span className="text-[11px] text-[var(--text-tertiary)]"> · {t.brand_model}</span> : ''}{t.requires_calibration ? <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'var(--status-info-bg)', color: 'var(--status-info-text)' }}>CAL</span> : ''}</td>
                    <td className="p-3 text-xs text-[var(--text-secondary)]">{t.category?.replace(/_/g, ' ')}</td>
                    <td className="p-3 text-xs text-[var(--text-secondary)]">{t.current_custodian_id ? custMap.get(t.current_custodian_id) || '—' : t.current_location_id ? locMap.get(t.current_location_id) || '—' : '—'}</td>
                    <td className="p-3"><span className="text-xs font-medium" style={{ color: COND_COLOR[t.condition] || 'var(--text-secondary)' }}>{t.condition?.replace(/_/g, ' ')}</span></td>
                    <td className="p-3"><span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--surface-active)', color: STATUS_COLOR[t.status] || 'var(--text-secondary)' }}>{t.status?.replace(/_/g, ' ')}</span></td>
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
