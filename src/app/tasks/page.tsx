// ============================================================
// JEET ERP — Tasks List & Kanban Board Registry
// Route: /tasks
// ============================================================

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useTasks } from '@/hooks/useTasks';
import TaskCard from '@/components/tasks/TaskCard';
import TaskKanban from '@/components/tasks/TaskKanban';
import TaskDetailDrawer from '@/components/tasks/TaskDetailDrawer';
import QuickAddTask from '@/components/tasks/QuickAddTask';
import { 
  CheckSquare, 
  LayoutGrid, 
  Search, 
  Filter, 
  Briefcase, 
  AlertCircle, 
  BarChart2, 
  ArrowRight,
  RefreshCw
} from 'lucide-react';

export default function TasksPage() {
  const router = useRouter();
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('kanban');
  
  // Filter States
  const [filters, setFilters] = useState<any>({
    priority: '',
    project_id: '',
    search: ''
  });

  const { tasks, loading, error, refetch, updateStatus } = useTasks(filters);
  
  // Inspector Drawer state
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  // Selector lists
  const [projects, setProjects] = useState<any[]>([]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) router.replace('/signin');
    });

    supabase.from('projects').select('id, name').eq('is_active', true).then(({ data }) => {
      if (data) setProjects(data);
    });
  }, [router]);

  const handleFilterChange = (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
    const { name, value } = e.target;
    setFilters((prev: any) => ({ ...prev, [name]: value }));
  };

  const handleDragDropStatusUpdate = async (id: string, newStatus: any) => {
    await updateStatus(id, newStatus);
    refetch();
  };

  const getPriorityConfig = (priority: string) => {
    switch (priority) {
      case 'URGENT': return 'text-[var(--error)] font-bold';
      case 'HIGH': return 'text-[var(--warning)] font-bold';
      case 'MEDIUM': return 'text-[var(--success)]';
      default: return 'text-[var(--text-secondary)]';
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
  };

  return (
    <div className="flex flex-col min-h-screen w-full relative z-10">
<main className="quote-container flex-1 py-8 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h1 className="quote-header-title flex items-center gap-2">
              <CheckSquare className="text-[var(--accent)]" size={26} />
              Task Master Board
            </h1>
            <p className="quote-header-subtitle">List and Kanban views matching event actions and auto-routing rules.</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/tasks/workload')}
              className="quote-btn quote-btn-secondary text-xs flex items-center gap-1.5"
            >
              <BarChart2 size={14} />
              Team Workload Strip
            </button>
            <QuickAddTask onTaskCreated={() => refetch()} />
          </div>
        </div>

        {/* Filter Bar and View Mode Switcher */}
        <div className="quote-card flex flex-col md:flex-row justify-between items-center gap-4 py-4">
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" size={14} />
              <input
                type="text"
                name="search"
                placeholder="Search tasks..."
                value={filters.search}
                onChange={handleFilterChange}
                className="quote-filter-input pl-8 py-1.5 text-xs w-48 focus:w-56 transition-all"
              />
            </div>

            {/* Project Filter */}
            <div className="flex items-center gap-1 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg px-2 py-0.5">
              <Briefcase size={12} className="text-[var(--text-muted)]" />
              <select
                name="project_id"
                value={filters.project_id}
                onChange={handleFilterChange}
                className="bg-transparent text-xs text-[var(--text-primary)] py-1 outline-none font-mono"
              >
                <option value="" className="bg-[var(--bg-card)] text-[var(--text-primary)]">All Projects</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id} className="bg-[var(--bg-card)] text-[var(--text-primary)]">{p.name}</option>
                ))}
              </select>
            </div>

            {/* Priority Filter */}
            <div className="flex items-center gap-1 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg px-2 py-0.5">
              <AlertCircle size={12} className="text-[var(--text-muted)]" />
              <select
                name="priority"
                value={filters.priority}
                onChange={handleFilterChange}
                className="bg-transparent text-xs text-[var(--text-primary)] py-1 outline-none font-mono"
              >
                <option value="" className="bg-[var(--bg-card)] text-[var(--text-primary)]">All Priorities</option>
                <option value="LOW" className="bg-[var(--bg-card)] text-[var(--text-primary)]">LOW</option>
                <option value="MEDIUM" className="bg-[var(--bg-card)] text-[var(--text-primary)]">MEDIUM</option>
                <option value="HIGH" className="bg-[var(--bg-card)] text-[var(--text-primary)]">HIGH</option>
                <option value="URGENT" className="bg-[var(--bg-card)] text-[var(--text-primary)]">URGENT</option>
              </select>
            </div>
          </div>

          {/* View Toggles */}
          <div className="flex bg-[var(--bg-card)] border border-[var(--border-color)] p-0.5 rounded-lg">
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 rounded text-xs font-semibold flex items-center gap-1.5 transition-all ${
                viewMode === 'list'
                  ? 'bg-[var(--accent)] text-[var(--bg-card)] font-bold'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              List View
            </button>
            <button
              onClick={() => setViewMode('kanban')}
              className={`px-3 py-1.5 rounded text-xs font-semibold flex items-center gap-1.5 transition-all ${
                viewMode === 'kanban'
                  ? 'bg-[var(--accent)] text-[var(--bg-card)] font-bold'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              Kanban Board
            </button>
          </div>
        </div>

        {/* Board Main Area */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <RefreshCw className="animate-spin text-[var(--accent)]" size={32} />
            <span className="text-[var(--text-secondary)] font-mono text-sm">RETRIEVING MASTER TASKS...</span>
          </div>
        ) : error ? (
          <div className="p-4 bg-red-950/20 border border-red-500/10 text-red-300 rounded-xl text-center text-xs">
            Failed to load tasks database. Sync caches or re-try: {error.message}
          </div>
        ) : tasks.length === 0 ? (
          <div className="quote-card py-20 text-center text-[var(--text-tertiary)] text-sm">
            <CheckSquare size={48} className="mx-auto mb-4 opacity-10 text-[var(--text-secondary)]" />
            No tasks found matching current filters.
          </div>
        ) : viewMode === 'kanban' ? (
          <TaskKanban
            tasks={tasks}
            onSelectTask={(task) => setSelectedTaskId(task.id)}
            onStatusChange={handleDragDropStatusUpdate}
          />
        ) : (
          <div className="quote-card p-0 overflow-hidden">
            <div className="quote-table-wrap">
              <table className="quote-table">
                <thead>
                  <tr>
                    <th className="w-12">State</th>
                    <th>Task Description</th>
                    <th>Project</th>
                    <th>Assignee</th>
                    <th>Priority</th>
                    <th>Due Date</th>
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.map(t => {
                    const isDone = ['DONE', 'DONE_AUTO'].includes(t.status);
                    return (
                      <tr
                        key={t.id}
                        onClick={() => setSelectedTaskId(t.id)}
                        className={`cursor-pointer hover:bg-[var(--bg-card-hover)] border-b border-[var(--border-color)] ${
                          isDone ? 'opacity-55' : ''
                        }`}
                      >
                        <td className="py-3.5" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => handleDragDropStatusUpdate(t.id, isDone ? 'TODO' : 'DONE')}
                            className={`h-5.5 w-5.5 rounded-md border flex items-center justify-center transition-all ${
                              isDone
                                ? 'bg-[var(--success)] border-[var(--success)] text-[var(--bg-card)] font-bold'
                                : 'border-[var(--border-color)] hover:border-[var(--success)] hover:bg-[var(--success-glow)]'
                            }`}
                          >
                            {isDone ? '✓' : ''}
                          </button>
                        </td>
                        <td className="py-3.5">
                          <div className={`font-semibold text-xs text-[var(--text-primary)] ${isDone ? 'line-through text-[var(--text-muted)]' : ''}`}>
                            {t.title}
                          </div>
                          {t.description && <div className="text-[10px] text-[var(--text-muted)] truncate mt-0.5">{t.description}</div>}
                        </td>
                        <td className="py-3.5 text-xs text-[var(--text-secondary)] font-mono">
                          {t.project_name || '-'}
                        </td>
                        <td className="py-3.5 text-xs text-[var(--text-secondary)]">
                          {t.assignee_name || <span className="text-[var(--text-muted)] italic">Unassigned</span>}
                        </td>
                        <td className="py-3.5 font-mono text-[10px] font-extrabold">
                          <span className={getPriorityConfig(t.priority)}>{t.priority}</span>
                        </td>
                        <td className="py-3.5 font-mono text-[10px] text-[var(--text-secondary)]">
                          {t.due_date ? formatDate(t.due_date) : '-'}
                        </td>
                        <td className="py-3.5 text-right">
                          <ArrowRight size={13} className="text-[var(--text-muted)] group-hover:text-[var(--accent)] transition-colors" />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* Task Drawer Inspector Overlay */}
      {selectedTaskId && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40" onClick={() => setSelectedTaskId(null)} />
          <TaskDetailDrawer
            taskId={selectedTaskId}
            onClose={() => setSelectedTaskId(null)}
            onTaskUpdated={() => refetch()}
          />
        </>
      )}
    </div>
  );
}
