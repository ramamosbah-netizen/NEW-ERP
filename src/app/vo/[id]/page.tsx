// ============================================================
// JEET ERP — Variation Order (VO) Detail Overview & Operations Hub
// Routes: /vo/:id
// Theme: Bloomberg Terminal Electric Mint
// ============================================================

'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useVO } from '@/hooks/useVOs';
import { supabase } from '@/lib/supabase';
import { VO_STATUS_COLORS, VO_STATUS_LABELS, VO_TYPE_LABELS, VO_PRICING_BASIS_LABELS, VO_WORK_STATUS_LABELS } from '@/constants/vo.constants';
import { voApprovalService } from '@/services/voApprovalService';
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
      console.error(err);
      alert('Workflow action failed: ' + err.message);
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#060814] text-slate-100 flex flex-col font-sans">
<div className="flex-1 flex flex-col items-center justify-center py-20 text-slate-500 font-mono text-xs gap-3">
          <div className="animate-spin rounded-full h-5 w-5 border border-slate-700 border-t-emerald-400"></div>
          <span>Loading Variation Order parameters & historical events...</span>
        </div>
      </div>
    );
  }

  if (error || !vo) {
    return (
      <div className="min-h-screen bg-[#060814] text-slate-100 flex flex-col font-sans">
<main className="flex-1 max-w-4xl w-full mx-auto px-6 py-12">
          <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 p-6 rounded font-mono text-xs flex items-start gap-3">
            <ShieldAlert size={20} className="shrink-0" />
            <div>
              <strong className="block text-rose-300 font-bold mb-1">Failed to load Variation Record</strong>
              <span>{error?.message || 'The requested Variation Order was not found or is inactive.'}</span>
              <Link href="/vo" className="block mt-4 text-emerald-400 hover:underline">
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
    <div className="min-h-screen bg-[#060814] text-slate-100 flex flex-col font-sans">
<main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8 flex flex-col gap-6">
        
        {/* Header Navigation */}
        <div className="flex justify-between items-start">
          <div>
            <div className="text-[10px] text-slate-500 font-mono uppercase tracking-widest flex items-center gap-1">
              <Link href="/vo" className="hover:text-emerald-400 flex items-center gap-0.5"><ArrowLeft size={10} /> Registry</Link> &gt; <span>{vo.vo_number}</span>
            </div>
            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
              <h1 className="font-heading font-extrabold text-2xl tracking-tight text-slate-100 uppercase">
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
            <div className="text-xs text-slate-400 mt-1">
              Associated Project: <Link href={`/projects/${vo.project_id}`} className="font-bold text-emerald-400 hover:underline">{vo.project_number} — {vo.project_name}</Link>
            </div>
          </div>

          <button
            onClick={() => refetch()}
            className="text-slate-400 hover:text-slate-200 p-2 rounded hover:bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all cursor-pointer"
            title="Refresh detail view"
          >
            <RefreshCw size={14} />
          </button>
        </div>

        {/* Proceed-At-Risk Exposure Notification */}
        {vo.proceed_at_risk && vo.status !== 'CLIENT_APPROVED' && (
          <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 p-4 rounded flex gap-3 items-start leading-relaxed font-sans text-xs">
            <ShieldAlert size={20} className="text-rose-400 shrink-0 mt-0.5 animate-pulse" />
            <div>
              <strong className="block text-rose-300 font-bold mb-0.5">⚠️ Proceed-At-Risk Active Exposure</strong>
              <span>
                Site work has been marked in-progress or completed before client signature. The commercial exposure of {formatAED(vo.sell_amount)} is currently unapproved and pending client sign-off.
              </span>
            </div>
          </div>
        )}

        {/* Primary KPI Metrics Strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-950/20 border border-slate-900 p-4 rounded">
          <div>
            <span className="text-slate-500 block uppercase font-mono text-[9px]">Variation Selling Value</span>
            <span className={`font-mono text-lg font-extrabold mt-1 block ${vo.sell_amount < 0 ? 'text-rose-400' : 'text-slate-200'}`}>
              {vo.sell_amount < 0 ? '-' : ''}{formatAED(Math.abs(vo.sell_amount))}
            </span>
          </div>

          <div>
            <span className="text-slate-500 block uppercase font-mono text-[9px]">Direct Estimated Cost</span>
            <span className="font-mono text-lg font-extrabold text-slate-200 mt-1 block">
              {formatAED(vo.cost_amount)}
            </span>
          </div>

          <div>
            <span className="text-slate-500 block uppercase font-mono text-[9px]">Estimated Margin</span>
            <span className={`font-mono text-lg font-extrabold mt-1 block ${marginPct < 20 ? 'text-rose-400' : 'text-emerald-400'}`}>
              {marginPct.toFixed(1)}%
            </span>
          </div>

          <div>
            <span className="text-slate-500 block uppercase font-mono text-[9px]">Time Impact / Extension</span>
            <span className="font-mono text-lg font-extrabold text-slate-200 mt-1 block">
              {vo.time_impact_days || 0} work-days
            </span>
          </div>
        </div>

        {/* Two Column details layout */}
        <div className="flex flex-col lg:flex-row gap-6">
          
          {/* Main Scope and Line items column */}
          <div className="flex-1 flex flex-col gap-6">
            
            {/* Metadata Parameters Card */}
            <div className="bg-slate-950/40 border border-slate-900 rounded p-6 flex flex-col gap-4">
              <h3 className="text-xs font-mono text-emerald-400 uppercase tracking-wider border-b border-slate-900 pb-2">
                Scope Description & reference parameters
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-sans">
                <div>
                  <span className="text-slate-500 block">Instruction Reference:</span>
                  <strong className="text-slate-200 block mt-0.5">{vo.instruction_reference}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block">Instruction Date:</span>
                  <strong className="text-slate-200 block mt-0.5">{new Date(vo.instruction_date).toLocaleDateString('en-GB')}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block">Variation Type:</span>
                  <strong className="text-slate-200 block mt-0.5">{VO_TYPE_LABELS[vo.vo_type] || vo.vo_type}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block">Pricing Basis:</span>
                  <strong className="text-slate-200 block mt-0.5">{VO_PRICING_BASIS_LABELS[vo.pricing_basis] || vo.pricing_basis}</strong>
                </div>
              </div>

              <div className="text-xs font-sans border-t border-slate-900 pt-3">
                <span className="text-slate-500 block">Scope Details:</span>
                <p className="text-slate-300 mt-1 leading-relaxed whitespace-pre-line">{vo.description || 'No detailed scope description provided.'}</p>
              </div>

              {vo.justification && (
                <div className="text-xs font-sans border-t border-slate-900 pt-3">
                  <span className="text-slate-500 block">Justification / Reason:</span>
                  <p className="text-slate-300 mt-1 leading-relaxed whitespace-pre-line">{vo.justification}</p>
                </div>
              )}
            </div>

            {/* Line Items Table */}
            <div className="bg-slate-950/40 border border-slate-900 rounded overflow-hidden">
              <div className="bg-slate-950 px-4 py-3 border-b border-slate-900">
                <h4 className="text-xs font-mono text-slate-400 uppercase tracking-wide font-bold">
                  Priced Variation Lines
                </h4>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-900 text-slate-400 font-mono text-[9px] uppercase bg-slate-950/20">
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
                  <tbody className="divide-y divide-slate-900 font-mono text-xs text-slate-300">
                    {items.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-900/30 transition-colors">
                        <td className="py-2.5 px-4 text-slate-500">{item.line_no}</td>
                        <td className="py-2.5 px-4">
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                            item.action === 'ADD' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          }`}>
                            {item.action}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 font-semibold text-slate-150">
                          {item.description}
                          {item.boq_item_ref && (
                            <div className="text-[9px] text-slate-500 font-normal">BOQ Line Ref: {item.boq_item_ref}</div>
                          )}
                        </td>
                        <td className="py-2.5 px-4 text-[10px] text-slate-400">{item.system || 'OTHER'}</td>
                        <td className={`py-2.5 px-4 text-right font-bold ${item.quantity < 0 ? 'text-rose-400' : 'text-slate-300'}`}>
                          {item.quantity}
                        </td>
                        <td className="py-2.5 px-4 text-center text-slate-400">{item.unit}</td>
                        <td className="py-2.5 px-4 text-right">{item.unit_sell.toFixed(2)}</td>
                        <td className={`py-2.5 px-4 text-right font-bold ${item.line_sell < 0 ? 'text-rose-400' : 'text-slate-200'}`}>
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
            <div className="bg-slate-950/60 border border-slate-900 rounded p-6 flex flex-col gap-4">
              <h3 className="text-xs font-mono text-emerald-400 uppercase tracking-wider border-b border-slate-900 pb-2">
                Workflow operations
              </h3>

              {/* Status workflow triggers */}
              <div className="flex flex-col gap-3">
                
                {/* Draft / Priced stage -> Submit for Internal Signoff */}
                {(vo.status === 'DRAFT' || vo.status === 'PRICED') && (
                  <div className="flex flex-col gap-2 bg-[#0a0f26]/40 border border-slate-900 p-3.5 rounded text-xs">
                    <span className="font-mono text-slate-400">Step 1: Internal Submission</span>
                    <p className="text-slate-500 mt-1">Route this draft to the commercial review queue. Margins and values will check threshold authorization logic.</p>
                    <button
                      onClick={() => handleAction(() => actions.submitInternalReview('Submitted for internal approval review'), 'VO submitted for review successfully.')}
                      disabled={processing}
                      className="w-full mt-2 py-2 bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-bold font-mono rounded transition-all flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Send size={12} /> Submit Internal Review
                    </button>
                  </div>
                )}

                {/* Pending Internal review -> Approve / Reject */}
                {vo.status === 'PENDING_INTERNAL' && (
                  <div className="flex flex-col gap-2 bg-[#0a0f26]/40 border border-slate-900 p-3.5 rounded text-xs">
                    <span className="font-mono text-slate-400">Step 2: Internal Review Decision</span>
                    
                    {approvalPerms.allowed ? (
                      <>
                        <p className="text-slate-400 mt-1 font-semibold text-emerald-400">✓ You have approval credentials for this variation order.</p>
                        
                        <div className="flex gap-2 mt-2">
                          <button
                            onClick={() => handleAction(() => actions.approveInternal('Approved internally'), 'VO internally approved.')}
                            disabled={processing}
                            className="flex-1 py-2 bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-bold font-mono rounded transition-all flex items-center justify-center gap-1 cursor-pointer"
                          >
                            <Check size={12} /> Approve
                          </button>
                          <button
                            onClick={() => handleAction(() => actions.cancelVO('Rejected in internal review'), 'VO returned to draft.')}
                            disabled={processing}
                            className="flex-1 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 font-bold font-mono rounded transition-all flex items-center justify-center gap-1 cursor-pointer"
                          >
                            <X size={12} /> Reject
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="bg-slate-900 border border-slate-800 p-2.5 rounded text-[10px] text-slate-500 flex gap-2">
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
                  <div className="flex flex-col gap-2 bg-[#0a0f26]/40 border border-slate-900 p-3.5 rounded text-xs">
                    <span className="font-mono text-slate-400">Step 3: Client Distribution</span>
                    <p className="text-slate-500 mt-1">Compile the branded Tax/Variation Order PDF sheet and upload/file in DMS under Commercial documents.</p>
                    <button
                      onClick={() => handleAction(() => actions.submitToClient(), 'VO issued to client and compiled in DMS.')}
                      disabled={processing}
                      className="w-full mt-2 py-2 bg-purple-500 hover:bg-purple-400 text-white font-bold font-mono rounded transition-all flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <FileText size={12} /> Compile PDF & Issue
                    </button>
                  </div>
                )}

                {/* Issued to Client -> Record Sign-off / Signature */}
                {vo.status === 'SUBMITTED_TO_CLIENT' && (
                  <div className="flex flex-col gap-2 bg-[#0a0f26]/40 border border-slate-900 p-3.5 rounded text-xs">
                    <span className="font-mono text-slate-400">Step 4: Client Decision Recording</span>
                    <p className="text-slate-500 mt-1">Record client's signature, formal approval date, and link signed document from DMS to revise the project contract value.</p>
                    
                    <button
                      onClick={() => setClientApprovalOpen(true)}
                      className="w-full mt-2 py-2 bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-bold font-mono rounded transition-all flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <CheckCircle size={12} /> Record Client Approval
                    </button>

                    <button
                      onClick={() => setRejectionOpen(true)}
                      className="w-full py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 font-semibold font-mono rounded transition-all flex items-center justify-center gap-1 cursor-pointer text-[10px]"
                    >
                      <XCircle size={11} /> Record Rejection
                    </button>
                  </div>
                )}

                {/* Client Approved stage details */}
                {vo.status === 'CLIENT_APPROVED' && (
                  <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 p-3 rounded text-xs flex gap-2.5 items-start font-sans">
                    <CheckCircle size={16} className="shrink-0 mt-0.5" />
                    <div>
                      <strong className="block text-emerald-300 font-bold mb-0.5">Approved & Integrated</strong>
                      <span>Approved by client under Ref: <strong>{vo.client_approval_ref}</strong> on {vo.client_approval_date ? new Date(vo.client_approval_date).toLocaleDateString('en-GB') : 'N/A'}. Project contract value revised.</span>
                    </div>
                  </div>
                )}

                {/* Cancel option */}
                {vo.status !== 'CLIENT_APPROVED' && vo.status !== 'CANCELLED' && (
                  <button
                    onClick={() => setCancelOpen(true)}
                    className="w-full mt-1.5 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-500 hover:text-rose-400 text-[10px] font-mono rounded transition-all cursor-pointer"
                  >
                    Cancel Variation Order
                  </button>
                )}

              </div>

              {/* Work execution updates */}
              <div className="border-t border-slate-900 pt-4 mt-1 text-xs">
                <span className="font-mono text-slate-500 uppercase tracking-wider block mb-2">Update Physical Site Progress</span>
                <select
                  value={vo.work_status}
                  onChange={e => handleAction(() => actions.updateWorkStatus(e.target.value as any), 'Work status updated.')}
                  disabled={processing}
                  className="w-full bg-[#0a0f26] border border-slate-800 rounded py-1.5 px-3 text-xs text-slate-350 focus:outline-none"
                >
                  <option value="NOT_STARTED">Not Started on Site</option>
                  <option value="IN_PROGRESS">WIP (Work In Progress)</option>
                  <option value="COMPLETED">Completed on Site</option>
                </select>
              </div>
            </div>

            {/* Status History Logs */}
            <div className="bg-slate-950/60 border border-slate-900 rounded p-6 flex flex-col gap-4">
              <h3 className="text-xs font-mono text-emerald-400 uppercase tracking-wider border-b border-slate-900 pb-2">
                Approval workflow log
              </h3>

              <div className="flex flex-col gap-4 max-h-60 overflow-y-auto pr-1">
                {(vo.status_history || []).length === 0 ? (
                  <span className="text-slate-600 font-mono text-[10px]">No workflow transitions registered yet.</span>
                ) : (
                  (vo.status_history || []).map((log: any) => (
                    <div key={log.id} className="text-xs font-sans flex flex-col border-b border-slate-900 pb-2.5 last:border-0 last:pb-0">
                      <div className="flex justify-between items-start flex-wrap gap-1.5">
                        <span className="font-semibold text-slate-200">
                          {log.from_status} &rarr; <span className="text-emerald-400">{log.to_status}</span>
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {new Date(log.changed_at).toLocaleString('en-GB')}
                        </span>
                      </div>
                      {log.comment && (
                        <p className="text-slate-400 text-[11px] mt-1 font-mono italic">"{log.comment}"</p>
                      )}
                      <span className="text-[10px] text-slate-500 mt-0.5">
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
          <div className="bg-slate-950 border border-slate-900 rounded max-w-md w-full p-6 flex flex-col gap-4">
            <h4 className="text-xs font-mono text-emerald-400 uppercase tracking-widest font-bold border-b border-slate-900 pb-2 flex items-center gap-1.5">
              <CheckCircle size={14} /> Record Client Sign-off
            </h4>
            
            <div className="flex flex-col gap-3.5 text-xs">
              <div>
                <label className="block text-[10px] text-slate-500 font-mono uppercase mb-1">Approval Reference / Letter #</label>
                <input
                  type="text"
                  placeholder="e.g. CVO-LTR-09 or Project instruction 42"
                  value={approvalRef}
                  onChange={e => setApprovalRef(e.target.value)}
                  className="w-full bg-[#0a0f26] border border-slate-800 rounded py-2 px-3 text-xs text-slate-350 focus:outline-none focus:border-emerald-500/50"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] text-slate-500 font-mono uppercase mb-1">Approval Date</label>
                <input
                  type="date"
                  value={approvalDate}
                  onChange={e => setApprovalDate(e.target.value)}
                  className="w-full bg-[#0a0f26] border border-slate-800 rounded py-2 px-3 text-xs text-slate-350 focus:outline-none focus:border-emerald-500/50 font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] text-slate-500 font-mono uppercase mb-1">Link Signed Document (DMS)</label>
                <select
                  value={signedDocId}
                  onChange={e => setSignedDocId(e.target.value)}
                  className="w-full bg-[#0a0f26] border border-slate-800 rounded py-2 px-3 text-xs text-slate-300 focus:outline-none"
                >
                  <option value="">Select scanned PDF document...</option>
                  {documents.map(d => (
                    <option key={d.id} value={d.id}>{d.original_filename} ({d.title})</option>
                  ))}
                </select>
                <span className="text-[10px] text-slate-500 block mt-1">Upload the client-signed sheet to the DMS before linking.</span>
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
                className="flex-1 py-2 bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-bold font-mono rounded transition-all text-xs"
              >
                Submit Approval
              </button>
              <button
                type="button"
                onClick={() => setClientApprovalOpen(false)}
                className="flex-1 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 font-mono rounded text-xs"
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
          <div className="bg-slate-950 border border-slate-900 rounded max-w-md w-full p-6 flex flex-col gap-4">
            <h4 className="text-xs font-mono text-rose-500 uppercase tracking-widest font-bold border-b border-slate-900 pb-2 flex items-center gap-1.5">
              <XCircle size={14} /> Record Client Rejection
            </h4>
            
            <div className="flex flex-col gap-3.5 text-xs">
              <div>
                <label className="block text-[10px] text-slate-500 font-mono uppercase mb-1">Rejection Reason</label>
                <textarea
                  rows={3}
                  placeholder="Enter specific comments or reasons provided by the client..."
                  value={rejectionReason}
                  onChange={e => setRejectionReason(e.target.value)}
                  className="w-full bg-[#0a0f26] border border-slate-800 rounded py-2 px-3 text-xs text-slate-350 focus:outline-none"
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
                className="flex-1 py-2 bg-rose-500 text-white font-bold font-mono rounded transition-all text-xs"
              >
                Submit Rejection
              </button>
              <button
                type="button"
                onClick={() => setRejectionOpen(false)}
                className="flex-1 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 font-mono rounded text-xs"
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
          <div className="bg-slate-950 border border-slate-900 rounded max-w-md w-full p-6 flex flex-col gap-4">
            <h4 className="text-xs font-mono text-slate-400 uppercase tracking-widest font-bold border-b border-slate-900 pb-2 flex items-center gap-1.5">
              Cancel Variation Order
            </h4>
            
            <div className="flex flex-col gap-3.5 text-xs">
              <div>
                <label className="block text-[10px] text-slate-500 font-mono uppercase mb-1">Cancellation Reason</label>
                <textarea
                  rows={2}
                  placeholder="Specify details..."
                  value={cancelReason}
                  onChange={e => setCancelReason(e.target.value)}
                  className="w-full bg-[#0a0f26] border border-slate-800 rounded py-2 px-3 text-xs text-slate-355 focus:outline-none"
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
                className="flex-1 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-rose-400 font-bold font-mono rounded transition-all text-xs"
              >
                Cancel VO
              </button>
              <button
                type="button"
                onClick={() => setCancelOpen(false)}
                className="flex-1 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 font-mono rounded text-xs"
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
