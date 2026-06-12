// ============================================================
// JEET ERP — Document List Table Component
// Renders documents list with file extension icons, AI status, and quick drawer actions
// ============================================================

import React from 'react';
import { 
  FileText, 
  FileSpreadsheet, 
  FileCode, 
  FileImage, 
  File, 
  Calendar, 
  Eye, 
  CheckSquare, 
  Download, 
  Trash2, 
  ShieldAlert 
} from 'lucide-react';
import type { Document } from '@/types/document.types';
import { DocumentProcessingChip } from './DocumentProcessingChip';

type Props = {
  documents: Document[];
  onSelect: (doc: Document) => void;
  onReview?: (doc: Document) => void;
  onDelete?: (docId: string) => void;
  onDownload?: (doc: Document) => void;
};

const getFileIcon = (ext: string) => {
  const e = ext.toLowerCase();
  if (['pdf'].includes(e)) return { Icon: FileText, color: '#ef4444' };
  if (['xlsx', 'xls', 'csv'].includes(e)) return { Icon: FileSpreadsheet, color: '#10b981' };
  if (['docx', 'doc', 'txt'].includes(e)) return { Icon: FileText, color: '#3b82f6' };
  if (['png', 'jpg', 'jpeg', 'gif'].includes(e)) return { Icon: FileImage, color: 'var(--accent)' };
  if (['dwg', 'dxf'].includes(e)) return { Icon: FileCode, color: 'var(--secondary)' };
  return { Icon: File, color: 'var(--text-muted)' };
};

const fmtBytes = (bytes: number) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const fmtAED = (v?: number) => {
  if (v === undefined || v === null) return 'N/A';
  return 'AED ' + new Intl.NumberFormat('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
};

export const DocumentTable: React.FC<Props> = ({
  documents,
  onSelect,
  onReview,
  onDelete,
  onDownload
}) => {
  if (documents.length === 0) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
        <FileText size={48} style={{ margin: '0 auto 1rem auto', opacity: 0.3 }} />
        <p>No documents found in this folder</p>
      </div>
    );
  }

  return (
    <div className="quote-table-wrap">
      <table className="quote-table">
        <thead>
          <tr>
            <th>File Name</th>
            <th>Folder / Subcategory</th>
            <th>AI Status</th>
            <th>Expiry Date</th>
            <th style={{ textAlign: 'right' }}>Amount</th>
            <th>Upload Date</th>
            <th style={{ textAlign: 'center' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {documents.map((doc) => {
            const { Icon, color } = getFileIcon(doc.file_ext);
            
            // Check expiry alerts
            let expiryColor = 'var(--text-primary)';
            let isExpiringSoon = false;
            let isExpired = false;
            if (doc.expiry_date) {
              const exp = new Date(doc.expiry_date);
              const today = new Date();
              today.setHours(0,0,0,0);
              const diff = exp.getTime() - today.getTime();
              const diffDays = Math.ceil(diff / (1000 * 60 * 60 * 24));
              
              if (diffDays < 0) {
                isExpired = true;
                expiryColor = '#ef4444';
              } else if (diffDays <= 30) {
                isExpiringSoon = true;
                expiryColor = 'var(--warning)';
              }
            }

            return (
              <tr key={doc.id}>
                {/* File Details */}
                <td style={{ verticalAlign: 'middle' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', cursor: 'pointer' }} onClick={() => onSelect(doc)}>
                    <Icon size={24} style={{ color: color, flexShrink: 0 }} />
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontWeight: 600, color: '#ffffff', fontSize: '0.85rem', maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={doc.title}>
                        {doc.title}
                      </span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        {doc.original_filename} ({fmtBytes(doc.file_size_bytes)}) {doc.revision_label && `• ${doc.revision_label}`}
                      </span>
                    </div>
                  </div>
                </td>

                {/* Category & Subcategory */}
                <td>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                      {doc.category}
                    </span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      {doc.subcategory.replace('_', ' ')}
                    </span>
                  </div>
                </td>

                {/* AI Status */}
                <td>
                  <DocumentProcessingChip status={doc.status} confidence={doc.ai_confidence} />
                </td>

                {/* Expiry Date */}
                <td style={{ color: expiryColor }}>
                  {doc.expiry_date ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.82rem', fontWeight: (isExpired || isExpiringSoon) ? 700 : 500 }}>
                      <Calendar size={12} />
                      <span>{new Date(doc.expiry_date).toLocaleDateString('en-GB')}</span>
                      {isExpired && <span style={{ fontSize: '0.62rem', background: 'rgba(239, 68, 68, 0.15)', padding: '1px 4px', borderRadius: '3px' }}>Expired</span>}
                      {isExpiringSoon && <span style={{ fontSize: '0.62rem', background: 'rgba(245, 158, 11, 0.15)', padding: '1px 4px', borderRadius: '3px' }}>Expiring 30d</span>}
                    </div>
                  ) : (
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>N/A</span>
                  )}
                </td>

                {/* Amount */}
                <td style={{ textAlign: 'right', fontWeight: 600, color: doc.amount_aed ? '#10b981' : 'var(--text-muted)' }}>
                  {doc.amount_aed ? fmtAED(doc.amount_aed) : '—'}
                </td>

                {/* Upload Date */}
                <td>
                  <span style={{ fontSize: '0.8rem' }}>
                    {new Date(doc.created_at).toLocaleDateString('en-GB')}
                  </span>
                </td>

                {/* Actions */}
                <td style={{ verticalAlign: 'middle' }}>
                  <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center' }}>
                    <button 
                      type="button" 
                      className="quote-btn quote-btn-secondary" 
                      style={{ padding: '0.3rem 0.5rem' }} 
                      title="View Details"
                      onClick={() => onSelect(doc)}
                    >
                      <Eye size={12} />
                    </button>
                    {doc.status === 'NEEDS_REVIEW' && onReview && (
                      <button 
                        type="button" 
                        className="quote-btn quote-btn-primary" 
                        style={{ padding: '0.3rem 0.5rem', background: 'rgba(245, 158, 11, 0.15)', border: '1px solid rgba(245, 158, 11, 0.3)', color: '#fcd34d' }} 
                        title="AI Verification Review"
                        onClick={() => onReview(doc)}
                      >
                        <CheckSquare size={12} />
                      </button>
                    )}
                    {onDownload && (
                      <button 
                        type="button" 
                        className="quote-btn quote-btn-secondary" 
                        style={{ padding: '0.3rem 0.5rem' }} 
                        title="Download file"
                        onClick={() => onDownload(doc)}
                      >
                        <Download size={12} />
                      </button>
                    )}
                    {onDelete && (
                      <button 
                        type="button" 
                        className="quote-btn quote-btn-danger" 
                        style={{ padding: '0.3rem 0.5rem' }} 
                        title="Delete document"
                        onClick={() => {
                          if (window.confirm(`Are you sure you want to delete "${doc.title}"?`)) {
                            onDelete(doc.id);
                          }
                        }}
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
