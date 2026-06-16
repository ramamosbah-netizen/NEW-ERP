// ============================================================
// JEET ERP — Snags Kanban Registry Page
// Route: /snags
// ============================================================

'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { 
  Plus, 
  Search, 
  RefreshCw, 
  FileDown, 
  Layers, 
  AlertTriangle,
  X,
  Camera,
  Calendar,
  CheckCircle,
  Clock,
  ExternalLink,
  Info
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useProjects } from '@/hooks/useProjects';
import { useSnags } from '@/hooks/useSnags';
import WorkflowPanel from '@/components/workflow/WorkflowPanel';
import { Snag, SnagSeverity, SnagStatus, SnagSource } from '@/types/snag.types';
import './snags.css';

const KANBAN_STATUSES: SnagStatus[] = [
  'OPEN',
  'IN_PROGRESS',
  'READY_FOR_INSPECTION',
  'CLOSED',
  'DEFERRED_TO_DLP'
];

const STATUS_LABELS = {
  OPEN: 'Open / Logged',
  IN_PROGRESS: 'Under Rectification',
  READY_FOR_INSPECTION: 'Ready for QC',
  CLOSED: 'Closed & Verified',
  DEFERRED_TO_DLP: 'Deferred to DLP',
  DISPUTED: 'Disputed'
};

