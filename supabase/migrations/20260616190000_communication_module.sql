-- ============================================================
-- JEET ERP — Communication & Collaboration Module
-- Self-contained. Additive only — does not touch existing tables.
-- Idempotent: safe to run multiple times.
-- ============================================================

-- ---------- Conversations (DM / group / channel / project room) ----------
create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  type text not null default 'DIRECT' check (type in ('DIRECT','GROUP','CHANNEL','PROJECT')),
  name text,
  description text,
  channel_key text,                       -- e.g. 'finance' for #finance
  project_id uuid,                         -- soft link to projects (no FK to avoid coupling)
  avatar_url text,
  is_archived boolean not null default false,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_message_at timestamptz default now()
);
create index if not exists idx_conversations_type on conversations(type);
create index if not exists idx_conversations_channel_key on conversations(channel_key);
create index if not exists idx_conversations_project on conversations(project_id);
create unique index if not exists uq_conversations_channel_key on conversations(channel_key) where type = 'CHANNEL' and channel_key is not null;

-- ---------- Members ----------
create table if not exists conversation_members (
  conversation_id uuid not null references conversations(id) on delete cascade,
  user_id uuid not null,
  role text not null default 'member' check (role in ('owner','admin','member')),
  joined_at timestamptz not null default now(),
  last_read_at timestamptz default now(),
  is_muted boolean not null default false,
  primary key (conversation_id, user_id)
);
create index if not exists idx_conv_members_user on conversation_members(user_id);

-- ---------- Messages (text / file / system / call) + threads ----------
create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  sender_id uuid,
  body text,
  type text not null default 'text' check (type in ('text','file','system','call')),
  parent_message_id uuid references messages(id) on delete cascade,   -- thread root
  attachments jsonb not null default '[]'::jsonb,                     -- [{name,path,mime,size}]
  mentions jsonb not null default '[]'::jsonb,                        -- [user_id,...]
  edited_at timestamptz,
  is_deleted boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_messages_conversation on messages(conversation_id, created_at);
create index if not exists idx_messages_parent on messages(parent_message_id);
create index if not exists idx_messages_sender on messages(sender_id);

-- ---------- Reactions / read receipts ----------
create table if not exists message_reactions (
  message_id uuid not null references messages(id) on delete cascade,
  user_id uuid not null,
  emoji text not null,
  created_at timestamptz not null default now(),
  primary key (message_id, user_id, emoji)
);
create table if not exists message_reads (
  message_id uuid not null references messages(id) on delete cascade,
  user_id uuid not null,
  read_at timestamptz not null default now(),
  primary key (message_id, user_id)
);
create index if not exists idx_message_reads_user on message_reads(user_id);

-- ---------- Company announcements ----------
create table if not exists announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text,
  author_id uuid,
  audience text not null default 'all' check (audience in ('all','department','role')),
  department text,
  target_role text,
  priority text not null default 'normal' check (priority in ('normal','important','urgent')),
  is_pinned boolean not null default false,
  attachments jsonb not null default '[]'::jsonb,
  published_at timestamptz not null default now(),
  expires_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists idx_announcements_published on announcements(published_at desc);
create table if not exists announcement_reads (
  announcement_id uuid not null references announcements(id) on delete cascade,
  user_id uuid not null,
  read_at timestamptz not null default now(),
  primary key (announcement_id, user_id)
);

-- ---------- Voice / video calls (Jitsi rooms) ----------
create table if not exists comm_calls (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references conversations(id) on delete set null,
  type text not null default 'video' check (type in ('voice','video')),
  room_name text not null,
  room_url text,
  title text,
  started_by uuid,
  status text not null default 'ongoing' check (status in ('ringing','ongoing','ended')),
  participants jsonb not null default '[]'::jsonb,
  started_at timestamptz not null default now(),
  ended_at timestamptz
);
create index if not exists idx_comm_calls_conversation on comm_calls(conversation_id);

-- ---------- Document sharing + version control + comments ----------
create table if not exists shared_documents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  conversation_id uuid references conversations(id) on delete set null,
  owner_id uuid,
  current_version integer not null default 1,
  storage_path text,
  mime_type text,
  size_bytes bigint default 0,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists document_versions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references shared_documents(id) on delete cascade,
  version integer not null,
  storage_path text,
  size_bytes bigint default 0,
  note text,
  uploaded_by uuid,
  created_at timestamptz not null default now()
);
create index if not exists idx_document_versions_doc on document_versions(document_id, version desc);
create table if not exists document_comments (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references shared_documents(id) on delete cascade,
  user_id uuid,
  body text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_document_comments_doc on document_comments(document_id, created_at);

-- ---------- Notifications: per-channel preferences + in-app feed ----------
create table if not exists comm_notification_prefs (
  user_id uuid not null,
  channel text not null check (channel in ('in_app','email','whatsapp','push')),
  event_type text not null default 'all' check (event_type in ('all','mention','dm','channel','announcement','call')),
  enabled boolean not null default true,
  primary key (user_id, channel, event_type)
);
create table if not exists comm_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  type text not null default 'message' check (type in ('message','mention','announcement','call','document')),
  title text,
  body text,
  link text,
  actor_id uuid,
  conversation_id uuid,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_comm_notifications_user on comm_notifications(user_id, is_read, created_at desc);

-- ---------- RLS (collaborative — internal trusted team) ----------
do $$
declare t text;
begin
  foreach t in array array[
    'conversations','conversation_members','messages','message_reactions','message_reads',
    'announcements','announcement_reads','comm_calls','shared_documents','document_versions',
    'document_comments','comm_notification_prefs','comm_notifications'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists %I on %I', t||'_all', t);
    execute format('create policy %I on %I for all using (true) with check (true)', t||'_all', t);
  end loop;
end $$;

-- ---------- Realtime publication ----------
do $$
declare t text;
begin
  foreach t in array array['conversations','conversation_members','messages','message_reactions','comm_notifications','comm_calls','announcements'] loop
    begin
      execute format('alter publication supabase_realtime add table %I', t);
    exception when duplicate_object then null; when undefined_object then null;
    end;
  end loop;
end $$;

-- ---------- Seed department channels ----------
insert into conversations (type, name, description, channel_key)
select 'CHANNEL', c.name, c.descr, c.key
from (values
  ('finance',      '#finance',      'Finance & accounting discussions'),
  ('procurement',  '#procurement',  'Procurement & purchasing'),
  ('warehouse',    '#warehouse',    'Warehouse & inventory'),
  ('projects',     '#projects',     'Projects coordination'),
  ('service-desk', '#service-desk', 'Service desk & AMC'),
  ('hr',           '#hr',           'HR & workforce'),
  ('management',   '#management',   'Management & leadership')
) as c(key, name, descr)
where not exists (select 1 from conversations x where x.type='CHANNEL' and x.channel_key = c.key);

notify pgrst, 'reload schema';
