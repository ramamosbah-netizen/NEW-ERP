// ============================================================
// JEET ERP — Project Status Transition Modal Component
// Dialog to choose next status, type comments, and specify reasons for Hold/Cancel
// ============================================================

import React, { useState, useEffect } from 'react';
import { getValidTransitions, validateTransition } from '@/lib/project-status-service';
import type { Project, ProjectStatus } from '@/types/project.types';

type Props = {
  project: Project;
  isOpen: boolean;
  onClose: () => void;
  onTransition: (toStatus: ProjectStatus, comment: string) => Promise<void>;
};

export const ProjectStatusTransitionModal: React.FC<Props> = ({
  project,
  isOpen,
  onClose,
  onTransition
}) => {
  const [selectedStatus, setSelectedStatus] = useState<ProjectStatus | ''>('');
  const [comment, setComment] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validOptions = getValidTransitions(project.status);

  useEffect(() => {
    if (isOpen) {
      setSelectedStatus('');
      setComment('');
      setError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStatus) {
      setError('Please select a target status.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Validate transition gates first
      const validation = validateTransition(project.status, selectedStatus, {
        ...project,
        on_hold_reason: comment,
        cancel_reason: comment
      });

      if (!validation.valid) {
        setError(validation.error || 'Transition validation failed.');
        setIsSubmitting(false);
        return;
      }

      await onTransition(selectedStatus, comment);
      onClose();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to update project status.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="quote-modal-overlay">
      <div className="quote-modal" style={{ maxWidth: '500px', width: '90%' }}>
        <div className="quote-modal-header">
          <h3 className="quote-card-title">Transition Project Status</h3>
          <button className="quote-btn quote-btn-secondary" style={{ padding: '0.3rem' }} onClick={onClose}>
            &times;
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="quote-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
          <div className="quote-form-group">
            <label>Current Status</label>
            <div className="quote-filter-input" style={{ background: 'var(--surface-hover)', color: 'var(--text-secondary)' }}>
              {project.status}
            </div>
          </div>

          <div className="quote-form-group">
            <label>Select Next Status</label>
            <select
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value as ProjectStatus);
                setError(null);
              }}
              className="quote-filter-input"
              required
            >
              <option value="">-- Choose next step --</option>
              {validOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt.replace('_', ' ')}
                </option>
              ))}
            </select>
          </div>

          {selectedStatus && (
            <div className="quote-form-group">
              <label>
                {selectedStatus === 'ON_HOLD' 
                  ? 'On Hold Reason' 
                  : selectedStatus === 'CANCELLED' 
                  ? 'Cancellation Reason' 
                  : selectedStatus === 'LOST'
                  ? 'Lost Reason (Mandatory)'
                  : 'Transition Comment'}
              </label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                className="quote-form-textarea"
                placeholder={
                  selectedStatus === 'ON_HOLD' 
                    ? 'State the reason for pausing project works...' 
                    : selectedStatus === 'CANCELLED' 
                    ? 'State the reason for cancelling this project...' 
                    : selectedStatus === 'LOST'
                    ? 'State the reason why the quotation was rejected / opportunity was lost...'
                    : 'Add details regarding this status change...'
                }
                required={selectedStatus === 'ON_HOLD' || selectedStatus === 'CANCELLED' || selectedStatus === 'LOST'}
              />
            </div>
          )}

          {error && (
            <div style={{ color: '#ef4444', fontSize: '0.85rem', background: 'rgba(239, 68, 68, 0.1)', padding: '0.6rem', borderRadius: '6px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
            <button type="button" className="quote-btn quote-btn-secondary" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </button>
            <button type="submit" className="quote-btn quote-btn-primary" disabled={isSubmitting}>
              {isSubmitting ? 'Updating...' : 'Apply Transition'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
