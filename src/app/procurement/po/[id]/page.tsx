// ============================================================
// JEET ERP — Purchase Order Detail & Approval sign-off
// Route: /procurement/po/[id]
// ============================================================

'use client';
import { logger } from '@/lib/logger';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { usePO } from '@/hooks/usePOs';
import { usePermissions } from '@/lib/permissions/usePermissions';
import { PO_STATUS_LABELS, PO_STATUS_COLORS, PO_TYPE_LABELS, PO_DELIVERY_STATUS_LABELS, PO_DELIVERY_STATUS_COLORS } from '@/constants/po.constants';
import { poPDFService } from '@/services/poPDFService';
import { grnService } from '@/services/grnService';
import { useProjectCommitments } from '@/hooks/useProjectCommitments';
import {
  ArrowLeft,
  Calendar,
  Download,
  FileText,
  Send,
  AlertCircle,
  CheckCircle,
  XCircle,
  RotateCcw,
  ExternalLink,
  ChevronRight,
  User,
  Truck,
  Ban,
  Upload
} from 'lucide-react';
import WorkflowPanel from '@/components/workflow/WorkflowPanel';
import ProjectBudgetCard from '@/components/finance/ProjectBudgetCard';
import '@/app/procurement/comparisons/comparisons.css';

const fmtAED = (v: number) => {
  return 'AED ' + new Intl.NumberFormat('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function PODetailPage({ params }: PageProps) {
  const router = useRouter();
  const { id: poId } = use(params);

  const {
    po,
    loading,
    error,
    refetch,
    submitForApproval,
    processApproval,
    cancelPO,
    closeShortPO,
    revisePO,
    sendPO,
    acknowledgePO
  } = usePO(poId);

  const { commitments, loading: commitmentsLoading } = useProjectCommitments(po?.project_id || '');

  // Find any budget overruns for the systems in this LPO
  const getBudgetWarnings = () => {
    if (!po || !commitments || commitments.length === 0) return [];
    const poSystems = [...new Set(po.items?.map((it: any) => it.system).filter(Boolean))];
    const warnings: string[] = [];
    poSystems.forEach(sys => {
      const comm = commitments.find(c => c.system === sys);
      if (comm && comm.committedCost > comm.budgetCost && comm.budgetCost > 0) {
        const pct = Math.round((comm.committedCost / comm.budgetCost) * 100);
        warnings.push(`This PO takes ${comm.systemName} committed cost to ${pct}% of BOQ budget`);
      }
    });
    return warnings;
  };

  const budgetWarnings = getBudgetWarnings();
  const hasBudgetOverrun = budgetWarnings.length > 0;

  const [currentUser, setCurrentUser] = useState<any | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [grns, setGrns] = useState<any[]>([]);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  
  // Modal states
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [showAckModal, setShowAckModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [closeReason, setCloseReason] = useState('');
  const [approvalComment, setApprovalComment] = useState('');
  const [ackReference, setAckReference] = useState('');
  const [ackDate, setAckDate] = useState('');

  // Supplier proforma invoice attachment
  const [proformaUploading, setProformaUploading] = useState(false);

  const handleUploadProforma = async (file: File) => {
    if (!po) return;
    setProformaUploading(true);
    try {
      const path = `PO/${po.id}/PROFORMA_${Date.now()}_${file.name}`;
      const { error: upErr } = await supabase.storage
        .from('tender-documents')
        .upload(path, file, { cacheControl: '3600', upsert: true });
      if (upErr) throw new Error(`Upload failed: ${upErr.message}`);

      const { error: dbErr } = await supabase
        .from('purchase_orders')
        .update({
          proforma_invoice_path: path,
          proforma_invoice_name: file.name,
          proforma_invoice_uploaded_at: new Date().toISOString(),
        })
        .eq('id', po.id);
      if (dbErr) {
        // Columns may not exist yet (migration 20260613140000 not applied)
        logger.warn('Proforma uploaded but reference not saved (apply migration 20260613140000):', dbErr.message);
        alert('Proforma uploaded, but the reference could not be saved — apply migration 20260613140000.');
      }
      await refetch();
    } catch (err: any) {
      alert(err.message || 'Failed to upload proforma invoice');
    } finally {
      setProformaUploading(false);
    }
  };

  const handleDownloadProforma = async () => {
    const path = (po as any)?.proforma_invoice_path;
    if (!path) return;
    try {
      const { data, error } = await supabase.storage
        .from('tender-documents')
        .createSignedUrl(path, 300, { download: (po as any)?.proforma_invoice_name || true });
      if (error || !data?.signedUrl) throw error || new Error('No URL');
      window.open(data.signedUrl, '_blank');
    } catch {
      alert('Could not open the proforma invoice.');
    }
  };

  // Fetch current user & associated GRNs
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setCurrentUser(user);
      if (user) {
        supabase.from('profiles').select('*').eq('id', user.id).single().then(({ data }) => {
          setProfile(data);
        });
      }
    });

    if (poId) {
      grnService.getGRNs({ po_id: poId }).then(data => {
        setGrns(data);
      });
    }
  }, [poId]);

  // Determine active approval stage
  const getActiveApprovalStage = () => {
    if (!po || po.status !== 'PENDING_APPROVAL') return null;
    
    // Check which stage is missing
    const hasCommercial = po.approvals?.some(app => app.stage === 'COMMERCIAL' && app.action === 'APPROVED');
    
    if (!hasCommercial) {
      return 'COMMERCIAL';
    }

    const totalVal = Number(po.total) || 0;
    if (totalVal > 50000.00) {
      const hasGM = po.approvals?.some(app => app.stage === 'GM' && app.action === 'APPROVED');
      if (!hasGM) return 'GM';
    }

    return null;
  };

  const { hasPermission } = usePermissions();
  const activeStage = getActiveApprovalStage();
  const isCreator = po && currentUser && po.created_by === currentUser.id;
  const isApproverRole = hasPermission('po.approve', po?.created_by);
  const canApprove = activeStage && !isCreator && isApproverRole;

  // Actions
  const handleDownloadPDF = async () => {
    if (!po) return;
    try {
      const pdf = await poPDFService.generatePOPDF(po, po.items || []);
      pdf.save(`JI-LPO-${po.po_number || 'DRAFT'}.pdf`);
    } catch (err) {
      logger.error('Failed to generate PDF:', err);
    }
  };

  const handleSubmit = async () => {
    try {
      setActionLoading(true);
      setActionError(null);
      await submitForApproval(currentUser?.id);
    } catch (err: any) {
      setActionError(err.message || 'Failed to submit Purchase Order.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSignOff = async (action: 'APPROVED' | 'REJECTED') => {
    if (!activeStage || !currentUser) return;
    try {
      setActionLoading(true);
      setActionError(null);
      
      if (action === 'APPROVED' && hasBudgetOverrun && (!approvalComment || approvalComment.trim() === '')) {
        throw new Error('An approval comment is required because this Purchase Order exceeds the BOQ system budget.');
      }
      
      await processApproval(activeStage, action, approvalComment, currentUser.id);
      setApprovalComment('');
    } catch (err: any) {
      setActionError(err.message || 'Failed to process approval.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelPO = async () => {
    if (!cancelReason.trim()) return;
    try {
      setActionLoading(true);
      setActionError(null);
      await cancelPO(cancelReason);
      setShowCancelModal(false);
      setCancelReason('');
    } catch (err: any) {
      setActionError(err.message || 'Failed to cancel PO.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCloseShort = async () => {
    if (!closeReason.trim()) return;
    try {
      setActionLoading(true);
      setActionError(null);
      await closeShortPO(closeReason);
      setShowCloseModal(false);
      setCloseReason('');
    } catch (err: any) {
      setActionError(err.message || 'Failed to close PO.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRevise = async () => {
    if (!window.confirm('Are you sure you want to create a new revision of this LPO? This will deprecate the current LPO and create a new draft copy.')) {
      return;
    }
    try {
      setActionLoading(true);
      setActionError(null);
      const newDraftId = await revisePO();
      router.push(`/procurement/po/create?revise_id=${newDraftId}`); // redirect to create/edit draft
    } catch (err: any) {
      setActionError(err.message || 'Failed to create PO revision.');
      setActionLoading(false);
    }
  };

  const handleSendPO = async () => {
    try {
      setActionLoading(true);
      setActionError(null);
      await sendPO();
    } catch (err: any) {
      setActionError(err.message || 'Failed to mark PO as Sent.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAcknowledgePO = async () => {
    if (!ackReference.trim()) return;
    try {
      setActionLoading(true);
      setActionError(null);
      await acknowledgePO(ackReference, ackDate || undefined);
      setShowAckModal(false);
      setAckReference('');
      setAckDate('');
    } catch (err: any) {
      setActionError(err.message || 'Failed to acknowledge PO.');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="comp-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          <div className="spinner" style={{ margin: '0 auto 1rem auto' }}></div>
          <p style={{ color: 'var(--text-secondary)' }}>Loading Purchase Order details...</p>
        </div>
      </div>
    );
  }

  if (error || !po) {
    return (
      <div className="comp-container">
        <div className="quote-card" style={{ padding: '2rem', textAlign: 'center', color: '#ef4444' }}>
          <AlertCircle size={36} style={{ margin: '0 auto 0.8rem auto' }} />
          <p>Error loading Purchase Order sheet: {error?.message || 'LPO not found.'}</p>
          <Link href="/procurement/po" className="quote-btn quote-btn-secondary" style={{ marginTop: '1rem', display: 'inline-flex' }}>
            Back to Registry
          </Link>
        </div>
      </div>
    );
  }

  const badgeColors = PO_STATUS_COLORS[po.status] || { bg: 'var(--surface-hover)', text: '#fff', border: 'var(--border)' };

  return (
    <div className="comp-container">
      {/* Header */}
      <header className="comp-header" style={{ marginBottom: '1.2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Link href="/procurement/po" className="quote-btn quote-btn-secondary" style={{ padding: '0.5rem' }}>
            <ArrowLeft size={16} />
          </Link>
          <div>
            <h1 className="comp-header-title" style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
              {po.po_number || 'DRAFT PURCHASE ORDER'}{' '}
              <span 
                style={{
                  padding: '0.2rem 0.6rem',
                  borderRadius: '4px',
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  background: badgeColors.bg,
                  color: badgeColors.text,
                  border: `1px solid ${badgeColors.border}`,
                  textTransform: 'uppercase'
                }}
              >
                {PO_STATUS_LABELS[po.status]}
              </span>
            </h1>
            <p className="comp-header-subtitle">
              Prepared by: {po.creator_name || 'System'} | Created Date: {new Date(po.created_at).toLocaleDateString('en-GB')}
            </p>
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: '0.6rem' }}>
          {/* Action Row */}
          <button className="quote-btn quote-btn-secondary" onClick={handleDownloadPDF}>
            <Download size={15} style={{ marginRight: '0.3rem' }} /> PDF Export
          </button>
          
          {po.status === 'DRAFT' && (
            <>
              <Link href={`/procurement/po/create?po_id=${po.id}`} className="quote-btn quote-btn-secondary">
                Edit LPO
              </Link>
              <button className="quote-btn quote-btn-primary" onClick={handleSubmit} disabled={actionLoading}>
                <Send size={15} style={{ marginRight: '0.3rem' }} /> Submit LPO
              </button>
            </>
          )}

          {po.status === 'APPROVED' && (
            <button className="quote-btn quote-btn-primary" style={{ background: '#10b981', borderColor: '#10b981', color: '#fff' }} onClick={handleSendPO} disabled={actionLoading}>
              <Send size={15} style={{ marginRight: '0.3rem' }} /> Mark officially Sent
            </button>
          )}

          {po.status === 'SENT' && (
            <button className="quote-btn quote-btn-primary" style={{ background: 'var(--accent)', borderColor: 'var(--accent)', color: '#000', fontWeight: 600 }} onClick={() => setShowAckModal(true)} disabled={actionLoading}>
              Acknowledge Receipt
            </button>
          )}

          {['APPROVED', 'SENT', 'ACKNOWLEDGED', 'PARTIALLY_DELIVERED'].includes(po.status) && (
            <button className="quote-btn quote-btn-secondary" style={{ background: 'rgba(168, 85, 247, 0.12)', color: '#a855f7', borderColor: 'rgba(168, 85, 247, 0.25)' }} onClick={handleRevise} disabled={actionLoading}>
              <RotateCcw size={15} style={{ marginRight: '0.3rem' }} /> Revise LPO
            </button>
          )}

          {['SENT', 'ACKNOWLEDGED', 'PARTIALLY_DELIVERED'].includes(po.status) && (
            <button className="quote-btn" style={{ background: 'rgba(249, 115, 22, 0.12)', color: '#f97316', border: '1px solid rgba(249, 115, 22, 0.25)' }} onClick={() => setShowCloseModal(true)}>
              Close Short
            </button>
          )}

          {!['CLOSED', 'DELIVERED', 'CANCELLED', 'SUPERSEDED'].includes(po.status) && (
            <button className="quote-btn" style={{ background: 'rgba(239, 68, 68, 0.12)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.25)' }} onClick={() => setShowCancelModal(true)}>
              <Ban size={15} style={{ marginRight: '0.3rem' }} /> Cancel LPO
            </button>
          )}
        </div>
      </header>

      {/* Action Error Alerts */}
      {actionError && (
        <div className="quote-card" style={{ borderLeft: '4px solid var(--error)', background: 'rgba(239, 68, 68, 0.05)', padding: '1rem', marginBottom: '1.2rem' }}>
          <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
            <AlertCircle size={18} style={{ color: 'var(--error)' }} />
            <span style={{ fontSize: '0.82rem', color: 'var(--text-primary)' }}>{actionError}</span>
          </div>
        </div>
      )}

      {/* Revision supersedes header banner */}
      {po.status === 'SUPERSEDED' && (
        <div className="quote-card" style={{ background: 'rgba(78, 70, 229, 0.05)', borderColor: 'rgba(78, 70, 229, 0.25)', padding: '1rem', marginBottom: '1.2rem' }}>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-primary)' }}>
            ⚠️ <strong>Revision Warning:</strong> This LPO has been superseded by a newer revision. Refer to active revisions or draft updates in the registry logs.
          </p>
        </div>
      )}

      {/* Grid details */}
      <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr', gap: '1.5rem', alignItems: 'start' }}>
        
        {/* Left column: LPO sheet */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Header metadata summary */}
          <div className="quote-card" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.2rem' }}>
            <div>
              <span className="quote-input-label">Supplier Contractor</span>
              <div style={{ fontWeight: 600, fontSize: '0.92rem', marginTop: '0.2rem' }}>{po.supplier_name}</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.1rem' }}>
                TRN: {po.supplier_trn || 'N/A'} <br /> Contact: {po.supplier_contact || 'N/A'}
              </div>
            </div>

            <div>
              <span className="quote-input-label">Project Allocation</span>
              <div style={{ fontWeight: 600, fontSize: '0.92rem', marginTop: '0.2rem' }}>
                {po.po_type === 'OVERHEAD' ? 'OVERHEAD / ADMINISTRATIVE' : `${po.project_name} (${po.project_number})`}
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.1rem' }}>
                Type: {PO_TYPE_LABELS[po.po_type]}
              </div>
            </div>

            <div>
              <span className="quote-input-label">Delivery Coordinates</span>
              <div style={{ fontSize: '0.82rem', marginTop: '0.2rem' }}>
                Date: {po.required_delivery_date ? new Date(po.required_delivery_date).toLocaleDateString('en-GB') : po.promised_delivery_days ? `${po.promised_delivery_days} Days from LPO` : 'Immediate'}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '0.1rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                Address: {po.delivery_address || 'As specified on delivery notes'}
              </div>
            </div>

            <div>
              <span className="quote-input-label">Payment terms</span>
              <div style={{ fontSize: '0.82rem', marginTop: '0.2rem', fontWeight: 600 }}>{po.payment_terms_text || `${po.payment_terms_days} Days Net`}</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '0.1rem' }}>
                Currency: {po.currency} (Exchange: {po.exchange_rate})
              </div>
            </div>
          </div>

          {/* Justification check */}
          {po.no_comparison_justification && (
            <div className="quote-card" style={{ borderLeft: '4px solid var(--warning)', background: 'rgba(245,158,11,0.03)' }}>
              <h4 style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.3rem' }}>Comparison Sheet Waiver Justification</h4>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>"{po.no_comparison_justification}"</p>
            </div>
          )}

          {/* Items detailed grid */}
          <div className="quote-card">
            <h3 className="quote-card-title" style={{ marginBottom: '1rem' }}>Material / Service Specifications</h3>
            
            <div className="quote-table-wrap">
              <table className="quote-table">
                <thead>
                  <tr>
                    <th style={{ width: '40px' }}>No</th>
                    <th>Item Description</th>
                    <th>Brand</th>
                    <th style={{ width: '60px' }}>Unit</th>
                    <th style={{ width: '80px', textAlign: 'right' }}>Ordered Qty</th>
                    <th style={{ width: '80px', textAlign: 'right' }}>Received</th>
                    <th style={{ width: '80px', textAlign: 'right' }}>Rejected</th>
                    <th style={{ width: '100px', textAlign: 'right' }}>Unit Cost</th>
                    <th style={{ width: '80px', textAlign: 'right' }}>Discount %</th>
                    <th style={{ width: '110px', textAlign: 'right' }}>Line Total (AED)</th>
                  </tr>
                </thead>
                <tbody>
                  {po.items?.map((item, idx) => (
                    <tr key={item.id}>
                      <td style={{ textAlign: 'center', fontWeight: 600 }}>{item.line_no}</td>
                      <td>
                        <div style={{ fontWeight: 500 }}>{item.description}</div>
                        {item.item_code && <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>Code: {item.item_code}</div>}
                      </td>
                      <td>{item.brand || '-'}</td>
                      <td>{item.unit}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>{item.quantity}</td>
                      <td style={{ textAlign: 'right', color: item.qty_received > 0 ? 'var(--primary)' : 'inherit' }}>{item.qty_received}</td>
                      <td style={{ textAlign: 'right', color: item.qty_rejected > 0 ? 'var(--error)' : 'inherit' }}>{item.qty_rejected}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{item.unit_price.toFixed(2)}</td>
                      <td style={{ textAlign: 'right' }}>{item.discount_pct}%</td>
                      <td style={{ textAlign: 'right', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{item.line_total.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Subtotals footer */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.2rem' }}>
              <div style={{ width: '250px', display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.85rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Subtotal:</span>
                  <span style={{ fontFamily: 'var(--font-mono)' }}>{po.subtotal.toFixed(2)} AED</span>
                </div>
                {po.discount_amount > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#ef4444' }}>
                    <span>Discount:</span>
                    <span style={{ fontFamily: 'var(--font-mono)' }}>-{po.discount_amount.toFixed(2)} AED</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>VAT (5%):</span>
                  <span style={{ fontFamily: 'var(--font-mono)' }}>{po.vat_amount.toFixed(2)} AED</span>
                </div>
                <hr style={{ border: 'none', borderBottom: '1px solid var(--border-color)', margin: '0.2rem 0' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.98rem', fontWeight: 700 }}>
                  <span style={{ color: 'var(--primary)' }}>Grand Total:</span>
                  <span style={{ color: 'var(--primary)', fontFamily: 'var(--font-mono)' }}>{po.total.toFixed(2)} AED</span>
                </div>
              </div>
            </div>
          </div>

          {/* Delivery notes / GRN History */}
          <div className="quote-card">
            <h3 className="quote-card-title" style={{ marginBottom: '1rem' }}>Linked Deliveries & Receipts (GRN)</h3>
            {grns.length === 0 ? (
              <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                <Truck size={24} style={{ margin: '0 auto 0.5rem auto', opacity: 0.3 }} />
                No goods receipt notes recorded against this purchase order yet.
              </div>
            ) : (
              <div className="quote-table-wrap">
                <table className="quote-table" style={{ fontSize: '0.78rem' }}>
                  <thead>
                    <tr>
                      <th>GRN Number</th>
                      <th>Receipt Date</th>
                      <th>Delivery Note Ref</th>
                      <th>Received By</th>
                      <th>Location</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {grns.map(g => (
                      <tr key={g.id}>
                        <td style={{ fontWeight: 600, color: 'var(--secondary)' }}>{g.grn_number}</td>
                        <td>{new Date(g.received_at).toLocaleDateString('en-GB')}</td>
                        <td>{g.delivery_note_ref}</td>
                        <td>{g.receiver_name}</td>
                        <td>{g.location === 'SITE' ? 'Site' : 'Warehouse'}</td>
                        <td>
                          <span className={`c-badge c-badge-${g.status.toLowerCase()}`}>
                            {g.status}
                          </span>
                        </td>
                        <td>
                          <Link href={`/procurement/grn/${g.id}`} className="quote-btn quote-btn-secondary" style={{ padding: '0.2rem 0.5rem' }}>
                            Details <ChevronRight size={10} />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Right column: approvals check drawer */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Sign-off workbench card */}
          {activeStage && (
            <div className="quote-card" style={{ border: '1px solid rgba(0, 229, 160, 0.35)', background: 'rgba(0, 229, 160, 0.02)' }}>
              <h3 className="quote-card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--primary)' }}>
                <CheckCircle size={16} /> LPO Sign-Off Workbench
              </h3>
              
              <div style={{ margin: '1rem 0', padding: '0.8rem', background: 'var(--surface-hover)', borderRadius: '4px', border: '1px dashed var(--border-color)' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Active Approval Stage</div>
                <div style={{ fontSize: '0.98rem', fontWeight: 700, color: '#fff', marginTop: '0.2rem' }}>
                  {activeStage === 'COMMERCIAL' ? 'Commercial Manager' : 'General Manager Approval'}
                </div>
              </div>

              {canApprove ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                  {hasBudgetOverrun && (
                    <div style={{ padding: '0.8rem', background: 'rgba(239, 68, 68, 0.08)', borderRadius: '4px', border: '1px solid rgba(239, 68, 68, 0.25)', display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                      <AlertCircle size={16} style={{ color: 'var(--error)', flexShrink: 0, marginTop: '0.1rem' }} />
                      <div>
                        <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#f87171' }}>Budget Overrun Warning</div>
                        <ul style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', paddingLeft: '1rem', marginTop: '0.2rem', marginBlockEnd: 0 }}>
                          {budgetWarnings.map((warning, wIdx) => (
                            <li key={wIdx}>{warning}</li>
                          ))}
                        </ul>
                        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>
                          * An approval justification comment is required to sign off.
                        </div>
                      </div>
                    </div>
                  )}
                  <textarea
                    className="quote-filter-input"
                    style={{ width: '100%', minHeight: '60px', padding: '0.5rem', resize: 'none', fontSize: '0.82rem' }}
                    placeholder="Enter approval or rejection comment (optional)..."
                    value={approvalComment}
                    onChange={(e) => setApprovalComment(e.target.value)}
                  />
                  <div style={{ display: 'flex', gap: '0.6rem' }}>
                    <button 
                      className="quote-btn quote-btn-primary" 
                      style={{ flex: 1, padding: '0.5rem' }} 
                      onClick={() => handleSignOff('APPROVED')}
                      disabled={actionLoading}
                    >
                      Sign Off Approve
                    </button>
                    <button 
                      className="quote-btn" 
                      style={{ flex: 1, padding: '0.5rem', background: 'rgba(239, 68, 68, 0.12)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.25)' }}
                      onClick={() => handleSignOff('REJECTED')}
                      disabled={actionLoading}
                    >
                      Reject Draft
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', background: 'rgba(245, 158, 11, 0.05)', padding: '0.8rem', borderRadius: '4px', border: '1px solid rgba(245, 158, 11, 0.15)' }}>
                  <AlertCircle size={14} style={{ color: 'var(--warning)', flexShrink: 0, marginTop: '0.1rem' }} />
                  <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                    {isCreator 
                      ? 'You created this PO and are blocked by the self-approval safety guard from signing off.' 
                      : 'You do not have the required role privileges (Commercial/GM manager) to sign off approvals.'}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Workflow progress card */}
          <div className="quote-card">
            <h3 className="quote-card-title" style={{ marginBottom: '1rem' }}>Approval Workflow</h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Level 1: Commercial Manager */}
              <div style={{ display: 'flex', gap: '0.8rem' }}>
                {po.approvals?.some(app => app.stage === 'COMMERCIAL' && app.action === 'APPROVED') ? (
                  <CheckCircle size={16} style={{ color: 'var(--primary)', flexShrink: 0, marginTop: '0.1rem' }} />
                ) : (
                  <div style={{ width: '16px', height: '16px', borderRadius: '50%', border: '2px solid var(--text-muted)', flexShrink: 0, marginTop: '0.1rem' }} />
                )}
                <div>
                  <div style={{ fontSize: '0.82rem', fontWeight: 600 }}>Commercial Manager Sign-off</div>
                  {po.approvals?.filter(app => app.stage === 'COMMERCIAL').map(app => (
                    <div key={app.id} style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '0.1rem' }}>
                      {app.action === 'APPROVED' ? 'Approved' : 'Rejected'} by {app.approver_name} <br />
                      {app.comment && <span style={{ fontStyle: 'italic' }}>"{app.comment}"</span>}
                    </div>
                  ))}
                </div>
              </div>

              {/* Level 2: General Manager (if required) */}
              {Number(po.total) > 50000.00 && (
                <div style={{ display: 'flex', gap: '0.8rem' }}>
                  {po.approvals?.some(app => app.stage === 'GM' && app.action === 'APPROVED') ? (
                    <CheckCircle size={16} style={{ color: 'var(--primary)', flexShrink: 0, marginTop: '0.1rem' }} />
                  ) : (
                    <div style={{ width: '16px', height: '16px', borderRadius: '50%', border: '2px solid var(--text-muted)', flexShrink: 0, marginTop: '0.1rem' }} />
                  )}
                  <div>
                    <div style={{ fontSize: '0.82rem', fontWeight: 600 }}>General Manager Approval</div>
                    {po.approvals?.filter(app => app.stage === 'GM').map(app => (
                      <div key={app.id} style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '0.1rem' }}>
                        {app.action === 'APPROVED' ? 'Approved' : 'Rejected'} by {app.approver_name} <br />
                        {app.comment && <span style={{ fontStyle: 'italic' }}>"{app.comment}"</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Budget impact of approving this PO (renders only when the project
              has a budget + the guard migration is applied). Additive, read-only. */}
          <ProjectBudgetCard
            projectId={(po as any).project_id}
            previewAmount={Number(po.total) || 0}
            excludePoId={poId}
            previewLabel="If this PO is approved"
          />

          {/* Configurable workflow (Admin Center → Workflows). Renders only
              when an active workflow is configured for the PO module. */}
          <WorkflowPanel
            moduleKey="PO"
            entityId={poId}
            context={{
              total: Number(po.total),
              status: po.status,
              supplier_name: po.supplier_name,
              po_type: po.po_type,
            }}
            onStatusChange={() => refetch()}
          />

          {/* Supplier Proforma Invoice */}
          <div className="quote-card">
            <h3 className="quote-card-title" style={{ marginBottom: '0.6rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <FileText size={16} /> Supplier Proforma Invoice
            </h3>
            {(po as any).proforma_invoice_path ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.6rem', background: 'rgba(16, 185, 129, 0.06)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '6px', padding: '0.6rem 0.8rem' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {(po as any).proforma_invoice_name || 'Proforma Invoice'}
                    </div>
                    {(po as any).proforma_invoice_uploaded_at && (
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                        Uploaded {new Date((po as any).proforma_invoice_uploaded_at).toLocaleDateString('en-AE')}
                      </div>
                    )}
                  </div>
                  <button className="quote-btn quote-btn-secondary" style={{ flexShrink: 0, padding: '0.4rem 0.7rem' }} onClick={handleDownloadProforma}>
                    <Download size={13} /> Open
                  </button>
                </div>
                <label className="quote-btn quote-btn-secondary" style={{ cursor: 'pointer', justifyContent: 'center' }}>
                  {proformaUploading ? 'Uploading…' : 'Replace Proforma'}
                  <input type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" style={{ display: 'none' }} disabled={proformaUploading}
                    onChange={e => e.target.files?.[0] && handleUploadProforma(e.target.files[0])} />
                </label>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                <p style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                  Attach the supplier&apos;s proforma invoice issued against this LPO. It will be stored with the order and can be reviewed and exported.
                </p>
                <label className="quote-btn quote-btn-primary" style={{ cursor: 'pointer', justifyContent: 'center' }}>
                  {proformaUploading ? 'Uploading…' : <><Upload size={13} /> Upload Proforma Invoice</>}
                  <input type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" style={{ display: 'none' }} disabled={proformaUploading}
                    onChange={e => e.target.files?.[0] && handleUploadProforma(e.target.files[0])} />
                </label>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Cancel Modal */}
      {showCancelModal && (
        <div className="quote-modal-overlay">
          <div className="quote-modal" style={{ maxWidth: '400px' }}>
            <div className="quote-modal-header">
              <h3 className="quote-card-title">Cancel Purchase Order</h3>
              <button className="quote-btn" style={{ background: 'transparent', fontSize: '1.2rem', color: '#fff' }} onClick={() => setShowCancelModal(false)}>
                &times;
              </button>
            </div>
            <div className="quote-modal-body">
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '0.8rem' }}>
                Provide cancellation remarks. This will withdraw the committed costs from budget indicators.
              </p>
              <textarea
                className="quote-filter-input"
                style={{ width: '100%', minHeight: '80px', padding: '0.5rem', resize: 'none' }}
                placeholder="Reason for cancellation..."
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
              />
              <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
                <button className="quote-btn quote-btn-secondary" onClick={() => setShowCancelModal(false)}>Dismiss</button>
                <button className="quote-btn" style={{ background: '#ef4444', color: '#fff' }} onClick={handleCancelPO} disabled={actionLoading}>Confirm Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Close Short Modal */}
      {showCloseModal && (
        <div className="quote-modal-overlay">
          <div className="quote-modal" style={{ maxWidth: '400px' }}>
            <div className="quote-modal-header">
              <h3 className="quote-card-title">Close LPO Short</h3>
              <button className="quote-btn" style={{ background: 'transparent', fontSize: '1.2rem', color: '#fff' }} onClick={() => setShowCloseModal(false)}>
                &times;
              </button>
            </div>
            <div className="quote-modal-body">
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '0.8rem' }}>
                Close this PO short (no further deliveries expected). Remaining ordered quantities will be marked as CLOSED_SHORT.
              </p>
              <textarea
                className="quote-filter-input"
                style={{ width: '100%', minHeight: '80px', padding: '0.5rem', resize: 'none' }}
                placeholder="Reason for closing LPO short..."
                value={closeReason}
                onChange={(e) => setCloseReason(e.target.value)}
              />
              <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
                <button className="quote-btn quote-btn-secondary" onClick={() => setShowCloseModal(false)}>Dismiss</button>
                <button className="quote-btn" style={{ background: 'var(--warning)', color: '#000' }} onClick={handleCloseShort} disabled={actionLoading}>Confirm Close</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Acknowledge LPO Modal */}
      {showAckModal && (
        <div className="quote-modal-overlay">
          <div className="quote-modal" style={{ maxWidth: '400px' }}>
            <div className="quote-modal-header">
              <h3 className="quote-card-title">Record Supplier Acknowledgment</h3>
              <button className="quote-btn" style={{ background: 'transparent', fontSize: '1.2rem', color: '#fff' }} onClick={() => setShowAckModal(false)}>
                &times;
              </button>
            </div>
            <div className="quote-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                Please enter the supplier's acknowledgment reference (e.g. Sales Order number, signed LPO date, or supplier email ref).
              </p>
              <div>
                <label className="quote-input-label">Acknowledgment Reference *</label>
                <input
                  type="text"
                  className="quote-filter-input"
                  style={{ width: '100%' }}
                  placeholder="ex: SO-10293"
                  value={ackReference}
                  onChange={(e) => setAckReference(e.target.value)}
                />
              </div>
              <div>
                <label className="quote-input-label">Acknowledgment Date</label>
                <input
                  type="date"
                  className="quote-filter-input"
                  style={{ width: '100%' }}
                  value={ackDate}
                  onChange={(e) => setAckDate(e.target.value)}
                />
              </div>
              <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
                <button className="quote-btn quote-btn-secondary" onClick={() => setShowAckModal(false)}>Dismiss</button>
                <button className="quote-btn quote-btn-primary" onClick={handleAcknowledgePO} disabled={actionLoading || !ackReference.trim()}>Save Acknowledgment</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
