// ============================================================
// JEET ERP — Project Master Detail Hub
// Route: /projects/:id
// Renders the tabbed layout: Overview, Documents, Commercials, Milestones, Team, Compliance, Activity
// ============================================================

'use client';

import React, { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useProject } from '@/hooks/useProjects';
import { useDocuments } from '@/hooks/useDocuments';
import { useProjectActivity } from '@/hooks/useProjectActivity';
import { useProjectCommitments } from '@/hooks/useProjectCommitments';
import { ProjectStatusChip } from '@/components/projects/ProjectStatusChip';
import { ProjectStatusTransitionModal } from '@/components/projects/ProjectStatusTransitionModal';
import { MilestoneTimeline } from '@/components/projects/MilestoneTimeline';
import { ProjectContactsCard } from '@/components/projects/ProjectContactsCard';
import { DocumentUploadZone } from '@/components/documents/DocumentUploadZone';
import { DocumentTable } from '@/components/documents/DocumentTable';
import { DocumentDetailDrawer } from '@/components/documents/DocumentDetailDrawer';
import ProjectFinanceTab from '@/app/projects/tabs/ProjectFinanceTab';
import ProjectVOTab from '@/app/projects/tabs/ProjectVOTab';
import ProjectFileTab from '@/app/projects/tabs/ProjectFileTab';
import WorkflowPanel from '@/components/workflow/WorkflowPanel';
import ProjectDocumentRegister from '@/components/projects/ProjectDocumentRegister';
import ProjectBudgetCard from '@/components/finance/ProjectBudgetCard';

import { 
  ArrowLeft, 
  RefreshCw, 
  Settings, 
  ShieldAlert, 
  Briefcase, 
  FileText, 
  Calendar, 
  Users, 
  TrendingUp, 
  Activity, 
  FolderClosed,
  Layers, 
  Plus, 
  Trash2, 
  ArrowUp, 
  ArrowDown, 
  UserCheck,
  Eye
} from 'lucide-react';
import type { ProjectStatus, ProjectMilestone, ContactRole } from '@/types/project.types';

type Props = {
  params: Promise<{ id: string }>;
};

