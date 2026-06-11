// ============================================================
// JEET ERP — Quick Add Task & Recurrence Editor Component
// ============================================================

'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Calendar, User, Briefcase, Plus, AlertCircle, Clock, RotateCcw } from 'lucide-react';
import type { Task, TaskPriority, TaskStatus } from '@/types/task.types';

type Props = {
  onTaskCreated: (task: Task) => void;
  projectId?: string; // Optional default project context
};

export const QuickAddTask: React.FC<Props> = ({ onTaskCreated, projectId }) => {
  const [isOpen, setIsOpen] = useState(false);
  
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
      console.error(err);
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

      {isOpen && (
        <div className="quote-modal-overlay">
          <div className="quote-modal max-w-xl">
            <div className="quote-modal-header">
              <h3 className="font-semibold text-slate-200 text-base flex items-center gap-2">
                <Plus size={18} className="text-emerald-400" />
                Add New Task
              </h3>
              <button
                onClick={() => {
                  resetForm();
                  setIsOpen(false);
                }}
                className="text-slate-400 hover:text-slate-200"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="quote-modal-body space-y-4">
              {error && (
                <div className="p-3 bg-red-950/40 border border-red-500/20 text-red-300 rounded-lg flex items-start gap-2 text-xs">
                  <AlertCircle size={16} className="text-red-400 mt-0.5 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Title */}
              <div className="quote-form-group">
                <label>Task Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Verify supplier commercial terms"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="quote-form-input"
                />
              </div>

              {/* Description */}
              <div className="quote-form-group">
                <label>Description</label>
                <textarea
                  placeholder="Add details, checklists, or steps..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="quote-form-textarea"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Project */}
                <div className="quote-form-group">
                  <label className="flex items-center gap-1"><Briefcase size={12} /> Project</label>
                  <select
                    value={selectedProjectId}
                    onChange={(e) => setSelectedProjectId(e.target.value)}
                    className="quote-form-input"
                  >
                    <option value="">No Project Link</option>
                    {projects.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>

                {/* Assignee */}
                <div className="quote-form-group">
                  <label className="flex items-center gap-1"><User size={12} /> Assignee</label>
                  <select
                    value={assigneeId}
                    onChange={(e) => setAssigneeId(e.target.value)}
                    className="quote-form-input"
                  >
                    <option value="">Unassigned</option>
                    {profiles.map(p => (
                      <option key={p.id} value={p.id}>{p.full_name} ({p.role})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Priority */}
                <div className="quote-form-group">
                  <label className="flex items-center gap-1"><AlertCircle size={12} /> Priority</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as TaskPriority)}
                    className="quote-form-input font-mono"
                  >
                    <option value="LOW">🔵 LOW</option>
                    <option value="MEDIUM">🟢 MEDIUM</option>
                    <option value="HIGH">🟡 HIGH</option>
                    <option value="URGENT">🔴 URGENT</option>
                  </select>
                </div>

                {/* Due Date */}
                <div className="quote-form-group">
                  <label className="flex items-center gap-1"><Calendar size={12} /> Due Date</label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="quote-form-input font-mono"
                  />
                </div>
              </div>

              {/* Tags */}
              <div className="quote-form-group">
                <label>Tags (Comma-separated)</label>
                <input
                  type="text"
                  placeholder="e.g. audit, urgent, billing"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  className="quote-form-input"
                />
              </div>

              {/* Recurrence Trigger */}
              <div className="border-t border-slate-900/60 pt-3">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={isRecurring}
                    onChange={(e) => setIsRecurring(e.target.checked)}
                    className="rounded bg-slate-950 border-slate-800 text-emerald-400 focus:ring-0"
                  />
                  <span className="text-xs font-bold text-slate-300 uppercase tracking-wide flex items-center gap-1.5">
                    <RotateCcw size={12} className={isRecurring ? 'animate-spin' : ''} />
                    Set Recurrence Schedule (Auto-Spawn)
                  </span>
                </label>

                {isRecurring && (
                  <div className="mt-3 p-3 bg-slate-950/60 border border-slate-900 rounded-lg space-y-3 animate-in slide-in-from-top-1 duration-200">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="quote-form-group">
                        <label className="text-[10px]">Frequency</label>
                        <select
                          value={recurrenceFreq}
                          onChange={(e) => setRecurrenceFreq(e.target.value as any)}
                          className="quote-form-input font-mono text-xs"
                        >
                          <option value="DAILY">DAILY</option>
                          <option value="WEEKLY">WEEKLY</option>
                          <option value="MONTHLY">MONTHLY</option>
                        </select>
                      </div>

                      <div className="quote-form-group">
                        <label className="text-[10px]">End Date (Until)</label>
                        <input
                          type="date"
                          value={recurrenceUntil}
                          onChange={(e) => setRecurrenceUntil(e.target.value)}
                          className="quote-form-input font-mono text-xs"
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
                                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/40 shadow-[0_0_8px_rgba(0,229,160,0.15)]'
                                    : 'bg-slate-900 text-slate-500 border-slate-800 hover:border-slate-700'
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
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    resetForm();
                    setIsOpen(false);
                  }}
                  className="quote-btn quote-btn-secondary"
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="quote-btn quote-btn-primary"
                  disabled={loading}
                >
                  {loading ? 'Creating...' : 'Create Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuickAddTask;
