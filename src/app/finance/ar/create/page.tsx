// ============================================================
// JEET ERP — Client Invoice Creation Page
// Routes: /finance/ar/create
// Theme: Bloomberg Terminal Electric Mint
// ============================================================

'use client';
import { logger } from '@/lib/logger';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { calculateInvoiceTotals, calculateInvoiceLine, round2 } from '@/services/invoiceMathService';
import { invoiceService } from '@/services/invoiceService';
import { Trash2, Plus, ArrowLeft } from 'lucide-react';

export default function InvoiceCreatePage() {
  const router = useRouter();

  // DB Options
  const [projects, setProjects] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Form Fields
  const [projectId, setProjectId] = useState('');
  const [clientId, setClientId] = useState('');
  const [invoiceType, setInvoiceType] = useState<'ADVANCE' | 'PROGRESS' | 'FINAL' | 'RETENTION_RELEASE' | 'STANDALONE'>('STANDALONE');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [supplyDate, setSupplyDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
  const [periodFrom, setPeriodFrom] = useState('');
  const [periodTo, setPeriodTo] = useState('');
  const [notes, setNotes] = useState('');

  // Deductions Pcts (for Progress Claims)
  const [advanceRecoveryRate, setAdvanceRecoveryRate] = useState(0); // e.g. 0.20 for 20%
  const [retentionRate, setRetentionRate] = useState(0); // e.g. 0.10 for 10%
  const [certifiedAmount, setCertifiedAmount] = useState<string>(''); // Consultant certified gross claim
  const [advanceIssued, setAdvanceIssued] = useState(0); // Real advance base = sum of ADVANCE invoices already issued for the project

  // Invoice Items
  const [items, setItems] = useState<Array<{
    description: string;
    quantity: number;
    unit: string;
    unit_price: number;
    vat_rate: number;
  }>>([
    { description: 'Contract Billing Item 1', quantity: 1, unit: 'Nos', unit_price: 0, vat_rate: 5.00 }
  ]);

  // Load clients and projects from DB
  useEffect(() => {
    const loadData = async () => {
      const { data: projData } = await supabase.from('projects').select('id, name, project_number, contract_value, revised_contract_value, original_contract_value');
      const { data: clientData } = await supabase.from('clients').select('id, name');
      
      setProjects(projData || []);
      setClients(clientData || []);
    };
    loadData();
  }, []);

  // Sync client_id when project changes (based on project owner client)
  useEffect(() => {
    if (projectId) {
      const project = projects.find(p => p.id === projectId);
      // Query project owner if not loaded directly
      supabase.from('projects').select('client_id').eq('id', projectId).single()
        .then(({ data }) => {
          if (data && data.client_id) {
            setClientId(data.client_id);
          }
        });
    }
  }, [projectId, projects]);

  // Load the REAL advance base: sum of ADVANCE invoices already issued for this project.
  // Drives advance-recovery math (replaces a hardcoded 20%-of-contract assumption that
  // recovered advance even when none was ever issued).
  useEffect(() => {
    if (!projectId) { setAdvanceIssued(0); return; }
    supabase
      .from('client_invoices')
      .select('gross_claim, taxable_amount, status')
      .eq('project_id', projectId)
      .eq('invoice_type', 'ADVANCE')
      .then(({ data }) => {
        const base = (data || [])
          .filter((r: any) => r.status !== 'CANCELLED' && r.status !== 'WRITTEN_OFF')
          .reduce((sum: number, r: any) => sum + (Number(r.gross_claim) || Number(r.taxable_amount) || 0), 0);
        setAdvanceIssued(round2(base));
      }, () => setAdvanceIssued(0));
  }, [projectId]);

  // Item Updates
  const handleItemChange = (index: number, key: string, val: any) => {
    const updated = [...items];
    (updated[index] as any)[key] = val;
    setItems(updated);
  };

  const addItemRow = () => {
    setItems(prev => [...prev, { description: '', quantity: 1, unit: 'Nos', unit_price: 0, vat_rate: 5.00 }]);
  };

  const removeItemRow = (index: number) => {
    if (items.length === 1) return;
    setItems(prev => prev.filter((_, idx) => idx !== index));
  };

  // Perform reactive calculation
  const selectedProj = projects.find(p => p.id === projectId);
  const selectedContractVal = selectedProj
    ? (selectedProj.revised_contract_value ?? selectedProj.original_contract_value ?? selectedProj.contract_value ?? 0)
    : 0;

  const totals = calculateInvoiceTotals({
    items: items.map(item => ({
      quantity: Number(item.quantity) || 0,
      unit_price: Number(item.unit_price) || 0,
      vat_rate: Number(item.vat_rate) || 5.00
    })),
    contract_value: selectedContractVal,
    total_advance_amount: advanceIssued, // Real advance base = sum of ADVANCE invoices issued for this project
    advance_recovery_rate: advanceRecoveryRate,
    retention_rate: retentionRate,
    gross_claim_override: certifiedAmount !== '' ? Number(certifiedAmount) : undefined
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId) {
      alert('Please select a client.');
      return;
    }

    try {
      setLoading(true);

      const invoiceData = {
        project_id: projectId || null,
        client_id: clientId,
        invoice_type: invoiceType,
        invoice_date: invoiceDate,
        supply_date: supplyDate,
        due_date: dueDate,
        period_from: periodFrom || null,
        period_to: periodTo || null,
        gross_claim: totals.gross_claim,
        advance_recovery: totals.advance_recovery,
        retention_held: totals.retention_held,
        certified_amount: certifiedAmount !== '' ? Number(certifiedAmount) : null,
        notes,
      };

      const result = await invoiceService.createInvoiceDraft(invoiceData as any, items);
      router.push(`/finance/ar/${result.id}`);
    } catch (err: any) {
      logger.error(err);
      alert('Failed to save invoice draft: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col">
<main className="flex flex-col gap-5">
        {/* Header */}
        <div>
          <div className="text-[10px] text-[var(--text-muted)] font-mono uppercase tracking-widest flex items-center gap-1">
            <Link href="/finance/ar" className="hover:text-[var(--accent)] flex items-center gap-0.5"><ArrowLeft size={10} /> Registry</Link> &gt; <span>New Draft</span>
          </div>
          <h1 className="font-heading font-extrabold text-2xl tracking-tight text-[var(--text-primary)] uppercase mt-1">
            Create Client Tax Invoice
          </h1>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col lg:flex-row gap-6">
          {/* Main Input Form */}
          <div className="flex-1 bg-[var(--bg-card)] border border-[var(--border)] rounded p-6 flex flex-col gap-5">
            <h3 className="text-xs font-mono text-[var(--accent)] uppercase tracking-wider border-b border-[var(--border)] pb-2">
              Invoice Parameters
            </h3>

            {/* Project / Client Selection Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] text-[var(--text-secondary)] font-mono uppercase mb-1.5">Project Reference</label>
                <select
                  value={projectId}
                  onChange={e => setProjectId(e.target.value)}
                  className="w-full bg-[var(--bg-card)] border border-[var(--border)] rounded py-2 px-3 text-xs text-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent)] font-mono"
                >
                  <option value="">Standalone / No Project</option>
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.project_number} — {p.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] text-[var(--text-secondary)] font-mono uppercase mb-1.5">Client Profile</label>
                <select
                  value={clientId}
                  onChange={e => setClientId(e.target.value)}
                  className="w-full bg-[var(--bg-card)] border border-[var(--border)] rounded py-2 px-3 text-xs text-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent)]"
                  required
                >
                  <option value="">Select Customer...</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Dates row */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-[10px] text-[var(--text-secondary)] font-mono uppercase mb-1.5">Invoice Type</label>
                <select
                  value={invoiceType}
                  onChange={e => setInvoiceType(e.target.value as any)}
                  className="w-full bg-[var(--bg-card)] border border-[var(--border)] rounded py-2 px-3 text-xs text-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent)]"
                >
                  <option value="STANDALONE">Standalone</option>
                  <option value="ADVANCE">Advance Payment</option>
                  <option value="PROGRESS">Progress Claim</option>
                  <option value="FINAL">Final Billing</option>
                  <option value="RETENTION_RELEASE">Retention Release</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] text-[var(--text-secondary)] font-mono uppercase mb-1.5">Invoice Date</label>
                <input
                  type="date"
                  value={invoiceDate}
                  onChange={e => setInvoiceDate(e.target.value)}
                  className="w-full bg-[var(--bg-card)] border border-[var(--border)] rounded py-2 px-3 text-xs text-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent)] font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] text-[var(--text-secondary)] font-mono uppercase mb-1.5">Supply Date</label>
                <input
                  type="date"
                  value={supplyDate}
                  onChange={e => setSupplyDate(e.target.value)}
                  className="w-full bg-[var(--bg-card)] border border-[var(--border)] rounded py-2 px-3 text-xs text-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent)] font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] text-[var(--text-secondary)] font-mono uppercase mb-1.5">Due Date</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={e => setDueDate(e.target.value)}
                  className="w-full bg-[var(--bg-card)] border border-[var(--border)] rounded py-2 px-3 text-xs text-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent)] font-mono"
                  required
                />
              </div>
            </div>

            {/* Billing period details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] text-[var(--text-secondary)] font-mono uppercase mb-1.5">Billing Period (From)</label>
                <input
                  type="date"
                  value={periodFrom}
                  onChange={e => setPeriodFrom(e.target.value)}
                  className="w-full bg-[var(--bg-card)] border border-[var(--border)] rounded py-2 px-3 text-xs text-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent)] font-mono"
                />
              </div>
              <div>
                <label className="block text-[10px] text-[var(--text-secondary)] font-mono uppercase mb-1.5">Billing Period (To)</label>
                <input
                  type="date"
                  value={periodTo}
                  onChange={e => setPeriodTo(e.target.value)}
                  className="w-full bg-[var(--bg-card)] border border-[var(--border)] rounded py-2 px-3 text-xs text-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent)] font-mono"
                />
              </div>
            </div>

            {/* Progress Billing Deductions Section */}
            {invoiceType === 'PROGRESS' && (
              <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded p-4 flex flex-col gap-4">
                <h4 className="text-[10px] font-mono text-[var(--accent)] uppercase tracking-widest">
                  Progress Claim Adjustments
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[9px] text-[var(--text-muted)] font-mono uppercase mb-1">Advance Recovery Rate (%)</label>
                    <input
                      type="number"
                      step="1"
                      placeholder="e.g. 20 for 20%"
                      value={advanceRecoveryRate * 100 || ''}
                      onChange={e => setAdvanceRecoveryRate(Number(e.target.value) / 100)}
                      className="w-full bg-[var(--bg-card)] border border-[var(--border)] rounded py-2 px-3 text-xs text-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent)] font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] text-[var(--text-muted)] font-mono uppercase mb-1">Retention Held Rate (%)</label>
                    <input
                      type="number"
                      step="1"
                      placeholder="e.g. 10 for 10%"
                      value={retentionRate * 100 || ''}
                      onChange={e => setRetentionRate(Number(e.target.value) / 100)}
                      className="w-full bg-[var(--bg-card)] border border-[var(--border)] rounded py-2 px-3 text-xs text-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent)] font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] text-[var(--text-muted)] font-mono uppercase mb-1">Certified Gross Claim (AED)</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="Override gross amount"
                      value={certifiedAmount}
                      onChange={e => setCertifiedAmount(e.target.value)}
                      className="w-full bg-[var(--bg-card)] border border-[var(--border)] rounded py-2 px-3 text-xs text-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent)] font-mono"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Line Items Grid */}
            <div className="flex flex-col gap-3 mt-2">
              <div className="flex justify-between items-center border-b border-[var(--border)] pb-2">
                <span className="text-[10px] text-[var(--text-secondary)] font-mono uppercase">Itemized invoice lines</span>
                <button
                  type="button"
                  onClick={addItemRow}
                  className="px-2.5 py-1 bg-[var(--surface-hover)] border border-[var(--border)] text-[10px] text-[var(--accent)] font-mono rounded hover:bg-[var(--surface-hover)] uppercase"
                >
                  + Add Line
                </button>
              </div>

              {items.map((item, idx) => (
                <div key={idx} className="flex flex-col md:flex-row gap-3 items-start md:items-center bg-[var(--bg-card)]/30 p-3 rounded border border-[var(--border)]">
                  <div className="flex-1 w-full">
                    <input
                      type="text"
                      placeholder="Line item description..."
                      value={item.description}
                      onChange={e => handleItemChange(idx, 'description', e.target.value)}
                      className="w-full bg-[var(--bg-card)] border border-[var(--border)] rounded py-1.5 px-3 text-xs text-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent)]"
                      required
                    />
                  </div>
                  <div className="w-20">
                    <input
                      type="number"
                      placeholder="Qty"
                      step="any"
                      value={item.quantity || ''}
                      onChange={e => handleItemChange(idx, 'quantity', Number(e.target.value))}
                      className="w-full bg-[var(--bg-card)] border border-[var(--border)] rounded py-1.5 px-3 text-xs text-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent)] font-mono text-right"
                      required
                    />
                  </div>
                  <div className="w-16">
                    <input
                      type="text"
                      placeholder="Unit"
                      value={item.unit}
                      onChange={e => handleItemChange(idx, 'unit', e.target.value)}
                      className="w-full bg-[var(--bg-card)] border border-[var(--border)] rounded py-1.5 px-3 text-xs text-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent)] text-center"
                      required
                    />
                  </div>
                  <div className="w-28">
                    <input
                      type="number"
                      placeholder="Unit Price"
                      step="0.0001"
                      value={item.unit_price || ''}
                      onChange={e => handleItemChange(idx, 'unit_price', Number(e.target.value))}
                      className="w-full bg-[var(--bg-card)] border border-[var(--border)] rounded py-1.5 px-3 text-xs text-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent)] font-mono text-right"
                      required
                    />
                  </div>
                  <div className="w-28 text-right font-mono font-bold text-[var(--text-secondary)] pr-2 self-center">
                    {round2(item.quantity * item.unit_price).toFixed(2)}
                  </div>
                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeItemRow(idx)}
                      className="p-1.5 text-[var(--text-tertiary)] hover:text-[var(--status-danger-text)] transition-all self-center"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div>
              <label className="block text-[10px] text-[var(--text-secondary)] font-mono uppercase mb-1.5">Invoice Notes</label>
              <textarea
                rows={3}
                placeholder="Terms, bank account instructions, payment references..."
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="w-full bg-[var(--bg-card)] border border-[var(--border)] rounded py-2 px-3 text-xs text-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent)]"
              />
            </div>
          </div>

          {/* Sidebar Summary Panel */}
          <div className="w-full lg:w-80 bg-[var(--bg-card)] border border-[var(--border)] rounded p-6 flex flex-col gap-6 h-fit">
            <h3 className="text-xs font-mono text-[var(--accent)] uppercase tracking-wider border-b border-[var(--border)] pb-2">
              Invoice Ledger Summary
            </h3>

            {selectedProj && (
              <div className="bg-[var(--bg-card)] border border-[#162754] rounded p-3 text-xs flex flex-col gap-1.5">
                <div className="text-[10px] text-[var(--text-secondary)] font-mono uppercase tracking-wider">Project Contract Status</div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-secondary)]">Original Value:</span>
                  <span className="font-mono text-[var(--text-secondary)]">
                    {Number(selectedProj.original_contract_value ?? selectedProj.contract_value ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} AED
                  </span>
                </div>
                {selectedProj.revised_contract_value !== undefined && Number(selectedProj.revised_contract_value) !== Number(selectedProj.original_contract_value ?? selectedProj.contract_value) && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-[var(--text-secondary)]">Approved VOs:</span>
                      <span className="font-mono text-[var(--accent)]">
                        {(Number(selectedProj.revised_contract_value) - Number(selectedProj.original_contract_value ?? selectedProj.contract_value ?? 0)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} AED
                      </span>
                    </div>
                    <div className="flex justify-between border-t border-[var(--border)] pt-1.5 font-bold">
                      <span className="text-[var(--text-primary)]">Revised Limit:</span>
                      <span className="font-mono text-[var(--accent)]">
                        {Number(selectedContractVal).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} AED
                      </span>
                    </div>
                  </>
                )}
                {advanceIssued > 0 && (
                  <div className="flex justify-between border-t border-[var(--border)] pt-1.5">
                    <span className="text-[var(--text-secondary)]">Advance Issued:</span>
                    <span className="font-mono text-[var(--text-secondary)]">
                      {advanceIssued.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} AED
                    </span>
                  </div>
                )}
              </div>
            )}

            <div className="flex flex-col gap-3.5 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-[var(--text-secondary)]">Subtotal (Taxable):</span>
                <span className="font-mono text-[var(--text-primary)]">{totals.taxable_amount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[var(--text-secondary)]">VAT (5%):</span>
                <span className="font-mono text-[var(--text-primary)]">{totals.vat_amount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center border-b border-[var(--border)] pb-3">
                <span className="text-[var(--text-secondary)] font-semibold">Total (Incl. VAT):</span>
                <span className="font-mono font-bold text-[var(--text-primary)]">{totals.total_incl_vat.toFixed(2)}</span>
              </div>

              {totals.advance_recovery > 0 && (
                <div className="flex justify-between items-center text-[var(--status-danger-text)]">
                  <span>Less: Advance Recovery:</span>
                  <span className="font-mono">- {totals.advance_recovery.toFixed(2)}</span>
                </div>
              )}

              {totals.retention_held > 0 && (
                <div className="flex justify-between items-center text-[var(--status-danger-text)]">
                  <span>Less: Retention Held:</span>
                  <span className="font-mono">- {totals.retention_held.toFixed(2)}</span>
                </div>
              )}

              <div className="flex justify-between items-center bg-[var(--bg-card)] p-3 rounded border border-[var(--border)] mt-2">
                <span className="font-bold text-[var(--text-primary)]">Net Due:</span>
                <span className="font-mono font-bold text-[var(--accent)] text-sm">
                  {totals.net_due.toFixed(2)} AED
                </span>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-[var(--accent)] text-white font-bold rounded hover:bg-[var(--accent)] transition-all uppercase tracking-wider text-xs shadow-[0_0_15px_var(--accent-glow)] disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Save Invoice Draft'}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
