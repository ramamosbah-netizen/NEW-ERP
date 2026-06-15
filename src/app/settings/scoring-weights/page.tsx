// ============================================================
// JEET ERP — Procurement Scoring Weights Settings
// Routes: /settings/scoring-weights
// ============================================================

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  ArrowLeft, 
  Save, 
  AlertTriangle, 
  CheckCircle,
  Sliders,
  RefreshCw,
  Info
} from 'lucide-react';
import { useScoringWeights } from '@/hooks/useComparisons';
import '../../procurement/comparisons/comparisons.css';

export default function ScoringWeightsPage() {
  const router = useRouter();
  const { weights, loading, error, saveWeights, refetch } = useScoringWeights();

  const [weightPrice, setWeightPrice] = useState<number>(45);
  const [weightDelivery, setWeightDelivery] = useState<number>(20);
  const [weightHistory, setWeightHistory] = useState<number>(20);
  const [weightPayment, setWeightPayment] = useState<number>(10);
  const [weightCompliance, setWeightCompliance] = useState<number>(5);

  const [saveLoading, setSaveLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  // Sync state with db loaded weights
  useEffect(() => {
    if (weights) {
      setWeightPrice(Number(weights.weight_price));
      setWeightDelivery(Number(weights.weight_delivery));
      setWeightHistory(Number(weights.weight_history));
      setWeightPayment(Number(weights.weight_payment));
      setWeightCompliance(Number(weights.weight_compliance));
    }
  }, [weights]);

  const total = weightPrice + weightDelivery + weightHistory + weightPayment + weightCompliance;
  const isBalanced = Math.abs(total - 100) < 0.01;

  const handleSave = async () => {
    if (!isBalanced) {
      alert('The weights must sum up to exactly 100%');
      return;
    }
    try {
      setSaveLoading(true);
      await saveWeights({
        weight_price: weightPrice,
        weight_delivery: weightDelivery,
        weight_history: weightHistory,
        weight_payment: weightPayment,
        weight_compliance: weightCompliance
      });
      setSuccessMsg('Scoring weights updated successfully!');
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      alert('Failed to save weights: ' + err.message);
    } finally {
      setSaveLoading(false);
    }
  };

  const resetToDefaults = () => {
    setWeightPrice(45);
    setWeightDelivery(20);
    setWeightHistory(20);
    setWeightPayment(10);
    setWeightCompliance(5);
  };

  if (loading) {
    return (
      <div className="comp-container" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div className="spinner"></div>
        <p style={{ marginTop: '1rem', color: 'var(--text-secondary)' }}>Loading weights settings...</p>
      </div>
    );
  }

  return (
    <div className="comp-container">
      {/* Header */}
      <header className="comp-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Link href="/procurement/comparisons" className="quote-btn quote-btn-secondary" style={{ padding: '0.4rem 0.6rem' }}>
            <ArrowLeft size={16} /> Back
          </Link>
          <div>
            <h1 className="comp-header-title">Procurement Scoring Matrix Configuration</h1>
            <p className="comp-header-subtitle">Configure composite weighting weights for AI auto-recommendations and supplier evaluations</p>
          </div>
        </div>
      </header>

      {/* Main Settings Card */}
      <div style={{ maxWidth: '800px', margin: '0 auto', width: '100%' }}>
        <div className="quote-card" style={{ padding: '2rem' }}>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--surface-hover)', paddingBottom: '1rem' }}>
            <Sliders size={22} style={{ color: 'var(--accent)' }} />
            <h3 style={{ fontSize: '1.2rem', fontWeight: 600 }}>Multi-Criteria Evaluation Sliders</h3>
          </div>

          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '2rem', lineHeight: '1.5' }}>
            The composite scoring engine uses these weights to rank supplier offers. Compliant suppliers always rank higher than non-compliant ones, and the best scored offer is auto-recommended to estimators. Adjust the slides below.
          </p>

          {/* Alert messages */}
          {successMsg && (
            <div className="quote-card" style={{ borderColor: 'rgba(16, 185, 129, 0.4)', background: 'rgba(16, 185, 129, 0.05)', marginBottom: '1.5rem', padding: '0.8rem 1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <CheckCircle size={16} style={{ color: '#10b981' }} />
              <span style={{ fontSize: '0.82rem', color: '#10b981', fontWeight: 600 }}>{successMsg}</span>
            </div>
          )}

          {!isBalanced && (
            <div className="quote-card" style={{ borderColor: 'rgba(245, 158, 11, 0.4)', background: 'rgba(245, 158, 11, 0.05)', marginBottom: '1.5rem', padding: '0.8rem 1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <AlertTriangle size={16} style={{ color: '#f59e0b' }} />
              <span style={{ fontSize: '0.82rem', color: '#f59e0b', fontWeight: 600 }}>
                Total sum must be exactly 100%. Current sum: <strong>{total}%</strong> ({total > 100 ? `exceeds by ${total - 100}%` : `lacks ${100 - total}%`})
              </span>
            </div>
          )}

          {/* Sliders Container */}
          <div className="weight-slider-container" style={{ background: 'rgba(0,0,0,0.15)', padding: '1.5rem', borderRadius: '10px' }}>
            
            {/* Price slider */}
            <div className="weight-slider-row" style={{ marginBottom: '1.5rem' }}>
              <div className="weight-slider-label">
                <div>Price Coefficient</div>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Inverse unit cost ratio</span>
              </div>
              <div className="weight-slider-input-wrap">
                <input 
                  type="range" 
                  min="0" 
                  max="100" 
                  className="weight-slider" 
                  value={weightPrice}
                  onChange={(e) => setWeightPrice(Number(e.target.value))}
                />
                <span className="weight-slider-value">{weightPrice}%</span>
              </div>
            </div>

            {/* Delivery slider */}
            <div className="weight-slider-row" style={{ marginBottom: '1.5rem' }}>
              <div className="weight-slider-label">
                <div>Delivery Lead Time</div>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Lead days comparison</span>
              </div>
              <div className="weight-slider-input-wrap">
                <input 
                  type="range" 
                  min="0" 
                  max="100" 
                  className="weight-slider" 
                  value={weightDelivery}
                  onChange={(e) => setWeightDelivery(Number(e.target.value))}
                />
                <span className="weight-slider-value">{weightDelivery}%</span>
              </div>
            </div>

            {/* History slider */}
            <div className="weight-slider-row" style={{ marginBottom: '1.5rem' }}>
              <div className="weight-slider-label">
                <div>Supplier History</div>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Defects, delay rates, win rate</span>
              </div>
              <div className="weight-slider-input-wrap">
                <input 
                  type="range" 
                  min="0" 
                  max="100" 
                  className="weight-slider" 
                  value={weightHistory}
                  onChange={(e) => setWeightHistory(Number(e.target.value))}
                />
                <span className="weight-slider-value">{weightHistory}%</span>
              </div>
            </div>

            {/* Payment slider */}
            <div className="weight-slider-row" style={{ marginBottom: '1.5rem' }}>
              <div className="weight-slider-label">
                <div>Payment Terms</div>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Capped at 90 days credit</span>
              </div>
              <div className="weight-slider-input-wrap">
                <input 
                  type="range" 
                  min="0" 
                  max="100" 
                  className="weight-slider" 
                  value={weightPayment}
                  onChange={(e) => setWeightPayment(Number(e.target.value))}
                />
                <span className="weight-slider-value">{weightPayment}%</span>
              </div>
            </div>

            {/* Compliance slider */}
            <div className="weight-slider-row">
              <div className="weight-slider-label">
                <div>Specifications Compliance</div>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Strict requirements matches</span>
              </div>
              <div className="weight-slider-input-wrap">
                <input 
                  type="range" 
                  min="0" 
                  max="100" 
                  className="weight-slider" 
                  value={weightCompliance}
                  onChange={(e) => setWeightCompliance(Number(e.target.value))}
                />
                <span className="weight-slider-value">{weightCompliance}%</span>
              </div>
            </div>

          </div>

          {/* Sum Display bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem', background: 'rgba(0,0,0,0.3)', padding: '0.8rem 1.2rem', borderRadius: '6px' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>Total Scoring Weights:</span>
            <span style={{ fontSize: '1.2rem', fontWeight: 700, color: isBalanced ? 'var(--accent)' : '#ef4444' }}>{total}%</span>
          </div>

          {/* Save & Reset buttons */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2rem' }}>
            <button 
              className="quote-btn quote-btn-secondary" 
              onClick={resetToDefaults}
            >
              Reset to Defaults (45/20/20/10/5)
            </button>
            <div style={{ display: 'flex', gap: '0.8rem' }}>
              <button 
                className="quote-btn quote-btn-secondary" 
                onClick={refetch}
              >
                <RefreshCw size={14} /> Refresh
              </button>
              <button 
                className="quote-btn quote-btn-primary" 
                disabled={saveLoading || !isBalanced}
                onClick={handleSave}
                style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}
              >
                <Save size={14} /> Save Scoring Weights
              </button>
            </div>
          </div>

        </div>

        {/* Explain weights card */}
        <div className="quote-card" style={{ marginTop: '1.5rem', padding: '1.2rem', borderLeft: '3px solid var(--accent)' }}>
          <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start' }}>
            <Info size={18} style={{ color: 'var(--accent)', flexShrink: 0, marginTop: '2px' }} />
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
              <strong>Pricing Logic Detail:</strong> The formula dynamically benchmarks the cheapest supplier cost against other offers to determine the Price score. If delivery details or history ratings are unavailable, the engine automatically defaults to a safety benchmark (e.g. 50% score for Delivery TBC) to ensure no supplier is unfairly zeroed.
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
