// ============================================================
// JEET ERP — General Manager Sign-Off and Approval Workbench
// Routes: /procurement/comparisons/:id/approve
// ============================================================

'use client';

import { useState, useEffect, useRef, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { 
  ArrowLeft, 
  Check, 
  X, 
  FileText, 
  Layers, 
  Calendar,
  AlertCircle,
  TrendingUp,
  ShieldAlert,
  Edit3
} from 'lucide-react';
import { useComparison } from '@/hooks/useComparisons';
import '../../comparisons.css';

const fmtAED = (v: number) => {
  return 'AED ' + new Intl.NumberFormat('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
};

export default function GMApprovalPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id } = use(params);

  const { comparison, loading, error, actions } = useComparison(id);
  const [comment, setComment] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [currentProfile, setCurrentProfile] = useState<any>(null);

  // Signature canvas refs
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSigned, setHasSigned] = useState(false);

  // Check user role (Must be admin/GM)
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

  // Initialize Canvas
  useEffect(() => {
    if (canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.strokeStyle = '#00E5A0'; // Electric mint signature ink
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
      }
    }
  }, [loading]);

  if (loading) {
    return (
      <div className="comp-container" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div className="spinner"></div>
        <p style={{ marginTop: '1rem', color: 'var(--text-secondary)' }}>Loading approval details...</p>
      </div>
    );
  }

  if (error || !comparison) {
    return (
      <div className="comp-container">
        <div className="quote-card" style={{ borderColor: 'rgba(239, 68, 68, 0.3)', background: 'rgba(239, 68, 68, 0.08)', textAlign: 'center', padding: '3rem' }}>
          <AlertCircle size={48} style={{ color: '#ef4444', margin: '0 auto 1rem auto' }} />
          <p>Comparison details could not be loaded.</p>
          <Link href="/procurement/comparisons" className="quote-btn quote-btn-secondary" style={{ marginTop: '1.5rem' }}>
            Back to Registry
          </Link>
        </div>
      </div>
    );
  }

  // Ensure authorized (Admin/GM)
  const isAuthorized = currentProfile?.role === 'admin';
  if (currentProfile && !isAuthorized) {
    return (
      <div className="comp-container">
        <div className="quote-card" style={{ borderColor: 'rgba(239, 68, 68, 0.3)', background: 'rgba(239, 68, 68, 0.08)', textAlign: 'center', padding: '3rem' }}>
          <AlertCircle size={48} style={{ color: '#ef4444', margin: '0 auto 1rem auto' }} />
          <h2 style={{ fontSize: '1.4rem', marginBottom: '1rem' }}>Unauthorized Access</h2>
          <p style={{ color: 'var(--text-secondary)' }}>Only the General Manager can perform final approvals and signature sign-offs.</p>
          <Link href={`/procurement/comparisons/${id}`} className="quote-btn quote-btn-secondary" style={{ marginTop: '1.5rem' }}>
            Back to Details
          </Link>
        </div>
      </div>
    );
  }

  // Signature Canvas Drawing Logic
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setIsDrawing(true);
    const pos = getMousePos(canvas, e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const pos = getMousePos(canvas, e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    setHasSigned(true);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSigned(false);
  };

  const getMousePos = (canvas: HTMLCanvasElement, e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  };

  // Submit Approval
  const handleApprove = async () => {
    if (!hasSigned) {
      alert('Your signature is required to approve this supplier comparison sheet.');
      return;
    }
    try {
      setActionLoading(true);
      const canvas = canvasRef.current;
      const signatureDataUrl = canvas ? canvas.toDataURL() : '';
      
      // We append the signature base64 image identifier in the comment string for rendering in PDFs
      const finalComment = `[SIGNATURE:${signatureDataUrl}] ${comment || 'Approved by General Manager'}`;

      await actions.gmApprove(finalComment);
      alert('Comparison sheet successfully approved and locked!');
      router.push(`/procurement/comparisons/${id}`);
    } catch (err: any) {
      alert('Approval failed: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Reject / Return to Draft
  const handleReject = async () => {
    if (!comment) {
      alert('A comment specifying the rejection reason is required.');
      return;
    }
    try {
      setActionLoading(true);
      await actions.gmReject(comment);
      alert('Supplier comparison sheet has been rejected and returned to draft.');
      router.push(`/procurement/comparisons/${id}`);
    } catch (err: any) {
      alert('Rejection failed: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const overriddenItems = comparison.items.filter((i: any) => !i.selection_matches_recommendation);
  const exceptionItems = comparison.items.filter((i: any) => i.is_exception);

  return (
    <div className="comp-container">
      {/* Header */}
      <header className="comp-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Link href={`/procurement/comparisons/${id}`} className="quote-btn quote-btn-secondary" style={{ padding: '0.4rem 0.6rem' }}>
            <ArrowLeft size={16} />
          </Link>
          <div>
            <h1 className="comp-header-title">GM Final Sign-Off: {comparison.comparison_number}</h1>
            <p className="comp-header-subtitle">General Manager review workbench for major supplier awards (Exceeds AED {Number(comparison.approval_threshold).toLocaleString()})</p>
          </div>
        </div>
      </header>

      {/* Main Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem', alignItems: 'start', marginBottom: '80px' }}>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* GM Attention Alert */}
          <div className="quote-card" style={{ borderColor: 'rgba(239, 68, 68, 0.4)', background: 'rgba(239, 68, 68, 0.05)' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#ef4444', fontWeight: 700, fontSize: '1.1rem' }}>
              <ShieldAlert size={20} /> GM Authorization Directive
            </h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '0.5rem', lineHeight: '1.4' }}>
              This comparison sheet represents a total procured value of <strong>{fmtAED(comparison.total_selected_supplier_cost)}</strong>.
              Please inspect the margin profile, review the justification comments for any bypassed recommended suppliers, and sign the canvas to seal the purchase authorization.
            </p>
          </div>

          {/* Overrides Table */}
          <div className="quote-card">
            <h3 className="quote-card-title"><AlertCircle size={18} style={{ color: 'var(--warning)' }} /> Supplier Recommendation Overrides ({overriddenItems.length})</h3>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>Line items where procurement bypassed the recommended best scored supplier.</p>
            
            {overriddenItems.length === 0 ? (
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '1rem', fontStyle: 'italic' }}>No overrides. Best scored options were selected for all items.</p>
            ) : (
              <div className="quote-table-wrap" style={{ marginTop: '1rem' }}>
                <table className="quote-table">
                  <thead>
                    <tr>
                      <th>Description</th>
                      <th>Qty</th>
                      <th>Chosen Supplier</th>
                      <th style={{ textAlign: 'right' }}>Cost Impact</th>
                      <th>Override Reason / Justification</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overriddenItems.map((item: any) => {
                      const selectedOffer = (item.offers || []).find((o: any) => o.id === item.selected_supplier_offer_id);
                      return (
                        <tr key={item.id}>
                          <td style={{ fontWeight: 600 }}>{item.description}</td>
                          <td>{item.quantity} {item.unit}</td>
                          <td style={{ color: 'var(--warning)' }}>{selectedOffer?.supplier_name || 'N/A'}</td>
                          <td style={{ textAlign: 'right', fontWeight: 600, color: '#f59e0b' }}>+{fmtAED(item.override_cost_impact)}</td>
                          <td style={{ fontStyle: 'italic', fontSize: '0.78rem' }}>"{item.override_reason}"</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Exceptions Table */}
          <div className="quote-card">
            <h3 className="quote-card-title"><Calendar size={18} style={{ color: 'var(--warning)' }} /> Procurement Exceptions ({exceptionItems.length})</h3>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>Line items submitted with fewer than 3 compliant offers.</p>
            
            {exceptionItems.length === 0 ? (
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '1rem', fontStyle: 'italic' }}>No exceptions. All items meet the 3-offer minimum requirement.</p>
            ) : (
              <div className="quote-table-wrap" style={{ marginTop: '1rem' }}>
                <table className="quote-table">
                  <thead>
                    <tr>
                      <th>Description</th>
                      <th style={{ textAlign: 'center' }}>Compliant Offers</th>
                      <th>Selected Supplier</th>
                      <th>Exception Justification</th>
                    </tr>
                  </thead>
                  <tbody>
                    {exceptionItems.map((item: any) => {
                      const selectedOffer = (item.offers || []).find((o: any) => o.id === item.selected_supplier_offer_id);
                      return (
                        <tr key={item.id}>
                          <td style={{ fontWeight: 600 }}>{item.description}</td>
                          <td style={{ textAlign: 'center', fontWeight: 700 }}>{item.compliant_offers_count}</td>
                          <td>{selectedOffer?.supplier_name || 'N/A'}</td>
                          <td style={{ fontStyle: 'italic', fontSize: '0.78rem' }}>"{item.exception_reason}"</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Commercial Review Log */}
          <div className="quote-card">
            <h3 className="quote-card-title"><FileText size={18} /> Commercial Manager Audit comments</h3>
            <div style={{ marginTop: '1rem', fontSize: '0.82rem', color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '0.72rem', marginBottom: '0.4rem' }}>
                <span>Reviewer: {comparison.commercial_approver_id ? 'Commercial Manager' : 'N/A'}</span>
                <span>Date: {comparison.commercial_approved_at ? new Date(comparison.commercial_approved_at).toLocaleDateString('en-GB') : '-'}</span>
              </div>
              <p style={{ fontStyle: 'italic', color: '#00E5A0', fontSize: '0.88rem' }}>
                "{comparison.commercial_comment || 'No review comments logged.'}"
              </p>
            </div>
          </div>

        </div>

        {/* Right Panel: Totals & Signature pad */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', position: 'sticky', top: '20px' }}>
          
          {/* Procurement Margins */}
          <div className="quote-card">
            <h3 className="quote-card-title"><TrendingUp size={16} /> Award Financial Profile</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', marginTop: '1.2rem', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>BOQ Budget Total:</span>
                <span style={{ fontWeight: 600 }}>{fmtAED(comparison.total_boq_material_cost)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Selected Supplier Cost:</span>
                <span style={{ fontWeight: 600, color: '#00E5A0' }}>{fmtAED(comparison.total_selected_supplier_cost)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '0.6rem' }}>
                <span>Procurement Savings:</span>
                <span style={{ fontWeight: 700, color: '#22d3ee' }}>{fmtAED(comparison.total_savings_vs_boq)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Savings Percentage:</span>
                <span style={{ fontWeight: 600 }}>{comparison.total_savings_pct.toFixed(1)}%</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '0.6rem' }}>
                <span>Project Sold Revenue:</span>
                <span style={{ fontWeight: 600 }}>{fmtAED(comparison.total_quotation_material_revenue)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Overall Margin:</span>
                <span style={{ fontWeight: 700, color: comparison.overall_margin_pct >= comparison.target_margin_pct ? '#10b981' : '#ef4444' }}>
                  {comparison.overall_margin_pct.toFixed(2)}%
                </span>
              </div>
            </div>
          </div>

          {/* Signature canvas card */}
          <div className="quote-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h3 className="quote-card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Edit3 size={16} /> Draw GM Signature
            </h3>
            
            <div style={{ border: '2px dashed rgba(255,255,255,0.15)', borderRadius: '8px', background: '#02040a', overflow: 'hidden' }}>
              <canvas
                ref={canvasRef}
                width={300}
                height={150}
                style={{ display: 'block', cursor: 'crosshair', width: '100%' }}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                {hasSigned ? '✓ Signature captured' : 'Draw signature inside box'}
              </span>
              <button 
                className="quote-btn quote-btn-secondary" 
                style={{ padding: '0.2rem 0.5rem', fontSize: '0.72rem' }}
                onClick={clearSignature}
              >
                Clear Pad
              </button>
            </div>

            <div className="quote-form-group" style={{ marginTop: '0.5rem' }}>
              <label>Rejection / Condition comments</label>
              <textarea 
                className="quote-form-textarea" 
                placeholder="Type comment or conditions..." 
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
              />
            </div>

            <button 
              className="quote-btn quote-btn-primary" 
              style={{ width: '100%', justifyContent: 'center' }}
              disabled={actionLoading}
              onClick={handleApprove}
            >
              Approve & Lock Sheet
            </button>
            
            <button 
              className="quote-btn quote-btn-danger" 
              style={{ width: '100%', justifyContent: 'center' }}
              disabled={actionLoading}
              onClick={handleReject}
            >
              Reject (Return to Draft)
            </button>
          </div>

        </div>

      </div>
    </div>
  );
}
