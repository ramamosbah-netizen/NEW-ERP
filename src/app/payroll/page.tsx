// ============================================================
// JEET ERP — Monthly Payroll Processing Panel
// Route: /payroll
// ============================================================

'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { 
  ArrowLeft, 
  Plus, 
  Trash2, 
  Check, 
  X, 
  RefreshCw, 
  AlertTriangle, 
  Award, 
  FileText, 
  Calendar,
  Layers,
  Percent,
  CheckCircle,
  HelpCircle
} from 'lucide-react';
import { usePayrollRun, usePayrollAdjustments } from '@/hooks/usePayrollRun';
import { supabase } from '@/lib/supabase';
import type { PayrollRun, PayrollLine, PayrollAdjustment } from '@/types/payroll.types';
import '../hr/hr.css';

export default function PayrollPage() {
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  });

  const [activeRunId, setActiveRunId] = useState<string | null>(null);

  // Hook for runs
  const { 
    payrollRuns, 
    currentRun, 
    currentLines, 
    loading, 
    error, 
    refetchRuns, 
    refetchDetails, 
    startRun, 
    approveRun, 
    deleteRun 
  } = usePayrollRun(activeRunId || undefined);

  // Hook for adjustments
  const {
    adjustments,
    loading: adjLoading,
    addAdjustment,
    approveAdjustment,
    rejectAdjustment
  } = usePayrollAdjustments(selectedMonth);

  // Form states for creating adjustment
  const [showAdjModal, setShowAdjModal] = useState(false);
  const [employees, setEmployees] = useState<any[]>([]);
  const [adjForm, setAdjForm] = useState({
    employee_id: '',
    adjustment_type: 'BONUS', // BONUS, DEDUCTION, ADVANCE_RECOVERY
    amount: '',
    reason: ''
  });

  // Load employees list for adjustment dropdown
  useEffect(() => {
    async function loadEmployees() {
      const { data } = await supabase
        .from('employees')
        .select('id, full_name_en, employee_number')
        .eq('is_active', true)
        .eq('status', 'ACTIVE')
        .order('full_name_en');
      setEmployees(data || []);
    }
    loadEmployees();
  }, []);

  // Map latest run for the selected month
  const currentMonthRun = payrollRuns.find(r => r.period_month?.startsWith(selectedMonth));

  useEffect(() => {
    if (currentMonthRun) {
      setActiveRunId(currentMonthRun.id);
    } else {
      setActiveRunId(null);
    }
  }, [currentMonthRun, selectedMonth]);

  // Comparative metrics for variance checks
  const [prevMonthLinesMap, setPrevMonthLinesMap] = useState<Record<string, number>>({});

  useEffect(() => {
    async function fetchPrevMonthDetails() {
      if (!selectedMonth) return;
      const [year, month] = selectedMonth.split('-');
      const d = new Date(parseInt(year, 10), parseInt(month, 10) - 2, 1); // 2 months back gives previous month in 0-indexed Date
      const prevMonthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      
      const { data: prevRun } = await supabase
        .from('payroll_runs')
        .select('id')
        .eq('period_month', `${prevMonthStr}-01`)
        .maybeSingle();

      if (prevRun) {
        const { data: prevLines } = await supabase
          .from('payroll_lines')
          .select('employee_id, net_pay')
          .eq('run_id', prevRun.id);

        const mapping: Record<string, number> = {};
        (prevLines || []).forEach(l => {
          mapping[l.employee_id] = Number(l.net_pay);
        });
        setPrevMonthLinesMap(mapping);
      } else {
        setPrevMonthLinesMap({});
      }
    }
    fetchPrevMonthDetails();
  }, [selectedMonth]);

  const handleStartPayroll = async () => {
    try {
      const res = await startRun(selectedMonth);
      setActiveRunId(res.id);
      alert('Payroll run compiled successfully.');
    } catch (err: any) {
      alert(`Payroll compilation failed: ${err.message || err}`);
    }
  };

  const handleApprovePayroll = async () => {
    if (!currentRun) return;
    if (!confirm(`Are you sure you want to approve and lock the payroll run for ${selectedMonth}? This will log a Direct Expense of AED ${currentRun.net_total} and lock all timesheets for this period.`)) return;
    try {
      await approveRun(currentRun.id);
      alert('Payroll run approved and locked successfully.');
    } catch (err: any) {
      alert(`Approval failed: ${err.message || err}`);
    }
  };

  const handleDeletePayroll = async () => {
    if (!currentRun) return;
    if (!confirm(`Are you sure you want to delete this draft payroll run for ${selectedMonth}? All calculated lines will be deleted.`)) return;
    try {
      await deleteRun(currentRun.id);
      setActiveRunId(null);
      alert('Draft payroll run deleted.');
    } catch (err: any) {
      alert(`Delete failed: ${err.message || err}`);
    }
  };

  const handleAddAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjForm.employee_id || !adjForm.amount || !adjForm.reason) {
      alert('Please fill out all fields.');
      return;
    }
    try {
      const amt = Number(adjForm.amount);
      const adjustmentType = adjForm.adjustment_type;
      // Negative amount for deductions/recoveries
      const finalAmt = (adjustmentType === 'DEDUCTION' || adjustmentType === 'ADVANCE_RECOVERY') ? -Math.abs(amt) : Math.abs(amt);

      await addAdjustment({
        employee_id: adjForm.employee_id,
        adjustment_type: adjustmentType,
        amount: finalAmt,
        reason: adjForm.reason
      });

      setShowAdjModal(false);
      setAdjForm({
        employee_id: '',
        adjustment_type: 'BONUS',
        amount: '',
        reason: ''
      });
      alert('Adjustment requested successfully.');
    } catch (err: any) {
      alert(`Failed to add adjustment: ${err.message || err}`);
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
          <h1 className="quote-header-title">Monthly Payroll runs</h1>
          <p className="quote-header-subtitle">UAE labor compliant payroll compiler, proration, and adjustments console</p>
        </div>
        <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'center' }}>
          <Link href="/payroll/sif" className="quote-btn quote-btn-secondary" style={{ textDecoration: 'none', display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
            <FileText size={14} /> WPS SIF Export
          </Link>
          <Link href="/payroll/eosb" className="quote-btn quote-btn-secondary" style={{ textDecoration: 'none', display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
            <Layers size={14} /> EOSB Gratuity report
          </Link>
          <Link href="/payroll/settlement" className="quote-btn quote-btn-secondary" style={{ textDecoration: 'none', display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
            <Layers size={14} /> Final Settlement
          </Link>
        </div>
      </header>

      {/* Month Selection Bar */}
      <div className="quote-card mb-6">
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span className="font-mono text-[9px] uppercase text-slate-500 mb-1">Payroll Period Month</span>
            <input 
              type="month" 
              className="quote-filter-input" 
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
            />
          </div>

          <div style={{ flex: 1 }} />

          {currentRun ? (
            <div style={{ display: 'flex', gap: '0.6rem' }}>
              {currentRun.status === 'DRAFT' && (
                <>
                  <button type="button" className="quote-btn quote-btn-primary flex items-center gap-1.5" onClick={handleApprovePayroll} disabled={loading}>
                    <CheckCircle size={14} /> Approve & Lock Run
                  </button>
                  <button type="button" className="quote-btn flex items-center gap-1.5" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.3)' }} onClick={handleDeletePayroll} disabled={loading}>
                    <Trash2 size={14} /> Delete Draft
                  </button>
                </>
              )}
              {currentRun.status === 'APPROVED' && (
                <span className="badge-status active flex items-center gap-1.5 px-3 py-1 font-mono">
                  <Check size={14} /> Run Approved & Locked
                </span>
              )}
            </div>
          ) : (
            <button type="button" className="quote-btn quote-btn-primary flex items-center gap-1.5" onClick={handleStartPayroll} disabled={loading}>
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Compile {selectedMonth} Payroll
            </button>
          )}
        </div>
      </div>

      {/* Main Content splits */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        
        {/* Left Side adjustments Card */}
        <div className="xl:col-span-1 space-y-6">
          <div className="quote-card">
            <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <h3 className="text-xs font-mono uppercase text-slate-300 font-bold">Monthly adjustments</h3>
              <button 
                type="button" 
                className="quote-btn quote-btn-primary" 
                style={{ padding: '0.2rem 0.5rem', fontSize: '9px' }}
                onClick={() => setShowAdjModal(true)}
              >
                <Plus size={10} /> Add
              </button>
            </div>

            {adjustments.length === 0 ? (
              <p className="text-[11px] text-slate-500 font-mono italic">No adjustments logged for this period.</p>
            ) : (
              <div className="space-y-3 max-h-[400px] overflow-y-auto">
                {adjustments.map((adj) => (
                  <div key={adj.id} className="border border-slate-900 rounded p-2.5 bg-slate-950/40 space-y-1">
                    <div className="flex justify-between items-start">
                      <span className="font-semibold text-slate-200 text-[11px] truncate block max-w-[120px]" title={adj.employee?.full_name_en}>
                        {adj.employee?.full_name_en}
                      </span>
                      <span className={`font-mono text-[10px] font-bold ${Number(adj.amount) < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                        AED {adj.amount}
                      </span>
                    </div>
                    <div className="font-mono text-[9px] text-slate-500">
                      Type: {adj.adjustment_type.replace('_', ' ')}
                    </div>
                    <div className="text-[10px] text-slate-400 leading-tight">
                      Reason: {adj.reason}
                    </div>
                    <div className="flex justify-between items-center pt-1 border-t border-slate-900/60 mt-1">
                      <span className={`badge-status ${adj.status.toLowerCase()}`} style={{ fontSize: '8px', padding: '1px 3px' }}>
                        {adj.status}
                      </span>
                      {adj.status === 'PENDING' && (
                        <div style={{ display: 'flex', gap: '3px' }}>
                          <button 
                            className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded p-0.5"
                            onClick={() => approveAdjustment(adj.id)}
                            title="Approve"
                          >
                            <Check size={10} />
                          </button>
                          <button 
                            className="bg-red-500/20 text-red-400 border border-red-500/30 rounded p-0.5"
                            onClick={() => rejectAdjustment(adj.id)}
                            title="Reject"
                          >
                            <X size={10} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Side Review Table Card */}
        <div className="xl:col-span-3">
          {currentRun ? (
            <div className="quote-card" style={{ padding: 0 }}>
              <div style={{ padding: '1.2rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 className="text-xs font-mono uppercase text-emerald-400 font-bold">Payroll calculation Sheet</h3>
                  <p className="text-[10px] text-slate-500 font-mono mt-0.5">Summary of gross to net wages. Highlights flag ±10% variances compared to previous month.</p>
                </div>
                <div style={{ display: 'flex', gap: '1.5rem', fontFamily: 'var(--font-mono)', fontSize: '11px' }}>
                  <div>
                    <span className="text-slate-500 block uppercase text-[9px]">Gross total</span>
                    <span className="text-slate-200 font-bold">AED {currentRun.gross_total.toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block uppercase text-[9px]">Net total</span>
                    <span className="text-emerald-400 font-bold">AED {currentRun.net_total.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              <div className="quote-table-wrap">
                <table className="quote-table" style={{ fontSize: '10px' }}>
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th>Department</th>
                      <th style={{ textAlign: 'right' }}>Basic</th>
                      <th style={{ textAlign: 'right' }}>Allowances</th>
                      <th style={{ textAlign: 'center' }}>OT Hrs (Amt)</th>
                      <th style={{ textAlign: 'right' }}>Leave Ded.</th>
                      <th style={{ textAlign: 'right' }}>adjustments</th>
                      <th style={{ textAlign: 'right' }}>Gross Pay</th>
                      <th style={{ textAlign: 'right' }}>Net Pay</th>
                      <th style={{ textAlign: 'center' }}>WPS days</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentLines.map((line) => {
                      const prevNet = prevMonthLinesMap[line.employee_id];
                      const currentNet = Number(line.net_pay);
                      
                      let isVarianceWarning = false;
                      let variancePercent = 0;
                      if (prevNet && prevNet > 0) {
                        variancePercent = ((currentNet - prevNet) / prevNet) * 100;
                        if (Math.abs(variancePercent) > 10) {
                          isVarianceWarning = true;
                        }
                      }

                      const allowances = Number(line.housing_allowance) + Number(line.transport_allowance) + Number(line.other_allowance);
                      
                      // Format adjustments summary
                      const adjAmt = (line.adjustments || []).reduce((acc: number, cur: any) => acc + Number(cur.amount), 0);

                      return (
                        <tr key={line.id}>
                          <td>
                            <div className="font-semibold text-slate-200">{line.employee?.full_name_en}</div>
                            <div className="font-mono text-[8px] text-slate-500">{line.employee?.employee_number}</div>
                          </td>
                          <td className="font-mono text-[9px] text-slate-500">{line.employee?.department}</td>
                          <td style={{ textAlign: 'right' }} className="font-mono text-slate-300">
                            {Number(line.basic_salary).toFixed(2)}
                          </td>
                          <td style={{ textAlign: 'right' }} className="font-mono text-slate-300">
                            {allowances.toFixed(2)}
                          </td>
                          <td style={{ textAlign: 'center' }} className="font-mono">
                            <span className="text-cyan-400">{line.ot_hours}h</span>
                            <span className="text-slate-500 ml-1">({Number(line.ot_amount).toFixed(0)})</span>
                          </td>
                          <td style={{ textAlign: 'right' }} className="font-mono text-red-400">
                            {Number(line.leave_deductions) > 0 ? `-${Number(line.leave_deductions).toFixed(2)}` : '0.00'}
                          </td>
                          <td style={{ textAlign: 'right' }} className={`font-mono ${adjAmt < 0 ? 'text-red-400' : adjAmt > 0 ? 'text-emerald-400' : 'text-slate-500'}`}>
                            {adjAmt === 0 ? '—' : adjAmt > 0 ? `+${adjAmt.toFixed(2)}` : adjAmt.toFixed(2)}
                          </td>
                          <td style={{ textAlign: 'right' }} className="font-mono text-slate-200">
                            {Number(line.gross_pay).toFixed(2)}
                          </td>
                          <td style={{ textAlign: 'right' }} className="font-mono font-bold">
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                              {isVarianceWarning && (
                                <span 
                                  className="text-amber-400" 
                                  title={`Variance Warning: ${variancePercent > 0 ? '+' : ''}${variancePercent.toFixed(1)}% variance vs previous month (AED ${prevNet.toFixed(0)})`}
                                >
                                  <AlertTriangle size={10} />
                                </span>
                              )}
                              <span className="text-emerald-400">
                                {currentNet.toFixed(2)}
                              </span>
                            </div>
                          </td>
                          <td style={{ textAlign: 'center' }} className="font-mono text-slate-400">{line.days_worked}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="quote-card" style={{ padding: '4rem', textAlign: 'center' }}>
              <Layers size={48} className="text-slate-600" style={{ margin: '0 auto 1.5rem auto', opacity: 0.5 }} />
              <h3 className="font-mono text-xs uppercase tracking-widest text-slate-300 font-bold mb-1">No Run Loaded</h3>
              <p className="text-[11px] text-slate-500 max-w-sm mx-auto mb-4">Select a payroll month and click compile to process salary, leave deductions, and OT calculations.</p>
            </div>
          )}
        </div>
      </div>

      {/* Add Adjustment Modal */}
      {showAdjModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-950 border border-slate-800 rounded-lg max-w-md w-full">
            <div className="flex justify-between items-center p-4 border-b border-slate-900">
              <h2 className="text-xs font-mono text-emerald-400 uppercase tracking-widest font-bold">Add Salary adjustment</h2>
              <button onClick={() => setShowAdjModal(false)} className="text-slate-500 hover:text-slate-200">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleAddAdjustment} className="p-4 space-y-4">
              <div>
                <label className="block text-[9px] font-mono text-slate-400 uppercase mb-1">Employee Member</label>
                <select 
                  required
                  className="quote-filter-input w-full"
                  value={adjForm.employee_id}
                  onChange={(e) => setAdjForm(prev => ({ ...prev, employee_id: e.target.value }))}
                >
                  <option value="">-- Select Employee --</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.full_name_en} ({emp.employee_number})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[9px] font-mono text-slate-400 uppercase mb-1">Adjustment Type</label>
                  <select 
                    className="quote-filter-input w-full"
                    value={adjForm.adjustment_type}
                    onChange={(e) => setAdjForm(prev => ({ ...prev, adjustment_type: e.target.value }))}
                  >
                    <option value="BONUS">Bonus / Incentive</option>
                    <option value="DEDUCTION">Salary Deduction</option>
                    <option value="ADVANCE_RECOVERY">Advance Recovery</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[9px] font-mono text-slate-400 uppercase mb-1">Amount (AED)</label>
                  <input 
                    required
                    type="number"
                    min="1"
                    className="quote-filter-input w-full"
                    placeholder="Enter amount"
                    value={adjForm.amount}
                    onChange={(e) => setAdjForm(prev => ({ ...prev, amount: e.target.value }))}
                  />
                </div>
              </div>

              <div>
                <label className="block text-[9px] font-mono text-slate-400 uppercase mb-1">Reason / Description</label>
                <input 
                  required
                  type="text"
                  className="quote-filter-input w-full"
                  placeholder="Reason for adjustment"
                  value={adjForm.reason}
                  onChange={(e) => setAdjForm(prev => ({ ...prev, reason: e.target.value }))}
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-900">
                <button type="button" className="quote-btn quote-btn-secondary" onClick={() => setShowAdjModal(false)}>Cancel</button>
                <button type="submit" className="quote-btn quote-btn-primary">Request adjustment</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
