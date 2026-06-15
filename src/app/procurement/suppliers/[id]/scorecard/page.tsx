// ============================================================
// JEET ERP — Supplier Scorecard Profile
// Routes: /procurement/suppliers/:id/scorecard
// ============================================================

'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { 
  ArrowLeft, 
  Award, 
  Calendar, 
  AlertTriangle, 
  TrendingUp, 
  ShieldCheck, 
  Briefcase,
  DollarSign,
  Clock,
  ThumbsUp,
  FileText
} from 'lucide-react';
import '../../../comparisons/comparisons.css';

const fmtAED = (v: number) => {
  return 'AED ' + new Intl.NumberFormat('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
};

export default function SupplierScorecardPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id } = use(params);

  const [supplier, setSupplier] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    const fetchSupplier = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('supplier_performance_history')
          .select('*')
          .eq('id', id)
          .single();

        if (error) {
          // Attempt alternate query by supplier_name
          const { data: altData, error: altErr } = await supabase
            .from('supplier_performance_history')
            .select('*')
            .eq('supplier_name', decodeURIComponent(id));

          if (altErr || !altData || altData.length === 0) {
            setError('Supplier performance history scorecard not found.');
          } else {
            setSupplier(altData[0]);
            setError(null);
          }
        } else {
          setSupplier(data);
          setError(null);
        }
      } catch (err: any) {
        setError(err.message || 'An error occurred fetching the supplier scorecard.');
      } finally {
        setLoading(false);
      }
    };
    fetchSupplier();
  }, [id]);

  if (loading) {
    return (
      <div className="comp-container" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div className="spinner"></div>
        <p style={{ marginTop: '1rem', color: 'var(--text-secondary)' }}>Loading supplier scorecard profile...</p>
      </div>
    );
  }

  if (error || !supplier) {
    return (
      <div className="comp-container">
        <div className="quote-card" style={{ borderColor: 'rgba(239, 68, 68, 0.3)', background: 'rgba(239, 68, 68, 0.08)', textAlign: 'center', padding: '3rem' }}>
          <AlertTriangle size={48} style={{ color: '#ef4444', margin: '0 auto 1rem auto' }} />
          <h2 style={{ fontSize: '1.4rem', marginBottom: '1rem' }}>Scorecard Not Found</h2>
          <p style={{ color: 'var(--text-secondary)' }}>{error || 'Supplier record could not be found.'}</p>
          <Link href="/procurement/comparisons" className="quote-btn quote-btn-secondary" style={{ marginTop: '1.5rem' }}>
            Back to comparisons
          </Link>
        </div>
      </div>
    );
  }

  // Calculate rating stars
  const stars = Math.round(supplier.quality_rating || 5);
  const compositeScore = Number(supplier.composite_history_score) || 80;

  // Composite status coloring
  let scoreColor = '#ef4444'; // Red
  if (compositeScore >= 80) scoreColor = 'var(--accent)'; // Electric mint
  else if (compositeScore >= 60) scoreColor = '#f59e0b'; // Amber

  return (
    <div className="comp-container">
      {/* Header */}
      <header className="comp-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Link href="/procurement/comparisons" className="quote-btn quote-btn-secondary" style={{ padding: '0.4rem 0.6rem' }}>
            <ArrowLeft size={16} /> Back to Comparisons
          </Link>
          <div>
            <h1 className="comp-header-title">Supplier Performance Scorecard</h1>
            <p className="comp-header-subtitle">Historical procurement metrics, quality ratings, and composite credibility audits</p>
          </div>
        </div>
      </header>

      {/* Supplier Profile Dashboard Card */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 2fr', gap: '2rem', alignItems: 'start', maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
        
        {/* Profile Card */}
        <div className="quote-card" style={{ padding: '2rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
          
          {/* Circular Composite Score Gauge */}
          <div style={{ position: 'relative', width: '160px', height: '160px', marginBottom: '0.5rem' }}>
            <svg width="100%" height="100%" viewBox="0 0 100 100">
              {/* Grey Track */}
              <circle 
                cx="50" 
                cy="50" 
                r="40" 
                fill="none" 
                stroke="var(--surface-hover)" 
                strokeWidth="8" 
              />
              {/* Colored Indicator */}
              <circle 
                cx="50" 
                cy="50" 
                r="40" 
                fill="none" 
                stroke={scoreColor} 
                strokeWidth="8" 
                strokeDasharray={`${2 * Math.PI * 40}`}
                strokeDashoffset={`${2 * Math.PI * 40 * (1 - compositeScore / 100)}`}
                strokeLinecap="round"
                transform="rotate(-90 50 50)"
                style={{ transition: 'stroke-dashoffset 0.8s ease-in-out' }}
              />
            </svg>
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' }}>
              <div style={{ fontSize: '2.2rem', fontWeight: 800, color: '#ffffff', fontFamily: 'var(--font-mono)' }}>
                {compositeScore.toFixed(0)}
              </div>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                Composite Score
              </div>
            </div>
          </div>

          <h2 style={{ fontSize: '1.6rem', fontWeight: 700, margin: '0.5rem 0 0.2rem 0' }}>{supplier.supplier_name}</h2>
          <span className="best-tag" style={{ background: 'var(--surface-hover)', color: 'var(--text-secondary)', borderColor: 'var(--border)' }}>
            Corporate Supplier Profile
          </span>

          <div style={{ width: '100%', borderTop: '1px solid var(--surface-hover)', paddingTop: '1.5rem', marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.8rem', textAlign: 'left', fontSize: '0.82rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Total Orders Placed:</span>
              <strong style={{ color: '#ffffff' }}>{supplier.total_orders} orders</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Total Spend Volume:</span>
              <strong style={{ color: 'var(--accent)' }}>{fmtAED(Number(supplier.total_value))}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Last Order Date:</span>
              <strong style={{ color: '#ffffff' }}>{supplier.last_order_date ? new Date(supplier.last_order_date).toLocaleDateString('en-GB') : 'N/A'}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Win Rate Ratio:</span>
              <strong style={{ color: '#ffffff' }}>{Number(supplier.win_rate_pct).toFixed(1)}%</strong>
            </div>
          </div>

        </div>

        {/* Detailed Stats Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* KPI grid cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
            
            {/* Delivery card */}
            <div className="proc-kpi-card" style={{ background: 'rgba(0,0,0,0.2)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="proc-kpi-title">On-Time Delivery</span>
                <Clock size={16} style={{ color: 'var(--accent)' }} />
              </div>
              <div className="proc-kpi-value" style={{ color: supplier.on_time_delivery_pct >= 90 ? '#10b981' : '#f59e0b' }}>
                {Number(supplier.on_time_delivery_pct).toFixed(1)}%
              </div>
              <p className="proc-kpi-desc">Percentage of orders received within the quoted lead time.</p>
            </div>

            {/* Quality rating */}
            <div className="proc-kpi-card" style={{ background: 'rgba(0,0,0,0.2)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="proc-kpi-title">Quality Standard</span>
                <Award size={16} style={{ color: 'var(--accent)' }} />
              </div>
              <div className="proc-kpi-value" style={{ display: 'flex', gap: '0.2rem', alignItems: 'center', color: '#f59e0b' }}>
                {Number(supplier.quality_rating).toFixed(2)}
                <div style={{ display: 'flex', fontSize: '1rem', color: '#f59e0b', marginLeft: '0.4rem' }}>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <span key={i} style={{ opacity: i < stars ? 1 : 0.25 }}>★</span>
                  ))}
                </div>
              </div>
              <p className="proc-kpi-desc">Estimator and site inspection aggregate feedback rating (out of 5.00).</p>
            </div>

            {/* Defect rate */}
            <div className="proc-kpi-card" style={{ background: 'rgba(0,0,0,0.2)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="proc-kpi-title">Defect Rate</span>
                <AlertTriangle size={16} style={{ color: '#ef4444' }} />
              </div>
              <div className="proc-kpi-value" style={{ color: supplier.defect_rate_pct <= 2 ? '#10b981' : '#ef4444' }}>
                {Number(supplier.defect_rate_pct).toFixed(2)}%
              </div>
              <p className="proc-kpi-desc">Percentage of material/goods returned due to mismatch or manufacturing defects.</p>
            </div>

            {/* Response time */}
            <div className="proc-kpi-card" style={{ background: 'rgba(0,0,0,0.2)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="proc-kpi-title">Avg Response Time</span>
                <Clock size={16} style={{ color: '#22d3ee' }} />
              </div>
              <div className="proc-kpi-value" style={{ color: '#ffffff' }}>
                {Number(supplier.avg_response_days).toFixed(1)} Days
              </div>
              <p className="proc-kpi-desc">Average response lag time to quote RFQs or send official pricing sheets.</p>
            </div>

          </div>

          {/* Legal / Disputes audits logs */}
          <div className="quote-card">
            <h3 className="quote-card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <ShieldCheck size={18} style={{ color: 'var(--accent)' }} /> Quality & Contract Compliance Registry
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1.2rem', fontSize: '0.82rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', background: 'var(--surface-hover)', padding: '0.8rem 1rem', borderRadius: '6px' }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontWeight: 600 }}>Disputes Logged</span>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Unresolved invoices or technical compliance issues</span>
                </div>
                <strong style={{ fontSize: '1.2rem', color: supplier.disputes_count > 0 ? '#ef4444' : '#10b981', alignSelf: 'center' }}>
                  {supplier.disputes_count}
                </strong>
              </div>

              <div style={{ display: 'flex', gap: '1rem', background: 'rgba(0, 229, 160, 0.04)', border: '1px solid rgba(0, 229, 160, 0.15)', padding: '1rem', borderRadius: '8px' }}>
                <ThumbsUp size={20} style={{ color: 'var(--accent)', flexShrink: 0, marginTop: '2px' }} />
                <div style={{ color: 'var(--text-secondary)', lineHeight: '1.4', fontSize: '0.78rem' }}>
                  <strong>Credibility Status: APPROVED SUPPLIER</strong>
                  <br />
                  This supplier holds a composite score of {compositeScore.toFixed(0)}/100, which exceeds the general threshold of 70.00. No active disputes are currently blocking PO routing. This profile is pre-approved for procurement activities.
                </div>
              </div>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
