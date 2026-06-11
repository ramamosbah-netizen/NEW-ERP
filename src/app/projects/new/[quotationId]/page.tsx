// ============================================================
// JEET ERP — Initialize Project Pre-filled from Quotation Route
// Route: /projects/new/:quotationId
// ============================================================

'use client';

import React, { use } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { ProjectWizard } from '@/components/projects/ProjectWizard';

type Props = {
  params: Promise<{ quotationId: string }>;
};

export default function CreateProjectFromQuotationPage({ params }: Props) {
  const { quotationId } = use(params);

  return (
    <div className="quote-container">
      {/* Header */}
      <header className="quote-header">
        <div>
          <button 
            type="button" 
            onClick={() => window.history.back()} 
            className="quote-btn quote-btn-secondary" 
            style={{ marginBottom: '1rem' }}
          >
            <ArrowLeft size={14} /> Back
          </button>
          <h1 className="quote-header-title">Convert Quotation to Project</h1>
          <p className="quote-header-subtitle">Auto-filled project contract details based on accepted quotation terms</p>
        </div>
      </header>

      {/* Wizard pre-filled */}
      <ProjectWizard quotationId={quotationId} />
    </div>
  );
}
