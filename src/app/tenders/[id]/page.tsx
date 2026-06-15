'use client';

import React, { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { 
  Briefcase, 
  Calendar, 
  MapPin, 
  User, 
  DollarSign, 
  Edit, 
  ArrowLeft, 
  Clock, 
  AlertCircle, 
  Download, 
  FileText, 
  Layers,
  Settings,
  Lock,
  Unlock,
  AlertTriangle,
  History,
  ShieldCheck,
  CheckCircle2
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { tenderPDFService } from '@/lib/tender-pdf';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { StatusChip } from '@/components/ui/StatusChip';
import WorkflowPanel from '@/components/workflow/WorkflowPanel';

type StatusLog = {
  status: string;
  updated_at: string;
  updated_by: string;
  note: string;
};

type Tender = {
  id: string;
  title: string;
  project_name: string;
  client_name: string;
  location: string;
  deadline_date: string;
  budget: number | null;
  status: 'Draft' | 'Submitted' | 'Under Review' | 'Approved' | 'Rejected' | 'Completed';
  scope_of_work: string;
  
  tech_discipline: string | null;
  tech_equipment_list: string | null;
  tech_standards: string | null;
  tech_notes: string | null;
  
  client_special_requests: string | null;
  client_compliance: string | null;
  client_delivery_expectations: string | null;
  client_warranty: string | null;
  
  status_history: StatusLog[];
  created_at: string;
  updated_at: string;
};

type TenderDocument = {
  id: string;
  file_name: string;
  file_path: string;
  file_size: number;
  file_type: string;
  uploaded_at: string;
};

export default function TenderDetail({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const resolvedParams = use(params);
  const tenderId = resolvedParams.id;

  const [loading, setLoading] = useState(true);
  const [tender, setTender] = useState<Tender | null>(null);
  const [documents, setDocuments] = useState<TenderDocument[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  // Status transition states
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [statusNote, setStatusNote] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<Tender['status']>('Draft');
  const [boq, setBoq] = useState<{ id: string; status: string; total?: number } | null>(null);
  const [linkedProject, setLinkedProject] = useState<{ id: string; number: string | null } | null>(null);

  useEffect(() => {
    const fetchTenderDetails = async () => {
      setLoading(true);
      setErrorMsg(null);

      try {
        // 1. Verify User Session
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
          router.replace('/signin');
          return;
        }

        // 2. Fetch Tender row
        const { data: tenderData, error: tenderError } = await supabase
          .from('tenders')
          .select('*')
          .eq('id', tenderId)
          .single();

        if (tenderError) {
          throw tenderError;
        }

        setTender(tenderData as Tender);
        setSelectedStatus(tenderData.status);

        // 3. Fetch linked documents
        const { data: docData, error: docError } = await supabase
          .from('tender_documents')
          .select('id, file_name, file_path, file_size, file_type, uploaded_at')
          .eq('tender_id', tenderId);

        if (docError) {
          console.warn('Could not load documents:', docError);
        } else {
          setDocuments(docData as TenderDocument[] || []);
        }

        // 4. Fetch linked BOQ (latest version) with total selling price
        const { data: boqData, error: boqError } = await supabase
          .from('boqs')
          .select('id, status, version, financials')
          .eq('tender_id', tenderId)
          .order('version', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (boqError) {
          console.warn('Could not load BOQ:', boqError);
        } else if (boqData) {
          setBoq({
            id: boqData.id,
            status: boqData.status,
            total: Number((boqData as any).financials?.total_selling_price) || 0,
          });
        }

        // 5. Fetch project created from this tender (if quotation accepted)
        const { data: projectData } = await supabase
          .from('projects')
          .select('id, project_number')
          .eq('tender_id', tenderId)
          .limit(1)
          .maybeSingle();

        if (projectData) {
          setLinkedProject({ id: projectData.id, number: (projectData as any).project_number || null });
        }

      } catch (err: any) {
        console.error('Error fetching tender details:', err);
        setErrorMsg(err.message || 'Failed to retrieve tender data.');
      } finally {
        setLoading(false);
      }
    };

    fetchTenderDetails();
  }, [tenderId, router]);

  // Handle status updates
  const handleStatusChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tender) return;
    setIsUpdatingStatus(true);

    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new Error('User session expired. Please sign in.');
      }

      // Add a history item
      const newHistoryLog: StatusLog = {
        status: selectedStatus,
        updated_at: new Date().toISOString(),
        updated_by: user.email || 'ERP Staff',
        note: statusNote.trim() || `Status updated to ${selectedStatus}.`
      };

      const updatedHistory = [newHistoryLog, ...(tender.status_history || [])];

      // Save status transition
      const { error: updateError } = await supabase
        .from('tenders')
        .update({
          status: selectedStatus,
          status_history: updatedHistory,
          updated_at: new Date().toISOString()
        })
        .eq('id', tender.id);

      if (updateError) {
        throw updateError;
      }

      // Refresh page state local values
      setTender({
        ...tender,
        status: selectedStatus,
        status_history: updatedHistory,
        updated_at: new Date().toISOString()
      });
      
      setStatusNote('');
      alert(`Status updated successfully to ${selectedStatus}!`);
    } catch (err: any) {
      console.error('Failed updating status:', err);
      alert(`Error updating status: ${err.message}`);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const formatBudget = (budget: number | null) => {
    if (budget === null || budget === undefined) return 'Unspecified';
    return new Intl.NumberFormat('en-AE', { maximumFractionDigits: 0 }).format(budget) + ' AED';
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const renderScopeOfWork = (scopeText: string) => {
    if (!scopeText) return <p className="text-text-muted text-xs italic">No scope details provided.</p>;
    
    const lines = scopeText.split('\n');
    const hasBullets = lines.some(l => l.trim().startsWith('-') || l.trim().startsWith('•') || l.trim().startsWith('*'));

    if (!hasBullets) {
      return <div className="text-xs text-text-secondary leading-relaxed whitespace-pre-wrap">{scopeText}</div>;
    }

    return (
      <div className="flex flex-col gap-2">
        {lines.map((line, index) => {
          const trimmed = line.trim();
          if (trimmed.startsWith('-') || trimmed.startsWith('•') || trimmed.startsWith('*')) {
            const cleanText = trimmed.substring(1).trim();
            return (
              <ul key={index} className="list-disc list-inside pl-2 text-xs text-text-secondary">
                <li className="leading-relaxed">{cleanText}</li>
              </ul>
            );
          }
          return trimmed ? <p key={index} className="text-xs text-text-secondary leading-relaxed mt-1">{line}</p> : null;
        })}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-dark)] flex flex-col items-center justify-center text-center p-6">
        <div className="h-10 w-10 border-2 border-[var(--accent)] border-t-transparent animate-spin rounded-full mb-3"></div>
        <h2 className="text-sm font-bold font-mono text-[var(--text-secondary)] uppercase tracking-widest">Retrieving Tender Profile...</h2>
      </div>
    );
  }

  if (errorMsg || !tender) {
    return (
      <div className="flex flex-col gap-6">
        <div className="border-b border-[var(--border)] pb-4">
          <Link href="/tenders" className="inline-flex items-center gap-1.5 text-xs text-text-secondary hover:text-text-primary transition-colors mb-2 font-semibold">
            <ArrowLeft size={14} /> Back to Tenders Registry
          </Link>
        </div>
        <div className="flex gap-3 bg-[var(--status-danger-bg)] border border-[var(--status-danger-border)] rounded-lg p-4 text-[var(--status-danger-text)] text-xs items-start max-w-xl mx-auto mt-8">
          <AlertCircle className="flex-shrink-0 text-[var(--status-danger-text)] mt-0.5" size={18} />
          <div>
            <strong>Failed to Load Tender details</strong>
            <p className="mt-1 leading-relaxed">{errorMsg || 'Tender record not found or access permissions invalid.'}</p>
          </div>
        </div>
      </div>
    );
  }

  const breadcrumbs = [
    { label: 'COE Cockpit', href: '/dashboard' },
    { label: 'Tenders Registry', href: '/tenders' },
    { label: tender.title.length > 25 ? `${tender.title.substring(0, 25)}...` : tender.title }
  ];

  const handleExportPDF = () => {
    tenderPDFService.download(tender, {
      boqStatus: boq?.status,
      boqTotal: boq?.total,
      projectNumber: linkedProject?.number || (linkedProject ? `PRJ-${linkedProject.id.slice(0, 8).toUpperCase()}` : null),
      documents,
    });
  };

  const headerActions = (
    <div className="flex items-center gap-2">
      <Button
        variant="secondary"
        size="sm"
        onClick={handleExportPDF}
        className="flex items-center gap-1.5 font-bold uppercase tracking-wider"
      >
        <Download size={14} /> Export PDF
      </Button>
      <Link href={`/tenders/${tender.id}/edit`} className="no-underline">
        <Button variant="primary" size="sm" className="flex items-center gap-1.5 font-bold uppercase tracking-wider">
          <Edit size={14} /> Edit Tender
        </Button>
      </Link>
    </div>
  );

  return (
    <div className="flex flex-col gap-6">
      {/* Page Header */}
      <PageHeader 
        title={tender.title} 
        referenceId={`TND-${tender.id.substring(0, 8).toUpperCase()}`}
        status={tender.status}
        breadcrumbs={breadcrumbs}
        actions={headerActions}
      />

      {/* Responsive Grid layout */}
      {/* Configurable workflow (Admin Center → Workflows) */}
      <WorkflowPanel
        moduleKey="TND"
        entityId={tenderId}
        context={{ status: tender.status, budget: Number(tender.budget) || 0 }}
        className="mb-6"
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Columns - Details */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          
          {/* Project Info card */}
          <Card className="flex flex-col gap-4" borderAccent="none">
            <h3 className="font-heading font-bold text-sm text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-2 border-b border-[var(--border)] pb-2.5">
              <Layers className="text-secondary shrink-0" size={16} />
              Project Parameters
            </h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1 bg-bg-dark/30 p-3 rounded-lg border border-border-color/30">
                <span className="text-[10px] text-text-muted font-bold uppercase tracking-wider">Project Scope Title</span>
                <span className="text-xs font-semibold text-text-primary">{tender.project_name}</span>
              </div>
              <div className="flex flex-col gap-1 bg-bg-dark/30 p-3 rounded-lg border border-border-color/30">
                <span className="text-[10px] text-text-muted font-bold uppercase tracking-wider">Client Authority</span>
                <span className="text-xs font-semibold text-text-primary">{tender.client_name}</span>
              </div>
              <div className="flex flex-col gap-1 bg-bg-dark/30 p-3 rounded-lg border border-border-color/30">
                <span className="text-[10px] text-text-muted font-bold uppercase tracking-wider">Project Location</span>
                <span className="text-xs font-semibold text-text-primary inline-flex items-center gap-1">
                  <MapPin size={12} className="text-text-muted shrink-0" />
                  {tender.location}
                </span>
              </div>
              <div className="flex flex-col gap-1 bg-bg-dark/30 p-3 rounded-lg border border-border-color/30">
                <span className="text-[10px] text-text-muted font-bold uppercase tracking-wider">
                  {boq && (boq.total || 0) > 0 ? 'Budget Sum (from BOQ)' : 'Approved Budget Sum'}
                </span>
                <span className="text-xs font-bold text-success font-mono" title={boq && (boq.total || 0) > 0 ? 'Auto-filled from the latest BOQ total selling price' : 'Manually entered budget'}>
                  {boq && (boq.total || 0) > 0 ? formatBudget(boq.total!) : formatBudget(tender.budget)}
                </span>
                {boq && (
                  <Link href={`/tenders/${tenderId}/boq`} className="text-[10px] font-mono text-primary hover:underline no-underline mt-0.5">
                    BOQ: {boq.status.replace(/_/g, ' ').toUpperCase()}
                  </Link>
                )}
              </div>
              {linkedProject && (
                <div className="flex flex-col gap-1 bg-bg-dark/30 p-3 rounded-lg border border-border-color/30">
                  <span className="text-[10px] text-text-muted font-bold uppercase tracking-wider">Awarded Project</span>
                  <Link
                    href={`/projects/${linkedProject.id}`}
                    className="text-xs font-bold text-primary font-mono hover:underline no-underline"
                    title="Project created from the accepted quotation"
                  >
                    {linkedProject.number || `PRJ-${linkedProject.id.slice(0, 8).toUpperCase()}`}
                  </Link>
                </div>
              )}
            </div>
          </Card>

          {/* Scope of work card */}
          <Card className="flex flex-col gap-4" borderAccent="none">
            <h3 className="font-heading font-bold text-sm text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-2 border-b border-[var(--border)] pb-2.5">
              <FileText className="text-accent shrink-0" size={16} />
              Scope of Work Summary
            </h3>
            <div className="bg-bg-dark/50 p-4 rounded-xl border border-border-color/50">
              {renderScopeOfWork(tender.scope_of_work)}
            </div>
          </Card>

          {/* Technical Specs card */}
          <Card className="flex flex-col gap-4" borderAccent="none">
            <h3 className="font-heading font-bold text-sm text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-2 border-b border-[var(--border)] pb-2.5">
              <Settings className="text-primary shrink-0" size={16} />
              Technical Specifications & Compliance
            </h3>
            
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1 bg-bg-dark/30 p-3 rounded-lg border border-border-color/30">
                  <span className="text-[10px] text-text-muted font-bold uppercase tracking-wider">Engineering Discipline</span>
                  <span className="text-xs font-semibold text-text-primary">{tender.tech_discipline || 'Unspecified'}</span>
                </div>
                <div className="flex flex-col gap-1 bg-bg-dark/30 p-3 rounded-lg border border-border-color/30">
                  <span className="text-[10px] text-text-muted font-bold uppercase tracking-wider">Applicable Design Standards</span>
                  <span className="text-xs font-semibold text-text-primary">{tender.tech_standards || 'Unspecified'}</span>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <span className="text-[10px] text-text-muted font-bold uppercase tracking-wider">Required Machinery / Components</span>
                <div className="bg-bg-dark/30 p-3 rounded-lg border border-border-color/30 text-xs text-text-secondary whitespace-pre-wrap leading-relaxed">
                  {tender.tech_equipment_list || 'No required items specified.'}
                </div>
              </div>

              {tender.tech_notes && (
                <div className="flex flex-col gap-2">
                  <span className="text-[10px] text-text-muted font-bold uppercase tracking-wider">Technical Engineering Notes</span>
                  <div className="bg-bg-dark/30 p-3 rounded-lg border border-border-color/30 text-xs text-text-secondary whitespace-pre-wrap leading-relaxed">
                    {tender.tech_notes}
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* Client requisitions */}
          <Card className="flex flex-col gap-4" borderAccent="none">
            <h3 className="font-heading font-bold text-sm text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-2 border-b border-[var(--border)] pb-2.5">
              <User className="text-secondary shrink-0" size={16} />
              Client Specific Mandates
            </h3>
            
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1 bg-bg-dark/30 p-3 rounded-lg border border-border-color/30">
                  <span className="text-[10px] text-text-muted font-bold uppercase tracking-wider">Compliance Framework</span>
                  <span className="text-xs font-semibold text-text-primary">{tender.client_compliance || 'Standard SLA Guidelines'}</span>
                </div>
                <div className="flex flex-col gap-1 bg-bg-dark/30 p-3 rounded-lg border border-border-color/30">
                  <span className="text-[10px] text-text-muted font-bold uppercase tracking-wider">Warranty Requisites</span>
                  <span className="text-xs font-semibold text-text-primary">{tender.client_warranty || '12 Months SLA'}</span>
                </div>
              </div>

              {tender.client_delivery_expectations && (
                <div className="flex flex-col gap-2">
                  <span className="text-[10px] text-text-muted font-bold uppercase tracking-wider">Deployment & Execution Timelines</span>
                  <div className="bg-bg-dark/30 p-3 rounded-lg border border-border-color/30 text-xs text-text-secondary leading-relaxed">
                    {tender.client_delivery_expectations}
                  </div>
                </div>
              )}

              {tender.client_special_requests && (
                <div className="flex flex-col gap-2">
                  <span className="text-[10px] text-text-muted font-bold uppercase tracking-wider">Special Tender Requests</span>
                  <div className="bg-bg-dark/30 p-3 rounded-lg border border-border-color/30 text-xs text-text-secondary leading-relaxed">
                    {tender.client_special_requests}
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Right Columns - Metadata, Action, Logs */}
        <div className="flex flex-col gap-6">
          
          {/* Bid Status & Deadline Card */}
          <Card className="flex flex-col gap-4" borderAccent="none">
            <h3 className="font-heading font-bold text-sm text-[var(--text-primary)] uppercase tracking-wider border-b border-[var(--border)] pb-2.5">
              Bid Status & Deadline
            </h3>
            
            <div className="flex flex-col gap-3">
              <div className="flex justify-between items-center bg-bg-dark/30 px-3 py-2 rounded-lg border border-border-color/30">
                <span className="text-[10px] text-text-muted font-bold uppercase">Current Stage</span>
                <StatusChip status={tender.status} />
              </div>

              <div className="flex justify-between items-center bg-bg-dark/30 px-3 py-2 rounded-lg border border-border-color/30">
                <span className="text-[10px] text-text-muted font-bold uppercase">Deadline</span>
                <span className="inline-flex items-center gap-1.5 font-mono text-xs text-text-primary font-semibold">
                  <Calendar size={13} className="text-text-muted" />
                  {formatDate(tender.deadline_date)}
                </span>
              </div>
            </div>

            {/* Status updates transition form */}
            <div className="border-t border-[var(--border)] pt-4 mt-2">
              <form onSubmit={handleStatusChange} className="flex flex-col gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] text-text-muted font-bold uppercase tracking-wider">Transition Stage</label>
                  <select 
                    className="w-full bg-bg-dark border border-border-color hover:border-border-focus rounded-lg px-3 py-2 text-xs font-semibold text-text-secondary outline-none transition-colors cursor-pointer"
                    value={selectedStatus}
                    onChange={(e) => setSelectedStatus(e.target.value as any)}
                    disabled={isUpdatingStatus}
                  >
                    <option value="Draft">Draft</option>
                    <option value="Submitted">Submitted</option>
                    <option value="Under Review">Under Review</option>
                    <option value="Approved">Approved</option>
                    <option value="Rejected">Rejected</option>
                    <option value="Completed">Completed</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] text-text-muted font-bold uppercase tracking-wider">Change Comments</label>
                  <textarea 
                    className="w-full bg-bg-dark border border-border-color rounded-lg px-3 py-2 text-xs text-text-primary placeholder-text-muted outline-none transition-all duration-100 min-h-[60px] resize-none focus:border-border-focus"
                    placeholder="Provide transition log details..."
                    value={statusNote}
                    onChange={(e) => setStatusNote(e.target.value)}
                    disabled={isUpdatingStatus}
                  />
                </div>

                <Button 
                  type="submit" 
                  variant="secondary"
                  size="sm"
                  className="w-full font-bold uppercase tracking-wider mt-1"
                  disabled={isUpdatingStatus || selectedStatus === tender.status}
                >
                  Update Status
                </Button>
              </form>
            </div>
          </Card>

          {/* BOQ Management Card */}
          <Card className="flex flex-col gap-4" borderAccent="none">
            <h3 className="font-heading font-bold text-sm text-[var(--text-primary)] uppercase tracking-wider border-b border-[var(--border)] pb-2.5">
              Bill of Quantities (BOQ)
            </h3>
            
            {tender.status !== 'Approved' && tender.status !== 'Completed' ? (
              <div className="flex flex-col items-center justify-center gap-2.5 py-6 px-4 bg-bg-dark/30 border border-dashed border-border-color rounded-xl text-center">
                <Lock size={24} className="text-text-muted opacity-40 shrink-0" />
                <div>
                  <div className="text-xs font-bold text-text-secondary">BOQ Costing Locked</div>
                  <p className="text-[10px] text-text-muted mt-1 leading-normal max-w-[200px] mx-auto">
                    Commercial estimators will be unlocked once this tender stage transitions to Approved.
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <div className="flex justify-between items-center bg-bg-dark/30 px-3 py-2 rounded-lg border border-border-color/30 text-xs">
                  <span className="text-[10px] text-text-muted font-bold uppercase">Estimating State</span>
                  {boq ? (
                    <StatusChip status={boq.status} />
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] text-[var(--status-warning-text)]">
                      Not Instantiated
                    </span>
                  )}
                </div>
                
                <Link href={`/tenders/${tender.id}/boq`} className="no-underline">
                  <Button 
                    variant="primary" 
                    size="sm" 
                    className="w-full flex items-center justify-center gap-1.5 font-bold uppercase tracking-wider"
                  >
                    <Unlock size={14} />
                    {boq ? 'Manage BOQ Costing' : 'Create BOQ Costing'}
                  </Button>
                </Link>
              </div>
            )}
          </Card>

          {/* Documents Attachment Card */}
          <Card className="flex flex-col gap-4" borderAccent="none">
            <h3 className="font-heading font-bold text-sm text-[var(--text-primary)] uppercase tracking-wider border-b border-[var(--border)] pb-2.5">
              Tender Specifications Files
            </h3>

            {documents.length === 0 ? (
              <div className="text-center py-6 text-xs text-text-muted italic">
                No specification files attached to this tender registry.
              </div>
            ) : (
              <div className="flex flex-col gap-2.5">
                {documents.map((doc) => (
                  <div 
                    key={doc.id}
                    className="flex items-center justify-between bg-bg-dark/30 hover:bg-bg-dark/50 border border-border-color/55 px-3 py-2 rounded-lg transition-colors group"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText size={14} className="text-primary shrink-0" />
                      <span className="text-xs font-medium text-text-secondary group-hover:text-text-primary truncate max-w-[170px]" title={doc.file_name}>
                        {doc.file_name}
                      </span>
                    </div>
                    
                    <button
                      className="text-text-muted hover:text-primary transition-colors p-1"
                      title={`Download ${doc.file_name}`}
                      onClick={async (e) => {
                        e.preventDefault();
                        try {
                          const { data, error } = await supabase.storage
                            .from('tender-documents')
                            .createSignedUrl(doc.file_path, 300, { download: doc.file_name });
                          if (error || !data?.signedUrl) throw error || new Error('No URL returned');
                          window.open(data.signedUrl, '_blank');
                        } catch {
                          alert(`'${doc.file_name}' is not available in storage. It may have been registered before file uploads were enabled — re-attach it from the Edit page.`);
                        }
                      }}
                    >
                      <Download size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Status History Timeline */}
          <Card className="flex flex-col gap-4" borderAccent="none">
            <h3 className="font-heading font-bold text-sm text-[var(--text-primary)] uppercase tracking-wider border-b border-[var(--border)] pb-2.5 flex items-center gap-1.5">
              <History size={15} className="text-text-muted" />
              Audit & Transition Trail
            </h3>
            
            <div className="relative border-l border-border-color pl-4 ml-2.5 flex flex-col gap-5 py-1">
              {tender.status_history && tender.status_history.length > 0 ? (
                tender.status_history.map((log, index) => {
                  const isActive = index === 0;
                  return (
                    <div key={index} className="relative flex flex-col gap-1">
                      {/* Timeline dot */}
                      <span className={`absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full border ${
                        isActive 
                          ? 'bg-primary border-primary shadow-[0_0_8px_var(--primary-glow)]' 
                          : 'bg-bg-dark border-border-color'
                      }`} />
                      
                      <div className="flex justify-between items-center gap-2">
                        <span className={`text-[11px] font-bold uppercase tracking-wider ${isActive ? 'text-primary' : 'text-text-secondary'}`}>
                          {log.status}
                        </span>
                        <span className="text-[9px] text-text-muted font-mono shrink-0">
                          {new Date(log.updated_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                      
                      <span className="text-[10px] text-text-muted font-mono leading-none">
                        by: {log.updated_by}
                      </span>
                      
                      {log.note && (
                        <p className="text-[10.5px] text-text-secondary bg-bg-dark/40 px-2 py-1 rounded border border-border-color/30 mt-1 italic leading-normal">
                          "{log.note}"
                        </p>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="flex items-center gap-1.5 text-xs text-text-muted italic py-2">
                  <Clock size={12} />
                  <span>No transitions logged.</span>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

