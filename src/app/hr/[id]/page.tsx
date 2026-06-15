// ============================================================
// JEET ERP — Employee Profile Detail Workspace
// Route: /hr/[id]
// ============================================================

'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { 
  ArrowLeft, 
  User, 
  FileText, 
  Award, 
  DollarSign, 
  Calendar, 
  Clock, 
  Plus, 
  Trash2, 
  ShieldAlert, 
  Link2,
  CheckCircle,
  FileBadge
} from 'lucide-react';
import { useEmployee } from '@/hooks/useEmployees';
import '../hr.css';

type TabType = 'profile' | 'documents' | 'certifications' | 'compensation' | 'leave' | 'timesheets';

export default function EmployeeDetailPage() {
  const params = useParams();
  const employeeId = params?.id as string;
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<TabType>('profile');
  const [currentUserRole, setCurrentUserRole] = useState<string>('engineer');
  
  const { 
    employee, 
    compensations, 
    certifications, 
    documents, 
    loading, 
    error, 
    refetch,
    addCompensation,
    addCertification,
    deleteCertification,
    linkDocument,
    unlinkDocument,
    updateProfile
  } = useEmployee(employeeId);

  // Form States
  const [showCompModal, setShowCompModal] = useState(false);
  const [compForm, setCompForm] = useState({
    effective_from: '',
    basic_salary: 0,
    housing_allowance: 0,
    transport_allowance: 0,
    other_allowance: 0,
    burden_multiplier: 1.25,
    notes: ''
  });

  const [showCertModal, setShowCertModal] = useState(false);
  const [certForm, setCertForm] = useState({
    cert_type: 'SIRA_INSTALLATION' as any,
    cert_number: '',
    issue_date: '',
    expiry_date: '',
    document_id: ''
  });

  const [linkDocForm, setLinkDocForm] = useState({
    document_id: '',
    document_type: 'PASSPORT' as any
  });
  const [showLinkDocModal, setShowLinkDocModal] = useState(false);
  const [dmsDocs, setDmsDocs] = useState<any[]>([]); // for dropdown

  // Fetch current user role and DMS docs list
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single()
          .then(({ data }) => {
            if (data) setCurrentUserRole(data.role);
          });
      }
    });

    // Fetch documents in DMS to let them link
    supabase
      .from('documents')
      .select('id, title, category, subcategory')
      .eq('is_active', true)
      .then(({ data }) => {
        if (data) setDmsDocs(data);
      });
  }, []);

  if (loading) {
    return (
      <div style={{ padding: '8rem', textAlign: 'center' }} className="quote-card">
        <div className="spinner" style={{ margin: '0 auto 1rem auto' }}></div>
        <p>Retrieving employee master files and security logs...</p>
      </div>
    );
  }

  if (error || !employee) {
    return (
      <div className="quote-container">
        <div className="bg-[var(--status-danger-bg)] border border-[var(--status-danger-border)] text-[var(--status-danger-text)] p-6 rounded font-mono text-xs max-w-lg mx-auto mt-12">
          <ShieldAlert size={20} className="mb-2" />
          <h2 className="font-bold mb-2">Record Access Exception</h2>
          <p>{error?.message || 'Employee master file not found in database registry.'}</p>
          <Link href="/hr" className="quote-btn quote-btn-secondary block mt-4 text-center">
            Return to Registry
          </Link>
        </div>
      </div>
    );
  }

  const handleAddComp = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addCompensation(compForm);
      setShowCompModal(false);
      setCompForm({
        effective_from: '',
        basic_salary: 0,
        housing_allowance: 0,
        transport_allowance: 0,
        other_allowance: 0,
        burden_multiplier: 1.25,
        notes: ''
      });
    } catch (err: any) {
      alert(`Compensation save failed: ${err.message || err}`);
    }
  };

  const handleAddCert = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addCertification({
        ...certForm,
        document_id: certForm.document_id || null
      });
      setShowCertModal(false);
      setCertForm({
        cert_type: 'SIRA_INSTALLATION',
        cert_number: '',
        issue_date: '',
        expiry_date: '',
        document_id: ''
      });
    } catch (err: any) {
      alert(`Certification save failed: ${err.message || err}`);
    }
  };

  const handleLinkDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await linkDocument(linkDocForm.document_id, linkDocForm.document_type);
      setShowLinkDocModal(false);
      setLinkDocForm({ document_id: '', document_type: 'PASSPORT' });
    } catch (err: any) {
      alert(`Document linking failed: ${err.message || err}`);
    }
  };

  const hasCompAccess = ['hr', 'gm', 'admin', 'account'].includes(currentUserRole);

  return (
    <div className="quote-container">
      {/* Breadcrumbs */}
      <div className="mb-4">
        <Link href="/hr" className="quote-btn quote-btn-secondary" style={{ padding: '0.4rem 0.8rem', display: 'inline-flex', gap: '0.4rem', alignItems: 'center', textDecoration: 'none' }}>
          <ArrowLeft size={14} /> Back to Registry
        </Link>
      </div>

      {/* Profile summary header banner */}
      <div className="quote-card mb-6" style={{ background: 'linear-gradient(135deg, rgba(13, 17, 39, 0.75) 0%, rgba(6, 8, 20, 0.95) 100%)', borderLeft: '3px solid var(--primary)' }}>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-[var(--surface-hover)] border border-[var(--border)] rounded-full flex items-center justify-center text-[var(--text-primary)]0 font-bold text-lg">
              {employee.full_name_en.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-[var(--text-primary)]">{employee.full_name_en}</h1>
                <span className="text-xs text-[var(--text-secondary)] font-mono" dir="rtl">{employee.full_name_ar}</span>
              </div>
              <p className="text-xs text-[var(--text-secondary)] font-semibold">{employee.designation} — <span className="text-[10px] font-mono text-[var(--accent)] uppercase">{employee.department}</span></p>
              <div className="flex gap-4 text-[10px] text-[var(--text-primary)]0 font-mono mt-1">
                <span>EMP NO: <strong className="text-[var(--text-secondary)]">{employee.employee_number}</strong></span>
                <span>JOINED: <strong className="text-[var(--text-secondary)]">{new Date(employee.join_date).toLocaleDateString('en-GB')}</strong></span>
                <span>RATE: <strong className="text-primary">{employee.current_hourly_cost_rate} AED/hr</strong></span>
              </div>
            </div>
          </div>
          <span className={`badge-status ${employee.status.toLowerCase()}`}>
            {employee.status}
          </span>
        </div>
      </div>

      {/* Tabs navigation */}
      <div className="flex border-b border-[var(--border)] mb-6 overflow-x-auto">
        <button onClick={() => setActiveTab('profile')} className={`hr-tab-btn flex items-center gap-2 ${activeTab === 'profile' ? 'active' : ''}`}>
          <User size={14} /> Profile Master
        </button>
        <button onClick={() => setActiveTab('documents')} className={`hr-tab-btn flex items-center gap-2 ${activeTab === 'documents' ? 'active' : ''}`}>
          <FileText size={14} /> Compliance Docs
        </button>
        <button onClick={() => setActiveTab('certifications')} className={`hr-tab-btn flex items-center gap-2 ${activeTab === 'certifications' ? 'active' : ''}`}>
          <Award size={14} /> Certifications
        </button>
        {hasCompAccess && (
          <button onClick={() => setActiveTab('compensation')} className={`hr-tab-btn flex items-center gap-2 ${activeTab === 'compensation' ? 'active' : ''}`}>
            <DollarSign size={14} /> Compensation
          </button>
        )}
        <button onClick={() => setActiveTab('leave')} className={`hr-tab-btn flex items-center gap-2 ${activeTab === 'leave' ? 'active' : ''}`}>
          <Calendar size={14} /> Leave requests
        </button>
        <button onClick={() => setActiveTab('timesheets')} className={`hr-tab-btn flex items-center gap-2 ${activeTab === 'timesheets' ? 'active' : ''}`}>
          <Clock size={14} /> Timesheets
        </button>
      </div>

      {/* Tab Panels */}
      <div className="quote-card">
        
        {/* PROFILE TAB */}
        {activeTab === 'profile' && (
          <div className="space-y-6">
            <h3 className="text-xs font-mono text-[var(--accent)] uppercase tracking-widest font-bold">Employee Record Profile</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-xs font-mono">
              <div>
                <span className="text-[var(--text-primary)]0 block">Nationality</span>
                <span className="text-[var(--text-primary)] mt-1 block">{employee.nationality}</span>
              </div>
              <div>
                <span className="text-[var(--text-primary)]0 block">Date of Birth</span>
                <span className="text-[var(--text-primary)] mt-1 block">{new Date(employee.dob).toLocaleDateString('en-GB')}</span>
              </div>
              <div>
                <span className="text-[var(--text-primary)]0 block">Gender</span>
                <span className="text-[var(--text-primary)] mt-1 block">{employee.gender}</span>
              </div>
              <div>
                <span className="text-[var(--text-primary)]0 block">Mobile Connection</span>
                <span className="text-[var(--text-primary)] mt-1 block">{employee.mobile}</span>
              </div>
              <div>
                <span className="text-[var(--text-primary)]0 block">Personal Email</span>
                <span className="text-[var(--text-primary)] mt-1 block">{employee.personal_email}</span>
              </div>
              <div>
                <span className="text-[var(--text-primary)]0 block">Employment Type</span>
                <span className="text-[var(--text-primary)] mt-1 block">{employee.employment_type.replace('_', ' ')}</span>
              </div>
              <div>
                <span className="text-[var(--text-primary)]0 block">Visa Sponsor</span>
                <span className="text-[var(--text-primary)] mt-1 block">{employee.visa_sponsor === 'JEET' ? 'JEET Security' : 'Other'}</span>
              </div>
              <div>
                <span className="text-[var(--text-primary)]0 block">MOHRE Person Code</span>
                <span className="text-[var(--text-primary)] mt-1 block">{employee.mohre_person_code}</span>
              </div>
            </div>

            <div className="border-t border-[var(--border)] pt-6">
              <h4 className="text-[10px] font-mono text-[var(--text-primary)]0 uppercase tracking-widest mb-4">WPS Salary Transfer Parameters</h4>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-6 text-xs font-mono">
                <div>
                  <span className="text-[var(--text-primary)]0 block">Bank Name</span>
                  <span className="text-[var(--text-primary)] mt-1 block">{employee.bank_name}</span>
                </div>
                <div>
                  <span className="text-[var(--text-primary)]0 block">IBAN</span>
                  <span className="text-[var(--text-primary)] mt-1 block text-[var(--accent)]">{employee.iban}</span>
                </div>
                <div>
                  <span className="text-[var(--text-primary)]0 block">Routing Code</span>
                  <span className="text-[var(--text-primary)] mt-1 block">{employee.routing_code}</span>
                </div>
                <div>
                  <span className="text-[var(--text-primary)]0 block">WPS Agent ID</span>
                  <span className="text-[var(--text-primary)] mt-1 block">{employee.agent_id}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* DOCUMENTS TAB */}
        {activeTab === 'documents' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-xs font-mono text-[var(--accent)] uppercase tracking-widest font-bold">Compliance Document Ledger</h3>
              <button onClick={() => setShowLinkDocModal(true)} className="quote-btn quote-btn-primary flex items-center gap-2">
                <Link2 size={14} /> Link DMS File
              </button>
            </div>

            {documents.length === 0 ? (
              <div className="text-center py-12 text-[var(--text-primary)]0 font-mono text-xs">
                No compliance files currently linked to this employee profile.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {documents.map((docLink) => (
                  <div key={docLink.id} className="hr-glass-card p-4 flex justify-between items-start gap-4">
                    <div>
                      <span className="ot-badge weekday text-[8px] uppercase">{docLink.document_type}</span>
                      <h4 className="font-semibold text-xs text-[var(--text-primary)] mt-2">
                        {docLink.document?.title || 'Untitled Document'}
                      </h4>
                      <p className="text-[10px] text-[var(--text-primary)]0 font-mono mt-1">
                        Expiry Date: {docLink.document?.expiry_date ? new Date(docLink.document.expiry_date).toLocaleDateString('en-GB') : 'No Expiry'}
                      </p>
                    </div>
                    <button 
                      onClick={() => unlinkDocument(docLink.id)} 
                      className="text-[var(--text-primary)]0 hover:text-[var(--status-danger-text)] p-1 rounded hover:bg-[var(--surface-hover)] border border-[var(--border)] hover:border-[var(--status-danger-border)] transition-all"
                      title="Unlink Document"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* CERTIFICATIONS TAB */}
        {activeTab === 'certifications' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-xs font-mono text-[var(--accent)] uppercase tracking-widest font-bold">Employee Certifications Registry</h3>
              <button onClick={() => setShowCertModal(true)} className="quote-btn quote-btn-primary flex items-center gap-2">
                <Plus size={14} /> Add Certification
              </button>
            </div>

            {certifications.length === 0 ? (
              <div className="text-center py-12 text-[var(--text-primary)]0 font-mono text-xs">
                No active certifications logged. SIRA CCTV/Installation certs are required for field engineers.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {certifications.map((cert) => (
                  <div key={cert.id} className="hr-glass-card p-4 flex justify-between items-start gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <FileBadge className="text-[var(--accent)]" size={16} />
                        <h4 className="font-semibold text-xs text-[var(--text-primary)]">
                          {cert.cert_type.replace('_', ' ')}
                        </h4>
                      </div>
                      <p className="text-[10px] font-mono text-[var(--text-secondary)] mt-2">No: <strong className="text-[var(--text-primary)]">{cert.cert_number}</strong></p>
                      <div className="grid grid-cols-2 gap-4 mt-2 text-[9px] font-mono text-[var(--text-primary)]0">
                        <span>Issued: {new Date(cert.issue_date).toLocaleDateString('en-GB')}</span>
                        <span>Expires: <strong className={new Date(cert.expiry_date) < new Date() ? 'text-[var(--status-danger-text)]' : 'text-[var(--text-secondary)]'}>{new Date(cert.expiry_date).toLocaleDateString('en-GB')}</strong></span>
                      </div>
                    </div>
                    <button 
                      onClick={() => deleteCertification(cert.id)} 
                      className="text-[var(--text-primary)]0 hover:text-[var(--status-danger-text)] p-1 rounded hover:bg-[var(--surface-hover)] border border-[var(--border)] hover:border-[var(--status-danger-border)] transition-all"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* COMPENSATION TAB */}
        {activeTab === 'compensation' && hasCompAccess && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-xs font-mono text-[var(--accent)] uppercase tracking-widest font-bold">Confidential Salary Compensation History</h3>
              <button onClick={() => setShowCompModal(true)} className="quote-btn quote-btn-primary flex items-center gap-2">
                <Plus size={14} /> Update Salary
              </button>
            </div>

            {compensations.length === 0 ? (
              <div className="text-center py-12 text-[var(--text-primary)]0 font-mono text-xs">
                No salary parameters configured.
              </div>
            ) : (
              <div className="quote-table-wrap">
                <table className="quote-table bloomberg-grid">
                  <thead>
                    <tr>
                      <th>Effective From</th>
                      <th>Basic Salary</th>
                      <th>Housing</th>
                      <th>Transport</th>
                      <th>Other Allowances</th>
                      <th>Burden Mult.</th>
                      <th>Hourly Cost Rate</th>
                      <th>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {compensations.map((comp) => (
                      <tr key={comp.id}>
                        <td>{new Date(comp.effective_from).toLocaleDateString('en-GB')}</td>
                        <td>AED {comp.basic_salary.toFixed(2)}</td>
                        <td>AED {comp.housing_allowance.toFixed(2)}</td>
                        <td>AED {comp.transport_allowance.toFixed(2)}</td>
                        <td>AED {comp.other_allowance.toFixed(2)}</td>
                        <td>{comp.burden_multiplier}x</td>
                        <td className="text-primary font-bold">AED {comp.hourly_cost_rate.toFixed(2)}</td>
                        <td className="text-[10px] text-[var(--text-secondary)]">{comp.notes || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* LEAVE TAB */}
        {activeTab === 'leave' && (
          <div className="text-center py-12 text-[var(--text-primary)]0 font-mono text-xs">
            Leave requests detail log, annual ticket entitlements, and balance balances are integrated under self service.
            Use the top navigation bar to access leave calendars or approvals.
          </div>
        )}

        {/* TIMESHEETS TAB */}
        {activeTab === 'timesheets' && (
          <div className="text-center py-12 text-[var(--text-primary)]0 font-mono text-xs">
            Employee weekly timesheet histories are archived here. Use My Timesheet workspace for logging.
          </div>
        )}

      </div>

      {/* Link DMS Document Modal */}
      {showLinkDocModal && (
        <div className="fixed inset-0 bg-[var(--bg-card)] backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-lg max-w-md w-full p-6">
            <h3 className="text-xs font-mono text-[var(--accent)] uppercase tracking-widest font-bold mb-4">Link Document from DMS</h3>
            <form onSubmit={handleLinkDoc} className="space-y-4">
              <div>
                <label className="block text-[10px] font-mono text-[var(--text-secondary)] uppercase mb-1">DMS File Reference *</label>
                <select 
                  required 
                  className="quote-filter-input w-full" 
                  value={linkDocForm.document_id} 
                  onChange={(e) => setLinkDocForm(prev => ({ ...prev, document_id: e.target.value }))}
                >
                  <option value="">Select a document...</option>
                  {dmsDocs.map(d => (
                    <option key={d.id} value={d.id}>{d.title} ({d.category})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-mono text-[var(--text-secondary)] uppercase mb-1">Document Classification *</label>
                <select 
                  required 
                  className="quote-filter-input w-full" 
                  value={linkDocForm.document_type} 
                  onChange={(e) => setLinkDocForm(prev => ({ ...prev, document_type: e.target.value as any }))}
                >
                  <option value="PASSPORT">Passport</option>
                  <option value="EMIRATES_ID">Emirates ID</option>
                  <option value="VISA">Visa Document</option>
                  <option value="LABOUR_CARD">Labour Card</option>
                  <option value="MOHRE_CONTRACT">MOHRE Contract</option>
                  <option value="SIRA_CERT">SIRA Certificate</option>
                  <option value="INSURANCE">Insurance Document</option>
                  <option value="OTHER">Other Profile Document</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-4 border-t border-[var(--border)]">
                <button type="button" className="quote-btn quote-btn-secondary" onClick={() => setShowLinkDocModal(false)}>Cancel</button>
                <button type="submit" className="quote-btn quote-btn-primary">Link File</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Certification Modal */}
      {showCertModal && (
        <div className="fixed inset-0 bg-[var(--bg-card)] backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-lg max-w-md w-full p-6">
            <h3 className="text-xs font-mono text-[var(--accent)] uppercase tracking-widest font-bold mb-4">Add Certification Card</h3>
            <form onSubmit={handleAddCert} className="space-y-4">
              <div>
                <label className="block text-[10px] font-mono text-[var(--text-secondary)] uppercase mb-1">Certification Type *</label>
                <select 
                  required 
                  className="quote-filter-input w-full" 
                  value={certForm.cert_type} 
                  onChange={(e) => setCertForm(prev => ({ ...prev, cert_type: e.target.value as any }))}
                >
                  <option value="SIRA_INSTALLATION">SIRA Installation Engineer</option>
                  <option value="SIRA_CCTV_OPERATOR">SIRA CCTV Operator</option>
                  <option value="MANUFACTURER">Manufacturer Training (Free Text)</option>
                  <option value="FIRST_AID">First Aid Certification</option>
                  <option value="WORK_AT_HEIGHT">Work at Height Safety</option>
                  <option value="OTHER">Other Certified Training</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-mono text-[var(--text-secondary)] uppercase mb-1">Certificate Number *</label>
                <input required type="text" className="quote-filter-input w-full" value={certForm.cert_number} onChange={(e) => setCertForm(prev => ({ ...prev, cert_number: e.target.value }))} />
              </div>
              <div>
                <label className="block text-[10px] font-mono text-[var(--text-secondary)] uppercase mb-1">Issue Date *</label>
                <input required type="date" className="quote-filter-input w-full" value={certForm.issue_date} onChange={(e) => setCertForm(prev => ({ ...prev, issue_date: e.target.value }))} />
              </div>
              <div>
                <label className="block text-[10px] font-mono text-[var(--text-secondary)] uppercase mb-1">Expiry Date *</label>
                <input required type="date" className="quote-filter-input w-full" value={certForm.expiry_date} onChange={(e) => setCertForm(prev => ({ ...prev, expiry_date: e.target.value }))} />
              </div>
              <div>
                <label className="block text-[10px] font-mono text-[var(--text-secondary)] uppercase mb-1">Link DMS File (Optional)</label>
                <select 
                  className="quote-filter-input w-full" 
                  value={certForm.document_id} 
                  onChange={(e) => setCertForm(prev => ({ ...prev, document_id: e.target.value }))}
                >
                  <option value="">No attachment...</option>
                  {dmsDocs.map(d => (
                    <option key={d.id} value={d.id}>{d.title}</option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-4 border-t border-[var(--border)]">
                <button type="button" className="quote-btn quote-btn-secondary" onClick={() => setShowCertModal(false)}>Cancel</button>
                <button type="submit" className="quote-btn quote-btn-primary">Add Certificate</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Compensation Modal */}
      {showCompModal && (
        <div className="fixed inset-0 bg-[var(--bg-card)] backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-lg max-w-md w-full p-6">
            <h3 className="text-xs font-mono text-[var(--accent)] uppercase tracking-widest font-bold mb-4">Update Salary Parameters</h3>
            <form onSubmit={handleAddComp} className="space-y-4">
              <div>
                <label className="block text-[10px] font-mono text-[var(--text-secondary)] uppercase mb-1">Effective Date *</label>
                <input required type="date" className="quote-filter-input w-full" value={compForm.effective_from} onChange={(e) => setCompForm(prev => ({ ...prev, effective_from: e.target.value }))} />
              </div>
              <div>
                <label className="block text-[10px] font-mono text-[var(--text-secondary)] uppercase mb-1">Basic Salary (AED) *</label>
                <input required type="number" className="quote-filter-input w-full font-mono" value={compForm.basic_salary} onChange={(e) => setCompForm(prev => ({ ...prev, basic_salary: parseFloat(e.target.value) || 0 }))} />
              </div>
              <div>
                <label className="block text-[10px] font-mono text-[var(--text-secondary)] uppercase mb-1">Housing Allowance (AED)</label>
                <input type="number" className="quote-filter-input w-full font-mono" value={compForm.housing_allowance} onChange={(e) => setCompForm(prev => ({ ...prev, housing_allowance: parseFloat(e.target.value) || 0 }))} />
              </div>
              <div>
                <label className="block text-[10px] font-mono text-[var(--text-secondary)] uppercase mb-1">Transport Allowance (AED)</label>
                <input type="number" className="quote-filter-input w-full font-mono" value={compForm.transport_allowance} onChange={(e) => setCompForm(prev => ({ ...prev, transport_allowance: parseFloat(e.target.value) || 0 }))} />
              </div>
              <div>
                <label className="block text-[10px] font-mono text-[var(--text-secondary)] uppercase mb-1">Other Allowances (AED)</label>
                <input type="number" className="quote-filter-input w-full font-mono" value={compForm.other_allowance} onChange={(e) => setCompForm(prev => ({ ...prev, other_allowance: parseFloat(e.target.value) || 0 }))} />
              </div>
              <div>
                <label className="block text-[10px] font-mono text-[var(--text-secondary)] uppercase mb-1">Burden Multiplier *</label>
                <input required step="0.05" type="number" className="quote-filter-input w-full font-mono" value={compForm.burden_multiplier} onChange={(e) => setCompForm(prev => ({ ...prev, burden_multiplier: parseFloat(e.target.value) || 1.25 }))} />
              </div>
              <div>
                <label className="block text-[10px] font-mono text-[var(--text-secondary)] uppercase mb-1">Notes / Rationale</label>
                <input type="text" className="quote-filter-input w-full" value={compForm.notes} onChange={(e) => setCompForm(prev => ({ ...prev, notes: e.target.value }))} />
              </div>
              <div className="flex justify-end gap-2 pt-4 border-t border-[var(--border)]">
                <button type="button" className="quote-btn quote-btn-secondary" onClick={() => setShowCompModal(false)}>Cancel</button>
                <button type="submit" className="quote-btn quote-btn-primary">Update salary</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
