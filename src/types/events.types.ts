// ============================================================
// JEET ERP — Event Bus Module Type Definitions
// ============================================================

export type SystemEvent = {
  id: string;
  event_type: string;
  entity_type?: string;
  entity_id?: string;
  project_id?: string;
  payload: Record<string, any>;
  actor_user_id?: string;
  processed_at?: string;
  processing_error?: string;
  created_at: string;
};

export type EventType = {
  event_type: string;
  module: string;
  description?: string;
  default_severity: 'INFO' | 'ACTION_REQUIRED' | 'CRITICAL';
  is_active: boolean;
};

export const EVENT_MODULES = {
  QUOTATION: 'QUOTATION',
  COMPARISON: 'COMPARISON',
  PROJECTS: 'PROJECTS',
  DMS: 'DMS',
  TASKS: 'TASKS',
  MEETINGS: 'MEETINGS',
  ESCALATION: 'ESCALATION'
} as const;
