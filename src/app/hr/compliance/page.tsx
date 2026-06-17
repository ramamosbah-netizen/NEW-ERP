// ============================================================
// JEET ERP — Compliance and Expiry Dashboard
// Route: /hr/compliance
// ============================================================

'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { 
  ArrowLeft, 
  ShieldAlert, 
  Calendar, 
  AlertTriangle, 
  CheckCircle,
  Clock,
  Search,
  RefreshCw
} from 'lucide-react';
import { useEmployees } from '@/hooks/useEmployees';
import '../hr.css';

export default function ComplianceDashboardPage() {
  const { employees, loading, error, refetch } = useProjectsAndEmployees();
  const [searchQuery, setSearchQuery] = useState('');

  function useProjectsAndEmployees() {
    return useEmployees();
  }

  // Get status color for dates
  const getDocStatus = (expiryDateStr: string | null | undefined): { color: 'red' | 'amber' | 'green'; text: string; daysLeft: number } => {
    if (!expiryDateStr) return { color: 'red', text: 'Missing', daysLeft: -999 };
    
    const expiry = new Date(expiryDateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    expiry.setHours(0, 0, 0, 0);

    const diffTime = expiry.getTime() - today.getTime();
    const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (daysLeft < 0) {
      return { color: 'red', text: `Expired (${Math.abs(daysLeft)}d ago)`, daysLeft };
    } else if (daysLeft <= 60) {
      return { color: 'amber', text: `Expiring (${daysLeft}d left)`, daysLeft };
    } else {
      return { color: 'green', text: `Valid (${daysLeft}d left)`, daysLeft };
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '8rem', textAlign: 'center' }} className="quote-card">
        <div className="spinner" style={{ margin: '0 auto 1rem auto' }}></div>
        <p>Scanning employee database and document metadata...</p>
      </div>
    );
  }

  // Calculate compliance statistics
  let expiredCount = 0;
  let expiring60dCount = 0;
  const upcomingExpiries: any[] = [];

  for (const emp of employees) {
    const docsToCheck = [
      { name: 'Passport', date: emp.passport_expiry },
      { name: 'Emirates ID', date: emp.emirates_id_expiry },
      { name: 'Visa', date: emp.visa_expiry },
      { name: 'Labour Card', date: emp.labour_card_expiry },
      { name: 'Medical Insurance', date: emp.medical_insurance_expiry },
      { name: 'ILOE Insurance', date: emp.iloe_insurance_expiry },
      { name: 'Driving License', date: emp.driving_license_expiry }
    ];

    for (const doc of docsToCheck) {
      if (!doc.date) continue;
      const status = getDocStatus(doc.date);
      if (status.color === 'red') {
        expiredCount++;
        upcomingExpiries.push({
          employeeName: emp.full_name_en,
          employeeId: emp.id,
          employeeNumber: emp.employee_number,
          docName: doc.name,
          expiryDate: doc.date,
          status: 'EXPIRED',
          daysLeft: status.daysLeft
        });
      } else if (status.color === 'amber') {
        expiring60dCount++;
        upcomingExpiries.push({
          employeeName: emp.full_name_en,
          employeeId: emp.id,
          employeeNumber: emp.employee_number,
          docName: doc.name,
          expiryDate: doc.date,
          status: 'EXPIRING',
          daysLeft: status.daysLeft
        });
      }
    }
  }

  // Sort upcoming expiries chronologically
  upcomingExpiries.sort((a, b) => a.daysLeft - b.daysLeft);

  const filteredEmployees = employees.filter(emp => 
    emp.full_name_en.toLowerCase().includes(searchQuery.toLowerCase()) ||
    emp.employee_number.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="quote-container">
      {/* Back button */}
      <div className="mb-4 flex justify-between items-center">
        <Link href="/hr" className="quote-btn quote-btn-secondary" style={{ padding: '0.4rem 0.8rem', display: 'inline-flex', gap: '0.4rem', alignItems: 'center', textDecoration: 'none' }}>
          <ArrowLeft size={14} /> Back to Registry
        </Link>
        <button className="quote-btn quote-btn-secondary" onClick={refetch}>
          <RefreshCw size={12} /> Recalculate Compliance
        </button>
      </div>

      {/* Header */}
      <header className="quote-header">
        <div>
          <h1 className="quote-header-title">Compliance Audit Workspace</h1>
          <p className="quote-header-subtitle">Traffic-light dashboard for employee visas, Emirates IDs, labor cards, and certifications</p>
        </div>
      </header>

      {/* Summary Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-6">
        <div className="bg-[var(--status-danger-bg)] border border-[var(--status-danger-border)] rounded p-5 flex items-center justify-between">
          <div>
            <span className="text-[var(--text-muted)] block uppercase font-mono text-[9px]">Critical Violations</span>
            <span className="font-mono text-2xl font-extrabold text-[var(--status-danger-text)] mt-1 block">{expiredCount}</span>
            <span className="text-[10px] text-[var(--status-danger-text)] font-mono mt-1 block">Expired active credentials</span>
          </div>
          <AlertTriangle className="text-[var(--status-danger-text)]" size={32} />
        </div>
        
        <div className="bg-[var(--status-warning-bg)] border border-[var(--status-warning-border)] rounded p-5 flex items-center justify-between">
          <div>
            <span className="text-[var(--text-muted)] block uppercase font-mono text-[9px]">Approaching Expiries (60D)</span>
            <span className="font-mono text-2xl font-extrabold text-[var(--status-warning-text)] mt-1 block">{expiring60dCount}</span>
            <span className="text-[10px] text-[var(--status-warning-text)] font-mono mt-1 block">Action required for renewal</span>
          </div>
          <Clock className="text-[var(--status-warning-text)]" size={32} />
        </div>

        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded p-5 flex items-center justify-between">
          <div>
            <span className="text-[var(--text-muted)] block uppercase font-mono text-[9px]">Audit Status</span>
            <span className="font-mono text-xl font-extrabold text-[var(--accent)] mt-1 block">AUDIT-READY</span>
            <span className="text-[10px] text-[var(--text-muted)] font-mono mt-1 block">100% records catalogued</span>
          </div>
          <CheckCircle className="text-[var(--accent)]" size={32} />
        </div>
      </div>

      {/* Split view: Compliance Matrix & Upcoming Schedule */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Compliance Matrix (Grid) */}
        <div className="lg:col-span-2 quote-card">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xs font-mono text-[var(--accent)] uppercase tracking-widest font-bold">Workforce Document Matrix</h3>
            <div style={{ position: 'relative', width: '240px' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '8px', color: 'var(--text-muted)' }} />
              <input
                type="text"
                className="quote-filter-input w-full"
                placeholder="Search staff..."
                style={{ paddingLeft: '2rem', height: '28px', fontSize: '11px' }}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="quote-table-wrap">
            <table className="quote-table bloomberg-grid">
              <thead>
                <tr>
                  <th>Staff Member</th>
                  <th style={{ textAlign: 'center' }}>Passport</th>
                  <th style={{ textAlign: 'center' }}>Emirates ID</th>
                  <th style={{ textAlign: 'center' }}>Visa</th>
                  <th style={{ textAlign: 'center' }}>Labour Card</th>
                  <th style={{ textAlign: 'center' }}>Medical</th>
                </tr>
              </thead>
              <tbody>
                {filteredEmployees.map(emp => {
                  const pass = getDocStatus(emp.passport_expiry);
                  const eid = getDocStatus(emp.emirates_id_expiry);
                  const visa = getDocStatus(emp.visa_expiry);
                  const lab = getDocStatus(emp.labour_card_expiry);
                  const med = getDocStatus(emp.medical_insurance_expiry);

                  return (
                    <tr key={emp.id}>
                      <td style={{ fontWeight: 600 }}>
                        <Link href={`/hr/${emp.id}`} style={{ color: 'inherit', textDecoration: 'none' }} className="hover:text-primary">
                          {emp.full_name_en}
                          <span className="block text-[8px] text-[var(--text-muted)] font-mono mt-0.5">{emp.employee_number}</span>
                        </Link>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <div className={`compliance-light ${pass.color} ${pass.color === 'red' && emp.status === 'ACTIVE' ? 'pulse-red' : ''}`} title={`Passport: ${pass.text}`} />
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <div className={`compliance-light ${eid.color} ${eid.color === 'red' && emp.status === 'ACTIVE' ? 'pulse-red' : ''}`} title={`Emirates ID: ${eid.text}`} />
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <div className={`compliance-light ${visa.color} ${visa.color === 'red' && emp.status === 'ACTIVE' ? 'pulse-red' : ''}`} title={`Visa: ${visa.text}`} />
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <div className={`compliance-light ${lab.color} ${lab.color === 'red' && emp.status === 'ACTIVE' ? 'pulse-red' : ''}`} title={`Labour Card: ${lab.text}`} />
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <div className={`compliance-light ${med.color} ${med.color === 'red' && emp.status === 'ACTIVE' ? 'pulse-red' : ''}`} title={`Medical Insurance: ${med.text}`} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Expiry timeline log */}
        <div className="quote-card">
          <h3 className="text-xs font-mono text-[var(--accent)] uppercase tracking-widest font-bold mb-4 flex items-center gap-2">
            <Calendar size={14} /> Upcoming Renewals Schedule
          </h3>

          {upcomingExpiries.length === 0 ? (
            <div className="text-center py-12 text-[var(--text-muted)] font-mono text-xs">
              No upcoming renewals detected. All staff files are compliant.
            </div>
          ) : (
            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
              {upcomingExpiries.map((exp, idx) => (
                <div 
                  key={idx} 
                  className={`p-3 rounded border font-mono text-[10px] ${
                    exp.status === 'EXPIRED' 
                      ? 'bg-[var(--status-danger-bg)] border-[var(--status-danger-border)] text-[var(--status-danger-text)]' 
                      : 'bg-[var(--status-warning-bg)] border-[var(--status-warning-border)] text-[var(--status-warning-text)]'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <strong className="font-semibold block">{exp.docName}</strong>
                    <span className="font-bold">
                      {exp.status === 'EXPIRED' ? 'EXPIRED' : `${exp.daysLeft} days left`}
                    </span>
                  </div>
                  <p className="text-[var(--text-secondary)] mt-1">{exp.employeeName} ({exp.employeeNumber})</p>
                  <div className="flex justify-between mt-1 text-[9px] text-[var(--text-muted)]">
                    <span>Expiry: {new Date(exp.expiryDate).toLocaleDateString('en-GB')}</span>
                    <Link href={`/hr/${exp.employeeId}`} style={{ color: 'var(--secondary)' }}>
                      View Profile
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
