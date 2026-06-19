// ============================================================
// JEET ERP — Employees Master List Dashboard Registry
// Route: /hr
// ============================================================

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Plus, 
  Search, 
  RefreshCw, 
  Eye, 
  ShieldAlert,
  Users,
  Briefcase,
  FileText,
  Calendar,
  X
} from 'lucide-react';
import { useEmployees } from '@/hooks/useEmployees';
import { employeeService } from '@/services/employeeService';
import { useCompany } from '@/lib/company/useCompany';
import { supabase } from '@/lib/supabase';
import type { Employee } from '@/types/hr.types';
import './hr.css';

export default function EmployeesListPage() {
  const { activeCompanyId } = useCompany();
  const [filters, setFilters] = useState({
    department: '',
    status: ''
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [projects, setProjects] = useState<{ id: string; label: string }[]>([]);

  useEffect(() => {
    supabase.from('projects').select('id, project_number, name').order('project_number', { ascending: false })
      .then(({ data }) => setProjects((data || []).map((p: any) => ({ id: p.id, label: `${p.project_number} — ${p.name}` }))));
  }, []);

  const { employees, loading, error, refetch } = useEmployees({ ...filters, companyId: activeCompanyId || undefined });

  // Add Employee Form State
  const [form, setForm] = useState({
    full_name_en: '',
    full_name_ar: '',
    nationality: '',
    dob: '',
    gender: 'MALE' as any,
    mobile: '',
    personal_email: '',
    photo_path: '',
    designation: '',
    department: 'PROJECTS' as any,
    assigned_project_id: '',
    employment_type: 'FULL_TIME' as any,
    join_date: '',
    probation_end_date: '',
    status: 'ACTIVE' as any,
    passport_no: '',
    passport_expiry: '',
    emirates_id_no: '',
    emirates_id_expiry: '',
    visa_no: '',
    visa_expiry: '',
    visa_sponsor: 'JEET' as any,
    labour_card_no: '',
    labour_card_expiry: '',
    mohre_person_code: '',
    iloe_insurance_expiry: '',
    medical_insurance_expiry: '',
    driving_license_expiry: '',
    bank_name: '',
    iban: '',
    routing_code: '',
    agent_id: ''
  });

  const handleFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      // Clean up empty strings to null for optional dates
      const { assigned_project_id, ...rest } = form;
      const payload: any = {
        ...rest,
        probation_end_date: form.probation_end_date || null,
        iloe_insurance_expiry: form.iloe_insurance_expiry || null,
        driving_license_expiry: form.driving_license_expiry || null,
        exit_date: null,
        exit_type: null,
        user_id: null
      };
      // Only send when set (column is added by migration 20260614240000)
      if (assigned_project_id) payload.assigned_project_id = assigned_project_id;
      payload.company_id = activeCompanyId || undefined; // multi-company tag (wave 2)

      await employeeService.createEmployee(payload);
      setShowAddModal(false);
      refetch();
      // Reset form
      setForm({
        full_name_en: '',
        full_name_ar: '',
        nationality: '',
        dob: '',
        gender: 'MALE',
        mobile: '',
        personal_email: '',
        photo_path: '',
        designation: '',
        department: 'PROJECTS',
        assigned_project_id: '',
        employment_type: 'FULL_TIME',
        join_date: '',
        probation_end_date: '',
        status: 'ACTIVE',
        passport_no: '',
        passport_expiry: '',
        emirates_id_no: '',
        emirates_id_expiry: '',
        visa_no: '',
        visa_expiry: '',
        visa_sponsor: 'JEET',
        labour_card_no: '',
        labour_card_expiry: '',
        mohre_person_code: '',
        iloe_insurance_expiry: '',
        medical_insurance_expiry: '',
        driving_license_expiry: '',
        bank_name: '',
        iban: '',
        routing_code: '',
        agent_id: ''
      });
    } catch (err: any) {
      alert(`Failed to create employee: ${err.message || err}`);
    } finally {
      setSaving(false);
    }
  };

  // Filtered employees list based on search bar
  const filteredEmployees = employees.filter(emp => {
    const query = searchQuery.toLowerCase();
    return (
      emp.full_name_en.toLowerCase().includes(query) ||
      emp.employee_number.toLowerCase().includes(query) ||
      emp.designation.toLowerCase().includes(query) ||
      emp.nationality.toLowerCase().includes(query)
    );
  });

  return (
    <div className="quote-container">
      {/* Header */}
      <header className="quote-header">
        <div>
          <h1 className="quote-header-title">Employee Master registry</h1>
          <p className="quote-header-subtitle">JEET ERP operational workforce management and document compliance panel</p>
        </div>
        <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'center' }}>
          {/* Sub Navigation Links */}
          <Link href="/hr/compliance" className="quote-btn quote-btn-secondary" style={{ textDecoration: 'none', display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
            <FileText size={14} /> Compliance Audit
          </Link>
          <Link href="/hr/approvals" className="quote-btn quote-btn-secondary" style={{ textDecoration: 'none', display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
            <Briefcase size={14} /> Leave Approvals
          </Link>
          <Link href="/hr/calendar" className="quote-btn quote-btn-secondary" style={{ textDecoration: 'none', display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
            <Calendar size={14} /> Leave Calendar
          </Link>
          <button 
            type="button"
            className="quote-btn quote-btn-primary" 
            onClick={() => setShowAddModal(true)}
          >
            <Plus size={16} /> Onboard Employee
          </button>
        </div>
      </header>

      {/* KPI Cards Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded p-4 flex items-center justify-between">
          <div>
            <span className="text-[var(--text-muted)] block uppercase font-mono text-[9px]">Total Workforce</span>
            <span className="font-mono text-xl font-extrabold text-[var(--text-primary)] mt-1 block">{employees.length}</span>
          </div>
          <Users className="text-[var(--accent)] opacity-80" size={24} />
        </div>
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded p-4 flex items-center justify-between">
          <div>
            <span className="text-[var(--text-muted)] block uppercase font-mono text-[9px]">Projects Dept</span>
            <span className="font-mono text-xl font-extrabold text-[var(--text-primary)] mt-1 block">
              {employees.filter(e => e.department === 'PROJECTS').length}
            </span>
          </div>
          <Briefcase className="text-[var(--accent)] opacity-80" size={24} />
        </div>
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded p-4 flex items-center justify-between">
          <div>
            <span className="text-[var(--text-muted)] block uppercase font-mono text-[9px]">Active Status</span>
            <span className="font-mono text-xl font-extrabold text-[var(--text-primary)] mt-1 block">
              {employees.filter(e => e.status === 'ACTIVE').length}
            </span>
          </div>
          <div className="compliance-light green w-3 h-3" />
        </div>
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded p-4 flex items-center justify-between">
          <div>
            <span className="text-[var(--text-muted)] block uppercase font-mono text-[9px]">Compliance Audits</span>
            <span className="font-mono text-xl font-extrabold text-[var(--text-primary)] mt-1 block">Audit Ready</span>
          </div>
          <ShieldAlert className="text-[var(--status-warning-text)]" size={24} />
        </div>
      </div>

      {/* Filters Card */}
      <div className="quote-card">
        <div className="quote-filters-bar" style={{ marginBottom: 0 }}>
          <div style={{ display: 'flex', flex: 1, gap: '1rem', minWidth: '300px' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search size={16} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--text-muted)' }} />
              <input
                type="text"
                name="search"
                className="quote-filter-input"
                placeholder="Search name, code, designation, nationality..."
                style={{ paddingLeft: '2.2rem', width: '100%' }}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <select
            name="department"
            className="quote-filter-input"
            value={filters.department}
            onChange={handleFilterChange}
          >
            <option value="">All Departments</option>
            <option value="PROJECTS">Projects</option>
            <option value="SERVICE">Service</option>
            <option value="ESTIMATION">Estimation</option>
            <option value="PROCUREMENT">Procurement</option>
            <option value="FINANCE">Finance</option>
            <option value="ADMIN">Admin</option>
            <option value="MANAGEMENT">Management</option>
          </select>

          <select
            name="status"
            className="quote-filter-input"
            value={filters.status}
            onChange={handleFilterChange}
          >
            <option value="">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="ON_LEAVE">On Leave</option>
            <option value="NOTICE_PERIOD">Notice Period</option>
            <option value="EXITED">Exited</option>
          </select>

          <button className="quote-btn quote-btn-secondary" onClick={() => refetch()}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {/* Main List Area */}
      {loading ? (
        <div style={{ padding: '4rem', textAlign: 'center' }} className="quote-card">
          <div className="spinner" style={{ margin: '0 auto 1rem auto' }}></div>
          <p>Compiling employee registries and compliance documents...</p>
        </div>
      ) : error ? (
        <div style={{ padding: '2rem', textAlign: 'center', color: '#ef4444' }} className="quote-card">
          <p>Error loading employees: {error.message}</p>
        </div>
      ) : filteredEmployees.length === 0 ? (
        <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }} className="quote-card">
          <Users size={48} style={{ margin: '0 auto 1rem auto', opacity: 0.3 }} />
          <p>No employees found matching filter parameters</p>
        </div>
      ) : (
        <div className="quote-card">
          <div className="quote-table-wrap">
            <table className="quote-table">
              <thead>
                <tr>
                  <th>Employee ID</th>
                  <th>Name</th>
                  <th>Designation</th>
                  <th>Department</th>
                  <th>Employment Type</th>
                  <th>Nationality</th>
                  <th>Join Date</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'center' }}>Details</th>
                </tr>
              </thead>
              <tbody>
                {filteredEmployees.map((emp) => (
                  <tr key={emp.id}>
                    <td style={{ fontWeight: 700, color: 'var(--secondary)', fontFamily: 'var(--font-mono)' }}>
                      <Link href={`/hr/${emp.id}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                        {emp.employee_number}
                      </Link>
                    </td>
                    <td style={{ fontWeight: 600 }}>{emp.full_name_en}</td>
                    <td>{emp.designation}</td>
                    <td>{emp.department}</td>
                    <td style={{ fontSize: '0.78rem' }}>{emp.employment_type.replace('_', ' ')}</td>
                    <td>{emp.nationality}</td>
                    <td>{new Date(emp.join_date).toLocaleDateString('en-GB')}</td>
                    <td>
                      <span className={`badge-status ${emp.status.toLowerCase()}`}>
                        {emp.status}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <Link href={`/hr/${emp.id}`} className="quote-btn quote-btn-secondary" style={{ padding: '0.3rem 0.6rem' }}>
                        <Eye size={12} /> View Profile
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Onboard Employee Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-[var(--bg-card)] backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto flex flex-col">
            <div className="flex justify-between items-center p-6 border-b border-[var(--border)]">
              <h2 className="text-xs font-mono text-[var(--accent)] uppercase tracking-widest font-bold">Onboard New Employee</h2>
              <button onClick={() => setShowAddModal(false)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                <X size={18} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-6 flex-1">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Section 1: Basic Info */}
                <div className="md:col-span-3">
                  <h3 className="text-[10px] font-mono text-[var(--text-muted)] uppercase tracking-widest border-b border-[var(--border)] pb-2 mb-4">1. Personal & Contact Parameters</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-[10px] font-mono text-[var(--text-secondary)] uppercase mb-1">Full Name (EN) *</label>
                      <input required type="text" name="full_name_en" className="quote-filter-input w-full" value={form.full_name_en} onChange={handleInputChange} />
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono text-[var(--text-secondary)] uppercase mb-1">Full Name (AR) *</label>
                      <input required type="text" name="full_name_ar" className="quote-filter-input w-full text-right" dir="rtl" value={form.full_name_ar} onChange={handleInputChange} />
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono text-[var(--text-secondary)] uppercase mb-1">Nationality *</label>
                      <input required type="text" name="nationality" className="quote-filter-input w-full" value={form.nationality} onChange={handleInputChange} />
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono text-[var(--text-secondary)] uppercase mb-1">Date of Birth *</label>
                      <input required type="date" name="dob" className="quote-filter-input w-full" value={form.dob} onChange={handleInputChange} />
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono text-[var(--text-secondary)] uppercase mb-1">Gender *</label>
                      <select name="gender" className="quote-filter-input w-full" value={form.gender} onChange={handleInputChange}>
                        <option value="MALE">Male</option>
                        <option value="FEMALE">Female</option>
                        <option value="OTHER">Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono text-[var(--text-secondary)] uppercase mb-1">Mobile No *</label>
                      <input required type="text" name="mobile" className="quote-filter-input w-full" placeholder="+971-XX-XXXXXXX" value={form.mobile} onChange={handleInputChange} />
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono text-[var(--text-secondary)] uppercase mb-1">Personal Email *</label>
                      <input required type="email" name="personal_email" className="quote-filter-input w-full" value={form.personal_email} onChange={handleInputChange} />
                    </div>
                  </div>
                </div>

                {/* Section 2: Job parameters */}
                <div className="md:col-span-3">
                  <h3 className="text-[10px] font-mono text-[var(--text-muted)] uppercase tracking-widest border-b border-[var(--border)] pb-2 mb-4">2. Employment & Designation Parameters</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-[10px] font-mono text-[var(--text-secondary)] uppercase mb-1">Designation *</label>
                      <input required type="text" name="designation" className="quote-filter-input w-full" placeholder="e.g. ELV Technician" value={form.designation} onChange={handleInputChange} />
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono text-[var(--text-secondary)] uppercase mb-1">Department *</label>
                      <select name="department" className="quote-filter-input w-full" value={form.department} onChange={handleInputChange}>
                        <option value="PROJECTS">Projects</option>
                        <option value="SERVICE">Service</option>
                        <option value="ESTIMATION">Estimation</option>
                        <option value="PROCUREMENT">Procurement</option>
                        <option value="FINANCE">Finance</option>
                        <option value="ADMIN">Admin</option>
                        <option value="MANAGEMENT">Management</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono text-[var(--text-secondary)] uppercase mb-1">Assigned project (payroll fallback)</label>
                      <select name="assigned_project_id" className="quote-filter-input w-full" value={form.assigned_project_id} onChange={handleInputChange}>
                        <option value="">None (Office)</option>
                        {projects.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono text-[var(--text-secondary)] uppercase mb-1">Employment Type *</label>
                      <select name="employment_type" className="quote-filter-input w-full" value={form.employment_type} onChange={handleInputChange}>
                        <option value="FULL_TIME">Full Time</option>
                        <option value="LIMITED_CONTRACT">Limited Contract</option>
                        <option value="OUTSOURCED">Outsourced</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono text-[var(--text-secondary)] uppercase mb-1">Join Date *</label>
                      <input required type="date" name="join_date" className="quote-filter-input w-full" value={form.join_date} onChange={handleInputChange} />
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono text-[var(--text-secondary)] uppercase mb-1">Probation End Date</label>
                      <input type="date" name="probation_end_date" className="quote-filter-input w-full" value={form.probation_end_date} onChange={handleInputChange} />
                    </div>
                  </div>
                </div>

                {/* Section 3: Compliance documents */}
                <div className="md:col-span-3">
                  <h3 className="text-[10px] font-mono text-[var(--text-muted)] uppercase tracking-widest border-b border-[var(--border)] pb-2 mb-4">3. UAE Document Compliance Parameters</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-[10px] font-mono text-[var(--text-secondary)] uppercase mb-1">Passport No *</label>
                      <input required type="text" name="passport_no" className="quote-filter-input w-full" value={form.passport_no} onChange={handleInputChange} />
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono text-[var(--text-secondary)] uppercase mb-1">Passport Expiry *</label>
                      <input required type="date" name="passport_expiry" className="quote-filter-input w-full" value={form.passport_expiry} onChange={handleInputChange} />
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono text-[var(--text-secondary)] uppercase mb-1">Emirates ID No *</label>
                      <input required type="text" name="emirates_id_no" className="quote-filter-input w-full" placeholder="784-YYYY-XXXXXXX-X" value={form.emirates_id_no} onChange={handleInputChange} />
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono text-[var(--text-secondary)] uppercase mb-1">Emirates ID Expiry *</label>
                      <input required type="date" name="emirates_id_expiry" className="quote-filter-input w-full" value={form.emirates_id_expiry} onChange={handleInputChange} />
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono text-[var(--text-secondary)] uppercase mb-1">Visa No *</label>
                      <input required type="text" name="visa_no" className="quote-filter-input w-full" value={form.visa_no} onChange={handleInputChange} />
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono text-[var(--text-secondary)] uppercase mb-1">Visa Expiry *</label>
                      <input required type="date" name="visa_expiry" className="quote-filter-input w-full" value={form.visa_expiry} onChange={handleInputChange} />
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono text-[var(--text-secondary)] uppercase mb-1">Visa Sponsor *</label>
                      <select name="visa_sponsor" className="quote-filter-input w-full" value={form.visa_sponsor} onChange={handleInputChange}>
                        <option value="JEET">JEET Security (Own)</option>
                        <option value="OTHER">Other / Client / Spouse</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono text-[var(--text-secondary)] uppercase mb-1">Labour Card No *</label>
                      <input required type="text" name="labour_card_no" className="quote-filter-input w-full" value={form.labour_card_no} onChange={handleInputChange} />
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono text-[var(--text-secondary)] uppercase mb-1">Labour Card Expiry *</label>
                      <input required type="date" name="labour_card_expiry" className="quote-filter-input w-full" value={form.labour_card_expiry} onChange={handleInputChange} />
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono text-[var(--text-secondary)] uppercase mb-1">MOHRE Person Code *</label>
                      <input required type="text" name="mohre_person_code" className="quote-filter-input w-full" placeholder="14-digit code" value={form.mohre_person_code} onChange={handleInputChange} />
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono text-[var(--text-secondary)] uppercase mb-1">Medical Insurance Expiry *</label>
                      <input required type="date" name="medical_insurance_expiry" className="quote-filter-input w-full" value={form.medical_insurance_expiry} onChange={handleInputChange} />
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono text-[var(--text-secondary)] uppercase mb-1">ILOE Insurance Expiry</label>
                      <input type="date" name="iloe_insurance_expiry" className="quote-filter-input w-full" value={form.iloe_insurance_expiry} onChange={handleInputChange} />
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono text-[var(--text-secondary)] uppercase mb-1">Driving License Expiry</label>
                      <input type="date" name="driving_license_expiry" className="quote-filter-input w-full" value={form.driving_license_expiry} onChange={handleInputChange} />
                    </div>
                  </div>
                </div>

                {/* Section 4: Bank Details */}
                <div className="md:col-span-3">
                  <h3 className="text-[10px] font-mono text-[var(--text-muted)] uppercase tracking-widest border-b border-[var(--border)] pb-2 mb-4">4. Bank & WPS salary Card Details</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-[10px] font-mono text-[var(--text-secondary)] uppercase mb-1">Bank Name *</label>
                      <input required type="text" name="bank_name" className="quote-filter-input w-full" placeholder="e.g. ADCB / C3 Card" value={form.bank_name} onChange={handleInputChange} />
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono text-[var(--text-secondary)] uppercase mb-1">IBAN *</label>
                      <input required type="text" name="iban" className="quote-filter-input w-full font-mono" placeholder="AE..." value={form.iban} onChange={handleInputChange} />
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono text-[var(--text-secondary)] uppercase mb-1">Bank Routing Code *</label>
                      <input required type="text" name="routing_code" className="quote-filter-input w-full" placeholder="9-digit code" value={form.routing_code} onChange={handleInputChange} />
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono text-[var(--text-secondary)] uppercase mb-1">WPS Agent ID *</label>
                      <input required type="text" name="agent_id" className="quote-filter-input w-full" placeholder="e.g. C3 Card Agent ID" value={form.agent_id} onChange={handleInputChange} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-6 border-t border-[var(--border)]">
                <button type="button" className="quote-btn quote-btn-secondary" onClick={() => setShowAddModal(false)}>Cancel</button>
                <button type="submit" disabled={saving} className="quote-btn quote-btn-primary flex items-center gap-2">
                  {saving ? 'Onboarding...' : 'Save & Onboard'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
