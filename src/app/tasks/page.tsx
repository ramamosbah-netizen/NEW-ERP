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
      case 'URGENT': return 'text-red-400 font-bold';
      case 'HIGH': return 'text-amber-500 font-bold';
      case 'MEDIUM': return 'text-emerald-400';
      default: return 'text-blue-400';
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
              <CheckSquare className="text-emerald-400" size={26} />
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
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
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
            <div className="flex items-center gap-1 bg-slate-950 border border-slate-900 rounded-lg px-2 py-0.5">
              <Briefcase size={12} className="text-slate-500" />
              <select
                name="project_id"
                value={filters.project_id}
                onChange={handleFilterChange}
                className="bg-transparent text-xs text-slate-300 py-1 outline-none font-mono"
              >
                <option value="">All Projects</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            {/* Priority Filter */}
            <div className="flex items-center gap-1 bg-slate-950 border border-slate-900 rounded-lg px-2 py-0.5">
              <AlertCircle size={12} className="text-slate-500" />
              <select
                name="priority"
                value={filters.priority}
                onChange={handleFilterChange}
                className="bg-transparent text-xs text-slate-300 py-1 outline-none font-mono"
              >
                <option value="">All Priorities</option>
                <option value="LOW">🔵 LOW</option>
                <option value="MEDIUM">🟢 MEDIUM</option>
                <option value="HIGH">🟡 HIGH</option>
                <option value="URGENT">🔴 URGENT</option>
              </select>
            </div>
          </div>

          {/* View Toggles */}
          <div className="flex bg-slate-950/60 border border-slate-900 p-0.5 rounded-lg">
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 rounded text-xs font-semibold flex items-center gap-1.5 transition-all ${
                viewMode === 'list'
                  ? 'bg-emerald-500 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              List View
            </button>
            <button
              onClick={() => setViewMode('kanban')}
              className={`px-3 py-1.5 rounded text-xs font-semibold flex items-center gap-1.5 transition-all ${
                viewMode === 'kanban'
                  ? 'bg-emerald-500 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Kanban Board
            </button>
          </div>
        </div>

        {/* Board Main Area */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <RefreshCw className="animate-spin text-emerald-400" size={32} />
            <span className="text-slate-400 font-mono text-sm">RETRIEVING MASTER TASKS...</span>
          </div>
        ) : error ? (
          <div className="p-4 bg-red-950/20 border border-red-500/10 text-red-300 rounded-xl text-center text-xs">
            Failed to load tasks database. Sync caches or re-try: {error.message}
          </div>
        ) : tasks.length === 0 ? (
          <div className="quote-card py-20 text-center text-slate-500 text-sm">
            <CheckSquare size={48} className="mx-auto mb-4 opacity-10 text-slate-400" />
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
                        className={`cursor-pointer hover:bg-slate-900/40 border-b border-slate-900/60 ${
                          isDone ? 'opacity-55' : ''
                        }`}
                      >
                        <td className="py-3.5" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => handleDragDropStatusUpdate(t.id, isDone ? 'TODO' : 'DONE')}
                            className={`h-5.5 w-5.5 rounded-md border flex items-center justify-center transition-all ${
                              isDone
                                ? 'bg-emerald-500 border-emerald-500 text-slate-950 font-bold'
                                : 'border-slate-800 hover:border-emerald-500/50 hover:bg-emerald-500/5'
                            }`}
                          >
                            {isDone ? '✓' : ''}
                          </button>
                        </td>
                        <td className="py-3.5">
                          <div className={`font-semibold text-xs text-slate-200 ${isDone ? 'line-through text-slate-500' : ''}`}>
                            {t.title}
                          </div>
                          {t.description && <div className="text-[10px] text-slate-500 truncate mt-0.5">{t.description}</div>}
                        </td>
                        <td className="py-3.5 text-xs text-slate-400 font-mono">
                          {t.project_name || '-'}
                        </td>
                        <td className="py-3.5 text-xs text-slate-400">
                          {t.assignee_name || <span className="text-slate-600 italic">Unassigned</span>}
                        </td>
                        <td className="py-3.5 font-mono text-[10px] font-extrabold">
                          <span className={getPriorityConfig(t.priority)}>{t.priority}</span>
                        </td>
                        <td className="py-3.5 font-mono text-[10px] text-slate-400">
                          {t.due_date ? formatDate(t.due_date) : '-'}
                        </td>
                        <td className="py-3.5 text-right">
                          <ArrowRight size={13} className="text-slate-600 group-hover:text-emerald-400 transition-colors" />
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
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-40" onClick={() => setSelectedTaskId(null)} />
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
