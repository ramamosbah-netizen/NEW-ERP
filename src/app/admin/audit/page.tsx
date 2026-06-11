'use client';

import React, { useState, useEffect } from 'react';
import { auditService } from '@/services/auditService';
import type { AuditLog, AuditLogFilter } from '@/types/audit.types';
import { 
  Search, 
  Filter, 
  Calendar, 
  Database, 
  User, 
  Eye, 
  Activity, 
  Terminal, 
  CheckCircle,
  FileCode,
  Clock,
  Globe
} from 'lucide-react';

export default function AuditTrailPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [selectedModule, setSelectedModule] = useState<string>('');
  const [selectedAction, setSelectedAction] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  
  // Diff viewer state
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const modules = ['QUOTATION', 'PROCUREMENT', 'FINANCE', 'SERVICE', 'TESTING', 'HR', 'INVENTORY', 'FLEET', 'ASSET', 'SYSTEM'];
  const actions = ['CREATE', 'UPDATE', 'DELETE', 'APPROVE', 'REJECT', 'LOGIN', 'EXPORT'];

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const filters: AuditLogFilter = {};
      if (search) filters.search = search;
      if (selectedModule) filters.module = selectedModule;
      if (selectedAction) filters.action = selectedAction;
      if (startDate) filters.startDate = new Date(startDate).toISOString();
      if (endDate) filters.endDate = new Date(endDate).toISOString();

      const data = await auditService.getLogs(filters);
      setLogs(data);
    } catch (err) {
      console.error('Error loading audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [selectedModule, selectedAction, startDate, endDate]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchLogs();
  };

  const clearFilters = () => {
    setSearch('');
    setSelectedModule('');
    setSelectedAction('');
    setStartDate('');
    setEndDate('');
    fetchLogs();
  };

  // Helper to render JSON nicely
  const renderJsonPayload = (data: any) => {
    if (!data) return <span className="text-slate-500 italic">None</span>;
    return (
      <pre className="p-3 bg-slate-950 border border-slate-900 rounded font-mono text-[11px] text-emerald-400 overflow-auto max-h-[250px]">
        {JSON.stringify(data, null, 2)}
      </pre>
    );
  };

  // Helper to render a visual diff between before and after keys
  const renderDiff = (before: any, after: any) => {
    if (!before && !after) return <div className="text-slate-500 italic">No change details recorded.</div>;
    
    const b = before || {};
    const a = after || {};
    const allKeys = Array.from(new Set([...Object.keys(b), ...Object.keys(a)]));

    return (
      <div className="border border-slate-900 rounded bg-slate-950/60 overflow-hidden text-xs">
        <div className="grid grid-cols-3 bg-slate-900 px-4 py-2 border-b border-slate-900 font-bold text-slate-400">
          <div>Field Key</div>
          <div>Previous Value</div>
          <div>New Value</div>
        </div>
        <div className="divide-y divide-slate-900 max-h-[300px] overflow-y-auto font-mono text-[11px]">
          {allKeys.map(key => {
            const valBefore = b[key];
            const valAfter = a[key];
            const isDifferent = JSON.stringify(valBefore) !== JSON.stringify(valAfter);

            if (!isDifferent) return null; // Only show changes

            return (
              <div key={key} className="grid grid-cols-3 px-4 py-2 hover:bg-slate-900/30">
                <div className="text-slate-400 font-semibold truncate pr-2">{key}</div>
                <div className="text-red-400/90 line-through truncate pr-2">
                  {valBefore !== undefined ? String(valBefore) : <span className="text-slate-700 italic">n/a</span>}
                </div>
                <div className="text-emerald-400 truncate pr-2">
                  {valAfter !== undefined ? String(valAfter) : <span className="text-slate-700 italic">deleted</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
<div className="flex-1 flex flex-col lg:flex-row gap-6 p-6 max-w-7xl w-full mx-auto">
        {/* Left Side: Timeline and Logs */}
        <div className="flex-1 flex flex-col gap-6">
          <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold font-heading tracking-tight flex items-center gap-2">
                <Activity className="text-emerald-400" size={22} /> Forensic Audit Ledger
              </h1>
              <p className="text-xs text-slate-400 font-mono mt-1">
                IMMUTABLE FORENSIC ACTIVITY MONITORING LAYER
              </p>
            </div>
            <button 
              onClick={clearFilters}
              className="px-3 py-1.5 rounded bg-slate-900 border border-slate-800 text-xs text-slate-400 hover:text-white hover:border-slate-700 transition-all font-semibold self-start"
            >
              Clear All Filters
            </button>
          </header>

          {/* Filtering Hub */}
          <div className="p-4 bg-slate-900/40 border border-slate-900 rounded-lg flex flex-col gap-4">
            <form onSubmit={handleSearchSubmit} className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 text-slate-500" size={16} />
                <input 
                  type="text"
                  placeholder="Search ledger by summary, entity type, action..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-900 rounded px-3 py-2 pl-10 text-xs text-slate-200 focus:outline-none focus:border-emerald-500/50 font-medium"
                />
              </div>
              <button 
                type="submit"
                className="bg-emerald-500 text-slate-950 font-bold px-4 py-2 rounded text-xs hover:bg-emerald-400 transition-all shadow-[0_0_15px_rgba(0,229,160,0.15)]"
              >
                Search
              </button>
            </form>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-[10px] font-mono text-slate-500 uppercase font-bold mb-1">Module</label>
                <select 
                  value={selectedModule} 
                  onChange={(e) => setSelectedModule(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-900 rounded px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-emerald-500/50"
                >
                  <option value="">All Modules</option>
                  {modules.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-mono text-slate-500 uppercase font-bold mb-1">Action Type</label>
                <select 
                  value={selectedAction} 
                  onChange={(e) => setSelectedAction(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-900 rounded px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-emerald-500/50"
                >
                  <option value="">All Actions</option>
                  {actions.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-mono text-slate-500 uppercase font-bold mb-1">From Date</label>
                <input 
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-900 rounded px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-emerald-500/50"
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono text-slate-500 uppercase font-bold mb-1">To Date</label>
                <input 
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-900 rounded px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-emerald-500/50"
                />
              </div>
            </div>
          </div>

          {/* Audit Ledger List */}
          <div className="flex-1 bg-slate-900/20 border border-slate-900 rounded-lg overflow-hidden flex flex-col min-h-[450px]">
            {loading ? (
              <div className="flex-1 flex flex-col items-center justify-center py-12">
                <div className="h-8 w-8 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin mb-3"></div>
                <p className="text-xs text-slate-500">Querying ledger logs...</p>
              </div>
            ) : logs.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center py-12 text-slate-500">
                <Database size={32} className="opacity-20 mb-2" />
                <p className="text-xs">No matching forensic logs found.</p>
              </div>
            ) : (
              <div className="overflow-x-auto flex-1">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-900/60 border-b border-slate-900 text-[10px] font-mono text-slate-500 uppercase font-bold tracking-wider">
                      <th className="py-3 px-4">Timestamp</th>
                      <th className="py-3 px-4">Actor</th>
                      <th className="py-3 px-4">Module / Scope</th>
                      <th className="py-3 px-4">Action</th>
                      <th className="py-3 px-4">Entity Details</th>
                      <th className="py-3 px-4 text-right">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-900 font-mono text-xs">
                    {logs.map(log => {
                      const date = new Date(log.occurred_at).toLocaleString('en-AE', { 
                        day: '2-digit', 
                        month: '2-digit', 
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit'
                      });

                      const isSelected = selectedLog?.id === log.id;

                      return (
                        <tr 
                          key={log.id} 
                          className={`hover:bg-slate-900/40 transition-colors ${isSelected ? 'bg-slate-900/80' : ''}`}
                        >
                          <td className="py-3 px-4 text-slate-400 whitespace-nowrap">{date}</td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-1.5">
                              <User size={13} className="text-slate-500" />
                              <div>
                                <div className="font-semibold text-slate-200">{log.actor_name}</div>
                                <div className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">{log.actor_role || 'SYSTEM'}</div>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-[10px] text-slate-300 font-semibold">
                              {log.module}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-semibold text-emerald-400">{log.action}</td>
                          <td className="py-3 px-4">
                            <div className="font-sans text-xs font-semibold text-slate-300 truncate max-w-[200px]">{log.summary}</div>
                            <div className="text-[10px] text-slate-500 mt-0.5 font-mono">ID: {log.entity_id.slice(0, 8)}...</div>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              onClick={() => setSelectedLog(log)}
                              className="p-1 rounded bg-slate-950 border border-slate-900 text-slate-400 hover:text-emerald-400 hover:border-emerald-500/20 transition-all inline-flex items-center gap-1 text-[10px] font-semibold"
                            >
                              <Eye size={12} /> Inspect
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Log Inspector Panel */}
        <div className="w-full lg:w-96 flex flex-col gap-6 lg:border-l lg:border-slate-900 lg:pl-6">
          <div className="sticky top-24 flex flex-col gap-6">
            <div className="p-4 bg-slate-900/40 border border-slate-900 rounded-lg">
              <h3 className="text-sm font-bold tracking-wider uppercase text-slate-400 flex items-center gap-1.5 mb-4 font-heading">
                <Terminal size={14} className="text-emerald-400" /> Audit Inspector
              </h3>

              {selectedLog ? (
                <div className="flex flex-col gap-4 font-sans text-xs">
                  <div className="border-b border-slate-900 pb-3">
                    <div className="text-[10px] text-slate-500 font-mono uppercase font-bold">Log Record ID</div>
                    <div className="font-mono text-emerald-400 font-bold mt-0.5">{selectedLog.id}</div>
                  </div>

                  <div>
                    <div className="text-[10px] text-slate-500 font-mono uppercase font-bold">Summary Description</div>
                    <div className="font-semibold text-slate-200 mt-1 leading-relaxed">{selectedLog.summary}</div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="text-[10px] text-slate-500 font-mono uppercase font-bold">IP Coordinates</div>
                      <div className="font-mono text-slate-300 mt-0.5 flex items-center gap-1">
                        <Globe size={11} className="text-slate-500" />
                        {selectedLog.ip || 'Local/Worker'}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-500 font-mono uppercase font-bold">Event Source</div>
                      <div className="font-mono text-slate-300 mt-0.5 flex items-center gap-1">
                        <Clock size={11} className="text-slate-500" />
                        {selectedLog.source}
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-slate-900 pt-4 flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono text-slate-500 uppercase font-bold flex items-center gap-1">
                        <FileCode size={13} className="text-emerald-400" /> State Payload Diff
                      </span>
                      <span className="text-[9px] text-slate-500 font-mono font-bold bg-slate-950 px-2 py-0.5 rounded border border-slate-900">
                        {selectedLog.entity_type}
                      </span>
                    </div>

                    {renderDiff(selectedLog.before, selectedLog.after)}

                    <div className="mt-2 flex flex-col gap-2">
                      <details className="group">
                        <summary className="text-[10px] font-mono font-bold text-slate-500 hover:text-slate-300 cursor-pointer select-none list-none flex items-center justify-between bg-slate-900 px-3 py-1.5 rounded border border-slate-900">
                          <span>VIEW RAW BEFORE payload</span>
                          <span className="text-[9px] transition-transform group-open:rotate-180">&#9662;</span>
                        </summary>
                        <div className="mt-2">{renderJsonPayload(selectedLog.before)}</div>
                      </details>

                      <details className="group">
                        <summary className="text-[10px] font-mono font-bold text-slate-500 hover:text-slate-300 cursor-pointer select-none list-none flex items-center justify-between bg-slate-900 px-3 py-1.5 rounded border border-slate-900">
                          <span>VIEW RAW AFTER payload</span>
                          <span className="text-[9px] transition-transform group-open:rotate-180">&#9662;</span>
                        </summary>
                        <div className="mt-2">{renderJsonPayload(selectedLog.after)}</div>
                      </details>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 border border-dashed border-slate-900 rounded bg-slate-950/20">
                  <Database size={24} className="mx-auto opacity-10 mb-2" />
                  <p className="text-[11px] text-slate-500">Select any record in the ledger timeline to inspect payload diffs and transaction details.</p>
                </div>
              )}
            </div>

            {/* Immutability Banner */}
            <div className="p-4 bg-emerald-950/10 border border-emerald-900/30 rounded-lg flex gap-3">
              <CheckCircle className="text-emerald-400 shrink-0 mt-0.5" size={16} />
              <div>
                <h4 className="text-xs font-bold text-emerald-400 font-heading">Ledger Integrity Active</h4>
                <p className="text-[10px] text-slate-400 leading-relaxed mt-1 font-mono">
                  This transaction log is backed by the database-level write-once constraint (prevent_audit_log_modification trigger). UPDATE and DELETE calls are permanently rejected.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
