'use client';

// ============================================================
// JEET ERP — Platform Configuration Audit
// One inventory of every no-code config object (workflows, forms,
// templates, rules) with active/inactive, version and module
// coverage — to spot gaps and drift. Read-only; PDF + Excel export.
// ============================================================

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { exportTablePdf, exportTableExcel } from '@/lib/finance-export';
import { SlidersHorizontal, FileDown, Sheet, Check } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell, Legend } from 'recharts';

const PIE = ['var(--accent)', 'var(--status-info-text)', 'var(--status-success-text)', 'var(--status-warning-text)'];
type CfgType = 'Workflow' | 'Form' | 'Template' | 'Rule';
interface Cfg { type: CfgType; name: string; module: string; version: number | null; active: boolean; }

export default function ConfigurationAuditPage() {
  const [items, setItems] = useState<Cfg[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [wf, fm, tpl, rl] = await Promise.all([
          supabase.from('workflow_definitions').select('*'),
          supabase.from('form_definitions').select('*'),
          supabase.from('document_templates').select('*'),
          supabase.from('business_rules').select('*'),
        ]);
        const mod = (r: any) => r.module_key || r.module || '—';
        const nm = (r: any) => r.name || r.title || r.template_key || r.form_key || r.rule_key || r.key || '(unnamed)';
        const act = (r: any) => r.is_active !== false;
        const out: Cfg[] = [];
        (wf.data || []).forEach((r: any) => out.push({ type: 'Workflow', name: nm(r), module: mod(r), version: r.version ?? null, active: act(r) }));
        (fm.data || []).forEach((r: any) => out.push({ type: 'Form', name: nm(r), module: mod(r), version: r.version ?? null, active: act(r) }));
        (tpl.data || []).forEach((r: any) => out.push({ type: 'Template', name: nm(r), module: mod(r), version: r.version ?? null, active: act(r) }));
        (rl.data || []).forEach((r: any) => out.push({ type: 'Rule', name: nm(r), module: mod(r), version: r.version ?? null, active: act(r) }));
        setItems(out);
      } finally { setLoading(false); }
    })();
  }, []);

  const types: CfgType[] = ['Workflow', 'Form', 'Template', 'Rule'];
  const active = items.filter(i => i.active).length;
  const modules = useMemo(() => [...new Set(items.map(i => i.module).filter(m => m && m !== '—'))].sort(), [items]);

  const byType = useMemo(() => types.map(t => ({ name: t, value: items.filter(i => i.type === t).length })).filter(x => x.value > 0), [items]);
  const coverage = useMemo(() => modules.map(mod => {
    const row: any = { module: mod };
    types.forEach(t => { row[t] = items.filter(i => i.module === mod && i.type === t).length; });
    return row;
  }), [items, modules]);

  const exportCols = ['Type', 'Name', 'Module', 'Version', 'Status'];
  const exportRows = items.map(i => [i.type, i.name, i.module, i.version != null ? `v${i.version}` : '', i.active ? 'Active' : 'Inactive']);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Platform Configuration Audit"
        subtitle="Every no-code config object — active/inactive, version and module coverage"
        breadcrumbs={[{ label: 'Administration', href: '/admin/hub' }, { label: 'Configuration' }]}
        actions={items.length > 0 ? (
          <div className="flex gap-2">
            <Button variant="secondary" icon={FileDown} onClick={() => exportTablePdf({ title: 'Configuration Inventory', columns: exportCols, rows: exportRows, fileName: 'configuration-audit' })}>PDF</Button>
            <Button variant="secondary" icon={Sheet} onClick={() => exportTableExcel({ title: 'Configuration Inventory', columns: exportCols, rows: exportRows, fileName: 'configuration-audit' })}>Excel</Button>
          </div>
        ) : undefined}
      />

      {loading ? (
        <Card><div className="p-8 text-center text-sm text-[var(--text-tertiary)]">Loading…</div></Card>
      ) : items.length === 0 ? (
        <Card><EmptyState icon={SlidersHorizontal} title="No configuration objects" description="Workflows, forms, templates and rules will be inventoried here once configured." /></Card>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Config objects</div><div className="text-2xl font-bold mt-1">{items.length}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Active</div><div className="text-2xl font-bold mt-1" style={{ color: 'var(--status-success-text)' }}>{active}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Inactive</div><div className="text-2xl font-bold mt-1" style={{ color: items.length - active ? 'var(--text-tertiary)' : 'var(--text-primary)' }}>{items.length - active}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Modules covered</div><div className="text-2xl font-bold mt-1">{modules.length}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Object types</div><div className="text-2xl font-bold mt-1">{byType.length}<span className="text-sm font-normal text-[var(--text-tertiary)]">/4</span></div></Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <Card className="p-4">
              <div className="text-sm font-semibold text-[var(--text-primary)] mb-3">By object type</div>
              <div style={{ width: '100%', height: 240 }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={byType} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={80} fontSize={11}>{byType.map((e, i) => <Cell key={i} fill={PIE[i % PIE.length]} />)}</Pie>
                    <Legend wrapperStyle={{ fontSize: 11 }} /><Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card className="p-4">
              <div className="text-sm font-semibold text-[var(--text-primary)] mb-3">Config objects by module</div>
              <div style={{ width: '100%', height: 240 }}>
                <ResponsiveContainer>
                  <BarChart data={coverage}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="module" tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }} interval={0} angle={-15} textAnchor="end" height={50} />
                    <YAxis tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} allowDecimals={false} />
                    <Tooltip /><Legend wrapperStyle={{ fontSize: 11 }} />
                    {types.map((t, i) => <Bar key={t} dataKey={t} stackId="a" fill={PIE[i % PIE.length]} radius={i === types.length - 1 ? [4, 4, 0, 0] : undefined} />)}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          <Card className="p-0 overflow-x-auto">
            <div className="p-3 text-sm font-semibold text-[var(--text-primary)] border-b border-[var(--border)]">Module coverage <span className="text-xs font-normal text-[var(--text-tertiary)]">— config objects per module by type</span></div>
            <table className="w-full text-sm">
              <thead><tr className="border-b border-[var(--border)] text-left text-[var(--text-tertiary)] text-xs"><th className="p-3">Module</th>{types.map(t => <th key={t} className="p-3 text-center">{t}</th>)}</tr></thead>
              <tbody>
                {coverage.map((r: any) => (
                  <tr key={r.module} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-hover)]">
                    <td className="p-3 font-medium text-[var(--text-primary)]">{r.module}</td>
                    {types.map(t => <td key={t} className="p-3 text-center">{r[t] > 0 ? <span className="inline-flex items-center gap-1 text-xs" style={{ color: 'var(--status-success-text)' }}><Check size={13} />{r[t]}</span> : <span className="text-[var(--text-tertiary)]">·</span>}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <Card className="p-0 overflow-x-auto">
            <div className="p-3 text-sm font-semibold text-[var(--text-primary)] border-b border-[var(--border)]">Inventory ({items.length})</div>
            <table className="w-full text-sm">
              <thead><tr className="border-b border-[var(--border)] text-left text-[var(--text-tertiary)] text-xs"><th className="p-3">Type</th><th className="p-3">Name</th><th className="p-3">Module</th><th className="p-3">Version</th><th className="p-3">Status</th></tr></thead>
              <tbody>
                {items.map((i, idx) => (
                  <tr key={idx} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-hover)]">
                    <td className="p-3"><span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--surface-active)', color: 'var(--text-secondary)' }}>{i.type}</span></td>
                    <td className="p-3 font-medium text-[var(--text-primary)]">{i.name}</td>
                    <td className="p-3 text-xs text-[var(--text-secondary)]">{i.module}</td>
                    <td className="p-3 text-xs text-[var(--text-secondary)]">{i.version != null ? `v${i.version}` : '—'}</td>
                    <td className="p-3"><span className="text-xs px-2 py-0.5 rounded-full" style={{ background: i.active ? 'var(--status-success-bg)' : 'var(--surface-active)', color: i.active ? 'var(--status-success-text)' : 'var(--text-tertiary)' }}>{i.active ? 'Active' : 'Inactive'}</span></td>
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
