// ============================================================
// JEET ERP — Variation Order (VO) Approvals Console
// Routes: /vo/approve
// Theme: Bloomberg Terminal Electric Mint
// ============================================================

'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useVOApprovalQueue } from '@/hooks/useVOs';
import { voService } from '@/services/voService';
import { supabase } from '@/lib/supabase';
import { voApprovalService } from '@/services/voApprovalService';
import { VO_WORK_STATUS_LABELS } from '@/constants/vo.constants';
import { 
  CheckCircle2, 
  XCircle, 
  RefreshCw, 
  Eye, 
  Clock, 
  TrendingUp, 
  FileCheck,
  ShieldAlert
} from 'lucide-react';

export default function VOApprovalQueuePage() {
  const { pendingApprovals, loading, error, refetch } = useVOApprovalQueue();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) {
        setCurrentUser(data.user);
      }
    });
  }, []);

  const formatAED = (v: number) => {
    return new Intl.NumberFormat('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v) + ' AED';
  };

  const handleApprove = async (vo: any) => {
    if (!currentUser) return;
    try {
      setProcessingId(vo.id);
      
      // Check auth threshold first
      const authCheck = await voApprovalService.evaluateApprovalPermissions(vo, currentUser.id);
      if (!authCheck.allowed) {
        alert(`Approval Denied: ${authCheck.reason || 'You are not authorized to approve this threshold.'}`);
        return;
      }

      const success = await voService.approveInternal(vo.id, 'Approved via quick action console');
      if (success) {
        alert(`Variation Order ${vo.vo_number} approved successfully.`);
        await refetch();
      }
    } catch (err: any) {
      console.error(err);
      alert('Approval failed: ' + err.message);
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (id: string) => {
    const comment = prompt('Enter rejection / return comment:');
    if (comment === null) return; // cancelled prompt
    
    try {
      setProcessingId(id);
      const success = await voService.cancelVO(id, comment || 'Returned to draft by manager');
      if (success) {
        alert('Variation Order returned/rejected successfully.');
        await refetch();
      }
    } catch (err: any) {
      console.error(err);
      alert('Action failed: ' + err.message);
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#060814] text-slate-100 flex flex-col font-sans">
<main className="flex-1 max-w-6xl w-full mx-auto px-6 py-8 flex flex-col gap-6">
        
        {/* Title Block */}
        <div className="flex justify-between items-center">
          <div>
            <div className="text-[10px] text-slate-500 font-mono uppercase tracking-widest">
              Commercial Sign-off & Audit
            </div>
            <h1 className="font-heading font-extrabold text-2xl tracking-tight text-slate-100 uppercase mt-1">
              Variation Approvals Console
            </h1>
          </div>

          <button
            onClick={() => refetch()}
            className="text-slate-400 hover:text-slate-200 p-2 rounded hover:bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all cursor-pointer"
            title="Refresh Approval Queue"
          >
            <RefreshCw size={14} />
          </button>
        </div>

        {/* Dashboard info card */}
        <div className="bg-[#0b122c] border border-[#162754] rounded p-4 text-xs flex items-start gap-2.5">
          <Clock className="text-[#00E5A0] shrink-0 mt-0.5 animate-pulse" size={16} />
          <div>
            <span className="font-mono text-slate-200 font-bold block">Internal Threshold Routing System</span>
            <p className="text-slate-400 mt-1 leading-normal">
              Variation Orders exceeding <strong className="text-emerald-400">50,000.00 AED</strong> require General Manager (GM) approval. Orders under this limit are routed to the Commercial Manager. Note: Self-approval check blocks creators from signing off their own variations.
            </p>
          </div>
        </div>

        {/* Queue table */}
        <div className="bg-slate-950/40 border border-slate-900 rounded overflow-hidden">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-500 font-mono text-xs gap-3">
              <div className="animate-spin rounded-full h-5 w-5 border border-slate-700 border-t-emerald-400"></div>
              <span>Scanning review queues...</span>
            </div>
          ) : error ? (
            <div className="p-8 text-center text-rose-450 font-mono text-xs">
              Error fetching queue: {error.message}
            </div>
          ) : pendingApprovals.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-500 font-mono text-xs gap-2.5">
              <FileCheck size={28} className="text-slate-700 animate-bounce" />
              <span>Approval queue is completely clear! No variations pending review.</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-900 text-slate-400 font-mono text-[10px] uppercase bg-slate-950/20">
                    <th className="py-3 px-4">Project</th>
                    <th className="py-3 px-4">VO Number</th>
                    <th className="py-3 px-4">Title / Instruction Reference</th>
                    <th className="py-3 px-4 text-right">Value (ex-VAT)</th>
                    <th className="py-3 px-4 text-center">Work Status</th>
                    <th className="py-3 px-4 text-center">Action Console</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-900 font-mono text-xs text-slate-350">
                  {pendingApprovals.map((vo) => {
                    const isProcessing = processingId === vo.id;
                    return (
                      <tr key={vo.id} className="hover:bg-slate-900/40 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-slate-200">{vo.project_number}</div>
                          <div className="text-[10px] text-slate-500 truncate max-w-[150px]" title={vo.project_name}>{vo.project_name}</div>
                        </td>
                        <td className="py-3.5 px-4 font-bold text-slate-100">
                          {vo.vo_number}
                          {vo.proceed_at_risk && (
                            <span className="ml-1.5 px-1.5 py-0.5 bg-rose-500/10 border border-rose-500/30 text-rose-400 text-[8px] rounded uppercase font-extrabold animate-pulse">
                              AT RISK
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 max-w-xs truncate" title={vo.title}>
                          <div className="font-semibold text-slate-200 truncate">{vo.title}</div>
                          <div className="text-[10px] text-slate-500 truncate">Ref: {vo.instruction_reference}</div>
                        </td>
                        <td className="py-3.5 px-4 text-right font-extrabold text-slate-200">
                          {formatAED(vo.sell_amount)}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span className={`text-[10px] ${vo.work_status === 'COMPLETED' ? 'text-emerald-400' : vo.work_status === 'IN_PROGRESS' ? 'text-amber-500' : 'text-slate-500'}`}>
                            {VO_WORK_STATUS_LABELS[vo.work_status] || vo.work_status}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <div className="flex justify-center items-center gap-2.5">
                            <Link
                              href={`/vo/${vo.id}`}
                              className="p-1 text-slate-400 hover:text-slate-200"
                              title="View full details"
                            >
                              <Eye size={14} />
                            </Link>
                            
                            <button
                              onClick={() => handleApprove(vo)}
                              disabled={isProcessing}
                              className="px-2 py-1 bg-emerald-400 hover:bg-emerald-350 text-slate-950 font-bold font-mono text-[9px] rounded uppercase disabled:opacity-40 cursor-pointer"
                              title="Approve internally"
                            >
                              Approve
                            </button>

                            <button
                              onClick={() => handleReject(vo.id)}
                              disabled={isProcessing}
                              className="px-2 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/25 font-bold font-mono text-[9px] rounded uppercase disabled:opacity-40 cursor-pointer"
                              title="Return / Reject"
                            >
                              Return
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </main>
    </div>
  );
}
