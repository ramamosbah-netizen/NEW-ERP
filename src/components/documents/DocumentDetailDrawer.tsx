// ============================================================
// JEET ERP — Document Detail Slide-out Drawer Component
// Sidebar panel to view document metadata, AI summary, revisions, activity log, and edit details
// ============================================================

import { logger } from '@/lib/logger';
import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { documentService } from '@/lib/document-service';
import type { Document } from '@/types/document.types';
import { X, Edit2, Check, Download, AlertTriangle, FileText, Calendar, Tag, ShieldCheck, History } from 'lucide-react';
import { DocumentProcessingChip } from './DocumentProcessingChip';

type Props = {
  documentId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate?: () => void;
};

export const DocumentDetailDrawer: React.FC<Props> = ({
  documentId,
  isOpen,
  onClose,
  onUpdate
}) => {
  const [doc, setDoc] = useState<Document | null>(null);
  const [loading, setLoading] = useState(false);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  
  // Edit Form States
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [subcategory, setSubcategory] = useState('');
  const [issueDate, setIssueDate] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [amountAed, setAmountAed] = useState<number | ''>('');
  const [revisionLabel, setRevisionLabel] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [isConfidential, setIsConfidential] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadDetails = async () => {
      if (!documentId || !isOpen) return;
      try {
        setLoading(true);
        setError(null);
        setEditMode(false);
        
        // Fetch detailed record
        const data = await documentService.fetchDocumentById(documentId);
        setDoc(data);

        if (data) {
          // Pre-fill edit forms
          setTitle(data.title);
          setCategory(data.category);
          setSubcategory(data.subcategory);
          setIssueDate(data.issue_date || '');
          setExpiryDate(data.expiry_date || '');
          setAmountAed(data.amount_aed !== undefined && data.amount_aed !== null ? data.amount_aed : '');
          setRevisionLabel(data.revision_label || '');
          setTagsInput((data.tags || []).join(', '));
          setIsConfidential(data.is_confidential);

          // Get signed URL
          const url = await documentService.getSignedUrl(data.storage_path);
          setSignedUrl(url);
        }
      } catch (err: any) {
        logger.error(err);
        setError('Failed to load document details');
      } finally {
        setLoading(false);
      }
    };

    loadDetails();
  }, [documentId, isOpen]);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!documentId) return;

    setSaving(true);
    setError(null);

    try {
      const parsedTags = tagsInput.split(',').map(t => t.trim()).filter(Boolean);
      const updates = {
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

      await documentService.updateMetadata(documentId, updates);
      setEditMode(false);
      
      // Refresh details
      const refreshed = await documentService.fetchDocumentById(documentId);
      setDoc(refreshed);
      if (onUpdate) onUpdate();
    } catch (err: any) {
      logger.error(err);
      setError(err.message || 'Failed to save metadata');
    } finally {
      setSaving(false);
    }
  };

  const handleDownload = () => {
    if (signedUrl) {
      window.open(signedUrl, '_blank');
    }
  };

  return (
    <div 
      style={{ 
        position: 'fixed', 
        top: 0, 
        right: 0, 
        bottom: 0, 
        width: '460px', 
        background: 'rgba(10, 14, 34, 0.96)', 
        borderLeft: '1px solid var(--border-color)', 
        boxShadow: '-10px 0 40px rgba(0, 0, 0, 0.6)', 
        zIndex: 100, 
        display: 'flex', 
        flexDirection: 'column',
        backdropFilter: 'blur(20px)',
        transform: 'translateX(0)',
        transition: 'transform 0.3s ease-out'
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.2rem', borderBottom: '1px solid var(--surface-hover)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <FileText size={18} style={{ color: 'var(--secondary)' }} />
          <span style={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)' }}>
            Document Card
          </span>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {doc && !editMode && (
            <button 
              type="button" 
              className="quote-btn quote-btn-secondary" 
              style={{ padding: '0.35rem 0.7rem', fontSize: '0.75rem' }}
              onClick={() => setEditMode(true)}
            >
              <Edit2 size={12} /> Edit
            </button>
          )}
          <button 
            type="button" 
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Body Area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {loading ? (
          <div style={{ padding: '4rem 0', textAlign: 'center' }}>
            <div className="spinner" style={{ margin: '0 auto 1rem auto' }}></div>
            <p style={{ color: 'var(--text-secondary)' }}>Loading file details...</p>
          </div>
        ) : error ? (
          <div style={{ color: '#ef4444', textAlign: 'center', padding: '2rem 0' }}>
            <AlertTriangle size={32} style={{ margin: '0 auto 1rem auto' }} />
            <p>{error}</p>
          </div>
        ) : doc ? (
          <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            
            {/* Title Display or Edit */}
            {editMode ? (
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
            ) : (
              <div>
                <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#ffffff', lineHeight: '1.3' }}>
                  {doc.title}
                </h2>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center', marginTop: '0.6rem' }}>
                  <DocumentProcessingChip status={doc.status} confidence={doc.ai_confidence} />
                  {doc.is_confidential && (
                    <span style={{ fontSize: '0.65rem', background: 'rgba(239, 68, 68, 0.1)', color: '#fca5a5', padding: '2px 6px', borderRadius: '4px', border: '1px solid rgba(239, 68, 68, 0.2)', fontWeight: 700 }}>
                      CONFIDENTIAL
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Standard Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', background: 'rgba(0,0,0,0.15)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--surface-hover)', fontSize: '0.8rem' }}>
              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '0.2rem' }}>Original File</span>
                <span style={{ fontWeight: 500, color: 'var(--text-secondary)', wordBreak: 'break-all' }}>{doc.original_filename}</span>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '0.2rem' }}>Filing Reference</span>
                <span style={{ fontWeight: 500, color: 'var(--text-secondary)' }}>{doc.entity_type} {doc.project_name ? `• ${doc.project_name}` : ''}</span>
              </div>
            </div>

            {/* Classification & Metadata */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', borderBottom: '1px solid var(--surface-hover)', paddingBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)', letterSpacing: '0.05em' }}>
                Filing Taxonomy
              </h3>

              {editMode ? (
                <>
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
                      <label>Amount (AED)</label>
                      <input 
                        type="number" 
                        value={amountAed} 
                        onChange={(e) => setAmountAed(e.target.value === '' ? '' : Number(e.target.value))} 
                        className="quote-form-input" 
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
                    Restrict document confidentiality (Admin/Managers only)
                  </label>
                </>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', fontSize: '0.82rem' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Folder Category:</span>
                    <span style={{ fontWeight: 600, color: '#ffffff' }}>{doc.category} &rarr; {doc.subcategory.replace('_', ' ')}</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Issue Date:</span>
                    <span>{doc.issue_date ? new Date(doc.issue_date).toLocaleDateString('en-GB') : 'N/A'}</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Expiry Date:</span>
                    <span style={{ fontWeight: doc.expiry_date ? 600 : 400 }}>{doc.expiry_date ? new Date(doc.expiry_date).toLocaleDateString('en-GB') : 'N/A'}</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Valuation Amount:</span>
                    <span style={{ fontWeight: 700, color: doc.amount_aed ? '#10b981' : 'var(--text-primary)' }}>
                      {doc.amount_aed ? `AED ${doc.amount_aed.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : 'N/A'}
                    </span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Revision:</span>
                    <span>{doc.revision_label || 'Rev 1'} (Number: {doc.revision_number})</span>
                  </div>
                  {doc.tags && doc.tags.length > 0 && (
                    <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', alignItems: 'center' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Tags:</span>
                      <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                        {doc.tags.map(t => <span key={t} style={{ fontSize: '0.65rem', background: 'var(--surface-hover)', color: 'var(--text-secondary)', padding: '2px 6px', borderRadius: '4px' }}>{t}</span>)}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* AI Summary */}
            {!editMode && doc.ai_summary && (
              <div style={{ borderBottom: '1px solid var(--surface-hover)', paddingBottom: '1.5rem' }}>
                <h3 style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
                  AI Summary & Content Highlights
                </h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: '1.4', background: 'rgba(0,0,0,0.12)', padding: '0.8rem', borderRadius: '6px', border: '1px solid var(--surface-hover)' }}>
                  {doc.ai_summary}
                </p>
              </div>
            )}

            {/* Revision chain stack */}
            {!editMode && doc.revisions && doc.revisions.length > 0 && (
              <div style={{ borderBottom: '1px solid var(--surface-hover)', paddingBottom: '1.5rem' }}>
                <h3 style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
                  Revision Stack History
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  {doc.revisions.map((rev) => (
                    <div 
                      key={rev.id} 
                      style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center',
                        fontSize: '0.78rem',
                        padding: '0.4rem 0.6rem',
                        background: 'var(--surface-hover)',
                        border: '1px solid var(--surface-hover)',
                        borderRadius: '4px'
                      }}
                    >
                      <span style={{ fontWeight: 600 }}>{rev.revision_label}</span>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>
                        {new Date(rev.created_at).toLocaleDateString('en-GB')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Audit Log Activity */}
            {!editMode && doc.activity && doc.activity.length > 0 && (
              <div>
                <h3 style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)', letterSpacing: '0.05em', marginBottom: '0.6rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <History size={14} /> System Audit Logs
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '180px', overflowY: 'auto' }}>
                  {doc.activity.map((act) => (
                    <div key={act.id} style={{ fontSize: '0.72rem', color: 'var(--text-muted)', borderLeft: '2px solid var(--surface-hover)', paddingLeft: '0.5rem' }}>
                      <div style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>
                        {act.action} by {act.user_name}
                      </div>
                      <div>{new Date(act.created_at).toLocaleString('en-GB')}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Edit Mode Buttons */}
            {editMode && (
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
                <button 
                  type="button" 
                  className="quote-btn quote-btn-secondary" 
                  onClick={() => setEditMode(false)}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="quote-btn quote-btn-primary" 
                  disabled={saving}
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            )}
          </form>
        ) : null}
      </div>

      {/* Footer controls (Signed URLs Download) */}
      {doc && !editMode && (
        <div style={{ padding: '1.2rem', borderTop: '1px solid var(--surface-hover)', background: 'rgba(0, 0, 0, 0.2)', display: 'grid', gridTemplateColumns: '1fr' }}>
          <button 
            type="button" 
            className="quote-btn quote-btn-primary" 
            style={{ width: '100%' }}
            onClick={handleDownload}
            disabled={!signedUrl}
          >
            <Download size={14} /> Open / Download File
          </button>
        </div>
      )}
    </div>
  );
};
