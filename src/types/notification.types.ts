// ============================================================
// JEET ERP — Notification Module Type Definitions
// ============================================================

export type NotificationSeverity = 'INFO' | 'ACTION_REQUIRED' | 'CRITICAL';

export type NotificationChannel = 'IN_APP' | 'EMAIL' | 'WHATSAPP';

export type NotificationStatus = 
  | 'PENDING' 
  | 'SENT' 
  | 'DELIVERED' 
  | 'READ' 
  | 'ACTIONED' 
  | 'FAILED'
  | 'SKIPPED_CHANNEL_INACTIVE';

export type NotificationPreferenceMode = 'INSTANT' | 'DIGEST' | 'OFF';

export type NotificationRule = {
  id: string;
  event_type: string;
  recipient_strategy: 'ROLE' | 'PROJECT_ROLE' | 'SPECIFIC_USER_FROM_PAYLOAD' | 'PREPARED_BY';
  recipient_value?: string;
  channels: NotificationChannel[];
  severity: NotificationSeverity;
  title_template: string;
  body_template: string;
  link_template: string;
  is_digest_eligible: boolean;
  escalation_hours?: number;
  escalation_to_role?: string;
  is_active: boolean;
};

export type Notification = {
  id: string;
  user_id: string;
  event_id?: string;
  channel: NotificationChannel;
  severity: NotificationSeverity;
  title: string;
  body: string;
  link: string;
  status: NotificationStatus;
  read_at?: string;
  actioned_at?: string;
  created_at: string;
};

export type UserNotificationPreference = {
  user_id: string;
  event_module: string;
  channel: NotificationChannel;
  mode: NotificationPreferenceMode;
};

export type EscalationTimer = {
  id: string;
  event_id: string;
  notification_rule_id: string;
  escalate_at: string;
  escalated: boolean;
  cancelled: boolean;
  created_at: string;
};
