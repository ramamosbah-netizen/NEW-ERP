// ============================================================
// JEET ERP — Initialize New Project Manual Wizard Route
// Route: /projects/new
// ============================================================

'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { ProjectWizard } from '@/components/projects/ProjectWizard';

export default function ManualProjectCreatePage() {
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
          <h1 className="quote-header-title">Initialize Project Contract</h1>
          <p className="quote-header-subtitle">Register new ELV/MEP engineering contract details manually</p>
        </div>
      </header>

      {/* Wizard */}
      <ProjectWizard />
    </div>
  );
}
