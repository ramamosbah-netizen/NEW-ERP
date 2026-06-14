'use client';

// ============================================================
// JEET ERP — Finance: Project Cash Flow (Page 7)
// ============================================================

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import projectCashFlowService, { ProjectCashFlow } from '@/services/projectCashFlowService';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { TrendingUp } from 'lucide-react';
import { ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid } from 'recharts';

const money = (v: number) => new Intl.NumberFormat('en-AE', { maximumFractionDigits: 0 }).format(v || 0);

export default function ProjectCashFlowPage() {
  const [projects, setProjects] = useState<{ id: string; label: string }[]>([]);
  const [projId, setProjId] = useState('');
  const [data, setData] = useState<ProjectCashFlow | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.from('projects').select('id, project_number, name').order('project_number', { ascending: false })
      .then(({ data }) => setProjects((data || []).map((p: any) => ({ id: p.id, label: `${p.project_number} — ${p.name}` }))));
  }, []);

  useEffect(() => {
    if (!projId) { setData(null); return; }
    setLoading(true);
    projectCashFlowService.getProjectCashFlow(projId).then(setData).finally(() => setLoading(false));
  }, [projId]);

  const k = data?.kpis;
  const kpis = k ? [
    { label: 'Contract value', value: k.contractValue },
    { label: 'Billed', value: k.billed },
    { label: 'Collected', value: k.collected },
    { label: 'Outstanding', value: k.outstanding, warn: k.outstanding > 0 },
    { label: 'Actual cost', value: k.actualCost },
    { label: 'Forecast cost', value: k.forecastCost },
    { label: 'Net cash position', value: k.netCashPosition, warn: k.netCashPosition < 0 },
    { label: 'Project profit', value: k.projectProfit, warn: k.projectProfit < 0 },
  ] : [];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Project Cash Flow"
        subtitle="Monthly cash in vs out and cumulative position, per project"
        breadcrumbs={[{ label: 'Finance', href: '/finance' }, { label: 'Project Cash Flow' }]}
      />

      <Card className="p-4">
        <label className="text-xs font-medium text-[var(--text-secondary)]">Project</label>
        <select value={projId} onChange={e => setProjId(e.target.value)}
          className="w-full md:max-w-md mt-1 px-3 h-10 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm">
          <option value="">Select a project…</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
        </select>
      </Card>

      {!projId ? (
        <Card><EmptyState icon={TrendingUp} title="Select a project" description="Choose a project to see its cash-in, cash-out and cumulative position." /></Card>
      ) : loading ? (
        <Card><div className="p-8 text-center text-sm text-[var(--text-tertiary)]">Computing cash flow…</div></Card>
      ) : data ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {kpis.map(kp => (
              <Card key={kp.label} className="p-3">
                <div className="text-[11px] uppercase tracking-wide text-[var(--text-tertiary)]">{kp.label}</div>
                <div className="text-base font-semibold mt-1 tabular-nums" style={{ color: (kp as any).warn ? 'var(--status-danger-text)' : 'var(--text-primary)' }}>{money(kp.value)}</div>
              </Card>
            ))}
          </div>

          <Card className="p-4">
            <div className="text-sm font-semibold text-[var(--text-primary)] mb-3">Monthly cash in / out + cumulative position</div>
            {data.monthly.length === 0 ? (
              <div className="p-6 text-center text-xs text-[var(--text-tertiary)]">No recorded receipts or payments for this project yet.</div>
            ) : (
              <div style={{ width: '100%', height: 320 }}>
                <ResponsiveContainer>
                  <ComposedChart data={data.monthly} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} />
                    <YAxis tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} tickFormatter={(v) => money(v)} width={70} />
                    <Tooltip formatter={(v: any) => `${money(v)} AED`} contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="cashIn" name="Cash in" fill="#22c55e" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="cashOut" name="Cash out" fill="#ef4444" radius={[3, 3, 0, 0]} />
                    <Line type="monotone" dataKey="cumulative" name="Cumulative" stroke="#2563eb" strokeWidth={2} dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>
        </>
      ) : null}
    </div>
  );
}
