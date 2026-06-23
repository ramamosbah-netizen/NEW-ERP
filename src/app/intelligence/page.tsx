// AURA 0.2 — Risk Intelligence board (Phase 2A, ACTIVE).
// DUMB server-rendered renderer: reads are projected by risk-query.ts (the read
// layer); filters + sort arrive as URL params and are applied server-side (DB-side)
// — no client filtering, no recompute. Mutations flow through risk-contract.ts.

import Link from 'next/link';
import { cookies } from 'next/headers';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { KPICard } from '@/components/ui/KPICard';
import { EmptyState } from '@/components/ui/EmptyState';
import { ShieldAlert, AlertTriangle, ShieldCheck, Activity } from 'lucide-react';
import ProcessButton from './ProcessButton';
import AlertActions from './AlertActions';
import { getRiskBoard, type StatusFilter } from '@/lib/intelligence/risk-query';
import type { RiskSeverity } from '@/types/intelligence.types';

export const dynamic = 'force-dynamic';

type SortKey = 'newest' | 'severity';

const SEV_STYLES: Record<RiskSeverity, string> = {
  CRITICAL: 'bg-[var(--status-danger-bg)] text-[var(--status-danger-text)] border-[var(--status-danger-border)]',
  HIGH: 'bg-[var(--status-warning-bg)] text-[var(--status-warning-text)] border-[var(--status-warning-border)]',
  MEDIUM: 'bg-[var(--status-info-bg)] text-[var(--status-info-text)] border-[var(--status-info-border)]',
  LOW: 'bg-[var(--status-neutral-bg)] text-[var(--status-neutral-text)] border-[var(--status-neutral-border)]',
};

const DOMAIN_LABEL: Record<string, string> = {
  FINANCE: 'Finance', PROCUREMENT: 'Procurement', PROJECT: 'Project',
  COMPLIANCE: 'Compliance', SUPPLY: 'Supply', HR: 'HR', GENERAL: 'General',
};

const STATUS_TABS: { key: StatusFilter; label: string }[] = [
  { key: 'ACTIVE', label: 'Active' },
  { key: 'OPEN', label: 'Open' },
  { key: 'ACKNOWLEDGED', label: 'Acknowledged' },
  { key: 'RESOLVED', label: 'Resolved' },
  { key: 'DISMISSED', label: 'Dismissed' },
  { key: 'ALL', label: 'All' },
];

const SEVERITIES: RiskSeverity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
const SORTS: { key: SortKey; label: string }[] = [
  { key: 'severity', label: 'By severity' },
  { key: 'newest', label: 'Newest' },
];

