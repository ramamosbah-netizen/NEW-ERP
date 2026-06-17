'use client';
import { logger } from '@/lib/logger';

// ============================================================
// JEET ERP — Audit Log (tab of /admin/audit)
// Immutable activity ledger: filters, table, diff inspector.
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';
import { auditService } from '@/services/auditService';
import type { AuditLog, AuditLogFilter } from '@/types/audit.types';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import {
  Search, Database, User, Eye, Terminal,
  CheckCircle, FileCode, Clock, Globe, X,
} from 'lucide-react';

const MODULES = ['SYSTEM', 'QUOTATION', 'PROCUREMENT', 'FINANCE', 'SERVICE', 'TESTING', 'HR', 'INVENTORY', 'FLEET', 'ASSET'];
const ACTIONS = ['CREATE', 'UPDATE', 'DELETE', 'APPROVE', 'REJECT', 'LOGIN', 'EXPORT'];
const ENTITY_TYPES = [
  'WORKFLOW', 'WORKFLOW_INSTANCE', 'BUSINESS_RULE', 'NUMBERING_RULE',
  'FORM_DEFINITION', 'DOCUMENT_TEMPLATE', 'SYSTEM_SETTING', 'PERMISSION',
  'USER_ACCOUNT', 'USER_SESSION',
  'QUOTATION', 'PURCHASE_ORDER', 'GRN', 'INVOICE', 'TENDER', 'PROJECT',
  'VARIATION_ORDER', 'TICKET', 'EMPLOYEE', 'ASSET',
];

