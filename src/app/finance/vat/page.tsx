// ============================================================
// JEET ERP — UAE VAT Return Form 201 Filing Command
// Routes: /finance/vat
// Theme: Bloomberg Terminal Electric Mint
// ============================================================

'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import useVATPeriod from '@/hooks/useVATPeriod';
import { ArrowLeft, Lock, Calendar, Plus, ShieldCheck, AlertTriangle } from 'lucide-react';

export default function VATPeriodPage() {
  const {
    periods,
    selectedPeriodId,
    setSelectedPeriodId,
    form201,
    loading,
    computing,
    createPeriod,
    lockPeriod
  } = useVATPeriod();

  // Create Period form states
  const [showCreate, setShowCreate] = useState<boolean>(false);
  const [name, setName] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [deadline, setDeadline] = useState<string>('');
  const [saving, setSaving] = useState<boolean>(false);

  const formatAED = (v: number) => {
    return new Intl.NumberFormat('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v) + ' AED';
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !startDate || !endDate || !deadline) {
      alert('Please fill out all fields.');
      return;
    }
    try {
      setSaving(true);
      await createPeriod(name, startDate, endDate, deadline);
      setShowCreate(false);
      setName('');
      setStartDate('');
      setEndDate('');
      setDeadline('');
      alert('VAT Period created successfully.');
    } catch (err: any) {
      alert('Failed to create VAT period: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleLock = async () => {
    if (!selectedPeriodId) return;
    if (!confirm('Are you sure you want to LOCK this VAT period? This will lock all transactions and make this return report permanent.')) return;
    try {
      await lockPeriod(selectedPeriodId);
      alert('VAT Period locked successfully.');
    } catch (err: any) {
      alert('Failed to lock period: ' + err.message);
    }
  };

  const selectedPeriod = periods.find(p => p.id === selectedPeriodId);

  return (
    <div className="min-h-screen bg-[var(--bg-dark)] text-[var(--text-primary)] flex flex-col font-sans">
<main className="flex-1 max-w-6xl w-full mx-auto px-6 py-8 flex flex-col gap-6">
        {/* Header */}
        <div className="flex justify-between items-start gap-4 flex-wrap">
          <div>
            <div className="text-[10px] text-[var(--text-muted)] font-mono uppercase tracking-widest flex items-center gap-1">
              <Link href="/finance" className="hover:text-[var(--accent)] flex items-center gap-0.5"><ArrowLeft size={10} /> Finance Command</Link> &gt; <span className="text-[var(--text-secondary)]">UAE Form 201 VAT Return</span>
            </div>
            <h1 className="font-heading font-extrabold text-2xl tracking-tight text-[var(--text-primary)] uppercase mt-1">
              UAE VAT Form 201 Return
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowCreate(!showCreate)}
              className="bg-[var(--accent)] hover:bg-[var(--accent)] text-[var(--text-primary)] px-4 py-2 rounded text-xs font-semibold font-mono uppercase transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Plus size={14} /> New VAT Period
            </button>
          </div>
        </div>

        {/* Period creator dialog */}
        {showCreate && (
          <form onSubmit={handleCreate} className="bg-[var(--bg-card)] border border-[var(--border)] rounded p-6 max-w-xl flex flex-col gap-4">
            <h3 className="text-xs font-mono text-[var(--accent)] uppercase tracking-wider flex items-center gap-2">
              <Calendar size={14} /> Define New Period Lock
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="text-[var(--text-muted)] uppercase font-mono text-[9px] block mb-1">Period Name</label>
                <input
                  type="text"
                  placeholder="e.g. 2026-Q2"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-[var(--bg-card)] border border-[var(--border)] rounded px-3 py-2 text-[var(--text-primary)] font-sans focus:outline-none focus:border-[var(--accent)]"
                  required
                />
              </div>

              <div>
                <label className="text-[var(--text-muted)] uppercase font-mono text-[9px] block mb-1">Filing Deadline</label>
                <input
                  type="date"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  className="w-full bg-[var(--bg-card)] border border-[var(--border)] rounded px-3 py-2 text-[var(--text-primary)] font-sans focus:outline-none focus:border-[var(--accent)]"
                  required
                />
              </div>

              <div>
                <label className="text-[var(--text-muted)] uppercase font-mono text-[9px] block mb-1">Start Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full bg-[var(--bg-card)] border border-[var(--border)] rounded px-3 py-2 text-[var(--text-primary)] font-sans focus:outline-none focus:border-[var(--accent)]"
                  required
                />
              </div>

              <div>
                <label className="text-[var(--text-muted)] uppercase font-mono text-[9px] block mb-1">End Date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full bg-[var(--bg-card)] border border-[var(--border)] rounded px-3 py-2 text-[var(--text-primary)] font-sans focus:outline-none focus:border-[var(--accent)]"
                  required
                />
              </div>
            </div>

            <div className="flex gap-2.5 justify-end mt-2">
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="bg-[var(--surface-hover)] border border-[var(--border)] hover:border-[var(--border)] text-[var(--text-secondary)] font-mono text-[10px] uppercase font-bold px-4 py-2 rounded transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="bg-[var(--accent)] hover:bg-[var(--accent)] text-[var(--text-primary)] font-mono text-[10px] uppercase font-bold px-4 py-2 rounded transition-all cursor-pointer"
              >
                {saving ? 'Creating...' : 'Initialize Period'}
              </button>
            </div>
          </form>
        )}

        {/* Selected Period Stats Banner */}
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="flex flex-col gap-1.5">
            <span className="text-[var(--text-muted)] uppercase font-mono text-[9px] block">Select VAT Period Return</span>
            <select
              value={selectedPeriodId}
              onChange={(e) => setSelectedPeriodId(e.target.value)}
              className="bg-[var(--bg-card)] border border-[var(--border)] rounded px-4 py-2 text-sm text-[var(--text-primary)] font-sans focus:outline-none focus:border-[var(--accent)] w-48 font-bold"
            >
              {periods.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} {p.status === 'LOCKED' ? '🔒' : '🔓'}
                </option>
              ))}
            </select>
            {selectedPeriod && (
              <span className="text-[10px] text-[var(--text-secondary)] font-mono mt-1 block">
                Filing Range: {formatDate(selectedPeriod.start_date)} &ndash; {formatDate(selectedPeriod.end_date)} | Deadline: {formatDate(selectedPeriod.filing_deadline)}
              </span>
            )}
          </div>

          {selectedPeriod && (
            <div className="flex items-center gap-3 self-stretch md:self-auto">
              <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded px-4 py-3 flex flex-col justify-center min-w-32 text-center">
                <span className="text-[var(--text-muted)] uppercase font-mono text-[8px] block">Lock Status</span>
                <span className={`text-xs font-mono font-bold mt-1 block ${selectedPeriod.status === 'LOCKED' ? 'text-[var(--status-danger-text)]' : 'text-[var(--accent)]'}`}>
                  {selectedPeriod.status === 'LOCKED' ? '🔒 LOCKED' : '🔓 OPEN'}
                </span>
              </div>

              {selectedPeriod.status === 'OPEN' ? (
                <button
                  onClick={handleLock}
                  className="bg-[var(--status-danger-bg)] hover:bg-[var(--status-danger-bg)] text-[var(--text-primary)] font-bold uppercase font-mono text-xs px-5 py-3 rounded transition-all shadow-[0_0_15px_rgba(239,68,68,0.15)] flex items-center gap-1.5 cursor-pointer"
                >
                  <Lock size={14} /> Lock Period
                </button>
              ) : (
                <div className="bg-[var(--bg-dark)] border border-[var(--status-danger-border)] rounded px-4 py-3 text-[var(--text-secondary)] text-[10px] font-mono leading-normal flex items-start gap-2 max-w-xs">
                  <ShieldCheck size={16} className="text-[var(--status-danger-text)] shrink-0 mt-0.5" />
                  <div>
                    Locked by Auditor. This return ledger is certified and immutable.
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* VAT Return Form 201 Layout */}
        {computing ? (
          <div className="py-12 text-center text-[var(--text-muted)] font-mono text-xs">
            Aggregating output standard tax rules and reverse charge parameters...
          </div>
        ) : !form201 ? (
          <div className="py-12 text-center text-[var(--text-muted)] font-mono text-xs">
            No VAT filing data computed for selected period range.
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Left Columns: Output/Input details */}
            <div className="lg:col-span-2 flex flex-col gap-6">
              
              {/* VAT on Sales and Outputs (Box 1 - Box 8) */}
              <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded overflow-hidden">
                <div className="bg-[var(--bg-card)] px-4 py-3 border-b border-[var(--border)] flex justify-between items-center">
                  <h3 className="text-xs font-mono text-[var(--accent)] uppercase tracking-wider font-bold">
                    VAT on Sales and all other Outputs
                  </h3>
                  <span className="text-[9px] font-mono text-[var(--text-muted)]">Box 1 &ndash; Box 8</span>
                </div>

                <div className="divide-y divide-[var(--border)] text-xs">
                  
                  {/* Standard Rated Supplies - Emirates detail */}
                  <div className="p-4 bg-[var(--bg-card)]/20">
                    <span className="text-[10px] font-mono font-bold text-[var(--text-secondary)] block mb-3">
                      1. Standard rated supplies (divided by Emirate)
                    </span>
                    
                    <div className="flex flex-col gap-2 pl-3">
                      {[
                        { label: 'a) Abu Dhabi', data: form201.box1_abu_dhabi },
                        { label: 'b) Dubai', data: form201.box1_dubai },
                        { label: 'c) Sharjah', data: form201.box1_sharjah },
                        { label: 'd) Ajman', data: form201.box1_ajman },
                        { label: 'e) Umm Al Quwain', data: form201.box1_umm_al_quwain },
                        { label: 'f) Ras Al Khaimah', data: form201.box1_ras_al_khaimah },
                        { label: 'g) Fujairah', data: form201.box1_fujairah }
                      ].map((item) => (
                        <div key={item.label} className="grid grid-cols-3 gap-4 py-0.5 border-b border-[var(--border)] font-mono">
                          <span className="text-[var(--text-secondary)] font-sans text-xs">{item.label}</span>
                          <span className="text-right text-[var(--text-secondary)]">{formatAED(item.data.taxable_amount)}</span>
                          <span className="text-right text-[var(--accent)] font-bold">{formatAED(item.data.vat_amount)}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Tax Refunds to tourists */}
                  <div className="p-4 grid grid-cols-3 gap-4 font-mono">
                    <span className="text-[var(--text-secondary)] font-sans font-bold">2. Tax refunds provided to tourists</span>
                    <span className="text-right text-[var(--text-secondary)]">{formatAED(0)}</span>
                    <span className="text-right text-[var(--status-danger-text)] font-bold">{formatAED(0)}</span>
                  </div>

                  {/* Reverse Charge Provision */}
                  <div className="p-4 grid grid-cols-3 gap-4 font-mono">
                    <span className="text-[var(--text-secondary)] font-sans font-bold">3. Supplies subject to Reverse Charge (RCM)</span>
                    <span className="text-right text-[var(--text-secondary)]">{formatAED(form201.box3_reverse_charge.taxable_amount)}</span>
                    <span className="text-right text-[var(--accent)] font-bold">{formatAED(form201.box3_reverse_charge.vat_amount)}</span>
                  </div>

                  {/* Zero Rated Supplies */}
                  <div className="p-4 grid grid-cols-3 gap-4 font-mono">
                    <span className="text-[var(--text-secondary)] font-sans font-bold">4. Zero-rated supplies</span>
                    <span className="text-right text-[var(--text-secondary)]">{formatAED(form201.box4_zero_rated)}</span>
                    <span className="text-right text-[var(--text-muted)]">—</span>
                  </div>

                  {/* Exempt Supplies */}
                  <div className="p-4 grid grid-cols-3 gap-4 font-mono">
                    <span className="text-[var(--text-secondary)] font-sans font-bold">5. Exempt supplies</span>
                    <span className="text-right text-[var(--text-secondary)]">{formatAED(form201.box5_exempt)}</span>
                    <span className="text-right text-[var(--text-muted)]">—</span>
                  </div>

                  {/* Box 8: Total Outputs */}
                  <div className="p-4 bg-[var(--accent-glow)] grid grid-cols-3 gap-4 font-mono font-bold text-[var(--text-primary)]">
                    <span className="text-[var(--accent)] font-sans text-xs uppercase tracking-wider">8. Total Sales and Outputs</span>
                    <span className="text-right">{formatAED(form201.box8_total_outputs.taxable_amount)}</span>
                    <span className="text-right text-[var(--accent)]">{formatAED(form201.box8_total_outputs.vat_amount)}</span>
                  </div>
                </div>
              </div>

              {/* VAT on Expenses and Inputs (Box 9 - Box 11) */}
              <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded overflow-hidden">
                <div className="bg-[var(--bg-card)] px-4 py-3 border-b border-[var(--border)] flex justify-between items-center">
                  <h3 className="text-xs font-mono text-[var(--status-danger-text)] uppercase tracking-wider font-bold">
                    VAT on Expenses and all other Inputs
                  </h3>
                  <span className="text-[9px] font-mono text-[var(--text-muted)]">Box 9 &ndash; Box 11</span>
                </div>

                <div className="divide-y divide-[var(--border)] text-xs">
                  {/* Standard Rated Expenses */}
                  <div className="p-4 grid grid-cols-3 gap-4 font-mono">
                    <span className="text-[var(--text-secondary)] font-sans font-bold">9. Standard rated expenses</span>
                    <span className="text-right text-[var(--text-secondary)]">{formatAED(form201.box9_standard_rated_expenses.taxable_amount)}</span>
                    <span className="text-right text-[var(--accent)] font-bold">{formatAED(form201.box9_standard_rated_expenses.vat_amount)}</span>
                  </div>

                  {/* Reverse Charge Expenses */}
                  <div className="p-4 grid grid-cols-3 gap-4 font-mono">
                    <span className="text-[var(--text-secondary)] font-sans font-bold">10. Supplies subject to Reverse Charge (inputs)</span>
                    <span className="text-right text-[var(--text-secondary)]">{formatAED(form201.box10_reverse_charge_expenses.taxable_amount)}</span>
                    <span className="text-right text-[var(--accent)] font-bold">{formatAED(form201.box10_reverse_charge_expenses.vat_amount)}</span>
                  </div>

                  {/* Box 11: Total Inputs */}
                  <div className="p-4 bg-[var(--status-danger-bg)] grid grid-cols-3 gap-4 font-mono font-bold text-[var(--text-primary)]">
                    <span className="text-[var(--status-danger-text)] font-sans text-xs uppercase tracking-wider">11. Total Expenses and Inputs</span>
                    <span className="text-right">{formatAED(form201.box11_total_inputs.taxable_amount)}</span>
                    <span className="text-right text-[var(--status-danger-text)]">{formatAED(form201.box11_total_inputs.vat_amount)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right column: Net VAT position summaries */}
            <div className="flex flex-col gap-6">
              
              {/* Box 14: Net VAT position card */}
              <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded p-6 sticky top-24 flex flex-col gap-6">
                <div>
                  <h3 className="text-xs font-mono text-[var(--accent)] uppercase tracking-wider mb-2 flex items-center gap-2">
                    Net VAT Position
                  </h3>
                  <p className="text-[10px] text-[var(--text-secondary)] leading-relaxed">
                    VAT Payable represents output tax collected from clients minus recoverable input tax paid to suppliers.
                  </p>
                </div>

                <div className="flex flex-col gap-4 text-xs font-mono">
                  <div className="bg-[var(--bg-card)]/40 p-4 rounded border border-[var(--border)]">
                    <span className="text-[var(--text-muted)] block uppercase font-mono text-[9px]">Total Output VAT (12)</span>
                    <span className="font-mono text-sm font-bold text-[var(--accent)] mt-1 block">{formatAED(form201.box12_total_output_tax)}</span>
                  </div>

                  <div className="bg-[var(--bg-card)]/40 p-4 rounded border border-[var(--border)]">
                    <span className="text-[var(--text-muted)] block uppercase font-mono text-[9px]">Total Recoverable Input VAT (13)</span>
                    <span className="font-mono text-sm font-bold text-[var(--status-danger-text)] mt-1 block">{formatAED(form201.box13_total_input_tax)}</span>
                  </div>

                  <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded p-4 text-center">
                    <span className="text-[var(--text-secondary)] block uppercase font-mono text-[9px] font-bold">Net VAT Payable / (Recoverable) (14)</span>
                    <span className={`font-mono text-lg font-extrabold mt-2 block ${form201.box14_net_vat_due >= 0 ? 'text-[var(--accent)]' : 'text-[var(--status-danger-text)]'}`}>
                      {form201.box14_net_vat_due >= 0 ? '+' : ''}{formatAED(form201.box14_net_vat_due)}
                    </span>
                  </div>

                  {form201.box14_net_vat_due < 0 && (
                    <div className="bg-[var(--accent-glow)] border border-[var(--accent)] text-[var(--accent)] p-3 rounded flex gap-2 items-start leading-relaxed font-sans text-[10px]">
                      <AlertTriangle size={14} className="shrink-0 mt-0.5 text-[var(--accent)]" />
                      <div>
                        This period is in a **Recoverable** position. You may carry this forward or request a refund from the FTA.
                      </div>
                    </div>
                  )}

                  {form201.box14_net_vat_due >= 0 && (
                    <div className="bg-[var(--status-warning-bg)] border border-[var(--status-warning-border)] text-[var(--status-warning-text)] p-3 rounded flex gap-2 items-start leading-relaxed font-sans text-[10px]">
                      <AlertTriangle size={14} className="shrink-0 mt-0.5 text-[var(--status-warning-text)]" />
                      <div>
                        You have net VAT liability due to the FTA. Complete payment on the EmaraTax portal by the filing deadline.
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
