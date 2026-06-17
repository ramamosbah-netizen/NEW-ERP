// ============================================================
// JEET ERP — Final Settlement Exit Calculator
// Route: /payroll/settlement
// ============================================================

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  ArrowLeft, 
  RefreshCw, 
  HelpCircle,
  FileText,
  UserX,
  AlertTriangle,
  Layers,
  Calculator,
  UserCheck
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useEOSB } from '@/hooks/useEOSB';
import { employeeService } from '@/services/employeeService';
import type { Employee, ExitType } from '@/types/hr.types';
import type { EosbCalculation } from '@/types/payroll.types';
import '../../hr/hr.css';

export default function SettlementPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmpId, setSelectedEmpId] = useState<string>('');
  
  // Settlement fields
  const [params, setParams] = useState({
    exitDate: new Date().toISOString().split('T')[0],
    unpaidLeaveDays: 0,
    leaveBalanceDays: 0,
    pendingSalaryDays: 0,
    outstandingAdvances: 0,
    exitType: 'RESIGNATION' as ExitType
  });

  // Employee details cache
  const [compensation, setCompensation] = useState<any | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [processing, setProcessing] = useState(false);

  const { calculateSettlement } = useEOSB();

  // Load active employees list
  useEffect(() => {
    async function loadActiveEmployees() {
      const { data } = await supabase
        .from('employees')
        .select('*')
        .eq('is_active', true)
        .eq('status', 'ACTIVE')
        .order('full_name_en');
      setEmployees(data || []);
    }
    loadActiveEmployees();
  }, []);

  const employee = employees.find(e => e.id === selectedEmpId);

  // Load employee compensation and leave balances
  useEffect(() => {
    if (!selectedEmpId) {
      setCompensation(null);
      return;
    }

    async function loadEmpFinancials() {
      try {
        setLoadingDetails(true);
        // 1. Fetch latest compensation
        const { data: comp } = await supabase
          .from('employee_compensation')
          .select('*')
          .eq('employee_id', selectedEmpId)
          .order('effective_from', { ascending: false })
          .limit(1)
          .maybeSingle();

        // 2. Fetch current year leave balance
        const currentYear = new Date().getFullYear();
        const { data: leaveBal } = await supabase
          .from('leave_balances')
          .select('*')
          .eq('employee_id', selectedEmpId)
          .eq('leave_type', 'ANNUAL')
          .eq('year', currentYear)
          .maybeSingle();

        setCompensation(comp || null);
        
        // Auto pre-fill leave balance days
        const remainingLeave = leaveBal ? Math.max(0, Number(leaveBal.entitled_days) - Number(leaveBal.taken_days)) : 0;
        setParams(prev => ({
          ...prev,
          leaveBalanceDays: Math.round(remainingLeave * 10) / 10
        }));
      } catch (err) {
        console.error('Failed to load employee details for settlement:', err);
      } finally {
        setLoadingDetails(false);
      }
    }
    loadEmpFinancials();
  }, [selectedEmpId]);

  const basicSalary = compensation ? Number(compensation.basic_salary) : 0;
  const allowances = compensation ? (Number(compensation.housing_allowance) + Number(compensation.transport_allowance) + Number(compensation.other_allowance)) : 0;
  const totalSalary = basicSalary + allowances;

  // Calculate settlement
  const calculationResult: EosbCalculation | null = (employee && compensation) ? calculateSettlement({
    joinDate: employee.join_date,
    exitDate: params.exitDate,
    basicSalary,
    totalSalary,
    unpaidLeaveDays: Number(params.unpaidLeaveDays) || 0,
    leaveBalanceDays: Number(params.leaveBalanceDays) || 0,
    pendingSalaryDays: Number(params.pendingSalaryDays) || 0,
    outstandingAdvances: Number(params.outstandingAdvances) || 0
  }) : null;

  const handleProcessExit = async () => {
    if (!employee || !calculationResult) return;
    const confirmMsg = `WARNING: Are you sure you want to finalize the settlement and exit process for ${employee.full_name_en}?\n\nThis will transition their status to EXITED and lock their profile.`;
    if (!confirm(confirmMsg)) return;

    try {
      setProcessing(true);
      
      // Update employee record
      await employeeService.updateEmployee(employee.id, {
        status: 'EXITED',
        exit_date: params.exitDate,
        exit_type: params.exitType
      });

      alert('Employee exit successfully processed and logged.');
      
      // Reload employees list and reset selection
      const { data } = await supabase
        .from('employees')
        .select('*')
        .eq('is_active', true)
        .eq('status', 'ACTIVE')
        .order('full_name_en');
      setEmployees(data || []);
      setSelectedEmpId('');
    } catch (err: any) {
      alert(`Process Exit failed: ${err.message || err}`);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="quote-container">
      {/* Header */}
      <header className="quote-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <Link href="/payroll" className="text-[var(--text-secondary)] hover:text-[var(--accent)] font-mono text-[10px] uppercase flex items-center gap-1" style={{ textDecoration: 'none' }}>
              <ArrowLeft size={10} /> Back to Payroll
            </Link>
          </div>
          <h1 className="quote-header-title">Final Settlement Exit panel</h1>
          <p className="quote-header-subtitle">UAE Labour Law compliant end-of-service gratuity and leave payout calculator</p>
        </div>
      </header>

      {/* Main calculation splitting grid */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        
        {/* Left Side: Parameters Inputs */}
        <div className="lg:col-span-2 space-y-6">
          <div className="quote-card">
            <h3 className="text-xs font-mono uppercase text-[var(--text-secondary)] font-bold mb-4 flex items-center gap-1.5">
              <Calculator size={14} /> Settlement parameters
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-[9px] font-mono text-[var(--text-secondary)] uppercase mb-1">Employee Member *</label>
                <select 
                  className="quote-filter-input w-full"
                  value={selectedEmpId}
                  onChange={(e) => setSelectedEmpId(e.target.value)}
                >
                  <option value="">-- Select Employee --</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.full_name_en} ({emp.employee_number})</option>
                  ))}
                </select>
              </div>

              {employee && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[9px] font-mono text-[var(--text-secondary)] uppercase mb-1">Exit Date *</label>
                      <input 
                        type="date" 
                        className="quote-filter-input w-full"
                        value={params.exitDate}
                        onChange={(e) => setParams(prev => ({ ...prev, exitDate: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-mono text-[var(--text-secondary)] uppercase mb-1">Exit Type *</label>
                      <select 
                        className="quote-filter-input w-full"
                        value={params.exitType}
                        onChange={(e) => setParams(prev => ({ ...prev, exitType: e.target.value as ExitType }))}
                      >
                        <option value="RESIGNATION">Resignation</option>
                        <option value="TERMINATION">Termination</option>
                        <option value="CONTRACT_END">Contract End</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[9px] font-mono text-[var(--text-secondary)] uppercase mb-1">Unpaid Leave Days</label>
                      <input 
                        type="number" 
                        min="0"
                        className="quote-filter-input w-full"
                        value={params.unpaidLeaveDays}
                        onChange={(e) => setParams(prev => ({ ...prev, unpaidLeaveDays: parseInt(e.target.value, 10) || 0 }))}
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-mono text-[var(--text-secondary)] uppercase mb-1">Remaining Leave Days</label>
                      <input 
                        type="number" 
                        min="0"
                        step="0.5"
                        className="quote-filter-input w-full"
                        value={params.leaveBalanceDays}
                        onChange={(e) => setParams(prev => ({ ...prev, leaveBalanceDays: parseFloat(e.target.value) || 0 }))}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[9px] font-mono text-[var(--text-secondary)] uppercase mb-1">Pending Salary Days</label>
                      <input 
                        type="number" 
                        min="0"
                        className="quote-filter-input w-full"
                        value={params.pendingSalaryDays}
                        onChange={(e) => setParams(prev => ({ ...prev, pendingSalaryDays: parseInt(e.target.value, 10) || 0 }))}
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-mono text-[var(--text-secondary)] uppercase mb-1">Advances Recovery (AED)</label>
                      <input 
                        type="number" 
                        min="0"
                        className="quote-filter-input w-full"
                        value={params.outstandingAdvances}
                        onChange={(e) => setParams(prev => ({ ...prev, outstandingAdvances: parseFloat(e.target.value) || 0 }))}
                      />
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Right Side: Ledger Receipt */}
        <div className="lg:col-span-3">
          {loadingDetails ? (
            <div className="quote-card flex flex-col items-center justify-center" style={{ padding: '6rem' }}>
              <div className="spinner mb-2"></div>
              <p className="text-[11px] font-mono">Compiling employee tenure and leaf balance details...</p>
            </div>
          ) : employee && calculationResult ? (
            <div className="quote-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              
              {/* Employee Parameters Sheet */}
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
                <div>
                  <h3 className="font-semibold text-[var(--text-primary)] text-sm">{employee.full_name_en}</h3>
                  <div className="font-mono text-[9px] text-[var(--text-muted)] uppercase mt-0.5">
                    Date Joined: {new Date(employee.join_date).toLocaleDateString('en-GB')}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span className="text-[var(--text-muted)] uppercase font-mono text-[9px] block">Tenure Period</span>
                  <span className="font-mono text-[11px] font-bold text-[var(--text-secondary)]">
                    {calculationResult.effectiveServiceDays} days ({(calculationResult.effectiveServiceDays / 365).toFixed(2)} yrs)
                  </span>
                </div>
              </div>

              {/* Receipt Ledger Rows */}
              <div className="space-y-3 font-mono text-[11px]">
                <div className="flex justify-between text-[var(--text-secondary)]">
                  <span>Basic Salary Base:</span>
                  <span className="text-[var(--text-primary)]">AED {basicSalary.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-[var(--text-secondary)]">
                  <span>Total Salary Base (with Allowances):</span>
                  <span className="text-[var(--text-primary)]">AED {totalSalary.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-[var(--text-secondary)] pt-2 border-t border-[var(--border)]">
                  <span>1. Gratuity EOSB Payout:</span>
                  <span className="text-[var(--accent)] font-bold">AED {calculationResult.gratuityAmount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-[var(--text-secondary)]">
                  <span>2. Leave Encashment ({calculationResult.leaveEncashmentDays} days):</span>
                  <span className="text-[var(--accent)] font-bold">AED {calculationResult.leaveEncashmentAmount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-[var(--text-secondary)]">
                  <span>3. Pending Salary ({params.pendingSalaryDays} days):</span>
                  <span className="text-[var(--accent)] font-bold">AED {calculationResult.pendingSalary.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-[var(--text-secondary)] text-[var(--status-danger-text)]">
                  <span>4. Deduct: Outstanding Advances:</span>
                  <span>-AED {calculationResult.outstandingAdvances.toLocaleString()}</span>
                </div>

                {/* Final Net Total */}
                <div className="flex justify-between text-[var(--text-primary)] pt-4 border-t-2 border-[var(--border)] text-sm font-bold bg-[var(--bg-card)] p-3 rounded">
                  <span className="text-[var(--accent)]">NET SETTLEMENT PAYOUT:</span>
                  <span className="text-[var(--accent)] text-base">
                    AED {calculationResult.totalSettlement.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* Warnings Banner if service is less than 1 year */}
              {calculationResult.effectiveServiceDays < 365 && (
                <div className="overhead-warning-banner" style={{ background: 'rgba(245, 158, 11, 0.1)', borderColor: 'var(--warning)', color: 'var(--warning)', margin: 0 }}>
                  <AlertTriangle size={16} />
                  <div>
                    Employee service is less than 365 days ({calculationResult.effectiveServiceDays} days). Under UAE Labour Law, no end-of-service gratuity is accrued.
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex justify-end pt-4 border-t border-[var(--border)]">
                <button 
                  type="button" 
                  className="quote-btn"
                  style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.3)' }}
                  onClick={handleProcessExit}
                  disabled={processing}
                >
                  <UserX size={14} className="mr-1.5 inline" /> {processing ? 'Processing Exit...' : 'Finalize & Log Exit'}
                </button>
              </div>
            </div>
          ) : (
            <div className="quote-card flex flex-col items-center justify-center" style={{ padding: '6rem' }}>
              <Layers size={48} className="text-[var(--text-tertiary)] mb-2" style={{ margin: '0 auto 1.5rem auto', opacity: 0.5 }} />
              <h3 className="font-mono text-xs uppercase tracking-widest text-[var(--text-secondary)] font-bold mb-1">Receipt Summary</h3>
              <p className="text-[11px] text-[var(--text-muted)] max-w-sm mx-auto">Select a staff member from the dropdown to audit tenure days and compute final payout details.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
