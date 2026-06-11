// ============================================================
// JEET ERP — Meetings Module Type Definitions
// ============================================================

export type MeetingStatus = 'SCHEDULED' | 'COMPLETED' | 'CANCELLED';

export type AttendeeResponse = 'PENDING' | 'ACCEPTED' | 'DECLINED';

export type Meeting = {
  id: string;
  title: string;
  project_id?: string;
  organizer_id: string;
  location?: string;
  starts_at: string;
  ends_at: string;
  agenda?: string;
  status: MeetingStatus;
  
  minutes?: string;
  minutes_published_at?: string;
  
  google_event_id?: string;
  recurrence?: {
    freq: 'DAILY' | 'WEEKLY';
    interval?: number;
    until?: string;
  };
  created_at: string;

  // Joined values
  organizer_name?: string;
  project_name?: string;
  attendees?: MeetingAttendee[];
  action_items?: MeetingActionItem[];
};

export type MeetingAttendee = {
  id: string;
  meeting_id: string;
  user_id?: string; // Null for external attendees
  external_name?: string;
  external_email?: string;
  response: AttendeeResponse;
  
  // Joined from profiles if user_id is set
  full_name?: string;
  email?: string;
};

export type MeetingActionItem = {
  id: string;
  meeting_id: string;
  description: string;
  assignee_id?: string;
  due_date?: string;
  task_id?: string;
  created_at: string;

  // Joined from profiles
  assignee_name?: string;
};
