// ============================================================
// JEET ERP — Goods Receipt Note (GRN) Details Page
// Route: /procurement/grn/[id]
// ============================================================

'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useGRN } from '@/hooks/useGRNs';
import { GRN_STATUS_LABELS, GRN_STATUS_COLORS, GRN_LOCATION_LABELS, GRN_REJECTION_REASONS } from '@/constants/po.constants';
import { ArrowLeft, Truck, Calendar, User, FileText, MapPin, AlertOctagon, CheckCircle } from 'lucide-react';
import WorkflowPanel from '@/components/workflow/WorkflowPanel';
import '@/app/procurement/comparisons/comparisons.css';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function GRNDetailPage({ params }: PageProps) {
  const { id: grnId } = use(params);
  const { grn, loading, error } = useGRN(grnId);

  if (loading) {
    return (
      <div className="comp-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          <div className="spinner" style={{ margin: '0 auto 1rem auto' }}></div>
          <p style={{ color: 'var(--text-secondary)' }}>Loading Goods Receipt details...</p>
        </div>
      </div>
    );
  }

  if (error || !grn) {
    return (
      <div className="comp-container">
        <div className="quote-card" style={{ padding: '2rem', textAlign: 'center', color: '#ef4444' }}>
          <AlertOctagon size={36} style={{ margin: '0 auto 0.8rem auto' }} />
          <p>Error loading Goods Receipt sheet: {error?.message || 'GRN not found.'}</p>
          <Link href="/procurement/grn" className="quote-btn quote-btn-secondary" style={{ marginTop: '1rem', display: 'inline-flex' }}>
            Back to Registry
          </Link>
        </div>
      </div>
    );
  }

  const badgeColors = GRN_STATUS_COLORS[grn.status] || { bg: 'rgba(255,255,255,0.05)', text: '#fff', border: 'rgba(255,255,255,0.1)' };
  const anyRejections = grn.items?.some(it => it.qty_rejected > 0);

  return (
    <div className="comp-container">
      {/* Header */}
      <header className="comp-header" style={{ marginBottom: '1.2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Link href="/procurement/grn" className="quote-btn quote-btn-secondary" style={{ padding: '0.5rem' }}>
            <ArrowLeft size={16} />
          </Link>
          <div>
            <h1 className="comp-header-title" style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
              Receipt Ref: {grn.grn_number}{' '}
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
                {GRN_STATUS_LABELS[grn.status]}
              </span>
            </h1>
            <p className="comp-header-subtitle">
              Received by: {grn.receiver_name || 'System'} | Log Date: {new Date(grn.received_at).toLocaleDateString('en-GB')}
            </p>
          </div>
        </div>
      </header>

      {/* Main Details Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr', gap: '1.5rem', alignItems: 'start' }}>
        
        {/* Left column: GRN details */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Metadata Card */}
          <div className="quote-card" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.2rem' }}>
            <div>
              <span className="quote-input-label">Supplier LPO Reference</span>
              <div style={{ fontWeight: 600, fontSize: '0.92rem', marginTop: '0.2rem' }}>
                <Link href={`/procurement/po/${grn.po_id}`} style={{ color: 'var(--primary)' }}>
                  {grn.po_number || 'View LPO'}
                </Link>
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.1rem' }}>
                Supplier: {grn.supplier_name || 'N/A'}
              </div>
            </div>

            <div>
              <span className="quote-input-label">Project Coordinate</span>
              <div style={{ fontWeight: 600, fontSize: '0.92rem', marginTop: '0.2rem' }}>
                {grn.project_name ? `${grn.project_name} (${grn.project_number})` : 'OVERHEAD / GENERAL'}
              </div>
            </div>

            <div>
              <span className="quote-input-label">Supplier Delivery Note</span>
              <div style={{ fontSize: '0.85rem', marginTop: '0.2rem', fontWeight: 600 }}>
                {grn.delivery_note_ref}
              </div>
              {grn.delivery_note_document_id && (
                <div style={{ fontSize: '0.72rem', color: 'var(--secondary)', marginTop: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                  <FileText size={10} /> Scanned Document Filed in DMS
                </div>
              )}
            </div>

            <div>
              <span className="quote-input-label">Offloading Point</span>
              <div style={{ fontSize: '0.82rem', marginTop: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                <MapPin size={12} style={{ color: 'var(--text-muted)' }} />
                {GRN_LOCATION_LABELS[grn.location]}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '0.1rem' }}>
                Driver: {grn.driver_name || 'N/A'} | Plate: {grn.vehicle_no || 'N/A'}
              </div>
            </div>
          </div>

          {/* Items Logged table */}
          <div className="quote-card">
            <h3 className="quote-card-title" style={{ marginBottom: '1.2rem' }}>Inspected Materials Summary</h3>
            
            <div className="quote-table-wrap">
              <table className="quote-table">
                <thead>
                  <tr>
                    <th style={{ width: '40px' }}>No</th>
                    <th>Item Description</th>
                    <th>Brand</th>
                    <th style={{ width: '60px' }}>Unit</th>
                    <th style={{ width: '100px', textAlign: 'right' }}>LPO Ordered</th>
                    <th style={{ width: '100px', textAlign: 'right' }}>Received Qty</th>
                    <th style={{ width: '100px', textAlign: 'right' }}>Rejected Qty</th>
                    <th>Rejection Reason</th>
                    <th>Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {grn.items?.map((item, idx) => (
                    <tr key={item.id}>
                      <td style={{ textAlign: 'center', fontWeight: 600 }}>{idx + 1}</td>
                      <td>
                        <div style={{ fontWeight: 500 }}>{item.description}</div>
                        {item.item_code && <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>Code: {item.item_code}</div>}
                      </td>
                      <td>{item.brand || '-'}</td>
                      <td>{item.unit}</td>
                      <td style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>{item.po_qty}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--primary)' }}>{item.qty_received}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600, color: item.qty_rejected > 0 ? 'var(--error)' : 'inherit' }}>{item.qty_rejected}</td>
                      <td>
                        {item.qty_rejected > 0 ? (
                          <span style={{ color: 'var(--error)', fontSize: '0.78rem', fontWeight: 500 }}>
                            ⚠️ {(GRN_REJECTION_REASONS as Record<string, string>)[item.rejection_reason as string] || item.rejection_reason}
                          </span>
                        ) : '-'}
                      </td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{item.notes || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right column: actions and status */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Configurable workflow (Admin Center → Workflows) */}
          <WorkflowPanel
            moduleKey="GRN"
            entityId={grnId}
            context={{ status: grn.status }}
          />
          {/* General Remarks Card */}
          {grn.notes && (
            <div className="quote-card">
              <h3 className="quote-card-title" style={{ marginBottom: '0.6rem' }}>General Notes</h3>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineBreak: 'anywhere' }}>"{grn.notes}"</p>
            </div>
          )}

          {/* Rejections / Returns Flag */}
          {anyRejections && (
            <div className="quote-card" style={{ border: '1px solid rgba(239, 68, 68, 0.35)', background: 'rgba(239, 68, 68, 0.03)' }}>
              <h3 className="quote-card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--error)' }}>
                <AlertOctagon size={16} /> Returns Action Required
              </h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.5rem', marginBottom: '0.8rem' }}>
                This receipt contains materials flagged as defective or damaged. Return tickets have been created in the <strong>Returns Tracker</strong> for supplier collection and replacements.
              </p>
              <Link href="/procurement/grn" className="quote-btn" style={{ display: 'inline-flex', width: '100%', justifyContent: 'center', background: 'rgba(239, 68, 68, 0.12)', color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.25)', fontSize: '0.78rem' }}>
                Open Returns Tracker
              </Link>
            </div>
          )}

          {!anyRejections && (
            <div className="quote-card" style={{ border: '1px solid rgba(0, 229, 160, 0.25)', background: 'rgba(0, 229, 160, 0.02)' }}>
              <h3 className="quote-card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--primary)' }}>
                <CheckCircle size={16} /> Clean Delivery Receipt
              </h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                All inspected items passed quality gates. Quantities have been fully written back to the LPO ledger with zero rejects.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
