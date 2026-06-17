// ============================================================
// JEET ERP — Workload Heat Strip (Team Workload Index)
// ============================================================

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { taskService } from '@/services/taskService';
import { User, ShieldAlert, Sparkles, RefreshCw } from 'lucide-react';

type AnalyticsData = {
  user_id: string;
  full_name: string;
  role: string;
  todo_count: number;
  in_progress_count: number;
  blocked_count: number;
  overdue_count: number;
};

export const WorkloadHeatStrip: React.FC = () => {
  const [data, setData] = useState<AnalyticsData[]>([]);
  const [loading, setLoading] = useState(true);

  const loadAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      const stats = await taskService.fetchWorkloadAnalytics();
      setData(stats);
    } catch (err) {
      console.error('Failed to load workload analytics:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  const getCapacityConfig = (stats: AnalyticsData) => {
    const totalActive = stats.todo_count + stats.in_progress_count;
    if (stats.overdue_count > 0) {
      return { label: 'CRITICAL (OVERDUE)', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)', border: 'border-[var(--status-danger-border)]' };
    }
    if (totalActive >= 8) {
      return { label: 'OVERLOADED', color: '#f97316', bg: 'rgba(249, 115, 22, 0.1)', border: 'border-orange-500/30' };
    }
    if (totalActive >= 5) {
      return { label: 'HIGH CAPACITY', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)', border: 'border-[var(--status-warning-border)]' };
    }
    if (totalActive > 0) {
      return { label: 'BALANCED', color: '#10b981', bg: 'rgba(16, 185, 129, 0.1)', border: 'border-[var(--accent)]' };
    }
    return { label: 'IDLE', color: 'var(--text-secondary)', bg: 'rgba(148, 163, 184, 0.05)', border: 'border-[var(--border)]' };
  };

  if (loading) {
    return (
      <div className="quote-card py-6 flex items-center justify-center gap-2">
        <RefreshCw className="animate-spin text-[var(--accent)]" size={16} />
        <span className="text-[var(--text-secondary)] font-mono text-xs">CALCULATING CAPACITIES...</span>
      </div>
    );
  }

  return (
    <div className="quote-card">
      <div className="quote-card-header">
        <div>
          <h3 className="quote-card-title flex items-center gap-2">
            <Sparkles size={16} className="text-[var(--accent)]" />
            Team Workload & Capacity Index
          </h3>
          <p className="quote-header-subtitle">Realtime capacity calculations based on active tasks and due dates.</p>
        </div>
        <button
          onClick={loadAnalytics}
          className="text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors p-1"
          title="Refresh statistics"
        >
          <RefreshCw size={14} />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mt-2">
        {data.map(user => {
          const cap = getCapacityConfig(user);
          const totalActive = user.todo_count + user.in_progress_count;

          return (
            <div
              key={user.user_id}
              className={`p-3.5 rounded-xl border bg-[var(--bg-card)] backdrop-blur-md flex flex-col justify-between transition-all ${cap.border}`}
              style={{ backgroundColor: cap.bg }}
            >
              {/* Profile Card Header */}
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-semibold text-xs text-[var(--text-primary)] truncate">{user.full_name}</div>
                  <div className="text-[10px] text-[var(--text-muted)] font-mono truncate">{user.role}</div>
                </div>
                <div className="h-6 w-6 rounded bg-[var(--surface-hover)] border border-[var(--border)] flex items-center justify-center text-[var(--text-secondary)]">
                  <User size={12} />
                </div>
              </div>

              {/* Capacities */}
              <div className="mt-4 space-y-2">
                <div className="flex justify-between items-center text-[10px] font-mono">
                  <span className="text-[var(--text-muted)]">Active Task Count</span>
                  <span className="font-bold text-[var(--text-secondary)]">{totalActive} open</span>
                </div>
                {/* Horizontal bar indicator */}
                <div className="h-1.5 w-full bg-[var(--surface-hover)] rounded overflow-hidden">
                  <div
                    className="h-full transition-all duration-500"
                    style={{
                      backgroundColor: cap.color,
                      width: `${Math.min(100, Math.max(10, (totalActive / 10) * 100))}%`
                    }}
                  />
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-4 gap-1 text-center mt-3 pt-2 border-t border-[var(--border)] font-mono text-[9px]">
                <div>
                  <div className="text-[var(--text-muted)]">TODO</div>
                  <div className="font-bold text-[var(--text-secondary)] mt-0.5">{user.todo_count}</div>
                </div>
                <div>
                  <div className="text-[var(--text-muted)]">PROG</div>
                  <div className="font-bold text-[var(--text-secondary)] mt-0.5">{user.in_progress_count}</div>
                </div>
                <div>
                  <div className="text-[var(--text-muted)]">BLCK</div>
                  <div className={`font-bold mt-0.5 ${user.blocked_count > 0 ? 'text-[var(--status-danger-text)]' : 'text-[var(--text-muted)]'}`}>
                    {user.blocked_count}
                  </div>
                </div>
                <div>
                  <div className="text-[var(--text-muted)]">OVER</div>
                  <div className={`font-bold mt-0.5 ${user.overdue_count > 0 ? 'text-[var(--status-danger-text)]' : 'text-[var(--text-muted)]'}`}>
                    {user.overdue_count}
                  </div>
                </div>
              </div>

              {/* Capacity Badge */}
              <div className="mt-3.5 flex items-center justify-between text-[9px] font-mono">
                <span className="text-[var(--text-muted)]">CAPACITY STATUS</span>
                <span className="font-extrabold tracking-wide" style={{ color: cap.color }}>
                  {cap.label}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default WorkloadHeatStrip;
