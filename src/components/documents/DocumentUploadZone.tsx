// ============================================================
// JEET ERP — Document Upload Zone Component
// Drag-drop files with live queue state, duplicate resolving, and tags/confidential selection
// ============================================================

import React, { useState, useRef } from 'react';
import { useDocumentUpload } from '@/hooks/useDocumentUpload';
import { Upload, X, AlertTriangle, FileText, CheckCircle, RefreshCw } from 'lucide-react';
import type { DocumentEntityType } from '@/types/document.types';

type Props = {
  entityType: DocumentEntityType;
  entityId?: string;
  onUploadComplete?: () => void;
};

export const DocumentUploadZone: React.FC<Props> = ({
  entityType,
  entityId,
  onUploadComplete
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { queue, addFiles, removeQueueItem, retryUpload, clearQueue } = useDocumentUpload(entityType, entityId);
  
  // Custom states for options
  const [tagsInput, setTagsInput] = useState('');
  const [isConfidential, setIsConfidential] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  
  // Resolve duplicate dialog state
  const [duplicateResolver, setDuplicateResolver] = useState<{
    itemId: string;
    existingId: string;
    existingTitle: string;
  } | null>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files);
      const parsedTags = tagsInput.split(',').map(t => t.trim()).filter(Boolean);
      addFiles(files, parsedTags, isConfidential);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files);
      const parsedTags = tagsInput.split(',').map(t => t.trim()).filter(Boolean);
      addFiles(files, parsedTags, isConfidential);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  // Check queue for duplicates
  const detectDuplicates = () => {
    const duplicateItem = queue.find(item => item.status === 'error' && item.error?.startsWith('DUPLICATE_FOUND:'));
    if (duplicateItem && (!duplicateResolver || duplicateResolver.itemId !== duplicateItem.id)) {
      const [_, existingId, existingTitle] = duplicateItem.error!.split(':');
      setDuplicateResolver({
        itemId: duplicateItem.id,
        existingId,
        existingTitle
      });
    }
  };

  // Run duplicate check on render
  detectDuplicates();

  const resolveDuplicate = (action: 'skip' | 'revision') => {
    if (!duplicateResolver) return;

    const { itemId, existingId } = duplicateResolver;
    setDuplicateResolver(null);

    if (action === 'skip') {
      removeQueueItem(itemId);
    } else if (action === 'revision') {
      const parsedTags = tagsInput.split(',').map(t => t.trim()).filter(Boolean);
      retryUpload(itemId, parsedTags, isConfidential, existingId);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
      
      {/* Upload Settings options */}
      <div className="quote-form-grid" style={{ gridTemplateColumns: '1fr auto', alignItems: 'center', gap: '1.5rem', background: 'var(--surface-hover)', padding: '0.8rem', borderRadius: '8px', border: '1px solid var(--surface-hover)' }}>
        <div className="quote-form-group" style={{ margin: 0 }}>
          <label>Add Tags to uploaded files (Comma separated)</label>
          <input 
            type="text" 
            value={tagsInput} 
            onChange={(e) => setTagsInput(e.target.value)} 
            className="quote-form-input" 
            placeholder="e.g. approved, architectural, contract"
          />
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', cursor: 'pointer', color: 'var(--text-primary)', marginTop: '1.2rem' }}>
          <input 
            type="checkbox" 
            checked={isConfidential} 
            onChange={(e) => setIsConfidential(e.target.checked)} 
            style={{ width: '16px', height: '16px', accentColor: 'var(--primary)' }}
          />
          Is Confidential (Access Gated)
        </label>
      </div>

      {/* Drag & Drop Area */}
      <div 
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        onClick={triggerFileInput}
        style={{
          border: '2px dashed',
          borderColor: dragActive ? 'var(--primary)' : 'var(--border-color)',
          borderRadius: '12px',
          padding: '2.5rem 1.5rem',
          textAlign: 'center',
          cursor: 'pointer',
          background: dragActive ? 'color-mix(in srgb, var(--primary) 4%, transparent)' : 'rgba(0, 0, 0, 0.15)',
          transition: 'var(--transition-smooth)'
        }}
      >
        <input 
          ref={fileInputRef}
          type="file" 
          multiple
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />
        <Upload size={36} style={{ color: 'var(--text-secondary)', margin: '0 auto 0.8rem auto', opacity: 0.6 }} />
        <h4 style={{ fontSize: '0.9rem', fontWeight: 600, color: '#ffffff', marginBottom: '0.4rem' }}>
          Drag & drop files here, or <span style={{ color: 'var(--primary)' }}>browse</span>
        </h4>
        <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
          PDF, JPEG, PNG, DOCX, XLSX, DWG, ZIP (Max 50MB per file)
        </p>
      </div>

      {/* Upload Queue list */}
      {queue.length > 0 && (
        <div className="quote-card" style={{ margin: 0, padding: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--surface-hover)', paddingBottom: '0.5rem', marginBottom: '0.8rem' }}>
            <h4 style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
              Filing Queue ({queue.length})
            </h4>
            <button 
              type="button" 
              className="quote-btn quote-btn-secondary" 
              style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem' }}
              onClick={() => {
                clearQueue();
                if (onUploadComplete) onUploadComplete();
              }}
            >
              Clear Queue
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {queue.map((item) => {
              const isDone = item.status === 'filed' || item.status === 'review';
              const isError = item.status === 'error';
              
              return (
                <div 
                  key={item.id}
                  style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center', 
                    padding: '0.6rem 0.8rem', 
                    background: 'rgba(0,0,0,0.15)', 
                    border: '1px solid var(--surface-hover)', 
                    borderRadius: '6px' 
                  }}
                >
                  <div style={{ flex: 1, marginRight: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                      <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#ffffff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '240px' }}>
                        {item.filename}
                      </span>
                      <span style={{ fontSize: '0.7rem', color: isError ? '#ef4444' : isDone ? '#10b981' : 'var(--text-secondary)', fontWeight: 600 }}>
                        {item.status === 'uploading' ? `Uploading ${item.progress}%` : 
                         item.status === 'extracting' ? 'Extracting Text...' :
                         item.status === 'classifying' ? 'AI Analyzing...' :
                         item.status === 'filed' ? 'Auto Filed ✓' :
                         item.status === 'review' ? 'Needs Review ⚠' :
                         item.status === 'error' && item.error?.startsWith('DUPLICATE_FOUND:') ? 'Duplicate Check failed' :
                         'Error'}
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div style={{ width: '100%', height: '4px', background: 'var(--surface-hover)', borderRadius: '2px', overflow: 'hidden' }}>
                      <div 
                        style={{ 
                          width: `${item.progress}%`, 
                          height: '100%', 
                          background: isError ? '#ef4444' : 'var(--primary)',
                          transition: 'width 0.2s' 
                        }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {isDone && (
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        Category: {item.category}
                      </span>
                    )}
                    <button 
                      type="button" 
                      style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px' }}
                      onClick={() => removeQueueItem(item.id)}
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Duplicate Resolution Dialog */}
      {duplicateResolver && (
        <div className="quote-modal-overlay">
          <div className="quote-modal" style={{ maxWidth: '450px', width: '90%' }}>
            <div className="quote-modal-header" style={{ borderBottomColor: 'rgba(239, 68, 68, 0.2)' }}>
              <h3 className="quote-card-title" style={{ color: '#fca5a5' }}>
                <AlertTriangle size={18} /> Duplicate File Detected
              </h3>
            </div>
            <div className="quote-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                The file you are uploading matches the SHA-256 fingerprint of an existing active document: 
                <strong style={{ color: '#ffffff', display: 'block', margin: '0.5rem 0' }}>
                  {duplicateResolver.existingTitle}
                </strong>
                What action would you like to take?
              </p>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginTop: '0.5rem' }}>
                <button 
                  type="button" 
                  className="quote-btn quote-btn-primary" 
                  style={{ width: '100%', justifyContent: 'flex-start', background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.3)', color: 'var(--primary)' }}
                  onClick={() => resolveDuplicate('revision')}
                >
                  <RefreshCw size={14} /> Upload as a new Revision (e.g. Rev 2)
                </button>
                
                <button 
                  type="button" 
                  className="quote-btn quote-btn-secondary" 
                  style={{ width: '100%', justifyContent: 'flex-start' }}
                  onClick={() => resolveDuplicate('skip')}
                >
                  <X size={14} /> Skip / Cancel Upload
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
