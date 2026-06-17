// ============================================================
// JEET ERP — Quick Add Task & Recurrence Editor Component
// ============================================================

'use client';
import { logger } from '@/lib/logger';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '@/lib/supabase';
import { Calendar, User, Briefcase, Plus, AlertCircle, Clock, RotateCcw } from 'lucide-react';
import type { Task, TaskPriority, TaskStatus } from '@/types/task.types';

type Props = {
  onTaskCreated: (task: Task) => void;
  projectId?: string; // Optional default project context
};

export const QuickAddTask: React.FC<Props> = ({ onTaskCreated, projectId }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);
  
  // Form States
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState(projectId || '');
  const [assigneeId, setAssigneeId] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('MEDIUM');
  const [dueDate, setDueDate] = useState('');
  const [tagInput, setTagInput] = useState('');
  
  // Recurrence States
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceFreq, setRecurrenceFreq] = useState<'DAILY' | 'WEEKLY' | 'MONTHLY'>('WEEKLY');
  const [recurrenceByDay, setRecurrenceByDay] = useState<string[]>([]);
  const [recurrenceUntil, setRecurrenceUntil] = useState('');

  // Dropdown options
  const [projects, setProjects] = useState<Array<{ id: string; name: string }>>([]);
  const [profiles, setProfiles] = useState<Array<{ id: string; full_name: string; role: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      // Fetch projects
      supabase.from('projects').select('id, name').eq('is_active', true).then(({ data }) => {
        if (data) setProjects(data);
      });
      // Fetch profiles
      supabase.from('profiles').select('id, full_name, role').then(({ data }) => {
        if (data) setProfiles(data);
      });
    }
  }, [isOpen]);

  const handleWeekdayToggle = (day: string) => {
    setRecurrenceByDay(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setSelectedProjectId(projectId || '');
    setAssigneeId('');
    setPriority('MEDIUM');
    setDueDate('');
    setTagInput('');
    setIsRecurring(false);
    setRecurrenceFreq('WEEKLY');
    setRecurrenceByDay([]);
    setRecurrenceUntil('');
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Task title is required');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const userRes = await supabase.auth.getUser();
      const currentUser = userRes.data.user;
      if (!currentUser) throw new Error('No authenticated user');

      const recurrenceData = isRecurring ? {
        freq: recurrenceFreq,
        byday: recurrenceFreq === 'WEEKLY' && recurrenceByDay.length > 0 ? recurrenceByDay : undefined,
        until: recurrenceUntil || undefined
      } : undefined;

      const tags = tagInput
        .split(',')
        .map(t => t.trim().toLowerCase())
        .filter(t => t.length > 0);

      const payload: Partial<Task> = {
        title: title.trim(),
        description: description.trim() || undefined,
        origin: 'MANUAL',
        project_id: selectedProjectId || undefined,
        assignee_id: assigneeId || undefined,
        priority,
        due_date: dueDate || undefined,
        recurrence: recurrenceData,
        tags,
        status: 'TODO'
      };

      // Call supabase directly or rely on service.
      const { taskService } = await import('@/services/taskService');
      const created = await taskService.createTask(payload);
      
      onTaskCreated(created);
      resetForm();
      setIsOpen(false);
    } catch (err: any) {
      logger.error(err);
      setError(err.message || 'Failed to create task');
    } finally {
      setLoading(false);
    }
  };

  const weekdays = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

  return (
    <div>
      <button
        onClick={() => setIsOpen(true)}
        className="quote-btn quote-btn-primary"
      >
        <Plus size={16} />
        Create Task
      </button>

      {isOpen && mounted && createPortal(
        <div className="fixed inset-0 w-screen h-screen bg-black/55 flex items-center justify-center z-[9999] p-4 font-body">
          <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl w-full max-w-xl shadow-2xl flex flex-col overflow-hidden max-h-[90vh] text-left">
            {/* Header */}
            <div className="flex justify-between items-center px-6 py-4 border-b border-[var(--border-color)] bg-[var(--bg-card-hover)]">
              <h3 className="font-bold text-[var(--text-primary)] text-sm flex items-center gap-2">
                <Plus size={16} className="text-[var(--accent)]" />
                Add New Task
              </h3>
              <button
                type="button"
                onClick={() => {
                  resetForm();
                  setIsOpen(false);
                }}
                className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-base font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 custom-scrollbar">
              {error && (
                <div className="p-3 bg-[var(--status-danger-bg)] border border-[var(--status-danger-border)] text-[var(--status-danger-text)] rounded-lg flex items-start gap-2 text-xs font-semibold">
                  <AlertCircle size={16} className="text-[var(--error)] mt-0.5 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Title */}
              <div className="quote-form-group">
                <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">Task Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Verify supplier commercial terms"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="quote-form-input text-xs font-semibold text-[var(--text-primary)]"
                />
              </div>

              {/* Description */}
              <div className="quote-form-group">
                <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">Description</label>
                <textarea
                  placeholder="Add details, checklists, or steps..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="quote-form-textarea text-xs text-[var(--text-primary)]"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Project */}
                <div className="quote-form-group">
                  <label className="flex items-center gap-1 text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                    <Briefcase size={12} className="text-[var(--text-secondary)]" /> Project
                  </label>
                  <select
                    value={selectedProjectId}
                    onChange={(e) => setSelectedProjectId(e.target.value)}
                    className="quote-form-input text-xs font-semibold text-[var(--text-primary)]"
                  >
                    <option value="" className="bg-[var(--bg-card)] text-[var(--text-primary)]">No Project Link</option>
                    {projects.map(p => (
                      <option key={p.id} value={p.id} className="bg-[var(--bg-card)] text-[var(--text-primary)]">{p.name}</option>
                    ))}
                  </select>
                </div>

                {/* Assignee */}
                <div className="quote-form-group">
                  <label className="flex items-center gap-1 text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                    <User size={12} className="text-[var(--text-secondary)]" /> Assignee
                  </label>
                  <select
                    value={assigneeId}
                    onChange={(e) => setAssigneeId(e.target.value)}
                    className="quote-form-input text-xs font-semibold text-[var(--text-primary)]"
                  >
                    <option value="" className="bg-[var(--bg-card)] text-[var(--text-primary)]">Unassigned</option>
                    {profiles.map(p => (
                      <option key={p.id} value={p.id} className="bg-[var(--bg-card)] text-[var(--text-primary)]">{p.full_name} ({p.role})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Priority */}
                <div className="quote-form-group">
                  <label className="flex items-center gap-1 text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                    <AlertCircle size={12} className="text-[var(--text-secondary)]" /> Priority
                  </label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as TaskPriority)}
                    className="quote-form-input font-mono text-xs font-semibold text-[var(--text-primary)]"
                  >
                    <option value="LOW" className="bg-[var(--bg-card)] text-[var(--text-primary)]">🔵 LOW</option>
                    <option value="MEDIUM" className="bg-[var(--bg-card)] text-[var(--text-primary)]">🟢 MEDIUM</option>
                    <option value="HIGH" className="bg-[var(--bg-card)] text-[var(--text-primary)]">🟡 HIGH</option>
                    <option value="URGENT" className="bg-[var(--bg-card)] text-[var(--text-primary)]">🔴 URGENT</option>
                  </select>
                </div>

                {/* Due Date */}
                <div className="quote-form-group">
                  <label className="flex items-center gap-1 text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                    <Calendar size={12} className="text-[var(--text-secondary)]" /> Due Date
                  </label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="quote-form-input font-mono text-xs font-semibold text-[var(--text-primary)]"
                  />
                </div>
              </div>

              {/* Tags */}
              <div className="quote-form-group">
                <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">Tags (Comma-separated)</label>
                <input
                  type="text"
                  placeholder="e.g. audit, urgent, billing"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  className="quote-form-input text-xs font-semibold text-[var(--text-primary)]"
                />
              </div>

              {/* Recurrence Trigger */}
              <div className="border-t border-[var(--border-color)] pt-3">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={isRecurring}
                    onChange={(e) => setIsRecurring(e.target.checked)}
                    className="rounded bg-[var(--bg-card)] border-[var(--border-color)] text-[var(--success)] focus:ring-0"
                  />
                  <span className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wide flex items-center gap-1.5">
                    <RotateCcw size={12} className={isRecurring ? 'animate-spin' : ''} />
                    Set Recurrence Schedule (Auto-Spawn)
                  </span>
                </label>

                {isRecurring && (
                  <div className="mt-3 p-3 bg-[var(--bg-card-hover)] border border-[var(--border-color)] rounded-lg space-y-3 animate-in slide-in-from-top-1 duration-200">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="quote-form-group">
                        <label className="text-[10px]">Frequency</label>
                        <select
                          value={recurrenceFreq}
                          onChange={(e) => setRecurrenceFreq(e.target.value as any)}
                          className="quote-form-input font-mono text-xs text-[var(--text-primary)] font-semibold"
                        >
                          <option value="DAILY" className="bg-[var(--bg-card)] text-[var(--text-primary)]">DAILY</option>
                          <option value="WEEKLY" className="bg-[var(--bg-card)] text-[var(--text-primary)]">WEEKLY</option>
                          <option value="MONTHLY" className="bg-[var(--bg-card)] text-[var(--text-primary)]">MONTHLY</option>
                        </select>
                      </div>

                      <div className="quote-form-group">
                        <label className="text-[10px]">End Date (Until)</label>
                        <input
                          type="date"
                          value={recurrenceUntil}
                          onChange={(e) => setRecurrenceUntil(e.target.value)}
                          className="quote-form-input font-mono text-xs text-[var(--text-primary)] font-semibold"
                        />
                      </div>
                    </div>

                    {recurrenceFreq === 'WEEKLY' && (
                      <div className="quote-form-group">
                        <label className="text-[10px]">Repeat On (UAE Working days: Sun-Thu)</label>
                        <div className="flex gap-1.5 mt-1">
                          {weekdays.map(day => {
                            const active = recurrenceByDay.includes(day);
                            return (
                              <button
                                key={day}
                                type="button"
                                onClick={() => handleWeekdayToggle(day)}
                                className={`h-8 w-8 rounded text-[10px] font-bold transition-all border ${
                                  active
                                    ? 'bg-[var(--success-glow)] text-[var(--success)] border-[var(--success)]'
                                    : 'bg-[var(--bg-card)] text-[var(--text-secondary)] border-[var(--border-color)] hover:border-[var(--text-muted)]'
                                }`}
                              >
                                {day}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Submit Buttons */}
              <div className="flex justify-end gap-2 pt-2 border-t border-[var(--border-color)] mt-4">
                <button
                  type="button"
                  onClick={() => {
                    resetForm();
                    setIsOpen(false);
                  }}
                  className="quote-btn quote-btn-secondary text-xs"
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="quote-btn quote-btn-primary text-xs"
                  disabled={loading}
                >
                  {loading ? 'Creating...' : 'Create Task'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default QuickAddTask;
