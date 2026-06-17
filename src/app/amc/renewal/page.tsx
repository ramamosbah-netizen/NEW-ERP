// ============================================================
// JEET ERP — AMC Renewal Pipeline Kanban Board
// Route: /amc/renewal
// ============================================================

'use client';

import { useState, Suspense } from 'react';
import Link from 'next/link';
import { 
  ArrowLeft, 
  Layers, 
  RotateCw, 
  RefreshCw, 
  FileText, 
  Calendar,
  AlertTriangle,
  CheckCircle2,
  X
} from 'lucide-react';
import { useRenewalPipeline } from '@/hooks/useRenewalPipeline';
import type { AMCContract } from '@/types/amc.types';

const fmtAED = (v: number) => {
  return new Intl.NumberFormat('en-AE', { 
    style: 'currency', 
    currency: 'AED', 
    maximumFractionDigits: 0 
  }).format(v);
};

export default function AMCRenewalPipelinePage() {
  const { pipeline, loading, error, refetch, renewContract } = useRenewalPipeline();

  const [renewingContract, setRenewingContract] = useState<AMCContract | null>(null);
  const [renewForm, setRenewForm] = useState({
    startDate: '',
    annualValue: ''
  });

  const handleOpenRenewModal = (c: AMCContract) => {
    // Default start date is day after current contract end_date
    const currentEnd = new Date(c.end_date);
    const defaultStart = new Date(currentEnd.getFullYear(), currentEnd.getMonth(), currentEnd.getDate() + 1);
    
    setRenewingContract(c);
    setRenewForm({
      startDate: defaultStart.toISOString().split('T')[0],
      annualValue: String(c.annual_value)
    });
  };

  const handleRenewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renewingContract) return;

    try {
      await renewContract(
        renewingContract.id,
        renewForm.startDate,
        Number(renewForm.annualValue)
      );
      setRenewingContract(null);
      alert('Contract successfully renewed to a new draft sequence!');
    } catch (err: any) {
      alert('Failed to renew contract: ' + err.message);
    }
  };

  const renderCard = (c: AMCContract) => {
    const isCritical = new Date(c.end_date).getTime() - Date.now() < 30 * 24 * 60 * 60 * 1000;
    return (
      <div 
        key={c.id} 
        className="quote-card" 
        style={{ 
          padding: '1rem', 
          marginBottom: '1rem',
          borderLeft: `3px solid ${isCritical ? 'var(--error)' : 'var(--secondary)'}`,
          background: 'rgba(13, 17, 39, 0.7)'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Link 
            href={`/amc/${c.id}`} 
            style={{ 
              fontWeight: 700, 
              color: 'var(--secondary)', 
              fontFamily: 'var(--font-mono)', 
              fontSize: '0.85rem',
              textDecoration: 'none'
            }}
          >
            {c.contract_number}
          </Link>
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--primary)' }}>
            {fmtAED(c.annual_value)}
          </span>
        </div>

        <h4 style={{ fontSize: '0.88rem', fontWeight: 600, marginTop: '0.4rem', color: '#fff' }}>{c.client_name}</h4>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>Site: {c.site_name}</p>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.6rem' }}>
          <Calendar size={12} />
          <span>Expires: {new Date(c.end_date).toLocaleDateString('en-GB')}</span>
        </div>

        {c.status !== 'RENEWED' && (
          <button 
            type="button" 
            className="quote-btn quote-btn-primary" 
            style={{ 
              width: '100%', 
              padding: '0.35rem', 
              fontSize: '0.75rem', 
              marginTop: '0.8rem',
              borderRadius: '6px'
            }}
            onClick={() => handleOpenRenewModal(c)}
          >
            <RotateCw size={12} /> Set Renewal
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="quote-container">
      {/* Header */}
      <header className="quote-header">
        <div>
          <Link href="/amc" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: 'var(--primary)', textDecoration: 'none', fontSize: '0.82rem', marginBottom: '0.5rem', fontWeight: 600 }}>
            <ArrowLeft size={14} /> Back to Registry
          </Link>
          <h1 className="quote-header-title">Renewal Kanban Pipeline</h1>
          <p className="quote-header-subtitle">Audit expiring AMC agreements and set linked renewal drafts</p>
        </div>
        <button type="button" className="quote-btn quote-btn-secondary" onClick={() => refetch()}>
          <RefreshCw size={14} /> Refresh Board
        </button>
      </header>

      {/* Kanban Lanes Grid */}
      {loading ? (
        <div className="quote-card" style={{ textAlign: 'center', padding: '4rem' }}>
          <div className="spinner" style={{ margin: '0 auto 1.5rem auto' }}></div>
          <p>Loading renewal pipeline...</p>
        </div>
      ) : error ? (
        <div className="quote-card" style={{ color: 'var(--error)', padding: '2rem', textAlign: 'center' }}>
          <p>Error: {error.message}</p>
        </div>
      ) : (
        <div 
          style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', 
            gap: '1.2rem',
            alignItems: 'start'
          }}
        >
          {/* Lane 1: Active (>90 days) */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '2px solid var(--success)', marginBottom: '1rem', alignItems: 'center' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--success)' }}>Active (Secured)</span>
              <span style={{ fontSize: '0.75rem', background: 'rgba(16,185,129,0.1)', padding: '2px 6px', borderRadius: '4px', color: 'var(--success)', fontWeight: 700 }}>
                {pipeline.ACTIVE.length}
              </span>
            </div>
            <div style={{ maxHeight: '70vh', overflowY: 'auto', paddingRight: '4px' }}>
              {pipeline.ACTIVE.length === 0 ? (
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', padding: '1rem' }}>No active contracts</p>
              ) : (
                pipeline.ACTIVE.map(renderCard)
              )}
            </div>
          </div>

          {/* Lane 2: Expiring Soon (30-90 days) */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '2px solid var(--secondary)', marginBottom: '1rem', alignItems: 'center' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--secondary)' }}>Expiring (T-90)</span>
              <span style={{ fontSize: '0.75rem', background: 'rgba(34,211,238,0.1)', padding: '2px 6px', borderRadius: '4px', color: 'var(--secondary)', fontWeight: 700 }}>
                {pipeline.EXPIRING_90.length}
              </span>
            </div>
            <div style={{ maxHeight: '70vh', overflowY: 'auto', paddingRight: '4px' }}>
              {pipeline.EXPIRING_90.length === 0 ? (
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', padding: '1rem' }}>No expiring contracts</p>
              ) : (
                pipeline.EXPIRING_90.map(renderCard)
              )}
            </div>
          </div>

          {/* Lane 3: Critical Expiring (<30 days) */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '2px solid var(--warning)', marginBottom: '1rem', alignItems: 'center' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--warning)' }}>Critical (T-30)</span>
              <span style={{ fontSize: '0.75rem', background: 'rgba(234,179,8,0.1)', padding: '2px 6px', borderRadius: '4px', color: 'var(--warning)', fontWeight: 700 }}>
                {pipeline.EXPIRING_30.length}
              </span>
            </div>
            <div style={{ maxHeight: '70vh', overflowY: 'auto', paddingRight: '4px' }}>
              {pipeline.EXPIRING_30.length === 0 ? (
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', padding: '1rem' }}>No critical renewals</p>
              ) : (
                pipeline.EXPIRING_30.map(renderCard)
              )}
            </div>
          </div>

          {/* Lane 4: Expired */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '2px solid var(--error)', marginBottom: '1rem', alignItems: 'center' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--error)' }}>Expired</span>
              <span style={{ fontSize: '0.75rem', background: 'rgba(239,68,68,0.1)', padding: '2px 6px', borderRadius: '4px', color: 'var(--error)', fontWeight: 700 }}>
                {pipeline.EXPIRED.length}
              </span>
            </div>
            <div style={{ maxHeight: '70vh', overflowY: 'auto', paddingRight: '4px' }}>
              {pipeline.EXPIRED.length === 0 ? (
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', padding: '1rem' }}>No expired contracts</p>
              ) : (
                pipeline.EXPIRED.map(renderCard)
              )}
            </div>
          </div>

          {/* Lane 5: Renewed */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '2px solid var(--text-muted)', marginBottom: '1rem', alignItems: 'center' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Renewed Lanes</span>
              <span style={{ fontSize: '0.75rem', background: 'var(--surface-hover)', padding: '2px 6px', borderRadius: '4px', color: 'var(--text-secondary)', fontWeight: 700 }}>
                {pipeline.RENEWED.length}
              </span>
            </div>
            <div style={{ maxHeight: '70vh', overflowY: 'auto', paddingRight: '4px' }}>
              {pipeline.RENEWED.length === 0 ? (
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', padding: '1rem' }}>No renewed contracts</p>
              ) : (
                pipeline.RENEWED.map(renderCard)
              )}
            </div>
          </div>
        </div>
      )}

      {/* RENEWAL SETUP MODAL */}
      {renewingContract && (
        <div className="quote-modal-overlay">
          <div className="quote-modal" style={{ maxWidth: '400px' }}>
            <div className="quote-modal-header">
              <h3 className="quote-modal-title"><RotateCw size={16} /> Renew AMC Agreement</h3>
              <button 
                type="button" 
                onClick={() => setRenewingContract(null)}
                style={{ background: 'transparent', color: '#fff', cursor: 'pointer' }}
              >
                <X size={16} />
              </button>
            </div>
            <div className="quote-modal-body">
              <form onSubmit={handleRenewSubmit}>
                <div className="quote-form-grid" style={{ gridTemplateColumns: '1fr', gap: '1rem' }}>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    Generating a renewal draft for contract <strong>{renewingContract.contract_number}</strong>. This links both sequences together.
                  </p>

                  {/* Start Date */}
                  <div className="quote-form-group">
                    <label>Renewal Start Date *</label>
                    <input
                      type="date"
                      name="startDate"
                      className="quote-form-input"
                      value={renewForm.startDate}
                      onChange={(e) => setRenewForm(prev => ({ ...prev, startDate: e.target.value }))}
                      required
                    />
                  </div>

                  {/* Value */}
                  <div className="quote-form-group">
                    <label>New Annual Value (AED) *</label>
                    <input
                      type="number"
                      name="annualValue"
                      className="quote-form-input"
                      value={renewForm.annualValue}
                      onChange={(e) => setRenewForm(prev => ({ ...prev, annualValue: e.target.value }))}
                      required
                    />
                  </div>

                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.8rem', marginTop: '1.5rem' }}>
                  <button type="button" className="quote-btn quote-btn-secondary" onClick={() => setRenewingContract(null)}>
                    Cancel
                  </button>
                  <button type="submit" className="quote-btn quote-btn-primary">
                    Create Renewal Draft
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
