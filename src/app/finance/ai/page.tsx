'use client';

// ============================================================
// JEET ERP — Finance: AI Finance Agent (Page 12, Phase 1)
// Rule-based risk scoring + recommendations. LLM-ready.
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';
import aiFinanceService, { AiInsights } from '@/services/aiFinanceService';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Sparkles, RefreshCw, AlertOctagon, AlertTriangle, ArrowDownToLine, Clock, FolderSearch, Eye } from 'lucide-react';

const money = (v: number) => new Intl.NumberFormat('en-AE', { maximumFractionDigits: 0 }).format(v || 0);
const ACTION_ICON: Record<string, any> = { COLLECT: ArrowDownToLine, DELAY_PAYMENT: Clock, REVIEW_PROJECT: FolderSearch, REPLENISH: ArrowDownToLine, WATCH: Eye };

export default function AiFinancePage() {
  const [d, setD] = useState<AiInsights | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => { setLoading(true); try { setD(await aiFinanceService.getInsights()); } finally { setLoading(false); } }, []);
  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="p-8 text-sm text-[var(--text-tertiary)]">Analysing finances…</div>;
  if (!d) return <div className="p-8 text-sm text-[var(--text-tertiary)]">No data.</div>;

  const scoreColor = d.riskLabel === 'High' ? 'var(--status-danger-text)' : d.riskLabel === 'Medium' ? 'var(--status-warning-text)' : 'var(--status-success-text)';

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="AI Finance Agent"
        subtitle="Predictive risk scoring and recommendations across cash, collections, payments and projects"
        breadcrumbs={[{ label: 'Finance', href: '/finance' }, { label: 'AI Agent' }]}
        actions={<button onClick={load} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-[var(--border)] text-xs text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] cursor-pointer"><RefreshCw size={13} /> Re-analyse</button>}
      />

      <div className="grid lg:grid-cols-3 gap-5">
        {/* Risk score */}
        <Card className="p-5 flex flex-col items-center justify-center text-center">
          <div className="text-[11px] uppercase tracking-wide text-[var(--text-tertiary)] mb-2 flex items-center gap-1.5"><Sparkles size={13} /> Financial Risk Score</div>
          <div className="text-5xl font-bold tabular-nums" style={{ color: scoreColor }}>{d.riskScore}</div>
          <div className="text-sm font-semibold mt-1" style={{ color: scoreColor }}>{d.riskLabel} risk</div>
          <div className="w-full h-2 rounded-full bg-[var(--surface-active)] mt-3 overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${d.riskScore}%`, background: scoreColor }} />
          </div>
          <div className="text-[11px] text-[var(--text-tertiary)] mt-3">Forecast cash {money(d.kpis.forecastCash)} · Net profit {money(d.kpis.netProfit)} AED</div>
        </Card>

        {/* Predicted risks */}
        <Card className="p-4 lg:col-span-2">
          <div className="text-sm font-semibold text-[var(--text-primary)] mb-3">Predicted risks</div>
          {d.risks.length === 0 ? <div className="text-xs text-[var(--text-tertiary)]">No significant risks detected.</div> : (
            <div className="flex flex-col gap-2">
              {d.risks.map((r, i) => (
                <div key={i} className="flex items-start gap-2 rounded-lg p-2.5 text-xs border"
                  style={{ background: r.level === 'danger' ? 'var(--status-danger-bg)' : 'var(--status-warning-bg)', borderColor: r.level === 'danger' ? 'var(--status-danger-border)' : 'var(--status-warning-border)', color: r.level === 'danger' ? 'var(--status-danger-text)' : 'var(--status-warning-text)' }}>
                  {r.level === 'danger' ? <AlertOctagon size={14} className="mt-0.5 shrink-0" /> : <AlertTriangle size={14} className="mt-0.5 shrink-0" />}
                  <div><div className="font-semibold">{r.title}</div><div className="opacity-90">{r.detail}</div></div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Recommendations */}
      <Card className="p-4">
        <div className="text-sm font-semibold text-[var(--text-primary)] mb-3">AI recommendations</div>
        <div className="grid md:grid-cols-2 gap-3">
          {d.recommendations.map((rec, i) => {
            const Icon = ACTION_ICON[rec.action] || Eye;
            return (
              <div key={i} className="flex items-start gap-3 rounded-lg border border-[var(--border)] p-3">
                <div className="mt-0.5 shrink-0 text-[var(--accent)]"><Icon size={16} /></div>
                <div className="flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-medium text-[var(--text-primary)]">{rec.title}</div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--surface-active)] text-[var(--text-secondary)]">{Math.round(rec.confidence * 100)}% conf.</span>
                  </div>
                  <div className="text-xs text-[var(--text-secondary)] mt-0.5">{rec.detail}</div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <p className="text-[11px] text-[var(--text-tertiary)]">Phase 1 uses deterministic rules over your live finance data with confidence scores. The same interface can be backed by an LLM (e.g. Claude) for narrative analysis in a later phase.</p>
    </div>
  );
}
