export type AuditSource = 'UI' | 'API' | 'CRON' | 'WEBHOOK';

export interface AuditLog {
  id: string;
  occurred_at: string;
  actor_user_id: string | null;
  actor_role: string | null;
  action: string;
  entity_type: string;
  entity_id: string;
  entity_label: string | null;
  summary: string;
  before: Record<string, any> | null;
  after: Record<string, any> | null;
  ip: string | null;
  source: AuditSource;
  module: string;
  actor_name?: string; // resolved via profile join in client-side queries
}

export interface AuditLogFilter {
  module?: string;
  entity_type?: string;
  entity_id?: string;
  actor_user_id?: string;
  action?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
}
