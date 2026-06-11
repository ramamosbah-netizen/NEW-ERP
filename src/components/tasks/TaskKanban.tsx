// ============================================================
// JEET ERP — Task Kanban Board
// ============================================================

'use client';

import React from 'react';
import type { Task, TaskStatus } from '@/types/task.types';
import TaskCard from './TaskCard';

type Props = {
  tasks: Task[];
  onSelectTask: (task: Task) => void;
  onStatusChange: (id: string, newStatus: TaskStatus) => void;
};

const COLUMNS: { key: TaskStatus; label: string; bg: string; text: string; glow: string }[] = [
  { key: 'TODO', label: 'To Do', bg: 'bg-slate-950/60', text: 'text-slate-400', glow: 'border-slate-800' },
  { key: 'IN_PROGRESS', label: 'In Progress', bg: 'bg-slate-950/60', text: 'text-cyan-400', glow: 'border-cyan-500/20' },
  { key: 'BLOCKED', label: 'Blocked', bg: 'bg-slate-950/60', text: 'text-red-400', glow: 'border-red-500/20' },
  { key: 'DONE', label: 'Completed', bg: 'bg-slate-950/60', text: 'text-emerald-400', glow: 'border-emerald-500/20' }
];

export const TaskKanban: React.FC<Props> = ({ tasks, onSelectTask, onStatusChange }) => {
  const getTasksForColumn = (colKey: TaskStatus) => {
    return tasks.filter(t => {
      if (colKey === 'DONE') {
        return ['DONE', 'DONE_AUTO'].includes(t.status);
      }
      return t.status === colKey;
    });
  };

  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData('text/plain', id);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, columnKey: TaskStatus) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('text/plain');
    if (taskId) {
      onStatusChange(taskId, columnKey);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 items-start">
      {COLUMNS.map(col => {
        const columnTasks = getTasksForColumn(col.key);
        
        return (
          <div
            key={col.key}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, col.key)}
            className="flex flex-col h-[650px] rounded-xl border border-slate-900 bg-slate-950/45 p-4 space-y-4"
          >
            {/* Column Header */}
            <div className="flex items-center justify-between pb-2 border-b border-slate-900/60">
              <span className={`text-xs font-bold font-mono tracking-widest uppercase ${col.text}`}>
                {col.label}
              </span>
              <span className="text-[10px] font-mono font-bold text-slate-500 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                {columnTasks.length}
              </span>
            </div>

            {/* Column Body list */}
            <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar pr-1">
              {columnTasks.length === 0 ? (
                <div className="h-28 border border-dashed border-slate-900/40 rounded-xl flex items-center justify-center text-slate-600 text-xs italic">
                  Drop tasks here
                </div>
              ) : (
                columnTasks.map(task => (
                  <div
                    key={task.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, task.id)}
                    className="cursor-grab active:cursor-grabbing transform transition-transform"
                  >
                    <TaskCard
                      task={task}
                      onSelect={onSelectTask}
                      onStatusChange={onStatusChange}
                    />
                  </div>
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default TaskKanban;
