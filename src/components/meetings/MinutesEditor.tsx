// ============================================================
// JEET ERP — Meeting Minutes Editor & AI Action Item Extractor
// ============================================================

'use client';
import { logger } from '@/lib/logger';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { meetingService } from '@/services/meetingService';
import { 
  Sparkles, 
  Plus, 
  Trash, 
  User, 
  Calendar, 
  FileText, 
  AlertCircle, 
  RefreshCw, 
  CheckCircle2 
} from 'lucide-react';

type ActionItemInput = {
  description: string;
  assignee_id?: string;
  due_date?: string;
};

type Props = {
  meetingId: string;
  onPublished: () => void;
  onCancel: () => void;
};

export const MinutesEditor: React.FC<Props> = ({ meetingId, onPublished, onCancel }) => {
  const [minutesText, setMinutesText] = useState('');
  const [actionItems, setActionItems] = useState<ActionItemInput[]>([]);
  const [profiles, setProfiles] = useState<Array<{ id: string; full_name: string }>>([]);
  
  // Loading & Error States
  const [loading, setLoading] = useState(false);
  const [aiExtracting, setAiExtracting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Fetch profiles
    supabase.from('profiles').select('id, full_name').then(({ data }) => {
      if (data) setProfiles(data);
    });
  }, []);

  // AI Extraction Trigger
  const handleAIExtract = async () => {
    if (!minutesText.trim()) {
      setError('Please enter some meeting minutes text first');
      return;
    }

    try {
      setAiExtracting(true);
      setError(null);

      const items = await meetingService.extractActionItems(minutesText);
      
      const parsedItems: ActionItemInput[] = items.map(item => {
        // Find suggested assignee ID by matching name
        let matchedId = '';
        if (item.suggested_assignee_name) {
          const match = profiles.find(p =>
            p.full_name.toLowerCase().includes(item.suggested_assignee_name!.toLowerCase())
          );
          if (match) matchedId = match.id;
        }

        // Calculate due date based on suggested due days
        let dueDateStr = '';
        if (item.suggested_due_days) {
          const d = new Date();
          // Skip weekends/nights? Simple day add here, client-side, is sufficient
          d.setDate(d.getDate() + item.suggested_due_days);
          dueDateStr = d.toISOString().split('T')[0];
        }

        return {
          description: item.description,
          assignee_id: matchedId || undefined,
          due_date: dueDateStr || undefined
        };
      });

      setActionItems(prev => [...prev, ...parsedItems]);
    } catch (err: any) {
      logger.error(err);
      setError(err.message || 'AI extraction failed. Please add items manually.');
    } finally {
      setAiExtracting(false);
    }
  };

  const addActionItem = () => {
    setActionItems(prev => [...prev, { description: '', assignee_id: '', due_date: '' }]);
  };

  const updateActionItem = (idx: number, field: keyof ActionItemInput, value: string) => {
    setActionItems(prev =>
      prev.map((item, i) => (i === idx ? { ...item, [field]: value || undefined } : item))
    );
  };

  const removeActionItem = (idx: number) => {
    setActionItems(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!minutesText.trim()) {
      setError('Minutes content is required');
      return;
    }

    // Filter out items with empty descriptions
    const validItems = actionItems.filter(item => item.description.trim().length > 0);

    try {
      setLoading(true);
      setError(null);

      await meetingService.publishMinutes(meetingId, minutesText.trim(), validItems);
      onPublished();
    } catch (err: any) {
      logger.error(err);
      setError(err.message || 'Failed to publish minutes');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="p-3 bg-error-glow border border-error/20 text-error rounded-lg flex items-start gap-2 text-xs">
          <AlertCircle size={16} className="text-error mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Minutes Content Markdown Box */}
      <div className="quote-form-group">
        <label className="flex items-center gap-1.5"><FileText size={14} /> Meeting Minutes Markdown</label>
        <textarea
          required
          placeholder="# Minutes of Site Coordination Meeting&#10;&#10;## Discussion Points&#10;- Discussed MEP drawings approvals.&#10;- Subcontractor mobilization on site is delayed by 2 days.&#10;&#10;## Key Decisions&#10;- Approved the updated structural shop drawings."
          value={minutesText}
          onChange={(e) => setMinutesText(e.target.value)}
          className="quote-form-textarea font-mono text-xs leading-relaxed"
          rows={10}
        />
      </div>

      {/* AI Extraction Button */}
      <div className="flex justify-between items-center bg-bg-dark/25 border border-border-color rounded-xl p-4">
        <div>
          <h4 className="text-xs font-semibold text-text-primary">AI Action Item Extractor</h4>
          <p className="text-[10px] text-text-muted mt-0.5">Gemini will auto-parse the text to suggest action items, assignees, and dates.</p>
        </div>
        <button
          type="button"
          onClick={handleAIExtract}
          disabled={aiExtracting || !minutesText.trim()}
          className="quote-btn bg-primary text-bg-dark hover:bg-primary-hover font-bold cursor-pointer"
        >
          {aiExtracting ? (
            <>
              <RefreshCw className="animate-spin" size={14} />
              AI Extracting...
            </>
          ) : (
            <>
              <Sparkles size={14} />
              AI Extract
            </>
          )}
        </button>
      </div>

      {/* Action Items List Grid */}
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">
            Action Items & Task Deliverables ({actionItems.length})
          </label>
          <button
            type="button"
            onClick={addActionItem}
            className="text-xs text-primary hover:text-primary-hover transition-colors flex items-center gap-1 font-bold font-mono cursor-pointer"
          >
            <Plus size={14} />
            ADD MANUAL ITEM
          </button>
        </div>

        {actionItems.length === 0 ? (
          <div className="text-center py-8 border border-dashed border-border-color rounded-xl text-text-muted text-xs italic">
            No action items assigned. Click "AI Extract" or "Add Manual Item".
          </div>
        ) : (
          <div className="space-y-2">
            {actionItems.map((item, idx) => (
              <div
                key={idx}
                className="flex flex-col sm:flex-row gap-3 p-3 bg-bg-dark/60 border border-border-color rounded-xl items-start sm:items-center"
              >
                {/* Description */}
                <input
                  type="text"
                  required
                  placeholder="Task description"
                  value={item.description}
                  onChange={(e) => updateActionItem(idx, 'description', e.target.value)}
                  className="flex-1 bg-bg-dark border border-border-color rounded px-2.5 py-1.5 text-xs text-text-primary outline-none focus:border-primary"
                />

                {/* Assignee */}
                <div className="flex items-center gap-1.5 w-full sm:w-[150px]">
                  <User size={12} className="text-text-secondary" />
                  <select
                    value={item.assignee_id || ''}
                    onChange={(e) => updateActionItem(idx, 'assignee_id', e.target.value)}
                    className="flex-1 bg-bg-dark border border-border-color rounded px-1.5 py-1 text-[11px] text-text-secondary outline-none"
                  >
                    <option value="">Unassigned</option>
                    {profiles.map(p => (
                      <option key={p.id} value={p.id}>{p.full_name}</option>
                    ))}
                  </select>
                </div>

                {/* Due Date */}
                <div className="flex items-center gap-1.5 w-full sm:w-[130px]">
                  <Calendar size={12} className="text-text-secondary" />
                  <input
                    type="date"
                    value={item.due_date || ''}
                    onChange={(e) => updateActionItem(idx, 'due_date', e.target.value)}
                    className="flex-1 bg-bg-dark border border-border-color rounded px-1.5 py-1 text-[11px] text-text-secondary font-mono outline-none"
                  />
                </div>

                {/* Delete */}
                <button
                  type="button"
                  onClick={() => removeActionItem(idx)}
                  className="text-text-secondary hover:text-error p-1 self-end sm:self-center cursor-pointer"
                >
                  <Trash size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Form Buttons */}
      <div className="flex justify-end gap-3 pt-4 border-t border-border-color">
        <button
          type="button"
          onClick={onCancel}
          className="quote-btn quote-btn-secondary cursor-pointer"
          disabled={loading}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="quote-btn quote-btn-primary cursor-pointer"
          disabled={loading}
        >
          {loading ? 'Publishing...' : 'Publish Minutes & Create Tasks'}
        </button>
      </div>
    </form>
  );
};

export default MinutesEditor;
