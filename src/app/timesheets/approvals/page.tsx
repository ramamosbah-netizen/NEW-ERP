// ============================================================
// JEET ERP — Timesheet Approvals Board
// Route: /timesheets/approvals
// ============================================================

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { 
  Check, 
  X, 
  RefreshCw, 
  ArrowLeft, 
  Clock, 
  FileText,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  UserCheck,
  Award
} from 'lucide-react';
import { useTimesheetApprovals } from '@/hooks/useTimesheet';
import { timesheetService } from '@/services/timesheetService';
import type { Timesheet, TimesheetEntry } from '@/types/timesheet.types';
import '../timesheets.css';

export default function TimesheetApprovalsPage() {
  const { queue, loading, error, refetch, approve, reject } = useTimesheetApprovals();
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Row expansion details state
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [details, setDetails] = useState<TimesheetEntry[]>([]);
  const [detailsLoading, setDetailsLoading] = useState(false);

  const toggleExpand = async (ts: Timesheet) => {
    if (expandedId === ts.id) {
      setExpandedId(null);
      setDetails([]);
      return;
    }

    try {
      setExpandedId(ts.id);
      setDetailsLoading(true);
      const { entries } = await timesheetService.getTimesheet(ts.employee_id, ts.week_start);
      setDetails(entries);
    } catch (err) {
      console.error('Failed to load timesheet details:', err);
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleApprove = async (id: string) => {
    if (!confirm('Are you sure you want to approve this timesheet? Approved hours will feed project actual costs.')) return;
    try {
      setProcessingId(id);
      await approve(id);
      setExpandedId(null);
    } catch (err: any) {
      alert(`Approval failed: ${err.message || err}`);
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (id: string) => {
    const reason = prompt('Please enter the rejection reason (mandatory):');
    if (!reason) {
      if (reason === '') alert('Rejection reason is mandatory.');
      return;
    }
    try {
      setProcessingId(id);
      await reject(id, reason);
      setExpandedId(null);
    } catch (err: any) {
      alert(`Rejection failed: ${err.message || err}`);
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="quote-container">
      {/* Header */}
      <header className="quote-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <Link href="/timesheets" className="text-[var(--text-secondary)] hover:text-[var(--accent)] font-mono text-[10px] uppercase flex items-center gap-1" style={{ textDecoration: 'none' }}>
              <ArrowLeft size={10} /> Back to My Timesheet
            </Link>
          </div>
          <h1 className="quote-header-title">Timesheet approvals Board</h1>
          <p className="quote-header-subtitle">Project Manager queue to audit and approve technician weekly hours allocations</p>
        </div>
        <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'center' }}>
          <button className="quote-btn quote-btn-secondary" onClick={refetch} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh Board
          </button>
        </div>
      </header>

      {/* Approvals Grid */}
      {loading && queue.length === 0 ? (
        <div style={{ padding: '4rem', textAlign: 'center' }} className="quote-card">
          <div className="spinner" style={{ margin: '0 auto 1rem auto' }}></div>
          <p>Analyzing submitted timesheets for project hour leaks...</p>
        </div>
      ) : error ? (
        <div style={{ padding: '2rem', textAlign: 'center', color: '#ef4444' }} className="quote-card">
          <p>Error loading queue: {error.message}</p>
        </div>
      ) : queue.length === 0 ? (
        <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }} className="quote-card">
          <UserCheck size={48} className="text-[var(--accent)]" style={{ margin: '0 auto 1rem auto', opacity: 0.8 }} />
          <h3 className="font-mono text-xs uppercase tracking-widest text-[var(--text-secondary)] font-bold mb-1">Board Cleared</h3>
          <p className="text-[11px] text-[var(--text-muted)]">All submitted timesheets have been verified and processed.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {queue.map((ts) => {
            const isExpanded = expandedId === ts.id;
            
            // Calculate details calculations if expanded
            const overheadHours = isExpanded ? details.filter(e => e.allocation_type === 'OVERHEAD').reduce((acc, e) => acc + Number(e.hours), 0) : 0;
            const totalHours = isExpanded ? details.reduce((acc, e) => acc + Number(e.hours), 0) : 0;
            const overheadPercentage = totalHours > 0 ? (overheadHours / totalHours) * 100 : 0;
            const hasOverheadWarning = overheadPercentage > 20;

            return (
              <div key={ts.id} className="quote-card" style={{ padding: 0 }}>
                {/* Header row */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.2rem', cursor: 'pointer' }} onClick={() => toggleExpand(ts)}>
                  <div>
                    <h3 className="font-semibold text-[var(--text-primary)] text-sm">
                      {ts.employee?.full_name_en}
                    </h3>
                    <div style={{ display: 'flex', gap: '1rem', marginTop: '0.2rem' }}>
                      <span className="font-mono text-[9px] text-[var(--accent)] uppercase tracking-tight">
                        Emp Code: {ts.employee?.employee_number}
                      </span>
                      <span className="font-mono text-[9px] text-[var(--text-muted)] uppercase tracking-tight">
                        Dept: {ts.employee?.department}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '2rem', alignItems: 'center' }}>
                    <div style={{ textAlign: 'right' }}>
                      <span className="text-[var(--text-muted)] uppercase font-mono text-[9px] block">Week start</span>
                      <span className="font-mono text-[11px] font-bold text-[var(--text-secondary)]">
                        {new Date(ts.week_start).toLocaleDateString('en-GB')}
                      </span>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span className="text-[var(--text-muted)] uppercase font-mono text-[9px] block">Regular Hrs</span>
                      <span className="font-mono text-[11px] font-bold text-[var(--text-secondary)]">
                        {ts.total_regular_hours}
                      </span>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span className="text-[var(--text-muted)] uppercase font-mono text-[9px] block">OT Hrs</span>
                      <span className="font-mono text-[11px] font-bold text-[var(--accent)]">
                        {ts.total_ot_hours}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: '0.4rem', marginLeft: '1rem' }} onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        className="quote-btn quote-btn-primary"
                        style={{ padding: '0.35rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.2rem', fontSize: '10px' }}
                        onClick={() => handleApprove(ts.id)}
                        disabled={processingId !== null}
                      >
                        <Check size={12} /> Approve
                      </button>
                      <button
                        type="button"
                        className="quote-btn"
                        style={{ padding: '0.35rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.2rem', fontSize: '10px', background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.3)' }}
                        onClick={() => handleReject(ts.id)}
                        disabled={processingId !== null}
                      >
                        <X size={12} /> Reject
                      </button>
                    </div>
                    <div>
                      {isExpanded ? <ChevronUp size={16} className="text-[var(--text-secondary)]" /> : <ChevronDown size={16} className="text-[var(--text-secondary)]" />}
                    </div>
                  </div>
                </div>

                {/* Expanded Details section */}
                {isExpanded && (
                  <div style={{ padding: '1.2rem', borderTop: '1px solid var(--border-color)', background: 'rgba(6, 8, 20, 0.3)' }}>
                    {detailsLoading ? (
                      <div style={{ padding: '2rem', textAlign: 'center' }}>
                        <div className="spinner" style={{ margin: '0 auto' }}></div>
                        <p className="text-[11px] mt-2">Compiling allocated hourly ledger lines...</p>
                      </div>
                    ) : (
                      <div>
                        {/* Overhead percentage warning */}
                        {hasOverheadWarning && (
                          <div className="overhead-warning-banner" style={{ marginBottom: '1rem' }}>
                            <AlertTriangle size={16} />
                            <div>
                              <strong>Overhead Threshold Violation:</strong> Employee has allocated {overheadPercentage.toFixed(1)}% of their week ({overheadHours} of {totalHours} hrs) to general company overhead. Limit is 20%.
                            </div>
                          </div>
                        )}

                        <div className="quote-table-wrap">
                          <table className="quote-table" style={{ fontSize: '10.5px' }}>
                            <thead>
                              <tr>
                                <th>Date</th>
                                <th>Type</th>
                                <th>Project Allocation</th>
                                <th>Ticket / Visit Number</th>
                                <th>Description / Sites</th>
                                <th style={{ textAlign: 'center' }}>Overtime</th>
                                <th style={{ textAlign: 'center' }}>Hours</th>
                              </tr>
                            </thead>
                            <tbody>
                              {details.map((entry) => (
                                <tr key={entry.id}>
                                  <td className="font-mono text-[var(--text-secondary)]">
                                    {new Date(entry.work_date).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: '2-digit' })}
                                  </td>
                                  <td>
                                    <span className="font-semibold text-[var(--text-secondary)]">{entry.allocation_type.replace('_', ' ')}</span>
                                  </td>
                                  <td className="text-[var(--text-secondary)]">
                                    {entry.project ? (
                                      <div>
                                        <div className="font-semibold">{entry.project.name}</div>
                                        <div className="font-mono text-[9px] text-[var(--text-muted)]">{entry.project.project_number}</div>
                                      </div>
                                    ) : '—'}
                                  </td>
                                  <td className="font-mono text-[var(--text-secondary)]">
                                    {entry.allocation_type === 'SERVICE_TICKET' ? `Ticket: ${entry.ticket_number || 'N/A'}` : 
                                     entry.allocation_type === 'PPM_VISIT' ? `Visit: ${entry.visit_number || 'N/A'}` : '—'}
                                  </td>
                                  <td className="text-[var(--text-secondary)]">{entry.description || '—'}</td>
                                  <td style={{ textAlign: 'center' }}>
                                    {entry.is_overtime ? (
                                      <span className="ot-badge weekend">
                                        {entry.ot_type === 'WEEKDAY_OT' ? '1.25x (WD)' : '1.50x (WE)'}
                                      </span>
                                    ) : '—'}
                                  </td>
                                  <td style={{ textAlign: 'center', fontWeight: 'bold' }} className="font-mono text-[var(--accent)]">
                                    {entry.hours}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
