// ============================================================
// JEET ERP — Document Review Queue Split View Component
// Iframe file preview side-by-side with AI correction form
// ============================================================

import React, { useState, useEffect } from 'react';
import { documentService } from '@/lib/document-service';
import type { Document } from '@/types/document.types';
import { Check, X, ShieldAlert, AlertTriangle, ArrowLeft, Settings } from 'lucide-react';
import { documentEditSchema } from '@/lib/document-validation';

type Props = {
  document: Document;
  onBack: () => void;
  onReviewed: () => void;
};

export const ReviewQueueSplitView: React.FC<Props> = ({
  document: docItem,
  onBack,
  onReviewed
}) => {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Suggested Form Fields (Pre-filled from docItem AI details)
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [subcategory, setSubcategory] = useState('');
  const [issueDate, setIssueDate] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [amountAed, setAmountAed] = useState<number | ''>('');
  const [revisionLabel, setRevisionLabel] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [isConfidential, setIsConfidential] = useState(false);

  useEffect(() => {
    const init = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // 1. Fetch signed URL
        const url = await documentService.getSignedUrl(docItem.storage_path);
        setSignedUrl(url);

        // 2. Pre-fill form from AI suggestion metadata
        setTitle(docItem.title);
        
        // AI metadata check
        const aiData = docItem.ai_metadata;
        setCategory(aiData?.category || docItem.category || 'COMMERCIAL');
        setSubcategory(aiData?.subcategory || docItem.subcategory || 'QUOTATION');
        setIssueDate(aiData?.issue_date || docItem.issue_date || '');
        setExpiryDate(aiData?.expiry_date || docItem.expiry_date || '');
        setAmountAed(aiData?.amount_aed !== undefined && aiData?.amount_aed !== null ? aiData.amount_aed : docItem.amount_aed || '');
        setRevisionLabel(aiData?.revision || docItem.revision_label || 'Rev 1');
        setTagsInput((docItem.tags || []).join(', '));
        setIsConfidential(docItem.is_confidential || false);

      } catch (err) {
        console.error(err);
        setError('Failed to fetch document signed preview URL');
      } finally {
        setLoading(false);
      }
    };

    init();
  }, [docItem]);

  const handleReviewAction = async (action: 'VERIFIED' | 'REJECTED') => {
    setSaving(true);
    setError(null);

    try {
      const parsedTags = tagsInput.split(',').map(t => t.trim()).filter(Boolean);
      const corrections = {
        title,
        category,
        subcategory,
        issue_date: issueDate || null,
        expiry_date: expiryDate || null,
        amount_aed: amountAed === '' ? null : Number(amountAed),
        revision_label: revisionLabel || null,
        tags: parsedTags,
        is_confidential: isConfidential
      };

      await documentService.reviewDocument(docItem.id, action, corrections);
      onReviewed();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to complete document review decision.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', height: 'calc(100vh - 120px)' }}>
      {/* Header controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button type="button" className="quote-btn quote-btn-secondary" onClick={onBack}>
          <ArrowLeft size={14} /> Back to Review Registry
        </button>
        <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
          Reviewing: <strong style={{ color: '#ffffff' }}>{docItem.original_filename}</strong>
        </span>
      </div>

      {error && (
        <div style={{ color: '#ef4444', fontSize: '0.85rem', background: 'rgba(239, 68, 68, 0.1)', padding: '0.8rem', borderRadius: '6px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
          {error}
        </div>
      )}

      {/* Main split grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1.5rem', flex: 1, minHeight: 0 }}>
        
        {/* LEFT PANE: PDF/Image Iframe Preview */}
        <div 
          className="quote-card" 
          style={{ 
            margin: 0, 
            padding: 0, 
            overflow: 'hidden', 
            background: 'rgba(0,0,0,0.4)', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            height: '100%'
          }}
        >
          {loading ? (
            <div style={{ textAlign: 'center' }}>
              <div className="spinner"></div>
              <p style={{ marginTop: '1rem', color: 'var(--text-secondary)' }}>Loading preview window...</p>
            </div>
          ) : signedUrl ? (
            <iframe 
              src={`${signedUrl}#toolbar=0&navpanes=0`} 
              width="100%" 
              height="100%" 
              style={{ border: 'none' }}
              title="File Document Preview"
            />
          ) : (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
              <AlertTriangle size={32} style={{ margin: '0 auto 0.5rem auto' }} />
              <p>Preview unavailable for this file format</p>
            </div>
          )}
        </div>

        {/* RIGHT PANE: Suggestion/Correction Form */}
        <div 
          className="quote-card" 
          style={{ 
            margin: 0, 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '1.2rem',
            overflowY: 'auto',
            height: '100%'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', borderBottom: '1px solid var(--surface-hover)', paddingBottom: '0.6rem' }}>
            <Settings size={18} style={{ color: 'var(--primary)' }} />
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#ffffff' }}>
              AI Suggested Classification
            </h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
            <div className="quote-form-group">
              <label>Document Title</label>
              <input 
                type="text" 
                value={title} 
                onChange={(e) => setTitle(e.target.value)} 
                className="quote-form-input" 
                required 
              />
            </div>

            <div className="quote-form-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <div className="quote-form-group">
                <label>Category</label>
                <input 
                  type="text" 
                  value={category} 
                  onChange={(e) => setCategory(e.target.value)} 
                  className="quote-form-input" 
                  required 
                />
              </div>
              <div className="quote-form-group">
                <label>Subcategory</label>
                <input 
                  type="text" 
                  value={subcategory} 
                  onChange={(e) => setSubcategory(e.target.value)} 
                  className="quote-form-input" 
                  required 
                />
              </div>
            </div>

            <div className="quote-form-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <div className="quote-form-group">
                <label>Issue Date</label>
                <input 
                  type="date" 
                  value={issueDate} 
                  onChange={(e) => setIssueDate(e.target.value)} 
                  className="quote-form-input" 
                />
              </div>
              <div className="quote-form-group">
                <label>Expiry Date</label>
                <input 
                  type="date" 
                  value={expiryDate} 
                  onChange={(e) => setExpiryDate(e.target.value)} 
                  className="quote-form-input" 
                />
              </div>
            </div>

            <div className="quote-form-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <div className="quote-form-group">
                <label>Valuation Amount (AED)</label>
                <input 
                  type="number" 
                  value={amountAed} 
                  onChange={(e) => setAmountAed(e.target.value === '' ? '' : Number(e.target.value))} 
                  className="quote-form-input" 
                  placeholder="AED 0.00"
                />
              </div>
              <div className="quote-form-group">
                <label>Revision Label</label>
                <input 
                  type="text" 
                  value={revisionLabel} 
                  onChange={(e) => setRevisionLabel(e.target.value)} 
                  className="quote-form-input" 
                />
              </div>
            </div>

            <div className="quote-form-group">
              <label>Tags (Comma Separated)</label>
              <input 
                type="text" 
                value={tagsInput} 
                onChange={(e) => setTagsInput(e.target.value)} 
                className="quote-form-input" 
              />
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', cursor: 'pointer', color: 'var(--text-primary)', marginTop: '0.3rem' }}>
              <input 
                type="checkbox" 
                checked={isConfidential} 
                onChange={(e) => setIsConfidential(e.target.checked)} 
                style={{ accentColor: 'var(--primary)' }}
              />
              Restrict document visibility (Admin/Managers only)
            </label>
            
            {/* AI Summary note (if populated) */}
            {docItem.ai_summary && (
              <div style={{ background: 'rgba(0,229,160,0.02)', border: '1px solid rgba(0,229,160,0.1)', padding: '0.8rem', borderRadius: '6px', fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                <strong style={{ color: '#ffffff', display: 'block', marginBottom: '0.2rem' }}>Gemini Extraction Note:</strong>
                {docItem.ai_summary}
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: '1rem', marginTop: 'auto', borderTop: '1px solid var(--surface-hover)', paddingTop: '1.2rem' }}>
            <button 
              type="button" 
              className="quote-btn quote-btn-danger" 
              style={{ flex: 1 }}
              onClick={() => handleReviewAction('REJECTED')}
              disabled={saving}
            >
              <X size={14} /> Reject File
            </button>
            
            <button 
              type="button" 
              className="quote-btn quote-btn-primary" 
              style={{ flex: 1.5 }}
              onClick={() => handleReviewAction('VERIFIED')}
              disabled={saving}
            >
              <Check size={14} /> Verify & File
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
// Default export
export default ReviewQueueSplitView;
