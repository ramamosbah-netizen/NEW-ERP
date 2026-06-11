// ============================================================
// JEET ERP — Testing & Commissioning Registry Page
// Route: /tc
// ============================================================

'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { 
  Plus, 
  Search, 
  RefreshCw, 
  Play, 
  Calendar, 
  UserCheck, 
  FileDown, 
  Layers, 
  Clock, 
  AlertTriangle,
  FolderOpen
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useProjects } from '@/hooks/useProjects';
import { useTCPackages } from '@/hooks/useTCPackages';
import { tcService } from '@/services/tcService';
import { WitnessRequired, TCPackageStatus } from '@/types/tc.types';
import './tc.css';

const SYSTEM_OPTIONS = [
  { value: 'CCTV', label: 'CCTV System' },
  { value: 'ACS', label: 'Access Control System (ACS)' },
  { value: 'GATE_BARRIER', label: 'Gate Barrier / ANPR' },
  { value: 'FIRE_ALARM', label: 'Fire Alarm Interface' },
  { value: 'STRUCTURED_CABLING', label: 'Structured Cabling' },
  { value: 'BMS', label: 'Building Management System (BMS)' },
  { value: 'MEP', label: 'General MEP / HVAC' }
];

export default function TCRegistryPage() {
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [selectedPkgId, setSelectedPkgId] = useState<string>('');
  const [witnessDate, setWitnessDate] = useState<string>('');
  const [engineers, setEngineers] = useState<{ id: string; full_name: string }[]>([]);

  // Form states for creating package
  const [formTitle, setFormTitle] = useState('');
  const [formSystem, setFormSystem] = useState('CCTV');
  const [formEngineerId, setFormEngineerId] = useState('');
  const [formWitnessRequired, setFormWitnessRequired] = useState<WitnessRequired>('INTERNAL_ONLY');
  const [formTemplateId, setFormTemplateId] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Load projects
  const { projects, loading: projectsLoading } = useProjects();
  
  // Set first project as default when loaded
  useEffect(() => {
    if (projects && projects.length > 0 && !selectedProjectId) {
      setSelectedProjectId(projects[0].id);
    }
  }, [projects, selectedProjectId]);

  // Load packages for selected project
  const { 
    packages, 
    templates, 
    loading: packagesLoading, 
    refetch, 
    createPackage 
  } = useTCPackages(selectedProjectId);

  // Load engineers list
  useEffect(() => {
    const fetchEngineers = async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('role', ['engineer', 'admin', 'manager'])
          .order('full_name', { ascending: true });
        
        if (error) throw error;
        setEngineers(data || []);
      } catch (err) {
        console.error('Failed to load engineers:', err);
      }
    };
    fetchEngineers();
  }, []);

  // Filter packages based on search query
  const filteredPackages = useMemo(() => {
    return packages.filter(p => 
      p.package_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.system.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [packages, searchQuery]);

  const handleCreatePackage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) return;

    try {
      setActionLoading(true);
      await createPackage({
        title: formTitle,
        system: formSystem,
        assigned_engineer_id: formEngineerId || undefined,
        witness_required: formWitnessRequired,
        notes: formNotes,
        templateId: formTemplateId || undefined
      });
      
      // Reset form & close modal
      setFormTitle('');
      setFormSystem('CCTV');
      setFormEngineerId('');
      setFormWitnessRequired('INTERNAL_ONLY');
      setFormTemplateId('');
      setFormNotes('');
      setIsCreateModalOpen(false);
    } catch (err) {
      alert('Error creating package. Please check logs.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleScheduleWitness = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!witnessDate) return;

    try {
      setActionLoading(true);
      await tcService.scheduleWitness(selectedPkgId, new Date(witnessDate).toISOString());
      setIsScheduleModalOpen(false);
      setWitnessDate('');
      await refetch();
    } catch (err) {
      alert('Error scheduling witness. Please check logs.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDownloadPDF = async (pkgId: string, pkgNo: string) => {
    try {
      const { tcReportPDFService } = await import('@/services/tcReportPDFService');
      const storagePath = await tcReportPDFService.generateAndFileTCReport(pkgId);
      
      // Fetch public URL to download
      const { data } = supabase.storage.from('documents').getPublicUrl(storagePath);
      window.open(data.publicUrl, '_blank');
    } catch (err) {
      alert('Failed to generate report PDF. Verify database results are registered.');
    }
  };

  const getStatusBadgeClass = (status: TCPackageStatus) => {
    switch (status) {
      case 'DRAFT': return 'tc-badge tc-badge-draft';
      case 'READY': return 'tc-badge tc-badge-ready';
      case 'IN_PROGRESS': return 'tc-badge tc-badge-progress';
      case 'INTERNAL_PASSED': return 'tc-badge tc-badge-passed';
      case 'WITNESS_SCHEDULED': return 'tc-badge tc-badge-scheduled';
      case 'CONSULTANT_APPROVED': return 'tc-badge tc-badge-passed';
      case 'CLIENT_APPROVED': return 'tc-badge tc-badge-passed';
      case 'COMPLETED': return 'tc-badge tc-badge-completed';
      case 'FAILED_RETEST': return 'tc-badge tc-badge-failed';
      default: return 'tc-badge';
    }
  };

  const formatStatus = (status: TCPackageStatus) => {
    return status.replace(/_/g, ' ');
  };

  return (
    <div className="quote-container">
      {/* Header */}
      <header className="quote-header">
        <div>
          <h1 className="quote-header-title">Testing & Commissioning (T&C)</h1>
          <p className="quote-header-subtitle">JEET ERP ELV System Commissioning Checklist & Witness Verification Registry</p>
        </div>
        <button 
          onClick={() => setIsCreateModalOpen(true)}
          className="quote-btn quote-btn-primary" 
          style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          disabled={!selectedProjectId}
        >
          <Plus size={16} /> Create Package
        </button>
      </header>

      {/* Project Selector & Search */}
      <div className="quote-card" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div style={{ flex: '1', minWidth: '250px' }}>
          <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.4rem', fontWeight: 600 }}>Active Project Selector</label>
          <select 
            value={selectedProjectId} 
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="quote-input"
            style={{ width: '100%' }}
          >
            <option value="" disabled>Select a project...</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.project_number} — {p.name}</option>
            ))}
          </select>
        </div>
        <div style={{ flex: '1', minWidth: '250px' }}>
          <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.4rem', fontWeight: 600 }}>Search Commissioning Packages</label>
          <div style={{ position: 'relative' }}>
            <input 
              type="text" 
              placeholder="Search by ID, title or system..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="quote-input"
              style={{ width: '100%', paddingLeft: '2.5rem' }}
            />
            <Search size={16} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          </div>
        </div>
        <div>
          <label style={{ display: 'block', height: '1.2rem' }}></label>
          <button 
            onClick={() => refetch()} 
            className="quote-btn quote-btn-secondary" 
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', height: '42px' }}
          >
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {/* Packages Grid */}
      {packagesLoading ? (
        <div className="quote-card" style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
          <div className="spinner"></div>
        </div>
      ) : filteredPackages.length === 0 ? (
        <div className="quote-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '4rem 2rem', textAlign: 'center', gap: '1rem' }}>
          <FolderOpen size={48} style={{ color: 'var(--text-muted)' }} />
          <h3 style={{ fontSize: '1.2rem', fontWeight: 600 }}>No Commissioning Packages</h3>
          <p style={{ color: 'var(--text-secondary)', maxWidth: '400px', fontSize: '0.85rem' }}>
            No Testing & Commissioning packages have been configured for this project. Create a package to define the ELV/MEP system checklists.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1.5rem' }}>
          {filteredPackages.map(p => (
            <div key={p.id} className="tc-card">
              {/* Card Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                <div>
                  <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--secondary)', fontWeight: 600 }}>
                    {p.package_number}
                  </span>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0.2rem 0', color: 'var(--text-primary)' }}>
                    {p.title}
                  </h3>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    System: {p.system}
                  </span>
                </div>
                <span className={getStatusBadgeClass(p.status)}>
                  {formatStatus(p.status)}
                </span>
              </div>

              {/* Progress */}
              <div style={{ margin: '1rem 0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '0.3rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Commissioning Completion</span>
                  <span style={{ fontWeight: 'bold', color: 'var(--primary)' }}>{p.completion_pct}%</span>
                </div>
                <div className="progress-bar-container">
                  <div className="progress-bar-fill" style={{ width: `${p.completion_pct}%` }}></div>
                </div>
              </div>

              {/* Details */}
              <div style={{ borderTop: '1px solid var(--border-color)', borderBottom: '1px solid var(--border-color)', padding: '0.75rem 0', margin: '1rem 0', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem', fontSize: '0.8rem' }}>
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.7rem', textTransform: 'uppercase' }}>Assigned Engineer</span>
                  <span style={{ color: 'var(--text-secondary)' }}>{p.assigned_engineer_name || 'Unassigned'}</span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.7rem', textTransform: 'uppercase' }}>Witness Gate</span>
                  <span style={{ color: 'var(--text-secondary)' }}>{p.witness_required.replace(/_/g, ' ')}</span>
                </div>
                {p.scheduled_witness_date && (
                  <div style={{ gridColumn: 'span 2' }}>
                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.7rem', textTransform: 'uppercase' }}>Witness Scheduled</span>
                    <span style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <Clock size={12} className="text-warning" />
                      {new Date(p.scheduled_witness_date).toLocaleString('en-GB')}
                    </span>
                  </div>
                )}
              </div>

              {/* Actions Footer */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                <Link 
                  href={`/tc/${p.id}`} 
                  className="quote-btn quote-btn-secondary" 
                  style={{ textDecoration: 'none', padding: '0.4rem 0.8rem', fontSize: '0.75rem', flex: '1', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem' }}
                >
                  <Layers size={12} /> Workspace
                </Link>
                <Link 
                  href={`/tc/execute/${p.id}`} 
                  className="quote-btn quote-btn-primary" 
                  style={{ textDecoration: 'none', padding: '0.4rem 0.8rem', fontSize: '0.75rem', flex: '1', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem' }}
                >
                  <Play size={12} /> Execute
                </Link>
                {p.status === 'INTERNAL_PASSED' && (
                  <button 
                    onClick={() => {
                      setSelectedPkgId(p.id);
                      setIsScheduleModalOpen(true);
                    }}
                    className="quote-btn"
                    style={{ background: 'rgba(168, 85, 247, 0.1)', border: '1px solid rgba(168, 85, 247, 0.3)', color: 'var(--accent)', padding: '0.4rem 0.8rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem', width: '100%' }}
                  >
                    <Calendar size={12} /> Schedule Witness Validation
                  </button>
                )}
                {p.status === 'WITNESS_SCHEDULED' && (
                  <Link 
                    href={`/tc/witness/${p.id}`} 
                    className="quote-btn"
                    style={{ background: 'rgba(245, 158, 11, 0.15)', border: '1px solid rgba(245, 158, 11, 0.35)', color: 'var(--warning)', textDecoration: 'none', padding: '0.4rem 0.8rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem', width: '100%' }}
                  >
                    <UserCheck size={12} /> Witness Sign-Off Panel
                  </Link>
                )}
                {(p.status === 'COMPLETED' || p.status === 'CONSULTANT_APPROVED' || p.status === 'CLIENT_APPROVED') && (
                  <button 
                    onClick={() => handleDownloadPDF(p.id, p.package_number)}
                    className="quote-btn"
                    style={{ background: 'rgba(0, 229, 160, 0.1)', border: '1px solid rgba(0, 229, 160, 0.3)', color: 'var(--primary)', padding: '0.4rem 0.8rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem', width: '100%' }}
                  >
                    <FileDown size={12} /> Download Commissioning Certificate
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* CREATE PACKAGE MODAL */}
      {isCreateModalOpen && (
        <div className="tc-modal-overlay">
          <div className="tc-modal-content">
            <h2 className="tc-modal-title">Create Commissioning Package</h2>
            <form onSubmit={handleCreatePackage} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
              <div>
                <label className="quote-form-label">Package Description / Title</label>
                <input 
                  type="text" 
                  placeholder="e.g. Phase 2 CCTV SIRA Testing"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="quote-input"
                  style={{ width: '100%' }}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label className="quote-form-label">ELV/MEP System Type</label>
                  <select 
                    value={formSystem} 
                    onChange={(e) => setFormSystem(e.target.value)}
                    className="quote-input"
                    style={{ width: '100%' }}
                  >
                    {SYSTEM_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="quote-form-label">Witness Validation Gate</label>
                  <select 
                    value={formWitnessRequired} 
                    onChange={(e) => setFormWitnessRequired(e.target.value as WitnessRequired)}
                    className="quote-input"
                    style={{ width: '100%' }}
                  >
                    <option value="INTERNAL_ONLY">Internal QC Only</option>
                    <option value="CONSULTANT">Consultant Witness</option>
                    <option value="CLIENT">Client Witness</option>
                    <option value="BOTH">Consultant + Client</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label className="quote-form-label">Assigned Site Engineer</label>
                  <select 
                    value={formEngineerId} 
                    onChange={(e) => setFormEngineerId(e.target.value)}
                    className="quote-input"
                    style={{ width: '100%' }}
                  >
                    <option value="">Select engineer...</option>
                    {engineers.map(eng => (
                      <option key={eng.id} value={eng.id}>{eng.full_name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="quote-form-label">Copy Scripts from Template</label>
                  <select 
                    value={formTemplateId} 
                    onChange={(e) => setFormTemplateId(e.target.value)}
                    className="quote-input"
                    style={{ width: '100%' }}
                  >
                    <option value="">No template (Blank list)</option>
                    {templates.map(tpl => (
                      <option key={tpl.id} value={tpl.id}>{tpl.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="quote-form-label">Method Statement / Notes</label>
                <textarea 
                  placeholder="Notes, parameters, or specifications..."
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="quote-input"
                  style={{ width: '100%', height: '80px', resize: 'none' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                <button 
                  type="button" 
                  onClick={() => setIsCreateModalOpen(false)}
                  className="quote-btn quote-btn-secondary"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="quote-btn quote-btn-primary"
                  disabled={actionLoading}
                >
                  {actionLoading ? 'Creating...' : 'Initialize Package'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SCHEDULE WITNESS MODAL */}
      {isScheduleModalOpen && (
        <div className="tc-modal-overlay">
          <div className="tc-modal-content" style={{ maxWidth: '400px' }}>
            <h2 className="tc-modal-title">Schedule Witness Inspection</h2>
            <form onSubmit={handleScheduleWitness} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
              <div>
                <label className="quote-form-label">Scheduled Date & Time</label>
                <input 
                  type="datetime-local" 
                  value={witnessDate}
                  onChange={(e) => setWitnessDate(e.target.value)}
                  className="quote-input"
                  style={{ width: '100%' }}
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                <button 
                  type="button" 
                  onClick={() => setIsScheduleModalOpen(false)}
                  className="quote-btn quote-btn-secondary"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="quote-btn quote-btn-primary"
                  disabled={actionLoading}
                >
                  {actionLoading ? 'Scheduling...' : 'Confirm Schedule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
