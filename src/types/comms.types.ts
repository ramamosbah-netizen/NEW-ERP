// ============================================================
// JEET ERP — Communication & Collaboration — Types
// ============================================================

export type ConversationType = 'DIRECT' | 'GROUP' | 'CHANNEL' | 'PROJECT';
export type MemberRole = 'owner' | 'admin' | 'member';
export type MessageType = 'text' | 'file' | 'system' | 'call';
export type AnnouncementPriority = 'normal' | 'important' | 'urgent';
export type CallType = 'voice' | 'video';
export type NotifChannel = 'in_app' | 'email' | 'whatsapp' | 'push';

export interface Attachment { name: string; path: string; mime?: string; size?: number; url?: string; }

export interface Conversation {
  id: string;
  type: ConversationType;
  name: string | null;
  description: string | null;
  channel_key: string | null;
  project_id: string | null;
  avatar_url: string | null;
  is_archived: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  last_message_at: string | null;
  // joined / computed
  members?: ConversationMember[];
  display_name?: string;
  unread?: number;
  last_message?: Message | null;
}

export interface ConversationMember {
  conversation_id: string;
  user_id: string;
  role: MemberRole;
  joined_at: string;
  last_read_at: string | null;
  is_muted: boolean;
  // joined
  full_name?: string;
  email?: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string | null;
  body: string | null;
  type: MessageType;
  parent_message_id: string | null;
  attachments: Attachment[];
  mentions: string[];
  edited_at: string | null;
  is_deleted: boolean;
  created_at: string;
  // joined / computed
  sender_name?: string;
  reactions?: MessageReaction[];
  reply_count?: number;
  read_by?: string[];
}

export interface MessageReaction { message_id: string; user_id: string; emoji: string; created_at: string; }
export interface MessageRead { message_id: string; user_id: string; read_at: string; }

export interface Announcement {
  id: string;
  title: string;
  body: string | null;
  author_id: string | null;
  audience: 'all' | 'department' | 'role';
  department: string | null;
  target_role: string | null;
  priority: AnnouncementPriority;
  is_pinned: boolean;
  attachments: Attachment[];
  published_at: string;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
  author_name?: string;
  read?: boolean;
}

export interface CommCall {
  id: string;
  conversation_id: string | null;
  type: CallType;
  room_name: string;
  room_url: string | null;
  title: string | null;
  started_by: string | null;
  status: 'ringing' | 'ongoing' | 'ended';
  participants: string[];
  started_at: string;
  ended_at: string | null;
}

export interface SharedDocument {
  id: string;
  title: string;
  description: string | null;
  conversation_id: string | null;
  owner_id: string | null;
  current_version: number;
  storage_path: string | null;
  mime_type: string | null;
  size_bytes: number;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
  owner_name?: string;
  version_count?: number;
  comment_count?: number;
}

export interface DocumentVersion {
  id: string;
  document_id: string;
  version: number;
  storage_path: string | null;
  size_bytes: number;
  note: string | null;
  uploaded_by: string | null;
  created_at: string;
  uploaded_by_name?: string;
}

export interface DocumentComment {
  id: string;
  document_id: string;
  user_id: string | null;
  body: string;
  created_at: string;
  user_name?: string;
}

export interface CommNotification {
  id: string;
  user_id: string;
  type: 'message' | 'mention' | 'announcement' | 'call' | 'document';
  title: string | null;
  body: string | null;
  link: string | null;
  actor_id: string | null;
  conversation_id: string | null;
  is_read: boolean;
  created_at: string;
  actor_name?: string;
}

export interface NotificationPref {
  user_id: string;
  channel: NotifChannel;
  event_type: 'all' | 'mention' | 'dm' | 'channel' | 'announcement' | 'call';
  enabled: boolean;
}

export interface DirectoryUser { id: string; full_name: string; email?: string; role?: string; }

export const DEPARTMENT_CHANNELS = [
  { key: 'finance', label: '#finance' },
  { key: 'procurement', label: '#procurement' },
  { key: 'warehouse', label: '#warehouse' },
  { key: 'projects', label: '#projects' },
  { key: 'service-desk', label: '#service-desk' },
  { key: 'hr', label: '#hr' },
  { key: 'management', label: '#management' },
];
