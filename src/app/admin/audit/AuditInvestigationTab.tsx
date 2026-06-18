'use client';
import { logger } from '@/lib/logger';

// ============================================================
// JEET ERP — Audit Center: Investigation (tab of /admin/audit)
// Subject-centric forensics over the SAME immutable audit_log:
//   • pick an entity (search by label/id) or an actor (user)
//   • reconstruct its full chronological timeline with inline diffs
//   • see an investigation summary (who/what/when/action mix)
//   • export the timeline to CSV / PDF
// Read-only. Reuses auditService + finance-export. No new tables.
// ============================================================

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { auditService } from '@/services/auditService';
import type { AuditLog } from '@/types/audit.types';
import { exportTableCsv, exportTablePdf } from '@/lib/finance-export';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import {
  Search, User, Box, Clock, Users, Activity, FileDown,
  FileText, ChevronRight, AlertTriangle, X,
} from 'lucide-react';

type Mode = 'entity' | 'actor';
type EntityHit = { entity_type: string; entity_id: string; entity_label: string | null; module: string; last_at: string; events: number };
type Subject = { kind: Mode; id: string; type?: string; label: string };

// Action → status colour family (matches theme tokens).
const ACTION_TONE: Record<string, 'success' | 'danger' | 'warning' | 'info' | 'neutral'> = {
  CREATE: 'success', INSERT: 'success', APPROVE: 'success', POST: 'success',
  DELETE: 'danger', REJECT: 'danger', CANCEL: 'danger', REVERSE: 'danger',
  OVERRIDE: 'warning', RESTART: 'warning', REASSIGN: 'warning', FORCE_STATUS: 'warning',
  UPDATE: 'info', EXPORT: 'info', LOGIN: 'info',
};
const toneOf = (action: string): 'success' | 'danger' | 'warning' | 'info' | 'neutral' => {
  const a = (action || '').toUpperCase();
  for (const key of Object.keys(ACTION_TONE)) if (a.includes(key)) return ACTION_TONE[key];
  return 'neutral';
};

