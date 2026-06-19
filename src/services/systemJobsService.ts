import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';

// ============================================================
// Aura ERP — System Health service (Administration → System Health)
// Read-only over `system_jobs` (scheduled-run registry) + the existing
// `system_events` ledger (event pipeline: queue, dead-letter, throughput).
// Plus two safe operator actions: invoke a job, reprocess a stuck event
// (both go through the existing edge functions; no table mutation here).
// ============================================================

export interface JobRun {
  id: string;
  job_name: string;
  status: 'RUNNING' | 'SUCCESS' | 'FAILED';
  started_at: string;
  finished_at: string | null;
  duration_ms: number | null;
  items_processed: number | null;
  error: string | null;
}

export interface JobSummary {
  key: string;
  label: string;
  description: string;
  cadence: string;
  lastRun: JobRun | null;
  runs30d: number;
  failures30d: number;
}

export interface PipelineHealth {
  queued: number;        // system_events not yet processed
  failed: number;        // system_events with a processing error (dead-letter)
  processed24h: number;
  throughput: { day: string; value: number }[];
  topTypes: { type: string; count: number }[];
}

export interface DeadLetterEvent {
  id: string;
  event_type: string;
  entity_type: string | null;
  entity_id: string | null;
  processing_error: string | null;
  created_at: string;
}

// The scheduled jobs we instrument with run telemetry (_shared/jobRun.ts).
// calendar-sync is request-driven (OAuth), not a scheduled job, so it's excluded.
export const JOB_CATALOG: { key: string; label: string; description: string; cadence: string }[] = [
  { key: 'escalation-check',         label: 'Escalation check',        description: 'Approval escalations + document-expiry alerts', cadence: 'Every 15 min' },
  { key: 'hr-expiry-check',          label: 'HR expiry check',         description: 'Visa / passport / labour-card expiries',       cadence: 'Daily' },
  { key: 'invoice-overdue-check',    label: 'Invoice overdue check',   description: 'Overdue client invoices → tasks',             cadence: 'Daily' },
  { key: 'po-delivery-overdue-check',label: 'PO delivery overdue',     description: 'Overdue PO deliveries → tasks',               cadence: 'Daily' },
  { key: 'snag-overdue-check',       label: 'Snag overdue check',      description: 'Overdue snags → tasks',                       cadence: 'Daily' },
  { key: 'retention-release-check',  label: 'Retention release',       description: 'DLP retention release on finished projects',  cadence: 'Daily' },
  { key: 'meeting-reminders',        label: 'Meeting reminders',       description: 'Upcoming meeting reminders',                  cadence: 'Hourly' },
  { key: 'daily-digest',             label: 'Daily digest',            description: 'Daily activity digest emails',                cadence: 'Daily' },
  { key: 'leave-accrual',            label: 'Leave accrual',           description: 'Periodic leave-balance accrual',              cadence: 'Daily' },
];

export const systemJobsService = {
  /** Recent scheduled-job runs, newest first. */
  async getRecentRuns(limit = 60): Promise<JobRun[]> {
    try {
      const { data, error } = await supabase
        .from('system_jobs')
        .select('id, job_name, status, started_at, finished_at, duration_ms, items_processed, error')
        .order('started_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data || []) as JobRun[];
    } catch (err) {
      logger.error('getRecentRuns failed:', err);
      return [];
    }
  },

  /** Per-job summary: last run + 30-day run/failure counts, merged with the catalog. */
  async getJobSummaries(): Promise<JobSummary[]> {
    const since = new Date(Date.now() - 30 * 864e5).toISOString();
    let rows: JobRun[] = [];
    try {
      const { data, error } = await supabase
        .from('system_jobs')
        .select('id, job_name, status, started_at, finished_at, duration_ms, items_processed, error')
        .gte('started_at', since)
        .order('started_at', { ascending: false })
        .limit(2000);
      if (error) throw error;
      rows = (data || []) as JobRun[];
    } catch (err) {
      logger.error('getJobSummaries failed:', err);
    }
    return JOB_CATALOG.map(c => {
      const forJob = rows.filter(r => r.job_name === c.key);
      return {
        ...c,
        lastRun: forJob[0] || null,
        runs30d: forJob.length,
        failures30d: forJob.filter(r => r.status === 'FAILED').length,
      };
    });
  },

  /** Event-pipeline health from the existing system_events ledger. */
  async getPipelineHealth(): Promise<PipelineHealth> {
    const empty: PipelineHealth = { queued: 0, failed: 0, processed24h: 0, throughput: [], topTypes: [] };
    try {
      const now = Date.now();
      const d14 = new Date(now - 14 * 864e5).toISOString();
      const d1 = new Date(now - 864e5).toISOString();

      const [queuedR, failedR, proc24R, recentR] = await Promise.all([
        supabase.from('system_events').select('id', { count: 'exact', head: true }).is('processed_at', null),
        supabase.from('system_events').select('id', { count: 'exact', head: true }).not('processing_error', 'is', null),
        supabase.from('system_events').select('id', { count: 'exact', head: true }).gte('processed_at', d1),
        supabase.from('system_events').select('event_type, created_at').gte('created_at', d14).order('created_at', { ascending: false }).limit(3000),
      ]);

      const recent = (recentR.data || []) as { event_type: string; created_at: string }[];
      const dayMap = new Map<string, number>();
      for (let i = 13; i >= 0; i--) dayMap.set(new Date(now - i * 864e5).toISOString().slice(0, 10), 0);
      const typeMap = new Map<string, number>();
      recent.forEach(e => {
        const k = (e.created_at || '').slice(0, 10);
        if (dayMap.has(k)) dayMap.set(k, (dayMap.get(k) || 0) + 1);
        typeMap.set(e.event_type, (typeMap.get(e.event_type) || 0) + 1);
      });

      return {
        queued: queuedR.count || 0,
        failed: failedR.count || 0,
        processed24h: proc24R.count || 0,
        throughput: [...dayMap.entries()].map(([d, v]) => ({ day: d.slice(5), value: v })),
        topTypes: [...typeMap.entries()].map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count).slice(0, 6),
      };
    } catch (err) {
      logger.error('getPipelineHealth failed:', err);
      return empty;
    }
  },

  /** Failed (dead-letter) events for investigation / reprocessing. */
  async getDeadLetter(limit = 25): Promise<DeadLetterEvent[]> {
    try {
      const { data, error } = await supabase
        .from('system_events')
        .select('id, event_type, entity_type, entity_id, processing_error, created_at')
        .not('processing_error', 'is', null)
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data || []) as DeadLetterEvent[];
    } catch (err) {
      logger.error('getDeadLetter failed:', err);
      return [];
    }
  },

  /** Manually run a scheduled job (invokes its edge function). */
  async invokeJob(key: string): Promise<{ ok: boolean; error?: string }> {
    try {
      const { error } = await supabase.functions.invoke(key, { body: {} });
      if (error) throw error;
      return { ok: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error(`invokeJob(${key}) failed:`, err);
      return { ok: false, error: msg };
    }
  },

  /** Re-run the event processor for a stuck/failed event (no direct table write). */
  async reprocessEvent(eventId: string): Promise<{ ok: boolean; error?: string }> {
    try {
      const { error } = await supabase.functions.invoke('process-event', { body: { event_id: eventId } });
      if (error) throw error;
      return { ok: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error(`reprocessEvent(${eventId}) failed:`, err);
      return { ok: false, error: msg };
    }
  },
};

export default systemJobsService;
