// ============================================================
// JEET ERP — Quotation Detail & Workflow Panel
// Routes: /quotations/:id
// ============================================================

'use client';
import { logger } from '@/lib/logger';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { 
  ArrowLeft, 
  Clock, 
  Check, 
  Send, 
  Edit, 
  FileText, 
  Layers, 
  AlertTriangle,
  RefreshCw,
  Download,
  Calendar,
  User,
  ShieldAlert,
  ArrowUpRight
} from 'lucide-react';
import { useQuotation } from '@/hooks/useQuotations';
import { quotationPDFService } from '@/lib/quotation-pdf';
import WorkflowPanel from '@/components/workflow/WorkflowPanel';
import '../quotations.css';

const fmtAED = (v: number) => {
  return 'AED ' + new Intl.NumberFormat('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
};

export default function QuotationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id } = use(params);

  // States
  const { quotation, loading, error, refetch, actions } = useQuotation(id);
  const [activeTab, setActiveTab] = useState('overview');
  const [currentProfile, setCurrentProfile] = useState<any>(null);
  const [pdfUrl, setPdfUrl] = useState<string>('');
  const [poNumber, setPoNumber] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [showAcceptModal, setShowAcceptModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Send-to-client email composition state
  const [emailTo, setEmailTo] = useState('');
  const [emailCc, setEmailCc] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');

  // Accept modal — client LPO/contract attachment
  const [lpoFile, setLpoFile] = useState<File | null>(null);

  // Project association (a project owns many quotations)
  const [existingProject, setExistingProject] = useState<{ id: string; project_number: string } | null>(null);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [allProjects, setAllProjects] = useState<{ id: string; project_number: string; name: string }[]>([]);
  const [linkProjectId, setLinkProjectId] = useState('');

  // Load current user profile
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) {
        supabase
          .from('profiles')
          .select('*')
          .eq('id', data.user.id)
          .single()
          .then(({ data: profile }) => {
            if (profile) setCurrentProfile(profile);
          });
      }
    });
  }, []);

  // Generate PDF URL when quotation details load
  useEffect(() => {
    if (quotation) {
      quotationPDFService.preview(quotation.id).then(url => {
        setPdfUrl(url);
      }).catch(err => {
        logger.error('Error generating PDF preview URL:', err);
      });
    }
  }, [quotation]);

  // Detect whether this quotation already belongs to a project
  useEffect(() => {
    if (!quotation) return;
    actions.getLinkedProject()
      .then(setExistingProject)
      .catch(() => setExistingProject(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quotation?.id]);

  const openLinkModal = async () => {
    try {
      const { data } = await supabase
        .from('projects')
        .select('id, project_number, name')
        .eq('is_active', true)
        .order('project_number', { ascending: false });
      setAllProjects(data || []);
      setLinkProjectId('');
      setShowLinkModal(true);
    } catch (err: any) {
      alert('Could not load projects: ' + err.message);
    }
  };

  const handleLinkToProject = async () => {
    if (!linkProjectId || !quotation) return;
    try {
      setActionLoading(true);
      await actions.linkToProject(linkProjectId);
      const proj = allProjects.find(p => p.id === linkProjectId);
      setExistingProject(proj ? { id: proj.id, project_number: proj.project_number } : null);
      setShowLinkModal(false);
      alert('Quotation linked to the project.');
    } catch (err: any) {
      alert('Failed to link: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="quote-container" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div className="spinner"></div>
        <p style={{ marginTop: '1rem', color: 'var(--text-secondary)' }}>Loading quotation details...</p>
      </div>
    );
  }

  if (error || !quotation) {
    return (
      <div className="quote-container">
        <div className="quote-card" style={{ borderColor: 'rgba(239, 68, 68, 0.3)', background: 'rgba(239, 68, 68, 0.08)', textAlign: 'center', padding: '3rem' }}>
          <ShieldAlert size={48} style={{ color: '#ef4444', margin: '0 auto 1rem auto' }} />
          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.5rem', marginBottom: '1rem' }}>Access Denied or Not Found</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>This quotation could not be loaded or you do not have permission to view it.</p>
          <Link href="/quotations" className="quote-btn quote-btn-secondary">
            <ArrowLeft size={14} /> Back to Registry
          </Link>
        </div>
      </div>
    );
  }

  // Permissions & Role flags
  const isEstimator = currentProfile?.role === 'engineer' || currentProfile?.role === 'admin';
  const isCommercial = currentProfile?.role === 'manager' || currentProfile?.role === 'admin';
  const isGM = currentProfile?.role === 'admin';
  const isCreator = quotation.prepared_by === currentProfile?.id;

  // Status check helper
  const statusLabels: Record<string, string> = {
    DRAFT: 'Draft',
    PENDING_COMMERCIAL: 'Pending Commercial Review',
    PENDING_GM: 'Pending GM Approval',
    APPROVED: 'Approved',
    SENT_TO_CLIENT: 'Sent to Client',
    ACCEPTED: 'Accepted by Client',
    REJECTED: 'Rejected by Client',
    REVISED: 'Revised & Replaced',
    SUPERSEDED: 'Superseded by Rev'
  };

  // State transitions
  const handleSubmit = async () => {
    try {
      setActionLoading(true);
      await actions.submitForReview();
      alert('Quotation submitted for Commercial Review!');
    } catch (err: any) {
      alert('Submission failed: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Opens the email composition modal, prefilling recipient/subject/body.
  const openSendModal = () => {
    if (!quotation) return;
    const fmtTotal = new Intl.NumberFormat('en-AE', { minimumFractionDigits: 2 }).format(quotation.grand_total_with_vat || 0);
    setEmailTo(quotation.client_contact_email || '');
    setEmailCc('');
    setEmailSubject(`Quotation ${quotation.quotation_number}${quotation.revision_label ? ' ' + quotation.revision_label : ''} — ${quotation.subject || quotation.project_ref || ''}`);
    setEmailBody(
      `Dear ${quotation.client_contact_person || quotation.client_name || 'Sir/Madam'},\n\n` +
      `Please find attached our quotation ${quotation.quotation_number} for ${quotation.subject || quotation.project_ref || 'your project'}.\n\n` +
      `Total (incl. VAT): AED ${fmtTotal}\n` +
      `Valid until: ${quotation.valid_until ? new Date(quotation.valid_until).toLocaleDateString('en-GB') : 'N/A'}\n\n` +
      `Kindly review and confirm your acceptance by issuing your LPO/PO at your earliest convenience. We remain available for any clarifications.\n\n` +
      `Best regards,\n${quotation.prepared_by_name || ''}\nJEET INTECH L.L.C`
    );
    setShowSendModal(true);
  };

  // Builds and opens a mailto: link in the user's default mail client.
  const openMailClient = () => {
    const params = new URLSearchParams();
    if (emailCc) params.set('cc', emailCc);
    params.set('subject', emailSubject);
    params.set('body', emailBody);
    window.location.href = `mailto:${encodeURIComponent(emailTo)}?${params.toString().replace(/\+/g, '%20')}`;
  };

  // Marks the quotation as sent (after the user has emailed it).
  const handleConfirmSent = async () => {
    try {
      setActionLoading(true);
      await actions.sendToClient();
      setShowSendModal(false);
      alert('Quotation marked as Sent to Client.');
    } catch (err: any) {
      alert('Operation failed: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleAcceptClient = async () => {
    if (!poNumber) {
      alert('LPO / PO reference number is required.');
      return;
    }
    try {
      setActionLoading(true);

      // Upload the client LPO/contract document (optional) before accepting
      if (lpoFile && quotation) {
        const path = `QUOTATION/${quotation.id}/LPO_${Date.now()}_${lpoFile.name}`;
        const { error: upErr } = await supabase.storage
          .from('tender-documents')
          .upload(path, lpoFile, { cacheControl: '3600', upsert: true });
        if (upErr) {
          throw new Error(`Failed to upload LPO document: ${upErr.message}`);
        }
        // Persist the document reference. Degrades gracefully if the columns
        // are not present yet (migration 20260613120000 not applied).
        const { error: docErr } = await supabase
          .from('quotations')
          .update({ client_po_document_path: path, client_po_document_name: lpoFile.name })
          .eq('id', quotation.id);
        if (docErr) {
          logger.warn('LPO document uploaded but reference not saved (apply migration 20260613120000):', docErr.message);
        }
      }

      await actions.markAccepted(poNumber);
      setShowAcceptModal(false);
      setLpoFile(null);
      alert('Quotation marked as ACCEPTED! Project status updated and item usage incremented.');
    } catch (err: any) {
      alert('Operation failed: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Download the previously-uploaded client LPO/contract document.
  const handleDownloadLpo = async () => {
    const path = (quotation as any)?.client_po_document_path;
    if (!path) return;
    try {
      const { data, error } = await supabase.storage
        .from('tender-documents')
        .createSignedUrl(path, 300, { download: (quotation as any)?.client_po_document_name || true });
      if (error || !data?.signedUrl) throw error || new Error('No URL');
      window.open(data.signedUrl, '_blank');
    } catch {
      alert('Could not open the LPO document.');
    }
  };

  const handleRejectClient = async () => {
    if (!rejectReason) {
      alert('Please specify the reason for client rejection/revision.');
      return;
    }
    try {
      setActionLoading(true);
      await actions.markRejected(rejectReason);
      setShowRejectModal(false);
      alert('Quotation marked as REJECTED.');
    } catch (err: any) {
      alert('Operation failed: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateRevision = async () => {
    if (window.confirm('Create a new quotation revision? The current revision will be marked as SUPERSEDED and locked.')) {
      try {
        setActionLoading(true);
        const newId = await actions.createRevision();
        router.push(`/quotations/${newId}/edit`);
      } catch (err: any) {
        alert('Failed to create revision: ' + err.message);
      } finally {
        setActionLoading(false);
      }
    }
  };

  const handleDownloadPDF = () => {
    quotationPDFService.download(quotation.id);
  };

  return (
    <div className="quote-container">
      {/* Top Banner and Back button */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <Link href="/quotations" className="quote-btn quote-btn-secondary" style={{ padding: '0.4rem 0.6rem' }}>
          <ArrowLeft size={16} /> Back to Registry
        </Link>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="quote-btn quote-btn-secondary" onClick={refetch}>
            <RefreshCw size={14} /> Refresh
          </button>
          <button className="quote-btn quote-btn-secondary" onClick={handleDownloadPDF}>
            <Download size={14} /> Download PDF
          </button>
        </div>
      </div>

      {/* Header Panel */}
      <div className="quote-card" style={{ padding: '1.8rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', flexWrap: 'wrap' }}>
              <h1 className="quote-header-title" style={{ fontSize: '2.2rem' }}>{quotation.quotation_number}</h1>
              <span style={{ fontSize: '1rem', color: 'var(--text-muted)', fontWeight: 600 }}>{quotation.revision_label}</span>
              <span className={`q-badge q-badge-${quotation.status.toLowerCase()}`}>
                {statusLabels[quotation.status] || quotation.status}
              </span>
            </div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: '0.5rem' }}>
              {quotation.subject}
            </h3>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'flex', gap: '1.2rem', marginTop: '0.6rem' }}>
              <span>Project Ref: <strong style={{ color: 'var(--text-secondary)' }}>{quotation.project_ref}</strong></span>
              <span>Prepared: {new Date(quotation.quotation_date).toLocaleDateString('en-GB')}</span>
              <span>Valid Until: {new Date(quotation.valid_until).toLocaleDateString('en-GB')}</span>
            </div>
          </div>
          
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>Grand Total</span>
            <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--accent)', fontFamily: 'var(--font-heading)', textShadow: '0 0 15px rgba(0, 229, 160, 0.25)' }}>
              {fmtAED(quotation.grand_total_with_vat)}
            </div>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Inclusive of 5% VAT</span>
          </div>
        </div>
      </div>

      {/* Action panel (Sticky context buttons) */}
      <div className="quote-card" style={{ borderColor: 'var(--accent)', background: 'rgba(0, 229, 160, 0.03)', padding: '1rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
          Logged in as: <strong style={{ color: 'var(--accent)' }}>{currentProfile?.full_name} ({currentProfile?.role})</strong>
        </span>
        
        <div style={{ display: 'flex', gap: '0.8rem', flexWrap: 'wrap' }}>
          {/* ESTIMATOR ACTIONS */}
          {isEstimator && quotation.status === 'DRAFT' && (isCreator || currentProfile?.role === 'admin') && (
            <>
              <Link href={`/quotations/${quotation.id}/edit`} className="quote-btn quote-btn-secondary">
                <Edit size={14} /> Edit Draft
              </Link>
              <button className="quote-btn quote-btn-primary" disabled={actionLoading} onClick={handleSubmit}>
                <Send size={14} /> Submit for Review
              </button>
            </>
          )}

          {/* COMMERCIAL MANAGER ACTIONS */}
          {isCommercial && quotation.status === 'PENDING_COMMERCIAL' && (
            <Link href={`/quotations/${quotation.id}/review`} className="quote-btn quote-btn-primary">
              Review & Approve <ArrowUpRight size={14} />
            </Link>
          )}

          {/* GM ACTIONS */}
          {isGM && quotation.status === 'PENDING_GM' && (
            <Link href={`/quotations/${quotation.id}/approve`} className="quote-btn quote-btn-primary">
              GM Approve & Sign <ArrowUpRight size={14} />
            </Link>
          )}

          {/* POST GM APPROVAL - ESTIMATOR ACTIONS */}
          {isEstimator && quotation.status === 'APPROVED' && (
            <>
              <button className="quote-btn quote-btn-primary" disabled={actionLoading} onClick={openSendModal}>
                <Send size={14} /> Send to Client
              </button>
              <button className="quote-btn quote-btn-secondary" disabled={actionLoading} onClick={handleCreateRevision}>
                <RefreshCw size={14} /> Create Revision
              </button>
            </>
          )}

          {/* CLIENT RESPONDING - ESTIMATOR ACTIONS */}
          {isEstimator && quotation.status === 'SENT_TO_CLIENT' && (
            <>
              <button className="quote-btn quote-btn-primary" onClick={() => setShowAcceptModal(true)}>
                Mark Accepted
              </button>
              <button className="quote-btn quote-btn-danger" onClick={() => setShowRejectModal(true)}>
                Mark Rejected
              </button>
              <button className="quote-btn quote-btn-secondary" disabled={actionLoading} onClick={handleCreateRevision}>
                <RefreshCw size={14} /> Create Revision (Revise)
              </button>
            </>
          )}

          {/* REJECTED / SUPERSEDED - CREATE REVISION ACTIONS */}
          {isEstimator && (quotation.status === 'REJECTED' || quotation.status === 'ACCEPTED') && (
            <button className="quote-btn quote-btn-secondary" disabled={actionLoading} onClick={handleCreateRevision}>
              <RefreshCw size={14} /> Create Revision
            </button>
          )}

          {quotation.status === 'ACCEPTED' && (
            <>
              {(quotation as any).client_po_document_path && (
                <button className="quote-btn quote-btn-secondary" onClick={handleDownloadLpo}>
                  <Download size={14} /> Client LPO / Contract
                </button>
              )}
              {existingProject ? (
                <Link href={`/projects/${existingProject.id}`} className="quote-btn quote-btn-primary" style={{ background: 'var(--secondary)', color: 'var(--bg-card)', fontWeight: 'bold', textDecoration: 'none' }}>
                  View Project {existingProject.project_number} &rarr;
                </Link>
              ) : (
                <>
                  <Link href={`/projects/new/${quotation.id}`} className="quote-btn quote-btn-primary" style={{ background: 'var(--secondary)', color: 'var(--bg-card)', fontWeight: 'bold', textDecoration: 'none' }}>
                    Initialize Project Master &rarr;
                  </Link>
                  <button className="quote-btn quote-btn-secondary" onClick={openLinkModal}>
                    Link to Existing Project
                  </button>
                </>
              )}
              <Link href={`/procurement/comparisons/new/${quotation.id}`} className="quote-btn quote-btn-primary" style={{ background: 'var(--accent)', color: 'var(--bg-card)', fontWeight: 'bold', textDecoration: 'none' }}>
                Create Supplier Comparison &rarr;
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Tabs list */}
      <div className="quote-tabs">
        <button className={`quote-tab ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>Overview</button>
        <button className={`quote-tab ${activeTab === 'lines' ? 'active' : ''}`} onClick={() => setActiveTab('lines')}>Line Items</button>
        <button className={`quote-tab ${activeTab === 'terms' ? 'active' : ''}`} onClick={() => setActiveTab('terms')}>Commercial Terms</button>
        <button className={`quote-tab ${activeTab === 'approvals' ? 'active' : ''}`} onClick={() => setActiveTab('approvals')}>Approvals Log</button>
        <button className={`quote-tab ${activeTab === 'revisions' ? 'active' : ''}`} onClick={() => setActiveTab('revisions')}>Revisions ({quotation.revisions?.length || 1})</button>
        <button className={`quote-tab ${activeTab === 'pdf' ? 'active' : ''}`} onClick={() => setActiveTab('pdf')}>PDF Preview</button>
      </div>

      {/* TAB CONTENT: OVERVIEW */}
      {activeTab === 'overview' && (
        <>
        {/* Configurable workflow (Admin Center → Workflows) */}
        <WorkflowPanel
          moduleKey="QTN"
          entityId={id}
          context={{ status: quotation.status, grand_total: Number(quotation.grand_total_with_vat) || 0 }}
          onStatusChange={() => refetch()}
          className="mb-6"
        />

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem', alignItems: 'start' }}>
          
          {/* Main Info */}
          <div className="quote-card">
            <h3 className="quote-card-title"><FileText size={16} /> Scope Summary</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: '1.5', marginTop: '0.8rem', whiteSpace: 'pre-line' }}>
              {quotation.scope_summary || 'No scope summary defined.'}
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1.5rem', borderTop: '1px solid var(--surface-hover)', paddingTop: '1rem' }}>
              <div>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>CLIENT DETAILS</span>
                <p style={{ fontWeight: 600, fontSize: '0.92rem', marginTop: '0.2rem' }}>{quotation.client_name}</p>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{quotation.client_address_line1} {quotation.client_address_line2}</p>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{quotation.client_city}, {quotation.client_country}</p>
              </div>
              <div>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>PRIMARY CONTACT</span>
                <p style={{ fontWeight: 600, fontSize: '0.88rem', marginTop: '0.2rem' }}>{quotation.client_contact_person || 'N/A'}</p>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Email: {quotation.client_contact_email || 'N/A'}</p>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Phone: {quotation.client_contact_phone || 'N/A'}</p>
              </div>
            </div>
            
            {quotation.rejection_reason && (
              <div className="quote-card" style={{ borderColor: 'rgba(239, 68, 68, 0.3)', background: 'rgba(239, 68, 68, 0.06)', color: '#fca5a5', marginTop: '1.5rem', margin: 0 }}>
                <strong>Rejection Reason / Revision Comment:</strong>
                <p style={{ fontSize: '0.85rem', marginTop: '0.4rem' }}>{quotation.rejection_reason}</p>
              </div>
            )}
          </div>

          {/* Stepper Timeline */}
          <div className="quote-card">
            <h3 className="quote-card-title"><Clock size={16} /> Workflow Timeline</h3>
            <div className="quote-stepper" style={{ marginTop: '1.2rem' }}>
              
              <div className={`quote-step done`}>
                <div className="quote-step-dot"></div>
                <div className="quote-step-title">Quotation Drafted</div>
                <div className="quote-step-meta">Mohammed — {new Date(quotation.created_at).toLocaleString('en-GB')}</div>
              </div>

              <div className={`quote-step ${['PENDING_COMMERCIAL', 'PENDING_GM', 'APPROVED', 'SENT_TO_CLIENT', 'ACCEPTED'].includes(quotation.status) ? 'done' : quotation.status === 'DRAFT' ? 'active' : ''}`}>
                <div className="quote-step-dot"></div>
                <div className="quote-step-title">Commercial Review</div>
                {quotation.commercial_reviewed_at ? (
                  <div className="quote-step-meta">
                    Reviewed by {quotation.commercial_reviewer_id ? 'Commercial Manager' : 'Manager'} on {new Date(quotation.commercial_reviewed_at).toLocaleDateString('en-GB')}<br />
                    {quotation.commercial_comment && <div className="quote-step-comment">"{quotation.commercial_comment}"</div>}
                  </div>
                ) : (
                  <div className="quote-step-meta">Pending approval by Commercial Manager</div>
                )}
              </div>

              <div className={`quote-step ${['PENDING_GM', 'APPROVED', 'SENT_TO_CLIENT', 'ACCEPTED'].includes(quotation.status) ? 'done' : quotation.status === 'PENDING_COMMERCIAL' ? 'active' : ''}`}>
                <div className="quote-step-dot"></div>
                <div className="quote-step-title">GM Approval & Signature</div>
                {quotation.gm_approved_at ? (
                  <div className="quote-step-meta">
                    Approved & Signed by GM on {new Date(quotation.gm_approved_at).toLocaleDateString('en-GB')}<br />
                    {quotation.gm_comment && <div className="quote-step-comment">"{quotation.gm_comment}"</div>}
                  </div>
                ) : (
                  <div className="quote-step-meta">Awaiting final GM authorization</div>
                )}
              </div>

              <div className={`quote-step ${['SENT_TO_CLIENT', 'ACCEPTED'].includes(quotation.status) ? 'done' : quotation.status === 'APPROVED' ? 'active' : ''}`}>
                <div className="quote-step-dot"></div>
                <div className="quote-step-title">Sent to Client</div>
                {quotation.sent_to_client_at ? (
                  <div className="quote-step-meta">Sent on {new Date(quotation.sent_to_client_at).toLocaleDateString('en-GB')}</div>
                ) : (
                  <div className="quote-step-meta">Pending dispatch to customer</div>
                )}
              </div>

              <div className={`quote-step ${quotation.status === 'ACCEPTED' ? 'done' : quotation.status === 'SENT_TO_CLIENT' ? 'active' : ''}`}>
                <div className="quote-step-dot"></div>
                <div className="quote-step-title">Client Acceptance</div>
                {quotation.status === 'ACCEPTED' ? (
                  <div className="quote-step-meta">Accepted! PO Ref: {quotation.client_po_number}</div>
                ) : (
                  <div className="quote-step-meta">Awaiting customer signature / LPO</div>
                )}
              </div>

            </div>
          </div>
        </div>
        </>
      )}

      {/* TAB CONTENT: LINE ITEMS */}
      {activeTab === 'lines' && (
        <div className="quote-card">
          <div className="quote-table-wrap">
            <table className="quote-table">
              <thead>
                <tr>
                  <th style={{ width: '40px' }}>No</th>
                  <th>Item Code</th>
                  <th>Description</th>
                  <th>System</th>
                  <th>Category</th>
                  <th style={{ width: '60px' }}>Unit</th>
                  <th style={{ width: '80px', textAlign: 'right' }}>Qty</th>
                  <th style={{ width: '120px', textAlign: 'right' }}>Unit Price (AED)</th>
                  <th style={{ width: '80px', textAlign: 'right' }}>Disc %</th>
                  <th style={{ width: '120px', textAlign: 'right' }}>Line Total (AED)</th>
                </tr>
              </thead>
              <tbody>
                {quotation.lines.map((line: any, idx: number) => (
                  <tr key={line.id} style={{ opacity: line.is_optional ? 0.6 : 1, fontStyle: line.is_optional ? 'italic' : 'normal' }}>
                    <td>{line.is_optional ? '*' : idx + 1}</td>
                    <td style={{ fontFamily: 'var(--font-mono)' }}>{line.item_code}</td>
                    <td>
                      {line.description}
                      {line.is_optional && <strong style={{ color: 'var(--secondary)', marginLeft: '0.4rem' }}>(OPTIONAL)</strong>}
                    </td>
                    <td>{line.system}</td>
                    <td>{line.category}</td>
                    <td>{line.unit}</td>
                    <td style={{ textAlign: 'right' }}>{line.quantity}</td>
                    <td style={{ textAlign: 'right' }}>{fmtAED(line.unit_sell_price)}</td>
                    <td style={{ textAlign: 'right' }}>{line.discount_pct}%</td>
                    <td style={{ textAlign: 'right', fontWeight: 600, color: line.is_optional ? 'var(--text-muted)' : 'var(--text-primary)' }}>
                      {fmtAED(line.line_total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="quote-live-footer">
            <div className="quote-live-row">
              <span>Subtotal (Excl. VAT):</span>
              <span>{fmtAED(quotation.subtotal_ex_vat)}</span>
            </div>
            {quotation.discount_amount > 0 && (
              <div className="quote-live-row">
                <span>Discount Amount:</span>
                <span style={{ color: '#ef4444' }}>-{fmtAED(quotation.discount_amount)}</span>
              </div>
            )}
            <div className="quote-live-row">
              <span>Subtotal after Discount:</span>
              <span>{fmtAED(quotation.subtotal_after_discount)}</span>
            </div>
            <div className="quote-live-row">
              <span>VAT 5%:</span>
              <span>{fmtAED(quotation.vat_amount)}</span>
            </div>
            <div className="quote-live-row highlight">
              <span>GRAND TOTAL (inc VAT):</span>
              <span>{fmtAED(quotation.grand_total_with_vat)}</span>
            </div>
            <div className="quote-words">
              <strong>In Words (Excl. VAT):</strong><br />
              {quotation.grand_total_in_words}
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT: TERMS */}
      {activeTab === 'terms' && (
        <div className="quote-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div>
            <h4 style={{ color: 'var(--accent)', marginBottom: '0.4rem' }}>Payment Terms</h4>
            <p style={{ whiteSpace: 'pre-wrap', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{quotation.payment_terms || 'N/A'}</p>
          </div>
          <div>
            <h4 style={{ color: 'var(--accent)', marginBottom: '0.4rem' }}>Delivery Period</h4>
            <p style={{ whiteSpace: 'pre-wrap', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{quotation.delivery_period || 'N/A'}</p>
          </div>
          <div>
            <h4 style={{ color: 'var(--accent)', marginBottom: '0.4rem' }}>Warranty Terms</h4>
            <p style={{ whiteSpace: 'pre-wrap', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{quotation.warranty_terms || 'N/A'}</p>
          </div>
          <div>
            <h4 style={{ color: 'var(--accent)', marginBottom: '0.4rem' }}>Terms & Conditions</h4>
            <p style={{ whiteSpace: 'pre-wrap', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{quotation.terms_and_conditions || 'N/A'}</p>
          </div>
          <div>
            <h4 style={{ color: 'var(--accent)', marginBottom: '0.4rem' }}>Inclusions</h4>
            <p style={{ whiteSpace: 'pre-wrap', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{quotation.inclusions || 'N/A'}</p>
          </div>
          <div>
            <h4 style={{ color: 'var(--accent)', marginBottom: '0.4rem' }}>Exclusions</h4>
            <p style={{ whiteSpace: 'pre-wrap', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{quotation.exclusions || 'N/A'}</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', borderTop: '1px solid var(--surface-hover)', paddingTop: '1rem' }}>
            <div>
              <h4 style={{ color: 'var(--text-muted)', marginBottom: '0.4rem' }}>Notes to Client (PDF Footer)</h4>
              <p style={{ whiteSpace: 'pre-wrap', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{quotation.notes_client || 'None'}</p>
            </div>
            <div>
              <h4 style={{ color: 'var(--text-muted)', marginBottom: '0.4rem' }}>Internal Estimator Notes</h4>
              <p style={{ whiteSpace: 'pre-wrap', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{quotation.notes_internal || 'None'}</p>
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT: APPROVALS HISTORY */}
      {activeTab === 'approvals' && (
        <div className="quote-card">
          <div className="quote-table-wrap">
            <table className="quote-table">
              <thead>
                <tr>
                  <th>Stage</th>
                  <th>Action</th>
                  <th>Actor Name</th>
                  <th>Title</th>
                  <th>Comment</th>
                  <th>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {quotation.approvals?.map((app: any) => (
                  <tr key={app.id}>
                    <td style={{ fontWeight: 600 }}>{app.stage}</td>
                    <td>{app.action}</td>
                    <td>{app.actor_name}</td>
                    <td>{app.actor_title}</td>
                    <td>{app.comment || 'No comment provided'}</td>
                    <td>{new Date(app.acted_at).toLocaleString('en-GB')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB CONTENT: REVISIONS CHAIN */}
      {activeTab === 'revisions' && (
        <div className="quote-card">
          <div className="quote-table-wrap">
            <table className="quote-table">
              <thead>
                <tr>
                  <th>Revision Label</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Grand Total</th>
                  <th>Created At</th>
                  <th style={{ textAlign: 'center' }}>Link</th>
                </tr>
              </thead>
              <tbody>
                {quotation.revisions?.map((rev: any) => (
                  <tr key={rev.id} style={{ fontWeight: rev.id === quotation.id ? 'bold' : 'normal' }}>
                    <td>{rev.revision_label} {rev.id === quotation.id ? '(Current)' : ''}</td>
                    <td>
                      <span className={`q-badge q-badge-${rev.status.toLowerCase()}`}>
                        {statusLabels[rev.status] || rev.status}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right', color: 'var(--accent)' }}>{fmtAED(rev.grand_total_with_vat)}</td>
                    <td>{new Date(rev.created_at).toLocaleString('en-GB')}</td>
                    <td style={{ textAlign: 'center' }}>
                      {rev.id !== quotation.id ? (
                        <Link href={`/quotations/${rev.id}`} className="quote-btn quote-btn-secondary" style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}>
                          Open Rev &rarr;
                        </Link>
                      ) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB CONTENT: PDF PREVIEW IFRAME */}
      {activeTab === 'pdf' && (
        <div className="quote-card" style={{ height: '70vh', padding: 0 }}>
          {pdfUrl ? (
            <iframe src={pdfUrl} width="100%" height="100%" style={{ border: 'none', borderRadius: '12px' }}></iframe>
          ) : (
            <div style={{ padding: '3rem', textAlign: 'center' }}>
              <div className="spinner" style={{ margin: '0 auto' }}></div>
              <p style={{ marginTop: '1rem' }}>Rendering PDF Preview...</p>
            </div>
          )}
        </div>
      )}

      {/* LINK TO EXISTING PROJECT MODAL */}
      {showLinkModal && (
        <div className="quote-modal-overlay">
          <div className="quote-modal">
            <div className="quote-modal-header">
              <h3 className="quote-card-title">Link Quotation to Existing Project</h3>
            </div>
            <div className="quote-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Associate this quotation with an existing project. A project can own many quotations; this quotation will belong to the selected project.
              </p>
              <div className="quote-form-group">
                <label>Project</label>
                <select className="quote-form-input" value={linkProjectId} onChange={(e) => setLinkProjectId(e.target.value)}>
                  <option value="">Select a project…</option>
                  {allProjects.map(p => <option key={p.id} value={p.id}>{p.project_number} — {p.name}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', gap: '0.8rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
                <button className="quote-btn quote-btn-secondary" onClick={() => setShowLinkModal(false)}>Cancel</button>
                <button className="quote-btn quote-btn-primary" disabled={!linkProjectId || actionLoading} onClick={handleLinkToProject}>Link Quotation</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SEND TO CLIENT — EMAIL COMPOSE MODAL */}
      {showSendModal && (
        <div className="quote-modal-overlay">
          <div className="quote-modal" style={{ maxWidth: '620px' }}>
            <div className="quote-modal-header">
              <h3 className="quote-card-title"><Send size={16} /> Send Quotation to Client</h3>
            </div>
            <div className="quote-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', background: 'rgba(37, 99, 235, 0.06)', padding: '0.7rem', borderRadius: '8px', border: '1px solid rgba(37, 99, 235, 0.15)' }}>
                <FileText size={14} style={{ color: 'var(--primary)', flexShrink: 0, marginTop: '0.1rem' }} />
                <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                  Download the PDF and attach it to the email (mail clients can't auto-attach). Opening your mail app pre-fills the recipient, subject and message. Then return here and mark it as sent.
                </p>
              </div>

              <button
                className="quote-btn quote-btn-secondary"
                style={{ alignSelf: 'flex-start' }}
                onClick={() => quotationPDFService.download(quotation.id)}
              >
                <Download size={14} /> Download Quotation PDF
              </button>

              <div className="quote-form-group">
                <label>To</label>
                <input type="email" className="quote-form-input" placeholder="client@email.com" value={emailTo} onChange={(e) => setEmailTo(e.target.value)} />
              </div>
              <div className="quote-form-group">
                <label>Cc <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span></label>
                <input type="text" className="quote-form-input" placeholder="cc@email.com" value={emailCc} onChange={(e) => setEmailCc(e.target.value)} />
              </div>
              <div className="quote-form-group">
                <label>Subject</label>
                <input type="text" className="quote-form-input" value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)} />
              </div>
              <div className="quote-form-group">
                <label>Message</label>
                <textarea className="quote-form-textarea" rows={8} value={emailBody} onChange={(e) => setEmailBody(e.target.value)} />
              </div>

              <div style={{ display: 'flex', gap: '0.8rem', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
                <button className="quote-btn quote-btn-secondary" onClick={openMailClient} disabled={!emailTo}>
                  <Send size={14} /> Open in Email App
                </button>
                <div style={{ display: 'flex', gap: '0.6rem' }}>
                  <button className="quote-btn quote-btn-secondary" onClick={() => setShowSendModal(false)}>Cancel</button>
                  <button className="quote-btn quote-btn-primary" disabled={actionLoading} onClick={handleConfirmSent}>
                    Mark as Sent
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ACCEPT MODAL */}
      {showAcceptModal && (
        <div className="quote-modal-overlay">
          <div className="quote-modal">
            <div className="quote-modal-header">
              <h3 className="quote-card-title">Accept Quotation</h3>
            </div>
            <div className="quote-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Specify the client''s LPO (Local Purchase Order) or PO number reference below to complete the quotation. This will lock the quotation as ACCEPTED, increment pricing catalog usages, and set the project/tender status to Completed.</p>
              <div className="quote-form-group">
                <label>LPO / PO Reference Number</label>
                <input
                  type="text"
                  className="quote-form-input"
                  placeholder="e.g. LPO-2026-904"
                  value={poNumber}
                  onChange={(e) => setPoNumber(e.target.value)}
                />
              </div>
              <div className="quote-form-group">
                <label>Client LPO / Contract Document <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span></label>
                <input
                  type="file"
                  className="quote-form-input"
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                  onChange={(e) => setLpoFile(e.target.files?.[0] || null)}
                />
                {lpoFile && (
                  <span style={{ fontSize: '0.72rem', color: 'var(--success)', marginTop: '0.3rem' }}>
                    Attached: {lpoFile.name} ({(lpoFile.size / 1024).toFixed(0)} KB)
                  </span>
                )}
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                  Upload the signed LPO/PO or contract. (AI email/WhatsApp follow-up will populate this automatically in a future release.)
                </span>
              </div>
              <div style={{ display: 'flex', gap: '0.8rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
                <button className="quote-btn quote-btn-secondary" onClick={() => setShowAcceptModal(false)}>Cancel</button>
                <button className="quote-btn quote-btn-primary" disabled={actionLoading} onClick={handleAcceptClient}>
                  Confirm Acceptance
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* REJECT MODAL */}
      {showRejectModal && (
        <div className="quote-modal-overlay">
          <div className="quote-modal">
            <div className="quote-modal-header">
              <h3 className="quote-card-title">Reject Quotation</h3>
            </div>
            <div className="quote-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Provide the reason for the client''s rejection. This will archive the quotation as REJECTED. You can create a new revised revision from it later if negotiations continue.</p>
              <div className="quote-form-group">
                <label>Reason / Feedback</label>
                <textarea 
                  className="quote-form-textarea" 
                  placeholder="e.g. Budget constraints / technical scope changes required..." 
                  value={rejectReason} 
                  onChange={(e) => setRejectReason(e.target.value)} 
                />
              </div>
              <div style={{ display: 'flex', gap: '0.8rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
                <button className="quote-btn quote-btn-secondary" onClick={() => setShowRejectModal(false)}>Cancel</button>
                <button className="quote-btn quote-btn-danger" disabled={actionLoading} onClick={handleRejectClient}>
                  Confirm Rejection
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