const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString('en-AE', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

function ToneBadge({ tone, children }: { tone: 'success' | 'danger' | 'warning' | 'info' | 'neutral'; children: React.ReactNode }) {
  return (
    <span
      className="inline-flex items-center rounded px-1.5 py-0.5 text-[0.625rem] font-semibold uppercase tracking-wide border whitespace-nowrap"
      style={{
        background: `var(--status-${tone}-bg)`,
        color: `var(--status-${tone}-text)`,
        borderColor: `var(--status-${tone}-border)`,
      }}
    >
      {children}
    </span>
  );
}

type JsonRecord = Record<string, unknown> | null;

function diffKeys(before: JsonRecord, after: JsonRecord): string[] {
  const b = before || {}, a = after || {};
  return Array.from(new Set([...Object.keys(b), ...Object.keys(a)]))
    .filter(k => JSON.stringify(b[k]) !== JSON.stringify(a[k]));
}

function ChangeTable({ before, after }: { before: JsonRecord; after: JsonRecord }) {
  const keys = diffKeys(before, after);
  if (!before && !after) return <p className="text-xs text-[var(--text-muted)] italic">No change details recorded.</p>;
  if (keys.length === 0) return <p className="text-xs text-[var(--text-muted)] italic">No field-level differences.</p>;
  const b = before || {}, a = after || {};
  return (
    <div className="border border-[var(--border-color)] rounded-md overflow-hidden text-xs mt-2">
      <div className="grid grid-cols-3 bg-[var(--bg-card-hover)] px-3 py-2 border-b border-[var(--border-color)] font-medium text-[var(--text-secondary)]">
        <div>Field</div><div>Before</div><div>After</div>
      </div>
      <div className="divide-y divide-[var(--border-color)] max-h-[260px] overflow-y-auto font-mono">
        {keys.map(k => (
          <div key={k} className="grid grid-cols-3 px-3 py-1.5 hover:bg-[var(--bg-card-hover)]">
            <div className="text-[var(--text-secondary)] font-medium truncate pr-2">{k}</div>
            <div className="text-[var(--status-danger-text)] line-through truncate pr-2">
              {b[k] !== undefined ? String(b[k]) : <span className="text-[var(--text-muted)] italic no-underline">n/a</span>}
            </div>
            <div className="text-[var(--status-success-text)] truncate pr-2">
              {a[k] !== undefined ? String(a[k]) : <span className="text-[var(--text-muted)] italic">deleted</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AuditInvestigationTab() {
  const [mode, setMode] = useState<Mode>('entity');

  // entity search
  const [term, setTerm] = useState('');
  const [hits, setHits] = useState<EntityHit[]>([]);
  const [searching, setSearching] = useState(false);

  // actor picker
  const [actors, setActors] = useState<{ id: string; name: string; role: string | null }[]>([]);

  // subject + timeline
  const [subject, setSubject] = useState<Subject | null>(null);
  const [timeline, setTimeline] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState<Record<string, boolean>>({});

  useEffect(() => {
    auditService.getActors().then(setActors).catch(err => logger.error('Failed to load actors:', err));
  }, []);

  const runSearch = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!term.trim()) { setHits([]); return; }
    setSearching(true);
    try { setHits(await auditService.searchEntities(term)); }
    catch (err) { logger.error('Entity search failed:', err); }
    finally { setSearching(false); }
  }, [term]);

  const loadTimeline = useCallback(async (s: Subject) => {
    setSubject(s);
    setTimeline([]);
    setOpen({});
    setLoading(true);
    try {
      const data = await auditService.getTimeline(
        s.kind === 'entity' ? { entityId: s.id } : { actorId: s.id }
      );
      setTimeline(data);
    } catch (err) {
      logger.error('Failed to load timeline:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const summary = useMemo(() => {
    if (timeline.length === 0) return null;
    const actorIds = new Set<string>();
    const entityIds = new Set<string>();
    const actionMix: Record<string, number> = {};
    for (const e of timeline) {
      if (e.actor_user_id) actorIds.add(e.actor_user_id);
      entityIds.add(e.entity_id);
      actionMix[e.action] = (actionMix[e.action] || 0) + 1;
    }
    return {
      total: timeline.length,
      first: timeline[0].occurred_at,
      last: timeline[timeline.length - 1].occurred_at,
      distinctActors: actorIds.size,
      distinctEntities: entityIds.size,
      actionMix: Object.entries(actionMix).sort((a, b) => b[1] - a[1]),
    };
  }, [timeline]);

  const exportRows = useMemo(
    () => timeline.map(e => [
      fmtDateTime(e.occurred_at),
      e.actor_name || 'System',
      e.actor_role || '',
      e.action,
      e.module,
      e.entity_type,
      e.entity_label || e.entity_id,
      e.summary,
    ]),
    [timeline]
  );

  const doExport = (kind: 'csv' | 'pdf') => {
    if (!subject || timeline.length === 0) return;
    const table = {
      title: `Audit timeline — ${subject.label}`,
      subtitle: `${timeline.length} events · ${fmtDateTime(summary!.first)} → ${fmtDateTime(summary!.last)}`,
      columns: ['Timestamp', 'Actor', 'Role', 'Action', 'Module', 'Entity type', 'Entity', 'Summary'],
      rows: exportRows,
      fileName: `audit_${subject.kind}_${subject.label}`,
    };
    (kind === 'csv' ? exportTableCsv : exportTablePdf)(table);
  };

  const clearSubject = () => { setSubject(null); setTimeline([]); setOpen({}); };

  return (
    <div className="flex flex-col gap-5">
      {/* Subject selector */}
      <Card padding={false}>
        <div className="p-4 flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMode('entity')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${mode === 'entity' ? 'bg-[var(--primary)] text-white border-[var(--primary)]' : 'border-[var(--border-color)] text-[var(--text-secondary)] hover:bg-[var(--bg-card-hover)]'}`}
            >
              <Box size={13} /> By record
            </button>
            <button
              onClick={() => setMode('actor')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${mode === 'actor' ? 'bg-[var(--primary)] text-white border-[var(--primary)]' : 'border-[var(--border-color)] text-[var(--text-secondary)] hover:bg-[var(--bg-card-hover)]'}`}
            >
              <User size={13} /> By user
            </button>
            <span className="text-[0.6875rem] text-[var(--text-muted)] ml-1">
              Pick a subject to reconstruct its full history.
            </span>
          </div>

          {mode === 'entity' ? (
            <form onSubmit={runSearch} className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" size={14} />
                <input
                  type="text"
                  placeholder="Search by record label, summary, type, or paste an entity ID…"
                  value={term}
                  onChange={(e) => setTerm(e.target.value)}
                  className="quote-form-input w-full !pl-9"
                />
              </div>
              <Button type="submit" variant="primary" size="md" disabled={searching}>
                {searching ? 'Searching…' : 'Search'}
              </Button>
            </form>
          ) : (
            <div className="quote-form-group max-w-md">
              <label>User</label>
              <select
                className="quote-form-input"
                value={subject?.kind === 'actor' ? subject.id : ''}
                onChange={(e) => {
                  const a = actors.find(x => x.id === e.target.value);
                  if (a) loadTimeline({ kind: 'actor', id: a.id, label: a.name });
                }}
              >
                <option value="">Select a user…</option>
                {actors.map(a => (
                  <option key={a.id} value={a.id}>{a.name}{a.role ? ` · ${a.role}` : ''}</option>
                ))}
              </select>
            </div>
          )}

          {/* Entity search results */}
          {mode === 'entity' && hits.length > 0 && !subject && (
            <div className="border border-[var(--border-color)] rounded-md divide-y divide-[var(--border-color)] max-h-[280px] overflow-y-auto">
              {hits.map(h => (
                <button
                  key={h.entity_id}
                  onClick={() => loadTimeline({ kind: 'entity', id: h.entity_id, type: h.entity_type, label: h.entity_label || h.entity_type })}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-[var(--bg-card-hover)] transition-colors"
                >
                  <Box size={14} className="text-[var(--text-muted)] flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-medium text-[var(--text-primary)] truncate">{h.entity_label || <span className="font-mono">{h.entity_id}</span>}</div>
                    <div className="text-[0.6875rem] text-[var(--text-muted)] font-mono">{h.entity_type} · {h.module}</div>
                  </div>
                  <span className="q-badge q-badge-draft flex-shrink-0">{h.events} event{h.events === 1 ? '' : 's'}</span>
                  <span className="text-[0.6875rem] text-[var(--text-muted)] whitespace-nowrap flex-shrink-0">{fmtDateTime(h.last_at)}</span>
                  <ChevronRight size={14} className="text-[var(--text-muted)] flex-shrink-0" />
                </button>
              ))}
            </div>
          )}
          {mode === 'entity' && !searching && term.trim() && hits.length === 0 && !subject && (
            <p className="text-xs text-[var(--text-muted)] italic">No records match “{term}”.</p>
          )}
        </div>
      </Card>

      {/* Investigation result */}
      {subject && (
        <div className="flex flex-col gap-4">
          {/* Summary header */}
          <Card padding={false}>
            <div className="p-4 flex flex-col gap-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  {subject.kind === 'entity' ? <Box size={16} className="text-[var(--primary)] flex-shrink-0" /> : <User size={16} className="text-[var(--primary)] flex-shrink-0" />}
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-[var(--text-primary)] truncate">{subject.label}</div>
                    <div className="text-[0.6875rem] text-[var(--text-muted)] font-mono">
                      {subject.kind === 'entity' ? `${subject.type || 'record'} · ${subject.id}` : 'user activity'}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Button size="sm" variant="muted" icon={FileDown} onClick={() => doExport('csv')} disabled={timeline.length === 0}>CSV</Button>
                  <Button size="sm" variant="muted" icon={FileText} onClick={() => doExport('pdf')} disabled={timeline.length === 0}>PDF</Button>
                  <Button size="sm" variant="secondary" icon={X} onClick={clearSubject}>Close</Button>
                </div>
              </div>

              {summary && (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <Stat icon={Activity} label="Events" value={String(summary.total)} />
                  <Stat icon={Clock} label="First seen" value={fmtDateTime(summary.first)} />
                  <Stat icon={Clock} label="Last seen" value={fmtDateTime(summary.last)} />
                  {subject.kind === 'entity'
                    ? <Stat icon={Users} label="Distinct actors" value={String(summary.distinctActors)} />
                    : <Stat icon={Box} label="Records touched" value={String(summary.distinctEntities)} />}
                  <div className="flex flex-col gap-1">
                    <span className="text-[0.6875rem] text-[var(--text-muted)] uppercase">Action mix</span>
                    <div className="flex flex-wrap gap-1">
                      {summary.actionMix.slice(0, 4).map(([a, n]) => (
                        <ToneBadge key={a} tone={toneOf(a)}>{a} {n}</ToneBadge>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* Timeline */}
          <Card padding={false}>
            {loading ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <div className="h-7 w-7 rounded-full border-2 border-[var(--border-color)] border-t-[var(--text-primary)] animate-spin" />
                <p className="text-xs text-[var(--text-muted)]">Reconstructing timeline…</p>
              </div>
            ) : timeline.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-[var(--text-muted)] gap-2">
                <AlertTriangle size={26} className="opacity-30" />
                <p className="text-xs">No audit events recorded for this subject.</p>
              </div>
            ) : (
              <div className="p-4">
                <div className="relative pl-6">
                  {/* rail */}
                  <div className="absolute left-[7px] top-2 bottom-2 w-px bg-[var(--border-color)]" />
                  <div className="flex flex-col gap-1">
                    {timeline.map((e) => {
                      const tone = toneOf(e.action);
                      const isOpen = !!open[e.id];
                      const changed = diffKeys(e.before, e.after).length;
                      return (
                        <div key={e.id} className="relative">
                          <span
                            className="absolute -left-[22px] top-2 h-3.5 w-3.5 rounded-full border-2 border-[var(--bg-card)]"
                            style={{ backgroundColor: `var(--status-${tone}-text)` }}
                          />
                          <div className="rounded-md hover:bg-[var(--bg-card-hover)] transition-colors px-3 py-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono text-[0.6875rem] text-[var(--text-muted)] whitespace-nowrap">{fmtDateTime(e.occurred_at)}</span>
                              <ToneBadge tone={tone}>{e.action}</ToneBadge>
                              <span className="text-xs font-medium text-[var(--text-primary)]">{e.actor_name || 'System'}</span>
                              {e.actor_role && <span className="text-[0.625rem] text-[var(--text-muted)] uppercase">{e.actor_role}</span>}
                              <span className="text-[0.625rem] text-[var(--text-muted)] font-mono ml-auto">{e.module} · {e.source}</span>
                            </div>
                            <p className="text-xs text-[var(--text-secondary)] mt-1">{e.summary}</p>
                            {subject.kind === 'actor' && (
                              <p className="text-[0.6875rem] text-[var(--text-muted)] font-mono mt-0.5">
                                {e.entity_type}{e.entity_label ? ` · ${e.entity_label}` : ''}
                              </p>
                            )}
                            {changed > 0 && (
                              <>
                                <button
                                  onClick={() => setOpen(o => ({ ...o, [e.id]: !o[e.id] }))}
                                  className="mt-1.5 text-[0.6875rem] font-medium text-[var(--primary)] hover:underline"
                                >
                                  {isOpen ? 'Hide changes' : `Show ${changed} field change${changed === 1 ? '' : 's'}`}
                                </button>
                                {isOpen && <ChangeTable before={e.before} after={e.after} />}
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Empty state */}
      {!subject && mode === 'entity' && !term.trim() && (
        <Card>
          <div className="text-center py-12">
            <Box size={26} className="mx-auto opacity-20 mb-2 text-[var(--text-muted)]" />
            <p className="text-xs text-[var(--text-muted)] max-w-md mx-auto">
              Search for any record (purchase order, invoice, role, workflow…) to reconstruct
              its complete tamper-proof history, or switch to <strong>By user</strong> to review
              everything one person did.
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: React.ComponentType<{ size?: number; className?: string }>; label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[0.6875rem] text-[var(--text-muted)] uppercase flex items-center gap-1"><Icon size={11} /> {label}</span>
      <span className="text-sm font-semibold text-[var(--text-primary)]">{value}</span>
    </div>
  );
}