const fmtAED = (v: number) => {
  return 'AED ' + new Intl.NumberFormat('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
};

export default function ProjectDetailPage({ params }: Props) {
  const router = useRouter();
  const { id: projectId } = use(params);

  const { project, loading, error, refetch, actions } = useProject(projectId);
  const { activities, refetch: refetchActivity } = useProjectActivity(projectId);
  const { commitments, loading: commitmentsLoading } = useProjectCommitments(projectId);
  const [activeTab, setActiveTab] = useState('overview');

  // Modal control
  const [showTransitionModal, setShowTransitionModal] = useState(false);

  // Selected document drawer
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [isDocDrawerOpen, setIsDocDrawerOpen] = useState(false);

  // Document filters (when inside project page, restrict to current project entity)
  const [docFilters, setDocFilters] = useState<any>({
    entity_type: 'PROJECT',
    entity_id: projectId,
    category: '',
    subcategory: ''
  });

  const { documents, loading: docsLoading, refetch: refetchDocs } = useDocuments(docFilters);

  // Teams Edit States
  const [managers, setManagers] = useState<any[]>([]);
  const [engineers, setEngineers] = useState<any[]>([]);
  const [pmId, setPmId] = useState('');
  const [engId, setEngId] = useState('');
  const [updatingTeam, setUpdatingTeam] = useState(false);

  // Milestones CRUD edit States
  const [milestoneTitle, setMilestoneTitle] = useState('');
  const [milestonePaymentLinked, setMilestonePaymentLinked] = useState(false);
  const [milestonePaymentPct, setMilestonePaymentPct] = useState(0);
  const [addingMilestone, setAddingMilestone] = useState(false);

  // Fetch managers & site engineers profiles
  useEffect(() => {
    supabase.from('profiles').select('id, full_name, role').in('role', ['manager', 'admin']).then(({ data }) => {
      if (data) setManagers(data);
    });
    supabase.from('profiles').select('id, full_name, role').eq('role', 'engineer').then(({ data }) => {
      if (data) setEngineers(data);
    });
  }, []);

  // Sync edit states when project detail changes
  useEffect(() => {
    if (project) {
      setPmId(project.project_manager_id || '');
      setEngId(project.site_engineer_id || '');
    }
  }, [project]);

  if (loading) {
    return (
      <div className="quote-container" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div className="spinner"></div>
        <p style={{ marginTop: '1rem', color: 'var(--text-secondary)' }}>Loading project details...</p>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="quote-container">
        <div className="quote-card" style={{ borderColor: 'rgba(239, 68, 68, 0.3)', background: 'rgba(239, 68, 68, 0.08)', textAlign: 'center', padding: '3rem' }}>
          <ShieldAlert size={48} style={{ color: '#ef4444', margin: '0 auto 1rem auto' }} />
          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.5rem', marginBottom: '1rem' }}>Project Not Found</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>The project record could not be found or has been soft-deleted.</p>
          <Link href="/projects" className="quote-btn quote-btn-secondary">
            <ArrowLeft size={14} /> Back to Projects
          </Link>
        </div>
      </div>
    );
  }

  const handleUpdateTeam = async () => {
    try {
      setUpdatingTeam(true);
      await actions.updateProject({
        project_manager_id: pmId || null,
        site_engineer_id: engId || null
      });
      alert('Project team assignments updated successfully.');
    } catch (err: any) {
      alert('Failed to update team: ' + err.message);
    } finally {
      setUpdatingTeam(false);
    }
  };

  const handleAddMilestone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!milestoneTitle.trim()) return;

    try {
      setAddingMilestone(true);
      
      // Calculate next sort order
      const nextSort = (project.milestones?.length || 0) + 1;

      await actions.addMilestone({
        title: milestoneTitle,
        status: 'PENDING',
        payment_linked: milestonePaymentLinked,
        payment_pct: milestonePaymentLinked ? milestonePaymentPct : null,
        sort_order: nextSort
      });

      setMilestoneTitle('');
      setMilestonePaymentLinked(false);
      setMilestonePaymentPct(0);
    } catch (err: any) {
      alert('Failed to add milestone: ' + err.message);
    } finally {
      setAddingMilestone(false);
    }
  };

  const handleMoveMilestone = async (milestone: ProjectMilestone, direction: 'up' | 'down') => {
    const list = [...(project.milestones || [])].sort((a,b)=>a.sort_order - b.sort_order);
    const index = list.findIndex(m => m.id === milestone.id);
    if (index === -1) return;

    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= list.length) return;

    const temp = list[index].sort_order;
    list[index].sort_order = list[swapIndex].sort_order;
    list[swapIndex].sort_order = temp;

    try {
      await actions.reorderMilestones(list.map(m => ({ id: m.id, sort_order: m.sort_order })));
    } catch (err: any) {
      alert('Reorder failed: ' + err.message);
    }
  };

  const handleToggleMilestoneDone = async (m: ProjectMilestone) => {
    const nextStatus = m.status === 'DONE' ? 'PENDING' : 'DONE';
    const updates: Partial<ProjectMilestone> = { status: nextStatus };
    if (nextStatus === 'DONE') {
      updates.actual_date = new Date().toISOString().split('T')[0];
    } else {
      updates.actual_date = undefined;
    }
    
    try {
      await actions.updateMilestone(m.id, updates);
    } catch (err: any) {
      alert('Failed to update milestone: ' + err.message);
    }
  };

  const selectDoc = (doc: any) => {
    setSelectedDocId(doc.id);
    setIsDocDrawerOpen(true);
  };

  return (
    <div className="quote-container">
      {/* Top Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem' }}>
        <Link href="/projects" className="quote-btn quote-btn-secondary" style={{ padding: '0.4rem 0.6rem', textDecoration: 'none' }}>
          <ArrowLeft size={16} /> Back to Projects Registry
        </Link>
        <div style={{ display: 'flex', gap: '0.6rem' }}>
          <button className="quote-btn quote-btn-secondary" onClick={() => { refetch(); refetchDocs(); refetchActivity(); }}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {/* Main header banner */}
      <div className="quote-card" style={{ padding: '1.6rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1.5rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '1.1rem', fontFamily: 'var(--font-mono)', color: 'var(--secondary)', fontWeight: 700 }}>
                {project.project_number}
              </span>
              <ProjectStatusChip status={project.status} />
              {project.sira_applicable && (
                <span style={{ fontSize: '0.68rem', background: 'rgba(0, 229, 160, 0.1)', color: 'var(--accent)', border: '1px solid rgba(0, 229, 160, 0.3)', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>
                  SIRA COMPLIANT
                </span>
              )}
            </div>
            <h1 className="quote-header-title" style={{ fontSize: '1.8rem', marginTop: '0.5rem', WebkitTextFillColor: 'unset', background: 'none', color: '#ffffff' }}>
              {project.name}
            </h1>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.4rem' }}>
              Client Partner: <strong style={{ color: '#ffffff' }}>{project.client_name}</strong> • Location: {project.emirate}
            </div>
          </div>

          <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
            {project.vo_count && project.vo_count > 0 ? (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Original: {fmtAED(project.original_contract_value ?? project.contract_value)}</span>
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>VOs ({project.vo_count}): +{fmtAED(project.vo_total_sell ?? 0)}</span>
                </div>
                <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--accent)', fontFamily: 'var(--font-heading)', lineHeight: 1 }}>
                  {fmtAED(project.revised_contract_value ?? project.contract_value)}
                </div>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  Revised End Date: {project.revised_end_date ? new Date(project.revised_end_date).toLocaleDateString('en-GB') : project.planned_end_date ? new Date(project.planned_end_date).toLocaleDateString('en-GB') : 'N/A'}
                </span>
              </>
            ) : (
              <>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Contract Value</span>
                <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--accent)', fontFamily: 'var(--font-heading)' }}>
                  {fmtAED(project.contract_value)}
                </div>
                {project.planned_end_date && (
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    Target Completion: {new Date(project.planned_end_date).toLocaleDateString('en-GB')}
                  </span>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Tabs Row */}
      <div className="quote-tabs">
        <button className={`quote-tab ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>Overview</button>
        <button className={`quote-tab ${activeTab === 'documents' ? 'active' : ''}`} onClick={() => setActiveTab('documents')}>Documents ({documents.length})</button>
        <button className={`quote-tab ${activeTab === 'register' ? 'active' : ''}`} onClick={() => setActiveTab('register')}>Document Register</button>
        <button className={`quote-tab ${activeTab === 'project-file' ? 'active' : ''}`} onClick={() => setActiveTab('project-file')}>Project File</button>
        <button className={`quote-tab ${activeTab === 'finance' ? 'active' : ''}`} onClick={() => setActiveTab('finance')}>Finance details</button>
        <button className={`quote-tab ${activeTab === 'variations' ? 'active' : ''}`} onClick={() => setActiveTab('variations')}>Variations ({project.vo_count || 0})</button>
        <button className={`quote-tab ${activeTab === 'milestones' ? 'active' : ''}`} onClick={() => setActiveTab('milestones')}>Milestones CRUD</button>
        <button className={`quote-tab ${activeTab === 'team' ? 'active' : ''}`} onClick={() => setActiveTab('team')}>Team Assignments</button>
        <button className={`quote-tab ${activeTab === 'compliance' ? 'active' : ''}`} onClick={() => setActiveTab('compliance')}>Compliance NOCs</button>
        <button className={`quote-tab ${activeTab === 'activity' ? 'active' : ''}`} onClick={() => setActiveTab('activity')}>Activity stream</button>
      </div>

      {/* TAB CONTENT: OVERVIEW */}
      {activeTab === 'overview' && (
        <>
        {/* Configurable workflow (Admin Center → Workflows) */}
        <WorkflowPanel
          moduleKey="PRJ"
          entityId={projectId}
          context={{ status: project.status }}
          onStatusChange={() => refetch()}
          className="mb-6"
        />

        {/* Budget status (read-only; renders only when a budget exists + the
            guard migration 20260616221000 is applied). Additive. */}
        <div style={{ marginBottom: '1.5rem' }}>
          <ProjectBudgetCard projectId={projectId} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem', alignItems: 'start' }}>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Visual Milestones timeline */}
            <div className="quote-card" style={{ margin: 0 }}>
              <h3 className="quote-card-title"><TrendingUp size={16} /> Progress Milestone Timeline</h3>
              <MilestoneTimeline milestones={project.milestones || []} />
            </div>

            {/* Financial Detail Breakdown */}
            <div className="quote-card" style={{ margin: 0 }}>
              <h3 className="quote-card-title"><Briefcase size={16} /> Commercial Details</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.2rem', marginTop: '1rem', fontSize: '0.85rem' }}>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Advance Payment:</span>
                  <p style={{ fontWeight: 600, color: '#ffffff', marginTop: '0.2rem' }}>{project.advance_pct}%</p>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Retention Percent:</span>
                  <p style={{ fontWeight: 600, color: '#ffffff', marginTop: '0.2rem' }}>{project.retention_pct}%</p>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>LPO / PO Reference:</span>
                  <p style={{ fontWeight: 600, color: '#ffffff', marginTop: '0.2rem' }}>{project.client_lpo_number || 'N/A'}</p>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Defects Liability Period (DLP):</span>
                  <p style={{ fontWeight: 600, color: '#ffffff', marginTop: '0.2rem' }}>{project.dlp_months} months</p>
                </div>
                {project.dlp_start_date && (
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>DLP Duration:</span>
                    <p style={{ fontWeight: 500, color: 'var(--warning)', marginTop: '0.2rem' }}>
                      {new Date(project.dlp_start_date).toLocaleDateString('en-GB')} to {project.dlp_end_date ? new Date(project.dlp_end_date).toLocaleDateString('en-GB') : 'N/A'}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* External contacts */}
            <ProjectContactsCard 
              contacts={project.contacts || []}
              onAdd={actions.addContact}
              onDelete={actions.deleteContact}
            />
          </div>

          {/* Sidebar transitions and assignments info */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div className="quote-card" style={{ margin: 0, borderColor: 'var(--primary)', background: 'rgba(0, 229, 160, 0.02)' }}>
              <h3 className="quote-card-title" style={{ color: 'var(--primary)' }}><Settings size={16} /> Workflow State Controls</h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '0.5rem 0 1rem 0' }}>
                Transition this project along its legal engineering lifecycle. Handover calculates DLP.
              </p>
              <button 
                type="button" 
                className="quote-btn quote-btn-primary" 
                style={{ width: '100%' }}
                onClick={() => setShowTransitionModal(true)}
              >
                Change Project Status
              </button>
            </div>

            <div className="quote-card" style={{ margin: 0 }}>
              <h3 className="quote-card-title"><Users size={16} /> Internal Project Team</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem', fontSize: '0.85rem' }}>
                <div>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem', textTransform: 'uppercase' }}>Project PM</span>
                  <p style={{ fontWeight: 600, color: '#ffffff', marginTop: '0.2rem' }}>{project.project_manager?.full_name || 'Unassigned'}</p>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{project.project_manager?.email}</p>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem', textTransform: 'uppercase' }}>Site Engineer</span>
                  <p style={{ fontWeight: 600, color: '#ffffff', marginTop: '0.2rem' }}>{project.site_engineer?.full_name || 'Unassigned'}</p>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{project.site_engineer?.email}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
        </>
      )}

      {/* TAB CONTENT: DOCUMENTS */}
      {activeTab === 'documents' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="quote-card" style={{ margin: 0 }}>
            <h3 className="quote-card-title"><FolderClosed size={16} /> Project Document Filing</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
              Upload contracts, LPOs, drawings, or inspection certificates here. AI will classify them and extract expiration dates.
            </p>
            <DocumentUploadZone 
              entityType="PROJECT"
              entityId={projectId}
              onUploadComplete={refetchDocs}
            />
          </div>

          <div className="quote-card" style={{ margin: 0 }}>
            <h3 className="quote-card-title"><FolderClosed size={16} /> Filed Documents ({documents.length})</h3>
            <DocumentTable 
              documents={documents}
              onSelect={selectDoc}
              onDelete={async (id) => {
                await supabase.from('documents').update({ is_active: false }).eq('id', id);
                refetchDocs();
              }}
            />
          </div>
        </div>
      )}

      {/* TAB CONTENT: DOCUMENT REGISTER (full linked lifecycle) */}
      {activeTab === 'register' && (
        <div className="quote-card" style={{ margin: 0 }}>
          <h3 className="quote-card-title" style={{ marginBottom: '0.4rem' }}><Layers size={16} /> Linked Document Register</h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
            Every document connected to this project — tender, BOQ, quotation, comparisons, LPOs, goods receipts, invoices and filed attachments — traced to the project id, each with its reference and a review link.
          </p>
          <ProjectDocumentRegister
            project={{
              id: project.id,
              project_number: project.project_number,
              tender_id: project.tender_id,
              boq_id: project.boq_id,
              quotation_id: project.quotation_id,
            }}
          />
        </div>
      )}

      {/* TAB CONTENT: PROJECT FILE */}
      {activeTab === 'project-file' && (
        <div className="quote-card">
          <ProjectFileTab 
            projectId={projectId} 
            projectNumber={project.project_number}
            tenderId={project.tender_id}
            boqId={project.boq_id}
          />
        </div>
      )}

      {/* TAB CONTENT: MILESTONES CRUD */}
      {activeTab === 'milestones' && (
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.2fr', gap: '1.5rem', alignItems: 'start' }}>
          {/* Milestones list with ordering & toggle buttons */}
          <div className="quote-card" style={{ margin: 0 }}>
            <h3 className="quote-card-title"><Calendar size={16} /> Progress Milestones</h3>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '1.2rem' }}>
              Check the checkbox to complete a milestone. Complete milestones calculate progress. Use arrows to adjust execution order.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {(project.milestones || []).map((m, idx) => (
                <div 
                  key={m.id} 
                  style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center', 
                    padding: '0.8rem', 
                    background: m.status === 'DONE' ? 'rgba(0, 229, 160, 0.02)' : 'var(--surface-hover)', 
                    border: '1px solid',
                    borderColor: m.status === 'DONE' ? 'rgba(0, 229, 160, 0.15)' : 'var(--surface-hover)',
                    borderRadius: '8px' 
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                    <input 
                      type="checkbox" 
                      checked={m.status === 'DONE'}
                      onChange={() => handleToggleMilestoneDone(m)}
                      style={{ width: '16px', height: '16px', accentColor: 'var(--primary)', cursor: 'pointer' }}
                    />
                    <div>
                      <div style={{ fontWeight: 600, color: m.status === 'DONE' ? '#ffffff' : 'var(--text-secondary)', fontSize: '0.85rem' }}>
                        {m.title}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>
                        Order: {m.sort_order} {m.payment_linked ? `• Progress payment: ${m.payment_pct}%` : ''} 
                        {m.actual_date && ` • Finished: ${new Date(m.actual_date).toLocaleDateString('en-GB')}`}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '0.3rem' }}>
                    <button 
                      type="button" 
                      className="quote-btn quote-btn-secondary" 
                      style={{ padding: '0.3rem' }} 
                      disabled={idx === 0}
                      onClick={() => handleMoveMilestone(m, 'up')}
                    >
                      <ArrowUp size={12} />
                    </button>
                    <button 
                      type="button" 
                      className="quote-btn quote-btn-secondary" 
                      style={{ padding: '0.3rem' }} 
                      disabled={idx === (project.milestones?.length || 1) - 1}
                      onClick={() => handleMoveMilestone(m, 'down')}
                    >
                      <ArrowDown size={12} />
                    </button>
                    <button 
                      type="button" 
                      className="quote-btn quote-btn-danger" 
                      style={{ padding: '0.3rem' }}
                      onClick={() => {
                        if (window.confirm('Delete this milestone?')) {
                          actions.deleteMilestone(m.id);
                        }
                      }}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Add milestone form */}
          <div className="quote-card" style={{ margin: 0 }}>
            <h3 className="quote-card-title"><Plus size={16} /> Add Stage Milestone</h3>
            <form onSubmit={handleAddMilestone} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
              <div className="quote-form-group">
                <label>Milestone Title</label>
                <input 
                  type="text" 
                  value={milestoneTitle} 
                  onChange={(e) => setMilestoneTitle(e.target.value)} 
                  className="quote-form-input" 
                  placeholder="e.g. First Fix Inspection"
                  required 
                />
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', cursor: 'pointer', color: 'var(--text-primary)' }}>
                <input 
                  type="checkbox" 
                  checked={milestonePaymentLinked} 
                  onChange={(e) => setMilestonePaymentLinked(e.target.checked)} 
                  style={{ accentColor: 'var(--primary)' }}
                />
                Triggers progress billing invoice
              </label>

              {milestonePaymentLinked && (
                <div className="quote-form-group">
                  <label>Payment Weight (%)</label>
                  <input 
                    type="number" 
                    value={milestonePaymentPct} 
                    onChange={(e) => setMilestonePaymentPct(Math.min(100, Math.max(0, Number(e.target.value))))} 
                    className="quote-form-input" 
                    placeholder="25%" 
                    min={0}
                    max={100}
                    required
                  />
                </div>
              )}

              <button type="submit" className="quote-btn quote-btn-primary" disabled={addingMilestone} style={{ marginTop: '0.5rem' }}>
                {addingMilestone ? 'Saving...' : 'Add Milestone'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* TAB CONTENT: TEAM ASSIGNMENTS */}
      {activeTab === 'team' && (
        <div className="quote-card">
          <h3 className="quote-card-title"><Users size={16} /> Project Team Assignments</h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
            Adjust the internal management team allocated to execute this contract.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem', maxWidth: '500px' }}>
            <div className="quote-form-group">
              <label>Project Manager (PM)</label>
              <select 
                value={pmId} 
                onChange={(e) => setPmId(e.target.value)} 
                className="quote-filter-input"
              >
                <option value="">-- PM Unassigned --</option>
                {managers.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
              </select>
            </div>

            <div className="quote-form-group">
              <label>Site Lead Engineer</label>
              <select 
                value={engId} 
                onChange={(e) => setEngId(e.target.value)} 
                className="quote-filter-input"
              >
                <option value="">-- Engineer Unassigned --</option>
                {engineers.map(e => <option key={e.id} value={e.id}>{e.full_name}</option>)}
              </select>
            </div>

            <button 
              type="button" 
              className="quote-btn quote-btn-primary" 
              onClick={handleUpdateTeam}
              disabled={updatingTeam}
              style={{ alignSelf: 'flex-start', marginTop: '0.5rem' }}
            >
              {updatingTeam ? 'Updating...' : 'Save Assignments'}
            </button>
          </div>
        </div>
      )}

      {/* TAB CONTENT: COMPLIANCE */}
      {activeTab === 'compliance' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="quote-card" style={{ margin: 0 }}>
            <h3 className="quote-card-title"><UserCheck size={16} /> SIRA / Regulatory Approvals</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1.2rem' }}>
              Regulatory inspection documents related to security system compliance (CCTV, Gate Barriers, Access Control).
            </p>

            {/* Filtered compliance list */}
            {documents.filter(d => ['SIRA_CERTIFICATE', 'SIRA_EGUARD', 'DCD_NOC'].includes(d.subcategory)).length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                No regulatory compliance documents filed. Upload them in the Documents tab under COMPLIANCE folder.
              </div>
            ) : (
              <div className="quote-table-wrap">
                <table className="quote-table">
                  <thead>
                    <tr>
                      <th>Document</th>
                      <th>Subcategory</th>
                      <th>Expiry Date</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {documents.filter(d => ['SIRA_CERTIFICATE', 'SIRA_EGUARD', 'DCD_NOC'].includes(d.subcategory)).map((doc) => (
                      <tr key={doc.id}>
                        <td style={{ fontWeight: 600 }}>{doc.title}</td>
                        <td style={{ fontSize: '0.78rem' }}>{doc.subcategory.replace('_', ' ')}</td>
                        <td style={{ color: doc.expiry_date && new Date(doc.expiry_date) < new Date() ? '#ef4444' : 'var(--text-primary)' }}>
                          {doc.expiry_date ? new Date(doc.expiry_date).toLocaleDateString('en-GB') : '—'}
                        </td>
                        <td>
                          <button type="button" className="quote-btn quote-btn-secondary" style={{ padding: '0.3rem 0.5rem' }} onClick={() => selectDoc(doc)}>
                            <Eye size={12} /> Detail
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB CONTENT: ACTIVITY STREAM */}
      {activeTab === 'activity' && (
        <div className="quote-card">
          <h3 className="quote-card-title"><Activity size={16} /> Realtime Status Activity Stream</h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
            System audit trail tracking all legal status transitions and engineer sign-offs.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
            {activities.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', textAlign: 'center' }}>No status changes recorded.</p>
            ) : (
              activities.map((act) => (
                <div 
                  key={act.id} 
                  style={{ 
                    borderLeft: '2px solid var(--secondary)', 
                    paddingLeft: '1rem', 
                    paddingBottom: '0.5rem', 
                    fontSize: '0.82rem' 
                  }}
                >
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <strong style={{ color: '#ffffff' }}>{act.from_status} &rarr; {act.to_status}</strong>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      • Changed by {act.changed_by_name}
                    </span>
                  </div>
                  {act.comment && (
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.2rem', fontStyle: 'italic' }}>
                      "{act.comment}"
                    </p>
                  )}
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                    {new Date(act.changed_at).toLocaleString('en-GB')}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB CONTENT: FINANCE DETAILS */}
      {activeTab === 'finance' && (
        <div className="quote-card">
          <ProjectFinanceTab projectId={projectId} />
        </div>
      )}

      {/* TAB CONTENT: VARIATIONS */}
      {activeTab === 'variations' && (
        <div className="quote-card">
          <ProjectVOTab projectId={projectId} />
        </div>
      )}

      {/* Transition Modal */}
      <ProjectStatusTransitionModal 
        project={project}
        isOpen={showTransitionModal}
        onClose={() => setShowTransitionModal(false)}
        onTransition={async (status, comment) => {
          await actions.transitionStatus(status, comment);
        }}
      />

      {/* Document Drawer */}
      <DocumentDetailDrawer 
        documentId={selectedDocId}
        isOpen={isDocDrawerOpen}
        onClose={() => { setSelectedDocId(null); setIsDocDrawerOpen(false); }}
        onUpdate={refetchDocs}
      />

    </div>
  );
}
