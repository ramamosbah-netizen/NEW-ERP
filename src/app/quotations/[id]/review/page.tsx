// ============================================================
// JEET ERP — Commercial Manager Review Page
// Routes: /quotations/:id/review
// ============================================================

'use client';

import { useState, useEffect, use } from 'react';
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
  HelpCircle,
  Settings
} from 'lucide-react';
import { useQuotation } from '@/hooks/useQuotations';
import '../../quotations.css';

const fmtAED = (v: number) => {
  return 'AED ' + new Intl.NumberFormat('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
};

export default function CommercialReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id } = use(params);

  const { quotation, loading, error, actions } = useQuotation(id);
  const [comment, setComment] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [currentProfile, setCurrentProfile] = useState<any>(null);

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

  if (loading) {
    return (
      <div className="quote-container" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div className="spinner"></div>
        <p style={{ marginTop: '1rem', color: 'var(--text-secondary)' }}>Loading review details...</p>
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

  // Ensure user is authorized (Commercial Manager / Admin)
  const isAuthorized = currentProfile?.role === 'manager' || currentProfile?.role === 'admin';
  if (currentProfile && !isAuthorized) {
    return (
      <div className="quote-container">
        <div className="quote-card" style={{ borderColor: 'rgba(239, 68, 68, 0.3)', background: 'rgba(239, 68, 68, 0.08)', textAlign: 'center', padding: '3rem' }}>
          <AlertCircle size={48} style={{ color: '#ef4444', margin: '0 auto 1rem auto' }} />
          <h2 style={{ fontSize: '1.4rem', marginBottom: '1rem' }}>Unauthorized Access</h2>
          <p style={{ color: 'var(--text-secondary)' }}>Only Commercial Managers and Administrators can perform reviews on this page.</p>
          <Link href={`/quotations/${id}`} className="quote-btn quote-btn-secondary" style={{ marginTop: '1.5rem' }}>
            Back to Details
          </Link>
        </div>
      </div>
    );
  }

  const handleApprove = async () => {
    try {
      setActionLoading(true);
      await actions.commercialApprove(comment || 'Approved by Commercial Manager');
      alert('Approved! Forwarded to General Manager.');
      router.push(`/quotations/${id}`);
    } catch (err: any) {
      alert('Error during approval: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReturn = async () => {
    if (!comment) {
      alert('A review comment is required to return/reject a quotation.');
      return;
    }
    try {
      setActionLoading(true);
      await actions.commercialReject(comment);
      alert('Quotation returned to DRAFT for Estimator corrections.');
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
            <h1 className="quote-header-title">Commercial Review: {quotation.quotation_number}</h1>
            <p className="quote-header-subtitle">Review headers, line totals, and terms before routing to GM</p>
          </div>
        </div>
      </header>

      {/* Details Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem', alignItems: 'start', marginBottom: '80px' }}>
        
        {/* Read-Only Details */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Header Card */}
          <div className="quote-card">
            <h3 className="quote-card-title"><FileText size={18} /> Quotation Overview</h3>
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
            {quotation.scope_summary && (
              <div style={{ marginTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '0.8rem' }}>
                <strong>Scope Summary:</strong>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.4rem' }}>{quotation.scope_summary}</p>
              </div>
            )}
          </div>

          {/* Line Items Table */}
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
          <div className="quote-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
            <h3 className="quote-card-title"><Settings size={18} /> Commercial Terms</h3>
            <div>
              <h5 style={{ color: 'var(--secondary)' }}>Payment Terms</h5>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>{quotation.payment_terms || 'None'}</p>
            </div>
            <div>
              <h5 style={{ color: 'var(--secondary)' }}>Delivery Period</h5>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>{quotation.delivery_period || 'None'}</p>
            </div>
            <div>
              <h5 style={{ color: 'var(--secondary)' }}>Warranty Terms</h5>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>{quotation.warranty_terms || 'None'}</p>
            </div>
            <div>
              <h5 style={{ color: 'var(--secondary)' }}>Terms & Conditions</h5>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.2rem', whiteSpace: 'pre-wrap' }}>{quotation.terms_and_conditions || 'None'}</p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '1rem' }}>
              <div>
                <h5 style={{ color: 'var(--text-muted)' }}>Exclusions</h5>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>{quotation.exclusions || 'None'}</p>
              </div>
              <div>
                <h5 style={{ color: 'var(--text-muted)' }}>Inclusions</h5>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>{quotation.inclusions || 'None'}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Totals & Notes Side Panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', position: 'sticky', top: '20px' }}>
          
          <div className="quote-card">
            <h3 className="quote-card-title">Proposal Financials</h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginTop: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
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
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.2rem', fontWeight: 700, color: '#00E5A0', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '0.6rem' }}>
                <span>Grand Total:</span>
                <span>{fmtAED(quotation.grand_total_with_vat)}</span>
              </div>
            </div>
          </div>

          <div className="quote-card">
            <h3 className="quote-card-title">Estimator Notes</h3>
            <div style={{ marginTop: '0.8rem' }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Prepared By: {quotation.prepared_by_name}</span>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.5rem', whiteSpace: 'pre-wrap' }}>
                {quotation.notes_internal || 'No internal estimator notes entered.'}
              </p>
            </div>
          </div>

        </div>
      </div>

      {/* Sticky Bottom Review Controls Panel */}
      <div 
        style={{ 
          position: 'fixed', 
          bottom: 0, 
          left: 0, 
          right: 0, 
          background: 'rgba(6, 8, 20, 0.95)', 
          backdropFilter: 'blur(12px)',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)', 
          padding: '1rem 2rem', 
          zIndex: 100,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}
      >
        <div style={{ display: 'flex', flex: 1, gap: '1rem', marginRight: '2rem' }}>
          <textarea
            className="quote-form-textarea"
            style={{ minHeight: '40px', flex: 1, padding: '0.5rem' }}
            placeholder="Enter review comments or reason for returning..."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', gap: '1rem' }}>
          <button 
            className="quote-btn quote-btn-danger" 
            disabled={actionLoading} 
            onClick={handleReturn}
          >
            <X size={14} /> Return to Estimator
          </button>
          <button 
            className="quote-btn quote-btn-primary" 
            disabled={actionLoading} 
            onClick={handleApprove}
          >
            <Check size={14} /> Approve & Forward to GM
          </button>
        </div>
      </div>
    </div>
  );
}