function Pill({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[0.6875rem] font-medium border select-none ${className}`}>
      {children}
    </span>
  );
}

function timeAgo(iso: string): string {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

type FilterState = { status: StatusFilter; severity: RiskSeverity | null; domain: string | null; sort: SortKey };

// Pure URL construction (presentation, not business logic). Defaults are omitted
// for clean URLs; the actual filtering/sort happens server-side in risk-query.
function filterHref(s: FilterState) {
  const query: Record<string, string> = {};
  if (s.status !== 'ACTIVE') query.status = s.status;
  if (s.severity) query.severity = s.severity;
  if (s.domain) query.domain = s.domain;
  if (s.sort !== 'severity') query.sort = s.sort;
  return { pathname: '/intelligence', query };
}

function one(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function IntelligencePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const [cookieStore, sp] = await Promise.all([cookies(), searchParams]);
  const companyId = cookieStore.get('erp-active-company')?.value ?? null;

  let data;
  try {
    data = await getRiskBoard({
      companyId,
      status: one(sp.status) as StatusFilter | undefined,
      severity: (one(sp.severity) as RiskSeverity | undefined) ?? null,
      domain: one(sp.domain) ?? null,
      sort: one(sp.sort) === 'newest' ? 'newest' : 'severity',
    });
  } catch (e: any) {
    return (
      <div>
        <PageHeader title="Risk Intelligence" subtitle="Event-driven risk engine" />
        <Card title="Setup required" icon={AlertTriangle}>
          <p className="text-sm text-[var(--text-muted)] leading-relaxed">
            The intelligence tables are not reachable yet. Apply the migrations{' '}
            <code className="font-mono text-[var(--text-secondary)]">20260622110000_intelligence_layer.sql</code> and{' '}
            <code className="font-mono text-[var(--text-secondary)]">20260622120000_risk_engine_phase2a.sql</code>{' '}
            (and ensure <code className="font-mono text-[var(--text-secondary)]">SUPABASE_SERVICE_ROLE_KEY</code> is set).
          </p>
          <p className="text-xs text-[var(--text-muted)] mt-2 opacity-70">{e?.message ?? String(e)}</p>
        </Card>
      </div>
    );
  }

  const { filters, counts, bySeverity, byDomain, alerts, filteredCount } = data;
  const domains = Object.entries(byDomain).sort((a, b) => b[1] - a[1]);
  const filtered = filters.status !== 'ACTIVE' || !!filters.severity || !!filters.domain;

  return (
    <div>
      <PageHeader
        title="Risk Intelligence"
        subtitle="Event-driven risk alerts from the system_events ledger — deterministic, read-only, company-scoped."
        actions={<ProcessButton />}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <KPICard title="Critical (active)" value={bySeverity.CRITICAL} icon={AlertTriangle} borderAccent={bySeverity.CRITICAL ? 'danger' : 'none'} />
        <KPICard title="High (active)" value={bySeverity.HIGH} icon={ShieldAlert} borderAccent={bySeverity.HIGH ? 'warning' : 'none'} />
        <KPICard title="Open" value={counts.open} icon={Activity} />
        <KPICard title="Resolved" value={counts.resolved} icon={ShieldCheck} />
      </div>

      {/* Status tabs — each is a link; the server re-projects via risk-query on navigation. */}
      <div className="flex flex-wrap items-center gap-1.5 mb-3">
        {STATUS_TABS.map(t => {
          const on = filters.status === t.key;
          return (
            <Link
              key={t.key}
              href={filterHref({ status: t.key, severity: filters.severity, domain: filters.domain, sort: filters.sort })}
              className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                on
                  ? 'bg-[var(--bg-card)] text-[var(--text-primary)] border-[var(--border-color)]'
                  : 'text-[var(--text-secondary)] border-transparent hover:border-[var(--border-color)]'
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </div>

      {/* Severity + domain filters — toggle links (re-click clears). */}
      <div className="flex flex-wrap items-center gap-1.5 mb-3">
        {SEVERITIES.map(s => {
          const on = filters.severity === s;
          return (
            <Link
              key={s}
              href={filterHref({ status: filters.status, severity: on ? null : s, domain: filters.domain, sort: filters.sort })}
              className={`${SEV_STYLES[s]} ${on ? 'ring-1 ring-[var(--text-muted)]' : 'opacity-70 hover:opacity-100'} inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[0.6875rem] font-medium border transition-opacity`}
            >
              {s} <span className="font-semibold">{bySeverity[s]}</span>
            </Link>
          );
        })}
        {domains.length > 0 && <span className="mx-1 h-3 w-px bg-[var(--border-color)]" />}
        {domains.map(([d, n]) => {
          const on = filters.domain === d;
          return (
            <Link
              key={d}
              href={filterHref({ status: filters.status, severity: filters.severity, domain: on ? null : d, sort: filters.sort })}
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs border transition-colors ${
                on
                  ? 'bg-[var(--bg-card)] text-[var(--text-primary)] border-[var(--border-color)]'
                  : 'text-[var(--text-secondary)] border-[var(--border-color)] hover:text-[var(--text-primary)]'
              }`}
            >
              {DOMAIN_LABEL[d] ?? d} <span className="font-semibold">{n}</span>
            </Link>
          );
        })}
        {filtered && (
          <Link href={{ pathname: '/intelligence', query: {} }} className="ml-1 text-[0.6875rem] text-[var(--text-muted)] underline hover:text-[var(--text-secondary)]">
            clear
          </Link>
        )}
      </div>

      {/* Sort — server-side ordering (also a URL param). */}
      <div className="flex items-center gap-1.5 mb-4 text-xs">
        <span className="text-[var(--text-muted)]">Sort</span>
        {SORTS.map(s => {
          const on = filters.sort === s.key;
          return (
            <Link
              key={s.key}
              href={filterHref({ status: filters.status, severity: filters.severity, domain: filters.domain, sort: s.key })}
              className={`px-2 py-0.5 rounded-md border transition-colors ${
                on
                  ? 'bg-[var(--bg-card)] text-[var(--text-primary)] border-[var(--border-color)]'
                  : 'text-[var(--text-secondary)] border-transparent hover:border-[var(--border-color)]'
              }`}
            >
              {s.label}
            </Link>
          );
        })}
      </div>

      <Card title="Risk Alerts" subtitle={`${filteredCount} shown`} icon={ShieldAlert} borderAccent="danger">
        {alerts.length === 0 ? (
          <EmptyState title="No matching risks" description="No alerts match the current filters. Run analysis or widen the filter." icon={ShieldCheck} />
        ) : (
          <ul className="flex flex-col divide-y divide-[var(--border-color)] -my-1">
            {alerts.map(a => (
              <li key={a.id} className="py-3 flex items-start gap-3">
                <Pill className={SEV_STYLES[a.severity]}>{a.severity} · {a.score}</Pill>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-[var(--text-primary)] leading-snug">{a.title}</p>
                    {a.status === 'ACKNOWLEDGED' && <Pill className={SEV_STYLES.LOW}>ack</Pill>}
                    {a.status === 'RESOLVED' && <Pill className={SEV_STYLES.LOW}>resolved</Pill>}
                    {a.status === 'DISMISSED' && <Pill className={SEV_STYLES.LOW}>dismissed</Pill>}
                    {a.occurrence_count > 1 && <span className="text-[0.625rem] text-[var(--text-muted)]">×{a.occurrence_count}</span>}
                  </div>
                  {a.detail && <p className="text-xs text-[var(--text-muted)] mt-0.5 leading-relaxed">{a.detail}</p>}
                  <p className="text-[0.6875rem] text-[var(--text-muted)] mt-1 opacity-70">
                    {DOMAIN_LABEL[a.risk_domain] ?? a.risk_domain} · {a.category} · {a.source_event_type} · {timeAgo(a.created_at)}
                  </p>
                </div>
                <AlertActions alertId={a.id} status={a.status} />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
