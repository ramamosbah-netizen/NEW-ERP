'use client';

// ============================================================
// Aura ERP — Administration → System Health
// Operations console over the EXISTING automation layer:
//   • Scheduled-job registry + run telemetry (system_jobs)
//   • Event-pipeline health from the system_events ledger
//     (queue depth, throughput, dead-letter) + reprocess
//   • Manual job runs
// Read-only data + two safe actions (invoke job, reprocess event) that go
// through existing edge functions. No new policy tables; no service-role here.
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import {
  systemJobsService,
  type JobRun, type JobSummary, type PipelineHealth, type DeadLetterEvent,
} from '@/services/systemJobsService';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import {
  Activity, Clock, AlertTriangle, CheckCircle2, PlayCircle, RefreshCw,
  Inbox, Zap, XCircle, Loader2,
} from 'lucide-react';

const fmtAgo = (iso: string | null) => {
  if (!iso) return 'never';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000), h = Math.floor(m / 60), d = Math.floor(h / 24);
  return d > 0 ? `${d}d ago` : h > 0 ? `${h}h ago` : m > 0 ? `${m}m ago` : 'just now';
};
const fmtDur = (ms: number | null) => {
  if (ms == null) return '—';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
};

const STATUS_TONE: Record<string, 'success' | 'danger' | 'warning'> = { SUCCESS: 'success', FAILED: 'danger', RUNNING: 'warning' };
function StatusBadge({ status }: { status: string }) {
  const tone = STATUS_TONE[status] || 'warning';
  return (
    <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[0.625rem] font-semibold uppercase tracking-wide border"
      style={{ background: `var(--status-${tone}-bg)`, color: `var(--status-${tone}-text)`, borderColor: `var(--status-${tone}-border)` }}>
      {status}
    </span>
  );
}

