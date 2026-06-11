// ============================================================
// JEET ERP — WPS SIF Generation Dashboard
// Route: /payroll/sif
// ============================================================

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  ArrowLeft, 
  Download, 
  CheckCircle, 
  AlertTriangle, 
  HelpCircle,
  FileText,
  ShieldAlert,
  Layers,
  Settings
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { sifService } from '@/services/sifService';
import type { PayrollRun, PayrollLine } from '@/types/payroll.types';
import '../../hr/hr.css';

export default function SifExportPage() {
  const [runs, setRuns] = useState<PayrollRun[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string>('');
  const [lines, setLines] = useState<PayrollLine[]>([]);
  const [loading, setLoading] = useState(false);

  // SIF Parameters
  const [companySettings, setCompanySettings] = useState({
    establishmentId: '1234567890123', // 13-digit MOHRE establishment ID
    bankRoutingCode: '987654321', // 9-digit routing code
    fileReference: ''
  });

  // Validation results
  const [errors, setErrors] = useState<string[]>([]);
  const [isValidated, setIsValidated] = useState(false);

  // Load approved payroll runs
  useEffect(() => {
    async function loadApprovedRuns() {
      const { data } = await supabase
        .from('payroll_runs')
        .select('*')
        .eq('status', 'APPROVED')
        .order('period_month', { ascending: false });
      setRuns(data || []);
      if (data && data.length > 0) {
        setSelectedRunId(data[0].id);
      }
    }
    loadApprovedRuns();
  }, []);

  // Load lines for selected approved run
  useEffect(() => {
    if (!selectedRunId) {
      setLines([]);
      return;
    }

    async function loadLines() {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('payroll_lines')
          .select(`
            *,
            employee:employees(full_name_en, employee_number, designation, department)
          `)
          .eq('run_id', selectedRunId);

        if (error) throw error;
        setLines(data || []);
        setIsValidated(false);
        setErrors([]);
      } catch (err) {
        console.error('Failed to load payroll lines for SIF:', err);
      } finally {
        setLoading(false);
      }
    }
    loadLines();
  }, [selectedRunId]);

  const runDetails = runs.find(r => r.id === selectedRunId);

  // Run validation
  const handleValidate = () => {
    if (!runDetails) return;
    
    const { validationErrors } = sifService.generateSIF({
      establishmentId: companySettings.establishmentId,
      bankRoutingCode: companySettings.bankRoutingCode,
      salaryMonth: runDetails.period_month,
      lines,
      fileReference: companySettings.fileReference
    });

    setErrors(validationErrors);
    setIsValidated(true);
  };

  const handleDownload = () => {
    if (!runDetails || !isValidated || errors.length > 0) return;

    const { content, filename } = sifService.generateSIF({
      establishmentId: companySettings.establishmentId,
      bankRoutingCode: companySettings.bankRoutingCode,
      salaryMonth: runDetails.period_month,
      lines,
      fileReference: companySettings.fileReference
    });

    // File download trigger
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="quote-container">
      {/* Header */}
      <header className="quote-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <Link href="/payroll" className="text-slate-400 hover:text-emerald-400 font-mono text-[10px] uppercase flex items-center gap-1" style={{ textDecoration: 'none' }}>
              <ArrowLeft size={10} /> Back to Runs
            </Link>
          </div>
          <h1 className="quote-header-title">WPS SIF Export Panel</h1>
          <p className="quote-header-subtitle">Wages Protection System file compliance validation and downloader</p>
        </div>
      </header>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Side: Parameters Form */}
        <div className="lg:col-span-1 space-y-6">
          <div className="quote-card">
            <h3 className="text-xs font-mono uppercase text-slate-300 font-bold mb-4 flex items-center gap-1.5">
              <Settings size={14} /> SIF Parameters
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-[9px] font-mono text-slate-400 uppercase mb-1">Approved Payroll Run</label>
                <select 
                  className="quote-filter-input w-full"
                  value={selectedRunId}
                  onChange={(e) => setSelectedRunId(e.target.value)}
                >
                  <option value="">-- Select Run --</option>
                  {runs.map(r => (
                    <option key={r.id} value={r.id}>Run {r.period_month} (AED {r.net_total.toLocaleString()})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[9px] font-mono text-slate-400 uppercase mb-1">MOHRE Establishment ID (13 digits)</label>
                <input 
                  type="text" 
                  maxLength={13}
                  className="quote-filter-input w-full font-mono"
                  value={companySettings.establishmentId}
                  onChange={(e) => {
                    setCompanySettings(prev => ({ ...prev, establishmentId: e.target.value }));
                    setIsValidated(false);
                  }}
                  placeholder="e.g. 1234567890123"
                />
              </div>

              <div>
                <label className="block text-[9px] font-mono text-slate-400 uppercase mb-1">Employer Bank Routing (9 digits)</label>
                <input 
                  type="text" 
                  maxLength={9}
                  className="quote-filter-input w-full font-mono"
                  value={companySettings.bankRoutingCode}
                  onChange={(e) => {
                    setCompanySettings(prev => ({ ...prev, bankRoutingCode: e.target.value }));
                    setIsValidated(false);
                  }}
                  placeholder="e.g. 987654321"
                />
              </div>

              <div>
                <label className="block text-[9px] font-mono text-slate-400 uppercase mb-1">File Reference (Optional, max 15 chars)</label>
                <input 
                  type="text" 
                  maxLength={15}
                  className="quote-filter-input w-full font-mono"
                  value={companySettings.fileReference}
                  onChange={(e) => {
                    setCompanySettings(prev => ({ ...prev, fileReference: e.target.value }));
                    setIsValidated(false);
                  }}
                  placeholder={`PAY${runDetails?.period_month ? runDetails.period_month.split('-').slice(0, 2).join('') : ''}`}
                />
              </div>

              <div className="pt-2">
                <button 
                  type="button" 
                  className="quote-btn quote-btn-primary w-full flex items-center justify-center gap-1.5"
                  onClick={handleValidate}
                  disabled={!selectedRunId || loading}
                >
                  <ShieldAlert size={14} /> Validate SIF Compliance
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Validation Grid & Download Panel */}
        <div className="lg:col-span-2 space-y-6">
          <div className="quote-card">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xs font-mono uppercase text-slate-300 font-bold">WPS Compliance Verification</h3>
              
              {isValidated && errors.length === 0 && (
                <button 
                  type="button" 
                  className="quote-btn quote-btn-primary flex items-center gap-1.5"
                  onClick={handleDownload}
                >
                  <Download size={14} /> Download SIF File
                </button>
              )}
            </div>

            {!isValidated ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                <HelpCircle size={40} className="text-slate-600 mb-2" style={{ margin: '0 auto 1rem auto' }} />
                <p className="text-[11px] font-mono">Fill in the establishment ID and bank details, then click "Validate SIF Compliance" to run pre-export validation checks.</p>
              </div>
            ) : errors.length > 0 ? (
              <div className="space-y-4">
                <div className="overhead-warning-banner" style={{ background: 'rgba(239, 68, 68, 0.1)', borderColor: 'var(--error)' }}>
                  <AlertTriangle size={18} className="flex-shrink-0" />
                  <div>
                    <strong>SIF Validation Failed:</strong> {errors.length} error(s) must be resolved in Employee Master or configurations before downloading the MOHRE SIF file.
                  </div>
                </div>

                <div className="border border-slate-900 rounded bg-slate-950/40 p-4 max-h-[300px] overflow-y-auto">
                  <h4 className="text-[9px] font-mono uppercase text-slate-500 mb-2">Errors List</h4>
                  <ul className="space-y-1.5 font-mono text-[10px] text-red-400">
                    {errors.map((err, idx) => (
                      <li key={idx} className="flex items-start gap-1">
                        <span>•</span> <span>{err}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="overhead-warning-banner" style={{ background: 'rgba(16, 185, 129, 0.1)', borderColor: 'var(--success)', color: 'var(--success)' }}>
                  <CheckCircle size={18} className="flex-shrink-0" />
                  <div>
                    <strong>WPS Check Passed:</strong> All establishment IDs, bank codes, employee person codes, and IBAN check digits conform to UAE Central Bank standards.
                  </div>
                </div>

                <div className="quote-table-wrap">
                  <table className="quote-table" style={{ fontSize: '10px' }}>
                    <thead>
                      <tr>
                        <th>Employee</th>
                        <th>Person Code</th>
                        <th>Agent ID</th>
                        <th>IBAN</th>
                        <th style={{ textAlign: 'right' }}>Net Pay</th>
                        <th style={{ textAlign: 'center' }}>Validation</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lines.map((line) => (
                        <tr key={line.id}>
                          <td>
                            <div className="font-semibold text-slate-200">{line.employee?.full_name_en}</div>
                            <div className="font-mono text-[8px] text-slate-500">{line.employee?.employee_number}</div>
                          </td>
                          <td className="font-mono text-slate-400">{line.mohre_person_code}</td>
                          <td className="font-mono text-slate-400">{line.agent_id}</td>
                          <td className="font-mono text-slate-300">{line.iban}</td>
                          <td style={{ textAlign: 'right', fontWeight: 'bold' }} className="font-mono text-emerald-400">
                            AED {Number(line.net_pay).toFixed(2)}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <span className="compliance-light green" style={{ width: '8px', height: '8px' }} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
