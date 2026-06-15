// ============================================================
// JEET ERP — Commercial Manager Review Workbench
// Routes: /procurement/comparisons/:id/review
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
  TrendingUp,
  Award,
  DollarSign
} from 'lucide-react';
import { useComparison } from '@/hooks/useComparisons';
import '../../comparisons.css';

const fmtAED = (v: number) => {
  return 'AED ' + new Intl.NumberFormat('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
};

export default function CommercialReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id } = use(params);

  const { comparison, loading, error, actions } = useComparison(id);
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
      <div className="comp-container" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div className="spinner"></div>
        <p style={{ marginTop: '1rem', color: 'var(--text-secondary)' }}>Loading review details...</p>
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

  // Ensure authorized (Commercial Manager / Admin)
  const isAuthorized = currentProfile?.role === 'manager' || currentProfile?.role === 'admin';
  if (currentProfile && !isAuthorized) {
    return (
      <div className="comp-container">
        <div className="quote-card" style={{ borderColor: 'rgba(239, 68, 68, 0.3)', background: 'rgba(239, 68, 68, 0.08)', textAlign: 'center', padding: '3rem' }}>
          <AlertCircle size={48} style={{ color: '#ef4444', margin: '0 auto 1rem auto' }} />
          <h2 style={{ fontSize: '1.4rem', marginBottom: '1rem' }}>Unauthorized Access</h2>
          <p style={{ color: 'var(--text-secondary)' }}>Only Commercial Managers and Administrators can perform reviews on this page.</p>
          <Link href={`/procurement/comparisons/${id}`} className="quote-btn quote-btn-secondary" style={{ marginTop: '1.5rem' }}>
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
      
      const threshold = Number(comparison.approval_threshold) || 50000;
      const selectedCost = Number(comparison.total_selected_supplier_cost) || 0;

      if (selectedCost > threshold) {
        alert('Approved! Forwarded to General Manager for sign-off.');
      } else {
        alert('Approved! Comparison sheet finalized and locked.');
      }
      router.push(`/procurement/comparisons/${id}`);
    } catch (err: any) {
      alert('Error during approval: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReturn = async () => {
    if (!comment) {
      alert('A review comment is required to return a comparison sheet.');
      return;
    }
    try {
      setActionLoading(true);
      await actions.commercialReject(comment);
      alert('Comparison sheet returned to DRAFT for corrections.');
      router.push(`/procurement/comparisons/${id}`);
    } catch (err: any) {
      alert('Error returning sheet: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Filter out overridden items
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
            <h1 className="comp-header-title">Commercial Review: {comparison.comparison_number}</h1>
            <p className="comp-header-subtitle">Inspect margins, audit override justifications, and authorise supplier awards</p>
          </div>
        </div>
      </header>

      {/* Main Review Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem', alignItems: 'start', marginBottom: '80px' }}>
        
        {/* Summaries */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Overrides Table */}
          <div className="quote-card">
            <h3 className="quote-card-title"><AlertCircle size={18} style={{ color: 'var(--warning)' }} /> Supplier Recommendation Overrides ({overriddenItems.length})</h3>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>Line items where the recommended best supplier (Rank 1) was bypassed.</p>
            
            {overriddenItems.length === 0 ? (
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '1rem', fontStyle: 'italic' }}>No overrides registered. Procurement matches recommendation 100%.</p>
            ) : (
              <div className="quote-table-wrap" style={{ marginTop: '1rem' }}>
                <table className="quote-table">
                  <thead>
                    <tr>
                      <th>Description</th>
                      <th>Qty</th>
                      <th>Chosen Supplier</th>
                      <th>Unit Cost</th>
                      <th style={{ textAlign: 'right' }}>Cost Impact</th>
                      <th>Override Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overriddenItems.map((item: any) => {
                      // Fetch selected offer name
                      const selectedOffer = (item.offers || []).find((o: any) => o.id === item.selected_supplier_offer_id);
                      return (
                        <tr key={item.id}>
                          <td style={{ fontWeight: 600 }}>{item.description}</td>
                          <td>{item.quantity} {item.unit}</td>
                          <td style={{ color: 'var(--warning)' }}>{selectedOffer?.supplier_name || 'N/A'}</td>
                          <td>{fmtAED(item.selected_unit_cost)}</td>
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
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '1rem', fontStyle: 'italic' }}>No exceptions registered. Every item has at least 3 compliant offers.</p>
            ) : (
              <div className="quote-table-wrap" style={{ marginTop: '1rem' }}>
                <table className="quote-table">
                  <thead>
                    <tr>
                      <th>Description</th>
                      <th style={{ textAlign: 'center' }}>Compliant Offers</th>
                      <th>Chosen Supplier</th>
                      <th>Unit Cost</th>
                      <th>Exception Justification Reason</th>
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
                          <td>{fmtAED(item.selected_unit_cost)}</td>
                          <td style={{ fontStyle: 'italic', fontSize: '0.78rem' }}>"{item.exception_reason}"</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Core items list brief read-only */}
          <div className="quote-card">
            <h3 className="quote-card-title"><Layers size={18} /> Procured Supplier Cost Summary</h3>
            <div className="quote-table-wrap" style={{ marginTop: '1rem' }}>
              <table className="quote-table">
                <thead>
                  <tr>
                    <th>Item Description</th>
                    <th>Qty</th>
                    <th>Selected Supplier</th>
                    <th style={{ textAlign: 'right' }}>Procured Unit</th>
                    <th style={{ textAlign: 'right' }}>Procured Total</th>
                    <th style={{ textAlign: 'right' }}>Margin %</th>
                  </tr>
                </thead>
                <tbody>
                  {comparison.items.map((item: any) => {
                    const selectedOffer = (item.offers || []).find((o: any) => o.id === item.selected_supplier_offer_id);
                    return (
                      <tr key={item.id}>
                        <td>{item.description}</td>
                        <td>{item.quantity} {item.unit}</td>
                        <td style={{ fontWeight: 600, color: 'var(--accent)' }}>{selectedOffer?.supplier_name || 'N/A'}</td>
                        <td style={{ textAlign: 'right' }}>{fmtAED(item.selected_unit_cost)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmtAED(item.selected_total_cost)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>{item.item_margin_pct.toFixed(1)}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

        </div>

        {/* Totals panel & comment box */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', position: 'sticky', top: '20px' }}>
          
          {/* Financial details */}
          <div className="quote-card">
            <h3 className="quote-card-title"><TrendingUp size={16} /> Procured Margins</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', marginTop: '1.2rem', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>BOQ Budget Total:</span>
                <span style={{ fontWeight: 600 }}>{fmtAED(comparison.total_boq_material_cost)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Supplier Award Cost:</span>
                <span style={{ fontWeight: 600, color: 'var(--accent)' }}>{fmtAED(comparison.total_selected_supplier_cost)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--surface-hover)', paddingTop: '0.6rem' }}>
                <span>Procurement Savings:</span>
                <span style={{ fontWeight: 700, color: '#22d3ee' }}>{fmtAED(comparison.total_savings_vs_boq)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Savings Percentage:</span>
                <span style={{ fontWeight: 600 }}>{comparison.total_savings_pct.toFixed(1)}%</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--surface-hover)', paddingTop: '0.6rem' }}>
                <span>Overall Margin:</span>
                <span style={{ fontWeight: 700, color: comparison.overall_margin_pct >= comparison.target_margin_pct ? '#10b981' : '#ef4444' }}>
                  {comparison.overall_margin_pct.toFixed(2)}%
                </span>
              </div>
            </div>
          </div>

          {/* Comment & approve inputs */}
          <div className="quote-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h3 className="quote-card-title"><FileText size={16} /> Review Actions</h3>
            
            <div className="quote-form-group">
              <label>Review Comment / Return Reason</label>
              <textarea 
                className="quote-form-textarea" 
                placeholder="Specify conditions of approval, or return justifications..." 
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
            </div>

            <button 
              className="quote-btn quote-btn-primary" 
              style={{ width: '100%', justifyContent: 'center' }}
              disabled={actionLoading}
              onClick={handleApprove}
            >
              Approve Comparison Sheet
            </button>
            
            <button 
              className="quote-btn quote-btn-danger" 
              style={{ width: '100%', justifyContent: 'center' }}
              disabled={actionLoading}
              onClick={handleReturn}
            >
              Return to Procurement (Draft)
            </button>
          </div>

        </div>

      </div>
    </div>
  );
}
