'use client';

// ============================================================
// JEET ERP — WorkflowAnalytics
// Live process KPIs for a module's workflow: volume by status,
// overdue SLA count, average completion time.
// ============================================================

import React, { useState, useEffect } from 'react';
import workflowService from '@/services/workflowService';
import type { WorkflowStatus, StatusColor } from '@/types/platform.types';
import { Card } from '@/components/ui/Card';
import { Activity, AlertTriangle, Clock, CheckCircle2 } from 'lucide-react';

const COLOR_VAR: Record<StatusColor, string> = {
  neutral: 'var(--text-muted)',
  info: 'var(--status-info-text)',
  success: 'var(--success)',
  warning: 'var(--warning)',
  danger: 'var(--error)',
};

interface WorkflowAnalyticsProps {
  moduleKey: string;
  statuses: WorkflowStatus[];
  className?: string;
}

export const WorkflowAnalytics: React.FC<WorkflowAnalyticsProps> = ({ moduleKey, statuses, className = '' }) => {
  const [data, setData] = useState<{
    byStatus: Record<string, number>;
    total: number;
    overdue: number;
    avgHoursToTerminal: number | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    workflowService.getWorkflowAnalytics(moduleKey)
      .then(d => { if (!cancelled) setData(d); })
      .catch(() => { /* tables may not exist yet */ })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [moduleKey]);

  if (loading) {
    return (
      <Card className={className}>
        <div className="py-4 flex justify-center">
          <div className="h-5 w-5 border-2 border-[var(--border-color)] border-t-[var(--text-primary)] animate-spin rounded-full" />
        </div>
      </Card>
    );
  }

  if (!data || data.total === 0) {
    return (
      <Card title="Process analytics" icon={Activity} className={className}>
        <p className="text-xs text-[var(--text-muted)] py-3 text-center">
          No tracked records yet — analytics appear once documents start moving through this workflow.
        </p>
      </Card>
    );
  }

  const terminalKeys = new Set(statuses.filter(s => s.is_terminal).map(s => s.status_key));
  const completed = Object.entries(data.byStatus)
    .filter(([k]) => terminalKeys.has(k))
    .reduce((sum, [, n]) => sum + n, 0);
  const inFlight = data.total - completed;
  const maxCount = Math.max(...Object.values(data.byStatus), 1);

  return (
    <Card title="Process analytics" subtitle="Live metrics from workflow instances" icon={Activity} className={className}>
      <div className="flex flex-col gap-4">
        {/* KPI strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-[var(--bg-card-hover)] rounded-md p-3">
            <span className="text-xs text-[var(--text-muted)] block">Total tracked</span>
            <span className="text-lg font-semibold text-[var(--text-primary)]">{data.total}</span>
          </div>
          <div className="bg-[var(--bg-card-hover)] rounded-md p-3">
            <span className="text-xs text-[var(--text-muted)] flex items-center gap-1"><Clock size={11} /> In flight</span>
            <span className="text-lg font-semibold text-[var(--text-primary)]">{inFlight}</span>
          </div>
          <div className="bg-[var(--bg-card-hover)] rounded-md p-3">
            <span className="text-xs text-[var(--text-muted)] flex items-center gap-1"><CheckCircle2 size={11} /> Completed</span>
            <span className="text-lg font-semibold text-[var(--text-primary)]">{completed}</span>
          </div>
          <div className="bg-[var(--bg-card-hover)] rounded-md p-3">
            <span className={`text-xs flex items-center gap-1 ${data.overdue > 0 ? 'text-[var(--error)]' : 'text-[var(--text-muted)]'}`}>
              <AlertTriangle size={11} /> SLA overdue
            </span>
            <span className={`text-lg font-semibold ${data.overdue > 0 ? 'text-[var(--error)]' : 'text-[var(--text-primary)]'}`}>
              {data.overdue}
            </span>
          </div>
        </div>

        {/* Status distribution bars */}
        <div className="flex flex-col gap-1.5">
          {statuses
            .slice()
            .sort((a, b) => a.sort_order - b.sort_order)
            .map(s => {
              const count = data.byStatus[s.status_key] || 0;
              return (
                <div key={s.id} className="flex items-center gap-2.5">
                  <span className="text-xs text-[var(--text-secondary)] w-32 truncate flex-shrink-0">{s.label}</span>
                  <div className="flex-1 h-2 rounded-full bg-[var(--bg-card-hover)] overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${(count / maxCount) * 100}%`, backgroundColor: COLOR_VAR[s.color] || COLOR_VAR.neutral, opacity: 0.75 }}
                    />
                  </div>
                  <span className="text-xs font-mono font-medium text-[var(--text-primary)] w-8 text-right flex-shrink-0">{count}</span>
                </div>
              );
            })}
        </div>

        {data.avgHoursToTerminal !== null && (
          <p className="text-xs text-[var(--text-muted)] border-t border-[var(--border-color)] pt-3">
            Average time to completion: <span className="font-medium text-[var(--text-primary)]">
              {data.avgHoursToTerminal >= 48
                ? `${Math.round(data.avgHoursToTerminal / 24)} days`
                : `${data.avgHoursToTerminal} hours`}
            </span>
          </p>
        )}
      </div>
    </Card>
  );
};

export default WorkflowAnalytics;