export default function SnagsRegistryPage() {
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [severityFilter, setSeverityFilter] = useState<string>('');
  
  // Modal & Drawer states
  const [selectedSnag, setSelectedSnag] = useState<Snag | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Transition form states
  const [transitionStatus, setTransitionStatus] = useState<SnagStatus>('OPEN');
  const [evidencePhotos, setEvidencePhotos] = useState<File[]>([]);
  const [evidenceUrls, setEvidenceUrls] = useState<string[]>([]);
  const [deferralJustification, setDeferralJustification] = useState('');
  const [engineers, setEngineers] = useState<{ id: string; full_name: string }[]>([]);

  // Create snag form states
  const [formSource, setFormSource] = useState<SnagSource>('INTERNAL_QA');
  const [formSystem, setFormSystem] = useState('CCTV');
  const [formLocation, setFormLocation] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formSeverity, setFormSeverity] = useState<SnagSeverity>('MINOR');
  const [formAssignedTo, setFormAssignedTo] = useState('');
  const [formSubcontractor, setFormSubcontractor] = useState('');
  const [formTargetDate, setFormTargetDate] = useState('');
  const [formPhotos, setFormPhotos] = useState<File[]>([]);
  const [formPhotoUrls, setFormPhotoUrls] = useState<string[]>([]);

  // Load projects
  const { projects } = useProjects();
  
  // Set first project as default when loaded
  useEffect(() => {
    if (projects && projects.length > 0 && !selectedProjectId) {
      setSelectedProjectId(projects[0].id);
    }
  }, [projects, selectedProjectId]);

  // Load snags for selected project
  const { 
    snags, 
    loading: snagsLoading, 
    refetch, 
    createSnag, 
    transitionStatus: serviceTransitionStatus,
    exportPDF 
  } = useSnags(selectedProjectId);

  // Fetch profiles
  useEffect(() => {
    const fetchEngineers = async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name')
        .order('full_name', { ascending: true });
      if (!error && data) setEngineers(data);
    };
    fetchEngineers();
  }, []);

  // Filter snags
  const filteredSnags = useMemo(() => {
    return snags.filter(s => {
      const matchesSearch = s.snag_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.system.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesSeverity = severityFilter ? s.severity === severityFilter : true;

      return matchesSearch && matchesSeverity;
    });
  }, [snags, searchQuery, severityFilter]);

  const handleCreateSnag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formDescription.trim() || !formLocation.trim()) return;

    try {
      setActionLoading(true);

      // Upload photos
      const uploadedPaths: string[] = [];
      for (const file of formPhotos) {
        const path = `snag_photos/${selectedProjectId}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
        const { data, error } = await supabase.storage.from('documents').upload(path, file);
        if (error) throw error;
        if (data) uploadedPaths.push(data.path);
      }

      await createSnag({
        source: formSource,
        system: formSystem,
        location: formLocation,
        description: formDescription,
        severity: formSeverity,
        photo_paths: uploadedPaths,
        assigned_to: formAssignedTo || undefined,
        subcontractor_name: formSubcontractor || undefined,
        target_date: formTargetDate || undefined
      });

      // Reset
      setFormLocation('');
      setFormDescription('');
      setFormSeverity('MINOR');
      setFormAssignedTo('');
      setFormSubcontractor('');
      setFormTargetDate('');
      setFormPhotos([]);
      setFormPhotoUrls([]);
      setIsCreateModalOpen(false);
    } catch (err) {
      alert('Failed to log snag. Check database constraints.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleTransition = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSnag) return;

    try {
      setActionLoading(true);

      // Upload closed evidence photos if applicable
      const uploadedPaths: string[] = [];
      if (transitionStatus === 'READY_FOR_INSPECTION') {
        for (const file of evidencePhotos) {
          const path = `snag_evidence/${selectedSnag.id}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
          const { data, error } = await supabase.storage.from('documents').upload(path, file);
          if (error) throw error;
          if (data) uploadedPaths.push(data.path);
        }
      }

      await serviceTransitionStatus(selectedSnag.id, transitionStatus, {
        photo_paths: uploadedPaths.length > 0 ? uploadedPaths : undefined,
        deferral_justification: transitionStatus === 'DEFERRED_TO_DLP' ? deferralJustification : undefined
      });

      setSelectedSnag(null);
      setEvidencePhotos([]);
      setEvidenceUrls([]);
      setDeferralJustification('');
      alert(`Snag status updated to ${transitionStatus}!`);
      await refetch();
    } catch (err: any) {
      alert(err.message || 'Transition failed.');
    } finally {
      setActionLoading(false);
    }
  };

  const triggerExport = async () => {
    try {
      const storagePath = await exportPDF();
      const { data } = supabase.storage.from('documents').getPublicUrl(storagePath);
      window.open(data.publicUrl, '_blank');
    } catch (err) {
      alert('Failed to compile snag register.');
    }
  };

  const getSeverityBadgeClass = (sev: SnagSeverity) => {
    switch (sev) {
      case 'MINOR': return 'snag-sev-badge snag-sev-badge-minor';
      case 'MAJOR': return 'snag-sev-badge snag-sev-badge-major';
      case 'CRITICAL': return 'snag-sev-badge snag-sev-badge-critical';
      default: return 'snag-sev-badge';
    }
  };

  const getCardBorderClass = (sev: SnagSeverity) => {
    switch (sev) {
      case 'MINOR': return 'snag-card snag-sev-minor';
      case 'MAJOR': return 'snag-card snag-sev-major';
      case 'CRITICAL': return 'snag-card snag-sev-critical';
      default: return 'snag-card';
    }
  };

  return (
    <div className="quote-container">
      {/* Header */}
      <header className="quote-header">
        <div>
          <h1 className="quote-header-title">Punch / Snag List Registry</h1>
          <p className="quote-header-subtitle">JEET ERP operations snag management board with closer-verifier segregation</p>
        </div>
        <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'center' }}>
          <Link href="/snags/capture" className="quote-btn quote-btn-secondary" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Layers size={14} /> Walkthrough logger
          </Link>
          <button 
            onClick={() => setIsCreateModalOpen(true)}
            className="quote-btn quote-btn-primary" 
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
            disabled={!selectedProjectId}
          >
            <Plus size={16} /> Log Snag
          </button>
        </div>
      </header>

      {/* Filters */}
      <div className="quote-card" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div style={{ flex: '1.5', minWidth: '220px' }}>
          <label className="quote-form-label">Project Selector</label>
          <select 
            value={selectedProjectId} 
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="quote-input"
            style={{ width: '100%' }}
          >
            <option value="" disabled>Select project...</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.project_number} — {p.name}</option>
            ))}
          </select>
        </div>

        <div style={{ flex: '1', minWidth: '150px' }}>
          <label className="quote-form-label">Severity Filter</label>
          <select 
            value={severityFilter} 
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="quote-input"
            style={{ width: '100%' }}
          >
            <option value="">All Severities</option>
            <option value="MINOR">Minor</option>
            <option value="MAJOR">Major</option>
            <option value="CRITICAL">Critical</option>
          </select>
        </div>

        <div style={{ flex: '2', minWidth: '220px' }}>
          <label className="quote-form-label">Search Snags</label>
          <div style={{ position: 'relative' }}>
            <input 
              type="text" 
              placeholder="Search snag number, description, location..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="quote-input"
              style={{ width: '100%', paddingLeft: '2.5rem' }}
            />
            <Search size={16} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          </div>
        </div>

        <div>
          <label className="quote-form-label" style={{ height: '1.2rem' }}></label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button 
              onClick={triggerExport}
              className="quote-btn quote-btn-secondary"
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', height: '42px' }}
              disabled={!selectedProjectId || snags.length === 0}
            >
              <FileDown size={14} /> Export Register PDF
            </button>
            <button 
              onClick={() => refetch()} 
              className="quote-btn quote-btn-secondary" 
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', height: '42px' }}
            >
              <RefreshCw size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Kanban Board */}
      {snagsLoading ? (
        <div className="quote-card" style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
          <div className="spinner"></div>
        </div>
      ) : (
        <div className="kanban-board">
          {KANBAN_STATUSES.map(colStatus => {
            const colSnags = filteredSnags.filter(s => s.status === colStatus);
            return (
              <div key={colStatus} className="kanban-column">
                <div className="kanban-column-header">
                  <span className="kanban-column-title">{STATUS_LABELS[colStatus]}</span>
                  <span className="kanban-column-count">{colSnags.length}</span>
                </div>
                
                <div className="kanban-cards-container">
                  {colSnags.length === 0 ? (
                    <div style={{ padding: '2rem 1rem', border: '1px dashed var(--border-color)', borderRadius: '8px', color: 'var(--text-muted)', fontSize: '0.75rem', textAlign: 'center' }}>
                      No items
                    </div>
                  ) : (
                    colSnags.map(s => (
                      <div 
                        key={s.id} 
                        className={getCardBorderClass(s.severity)}
                        onClick={() => {
                          setSelectedSnag(s);
                          setTransitionStatus(s.status);
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                          <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--secondary)', fontWeight: 600 }}>{s.snag_number}</span>
                          <span className={getSeverityBadgeClass(s.severity)}>{s.severity}</span>
                        </div>
                        <h4 style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', lineClamp: 2, overflow: 'hidden' }}>{s.description}</h4>
                        <div style={{ marginTop: '0.6rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                          <div>Location: {s.location}</div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.2rem' }}>
                            <span>Trade: {s.system}</span>
                            {s.target_date && <span className="text-warning">{new Date(s.target_date).toLocaleDateString('en-GB')}</span>}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* DETAIL OVERLAY DRAWER */}
      {selectedSnag && (
        <>
          <div className="tc-modal-overlay" onClick={() => setSelectedSnag(null)}></div>
          <div className="snag-details-overlay">
            <button className="snag-details-close" onClick={() => setSelectedSnag(null)} style={{ border: 0, fontSize: '1.2rem' }}>
              <X size={20} />
            </button>
            
            <div style={{ marginTop: '1.5rem', flex: '1' }}>
              <span style={{ fontSize: '0.8rem', fontFamily: 'var(--font-mono)', color: 'var(--secondary)', fontWeight: 600 }}>{selectedSnag.snag_number}</span>
              <h2 style={{ fontSize: '1.3rem', fontWeight: 700, margin: '0.2rem 0' }}>Snag Item Details</h2>
              <span className={getSeverityBadgeClass(selectedSnag.severity)}>{selectedSnag.severity} Severity</span>

              {/* Configurable workflow (Admin Center → Workflows) */}
              <div style={{ margin: '1rem 0' }}>
                <WorkflowPanel moduleKey="SNAG" entityId={selectedSnag.id} context={{ status: (selectedSnag as any).status }} />
              </div>

              <div style={{ margin: '1.25rem 0', display: 'flex', flexDirection: 'column', gap: '0.8rem', fontSize: '0.85rem' }}>
                <div style={{ background: 'var(--surface-hover)', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem', display: 'block', textTransform: 'uppercase' }}>Defect Description</span>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{selectedSnag.description}</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem' }}>
                  <div>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem', display: 'block', textTransform: 'uppercase' }}>System/Trade</span>
                    <span>{selectedSnag.system}</span>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem', display: 'block', textTransform: 'uppercase' }}>Location</span>
                    <span>{selectedSnag.location}</span>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem', display: 'block', textTransform: 'uppercase' }}>Source Intake</span>
                    <span>{selectedSnag.source.replace(/_/g, ' ')}</span>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem', display: 'block', textTransform: 'uppercase' }}>Target Date</span>
                    <span className="text-warning">{selectedSnag.target_date ? new Date(selectedSnag.target_date).toLocaleDateString('en-GB') : 'N/A'}</span>
                  </div>
                </div>

                {selectedSnag.photo_paths?.length > 0 && (
                  <div>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem', display: 'block', textTransform: 'uppercase' }}>Defect Photos</span>
                    <div className="snag-thumbnail-grid">
                      {selectedSnag.photo_paths.map((path, idx) => {
                        const { data } = supabase.storage.from('documents').getPublicUrl(path);
                        return (
                          <a href={data.publicUrl} target="_blank" rel="noreferrer" key={idx}>
                            <img src={data.publicUrl} alt="defect" className="snag-thumbnail" />
                          </a>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Audit details */}
                {(selectedSnag.closed_by || selectedSnag.verified_by) && (
                  <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.8rem', marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.8rem' }}>
                    {selectedSnag.closed_by_name && (
                      <div>
                        <strong>Resolved By:</strong> {selectedSnag.closed_by_name}
                      </div>
                    )}
                    {selectedSnag.verified_by_name && (
                      <div>
                        <strong>Verified By:</strong> {selectedSnag.verified_by_name} (QC Audit Approved)
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Transition Control Panel */}
            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1.25rem', marginTop: 'auto' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '0.8rem', color: 'var(--text-primary)' }}>Audit Status Transition</h3>
              <form onSubmit={handleTransition} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <select 
                    value={transitionStatus} 
                    onChange={(e) => setTransitionStatus(e.target.value as SnagStatus)}
                    className="quote-input"
                    style={{ width: '100%' }}
                  >
                    <option value="OPEN">Keep Open</option>
                    <option value="IN_PROGRESS">Mark In Progress (Under rectification)</option>
                    <option value="READY_FOR_INSPECTION">Mark Ready for Inspection (Closes snag)</option>
                    <option value="CLOSED">Verify & Close (QC Auditor sign-off)</option>
                    <option value="DEFERRED_TO_DLP">Defer to DLP (Requires Client approval)</option>
                  </select>
                </div>

                {/* Verification alerts */}
                {transitionStatus === 'CLOSED' && selectedSnag.closed_by && (
                  <div style={{ padding: '0.5rem', background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.2)', borderRadius: '6px', fontSize: '0.75rem', color: 'var(--secondary)' }}>
                    <Info size={12} style={{ display: 'inline', marginRight: '0.2rem' }} /> Closer is <strong>{selectedSnag.closed_by_name || 'Technician'}</strong>. Segregation of duties will be validated.
                  </div>
                )}

                {/* Deferral justification field */}
                {transitionStatus === 'DEFERRED_TO_DLP' && (
                  <div>
                    <label className="quote-form-label">DLP Deferral Justification (Mandatory)</label>
                    <textarea 
                      placeholder="Add signed client agreement reference or justification..."
                      value={deferralJustification}
                      onChange={(e) => setDeferralJustification(e.target.value)}
                      className="quote-input"
                      style={{ width: '100%', height: '70px', resize: 'none' }}
                      required
                    />
                  </div>
                )}

                {/* Evidence Photo Upload */}
                {transitionStatus === 'READY_FOR_INSPECTION' && (
                  <div>
                    <label className="quote-form-label">Attach Rectification Photos</label>
                    <input 
                      type="file" 
                      accept="image/*" 
                      multiple 
                      onChange={(e) => {
                        if (e.target.files) {
                          setEvidencePhotos(Array.from(e.target.files));
                        }
                      }}
                      className="quote-input"
                      style={{ width: '100%' }}
                    />
                  </div>
                )}

                <button 
                  type="submit" 
                  className="quote-btn quote-btn-primary" 
                  style={{ width: '100%' }}
                  disabled={actionLoading}
                >
                  {actionLoading ? 'Updating...' : 'Save Audit Status'}
                </button>
              </form>
            </div>
          </div>
        </>
      )}

      {/* CREATE SNAG MODAL */}
      {isCreateModalOpen && (
        <div className="tc-modal-overlay">
          <div className="tc-modal-content">
            <h2 className="tc-modal-title">Log Defect / Snag</h2>
            <form onSubmit={handleCreateSnag} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
              <div>
                <label className="quote-form-label">Snag Description</label>
                <input 
                  type="text" 
                  placeholder="Describe the defect or installation issue..."
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="quote-input"
                  style={{ width: '100%' }}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label className="quote-form-label">Source Channel</label>
                  <select 
                    value={formSource} 
                    onChange={(e) => setFormSource(e.target.value as SnagSource)}
                    className="quote-input"
                    style={{ width: '100%' }}
                  >
                    <option value="INTERNAL_QA">Internal QA / Inspection</option>
                    <option value="WITNESS">Witness Test Fail</option>
                    <option value="CLIENT_WALKTHROUGH">Client Walkthrough</option>
                    <option value="CONSULTANT">Consultant Snag List</option>
                  </select>
                </div>
                <div>
                  <label className="quote-form-label">Severity Level</label>
                  <select 
                    value={formSeverity} 
                    onChange={(e) => setFormSeverity(e.target.value as SnagSeverity)}
                    className="quote-input"
                    style={{ width: '100%' }}
                  >
                    <option value="MINOR">Minor (No block, cosmetic)</option>
                    <option value="MAJOR">Major (Rectification needed before DLP)</option>
                    <option value="CRITICAL">Critical (Handover Blocker)</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label className="quote-form-label">ELV System / Trade</label>
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
                  <label className="quote-form-label">Location / Area</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Roof Plant room, Area A"
                    value={formLocation}
                    onChange={(e) => setFormLocation(e.target.value)}
                    className="quote-input"
                    style={{ width: '100%' }}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label className="quote-form-label">Assigned Technician / Engineer</label>
                  <select 
                    value={formAssignedTo} 
                    onChange={(e) => setFormAssignedTo(e.target.value)}
                    className="quote-input"
                    style={{ width: '100%' }}
                  >
                    <option value="">Select assignee...</option>
                    {engineers.map(eng => (
                      <option key={eng.id} value={eng.id}>{eng.full_name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="quote-form-label">Target Completion Date</label>
                  <input 
                    type="date" 
                    value={formTargetDate}
                    onChange={(e) => setFormTargetDate(e.target.value)}
                    className="quote-input"
                    style={{ width: '100%' }}
                  />
                </div>
              </div>

              <div>
                <label className="quote-form-label">Defect Photos</label>
                <input 
                  type="file" 
                  accept="image/*" 
                  multiple 
                  onChange={(e) => {
                    if (e.target.files) {
                      setFormPhotos(Array.from(e.target.files));
                    }
                  }}
                  className="quote-input"
                  style={{ width: '100%' }}
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
                  {actionLoading ? 'Logging...' : 'Register Snag'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
const SYSTEM_OPTIONS = [
  { value: 'CCTV', label: 'CCTV System' },
  { value: 'ACS', label: 'Access Control System (ACS)' },
  { value: 'GATE_BARRIER', label: 'Gate Barrier / ANPR' },
  { value: 'FIRE_ALARM', label: 'Fire Alarm Interface' },
  { value: 'STRUCTURED_CABLING', label: 'Structured Cabling' },
  { value: 'BMS', label: 'Building Management System (BMS)' },
  { value: 'MEP', label: 'General MEP / HVAC' }
];
