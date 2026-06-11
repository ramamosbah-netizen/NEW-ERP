// ============================================================
// JEET ERP — PDF Preview Page
// Routes: /quotations/:id/pdf
// ============================================================

'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { ArrowLeft, Download } from 'lucide-react';
import { useQuotation } from '@/hooks/useQuotations';
import { quotationPDFService } from '@/lib/quotation-pdf';
import '../../quotations.css';

export default function PDFPreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { quotation, loading, error } = useQuotation(id);
  const [pdfUrl, setPdfUrl] = useState('');

  useEffect(() => {
    if (quotation) {
      quotationPDFService.preview(quotation.id).then(url => {
        setPdfUrl(url);
      }).catch(err => {
        console.error('Error rendering PDF:', err);
      });
    }
  }, [quotation]);

  if (loading) {
    return (
      <div className="quote-container" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div className="spinner"></div>
        <p style={{ marginTop: '1rem', color: 'var(--text-secondary)' }}>Loading PDF preview...</p>
      </div>
    );
  }

  if (error || !quotation) {
    return (
      <div className="quote-container" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div className="quote-card" style={{ textAlign: 'center', padding: '3rem' }}>
          <p style={{ color: '#ef4444' }}>Error loading PDF preview: Quotation not found.</p>
          <Link href="/quotations" className="quote-btn quote-btn-secondary" style={{ marginTop: '1.5rem' }}>
            Back to Registry
          </Link>
        </div>
      </div>
    );
  }

  const handleDownload = () => {
    quotationPDFService.download(quotation.id);
  };

  return (
    <div className="quote-container" style={{ height: '100vh', padding: '1rem 2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
          <Link href={`/quotations/${quotation.id}`} className="quote-btn quote-btn-secondary" style={{ padding: '0.4rem 0.6rem' }}>
            <ArrowLeft size={16} /> Back to Details
          </Link>
          <span style={{ fontSize: '1rem', fontWeight: 600 }}>
            {quotation.quotation_number} {quotation.revision_label} — Client PDF Document
          </span>
        </div>
        <button className="quote-btn quote-btn-primary" onClick={handleDownload}>
          <Download size={14} /> Download PDF
        </button>
      </div>

      <div className="quote-card" style={{ flex: 1, padding: 0, margin: 0 }}>
        {pdfUrl ? (
          <iframe src={pdfUrl} width="100%" height="100%" style={{ border: 'none', borderRadius: '12px' }}></iframe>
        ) : (
          <div style={{ padding: '4rem', textAlign: 'center' }}>
            <div className="spinner" style={{ margin: '0 auto' }}></div>
            <p style={{ marginTop: '1rem' }}>Rendering layout...</p>
          </div>
        )}
      </div>
    </div>
  );
}
