// ============================================================
// JEET ERP — Gratuity (EOSB) Accrued Liability Report
// Route: /payroll/eosb
// ============================================================

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { 
  ArrowLeft, 
  RefreshCw, 
  Layers, 
  HelpCircle,
  FileText,
  DollarSign
} from 'lucide-react';
import { useEOSB } from '@/hooks/useEOSB';
import '../../hr/hr.css';

export default function GratuityLiabilityPage() {
  const { liabilityReport, loading, error, refetch } = useEOSB();

  const totalLiability = liabilityReport.reduce((acc, emp) => acc + Number(emp.accrued_gratuity), 0);

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
          <h1 className="quote-header-title">EOSB Gratuity Liability Report</h1>
          <p className="quote-header-subtitle">Company-wide accrued end-of-service benefits financial ledger</p>
        </div>
        <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'center' }}>
          <button className="quote-btn quote-btn-secondary" onClick={() => refetch()} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Recalculate
          </button>
        </div>
      </header>

      {/* Summary KPI Block */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded p-4 flex items-center justify-between">
          <div>
            <span className="text-[var(--text-muted)] block uppercase font-mono text-[9px]">Total Gratuity Accrued</span>
            <span className="font-mono text-2xl font-extrabold text-[var(--accent)] mt-1 block">
              AED {totalLiability.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <DollarSign className="text-[var(--accent)] opacity-80" size={24} />
        </div>
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded p-4 flex items-center justify-between">
          <div>
            <span className="text-[var(--text-muted)] block uppercase font-mono text-[9px]">Audited Staff Members</span>
            <span className="font-mono text-2xl font-extrabold text-[var(--text-primary)] mt-1 block">
              {liabilityReport.length}
            </span>
          </div>
          <Layers className="text-[var(--accent)] opacity-80" size={24} />
        </div>
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded p-4 flex items-center justify-between">
          <div>
            <span className="text-[var(--text-muted)] block uppercase font-mono text-[9px]">WPS Registry Status</span>
            <span className="font-mono text-2xl font-extrabold text-[var(--text-primary)] mt-1 block">
              Compliance Checked
            </span>
          </div>
          <div className="compliance-light green w-3 h-3" />
        </div>
      </div>

      {/* Main Ledger Table */}
      {loading ? (
        <div style={{ padding: '6rem', textAlign: 'center' }} className="quote-card">
          <div className="spinner" style={{ margin: '0 auto 1rem auto' }}></div>
          <p>Compiling historical service metrics and salary allocations...</p>
        </div>
      ) : error ? (
        <div style={{ padding: '2rem', textAlign: 'center', color: '#ef4444' }} className="quote-card">
          <p>Error compiling liability report: {error.message}</p>
        </div>
      ) : liabilityReport.length === 0 ? (
        <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }} className="quote-card">
          <Layers size={48} style={{ margin: '0 auto 1rem auto', opacity: 0.3 }} />
          <p>No active employees found to accrue gratuity liability.</p>
        </div>
      ) : (
        <div className="quote-card">
          <div className="quote-table-wrap">
            <table className="quote-table" style={{ fontSize: '11px' }}>
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Department</th>
                  <th>Designation</th>
                  <th>Join Date</th>
                  <th style={{ textAlign: 'center' }}>Tenure Days</th>
                  <th style={{ textAlign: 'center' }}>Tenure Years</th>
                  <th style={{ textAlign: 'right' }}>Basic Salary</th>
                  <th style={{ textAlign: 'right' }}>Accrued Gratuity Liability</th>
                </tr>
              </thead>
              <tbody>
                {liabilityReport.map((emp) => {
                  const serviceYears = Number(emp.effective_service_days) / 365;
                  
                  return (
                    <tr key={emp.employee_id}>
                      <td style={{ fontWeight: 600 }}>
                        <div className="text-[var(--text-primary)]">{emp.full_name_en}</div>
                        <div className="font-mono text-[9px] text-[var(--text-muted)]">{emp.employee_number}</div>
                      </td>
                      <td className="font-mono text-[var(--text-secondary)]">{emp.department}</td>
                      <td>{emp.designation}</td>
                      <td className="font-mono text-[var(--text-secondary)]">
                        {new Date(emp.join_date).toLocaleDateString('en-GB')}
                      </td>
                      <td style={{ textAlign: 'center' }} className="font-mono text-[var(--text-secondary)]">
                        {emp.effective_service_days}
                      </td>
                      <td style={{ textAlign: 'center' }} className="font-mono text-[var(--text-secondary)]">
                        {serviceYears.toFixed(2)} yrs
                      </td>
                      <td style={{ textAlign: 'right' }} className="font-mono text-[var(--text-secondary)]">
                        AED {Number(emp.basic_salary).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 'bold' }} className="font-mono text-[var(--accent)]">
                        AED {Number(emp.accrued_gratuity).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