export default function AuditLogTab() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [selectedModule, setSelectedModule] = useState<string>('');
  const [selectedAction, setSelectedAction] = useState<string>('');
  const [selectedEntityType, setSelectedEntityType] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const filters: AuditLogFilter = {};
      if (search) filters.search = search;
      if (selectedModule) filters.module = selectedModule;
      if (selectedAction) filters.action = selectedAction;
      if (selectedEntityType) filters.entity_type = selectedEntityType;
      if (startDate) filters.startDate = new Date(startDate).toISOString();
      if (endDate) filters.endDate = new Date(endDate).toISOString();

      const data = await auditService.getLogs(filters);
      setLogs(data);
    } catch (err) {
      logger.error('Error loading audit logs:', err);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedModule, selectedAction, selectedEntityType, startDate, endDate]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchLogs();
  };

  const clearFilters = () => {
    setSearch(''); setSelectedModule(''); setSelectedAction('');
    setSelectedEntityType(''); setStartDate(''); setEndDate('');
  };

  const renderJsonPayload = (data: unknown) => {
    if (!data) return <span className="text-[var(--text-muted)] italic">None</span>;
    return (
      <pre className="p-3 bg-[var(--bg-dark)] border border-[var(--border-color)] rounded-md font-mono text-xs text-[var(--text-secondary)] overflow-auto max-h-[250px]">
        {JSON.stringify(data, null, 2)}
      </pre>
    );
  };

  const renderDiff = (before: any, after: any) => {
    if (!before && !after) return <p className="text-xs text-[var(--text-muted)] italic">No change details recorded.</p>;
    const b = before || {};
    const a = after || {};
    const changedKeys = Array.from(new Set([...Object.keys(b), ...Object.keys(a)]))
      .filter(key => JSON.stringify(b[key]) !== JSON.stringify(a[key]));
    if (changedKeys.length === 0) {
      return <p className="text-xs text-[var(--text-muted)] italic">No field-level differences.</p>;
    }
    return (
      <div className="border border-[var(--border-color)] rounded-md overflow-hidden text-xs">
        <div className="grid grid-cols-3 bg-[var(--bg-card-hover)] px-3 py-2 border-b border-[var(--border-color)] font-medium text-[var(--text-secondary)]">
          <div>Field</div><div>Before</div><div>After</div>
        </div>
        <div className="divide-y divide-[var(--border-color)] max-h-[300px] overflow-y-auto font-mono">
          {changedKeys.map(key => (
            <div key={key} className="grid grid-cols-3 px-3 py-2 hover:bg-[var(--bg-card-hover)]">
              <div className="text-[var(--text-secondary)] font-medium truncate pr-2">{key}</div>
              <div className="text-[var(--status-danger-text)] line-through truncate pr-2">
                {b[key] !== undefined ? String(b[key]) : <span className="text-[var(--text-muted)] italic no-underline">n/a</span>}
              </div>
              <div className="text-[var(--status-success-text)] truncate pr-2">
                {a[key] !== undefined ? String(a[key]) : <span className="text-[var(--text-muted)] italic">deleted</span>}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const hasFilters = search || selectedModule || selectedAction || selectedEntityType || startDate || endDate;

  return (
    <div className="flex flex-col gap-4">
      {hasFilters && (
        <div className="flex justify-end">
          <Button size="sm" variant="secondary" icon={X} onClick={clearFilters}>Clear filters</Button>
        </div>
      )}

      <div className="flex flex-col xl:flex-row gap-5 items-start">
        {/* Left: filters + ledger */}
        <div className="flex-1 w-full flex flex-col gap-4 min-w-0">
          <Card padding={false}>
            <div className="p-4 flex flex-col gap-3">
              <form onSubmit={handleSearchSubmit} className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" size={14} />
                  <input type="text" placeholder="Search by summary, entity type, action…" value={search} onChange={(e) => setSearch(e.target.value)} className="quote-form-input w-full !pl-9" />
                </div>
                <Button type="submit" variant="primary" size="md">Search</Button>
              </form>

              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <div className="quote-form-group">
                  <label>Module</label>
                  <select value={selectedModule} onChange={(e) => setSelectedModule(e.target.value)} className="quote-form-input">
                    <option value="">All modules</option>
                    {MODULES.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div className="quote-form-group">
                  <label>Entity type</label>
                  <select value={selectedEntityType} onChange={(e) => setSelectedEntityType(e.target.value)} className="quote-form-input">
                    <option value="">All entities</option>
                    {ENTITY_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
                  </select>
                </div>
                <div className="quote-form-group">
                  <label>Action</label>
                  <select value={selectedAction} onChange={(e) => setSelectedAction(e.target.value)} className="quote-form-input">
                    <option value="">All actions</option>
                    {ACTIONS.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>
                <div className="quote-form-group">
                  <label>From</label>
                  <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="quote-form-input" />
                </div>
                <div className="quote-form-group">
                  <label>To</label>
                  <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="quote-form-input" />
                </div>
              </div>
            </div>
          </Card>

          <Card padding={false}>
            {loading ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <div className="h-7 w-7 rounded-full border-2 border-[var(--border-color)] border-t-[var(--text-primary)] animate-spin" />
                <p className="text-xs text-[var(--text-muted)]">Loading audit records…</p>
              </div>
            ) : logs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-[var(--text-muted)] gap-2">
                <Database size={28} className="opacity-30" />
                <p className="text-xs">No matching audit records found.</p>
              </div>
            ) : (
              <div className="quote-table-wrap !border-0 !rounded-none">
                <table className="quote-table">
                  <thead>
                    <tr>
                      <th>Timestamp</th><th>Actor</th><th>Module</th><th>Action</th><th>Summary</th>
                      <th style={{ textAlign: 'right' }}>Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map(log => {
                      const date = new Date(log.occurred_at).toLocaleString('en-AE', {
                        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
                      });
                      const isSelected = selectedLog?.id === log.id;
                      return (
                        <tr key={log.id} className={isSelected ? 'bg-[var(--bg-card-hover)]' : ''}>
                          <td><span className="font-mono text-xs text-[var(--text-secondary)] whitespace-nowrap">{date}</span></td>
                          <td>
                            <div className="flex items-center gap-1.5">
                              <User size={12} className="text-[var(--text-muted)] flex-shrink-0" />
                              <div className="min-w-0">
                                <div className="text-xs font-medium text-[var(--text-primary)] truncate">{log.actor_name}</div>
                                <div className="text-[0.6875rem] text-[var(--text-muted)] uppercase">{log.actor_role || 'system'}</div>
                              </div>
                            </div>
                          </td>
                          <td><span className="q-badge q-badge-draft">{log.module}</span></td>
                          <td><span className="text-xs font-medium text-[var(--text-primary)]">{log.action}</span></td>
                          <td>
                            <div className="text-xs text-[var(--text-secondary)] truncate max-w-[260px]">{log.summary}</div>
                            <div className="text-[0.6875rem] text-[var(--text-muted)] font-mono mt-0.5">{log.entity_type}</div>
                          </td>
                          <td>
                            <div className="flex justify-end">
                              <Button size="sm" variant="muted" icon={Eye} onClick={() => setSelectedLog(log)}>Inspect</Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        {/* Right: inspector */}
        <div className="w-full xl:w-96 flex flex-col gap-4 flex-shrink-0 xl:sticky xl:top-20">
          <Card title="Record inspector" icon={Terminal} padding={false}>
            <div className="p-4">
              {selectedLog ? (
                <div className="flex flex-col gap-4 text-xs">
                  <div className="border-b border-[var(--border-color)] pb-3">
                    <span className="text-[0.6875rem] text-[var(--text-muted)] uppercase block">Record ID</span>
                    <span className="font-mono text-[var(--text-primary)] break-all">{selectedLog.id}</span>
                  </div>
                  <div>
                    <span className="text-[0.6875rem] text-[var(--text-muted)] uppercase block mb-1">Summary</span>
                    <p className="text-[var(--text-primary)] leading-relaxed">{selectedLog.summary}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <span className="text-[0.6875rem] text-[var(--text-muted)] uppercase block">Source</span>
                      <span className="font-mono text-[var(--text-secondary)] flex items-center gap-1 mt-0.5"><Clock size={11} /> {selectedLog.source}</span>
                    </div>
                    <div>
                      <span className="text-[0.6875rem] text-[var(--text-muted)] uppercase block">IP address</span>
                      <span className="font-mono text-[var(--text-secondary)] flex items-center gap-1 mt-0.5"><Globe size={11} /> {selectedLog.ip || 'Local'}</span>
                    </div>
                  </div>
                  <div className="border-t border-[var(--border-color)] pt-3 flex flex-col gap-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[0.6875rem] text-[var(--text-muted)] uppercase flex items-center gap-1"><FileCode size={12} /> Field changes</span>
                      <span className="q-badge q-badge-draft">{selectedLog.entity_type}</span>
                    </div>
                    {renderDiff(selectedLog.before, selectedLog.after)}
                    <details className="group">
                      <summary className="text-[0.6875rem] font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer select-none bg-[var(--bg-card-hover)] border border-[var(--border-color)] px-3 py-1.5 rounded-md">Raw BEFORE payload</summary>
                      <div className="mt-2">{renderJsonPayload(selectedLog.before)}</div>
                    </details>
                    <details className="group">
                      <summary className="text-[0.6875rem] font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer select-none bg-[var(--bg-card-hover)] border border-[var(--border-color)] px-3 py-1.5 rounded-md">Raw AFTER payload</summary>
                      <div className="mt-2">{renderJsonPayload(selectedLog.after)}</div>
                    </details>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 border border-dashed border-[var(--border-color)] rounded-md">
                  <Database size={22} className="mx-auto opacity-20 mb-2 text-[var(--text-muted)]" />
                  <p className="text-xs text-[var(--text-muted)] px-4">Select a record in the ledger to inspect field-level changes and payloads.</p>
                </div>
              )}
            </div>
          </Card>

          <div className="flex gap-2.5 bg-[var(--status-success-bg)] border border-[var(--status-success-border)] rounded-lg p-3.5 text-xs items-start">
            <CheckCircle size={14} className="flex-shrink-0 mt-0.5 text-[var(--status-success-text)]" />
            <p className="text-[var(--status-success-text)] leading-relaxed">
              <strong className="font-medium">Write-once ledger:</strong> the database trigger
              <code className="font-mono"> prevent_audit_log_modification</code> permanently rejects
              UPDATE and DELETE on this table.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
