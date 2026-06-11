// ============================================================
// JEET ERP — Leave Approvals Queue
// Route: /hr/approvals
// ============================================================

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { 
  Check, 
  X, 
  RefreshCw, 
  ArrowLeft, 
  Calendar, 
  FileText,
  AlertTriangle,
  Clock,
  UserCheck
} from 'lucide-react';
import { useLeaveApprovals } from '@/hooks/useLeave';
import '../hr.css';

export default function LeaveApprovalsPage() {
  const { queue, loading, error, refetch, approve, reject } = useLeaveApprovals();
  const [processingId, setProcessingId] = useState<string | null>(null);

  const handleApprove = async (id: string) => {
    if (!confirm('Are you sure you want to approve this leave request?')) return;
    try {
      setProcessingId(id);
      await approve(id);
    } catch (err: any) {
      alert(`Approval failed: ${err.message || err}`);
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (id: string) => {
    const reason = prompt('Please enter rejection reason (optional):');
    if (reason === null) return; // cancelled
    try {
      setProcessingId(id);
      await reject(id);
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
            <Link href="/hr" className="text-slate-400 hover:text-emerald-400 font-mono text-[10px] uppercase flex items-center gap-1" style={{ textDecoration: 'none' }}>
              <ArrowLeft size={10} /> Back to Master
            </Link>
          </div>
          <h1 className="quote-header-title">Leave Approvals Queue</h1>
          <p className="quote-header-subtitle">Manager dashboard to review, approve, or reject employee leave requests</p>
        </div>
        <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'center' }}>
          <Link href="/hr/calendar" className="quote-btn quote-btn-secondary" style={{ textDecoration: 'none', display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
            <Calendar size={14} /> Leave Calendar
          </Link>
          <button className="quote-btn quote-btn-secondary" onClick={refetch} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh Queue
          </button>
        </div>
      </header>

      {/* Main Grid area */}
      {loading && queue.length === 0 ? (
        <div style={{ padding: '4rem', textAlign: 'center' }} className="quote-card">
          <div className="spinner" style={{ margin: '0 auto 1rem auto' }}></div>
          <p>Scanning registry for pending leave requests...</p>
        </div>
      ) : error ? (
        <div style={{ padding: '2rem', textAlign: 'center', color: '#ef4444' }} className="quote-card">
          <p>Error loading queue: {error.message}</p>
        </div>
      ) : queue.length === 0 ? (
        <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }} className="quote-card">
          <UserCheck size={48} className="text-emerald-400" style={{ margin: '0 auto 1rem auto', opacity: 0.8 }} />
          <h3 className="font-mono text-xs uppercase tracking-widest text-slate-300 font-bold mb-1">Queue Empty</h3>
          <p className="text-[11px] text-slate-500">All submitted employee leave requests have been processed.</p>
        </div>
      ) : (
        <div className="quote-card">
          <div className="quote-table-wrap">
            <table className="quote-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Department</th>
                  <th>Leave Type</th>
                  <th>Duration</th>
                  <th style={{ textAlign: 'center' }}>Total Days</th>
                  <th>Reason</th>
                  <th>Submitted At</th>
                  <th style={{ textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {queue.map((req) => (
                  <tr key={req.id}>
                    <td>
                      <div className="font-semibold text-slate-200">
                        {req.employee?.full_name_en}
                      </div>
                      <div className="font-mono text-[9px] text-emerald-400">
                        {req.employee?.employee_number}
                      </div>
                    </td>
                    <td className="font-mono text-[10px] text-slate-400">
                      {req.employee?.department || '—'}
                    </td>
                    <td>
                      <span className={`badge-status ${req.leave_type === 'ANNUAL' ? 'active' : req.leave_type === 'SICK' ? 'notice' : 'leave'}`}>
                        {req.leave_type.replace('_', ' ')}
                      </span>
                    </td>
                    <td>
                      <div className="font-mono text-[10px]">
                        {new Date(req.from_date).toLocaleDateString('en-GB')} to {new Date(req.to_date).toLocaleDateString('en-GB')}
                      </div>
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 'bold' }} className="font-mono text-emerald-400">
                      {req.days}
                    </td>
                    <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} className="text-slate-300" title={req.reason || ''}>
                      {req.reason || <span className="text-slate-600 font-mono italic text-[10px]">No reason provided</span>}
                    </td>
                    <td className="font-mono text-[10px] text-slate-500">
                      {new Date(req.created_at || '').toLocaleDateString('en-GB')}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center' }}>
                        <button
                          type="button"
                          className="quote-btn quote-btn-primary"
                          style={{ padding: '0.3rem 0.6rem', display: 'flex', alignItems: 'center', gap: '0.2rem', fontSize: '10px' }}
                          onClick={() => handleApprove(req.id)}
                          disabled={processingId !== null}
                        >
                          <Check size={10} /> Approve
                        </button>
                        <button
                          type="button"
                          className="quote-btn"
                          style={{ padding: '0.3rem 0.6rem', display: 'flex', alignItems: 'center', gap: '0.2rem', fontSize: '10px', background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.3)' }}
                          onClick={() => handleReject(req.id)}
                          disabled={processingId !== null}
                        >
                          <X size={10} /> Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
