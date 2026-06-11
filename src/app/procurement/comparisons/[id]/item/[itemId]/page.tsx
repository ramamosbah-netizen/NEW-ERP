// ============================================================
// JEET ERP — Focused Comparison Item Offer Editor
// Routes: /procurement/comparisons/:id/item/:itemId
// ============================================================

'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { 
  ArrowLeft, 
  Check, 
  AlertTriangle,
  Info,
  Calendar,
  Layers,
  Award,
  ChevronRight
} from 'lucide-react';
import { useComparison } from '@/hooks/useComparisons';
import '../../../comparisons.css';

const fmtAED = (v: number) => {
  return 'AED ' + new Intl.NumberFormat('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
};

export default function ItemEditorPage({ params }: { params: Promise<{ id: string; itemId: string }> }) {
  const router = useRouter();
  const { id, itemId } = use(params);

  // Fetch comparison details
  const { comparison, loading, error, refetch, actions } = useComparison(id);
  const [supplierHistories, setSupplierHistories] = useState<any[]>([]);

  useEffect(() => {
    // Fetch performance records
    supabase.from('supplier_performance_history').select('*').then(({ data }) => {
      if (data) setSupplierHistories(data);
    });
  }, []);

  if (loading) {
    return (
      <div className="comp-container" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div className="spinner"></div>
        <p style={{ marginTop: '1rem', color: 'var(--text-secondary)' }}>Loading item comparison details...</p>
      </div>
    );
  }

  if (error || !comparison) {
    return (
      <div className="comp-container">
        <div className="quote-card" style={{ textAlign: 'center', padding: '3rem' }}>
          <AlertTriangle size={48} style={{ color: '#ef4444', margin: '0 auto 1rem auto' }} />
          <p>Comparison details could not be loaded.</p>
        </div>
      </div>
    );
  }

  const item = comparison.items.find((i: any) => i.id === itemId);
  if (!item) {
    return (
      <div className="comp-container">
        <div className="quote-card" style={{ textAlign: 'center', padding: '3rem' }}>
          <AlertTriangle size={48} style={{ color: '#ef4444', margin: '0 auto 1rem auto' }} />
          <p>Comparison line item not found.</p>
          <Link href={`/procurement/comparisons/${id}`} className="quote-btn quote-btn-secondary" style={{ marginTop: '1.5rem' }}>
            Back to Matrix
          </Link>
        </div>
      </div>
    );
  }

  const offers = item.offers || [];

  // Find history record for a supplier
  const getHistoryForSupplier = (supplierName: string) => {
    return supplierHistories.find(h => h.supplier_name.toLowerCase().trim() === supplierName.toLowerCase().trim());
  };

  // ------------------------------------------------------------
  // PURE REACT SVG RADAR CHART GENERATOR
  // ------------------------------------------------------------
  const RadarChart = ({ offersList }: { offersList: any[] }) => {
    const cx = 150;
    const cy = 150;
    const rMax = 100;
    const axes = ['Price', 'Delivery', 'History', 'Payment', 'Compliance'];
    const angles = [0, 72, 144, 216, 288];

    // Colors list for different suppliers
    const colors = [
      { stroke: '#00E5A0', fill: 'rgba(0, 229, 160, 0.15)' }, // Mint
      { stroke: '#22d3ee', fill: 'rgba(34, 211, 238, 0.15)' }, // Cyan
      { stroke: '#a855f7', fill: 'rgba(168, 85, 247, 0.15)' }, // Purple
      { stroke: '#f59e0b', fill: 'rgba(245, 158, 11, 0.15)' }   // Amber
    ];

    return (
      <svg width="340" height="320" viewBox="0 0 340 320" style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)' }}>
        {/* Grids concentric circles */}
        {[20, 40, 60, 80, 100].map((radius, idx) => {
          const points = angles.map(angle => {
            const rad = (angle - 90) * Math.PI / 180;
            return `${cx + radius * Math.cos(rad)},${cy + radius * Math.sin(rad)}`;
          }).join(' ');

          return (
            <polygon 
              key={idx} 
              points={points} 
              fill="none" 
              stroke="rgba(255,255,255,0.06)" 
              strokeWidth="1" 
            />
          );
        })}

        {/* Axis lines and text */}
        {axes.map((axis, idx) => {
          const angle = angles[idx];
          const rad = (angle - 90) * Math.PI / 180;
          const xLine = cx + rMax * Math.cos(rad);
          const yLine = cy + rMax * Math.sin(rad);
          const xText = cx + (rMax + 18) * Math.cos(rad);
          const yText = cy + (rMax + 10) * Math.sin(rad);

          return (
            <g key={idx}>
              <line 
                x1={cx} 
                y1={cy} 
                x2={xLine} 
                y2={yLine} 
                stroke="rgba(255,255,255,0.12)" 
                strokeWidth="1.2" 
              />
              <text 
                x={xText} 
                y={yText} 
                fill="var(--text-secondary)" 
                fontSize="9" 
                fontWeight="600"
                textAnchor="middle"
                alignmentBaseline="middle"
              >
                {axis}
              </text>
            </g>
          );
        })}

        {/* Draw Supplier Polygons */}
        {offersList.map((offer, sIdx) => {
          const color = colors[sIdx % colors.length];
          const scores = [
            offer.score_price || 0,
            offer.score_delivery || 0,
            offer.score_history || 0,
            offer.score_payment || 0,
            offer.score_compliance || 0
          ];

          const polygonPoints = angles.map((angle, idx) => {
            const rad = (angle - 90) * Math.PI / 180;
            const radius = (scores[idx] / 100) * rMax;
            return `${cx + radius * Math.cos(rad)},${cy + radius * Math.sin(rad)}`;
          }).join(' ');

          return (
            <g key={offer.id}>
              <polygon 
                points={polygonPoints} 
                fill={color.fill} 
                stroke={color.stroke} 
                strokeWidth="2" 
              />
              {/* Dot vertices */}
              {angles.map((angle, idx) => {
                const rad = (angle - 90) * Math.PI / 180;
                const radius = (scores[idx] / 100) * rMax;
                return (
                  <circle 
                    key={idx}
                    cx={cx + radius * Math.cos(rad)}
                    cy={cy + radius * Math.sin(rad)}
                    r="3.5"
                    fill={color.stroke}
                  />
                );
              })}
            </g>
          );
        })}
      </svg>
    );
  };

  const getScoreColorClass = (score: number) => {
    if (score >= 80) return 'text-healthy';
    if (score >= 50) return 'text-warning';
    return 'text-critical';
  };

  return (
    <div className="comp-container">
      {/* Header */}
      <header className="comp-header" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Link href={`/procurement/comparisons/${id}`} className="quote-btn quote-btn-secondary" style={{ padding: '0.4rem 0.6rem' }}>
            <ArrowLeft size={16} /> Back to Matrix
          </Link>
          <div>
            <h1 className="comp-header-title">Item Offers Analysis Workbench</h1>
            <p className="comp-header-subtitle">Inspect spec sheets, compare sub-scores, and check performance ratings</p>
          </div>
        </div>
      </header>

      {/* Item summary details card */}
      <div className="quote-card" style={{ padding: '1.2rem 1.5rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
          <div>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Description</span>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>{item.description}</div>
          </div>
          <div>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>BOQ Budget</span>
            <div style={{ fontSize: '1.1rem', fontWeight: 600, color: '#22d3ee' }}>
              {fmtAED(item.boq_total_material_cost)} ({item.quantity} {item.unit} @ {fmtAED(item.boq_unit_material_cost)})
            </div>
          </div>
          <div>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Client Revenue sold</span>
            <div style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--secondary)' }}>
              {fmtAED(item.quotation_total_sell)} (@ {fmtAED(item.quotation_unit_sell)})
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '1.5rem', alignItems: 'start', marginBottom: '80px' }}>
        
        {/* Supplier cards and compliance checks */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
          {offers.length === 0 ? (
            <div className="quote-card" style={{ textAlign: 'center', padding: '3rem' }}>
              <AlertTriangle size={36} style={{ color: 'var(--warning)', margin: '0 auto 1rem auto' }} />
              <p>No supplier offers have been registered for this item yet.</p>
            </div>
          ) : (
            offers.map((offer: any, idx: number) => {
              const history = getHistoryForSupplier(offer.supplier_name);
              const isSelected = item.selected_supplier_offer_id === offer.id;

              return (
                <div 
                  key={offer.id} 
                  className="quote-card" 
                  style={{ 
                    margin: 0, 
                    border: isSelected ? '2px solid #00E5A0' : '1px solid var(--border-color)',
                    background: isSelected ? 'rgba(0,229,160,0.02)' : 'rgba(255,255,255,0.01)'
                  }}
                >
                  {/* Title card header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '0.6rem', marginBottom: '0.8rem' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <h4 style={{ fontSize: '1.05rem', fontWeight: 700 }}>{offer.supplier_name}</h4>
                        {offer.is_recommended && <span className="best-tag">★ RECOMMENDED</span>}
                      </div>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Offer Source: {offer.offer_source} | Ref: {offer.offer_reference || 'N/A'}</span>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Sub-score Total</span>
                      <div className={`score-chip ${offer.score_total >= 80 ? 'score-chip-high' : offer.score_total >= 50 ? 'score-chip-mid' : 'score-chip-low'}`} style={{ fontSize: '0.9rem', cursor: 'default' }}>
                        {offer.score_total.toFixed(1)} / 100
                      </div>
                    </div>
                  </div>

                  {/* Pricing grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1rem' }}>
                    <div>
                      <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Unit Cost:</span>
                      <div style={{ fontWeight: 600 }}>{fmtAED(offer.unit_price)}</div>
                    </div>
                    <div>
                      <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Total Price:</span>
                      <div style={{ fontWeight: 600 }}>{fmtAED(offer.total_price)}</div>
                    </div>
                    <div>
                      <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Lead Delivery:</span>
                      <div style={{ fontWeight: 600 }}>{offer.delivery_days !== null ? `${offer.delivery_days} Days` : 'TBC'}</div>
                    </div>
                    <div>
                      <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Payment terms:</span>
                      <div style={{ fontWeight: 600 }}>{offer.payment_terms_days} Days</div>
                    </div>
                  </div>

                  {/* Supplier compliance and Brand */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: '0.8rem', fontSize: '0.78rem' }}>
                    <div>
                      <p><strong>Brand Offered:</strong> {offer.brand_offered || 'As per Spec'}</p>
                      <p style={{ marginTop: '0.2rem' }}>
                        <strong>Compliance Status:</strong> 
                        <span style={{ color: offer.is_compliant ? '#10b981' : '#ef4444', marginLeft: '0.4rem', fontWeight: 600 }}>
                          {offer.is_compliant ? 'Compliant' : 'Non-Compliant'}
                        </span>
                      </p>
                      {offer.compliance_notes && <p style={{ color: 'var(--text-muted)', fontSize: '0.7rem', marginTop: '0.2rem' }}>Reason: "{offer.compliance_notes}"</p>}
                    </div>

                    {/* Historical performance snapshot */}
                    <div>
                      <h5 style={{ fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.3rem', fontSize: '0.75rem', textTransform: 'uppercase' }}>Supplier Historical Record</h5>
                      {history ? (
                        <div style={{ fontSize: '0.72rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.2rem', color: 'var(--text-muted)' }}>
                          <span>Quality: <strong>{history.quality_rating} / 5.0</strong></span>
                          <span>On-Time: <strong>{history.on_time_delivery_pct}%</strong></span>
                          <span>Response: <strong>{history.avg_response_days} Days</strong></span>
                          <span>Disputes: <strong>{history.disputes_count}</strong></span>
                        </div>
                      ) : (
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>No historical record exists. Default neutral score applied.</p>
                      )}
                    </div>
                  </div>

                  {/* Selection Button */}
                  {!comparison.is_locked && (
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: '0.8rem' }}>
                      <button 
                        className={`quote-btn ${isSelected ? 'quote-btn-primary' : 'quote-btn-secondary'}`}
                        style={{ padding: '0.35rem 1rem', fontSize: '0.78rem' }}
                        disabled={isSelected}
                        onClick={() => actions.selectSupplier(item.id, offer.id, item.override_reason || '')}
                      >
                        {isSelected ? '✓ Currently Selected' : 'Select this Supplier'}
                      </button>
                    </div>
                  )}

                </div>
              );
            })
          )}
        </div>

        {/* Scoring Radar chart visualizer */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', position: 'sticky', top: '20px' }}>
          
          <div className="quote-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
            <h3 className="quote-card-title" style={{ alignSelf: 'flex-start' }}><Award size={18} /> Technical Radar Breakdown</h3>
            
            {offers.length > 0 ? (
              <>
                <RadarChart offersList={offers.slice(0, 4)} />
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center', width: '100%', marginTop: '0.5rem' }}>
                  {/* Radar Chart Color legends */}
                  {offers.slice(0, 4).map((offer: any, idx: number) => {
                    const colors = ['#00E5A0', '#22d3ee', '#a855f7', '#f59e0b'];
                    return (
                      <div key={offer.id} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.7rem' }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: colors[idx % 4] }}></span>
                        <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{offer.supplier_name.split(' ')[0]}</span>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <div style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                Radar chart requires supplier offers
              </div>
            )}
          </div>

          {/* Pricing delta calculations */}
          <div className="quote-card">
            <h3 className="quote-card-title"><Info size={16} /> Market Delta Log</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', marginTop: '1.2rem', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Compliant Offers:</span>
                <span style={{ fontWeight: 600 }}>{item.compliant_offers_count} of {item.offers_count}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Price Spread deviation:</span>
                <span style={{ fontWeight: 600, color: 'var(--warning)' }}>{item.price_spread_pct.toFixed(1)}%</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Margin delta vs client:</span>
                <span style={{ fontWeight: 600, color: '#00E5A0' }}>{item.item_margin_pct.toFixed(2)}%</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '0.6rem' }}>
                <span>Savings vs BOQ Material:</span>
                <span style={{ fontWeight: 700, color: item.item_savings_vs_boq >= 0 ? '#10b981' : '#ef4444' }}>
                  {fmtAED(item.item_savings_vs_boq)}
                </span>
              </div>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
