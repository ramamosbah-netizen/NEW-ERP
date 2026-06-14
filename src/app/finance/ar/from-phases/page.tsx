'use client';

// ============================================================
// JEET ERP — Bill Completed Project Phases (AR)
// Pick a project, claim its completed (DONE) milestones at an
// amount each, and generate a PROGRESS client invoice. Advance
// recovery + retention are auto-applied from the contract terms,
// and the draft flows through the configurable INV approval
// workflow (accountant → Financial Director → GM).
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { invoiceService } from '@/services/invoiceService';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { FileText, X, ArrowRight, CheckSquare } from 'lucide-react';

type Phase = { id: string; title: string; amount: string; selected: boolean };
const money = (v: number) => new Intl.NumberFormat('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v || 0);

export default function BillPhasesPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<{ id: string; label: string; advance_pct: number; retention_pct: number }[]>([]);
  const [projectId, setProjectId] = useState('');
  const [phases, setPhases] = useState<Phase[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.from('projects').select('id, project_number, name, advance_pct, retention_pct')
      .order('project_number', { ascending: false })
      .then(({ data }) => setProjects((data || []).map((p: any) => ({
        id: p.id, label: `${p.project_number} — ${p.name}`,
        advance_pct: Number(p.advance_pct) || 0, retention_pct: Number(p.retention_pct) || 0,
      }))));
  }, []);

  const loadPhases = useCallback(async (pid: string) => {
    if (!pid) { setPhases([]); return; }
    setLoading(true);
    try {
      const ms = await invoiceService.getBillableMilestones(pid);
      setPhases(ms.map(m => ({ id: m.id, title: m.title, amount: '', selected: true })));
    } catch (err: any) { setError(err.message || 'Failed to load phases'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadPhases(projectId); }, [projectId, loadPhases]);

  const project = projects.find(p => p.id === projectId);
  const selectedLines = phases.filter(p => p.selected && Number(p.amount) > 0);
  const gross = selectedLines.reduce((s, p) => s + Number(p.amount), 0);
  const advance = gross * (project?.advance_pct || 0) / 100;
  const retention = gross * (project?.retention_pct || 0) / 100;
  const vat = gross * 0.05;
  const netDue = gross + vat - advance - retention;

  const update = (id: string, patch: Partial<Phase>) =>
    setPhases(prev => prev.map(p => p.id === id ? { ...p, ...patch } : p));

  const generate = async () => {
    if (selectedLines.length === 0) { setError('Select at least one phase and enter its claim amount.'); return; }
    setBusy(true);
    try {
      const inv = await invoiceService.generateProgressFromMilestones(
        projectId,
        selectedLines.map(p => ({ milestone_id: p.id, description: p.title, amount: Number(p.amount) })),
      );
      router.push(`/finance/ar/${inv.id}`);
    } catch (err: any) { setError(err.message || 'Failed to generate invoice'); setBusy(false); }
  };

  return (
    <div className="flex flex-col gap-5 pb-24">
      <PageHeader
        title="Bill Completed Phases"
        subtitle="Generate a progress invoice from a project's completed milestones — advance recovery and retention auto-applied"
        breadcrumbs={[{ label: 'Finance', href: '/finance' }, { label: 'Receivables', href: '/finance/ar' }, { label: 'Bill phases' }]}
        actions={<Button size="sm" variant="secondary" onClick={() => router.push('/finance/ar')}>Back to AR</Button>}
      />

      {error && (
        <div className="flex items-center justify-between gap-3 bg-[var(--status-danger-bg)] border border-[var(--status-danger-border)] rounded-lg p-3 text-xs text-[var(--status-danger-text)]">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="cursor-pointer"><X size={13} /></button>
        </div>
      )}

      <Card className="p-4">
        <label className="text-xs font-medium text-[var(--text-secondary)]">Project</label>
        <select value={projectId} onChange={e => setProjectId(e.target.value)}
          className="w-full mt-1 px-3 h-10 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm">
          <option value="">Select a project…</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
        </select>
        {project && (
          <p className="text-[11px] text-[var(--text-tertiary)] mt-2">
            Advance recovery {project.advance_pct}% · Retention {project.retention_pct}% · VAT 5% — applied automatically.
          </p>
        )}
      </Card>

      {projectId && (
        <Card className="overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--border)] text-sm font-semibold text-[var(--text-primary)]">
            Completed phases
          </div>
          {loading ? (
            <div className="p-8 text-center text-sm text-[var(--text-tertiary)]">Loading…</div>
          ) : phases.length === 0 ? (
            <EmptyState icon={CheckSquare} title="No completed phases" description="Mark project milestones as DONE to bill them here." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[var(--border)] text-left text-[var(--text-tertiary)]">
                    <th className="px-4 py-2.5 w-10"></th>
                    <th className="px-4 py-2.5 font-medium">Phase / milestone</th>
                    <th className="px-4 py-2.5 font-medium text-right w-48">Claim amount (AED)</th>
                  </tr>
                </thead>
                <tbody>
                  {phases.map(p => (
                    <tr key={p.id} className="border-b border-[var(--border)] last:border-0">
                      <td className="px-4 py-2">
                        <input type="checkbox" checked={p.selected} onChange={e => update(p.id, { selected: e.target.checked })} className="w-4 h-4" />
                      </td>
                      <td className="px-4 py-2 text-[var(--text-primary)]">{p.title}</td>
                      <td className="px-4 py-2 text-right">
                        <input type="number" min="0" step="any" value={p.amount} disabled={!p.selected}
                          onChange={e => update(p.id, { amount: e.target.value })}
                          className="w-40 px-2 h-8 rounded border border-[var(--border)] bg-[var(--surface)] text-right disabled:opacity-50" placeholder="0.00" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {selectedLines.length > 0 && (
        <Card className="p-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-xs">
            {[
              { l: 'Gross claim', v: gross },
              { l: `Advance recovery (${project?.advance_pct || 0}%)`, v: -advance },
              { l: `Retention (${project?.retention_pct || 0}%)`, v: -retention },
              { l: 'VAT (5%)', v: vat },
              { l: 'Net due', v: netDue, strong: true },
            ].map(k => (
              <div key={k.l}>
                <div className="text-[var(--text-tertiary)]">{k.l}</div>
                <div className={`tabular-nums mt-0.5 ${k.strong ? 'text-base font-semibold text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}`}>{money(k.v)}</div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="fixed bottom-0 left-0 right-0 bg-[var(--surface)] border-t border-[var(--border)] px-6 py-3 flex items-center justify-end gap-3 z-10">
        <span className="text-xs text-[var(--text-tertiary)]">{selectedLines.length} phase{selectedLines.length === 1 ? '' : 's'} · Net due {money(netDue)} AED</span>
        <Button variant="primary" size="sm" onClick={generate} isLoading={busy} disabled={selectedLines.length === 0}>
          Generate invoice <ArrowRight size={14} />
        </Button>
      </div>
    </div>
  );
}
