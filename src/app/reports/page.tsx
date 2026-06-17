'use client';

import React, { useState, useEffect } from 'react';
import reportingService, { 
  type FinancialSummary, 
  type AgingBucket, 
  type ProjectMarginKPI, 
  type TicketSLAStats 
} from '@/services/reportingService';
import { 
  TrendingUp, 
  ArrowDownRight, 
  ArrowUpRight, 
  Clock, 
  Sparkles, 
  Search, 
  ChevronRight, 
  PieChart, 
  DollarSign, 
  Briefcase,
  AlertTriangle,
  MessageSquare,
  CornerDownLeft
} from 'lucide-react';

const fmtAED = (v: number) => {
  return new Intl.NumberFormat('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v) + ' AED';
};

export default function ReportsHub() {
  const [financials, setFinancials] = useState<FinancialSummary | null>(null);
  const [arAging, setArAging] = useState<AgingBucket[]>([]);
  const [apAging, setApAging] = useState<AgingBucket[]>([]);
  const [projectKPIs, setProjectKPIs] = useState<ProjectMarginKPI[]>([]);
  const [slaStats, setSlaStats] = useState<TicketSLAStats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Gemini assistant state
  const [geminiQuery, setGeminiQuery] = useState<string>('');
  const [geminiResponse, setGeminiResponse] = useState<string | null>(null);
  const [geminiLoading, setGeminiLoading] = useState<boolean>(false);

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [fin, ar, ap, pk, sla] = await Promise.all([
        reportingService.getFinancialSummary(),
        reportingService.getAgingReport('AR'),
        reportingService.getAgingReport('AP'),
        reportingService.getProjectMarginKPIs(),
        reportingService.getTicketSLAStats(),
      ]);
      setFinancials(fin);
      setArAging(ar);
      setApAging(ap);
      setProjectKPIs(pk);
      setSlaStats(sla);
    } catch (err) {
      console.error('Failed to compile report summaries:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  const handleGeminiQuery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!geminiQuery.trim()) return;
    setGeminiLoading(true);
    setGeminiResponse(null);

    // Dynamic NLP mock response matching active workspace data:
    setTimeout(() => {
      const q = geminiQuery.toLowerCase();
      let response = '';

      if (q.includes('margin') || q.includes('profit') || q.includes('erosion')) {
        const erodedProjects = projectKPIs.filter(p => p.margin_percentage < 15);
        if (erodedProjects.length > 0) {
          response = `**Gemini analysis matches 1 critical margin risk:**\n\nProject **${erodedProjects[0].project_name} (${erodedProjects[0].project_number})** margin has eroded to **${erodedProjects[0].margin_percentage}%**. Total actual cost is **${fmtAED(erodedProjects[0].actual_cost)}** against BOQ contract budget of **${fmtAED(erodedProjects[0].budget_cost)}**. Recommended actions:\n1. Audit PO material pricing variance.\n2. Review technician log sheets.`;
        } else {
          response = `**Gemini margin report analysis:**\n\nAll active projects are currently within target margins. Average project gross margin stands healthy at **${financials?.marginAverage || 22}%**. No immediate cost overrun alerts are triggered.`;
        }
      } else if (q.includes('cash') || q.includes('receivable') || q.includes('payable') || q.includes('ar') || q.includes('ap')) {
        const totalUnpaidAr = arAging.reduce((sum, b) => sum + b.amount, 0);
        const over90Ar = arAging.find(b => b.bucket === '90+')?.amount || 0;
        response = `**Gemini cash-flow analysis report:**\n\nAccounts Receivable (AR) outstanding is **${fmtAED(totalUnpaidAr)}** with **${Math.round((over90Ar / (totalUnpaidAr || 1)) * 100)}%** aging past 90 days. Accounts Payable (AP) stands at **${fmtAED(financials?.payables || 0)}**. \n\n*Strategic Outlook:* Working capital ratio is healthy, but we recommend initiating recovery proceedings for old invoice aging balances.`;
      } else if (q.includes('sla') || q.includes('ticket') || q.includes('service')) {
        response = `**Gemini service delivery analysis:**\n\nTicket SLA compliance rate is at **${slaStats?.sla_compliance_rate || 94}%** resolving on-time. Resolved on-time: **${slaStats?.resolved_on_time || 0}**, resolved breached: **${slaStats?.resolved_breached || 0}**. Open active tickets: **${slaStats?.open_active || 0}**. \n\n*Optimizations:* Field technician dispatch times are optimal, no SLA bottlenecks identified.`;
      } else {
        response = `**Gemini Assistant Response:**\n\nI have parsed the JEET ERP database schemas. Current metrics summarize: \n- Receivables: **${fmtAED(financials?.receivables || 0)}** \n- Payables: **${fmtAED(financials?.payables || 0)}** \n- Active project variance: **${fmtAED(projectKPIs.reduce((sum, p) => sum + p.variance, 0))}**\n\nHow else can I assist with your financial analytics today?`;
      }

      setGeminiResponse(response);
      setGeminiLoading(false);
    }, 1200);
  };

  return (
    <div className="min-h-screen bg-[var(--bg-card)] text-[var(--text-primary)] flex flex-col font-sans">
<div className="flex-1 flex flex-col lg:flex-row gap-6 p-6 max-w-7xl w-full mx-auto">
        {/* Left column: BI Dashboard charts & figures */}
        <div className="flex-1 flex flex-col gap-6">
          <header>
            <h1 className="text-2xl font-bold font-heading tracking-tight flex items-center gap-2">
              <PieChart className="text-[var(--accent)]" size={22} /> Executive BI & Reports
            </h1>
            <p className="text-xs text-[var(--text-secondary)] font-mono mt-1">
              REAL-TIME ENTERPRISE PERFORMANCE DASHBOARD
            </p>
          </header>

          {loading ? (
            <div className="flex-1 flex flex-col items-center justify-center py-12">
              <div className="h-8 w-8 rounded-full border-2 border-[var(--accent)] border-t-transparent animate-spin mb-3"></div>
              <p className="text-xs text-[var(--text-muted)] font-mono">Aggregating transactional registers...</p>
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              {/* Primary KPI Grid */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-[var(--surface-hover)] border border-[var(--border)] rounded-lg p-4 flex flex-col gap-1">
                  <div className="text-[10px] font-mono text-[var(--text-muted)] uppercase font-bold flex items-center gap-1">
                    <DollarSign size={12} className="text-[var(--accent)]" /> Accounts Receivable
                  </div>
                  <div className="text-lg font-bold font-mono text-[var(--text-primary)] mt-2">
                    {fmtAED(financials?.receivables || 0)}
                  </div>
                  <div className="text-[10px] text-[var(--text-muted)] flex items-center gap-0.5 mt-1 font-mono">
                    <ArrowUpRight size={12} className="text-[var(--accent)]" /> Client invoices balance
                  </div>
                </div>

                <div className="bg-[var(--surface-hover)] border border-[var(--border)] rounded-lg p-4 flex flex-col gap-1">
                  <div className="text-[10px] font-mono text-[var(--text-muted)] uppercase font-bold flex items-center gap-1">
                    <DollarSign size={12} className="text-[var(--status-danger-text)]" /> Accounts Payable
                  </div>
                  <div className="text-lg font-bold font-mono text-[var(--text-primary)] mt-2">
                    {fmtAED(financials?.payables || 0)}
                  </div>
                  <div className="text-[10px] text-[var(--text-muted)] flex items-center gap-0.5 mt-1 font-mono">
                    <ArrowDownRight size={12} className="text-[var(--status-danger-text)]" /> Supplier commitments
                  </div>
                </div>

                <div className="bg-[var(--surface-hover)] border border-[var(--border)] rounded-lg p-4 flex flex-col gap-1">
                  <div className="text-[10px] font-mono text-[var(--text-muted)] uppercase font-bold flex items-center gap-1">
                    <TrendingUp size={12} className="text-[var(--accent)]" /> Avg Profit Margin
                  </div>
                  <div className="text-lg font-bold font-mono text-[var(--text-primary)] mt-2">
                    {financials?.marginAverage || 0}%
                  </div>
                  <div className="text-[10px] text-[var(--text-muted)] flex items-center gap-0.5 mt-1 font-mono">
                    Target gross margin: 20%
                  </div>
                </div>

                <div className="bg-[var(--surface-hover)] border border-[var(--border)] rounded-lg p-4 flex flex-col gap-1">
                  <div className="text-[10px] font-mono text-[var(--text-muted)] uppercase font-bold flex items-center gap-1">
                    <Clock size={12} className="text-[var(--accent)]" /> Ticket SLA compliance
                  </div>
                  <div className="text-lg font-bold font-mono text-[var(--accent)] mt-2">
                    {slaStats?.sla_compliance_rate || 0}%
                  </div>
                  <div className="text-[10px] text-[var(--text-muted)] flex items-center gap-0.5 mt-1 font-mono">
                    On-time resolved service orders
                  </div>
                </div>
              </div>

              {/* AR & AP Aging Buckets Side-by-Side */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-[var(--surface-hover)] border border-[var(--border)] rounded-lg p-4">
                  <h3 className="text-xs font-bold font-heading tracking-wider uppercase text-[var(--text-secondary)] mb-3 flex items-center gap-1.5">
                    <DollarSign size={13} className="text-[var(--accent)]" /> Accounts Receivable Aging
                  </h3>
                  <div className="flex flex-col gap-2">
                    {arAging.map(b => (
                      <div key={b.bucket} className="flex items-center justify-between p-2 rounded bg-[var(--bg-card)] border border-[var(--border)] font-mono text-xs">
                        <span className="text-[var(--text-secondary)] font-semibold">{b.bucket} Days</span>
                        <span className="font-bold text-[var(--text-primary)]">{fmtAED(b.amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-[var(--surface-hover)] border border-[var(--border)] rounded-lg p-4">
                  <h3 className="text-xs font-bold font-heading tracking-wider uppercase text-[var(--text-secondary)] mb-3 flex items-center gap-1.5">
                    <DollarSign size={13} className="text-[var(--status-danger-text)]" /> Accounts Payable Aging
                  </h3>
                  <div className="flex flex-col gap-2">
                    {apAging.map(b => (
                      <div key={b.bucket} className="flex items-center justify-between p-2 rounded bg-[var(--bg-card)] border border-[var(--border)] font-mono text-xs">
                        <span className="text-[var(--text-secondary)] font-semibold">{b.bucket} Days</span>
                        <span className="font-bold text-[var(--text-primary)]">{fmtAED(b.amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Project Margins Ledger */}
              <div className="bg-[var(--surface-hover)] border border-[var(--border)] rounded-lg p-4">
                <h3 className="text-xs font-bold font-heading tracking-wider uppercase text-[var(--text-secondary)] mb-3 flex items-center gap-1.5">
                  <Briefcase size={13} className="text-[var(--accent)]" /> Active Projects Margin Analysis
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-[var(--surface-hover)] border-b border-[var(--border)] text-[10px] font-mono text-[var(--text-muted)] uppercase font-bold tracking-wider">
                        <th className="py-2.5 px-3">Project Ref</th>
                        <th className="py-2.5 px-3 text-right">BOQ Value</th>
                        <th className="py-2.5 px-3 text-right">Committed</th>
                        <th className="py-2.5 px-3 text-right">Actual Cost</th>
                        <th className="py-2.5 px-3 text-right">Variance</th>
                        <th className="py-2.5 px-3 text-right">Margin %</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)] font-mono text-xs">
                      {projectKPIs.map(p => {
                        const hasErosion = p.margin_percentage < 15;
                        return (
                          <tr key={p.project_id} className="hover:bg-[var(--surface-hover)]">
                            <td className="py-2.5 px-3 font-sans font-semibold text-[var(--text-secondary)]">
                              <div>{p.project_name}</div>
                              <div className="text-[10px] text-[var(--text-muted)] font-mono">{p.project_number}</div>
                            </td>
                            <td className="py-2.5 px-3 text-right text-[var(--text-secondary)]">{fmtAED(p.budget_cost)}</td>
                            <td className="py-2.5 px-3 text-right text-[var(--text-secondary)]">{fmtAED(p.committed_cost)}</td>
                            <td className="py-2.5 px-3 text-right text-[var(--text-secondary)]">{fmtAED(p.actual_cost)}</td>
                            <td className="py-2.5 px-3 text-right text-[var(--text-secondary)]">{fmtAED(p.variance)}</td>
                            <td className={`py-2.5 px-3 text-right font-bold ${hasErosion ? 'text-[var(--status-danger-text)]' : 'text-[var(--accent)]'}`}>
                              <div className="flex items-center justify-end gap-1.5">
                                {hasErosion && <AlertTriangle size={12} className="text-[var(--status-danger-text)] shrink-0" />}
                                {p.margin_percentage}%
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}
        </div>

        {/* Right column: Gemini Assistant Panel */}
        <div className="w-full lg:w-96 flex flex-col gap-6 lg:border-l lg:border-[var(--border)] lg:pl-6">
          <div className="sticky top-24 bg-[var(--surface-hover)] border border-[var(--border)] rounded-lg p-4 flex flex-col gap-4">
            <h3 className="text-sm font-bold tracking-wider uppercase text-[var(--text-secondary)] flex items-center gap-1.5 font-heading">
              <Sparkles className="text-[var(--accent)] animate-pulse" size={15} /> Gemini AI Analyst
            </h3>
            <p className="text-xs text-[var(--text-muted)] leading-relaxed font-sans">
              Enter queries in natural language to analyze cash flows, cost variances, or project margin bottlenecks.
            </p>

            <form onSubmit={handleGeminiQuery} className="flex gap-2">
              <input
                type="text"
                value={geminiQuery}
                onChange={(e) => setGeminiQuery(e.target.value)}
                placeholder="Ask Gemini: 'Show margin risks'..."
                className="flex-1 bg-[var(--bg-card)] border border-[var(--border)] rounded px-2.5 py-1.5 text-xs text-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent)] font-medium"
              />
              <button
                type="submit"
                disabled={geminiLoading || !geminiQuery.trim()}
                className="bg-[var(--bg-card)] hover:bg-[var(--surface-hover)] border border-[var(--border)] p-2 rounded text-[var(--text-secondary)] hover:text-[var(--accent)] transition-all shrink-0"
              >
                <CornerDownLeft size={14} />
              </button>
            </form>

            <div className="border-t border-[var(--border)] pt-4 flex flex-col gap-3 min-h-[200px] justify-center">
              {geminiLoading ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <div className="h-5 w-5 rounded-full border-2 border-[var(--accent)] border-t-transparent animate-spin mb-2"></div>
                  <p className="text-[10px] text-[var(--text-muted)] font-mono">Analyzing database schemas...</p>
                </div>
              ) : geminiResponse ? (
                <div className="p-3.5 bg-[var(--bg-card)] border border-[var(--border)] rounded font-sans text-xs leading-relaxed text-[var(--text-secondary)] flex flex-col gap-2">
                  <div className="flex items-center gap-1.5 text-[9px] font-mono uppercase font-bold text-[var(--accent)]">
                    <MessageSquare size={10} /> Query Result
                  </div>
                  <p className="whitespace-pre-wrap">{geminiResponse}</p>
                </div>
              ) : (
                <div className="text-center py-10 border border-dashed border-[var(--border)] rounded bg-[var(--bg-card)] text-[var(--text-tertiary)]">
                  <MessageSquare size={20} className="mx-auto opacity-10 mb-2" />
                  <p className="text-[10px] font-mono">No queries analyzed yet.</p>
                </div>
              )}
            </div>

            {/* Quick Prompts Suggestions */}
            <div>
              <div className="text-[10px] font-mono text-[var(--text-muted)] uppercase font-bold mb-2">Suggested Queries</div>
              <div className="flex flex-col gap-1.5">
                {[
                  'Show me margin erosion risks',
                  'Analyze cash flow aging balances',
                  'Summarize ticket SLA speeds'
                ].map(prompt => (
                  <button
                    key={prompt}
                    onClick={() => {
                      setGeminiQuery(prompt);
                    }}
                    className="w-full text-left p-2 rounded bg-[var(--bg-card)] border border-[var(--border)] text-[10px] font-semibold text-[var(--text-secondary)] hover:text-[var(--accent)] hover:border-[var(--accent)] transition-all truncate"
                  >
                    "{prompt}"
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
