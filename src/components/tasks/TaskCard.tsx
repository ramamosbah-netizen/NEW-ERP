// ============================================================
// JEET ERP — Task Card Component
// ============================================================

'use client';

import React from 'react';
import type { Task, TaskPriority } from '@/types/task.types';
import { Calendar, AlertCircle, RefreshCw, Layers, CheckCircle2, User } from 'lucide-react';

type Props = {
  task: Task;
  onSelect: (task: Task) => void;
  onStatusChange: (id: string, newStatus: any) => void;
};

export const TaskCard: React.FC<Props> = ({ task, onSelect, onStatusChange }) => {
  const getPriorityConfig = (priority: TaskPriority) => {
    switch (priority) {
      case 'URGENT':
        return { text: 'URGENT', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.12)', border: 'rgba(239, 68, 68, 0.25)' };
      case 'HIGH':
        return { text: 'HIGH', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.12)', border: 'rgba(245, 158, 11, 0.25)' };
      case 'MEDIUM':
        return { text: 'MEDIUM', color: '#10b981', bg: 'rgba(16, 185, 129, 0.12)', border: 'rgba(16, 185, 129, 0.25)' };
      default:
        return { text: 'LOW', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.12)', border: 'rgba(59, 130, 246, 0.25)' };
    }
  };

  const getOriginLabel = (origin: string) => {
    switch (origin) {
      case 'AUTO_RULE':
        return 'Auto';
      case 'MEETING_ACTION':
        return 'Meeting';
      case 'AI_SUGGESTED':
        return 'AI';
      default:
        return 'Manual';
    }
  };

  const isCompleted = ['DONE', 'DONE_AUTO'].includes(task.status);
  const priorityCfg = getPriorityConfig(task.priority);

  // Parse & format date as DD/MM/YYYY
  const formatDueDate = (dateStr?: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const isOverdue = task.due_date && new Date(task.due_date) < new Date() && !isCompleted;

  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onStatusChange(task.id, isCompleted ? 'TODO' : 'DONE');
  };

  return (
    <div
      onClick={() => onSelect(task)}
      className={`relative group border rounded-lg p-4 bg-[var(--bg-card)] border-[var(--border-color)] transition-all duration-300 hover:border-[var(--text-muted)] cursor-pointer ${
        isCompleted ? 'opacity-60' : ''
      } ${isOverdue ? 'border-[var(--status-danger-border)]/50 hover:border-[var(--status-danger-border)]' : ''}`}
    >
      <div className="flex items-start gap-3">
        {/* Complete Checkbox */}
        <button
          onClick={handleCheckboxClick}
          className={`h-5 w-5 rounded-md border flex items-center justify-center flex-shrink-0 transition-all ${
            isCompleted
              ? 'bg-[var(--success)] border-[var(--success)] text-[var(--bg-card)]'
              : 'border-[var(--border-color)] hover:border-[var(--success)] hover:bg-[var(--success-glow)] text-transparent'
          }`}
        >
          <CheckCircle2 size={14} className={isCompleted ? 'stroke-[3]' : ''} />
        </button>
 
        <div className="flex-1 min-w-0">
          {/* Header Row: Title & Priority */}
          <div className="flex items-start justify-between gap-2">
            <h4 className={`text-sm font-bold truncate transition-colors ${
              isCompleted ? 'text-[var(--text-muted)] line-through' : 'text-[var(--text-primary)] group-hover:text-[var(--accent)]'
            }`}>
              {task.title}
            </h4>
            
            <span
              className="text-[9px] font-mono font-extrabold px-1.5 py-0.5 rounded tracking-wider flex-shrink-0"
              style={{
                backgroundColor: priorityCfg.bg,
                color: priorityCfg.color,
                borderColor: priorityCfg.border
              }}
            >
              {priorityCfg.text}
            </span>
          </div>
 
          {task.description && (
            <p className="text-xs text-[var(--text-secondary)] line-clamp-1 mt-1 leading-relaxed">
              {task.description}
            </p>
          )}
 
          {/* Project baseline & origin */}
          <div className="flex flex-wrap items-center gap-2 mt-2.5">
            {task.project_name && (
              <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold text-[var(--text-secondary)] bg-[var(--bg-card)] border border-[var(--border-color)] px-1.5 py-0.5 rounded">
                <Layers size={9} />
                {task.project_name}
              </span>
            )}
            <span className="text-[10px] font-bold tracking-wider uppercase text-[var(--text-muted)] bg-[var(--bg-card)] px-1 py-0.5 rounded font-mono">
              {getOriginLabel(task.origin)}
            </span>
          </div>
 
          {/* Footer: User (left) and Due Date & Recurrence (right) */}
          <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-[var(--border-color)]">
            {/* Assignee info on the left */}
            <div>
              {task.assignee_name ? (
                <div className="flex items-center gap-1.5 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-md px-2 py-0.5" title={task.assignee_name}>
                  <User size={10} className="text-[var(--text-secondary)]" />
                  <span className="text-[10px] font-bold text-[var(--text-primary)]">
                    {task.assignee_name}
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 bg-[var(--bg-card)] border border-[var(--border-color)] border-dashed rounded-md px-2 py-0.5 text-[var(--text-muted)] text-[10px] italic">
                  Unassigned
                </div>
              )}
            </div>

            {/* Recurrence & Due Date on the right */}
            <div className="flex items-center gap-2">
              {task.recurrence && (
                <span className="text-[10px] font-mono text-[var(--success)] flex items-center gap-1" title="Recurring task">
                  <RefreshCw size={10} className="animate-spin" style={{ animationDuration: '6s' }} />
                  {task.recurrence.freq}
                </span>
              )}

              {task.due_date && (
                <span className={`inline-flex items-center gap-1.5 text-[10px] font-mono px-2 py-0.5 rounded bg-[var(--bg-card)] border border-[var(--border-color)] ${
                  isOverdue ? 'text-[var(--status-danger-text)] bg-[var(--status-danger-bg)] border-[var(--status-danger-border)] font-bold' : 'text-[var(--text-secondary)]'
                }`}>
                  <Calendar size={10} />
                  {formatDueDate(task.due_date)}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TaskCard;
