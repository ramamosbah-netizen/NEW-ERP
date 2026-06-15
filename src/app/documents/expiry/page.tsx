// ============================================================
// JEET ERP — Document Expiry Alerts Dashboard
// Route: /documents/expiry
// Lists expiring contracts, trade licenses, NOCs grouped by warning window
// ============================================================

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useExpiryAlerts } from '@/hooks/useExpiryAlerts';
import { 
  ArrowLeft, 
  Calendar, 
  Check, 
  AlertTriangle, 
  Clock, 
  ShieldAlert, 
  RefreshCw 
} from 'lucide-react';
import { DocumentDetailDrawer } from '@/components/documents/DocumentDetailDrawer';

export default function DocumentExpiryPage() {
  const { groupedAlerts, loading, error, refetch, acknowledgeAlert } = useExpiryAlerts();
  
  const [activeWindow, setActiveWindow] = useState<'expired' | 'within7d' | 'within30d' | 'within60d' | 'within90d'>('expired');
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const getWindowLabel = (w: typeof activeWindow) => {
    if (w === 'expired') return 'Expired Documents';
    if (w === 'within7d') return 'Expiring within 7 Days';
    if (w === 'within30d') return 'Expiring within 30 Days';
    if (w === 'within60d') return 'Expiring within 60 Days';
    return 'Expiring within 90 Days';
  };

  const getWindowCount = (w: typeof activeWindow) => {
    return groupedAlerts[w]?.length || 0;
  };

  const currentList = groupedAlerts[activeWindow] || [];

  return (
    <div className="quote-container">
      {/* Header */}
      <header className="quote-header">
        <div>
          <Link href="/documents" className="quote-btn quote-btn-secondary" style={{ marginBottom: '1rem', textDecoration: 'none', display: 'inline-flex' }}>
            <ArrowLeft size={14} /> Back to DMS Hub
          </Link>
          <h1 className="quote-header-title">Document Expiration Control Board</h1>
          <p className="quote-header-subtitle">Monitor trade licenses, SIRA certificates, and commercial contracts before they expire</p>
        </div>
        <button className="quote-btn quote-btn-secondary" onClick={refetch}>
          <RefreshCw size={14} /> Refresh Alerts
        </button>
      </header>

      {/* KPI Toggles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        {[
          { key: 'expired', label: 'Expired', color: '#ef4444', desc: 'Needs Renewal' },
          { key: 'within7d', label: '7 Days', color: 'var(--warning)', desc: 'Critical alert' },
          { key: 'within30d', label: '30 Days', color: 'var(--secondary)', desc: 'Action required' },
          { key: 'within60d', label: '60 Days', color: 'var(--text-secondary)', desc: 'Early warning' },
          { key: 'within90d', label: '90 Days', color: 'var(--text-muted)', desc: 'Planning stage' }
        ].map((item) => {
          const count = groupedAlerts[item.key as keyof typeof groupedAlerts]?.length || 0;
          const isActive = activeWindow === item.key;
          
          return (
            <div 
              key={item.key}
              onClick={() => setActiveWindow(item.key as 'expired' | 'within7d' | 'within30d' | 'within60d' | 'within90d')}
              className="quote-card"
              style={{
                margin: 0,
                cursor: 'pointer',
                borderColor: isActive ? item.color : 'var(--border-color)',
                background: isActive ? 'var(--surface-hover)' : 'var(--bg-card)',
                borderLeft: `4px solid ${item.color}`,
                transition: 'var(--transition-fast)'
              }}
            >
              <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 700 }}>
                {item.label}
              </div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#ffffff', marginTop: '0.3rem' }}>
                {count} files
              </div>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>
                {item.desc}
              </div>
            </div>
          );
        })}
      </div>

      {/* Detail list card */}
      <div className="quote-card">
        <h3 className="quote-card-title">
          <Clock size={16} /> {getWindowLabel(activeWindow)} ({currentList.length})
        </h3>

        <div style={{ marginTop: '1.2rem' }}>
          {loading ? (
            <div style={{ padding: '3rem', textAlign: 'center' }}>
              <div className="spinner"></div>
              <p style={{ marginTop: '1rem' }}>Querying expiry dates...</p>
            </div>
          ) : error ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#ef4444' }}>
              <p>Failed to query alerts: {error.message}</p>
            </div>
          ) : currentList.length === 0 ? (
            <p style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              No documents falling within this warning threshold.
            </p>
          ) : (
            <div className="quote-table-wrap">
              <table className="quote-table">
                <thead>
                  <tr>
                    <th>Document Title</th>
                    <th>Category</th>
                    <th>Subcategory</th>
                    <th>Linked Entity</th>
                    <th>Expiration Date</th>
                    <th>Warning Level</th>
                    <th style={{ textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {currentList.map((alert) => (
                    <tr key={alert.id}>
                      <td 
                        style={{ fontWeight: 600, color: 'var(--secondary)', cursor: 'pointer' }}
                        onClick={() => {
                          setSelectedDocId(alert.document_id);
                          setIsDrawerOpen(true);
                        }}
                      >
                        {alert.document?.title || 'Unknown Document'}
                      </td>
                      <td>{alert.document?.category}</td>
                      <td>{alert.document?.subcategory.replace('_', ' ')}</td>
                      <td>{alert.document?.entity_type}</td>
                      <td style={{ fontWeight: 600 }}>
                        {new Date(alert.expiry_date).toLocaleDateString('en-GB')}
                      </td>
                      <td>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                          Alert sent {alert.alert_days_before} days prior
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', gap: '0.5rem' }}>
                          <button 
                            type="button" 
                            className="quote-btn quote-btn-primary" 
                            style={{ padding: '0.3rem 0.6rem', fontSize: '0.72rem' }}
                            onClick={() => acknowledgeAlert(alert.id)}
                          >
                            <Check size={12} /> Acknowledge / Dismiss
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Slide drawer details preview */}
      <DocumentDetailDrawer 
        documentId={selectedDocId}
        isOpen={isDrawerOpen}
        onClose={() => { setSelectedDocId(null); setIsDrawerOpen(false); }}
        onUpdate={refetch}
      />
    </div>
  );
}