export default function SystemHealthPage() {
  const [loading, setLoading] = useState(true);
  const [summaries, setSummaries] = useState<JobSummary[]>([]);
  const [runs, setRuns] = useState<JobRun[]>([]);
  const [pipeline, setPipeline] = useState<PipelineHealth>({ queued: 0, failed: 0, processed24h: 0, throughput: [], topTypes: [] });
  const [dead, setDead] = useState<DeadLetterEvent[]>([]);
  const [stats, setStats] = useState<{ runs24h: number; failed24h: number; successRate: number | null }>({ runs24h: 0, failed24h: 0, successRate: null });
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null);

  const load = useCallback(async () => {
    const [sum, rec, pipe, dl] = await Promise.all([
      systemJobsService.getJobSummaries(),
      systemJobsService.getRecentRuns(60),
      systemJobsService.getPipelineHealth(),
      systemJobsService.getDeadLetter(25),
    ]);
    const now = Date.now();
    const r24 = rec.filter(r => now - new Date(r.started_at).getTime() < 864e5);
    const ok24 = r24.filter(r => r.status === 'SUCCESS').length;
    setStats({
      runs24h: r24.length,
      failed24h: r24.filter(r => r.status === 'FAILED').length,
      successRate: r24.length ? Math.round((ok24 / r24.length) * 100) : null,
    });
    setSummaries(sum); setRuns(rec); setPipeline(pipe); setDead(dl);
    setLoading(false);
  }, []);

  useEffect(() => { (async () => { await load(); })(); }, [load]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const runJob = async (key: string) => {
    setBusy(b => ({ ...b, [key]: true }));
    const res = await systemJobsService.invokeJob(key);
    setBusy(b => ({ ...b, [key]: false }));
    setToast(res.ok ? { kind: 'ok', msg: `${key} triggered` } : { kind: 'err', msg: res.error || `Failed to trigger ${key}` });
    if (res.ok) setTimeout(load, 1500);
  };

  const reprocess = async (id: string) => {
    setBusy(b => ({ ...b, [id]: true }));
    const res = await systemJobsService.reprocessEvent(id);
    setBusy(b => ({ ...b, [id]: false }));
    setToast(res.ok ? { kind: 'ok', msg: 'Reprocess triggered' } : { kind: 'err', msg: res.error || 'Reprocess failed' });
    if (res.ok) setTimeout(load, 1500);
  };

  const kpis = [
    { label: 'Queued events', value: pipeline.queued, icon: Inbox, tone: pipeline.queued > 50 ? 'var(--status-warning-text)' : 'var(--text-primary)' },
    { label: 'Dead-letter', value: pipeline.failed, icon: XCircle, tone: pipeline.failed ? 'var(--status-danger-text)' : 'var(--status-success-text)' },
    { label: 'Processed (24h)', value: pipeline.processed24h, icon: Zap, tone: 'var(--text-primary)' },
    { label: 'Job runs (24h)', value: stats.runs24h, icon: Activity, tone: 'var(--text-primary)' },
    { label: 'Failed jobs (24h)', value: stats.failed24h, icon: AlertTriangle, tone: stats.failed24h ? 'var(--status-danger-text)' : 'var(--status-success-text)' },
    { label: 'Job success rate', value: stats.successRate == null ? '—' : `${stats.successRate}%`, icon: CheckCircle2, tone: stats.successRate != null && stats.successRate < 90 ? 'var(--status-warning-text)' : 'var(--status-success-text)' },
  ];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="System Health"
        subtitle="Scheduled jobs, event pipeline and automation telemetry"
        breadcrumbs={[{ label: 'Administration', href: '/admin/hub' }, { label: 'System Health' }]}
      />

      <div className="flex justify-end -mb-2">
        <Button size="sm" variant="secondary" icon={RefreshCw} onClick={() => load()}>Refresh</Button>
      </div>

      {/* KPI band */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {kpis.map(k => {
          const Icon = k.icon;
          return (
            <Card key={k.label} className="p-4">
              <div className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]"><Icon size={13} /> {k.label}</div>
              <div className="text-xl font-bold mt-1" style={{ color: k.tone }}>{loading ? '—' : k.value}</div>
            </Card>
          );
        })}
      </div>

      {/* Scheduled jobs registry */}
      <Card className="p-0 overflow-hidden">
        <div className="p-3 border-b border-[var(--border)] text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
          <Clock size={15} /> Scheduled jobs
          <span className="text-[11px] font-normal text-[var(--text-tertiary)]">— last run telemetry from <code className="font-mono">system_jobs</code></span>
        </div>
        <div className="overflow-x-auto">
          <table className="quote-table">
            <thead>
              <tr><th>Job</th><th>Cadence</th><th>Last run</th><th>Status</th><th>Duration</th><th>30d runs</th><th style={{ textAlign: 'right' }}>Action</th></tr>
            </thead>
            <tbody>
              {summaries.map(j => (
                <tr key={j.key}>
                  <td>
                    <div className="text-xs font-medium text-[var(--text-primary)]">{j.label}</div>
                    <div className="text-[11px] text-[var(--text-tertiary)]">{j.description}</div>
                  </td>
                  <td><span className="text-xs text-[var(--text-secondary)]">{j.cadence}</span></td>
                  <td><span className="text-xs text-[var(--text-secondary)] whitespace-nowrap">{fmtAgo(j.lastRun?.started_at ?? null)}</span></td>
                  <td>{j.lastRun ? <StatusBadge status={j.lastRun.status} /> : <span className="text-[11px] text-[var(--text-tertiary)] italic">no runs yet</span>}</td>
                  <td><span className="text-xs text-[var(--text-secondary)]">{fmtDur(j.lastRun?.duration_ms ?? null)}</span></td>
                  <td>
                    <span className="text-xs text-[var(--text-secondary)]">{j.runs30d}</span>
                    {j.failures30d > 0 && <span className="text-[11px] ml-1" style={{ color: 'var(--status-danger-text)' }}>({j.failures30d} failed)</span>}
                  </td>
                  <td>
                    <div className="flex justify-end">
                      <Button size="sm" variant="muted" icon={busy[j.key] ? Loader2 : PlayCircle} disabled={busy[j.key]} onClick={() => runJob(j.key)}>
                        {busy[j.key] ? 'Running…' : 'Run now'}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Pipeline throughput + top types */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <Card className="p-4 lg:col-span-2">
          <div className="text-sm font-semibold text-[var(--text-primary)] mb-3">Event pipeline — last 14 days</div>
          <div style={{ width: '100%', height: 200 }}>
            <ResponsiveContainer>
              <AreaChart data={pipeline.throughput}>
                <defs><linearGradient id="shFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--accent)" stopOpacity={0.3} /><stop offset="100%" stopColor="var(--accent)" stopOpacity={0} /></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="day" tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }} interval={2} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} allowDecimals={false} width={28} />
                <Tooltip />
                <Area dataKey="value" stroke="var(--accent)" fill="url(#shFill)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-sm font-semibold text-[var(--text-primary)] mb-3">Top event types (14d)</div>
          <div className="flex flex-col gap-2">
            {pipeline.topTypes.length === 0 ? (
              <div className="text-xs text-[var(--text-tertiary)]">{loading ? 'Loading…' : 'No events recorded.'}</div>
            ) : pipeline.topTypes.map(t => (
              <div key={t.type} className="flex items-center justify-between gap-2">
                <span className="text-xs text-[var(--text-primary)] font-mono truncate">{t.type}</span>
                <span className="text-xs text-[var(--text-secondary)]">{t.count}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Dead-letter */}
      <Card className="p-0 overflow-hidden">
        <div className="p-3 border-b border-[var(--border)] text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
          <AlertTriangle size={15} className="text-[var(--status-danger-text)]" /> Dead-letter — failed events
          <span className="text-[11px] font-normal text-[var(--text-tertiary)]">— events with a processing error</span>
        </div>
        {dead.length === 0 ? (
          <div className="p-6 text-xs text-[var(--text-tertiary)] flex items-center gap-2">
            <CheckCircle2 size={14} className="text-[var(--status-success-text)]" /> {loading ? 'Loading…' : 'No failed events — the pipeline is clean.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="quote-table">
              <thead><tr><th>Event</th><th>Entity</th><th>Error</th><th>When</th><th style={{ textAlign: 'right' }}>Action</th></tr></thead>
              <tbody>
                {dead.map(e => (
                  <tr key={e.id}>
                    <td><span className="text-xs font-mono text-[var(--text-primary)]">{e.event_type}</span></td>
                    <td><span className="text-[11px] text-[var(--text-tertiary)] font-mono">{e.entity_type || '—'}</span></td>
                    <td><span className="text-xs text-[var(--status-danger-text)] line-clamp-2 max-w-[360px]">{e.processing_error}</span></td>
                    <td><span className="text-[11px] text-[var(--text-tertiary)] whitespace-nowrap">{fmtAgo(e.created_at)}</span></td>
                    <td>
                      <div className="flex justify-end">
                        <Button size="sm" variant="muted" icon={busy[e.id] ? Loader2 : RefreshCw} disabled={busy[e.id]} onClick={() => reprocess(e.id)}>
                          {busy[e.id] ? 'Retrying…' : 'Reprocess'}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Recent runs */}
      <Card className="p-0 overflow-hidden">
        <div className="p-3 border-b border-[var(--border)] text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
          <Activity size={15} /> Recent job runs
        </div>
        {runs.length === 0 ? (
          <div className="p-6 text-xs text-[var(--text-tertiary)]">
            {loading ? 'Loading…' : 'No runs recorded yet. Telemetry appears after the scheduled functions are deployed and next execute.'}
          </div>
        ) : (
          <div className="overflow-x-auto max-h-[360px] overflow-y-auto">
            <table className="quote-table">
              <thead><tr><th>Job</th><th>Status</th><th>Started</th><th>Duration</th><th>Items</th><th>Error</th></tr></thead>
              <tbody>
                {runs.map(r => (
                  <tr key={r.id}>
                    <td><span className="text-xs font-medium text-[var(--text-primary)]">{r.job_name}</span></td>
                    <td><StatusBadge status={r.status} /></td>
                    <td><span className="text-[11px] text-[var(--text-tertiary)] whitespace-nowrap">{fmtAgo(r.started_at)}</span></td>
                    <td><span className="text-xs text-[var(--text-secondary)]">{fmtDur(r.duration_ms)}</span></td>
                    <td><span className="text-xs text-[var(--text-secondary)]">{r.items_processed ?? '—'}</span></td>
                    <td><span className="text-xs text-[var(--status-danger-text)] line-clamp-1 max-w-[260px]">{r.error || ''}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {toast && (
        <div className="fixed bottom-5 right-5 z-50 px-4 py-2.5 rounded-lg border text-sm shadow-lg"
          style={{
            background: toast.kind === 'ok' ? 'var(--status-success-bg)' : 'var(--status-danger-bg)',
            color: toast.kind === 'ok' ? 'var(--status-success-text)' : 'var(--status-danger-text)',
            borderColor: toast.kind === 'ok' ? 'var(--status-success-border)' : 'var(--status-danger-border)',
          }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
