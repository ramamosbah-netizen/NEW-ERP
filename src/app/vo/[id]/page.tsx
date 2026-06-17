// ============================================================
// JEET ERP — Variation Order (VO) Detail Overview & Operations Hub
// Routes: /vo/:id
// Theme: Bloomberg Terminal Electric Mint
// ============================================================

'use client';
import { logger } from '@/lib/logger';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useVO } from '@/hooks/useVOs';
import { supabase } from '@/lib/supabase';
import { VO_STATUS_COLORS, VO_STATUS_LABELS, VO_TYPE_LABELS, VO_PRICING_BASIS_LABELS, VO_WORK_STATUS_LABELS } from '@/constants/vo.constants';
import { voApprovalService } from '@/services/voApprovalService';
import WorkflowPanel from '@/components/workflow/WorkflowPanel';
import {
  ArrowLeft, 
  RefreshCw, 
  ShieldAlert, 
  CheckCircle, 
  XCircle, 
  Clock, 
  FileText, 
  Send, 
  Check, 
  X, 
  AlertTriangle,
  Upload,
  Calendar,
  Lock
} from 'lucide-react';

interface VODetailPageProps {
  params: Promise<{ id: string }>;
}

export default function VODetailPage({ params }: VODetailPageProps) {
  const router = useRouter();
  const { id } = React.use(params);

  // Hook details
  const { vo, items, loading, error, refetch, actions } = useVO(id);

  // Component UI State
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [approvalPerms, setApprovalPerms] = useState<{ allowed: boolean; reason?: string }>({ allowed: false });
  const [processing, setProcessing] = useState(false);

  // Comments for transitions
  const [statusComment, setStatusComment] = useState('');
  
  // Client Approval Dialog State
  const [clientApprovalOpen, setClientApprovalOpen] = useState(false);
  const [approvalRef, setApprovalRef] = useState('');
  const [approvalDate, setApprovalDate] = useState(new Date().toISOString().split('T')[0]);
  const [signedDocId, setSignedDocId] = useState('');
  
  // Client Rejection Dialog State
  const [rejectionOpen, setRejectionOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  // Cancel Dialog State
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  // Scanned files in DMS
  const [documents, setDocuments] = useState<any[]>([]);

  // Fetch current user and check approval permissions
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) {
        setCurrentUser(data.user);
      }
    });

    supabase.from('documents')
      .select('id, title, original_filename')
      .eq('category', 'COMMERCIAL')
      .then(({ data }) => setDocuments(data || []));
  }, []);

  useEffect(() => {
    if (vo && currentUser) {
      voApprovalService.evaluateApprovalPermissions(vo, currentUser.id).then(res => {
        setApprovalPerms(res);
      });
    }
  }, [vo, currentUser]);

  const formatAED = (v: number) => {
    return new Intl.NumberFormat('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v) + ' AED';
  };

  const handleAction = async (actionFn: () => Promise<boolean>, successMsg: string) => {
    try {
      setProcessing(true);
      const success = await actionFn();
      if (success) {
        alert(successMsg);
        setStatusComment('');
        await refetch();
      }
    } catch (err: any) {
      logger.error(err);
      alert('Workflow action failed: ' + err.message);
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="text-[var(--text-primary)] flex flex-col font-sans">
<div className="flex-1 flex flex-col items-center justify-center py-20 text-[var(--text-muted)] font-mono text-xs gap-3">
          <div className="animate-spin rounded-full h-5 w-5 border border-[var(--border)] border-t-emerald-400"></div>
          <span>Loading Variation Order parameters & historical events...</span>
        </div>
      </div>
    );
  }

  if (error || !vo) {
    return (
      <div className="text-[var(--text-primary)] flex flex-col font-sans">
<main className="flex-1 max-w-4xl w-full mx-auto px-6 py-12">
          <div className="bg-[var(--status-danger-bg)] border border-[var(--status-danger-border)] text-[var(--status-danger-text)] p-6 rounded font-mono text-xs flex items-start gap-3">
            <ShieldAlert size={20} className="shrink-0" />
            <div>
              <strong className="block text-[var(--status-danger-text)] font-bold mb-1">Failed to load Variation Record</strong>
              <span>{error?.message || 'The requested Variation Order was not found or is inactive.'}</span>
              <Link href="/vo" className="block mt-4 text-[var(--accent)] hover:underline">
                &larr; Back to Registry
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Margin calculation
  const sell = Number(vo.sell_amount || 0);
  const cost = Number(vo.cost_amount || 0);
  const marginAmt = sell - cost;
  const marginPct = sell !== 0 ? (marginAmt / sell) * 100 : 0;
  const colors = VO_STATUS_COLORS[vo.status] || { bg: 'rgba(0,0,0,0.1)', text: '#fff', border: 'rgba(0,0,0,0.2)' };

  return (
    <div className="text-[var(--text-primary)] flex flex-col font-sans">
<main className="flex flex-col gap-5">
        
        {/* Header Navigation */}
        <div className="flex justify-between items-start">
          <div>
            <div className="text-[10px] text-[var(--text-muted)] font-mono uppercase tracking-widest flex items-center gap-1">
              <Link href="/vo" className="hover:text-[var(--accent)] flex items-center gap-0.5"><ArrowLeft size={10} /> Registry</Link> &gt; <span>{vo.vo_number}</span>
            </div>
            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
              <h1 className="font-heading font-extrabold text-2xl tracking-tight text-[var(--text-primary)] uppercase">
                {vo.vo_number}
              </h1>
              <span
                style={{
                  backgroundColor: colors.bg,
                  color: colors.text,
                  borderColor: colors.border
                }}
                className="px-2.5 py-0.5 rounded border text-[10px] font-extrabold uppercase"
              >
                {VO_STATUS_LABELS[vo.status] || vo.status}
              </span>
            </div>
            <div className="text-xs text-[var(--text-secondary)] mt-1">
              Associated Project: <Link href={`/projects/${vo.project_id}`} className="font-bold text-[var(--accent)] hover:underline">{vo.project_number} — {vo.project_name}</Link>
            </div>
          </div>

          <button
            onClick={() => refetch()}
            className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] p-2 rounded hover:bg-[var(--surface-hover)] border border-[var(--border)] hover:border-[var(--border)] transition-all cursor-pointer"
            title="Refresh detail view"
          >
            <RefreshCw size={14} />
          </button>
        </div>

        {/* Proceed-At-Risk Exposure Notification */}
        {vo.proceed_at_risk && vo.status !== 'CLIENT_APPROVED' && (
          <div className="bg-[var(--status-danger-bg)] border border-[var(--status-danger-border)] text-[var(--status-danger-text)] p-4 rounded flex gap-3 items-start leading-relaxed font-sans text-xs">
            <ShieldAlert size={20} className="text-[var(--status-danger-text)] shrink-0 mt-0.5 animate-pulse" />
            <div>
              <strong className="block text-[var(--status-danger-text)] font-bold mb-0.5">⚠️ Proceed-At-Risk Active Exposure</strong>
              <span>
                Site work has been marked in-progress or completed before client signature. The commercial exposure of {formatAED(vo.sell_amount)} is currently unapproved and pending client sign-off.
              </span>
            </div>
          </div>
        )}

        {/* Primary KPI Metrics Strip */}
        {/* Configurable workflow (Admin Center → Workflows) */}
        <WorkflowPanel
          moduleKey="VO"
          entityId={id}
          context={{ status: vo.status, vo_type: vo.vo_type }}
          onStatusChange={() => refetch()}
          className="mb-4"
        />

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-[var(--bg-card)] border border-[var(--border)] p-4 rounded">
          <div>
            <span className="text-[var(--text-muted)] block uppercase font-mono text-[9px]">Variation Selling Value</span>
            <span className={`font-mono text-lg font-extrabold mt-1 block ${vo.sell_amount < 0 ? 'text-[var(--status-danger-text)]' : 'text-[var(--text-primary)]'}`}>
              {vo.sell_amount < 0 ? '-' : ''}{formatAED(Math.abs(vo.sell_amount))}
            </span>
          </div>

          <div>
            <span className="text-[var(--text-muted)] block uppercase font-mono text-[9px]">Direct Estimated Cost</span>
            <span className="font-mono text-lg font-extrabold text-[var(--text-primary)] mt-1 block">
              {formatAED(vo.cost_amount)}
            </span>
          </div>

          <div>
            <span className="text-[var(--text-muted)] block uppercase font-mono text-[9px]">Estimated Margin</span>
            <span className={`font-mono text-lg font-extrabold mt-1 block ${marginPct < 20 ? 'text-[var(--status-danger-text)]' : 'text-[var(--accent)]'}`}>
              {marginPct.toFixed(1)}%
            </span>
          </div>

          <div>
            <span className="text-[var(--text-muted)] block uppercase font-mono text-[9px]">Time Impact / Extension</span>
            <span className="font-mono text-lg font-extrabold text-[var(--text-primary)] mt-1 block">
              {vo.time_impact_days || 0} work-days
            </span>
          </div>
        </div>

        {/* Two Column details layout */}
        <div className="flex flex-col lg:flex-row gap-6">
          
          {/* Main Scope and Line items column */}
          <div className="flex-1 flex flex-col gap-6">
            
            {/* Metadata Parameters Card */}
            <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded p-6 flex flex-col gap-4">
              <h3 className="text-xs font-mono text-[var(--accent)] uppercase tracking-wider border-b border-[var(--border)] pb-2">
                Scope Description & reference parameters
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-sans">
                <div>
                  <span className="text-[var(--text-muted)] block">Instruction Reference:</span>
                  <strong className="text-[var(--text-primary)] block mt-0.5">{vo.instruction_reference}</strong>
                </div>
                <div>
                  <span className="text-[var(--text-muted)] block">Instruction Date:</span>
                  <strong className="text-[var(--text-primary)] block mt-0.5">{new Date(vo.instruction_date).toLocaleDateString('en-GB')}</strong>
                </div>
                <div>
                  <span className="text-[var(--text-muted)] block">Variation Type:</span>
                  <strong className="text-[var(--text-primary)] block mt-0.5">{VO_TYPE_LABELS[vo.vo_type] || vo.vo_type}</strong>
                </div>
                <div>
                  <span className="text-[var(--text-muted)] block">Pricing Basis:</span>
                  <strong className="text-[var(--text-primary)] block mt-0.5">{VO_PRICING_BASIS_LABELS[vo.pricing_basis] || vo.pricing_basis}</strong>
                </div>
              </div>

              <div className="text-xs font-sans border-t border-[var(--border)] pt-3">
                <span className="text-[var(--text-muted)] block">Scope Details:</span>
                <p className="text-[var(--text-secondary)] mt-1 leading-relaxed whitespace-pre-line">{vo.description || 'No detailed scope description provided.'}</p>
              </div>

              {vo.justification && (
                <div className="text-xs font-sans border-t border-[var(--border)] pt-3">
                  <span className="text-[var(--text-muted)] block">Justification / Reason:</span>
                  <p className="text-[var(--text-secondary)] mt-1 leading-relaxed whitespace-pre-line">{vo.justification}</p>
                </div>
              )}
            </div>

            {/* Line Items Table */}
            <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded overflow-hidden">
              <div className="bg-[var(--bg-card)] px-4 py-3 border-b border-[var(--border)]">
                <h4 className="text-xs font-mono text-[var(--text-secondary)] uppercase tracking-wide font-bold">
                  Priced Variation Lines
                </h4>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[var(--border)] text-[var(--text-secondary)] font-mono text-[9px] uppercase bg-[var(--bg-card)]">
                      <th className="py-2.5 px-4">Line</th>
                      <th className="py-2.5 px-4">Action</th>
                      <th className="py-2.5 px-4">Description</th>
                      <th className="py-2.5 px-4">System</th>
                      <th className="py-2.5 px-4 text-right">Qty</th>
                      <th className="py-2.5 px-4 text-center">Unit</th>
                      <th className="py-2.5 px-4 text-right">Unit Sell</th>
                      <th className="py-2.5 px-4 text-right">Line Sell (AED)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)] font-mono text-xs text-[var(--text-secondary)]">
                    {items.map((item) => (
                      <tr key={item.id} className="hover:bg-[var(--surface-hover)] transition-colors">
                        <td className="py-2.5 px-4 text-[var(--text-muted)]">{item.line_no}</td>
                        <td className="py-2.5 px-4">
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                            item.action === 'ADD' ? 'bg-[var(--accent-glow)] text-[var(--accent)] border border-[var(--accent)]' : 'bg-[var(--status-danger-bg)] text-[var(--status-danger-text)] border border-[var(--status-danger-border)]'
                          }`}>
                            {item.action}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 font-semibold text-[var(--text-primary)]">
                          {item.description}
                          {item.boq_item_ref && (
                            <div className="text-[9px] text-[var(--text-muted)] font-normal">BOQ Line Ref: {item.boq_item_ref}</div>
                          )}
                        </td>
                        <td className="py-2.5 px-4 text-[10px] text-[var(--text-secondary)]">{item.system || 'OTHER'}</td>
                        <td className={`py-2.5 px-4 text-right font-bold ${item.quantity < 0 ? 'text-[var(--status-danger-text)]' : 'text-[var(--text-secondary)]'}`}>
                          {item.quantity}
                        </td>
                        <td className="py-2.5 px-4 text-center text-[var(--text-secondary)]">{item.unit}</td>
                        <td className="py-2.5 px-4 text-right">{item.unit_sell.toFixed(2)}</td>
                        <td className={`py-2.5 px-4 text-right font-bold ${item.line_sell < 0 ? 'text-[var(--status-danger-text)]' : 'text-[var(--text-primary)]'}`}>
                          {item.line_sell.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

          </div>

          {/* Workflow and status sidebar column */}
          <div className="w-full lg:w-96 flex flex-col gap-6">
            
            {/* Workflow Action Panel */}
            <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded p-6 flex flex-col gap-4">
              <h3 className="text-xs font-mono text-[var(--accent)] uppercase tracking-wider border-b border-[var(--border)] pb-2">
                Workflow operations
              </h3>

              {/* Status workflow triggers */}
              <div className="flex flex-col gap-3">
                
                {/* Draft / Priced stage -> Submit for Internal Signoff */}
                {(vo.status === 'DRAFT' || vo.status === 'PRICED') && (
                  <div className="flex flex-col gap-2 bg-[var(--bg-card)]/40 border border-[var(--border)] p-3.5 rounded text-xs">
                    <span className="font-mono text-[var(--text-secondary)]">Step 1: Internal Submission</span>
                    <p className="text-[var(--text-muted)] mt-1">Route this draft to the commercial review queue. Margins and values will check threshold authorization logic.</p>
                    <button
                      onClick={() => handleAction(() => actions.submitInternalReview('Submitted for internal approval review'), 'VO submitted for review successfully.')}
                      disabled={processing}
                      className="w-full mt-2 py-2 bg-[var(--accent)] hover:bg-[var(--accent)] text-white font-bold font-mono rounded transition-all flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Send size={12} /> Submit Internal Review
                    </button>
                  </div>
                )}

                {/* Pending Internal review -> Approve / Reject */}
                {vo.status === 'PENDING_INTERNAL' && (
                  <div className="flex flex-col gap-2 bg-[var(--bg-card)]/40 border border-[var(--border)] p-3.5 rounded text-xs">
                    <span className="font-mono text-[var(--text-secondary)]">Step 2: Internal Review Decision</span>
                    
                    {approvalPerms.allowed ? (
                      <>
                        <p className="text-[var(--text-secondary)] mt-1 font-semibold text-[var(--accent)]">✓ You have approval credentials for this variation order.</p>
                        
                        <div className="flex gap-2 mt-2">
                          <button
                            onClick={() => handleAction(() => actions.approveInternal('Approved internally'), 'VO internally approved.')}
                            disabled={processing}
                            className="flex-1 py-2 bg-[var(--accent)] hover:bg-[var(--accent)] text-white font-bold font-mono rounded transition-all flex items-center justify-center gap-1 cursor-pointer"
                          >
                            <Check size={12} /> Approve
                          </button>
                          <button
                            onClick={() => handleAction(() => actions.cancelVO('Rejected in internal review'), 'VO returned to draft.')}
                            disabled={processing}
                            className="flex-1 py-2 bg-[var(--status-danger-bg)] hover:bg-[var(--status-danger-bg)] text-[var(--status-danger-text)] border border-[var(--status-danger-border)] font-bold font-mono rounded transition-all flex items-center justify-center gap-1 cursor-pointer"
                          >
                            <X size={12} /> Reject
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="bg-[var(--surface-hover)] border border-[var(--border)] p-2.5 rounded text-[10px] text-[var(--text-muted)] flex gap-2">
                        <Lock size={12} className="shrink-0 mt-0.5" />
                        <div>
                          <span>Approval locked: {approvalPerms.reason || 'Unauthorized for internal threshold.'}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Internally Approved -> Issue / Submit to Client */}
                {vo.status === 'INTERNALLY_APPROVED' && (
                  <div className="flex flex-col gap-2 bg-[var(--bg-card)]/40 border border-[var(--border)] p-3.5 rounded text-xs">
                    <span className="font-mono text-[var(--text-secondary)]">Step 3: Client Distribution</span>
                    <p className="text-[var(--text-muted)] mt-1">Compile the branded Tax/Variation Order PDF sheet and upload/file in DMS under Commercial documents.</p>
                    <button
                      onClick={() => handleAction(() => actions.submitToClient(), 'VO issued to client and compiled in DMS.')}
                      disabled={processing}
                      className="w-full mt-2 py-2 bg-purple-500 hover:bg-purple-400 text-[var(--text-primary)] font-bold font-mono rounded transition-all flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <FileText size={12} /> Compile PDF & Issue
                    </button>
                  </div>
                )}

                {/* Issued to Client -> Record Sign-off / Signature */}
                {vo.status === 'SUBMITTED_TO_CLIENT' && (
                  <div className="flex flex-col gap-2 bg-[var(--bg-card)]/40 border border-[var(--border)] p-3.5 rounded text-xs">
                    <span className="font-mono text-[var(--text-secondary)]">Step 4: Client Decision Recording</span>
                    <p className="text-[var(--text-muted)] mt-1">Record client's signature, formal approval date, and link signed document from DMS to revise the project contract value.</p>
                    
                    <button
                      onClick={() => setClientApprovalOpen(true)}
                      className="w-full mt-2 py-2 bg-[var(--accent)] hover:bg-[var(--accent)] text-white font-bold font-mono rounded transition-all flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <CheckCircle size={12} /> Record Client Approval
                    </button>

                    <button
                      onClick={() => setRejectionOpen(true)}
                      className="w-full py-1.5 bg-[var(--status-danger-bg)] hover:bg-[var(--status-danger-bg)] text-[var(--status-danger-text)] border border-[var(--status-danger-border)] font-semibold font-mono rounded transition-all flex items-center justify-center gap-1 cursor-pointer text-[10px]"
                    >
                      <XCircle size={11} /> Record Rejection
                    </button>
                  </div>
                )}

                {/* Client Approved stage details */}
                {vo.status === 'CLIENT_APPROVED' && (
                  <div className="bg-[var(--accent-glow)] border border-[var(--accent)] text-[var(--accent)] p-3 rounded text-xs flex gap-2.5 items-start font-sans">
                    <CheckCircle size={16} className="shrink-0 mt-0.5" />
                    <div>
                      <strong className="block text-[var(--accent)] font-bold mb-0.5">Approved & Integrated</strong>
                      <span>Approved by client under Ref: <strong>{vo.client_approval_ref}</strong> on {vo.client_approval_date ? new Date(vo.client_approval_date).toLocaleDateString('en-GB') : 'N/A'}. Project contract value revised.</span>
                    </div>
                  </div>
                )}

                {/* Cancel option */}
                {vo.status !== 'CLIENT_APPROVED' && vo.status !== 'CANCELLED' && (
                  <button
                    onClick={() => setCancelOpen(true)}
                    className="w-full mt-1.5 py-1.5 bg-[var(--surface-hover)] hover:bg-[var(--surface-hover)] border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--status-danger-text)] text-[10px] font-mono rounded transition-all cursor-pointer"
                  >
                    Cancel Variation Order
                  </button>
                )}

              </div>

              {/* Work execution updates */}
              <div className="border-t border-[var(--border)] pt-4 mt-1 text-xs">
                <span className="font-mono text-[var(--text-muted)] uppercase tracking-wider block mb-2">Update Physical Site Progress</span>
                <select
                  value={vo.work_status}
                  onChange={e => handleAction(() => actions.updateWorkStatus(e.target.value as any), 'Work status updated.')}
                  disabled={processing}
                  className="w-full bg-[var(--bg-card)] border border-[var(--border)] rounded py-1.5 px-3 text-xs text-[var(--text-secondary)] focus:outline-none"
                >
                  <option value="NOT_STARTED">Not Started on Site</option>
                  <option value="IN_PROGRESS">WIP (Work In Progress)</option>
                  <option value="COMPLETED">Completed on Site</option>
                </select>
              </div>
            </div>

            {/* Status History Logs */}
            <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded p-6 flex flex-col gap-4">
              <h3 className="text-xs font-mono text-[var(--accent)] uppercase tracking-wider border-b border-[var(--border)] pb-2">
                Approval workflow log
              </h3>

              <div className="flex flex-col gap-4 max-h-60 overflow-y-auto pr-1">
                {(vo.status_history || []).length === 0 ? (
                  <span className="text-[var(--text-tertiary)] font-mono text-[10px]">No workflow transitions registered yet.</span>
                ) : (
                  (vo.status_history || []).map((log: any) => (
                    <div key={log.id} className="text-xs font-sans flex flex-col border-b border-[var(--border)] pb-2.5 last:border-0 last:pb-0">
                      <div className="flex justify-between items-start flex-wrap gap-1.5">
                        <span className="font-semibold text-[var(--text-primary)]">
                          {log.from_status} &rarr; <span className="text-[var(--accent)]">{log.to_status}</span>
                        </span>
                        <span className="text-[10px] text-[var(--text-muted)] font-mono">
                          {new Date(log.changed_at).toLocaleString('en-GB')}
                        </span>
                      </div>
                      {log.comment && (
                        <p className="text-[var(--text-secondary)] text-[11px] mt-1 font-mono italic">"{log.comment}"</p>
                      )}
                      <span className="text-[10px] text-[var(--text-muted)] mt-0.5">
                        By: {log.changed_by_name || 'System'}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>

        </div>

      </main>

      {/* DIALOG: CLIENT APPROVAL FORM */}
      {clientApprovalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded max-w-md w-full p-6 flex flex-col gap-4">
            <h4 className="text-xs font-mono text-[var(--accent)] uppercase tracking-widest font-bold border-b border-[var(--border)] pb-2 flex items-center gap-1.5">
              <CheckCircle size={14} /> Record Client Sign-off
            </h4>
            
            <div className="flex flex-col gap-3.5 text-xs">
              <div>
                <label className="block text-[10px] text-[var(--text-muted)] font-mono uppercase mb-1">Approval Reference / Letter #</label>
                <input
                  type="text"
                  placeholder="e.g. CVO-LTR-09 or Project instruction 42"
                  value={approvalRef}
                  onChange={e => setApprovalRef(e.target.value)}
                  className="w-full bg-[var(--bg-card)] border border-[var(--border)] rounded py-2 px-3 text-xs text-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent)]"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] text-[var(--text-muted)] font-mono uppercase mb-1">Approval Date</label>
                <input
                  type="date"
                  value={approvalDate}
                  onChange={e => setApprovalDate(e.target.value)}
                  className="w-full bg-[var(--bg-card)] border border-[var(--border)] rounded py-2 px-3 text-xs text-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent)] font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] text-[var(--text-muted)] font-mono uppercase mb-1">Link Signed Document (DMS)</label>
                <select
                  value={signedDocId}
                  onChange={e => setSignedDocId(e.target.value)}
                  className="w-full bg-[var(--bg-card)] border border-[var(--border)] rounded py-2 px-3 text-xs text-[var(--text-secondary)] focus:outline-none"
                >
                  <option value="">Select scanned PDF document...</option>
                  {documents.map(d => (
                    <option key={d.id} value={d.id}>{d.original_filename} ({d.title})</option>
                  ))}
                </select>
                <span className="text-[10px] text-[var(--text-muted)] block mt-1">Upload the client-signed sheet to the DMS before linking.</span>
              </div>
            </div>

            <div className="flex gap-3 mt-4">
              <button
                type="button"
                onClick={() => {
                  if (!approvalRef.trim()) {
                    alert('Please enter an approval reference.');
                    return;
                  }
                  setClientApprovalOpen(false);
                  handleAction(
                    () => actions.recordClientApproval(approvalRef, approvalDate, signedDocId),
                    'Client approval recorded. Project BOQ and contract totals revised.'
                  );
                }}
                disabled={processing}
                className="flex-1 py-2 bg-[var(--accent)] hover:bg-[var(--accent)] text-white font-bold font-mono rounded transition-all text-xs"
              >
                Submit Approval
              </button>
              <button
                type="button"
                onClick={() => setClientApprovalOpen(false)}
                className="flex-1 py-2 bg-[var(--surface-hover)] hover:bg-[var(--surface-hover)] border border-[var(--border)] text-[var(--text-secondary)] font-mono rounded text-xs"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DIALOG: CLIENT REJECTION */}
      {rejectionOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded max-w-md w-full p-6 flex flex-col gap-4">
            <h4 className="text-xs font-mono text-[var(--status-danger-text)] uppercase tracking-widest font-bold border-b border-[var(--border)] pb-2 flex items-center gap-1.5">
              <XCircle size={14} /> Record Client Rejection
            </h4>
            
            <div className="flex flex-col gap-3.5 text-xs">
              <div>
                <label className="block text-[10px] text-[var(--text-muted)] font-mono uppercase mb-1">Rejection Reason</label>
                <textarea
                  rows={3}
                  placeholder="Enter specific comments or reasons provided by the client..."
                  value={rejectionReason}
                  onChange={e => setRejectionReason(e.target.value)}
                  className="w-full bg-[var(--bg-card)] border border-[var(--border)] rounded py-2 px-3 text-xs text-[var(--text-secondary)] focus:outline-none"
                  required
                />
              </div>
            </div>

            <div className="flex gap-3 mt-4">
              <button
                type="button"
                onClick={() => {
                  if (!rejectionReason.trim()) {
                    alert('Please enter a rejection reason.');
                    return;
                  }
                  setRejectionOpen(false);
                  handleAction(
                    () => actions.recordClientRejection(rejectionReason),
                    'Client rejection recorded.'
                  );
                }}
                disabled={processing}
                className="flex-1 py-2 bg-[var(--status-danger-bg)] text-[var(--text-primary)] font-bold font-mono rounded transition-all text-xs"
              >
                Submit Rejection
              </button>
              <button
                type="button"
                onClick={() => setRejectionOpen(false)}
                className="flex-1 py-2 bg-[var(--surface-hover)] hover:bg-[var(--surface-hover)] border border-[var(--border)] text-[var(--text-secondary)] font-mono rounded text-xs"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DIALOG: CANCEL */}
      {cancelOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded max-w-md w-full p-6 flex flex-col gap-4">
            <h4 className="text-xs font-mono text-[var(--text-secondary)] uppercase tracking-widest font-bold border-b border-[var(--border)] pb-2 flex items-center gap-1.5">
              Cancel Variation Order
            </h4>
            
            <div className="flex flex-col gap-3.5 text-xs">
              <div>
                <label className="block text-[10px] text-[var(--text-muted)] font-mono uppercase mb-1">Cancellation Reason</label>
                <textarea
                  rows={2}
                  placeholder="Specify details..."
                  value={cancelReason}
                  onChange={e => setCancelReason(e.target.value)}
                  className="w-full bg-[var(--bg-card)] border border-[var(--border)] rounded py-2 px-3 text-xs text-[var(--text-secondary)] focus:outline-none"
                  required
                />
              </div>
            </div>

            <div className="flex gap-3 mt-4">
              <button
                type="button"
                onClick={() => {
                  if (!cancelReason.trim()) {
                    alert('Please enter a reason.');
                    return;
                  }
                  setCancelOpen(false);
                  handleAction(
                    () => actions.cancelVO(cancelReason),
                    'Variation Order cancelled.'
                  );
                }}
                disabled={processing}
                className="flex-1 py-2 bg-[var(--surface-hover)] hover:bg-[var(--surface-hover)] border border-[var(--border)] text-[var(--status-danger-text)] font-bold font-mono rounded transition-all text-xs"
              >
                Cancel VO
              </button>
              <button
                type="button"
                onClick={() => setCancelOpen(false)}
                className="flex-1 py-2 bg-[var(--surface-hover)] hover:bg-[var(--surface-hover)] border border-[var(--border)] text-[var(--text-secondary)] font-mono rounded text-xs"
              >
                Back
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
