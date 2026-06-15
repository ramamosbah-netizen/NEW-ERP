// ============================================================
// JEET ERP — Task Details & Comments Drawer
// ============================================================

'use client';

import React, { useState, useEffect } from 'react';
import type { Task, TaskStatus, TaskComment } from '@/types/task.types';
import { supabase } from '@/lib/supabase';
import { taskService } from '@/services/taskService';
import { 
  Calendar, 
  User, 
  Briefcase, 
  Tag, 
  AlertCircle, 
  Send, 
  Clock, 
  MessageSquare,
  ShieldAlert,
  CheckCircle2,
  Trash2
} from 'lucide-react';

type Props = {
  taskId: string | null;
  onClose: () => void;
  onTaskUpdated: () => void;
};

export const TaskDetailDrawer: React.FC<Props> = ({ taskId, onClose, onTaskUpdated }) => {
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(false);
  
  // Comment & edit States
  const [newComment, setNewComment] = useState('');
  const [commenting, setCommenting] = useState(false);
  const [blockerReason, setBlockerReason] = useState('');
  const [showBlockerInput, setShowBlockerInput] = useState(false);

  useEffect(() => {
    if (taskId) {
      loadTaskDetails();
    } else {
      setTask(null);
    }
  }, [taskId]);

  const loadTaskDetails = async () => {
    if (!taskId) return;
    try {
      setLoading(true);
      const data = await taskService.fetchTaskById(taskId);
      setTask(data);
      if (data?.status === 'BLOCKED') {
        setBlockerReason(data.blocked_reason || '');
      }
    } catch (err) {
      console.error('Failed to load task:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (newStatus: TaskStatus) => {
    if (!task) return;
    if (newStatus === 'BLOCKED' && !showBlockerInput) {
      setShowBlockerInput(true);
      return;
    }

    try {
      const payload: Partial<Task> = { status: newStatus };
      if (newStatus === 'BLOCKED') {
        payload.blocked_reason = blockerReason.trim() || 'Blocked';
      }

      await taskService.updateTask(task.id, payload);
      
      // Notify parent to refresh list
      onTaskUpdated();
      // Reload detail
      await loadTaskDetails();
      setShowBlockerInput(false);
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!task || !newComment.trim()) return;

    try {
      setCommenting(true);
      await taskService.addComment(task.id, newComment.trim());
      setNewComment('');
      // Reload detail to fetch new comments list
      await loadTaskDetails();
    } catch (err) {
      console.error(err);
    } finally {
      setCommenting(false);
    }
  };

  const handleDeleteTask = async () => {
    if (!task) return;
    if (!confirm('Are you sure you want to delete this task?')) return;
    
    try {
      await taskService.deleteTask(task.id);
      onTaskUpdated();
      onClose();
    } catch (err) {
      console.error(err);
    }
  };

  const formatDateTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hrs = String(d.getHours()).padStart(2, '0');
    const mins = String(d.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} ${hrs}:${mins}`;
  };

  if (!taskId) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[480px] bg-[var(--bg-card)] border-l border-[var(--border-color)] shadow-2xl flex flex-col justify-between animate-in slide-in-from-right duration-300">
      {/* Loading Overlay */}
      {loading && !task && (
        <div className="absolute inset-0 bg-[var(--bg-card)]/80 flex items-center justify-center">
          <Clock className="animate-spin text-[var(--accent)]" size={32} />
        </div>
      )}

      {task ? (
        <>
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-color)] bg-[var(--bg-card-hover)]">
            <div className="flex-1 min-w-0">
              <span className="text-[10px] font-mono text-[var(--text-muted)] uppercase tracking-widest block mb-0.5">
                Task Inspector
              </span>
              <h3 className="font-semibold text-[var(--text-primary)] text-sm truncate">
                {task.title}
              </h3>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleDeleteTask}
                className="p-1.5 rounded bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--error)] transition-all"
                title="Delete task"
              >
                <Trash2 size={15} />
              </button>
              <button
                onClick={onClose}
                className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Content Body */}
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6 custom-scrollbar">
            {/* Status Selectors */}
            <div className="quote-form-group">
              <label>Task State</label>
              <div className="grid grid-cols-3 gap-2 mt-1">
                {(['TODO', 'IN_PROGRESS', 'BLOCKED'] as TaskStatus[]).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => handleStatusChange(st)}
                    className={`px-3 py-1.5 rounded text-xs font-bold font-mono tracking-wider border transition-all ${
                      task.status === st
                        ? st === 'BLOCKED'
                          ? 'bg-[var(--error-glow)] text-[var(--error)] border-[var(--error)]'
                          : st === 'IN_PROGRESS'
                          ? 'bg-[var(--accent-glow)] text-[var(--accent)] border-[var(--accent)]'
                          : 'bg-[var(--success-glow)] text-[var(--success)] border-[var(--success)]'
                        : 'bg-[var(--bg-card)] text-[var(--text-secondary)] border-[var(--border-color)] hover:border-[var(--text-muted)]'
                    }`}
                  >
                    {st.replace('_', ' ')}
                  </button>
                ))}
              </div>

              {/* Complete Actions */}
              <div className="grid grid-cols-2 gap-2 mt-2">
                {(['DONE', 'CANCELLED'] as TaskStatus[]).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => handleStatusChange(st)}
                    className={`px-3 py-1.5 rounded text-xs font-bold font-mono tracking-wider border transition-all ${
                      task.status === st
                        ? st === 'DONE'
                          ? 'bg-[var(--success-glow)] text-[var(--success)] border-[var(--success)]'
                          : 'bg-[var(--bg-card-hover)] text-[var(--text-muted)] border-[var(--border-color)]'
                        : 'bg-[var(--bg-card)] text-[var(--text-secondary)] border-[var(--border-color)] hover:border-[var(--text-muted)]'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

            {/* Blocked Input Block */}
            {(showBlockerInput || task.status === 'BLOCKED') && (
              <div className="p-3 bg-[var(--status-danger-bg)] border border-[var(--status-danger-border)] rounded-lg space-y-2">
                <label className="text-[10px] font-bold text-[var(--status-danger-text)] flex items-center gap-1">
                  <ShieldAlert size={12} />
                  Specify Block Reason
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="e.g. Waiting for client specs approval"
                    value={blockerReason}
                    onChange={(e) => setBlockerReason(e.target.value)}
                    className="flex-1 bg-[var(--bg-card)] border border-[var(--border-color)] rounded px-2.5 py-1 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--error)]"
                  />
                  <button
                    onClick={() => handleStatusChange('BLOCKED')}
                    className="bg-[var(--status-danger-border)] text-[var(--status-danger-text)] border border-[var(--status-danger-border)] hover:opacity-85 text-xs px-3 rounded font-mono font-semibold"
                  >
                    Save
                  </button>
                </div>
              </div>
            )}

            {/* General Info Metadata */}
            <div className="p-4 bg-[var(--bg-card-hover)] border border-[var(--border-color)] rounded-xl space-y-3">
              {/* Project Link */}
              <div className="flex items-center justify-between text-xs">
                <span className="text-[var(--text-secondary)] flex items-center gap-1.5"><Briefcase size={13} /> Project</span>
                <span className="font-semibold text-[var(--text-primary)] truncate max-w-[200px]">
                  {task.project_name || 'Unlinked'}
                </span>
              </div>

              {/* Assignee */}
              <div className="flex items-center justify-between text-xs">
                <span className="text-[var(--text-secondary)] flex items-center gap-1.5"><User size={13} /> Assignee</span>
                <span className="font-semibold text-[var(--text-primary)]">
                  {task.assignee_name || 'Unassigned'}
                </span>
              </div>

              {/* Priority */}
              <div className="flex items-center justify-between text-xs">
                <span className="text-[var(--text-secondary)] flex items-center gap-1.5"><AlertCircle size={13} /> Priority</span>
                <span className="font-mono font-extrabold text-[var(--success)]">
                  {task.priority}
                </span>
              </div>

              {/* Due Date */}
              {task.due_date && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[var(--text-secondary)] flex items-center gap-1.5"><Calendar size={13} /> Due Date</span>
                  <span className="font-mono text-[var(--text-primary)]">
                    {new Date(task.due_date).toLocaleDateString('en-GB')}
                  </span>
                </div>
              )}

              {/* Created By */}
              <div className="flex items-center justify-between text-xs border-t border-[var(--border-color)] pt-2.5 mt-2.5">
                <span className="text-[var(--text-secondary)] flex items-center gap-1.5"><Clock size={13} /> Created By</span>
                <span className="text-[var(--text-primary)]">
                  {task.creator_name || 'System'}
                </span>
              </div>
            </div>

            {/* Description Details */}
            {task.description && (
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
                  Description Notes
                </label>
                <div className="p-3 bg-[var(--bg-card-hover)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] text-xs leading-relaxed whitespace-pre-wrap">
                  {task.description}
                </div>
              </div>
            )}

            {/* Tags */}
            {task.tags && task.tags.length > 0 && (
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider flex items-center gap-1">
                  <Tag size={10} /> Tags
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {task.tags.map(t => (
                    <span key={t} className="px-2 py-0.5 bg-[var(--bg-card)] border border-[var(--border-color)] rounded text-[10px] font-mono text-[var(--text-secondary)]">
                      #{t}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Comments Stream */}
            <div className="space-y-3 pt-2">
              <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider flex items-center gap-1">
                <MessageSquare size={12} /> Discussion ({task.comments?.length || 0})
              </label>

              <div className="space-y-3 max-h-[220px] overflow-y-auto custom-scrollbar pr-1">
                {(!task.comments || task.comments.length === 0) ? (
                  <div className="text-center py-4 text-[var(--text-muted)] text-xs italic">
                    No comments yet. Start the conversation.
                  </div>
                ) : (
                  task.comments.map((comment: TaskComment) => (
                    <div key={comment.id} className="p-3 bg-[var(--bg-card-hover)] border border-[var(--border-color)] rounded-xl space-y-1 text-left">
                      <div className="flex justify-between items-center text-[10px]">
                        <span className="font-bold text-[var(--text-primary)]">{comment.user_name}</span>
                        <span className="text-[var(--text-muted)] font-mono">{formatDateTime(comment.created_at)}</span>
                      </div>
                      <p className="text-xs text-[var(--text-secondary)] leading-normal">
                        {comment.body}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Quick Comment Input Form */}
          <form onSubmit={handleAddComment} className="border-t border-[var(--border-color)] p-4 bg-[var(--bg-card)] flex items-center gap-2">
            <input
              type="text"
              placeholder="Post a comment..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              className="flex-1 bg-[var(--bg-card-hover)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--accent)] transition-all"
              disabled={commenting}
            />
            <button
              type="submit"
              disabled={commenting || !newComment.trim()}
              className="p-2 rounded-lg bg-[var(--primary)] text-[var(--bg-card)] hover:opacity-85 transition-colors disabled:opacity-40 flex items-center justify-center"
            >
              <Send size={14} />
            </button>
          </form>
        </>
      ) : (
        <div className="flex-1 flex items-center justify-center text-[var(--text-muted)] text-xs">
          Select a task to review details.
        </div>
      )}
    </div>
  );
};

export default TaskDetailDrawer;
