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
      className={`relative group border rounded-xl p-4 bg-slate-900/50 backdrop-blur-md transition-all duration-300 hover:border-slate-700/80 cursor-pointer ${
        isCompleted ? 'border-slate-900/40 opacity-60' : 'border-slate-800'
      } ${isOverdue ? 'border-red-950/40 hover:border-red-500/30' : ''}`}
    >
      {/* Complete Checkbox */}
      <div className="flex items-start gap-3">
        <button
          onClick={handleCheckboxClick}
          className={`h-5 w-5 rounded-md border flex items-center justify-center flex-shrink-0 transition-all ${
            isCompleted
              ? 'bg-emerald-500 border-emerald-500 text-slate-950'
              : 'border-slate-700 hover:border-emerald-500 hover:bg-emerald-500/10 text-transparent'
          }`}
        >
          <CheckCircle2 size={14} className={isCompleted ? 'stroke-[3]' : ''} />
        </button>

        <div className="flex-1 min-w-0">
          <h4 className={`text-sm font-semibold truncate transition-colors ${
            isCompleted ? 'text-slate-500 line-through' : 'text-slate-200 group-hover:text-emerald-400'
          }`}>
            {task.title}
          </h4>

          {task.description && (
            <p className="text-xs text-slate-500 line-clamp-1 mt-1 leading-relaxed">
              {task.description}
            </p>
          )}

          {/* Project baseline & origin */}
          <div className="flex flex-wrap items-center gap-2 mt-2.5">
            {task.project_name && (
              <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold text-slate-400 bg-slate-950 border border-slate-900 px-1.5 py-0.5 rounded">
                <Layers size={9} />
                {task.project_name}
              </span>
            )}
            <span className="text-[10px] font-bold tracking-wider uppercase text-slate-600 bg-slate-950/50 px-1 py-0.5 rounded font-mono">
              {getOriginLabel(task.origin)}
            </span>
          </div>

          {/* Footnotes */}
          <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-slate-900/40">
            <div className="flex items-center gap-3">
              {/* Due date */}
              {task.due_date && (
                <span className={`inline-flex items-center gap-1.5 text-[10px] font-mono ${
                  isOverdue ? 'text-red-400 font-bold' : 'text-slate-500'
                }`}>
                  <Calendar size={10} />
                  {formatDueDate(task.due_date)}
                </span>
              )}

              {/* Recurrence Indicator */}
              {task.recurrence && (
                <span className="text-[10px] font-mono text-emerald-500 flex items-center gap-1" title="Recurring task">
                  <RefreshCw size={10} className="animate-spin" style={{ animationDuration: '6s' }} />
                  {task.recurrence.freq}
                </span>
              )}
            </div>

            {/* Priority & Assignee */}
            <div className="flex items-center gap-2">
              <span
                className="text-[9px] font-mono font-extrabold px-1.5 py-0.5 rounded tracking-wider"
                style={{
                  backgroundColor: priorityCfg.bg,
                  color: priorityCfg.color,
                  borderColor: priorityCfg.border
                }}
              >
                {priorityCfg.text}
              </span>

              {task.assignee_name ? (
                <div className="flex items-center gap-1 bg-slate-950 border border-slate-900 rounded px-1.5 py-0.5" title={task.assignee_name}>
                  <User size={10} className="text-slate-500" />
                  <span className="text-[9px] font-bold text-slate-400 max-w-[70px] truncate">
                    {task.assignee_name.split(' ')[0]}
                  </span>
                </div>
              ) : (
                <div className="h-4 w-4 rounded bg-slate-950 border border-slate-900 flex items-center justify-center text-slate-600 text-[8px] font-bold">
                  U
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TaskCard;
