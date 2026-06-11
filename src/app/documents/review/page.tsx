// ============================================================
// JEET ERP — Document Review Queue Workspace
// Route: /documents/review
// List of low-confidence/unclassified documents requiring human verify
// ============================================================

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CheckSquare, RefreshCw, FileText, Settings } from 'lucide-react';
import { useReviewQueue } from '@/hooks/useReviewQueue';
import { DocumentTable } from '@/components/documents/DocumentTable';
import { ReviewQueueSplitView } from '@/components/documents/ReviewQueueSplitView';
import type { Document } from '@/types/document.types';

export default function DocumentReviewQueuePage() {
  const { documents, loading, error, refetch } = useReviewQueue();
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);

  const handleReviewed = () => {
    setSelectedDoc(null);
    refetch();
  };

  return (
    <div className="quote-container">
      {/* If split review is active */}
      {selectedDoc ? (
        <ReviewQueueSplitView 
          document={selectedDoc}
          onBack={() => setSelectedDoc(null)}
          onReviewed={handleReviewed}
        />
      ) : (
        <>
          {/* Header */}
          <header className="quote-header">
            <div>
              <Link href="/documents" className="quote-btn quote-btn-secondary" style={{ marginBottom: '1rem', textDecoration: 'none', display: 'inline-flex' }}>
                <ArrowLeft size={14} /> Back to DMS Hub
              </Link>
              <h1 className="quote-header-title">AI Classification Review Queue</h1>
              <p className="quote-header-subtitle">Verify category, expiry dates, or correct values for low-confidence documents</p>
            </div>
            <button className="quote-btn quote-btn-secondary" onClick={refetch}>
              <RefreshCw size={14} /> Refresh Queue
            </button>
          </header>

          {/* KPI strip */}
          <div className="quote-card" style={{ padding: '1.2rem', borderLeft: '4px solid var(--warning)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
              <CheckSquare size={24} style={{ color: 'var(--warning)' }} />
              <div>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Awaiting Verification</span>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#ffffff', marginTop: '0.1rem' }}>
                  {documents.length} files requiring audit
                </div>
              </div>
            </div>
          </div>

          {/* List Table */}
          <div className="quote-card">
            {loading ? (
              <div style={{ padding: '3rem', textAlign: 'center' }}>
                <div className="spinner" style={{ margin: '0 auto 1rem auto' }}></div>
                <p>Querying review registry...</p>
              </div>
            ) : error ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#ef4444' }}>
                <p>Failed to query database: {error.message}</p>
              </div>
            ) : documents.length === 0 ? (
              <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                <FileText size={48} style={{ margin: '0 auto 1rem auto', opacity: 0.3 }} />
                <p>Congratulations! No documents require manual review.</p>
              </div>
            ) : (
              <DocumentTable 
                documents={documents}
                onSelect={(doc) => setSelectedDoc(doc)}
                onReview={(doc) => setSelectedDoc(doc)}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}
