// ============================================================
// JEET ERP — My Day Dashboard Hub
// Route: /myday
// ============================================================

'use client';
import { logger } from '@/lib/logger';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useMyDay } from '@/hooks/useMyDay';
import { taskService } from '@/services/taskService';
import TaskDetailDrawer from '@/components/tasks/TaskDetailDrawer';
import QuickAddTask from '@/components/tasks/QuickAddTask';
import { 
  Sun, 
  Calendar, 
  Sparkles, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  ArrowRight, 
  FileWarning, 
  User, 
  ChevronRight,
  TrendingUp,
  MapPin,
  RefreshCw,
  Zap
} from 'lucide-react';

export default function MyDayPage() {
  const router = useRouter();
  const {
    needsAction,
    urgentOverdueTasks,
    tasksToday,
    meetingsToday,
    tasksThisWeek,
    expiringDocs,
    recentlyCompleted,
    loading,
    error,
    refetch
  } = useMyDay();

  // AI Prompt States
  const [promptText, setPromptText] = useState('');
  const [parsing, setParsing] = useState(false);
  const [parsedTask, setParsedTask] = useState<any | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  // Inspector Drawer state
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  // For AI task mapping
  const [projects, setProjects] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);

  useEffect(() => {
    // Check session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) router.replace('/signin');
    });

    // Preload projects and profiles for AI mapping
    supabase.from('projects').select('id, name').eq('is_active', true).then(({ data }) => {
      if (data) setProjects(data);
    });
    supabase.from('profiles').select('id, full_name').then(({ data }) => {
      if (data) setProfiles(data);
    });
  }, [router]);

  const handleAIParsing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!promptText.trim()) return;

    try {
      setParsing(true);
      setAiError(null);
      setParsedTask(null);

      const parsed = await taskService.parseNaturalLanguageTask(promptText.trim());

      // Attempt to match project
      let matchedProjectId = '';
      if (parsed.suggested_project_name) {
        const pMatch = projects.find(p =>
          p.name.toLowerCase().includes(parsed.suggested_project_name!.toLowerCase())
        );
        if (pMatch) matchedProjectId = pMatch.id;
      }

      // Attempt to match assignee
      let matchedAssigneeId = '';
      if (parsed.suggested_assignee_name) {
        const uMatch = profiles.find(u =>
          u.full_name.toLowerCase().includes(parsed.suggested_assignee_name!.toLowerCase())
        );
        if (uMatch) matchedAssigneeId = uMatch.id;
      }

      setParsedTask({
        title: parsed.title,
        description: parsed.description || '',
        priority: parsed.priority || 'MEDIUM',
        due_date: parsed.due_date || '',
        project_id: matchedProjectId,
        assignee_id: matchedAssigneeId,
        project_name: projects.find(p => p.id === matchedProjectId)?.name || '',
        assignee_name: profiles.find(u => u.id === matchedAssigneeId)?.full_name || ''
      });
    } catch (err: any) {
      logger.error(err);
      setAiError(err.message || 'AI failed to parse command. Try creating manually.');
    } finally {
      setParsing(false);
    }
  };

  const confirmAICreatedTask = async () => {
    if (!parsedTask) return;

    try {
      setParsing(true);
      const payload = {
        title: parsedTask.title,
        description: parsedTask.description || undefined,
        origin: 'AI_SUGGESTED' as const,
        project_id: parsedTask.project_id || undefined,
        assignee_id: parsedTask.assignee_id || undefined,
        priority: parsedTask.priority,
        due_date: parsedTask.due_date || undefined,
        status: 'TODO' as const
      };

      await taskService.createTask(payload);
      setParsedTask(null);
      setPromptText('');
      refetch();
    } catch (err: any) {
      logger.error(err);
      setAiError(err.message || 'Failed to save parsed task');
    } finally {
      setParsing(false);
    }
  };

  const handleActionNotificationClick = (link?: string) => {
    if (link) {
      router.push(link);
    }
  };

  const formatDate = (dStr: string) => {
    const d = new Date(dStr);
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  };

  const formatTime = (dStr: string) => {
    return new Date(dStr).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="flex flex-col min-h-screen w-full relative z-10">
      <main className="quote-container flex-1 max-w-7xl mx-auto w-full space-y-6">
        {/* Banner with Greeting & Time */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h1 className="quote-header-title flex items-center gap-2">
              <Sun className="text-[var(--accent)] animate-pulse" size={28} />
              My Day Command Center
            </h1>
            <p className="quote-header-subtitle">
              UAE Business hours tracking: {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => refetch()}
              className="quote-btn quote-btn-secondary text-xs"
              disabled={loading}
            >
              <RefreshCw className={loading ? 'animate-spin' : ''} size={14} />
              Sync Feeds
            </button>
            <QuickAddTask onTaskCreated={() => refetch()} />
          </div>
        </div>

        {/* AI Quick Add Bar */}
        <div className="quote-card border-[var(--accent)]/20">
          <form onSubmit={handleAIParsing} className="flex gap-2 items-center">
            <div className="relative flex-1">
              <Sparkles size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--accent)]" />
              <input
                type="text"
                placeholder="Ask Gemini: 'Create an urgent task for Site Engineer John to check MEP alignment by tomorrow at 5pm'"
                value={promptText}
                onChange={(e) => setPromptText(e.target.value)}
                className="w-full bg-[var(--bg-card)] border border-[var(--border-color)] focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] rounded-lg pl-10 pr-4 py-2.5 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none transition-all"
                disabled={parsing}
              />
            </div>
            <button
              type="submit"
              disabled={parsing || !promptText.trim()}
              className="quote-btn quote-btn-primary px-5 h-9 rounded-lg font-bold flex items-center gap-1.5"
            >
              {parsing ? <RefreshCw className="animate-spin" size={14} /> : <Zap size={14} />}
              Parse
            </button>
          </form>

          {/* AI Parsing Confirmation Box */}
          {parsedTask && (
            <div className="mt-4 p-4 bg-[var(--bg-card-hover)] border border-[var(--accent)]/25 rounded-lg animate-in fade-in slide-in-from-top-1 duration-200 space-y-4">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="text-xs font-bold font-mono text-[var(--accent)] uppercase tracking-widest flex items-center gap-1">
                    <Sparkles size={12} />
                    Gemini Parsed Task Proposal
                  </h4>
                  <p className="text-[10px] text-[var(--text-muted)] mt-0.5">Please review the details below before saving to project master.</p>
                </div>
                <button
                  onClick={() => setParsedTask(null)}
                  className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-xs"
                >
                  ✕ Dismiss
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                <div className="space-y-1">
                  <span className="text-[var(--text-secondary)] block">Title</span>
                  <input
                    type="text"
                    value={parsedTask.title}
                    onChange={(e) => setParsedTask({ ...parsedTask, title: e.target.value })}
                    className="w-full bg-[var(--bg-card)] border border-[var(--border-color)] rounded px-2 py-1 text-[var(--text-primary)] outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-[var(--text-secondary)] block">Project Mapping</span>
                  <select
                    value={parsedTask.project_id}
                    onChange={(e) => {
                      const id = e.target.value;
                      setParsedTask({
                        ...parsedTask,
                        project_id: id,
                        project_name: projects.find(p => p.id === id)?.name || ''
                      });
                    }}
                    className="w-full bg-[var(--bg-card)] border border-[var(--border-color)] rounded px-2 py-1 text-[var(--text-primary)] outline-none"
                  >
                    <option value="">No Project</option>
                    {projects.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <span className="text-[var(--text-secondary)] block">Assignee Mapping</span>
                  <select
                    value={parsedTask.assignee_id}
                    onChange={(e) => {
                      const id = e.target.value;
                      setParsedTask({
                        ...parsedTask,
                        assignee_id: id,
                        assignee_name: profiles.find(u => u.id === id)?.full_name || ''
                      });
                    }}
                    className="w-full bg-[var(--bg-card)] border border-[var(--border-color)] rounded px-2 py-1 text-[var(--text-primary)] outline-none"
                  >
                    <option value="">Unassigned</option>
                    {profiles.map(u => (
                      <option key={u.id} value={u.id}>{u.full_name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs pt-2">
                <div className="space-y-1">
                  <span className="text-[var(--text-secondary)] block">Priority</span>
                  <select
                    value={parsedTask.priority}
                    onChange={(e) => setParsedTask({ ...parsedTask, priority: e.target.value })}
                    className="w-full bg-[var(--bg-card)] border border-[var(--border-color)] rounded px-2 py-1 text-[var(--text-primary)] outline-none"
                  >
                    <option value="LOW">🔵 LOW</option>
                    <option value="MEDIUM">🟢 MEDIUM</option>
                    <option value="HIGH">🟡 HIGH</option>
                    <option value="URGENT">🔴 URGENT</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <span className="text-[var(--text-secondary)] block">Due Date</span>
                  <input
                    type="date"
                    value={parsedTask.due_date}
                    onChange={(e) => setParsedTask({ ...parsedTask, due_date: e.target.value })}
                    className="w-full bg-[var(--bg-card)] border border-[var(--border-color)] rounded px-2 py-1 text-[var(--text-primary)] outline-none font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setParsedTask(null)}
                  className="quote-btn quote-btn-secondary h-8 py-0 rounded text-xs"
                >
                  Discard
                </button>
                <button
                  type="button"
                  onClick={confirmAICreatedTask}
                  className="quote-btn quote-btn-primary h-8 py-0 rounded text-xs"
                >
                  Confirm & Save Task
                </button>
              </div>
            </div>
          )}

          {aiError && (
            <div className="mt-3 text-xs text-[var(--status-danger-text)] font-mono flex items-center gap-1.5">
              <AlertCircle size={12} />
              {aiError}
            </div>
          )}
        </div>

        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* LEFT COLUMN: Needs Action (Approvals/Alarms) & Today (Meetings & Tasks) */}
          <div className="lg:col-span-8 space-y-6">
            
            {/* Needs Action alerts panel */}
            <div className="quote-card">
              <div className="quote-card-header">
                <h3 className="quote-card-title flex items-center gap-2">
                  <AlertCircle className="text-[var(--status-danger-text)]" size={18} />
                  Needs Action (Critical Blockages & Approvals)
                </h3>
                <span className="px-2 py-0.5 rounded text-[10px] bg-[var(--status-danger-bg)] text-[var(--status-danger-text)] border border-[var(--status-danger-border)] font-mono font-bold">
                  {needsAction.length} PENDING
                </span>
              </div>

              {needsAction.length === 0 ? (
                <div className="py-8 text-center text-[var(--text-muted)] text-xs italic">
                  No critical approvals or blockages require your action today.
                </div>
              ) : (
                <div className="divide-y divide-[var(--border-color)] space-y-3">
                  {needsAction.map((n) => (
                    <div
                      key={n.id}
                      onClick={() => handleActionNotificationClick(n.link)}
                      className="p-3 bg-[var(--status-danger-bg)]/20 border border-[var(--status-danger-border)]/30 rounded-lg flex items-center justify-between hover:bg-[var(--status-danger-bg)]/35 transition-all cursor-pointer group"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-xs text-[var(--status-danger-text)]">
                          {n.title}
                        </div>
                        <p className="text-[11px] text-[var(--text-secondary)] line-clamp-1 mt-0.5 leading-normal">
                          {n.body}
                        </p>
                      </div>
                      <ChevronRight size={14} className="text-[var(--status-danger-text)] opacity-60 group-hover:opacity-100 transition-opacity ml-2 flex-shrink-0" />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Meetings Today panel */}
            <div className="quote-card">
              <div className="quote-card-header">
                <h3 className="quote-card-title flex items-center gap-2">
                  <Calendar className="text-[var(--accent)]" size={18} />
                  Scheduled Meetings Today
                </h3>
              </div>

              {meetingsToday.length === 0 ? (
                <div className="py-8 text-center text-[var(--text-muted)] text-xs italic">
                  No meetings scheduled for today.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {meetingsToday.map((m) => (
                    <div
                      key={m.id}
                      onClick={() => router.push(`/meetings`)}
                      className="p-3.5 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg hover:border-[var(--text-muted)] transition-all cursor-pointer space-y-2 text-left"
                    >
                      <div className="flex justify-between items-start">
                        <span className="text-[10px] font-mono font-bold text-[var(--accent)] bg-[var(--accent-glow)] border border-[var(--accent)]/30 px-1.5 py-0.5 rounded">
                          {formatTime(m.starts_at)} - {formatTime(m.ends_at)}
                        </span>
                        {m.location && (
                          <span className="text-[10px] text-[var(--text-secondary)] max-w-[100px] truncate flex items-center gap-0.5">
                            <MapPin size={9} />
                            {m.location}
                          </span>
                        )}
                      </div>
                      <h4 className="font-semibold text-xs text-[var(--text-primary)] truncate mt-1">
                        {m.title}
                      </h4>
                      {m.project_name && (
                        <p className="text-[10px] text-[var(--text-secondary)] font-mono truncate">
                          Project: {m.project_name}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Tasks Due Today list */}
            <div className="quote-card">
              <div className="quote-card-header">
                <h3 className="quote-card-title flex items-center gap-2">
                  <CheckCircle2 className="text-[var(--success)]" size={18} />
                  Your Day Checklist (Tasks Due Today)
                </h3>
                <span className="text-[10px] font-mono text-[var(--text-muted)]">
                  {tasksToday.length} Tasks
                </span>
              </div>

              {tasksToday.length === 0 ? (
                <div className="py-8 text-center text-[var(--text-muted)] text-xs italic">
                  No tasks due today. Use AI Quick Add above to log work.
                </div>
              ) : (
                <div className="space-y-2">
                  {tasksToday.map((t) => (
                    <div
                      key={t.id}
                      onClick={() => setSelectedTaskId(t.id)}
                      className="p-3 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg hover:border-[var(--text-muted)] transition-all cursor-pointer flex items-center justify-between"
                    >
                      <div className="min-w-0">
                        <div className="font-semibold text-xs text-[var(--text-primary)]">{t.title}</div>
                        {t.project_name && (
                          <span className="text-[9px] font-mono text-[var(--text-secondary)] mt-1 block">
                            Project: {t.project_name}
                          </span>
                        )}
                      </div>
                      <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-[var(--bg-card-hover)] border border-[var(--border-color)] text-[var(--text-secondary)]">
                        {t.priority}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>

          {/* RIGHT COLUMN: Radar Horizon & Expedited Reports */}
          <div className="lg:col-span-4 space-y-6">
            
            {/* Urgent & Overdue list */}
            <div className="quote-card border-[var(--status-danger-border)]/30">
              <div className="quote-card-header">
                <h3 className="quote-card-title text-[var(--status-danger-text)] flex items-center gap-1.5">
                  <AlertCircle size={15} />
                  Urgent & Overdue
                </h3>
              </div>

              {urgentOverdueTasks.length === 0 ? (
                <div className="py-6 text-center text-[var(--text-muted)] text-xs italic">
                  Clear! No overdue tasks.
                </div>
              ) : (
                <div className="space-y-2 max-h-[220px] overflow-y-auto custom-scrollbar pr-1">
                  {urgentOverdueTasks.map((t) => {
                    const isOverdue = t.due_date && new Date(t.due_date) < new Date();
                    return (
                      <div
                        key={t.id}
                        onClick={() => setSelectedTaskId(t.id)}
                        className="p-2.5 bg-[var(--bg-card)] border border-[var(--border-color)] hover:border-[var(--status-danger-border)] rounded-lg cursor-pointer transition-all flex justify-between items-start gap-1"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-[11px] text-[var(--text-primary)] truncate">
                            {t.title}
                          </div>
                          {t.due_date && (
                            <span className={`text-[9px] font-mono block mt-0.5 ${isOverdue ? 'text-[var(--status-danger-text)] font-bold animate-pulse' : 'text-[var(--text-muted)]'}`}>
                              {isOverdue ? 'OVERDUE' : 'DUE'}: {formatDate(t.due_date)}
                            </span>
                          )}
                        </div>
                        <span className="text-[8px] font-mono font-extrabold px-1 py-0.5 bg-[var(--status-danger-bg)] text-[var(--status-danger-text)] border border-[var(--status-danger-border)] rounded">
                          {t.priority}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Radar Lookahead (expiring compliance docs & tasks this week) */}
            <div className="quote-card">
              <div className="quote-card-header">
                <h3 className="quote-card-title flex items-center gap-2">
                  <TrendingUp className="text-[var(--accent)]" size={15} />
                  Radar Lookout (7-Day Horizon)
                </h3>
              </div>

              <div className="space-y-4">
                {/* Expiring docs */}
                <div className="space-y-2">
                  <div className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest flex items-center gap-1">
                    <FileWarning size={11} className="text-[var(--accent)]" />
                    Expiring Project Compliance Docs
                  </div>
                  {expiringDocs.length === 0 ? (
                    <div className="p-2 bg-[var(--bg-card-hover)] rounded-lg text-[var(--text-muted)] text-[10px] italic text-center">
                      No documents expiring in 30 days.
                    </div>
                  ) : (
                    expiringDocs.map(doc => (
                      <div
                        key={doc.id}
                        onClick={() => router.push(`/documents`)}
                        className="p-2 bg-[var(--bg-card)] border border-[var(--border-color)] hover:border-[var(--text-muted)] rounded-lg cursor-pointer text-left text-xs"
                      >
                        <div className="font-semibold text-[11px] text-[var(--text-primary)] truncate">{doc.title}</div>
                        <div className="flex justify-between text-[9px] text-[var(--text-secondary)] font-mono mt-0.5">
                          <span>Expiry: {formatDate(doc.expiry_date)}</span>
                          <span className="text-[var(--accent)] truncate max-w-[100px]">{doc.project_name}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Tasks due lookahead */}
                <div className="space-y-2">
                  <div className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">
                    Tasks Due Later This Week
                  </div>
                  {tasksThisWeek.length === 0 ? (
                    <div className="p-2 bg-[var(--bg-card-hover)] rounded-lg text-[var(--text-muted)] text-[10px] italic text-center">
                      No other tasks due this week.
                    </div>
                  ) : (
                    tasksThisWeek.map(t => (
                      <div
                        key={t.id}
                        onClick={() => setSelectedTaskId(t.id)}
                        className="p-2 bg-[var(--bg-card)] border border-[var(--border-color)] hover:border-[var(--text-muted)] rounded-lg cursor-pointer text-left text-xs flex justify-between items-center"
                      >
                        <div className="min-w-0 flex-1 pr-2">
                          <div className="font-semibold text-[11px] text-[var(--text-primary)] truncate">{t.title}</div>
                          {t.due_date && <span className="text-[9px] text-[var(--text-secondary)] font-mono">Due: {formatDate(t.due_date)}</span>}
                        </div>
                        <span className="text-[8px] font-mono px-1 py-0.5 rounded bg-[var(--bg-card-hover)] border border-[var(--border-color)] text-[var(--text-secondary)]">
                          {t.priority}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Recently Completed Log */}
            <div className="quote-card">
              <div className="quote-card-header">
                <h3 className="quote-card-title text-[var(--text-secondary)] flex items-center gap-1.5">
                  <CheckCircle2 size={15} />
                  Recently Completed (48h)
                </h3>
              </div>

              {recentlyCompleted.length === 0 ? (
                <div className="py-4 text-center text-[var(--text-muted)] text-[10px] italic">
                  No completed tasks logged recently.
                </div>
              ) : (
                <div className="space-y-2">
                  {recentlyCompleted.map(t => (
                    <div
                      key={t.id}
                      onClick={() => setSelectedTaskId(t.id)}
                      className="p-2 bg-[var(--bg-card)] border border-[var(--border-color)]/50 hover:border-[var(--text-muted)] rounded-lg text-left text-xs cursor-pointer opacity-70"
                    >
                      <div className="font-semibold text-[11px] text-[var(--text-secondary)] truncate line-through">{t.title}</div>
                      {t.completed_at && (
                        <span className="text-[9px] text-[var(--text-muted)] font-mono mt-0.5 block">
                          Completed: {formatDate(t.completed_at)} {formatTime(t.completed_at)}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        </div>
      </main>

      {/* Task Drawer Inspector Overlay */}
      {selectedTaskId && (
        <>
          <div className="fixed inset-0 bg-black/55 z-40" onClick={() => setSelectedTaskId(null)} />
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
