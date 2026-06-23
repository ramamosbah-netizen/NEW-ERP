// AURA 0.2 — Executive Intelligence (Phase 2D)
// One surface for the manager: Risk (real-time) · Forecast (time-series) ·
// Recommendations (actions). Server component, company-scoped (active-company
// cookie), read-only — all derived from the event ledger.

import { cookies } from 'next/headers';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { KPICard } from '@/components/ui/KPICard';
import { EmptyState } from '@/components/ui/EmptyState';
import { ShieldAlert, AlertTriangle, TrendingUp, Lightbulb, ShieldCheck } from 'lucide-react';
import ProcessButton from '../ProcessButton';
import { getExecSummary } from '@/lib/intelligence/risk-query';
import type { RiskSeverity, RecPriority } from '@/types/intelligence.types';

export const dynamic = 'force-dynamic';

const SEV: Record<RiskSeverity, string> = {
  CRITICAL: 'bg-[var(--status-danger-bg)] text-[var(--status-danger-text)] border-[var(--status-danger-border)]',
  HIGH: 'bg-[var(--status-warning-bg)] text-[var(--status-warning-text)] border-[var(--status-warning-border)]',
  MEDIUM: 'bg-[var(--status-info-bg)] text-[var(--status-info-text)] border-[var(--status-info-border)]',
  LOW: 'bg-[var(--status-neutral-bg)] text-[var(--status-neutral-text)] border-[var(--status-neutral-border)]',
};
const PRIO: Record<RecPriority, string> = {
  HIGH: 'bg-[var(--status-danger-bg)] text-[var(--status-danger-text)] border-[var(--status-danger-border)]',
  MEDIUM: 'bg-[var(--status-warning-bg)] text-[var(--status-warning-text)] border-[var(--status-warning-border)]',
  LOW: 'bg-[var(--status-neutral-bg)] text-[var(--status-neutral-text)] border-[var(--status-neutral-border)]',
};
const FCAST_LABEL: Record<string, string> = {
  SCHEDULE_DELAY_FORECAST: 'Schedule',
  BUDGET_OVERRUN_FORECAST: 'Budget',
  CASHFLOW_RISK_FORECAST: 'Cashflow',
};

function Pill({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[0.625rem] font-medium border select-none ${className}`}>
      {children}
    </span>
  );
}

export default async function ExecIntelligencePage() {
  const companyId = (await cookies()).get('erp-active-company')?.value ?? null;

  let data;
  try {
    data = await getExecSummary(companyId);
  } catch (e: any) {
    return (
      <div>
        <PageHeader title="Executive Intelligence" subtitle="Risk · Forecast · Recommendations" />
        <Card title="Setup required" icon={AlertTriangle}>
          <p className="text-sm text-[var(--text-muted)] leading-relaxed">
            The intelligence tables are not reachable yet. Apply the migrations and ensure
            <code className="font-mono text-[var(--text-secondary)]"> SUPABASE_SERVICE_ROLE_KEY</code> is set.
          </p>
          <p className="text-xs text-[var(--text-muted)] mt-2 opacity-70">{e?.message ?? String(e)}</p>
        </Card>
      </div>
    );
  }

  const { counts, alerts, forecasts, recommendations } = data;

  return (
    <div>
      <PageHeader
        title="Executive Intelligence"
        subtitle="Risk · Forecast · Recommendations — derived from the event ledger, read-only."
        actions={<ProcessButton />}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <KPICard title="Critical risks" value={counts.critical} icon={AlertTriangle} borderAccent={counts.critical ? 'danger' : 'none'} />
        <KPICard title="High risks" value={counts.high} icon={ShieldAlert} borderAccent={counts.high ? 'warning' : 'none'} />
        <KPICard title="Forecasts" value={counts.forecasts} icon={TrendingUp} />
        <KPICard title="Open recommendations" value={counts.recommendations} icon={Lightbulb} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* ── Risk (real-time) ── */}
        <Card title="Risk" subtitle="Active alerts" icon={ShieldAlert} borderAccent="danger">
          {alerts.length === 0 ? (
            <EmptyState title="No active risks" description="Nothing flagged for the active company." icon={ShieldCheck} />
          ) : (
            <ul className="flex flex-col divide-y divide-[var(--border-color)] -my-1">
              {alerts.map((a) => (
                <li key={a.id} className="py-2.5 flex items-start gap-2">
                  <Pill className={SEV[a.severity]}>{a.severity} · {a.score}</Pill>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[var(--text-primary)] leading-snug">{a.title}</p>
                    <p className="text-[0.625rem] text-[var(--text-muted)] mt-0.5 opacity-70">{a.risk_domain} · {a.source_event_type}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* ── Forecast (time-series) ── */}
        <Card title="Forecast" subtitle="Projections" icon={TrendingUp}>
          {forecasts.length === 0 ? (
            <EmptyState title="No forecasts yet" description="Appear as time-series events (progress / cost / cash) accumulate." icon={TrendingUp} />
          ) : (
            <ul className="flex flex-col divide-y divide-[var(--border-color)] -my-1">
              {forecasts.map((f) => (
                <li key={f.id} className="py-2.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Pill className={SEV.MEDIUM}>{FCAST_LABEL[f.kind] ?? f.kind}</Pill>
                    <p className="text-sm font-medium text-[var(--text-primary)] leading-snug">{f.title}</p>
                  </div>
                  {f.detail && <p className="text-xs text-[var(--text-muted)] mt-1 leading-relaxed">{f.detail}</p>}
                  <p className="text-[0.625rem] text-[var(--text-muted)] mt-1 opacity-70">confidence {Math.round((f.confidence ?? 0) * 100)}%</p>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* ── Recommendations (action layer) ── */}
        <Card title="Recommendations" subtitle="Suggested actions" icon={Lightbulb}>
          {recommendations.length === 0 ? (
            <EmptyState title="No recommendations" description="Engines raise these on a threshold breach." icon={Lightbulb} />
          ) : (
            <ul className="flex flex-col divide-y divide-[var(--border-color)] -my-1">
              {recommendations.map((r) => (
                <li key={r.id} className="py-2.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Pill className={PRIO[r.priority]}>{r.priority}</Pill>
                    <span className="text-[0.625rem] font-mono text-[var(--text-muted)]">{r.action_type}</span>
                    <p className="text-sm font-medium text-[var(--text-primary)] leading-snug">{r.title}</p>
                  </div>
                  {r.detail && <p className="text-xs text-[var(--text-muted)] mt-1 leading-relaxed">{r.detail}</p>}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
