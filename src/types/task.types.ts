// ============================================================
// JEET ERP — Task Management Module Type Definitions
// ============================================================

export type TaskOrigin = 'MANUAL' | 'AUTO_RULE' | 'MEETING_ACTION' | 'AI_SUGGESTED';

export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export type TaskStatus = 
  | 'TODO' 
  | 'IN_PROGRESS' 
  | 'BLOCKED' 
  | 'DONE' 
  | 'DONE_AUTO' 
  | 'CANCELLED';

export type TaskRule = {
  id: string;
  event_type: string;
  title_template: string;
  description_template: string;
  assignee_strategy: 'ROLE' | 'PROJECT_ROLE' | 'SPECIFIC_USER_FROM_PAYLOAD' | 'PREPARED_BY';
  assignee_value?: string;
  priority: TaskPriority;
  due_hours: number;
  auto_complete_on_event?: string;
  is_active: boolean;
};

export type Task = {
  id: string;
  title: string;
  description?: string;
  origin: TaskOrigin;
  source_event_id?: string;
  task_rule_id?: string;
  
  project_id?: string;
  linked_entity_type?: string;
  linked_entity_id?: string;
  
  assignee_id?: string;
  created_by: string;
  priority: TaskPriority;
  status: TaskStatus;
  due_date?: string;
  completed_at?: string;
  
  recurrence?: {
    freq: 'DAILY' | 'WEEKLY' | 'MONTHLY';
    byday?: string[];
    until?: string;
  };
  parent_recurring_id?: string;
  
  blocked_reason?: string;
  tags: string[];
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;

  // Joined profiles for display
  assignee_name?: string;
  creator_name?: string;
  project_name?: string;
  comments?: TaskComment[];
};

export type TaskComment = {
  id: string;
  task_id: string;
  user_id: string;
  body: string;
  created_at: string;
  user_name?: string;
};
