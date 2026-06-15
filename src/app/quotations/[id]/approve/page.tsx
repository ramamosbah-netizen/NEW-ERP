// ============================================================
// JEET ERP — General Manager Approval & Signing Page
// Routes: /quotations/:id/approve
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
  Settings, 
  AlertCircle,
  Edit2
} from 'lucide-react';
import { useQuotation } from '@/hooks/useQuotations';
import { quotationPDFService } from '@/lib/quotation-pdf';
import '../../quotations.css';

const fmtAED = (v: number) => {
  return 'AED ' + new Intl.NumberFormat('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
};

export default function GMApprovalPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id } = use(params);

  const { quotation, loading, error, actions } = useQuotation(id);
  const [comment, setComment] = useState('');
  const [signatureData, setSignatureData] = useState<string>('');
  const [actionLoading, setActionLoading] = useState(false);
  const [currentProfile, setCurrentProfile] = useState<any>(null);
  
  // Canvas drawing reference
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  // Check user role
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

  // Initialize canvas listeners
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.strokeStyle = '#6366f1'; // Premium indigo stroke
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
      }
    }
  }, [canvasRef.current]);

  if (loading) {
    return (
      <div className="quote-container" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div className="spinner"></div>
        <p style={{ marginTop: '1rem', color: 'var(--text-secondary)' }}>Loading approval panel...</p>
      </div>
    );
  }

  if (error || !quotation) {
    return (
      <div className="quote-container">
        <div className="quote-card" style={{ borderColor: 'rgba(239, 68, 68, 0.3)', background: 'rgba(239, 68, 68, 0.08)', textAlign: 'center', padding: '3rem' }}>
          <AlertCircle size={48} style={{ color: '#ef4444', margin: '0 auto 1rem auto' }} />
          <p>Quotation details could not be loaded.</p>
          <Link href="/quotations" className="quote-btn quote-btn-secondary" style={{ marginTop: '1.5rem' }}>
            Back to Registry
          </Link>
        </div>
      </div>
    );
  }

  // Enforce GM (admin role) authorization
  const isAuthorized = currentProfile?.role === 'admin';
  if (currentProfile && !isAuthorized) {
    return (
      <div className="quote-container">
        <div className="quote-card" style={{ borderColor: 'rgba(239, 68, 68, 0.3)', background: 'rgba(239, 68, 68, 0.08)', textAlign: 'center', padding: '3rem' }}>
          <AlertCircle size={48} style={{ color: '#ef4444', margin: '0 auto 1rem auto' }} />
          <h2 style={{ fontSize: '1.4rem', marginBottom: '1rem' }}>Unauthorized</h2>
          <p style={{ color: 'var(--text-secondary)' }}>Only General Managers can access and sign approvals on this workbench.</p>
          <Link href={`/quotations/${id}`} className="quote-btn quote-btn-secondary" style={{ marginTop: '1.5rem' }}>
            Back to Details
          </Link>
        </div>
      </div>
    );
  }

  // Canvas Drawing Methods
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    saveSignatureImage();
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setSignatureData('');
  };

  const saveSignatureImage = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const dataUrl = canvas.toDataURL('image/png');
      setSignatureData(dataUrl);
    }
  };

  // Saved presets select handler
  const handleSelectPresetSignature = (preset: string) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    clearCanvas();

    // Mock signature drawing on canvas
    ctx.beginPath();
    ctx.moveTo(30, 75);
    if (preset === 'gm_alt') {
      ctx.quadraticCurveTo(150, 20, 250, 75);
      ctx.quadraticCurveTo(80, 140, 100, 75);
      ctx.lineTo(280, 75);
    } else {
      // Standard signature squiggle
      ctx.quadraticCurveTo(100, 10, 150, 100);
      ctx.quadraticCurveTo(200, 10, 250, 80);
      ctx.lineTo(300, 50);
    }
    ctx.stroke();
    saveSignatureImage();
  };

  // Sign & Approve action
  const handleApprove = async () => {
    if (!signatureData) {
      alert('GM Signature is required to authorize the quotation.');
      return;
    }

    try {
      setActionLoading(true);
      // 1. Submit GM Approval with signature base64 reference
      await actions.gmApprove(comment || 'Approved & signed by GM', signatureData);

      // 2. Auto-generate the signed PDF and store it in Supabase Storage
      const pdfBlob = await quotationPDFService.generate(id);
      await quotationPDFService.upload(id, pdfBlob);

      alert('Quotation successfully approved, locked, and cached in Storage!');
      router.push(`/quotations/${id}`);
    } catch (err: any) {
      alert('Error finalizing GM approval: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReturn = async () => {
    try {
      setActionLoading(true);
      await actions.gmReject(comment || 'Returned by GM');
      alert('Quotation returned to Estimator.');
      router.push(`/quotations/${id}`);
    } catch (err: any) {
      alert('Error returning quotation: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="quote-container">
      {/* Header */}
      <header className="quote-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Link href={`/quotations/${id}`} className="quote-btn quote-btn-secondary" style={{ padding: '0.4rem 0.6rem' }}>
            <ArrowLeft size={16} />
          </Link>
          <div>
            <h1 className="quote-header-title">GM Authorization Dashboard: {quotation.quotation_number}</h1>
            <p className="quote-header-subtitle">Inspect totals and commercial review logs before final sign-off</p>
          </div>
        </div>
      </header>

      {/* Details Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem', alignItems: 'start', marginBottom: '160px' }}>
        
        {/* Read-Only Details */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Header Card */}
          <div className="quote-card">
            <h3 className="quote-card-title"><FileText size={18} /> Quotation overview</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
              <p><strong>Subject:</strong> {quotation.subject}</p>
              <p><strong>Client:</strong> {quotation.client_name}</p>
              <p><strong>Project Ref:</strong> {quotation.project_ref}</p>
              <p><strong>Quotation Date:</strong> {new Date(quotation.quotation_date).toLocaleDateString('en-GB')}</p>
              <p><strong>Valid Until:</strong> {new Date(quotation.valid_until).toLocaleDateString('en-GB')}</p>
              <p>
                <strong>BOQ Reference: </strong>
                <Link href={`/tenders/${quotation.project_id}/boq`} style={{ color: 'var(--secondary)', textDecoration: 'underline' }}>
                  View Original Finalized BOQ &rarr;
                </Link>
              </p>
            </div>
          </div>

          {/* Line Items */}
          <div className="quote-card">
            <h3 className="quote-card-title"><Layers size={18} /> Quotation Line Items</h3>
            <div className="quote-table-wrap" style={{ marginTop: '1rem' }}>
              <table className="quote-table">
                <thead>
                  <tr>
                    <th style={{ width: '40px' }}>No</th>
                    <th>Code</th>
                    <th>Description</th>
                    <th>System</th>
                    <th style={{ width: '50px' }}>Unit</th>
                    <th style={{ width: '60px', textAlign: 'right' }}>Qty</th>
                    <th style={{ width: '100px', textAlign: 'right' }}>Sell Price</th>
                    <th style={{ width: '70px', textAlign: 'right' }}>Disc %</th>
                    <th style={{ width: '100px', textAlign: 'right' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {quotation.lines.map((line: any, idx: number) => (
                    <tr key={line.id} style={{ opacity: line.is_optional ? 0.6 : 1, fontStyle: line.is_optional ? 'italic' : 'normal' }}>
                      <td>{line.is_optional ? '*' : idx + 1}</td>
                      <td>{line.item_code}</td>
                      <td>
                        {line.description}
                        {line.is_optional && <span style={{ color: 'var(--secondary)' }}> (OPTIONAL)</span>}
                      </td>
                      <td>{line.system}</td>
                      <td>{line.unit}</td>
                      <td style={{ textAlign: 'right' }}>{line.quantity}</td>
                      <td style={{ textAlign: 'right' }}>{fmtAED(line.unit_sell_price)}</td>
                      <td style={{ textAlign: 'right' }}>{line.discount_pct}%</td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmtAED(line.line_total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Terms */}
          <div className="quote-card">
            <h3 className="quote-card-title"><Settings size={18} /> Commercial Terms</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
              <p><strong>Payment Terms:</strong> {quotation.payment_terms || 'None'}</p>
              <p><strong>Delivery Period:</strong> {quotation.delivery_period || 'None'}</p>
              <p><strong>Warranty Terms:</strong> {quotation.warranty_terms || 'None'}</p>
              <p><strong>Terms & Conditions:</strong> {quotation.terms_and_conditions || 'None'}</p>
              <p><strong>Inclusions:</strong> {quotation.inclusions || 'None'}</p>
              <p><strong>Exclusions:</strong> {quotation.exclusions || 'None'}</p>
            </div>
          </div>
        </div>

        {/* Commercial Manager Comment & Totals */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', position: 'sticky', top: '20px' }}>
          
          {/* Totals */}
          <div className="quote-card">
            <h3 className="quote-card-title">Proposal Totals</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginTop: '1rem' }}>
              <div style={{ display: 'flex', justifySelf: 'space-between', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                <span>Subtotal (Excl. VAT):</span>
                <span>{fmtAED(quotation.subtotal_ex_vat)}</span>
              </div>
              {quotation.discount_amount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#ef4444' }}>
                  <span>Discount:</span>
                  <span>-{fmtAED(quotation.discount_amount)}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                <span>VAT (5%):</span>
                <span>{fmtAED(quotation.vat_amount)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.2rem', fontWeight: 700, color: 'var(--accent)', borderTop: '1px solid var(--surface-hover)', paddingTop: '0.6rem' }}>
                <span>Grand Total:</span>
                <span>{fmtAED(quotation.grand_total_with_vat)}</span>
              </div>
            </div>
          </div>

          {/* Review Comments */}
          <div className="quote-card">
            <h3 className="quote-card-title">Commercial Manager Audit</h3>
            <div style={{ marginTop: '0.8rem' }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Reviewed by: {quotation.commercial_reviewer_name || 'Commercial Reviewer'}</span>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.5rem', background: 'var(--surface-hover)', padding: '0.6rem', border: '1px solid var(--surface-hover)', borderRadius: '6px' }}>
                "{quotation.commercial_comment || 'Approved without comment.'}"
              </p>
            </div>
          </div>

        </div>
      </div>

      {/* Sticky Bottom Signing Console Panel */}
      <div 
        style={{ 
          position: 'fixed', 
          bottom: 0, 
          left: 0, 
          right: 0, 
          background: 'rgba(6, 8, 20, 0.98)', 
          backdropFilter: 'blur(16px)',
          borderTop: '1px solid var(--border)', 
          padding: '1.2rem 2rem', 
          zIndex: 100,
          boxShadow: '0 -10px 40px rgba(0,0,0,0.7)'
        }}
      >
        <div style={{ display: 'flex', gap: '2rem', maxWidth: '1800px', margin: '0 auto', alignItems: 'center' }}>
          
          {/* Approval Comment */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <label style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>GM Approval Comment</label>
            <textarea
              className="quote-form-textarea"
              style={{ minHeight: '60px', padding: '0.5rem' }}
              placeholder="Enter approval conditions or instructions..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
          </div>

          {/* Signature Panel */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', width: '300px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>GM Signature Pad</label>
              
              {/* Presets dropdown */}
              <select 
                className="quote-filter-input" 
                style={{ padding: '1px 5px', fontSize: '0.68rem', height: '20px' }} 
                onChange={(e) => handleSelectPresetSignature(e.target.value)}
              >
                <option value="">-- Presets --</option>
                <option value="gm_default">Signature squiggle</option>
                <option value="gm_alt">GM Calligraphy</option>
              </select>
            </div>

            <div className="sig-canvas-wrap">
              <canvas
                ref={canvasRef}
                width={300}
                height={150}
                className="sig-canvas"
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
              />
            </div>
            
            <div className="sig-buttons">
              <button className="quote-btn quote-btn-secondary" style={{ padding: '2px 8px', fontSize: '0.72rem' }} onClick={clearCanvas}>Clear</button>
            </div>
          </div>

          {/* Decision Buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', width: '200px' }}>
            <button 
              className="quote-btn quote-btn-primary" 
              style={{ width: '100%', justifyContent: 'center' }} 
              disabled={actionLoading} 
              onClick={handleApprove}
            >
              Approve & Sign Quote
            </button>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button 
                className="quote-btn quote-btn-danger" 
                style={{ flex: 1, padding: '0.5rem 0', fontSize: '0.75rem', justifyContent: 'center' }} 
                disabled={actionLoading} 
                onClick={handleReturn}
              >
                Return to review
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
