-- ============================================================
-- JEET ERP — Platform Layer: Meetings Module Schema
-- Scheduled events, attendees, action items, and calendar tokens
-- ============================================================

-- Reset tables safely
DROP TABLE IF EXISTS public.user_integrations CASCADE;
DROP TABLE IF EXISTS public.meeting_action_items CASCADE;
DROP TABLE IF EXISTS public.meeting_attendees CASCADE;
DROP TABLE IF EXISTS public.meetings CASCADE;

-- 1. MEETINGS HEADER
CREATE TABLE public.meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  organizer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL NOT NULL,
  location TEXT, -- Room name, Site Office, or Zoom/MS Teams URL
  starts_at TIMESTAMP WITH TIME ZONE NOT NULL,
  ends_at TIMESTAMP WITH TIME ZONE NOT NULL,
  agenda TEXT, -- Markdown allowed
  status TEXT NOT NULL DEFAULT 'SCHEDULED' CHECK (status IN ('SCHEDULED', 'COMPLETED', 'CANCELLED')),
  
  -- Minutes & Action items
  minutes TEXT, -- Markdown notes
  minutes_published_at TIMESTAMP WITH TIME ZONE,
  
  -- Syncing
  google_event_id TEXT,
  recurrence JSONB, -- { freq: 'DAILY'|'WEEKLY', interval: number, until: string }
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for Meetings
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;

-- Visible to all authenticated users (read-only) since they need to check calendar availability
CREATE POLICY "Allow authenticated read to meetings"
  ON public.meetings FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated write to meetings"
  ON public.meetings FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 2. MEETING ATTENDEES (Internal and external)
CREATE TABLE public.meeting_attendees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID REFERENCES public.meetings(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- Null for external clients/consultants
  external_name TEXT, -- Set for external guest
  external_email TEXT, -- Set for external guest
  response TEXT NOT NULL DEFAULT 'PENDING' CHECK (response IN ('PENDING', 'ACCEPTED', 'DECLINED')),
  
  -- Ensure duplicate attendee entries are rejected
  CONSTRAINT unique_attendee UNIQUE (meeting_id, user_id, external_email)
);

-- Enable RLS for Attendees
ALTER TABLE public.meeting_attendees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read to meeting_attendees"
  ON public.meeting_attendees FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated write to meeting_attendees"
  ON public.meeting_attendees FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Indices
CREATE INDEX idx_ma_meeting ON public.meeting_attendees (meeting_id);
CREATE INDEX idx_ma_user ON public.meeting_attendees (user_id);

-- 3. MEETING ACTION ITEMS (Parsed from minutes)
CREATE TABLE public.meeting_action_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID REFERENCES public.meetings(id) ON DELETE CASCADE NOT NULL,
  description TEXT NOT NULL,
  assignee_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  due_date DATE,
  task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL, -- Reference to auto-generated task
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for Action Items
ALTER TABLE public.meeting_action_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read to meeting_action_items"
  ON public.meeting_action_items FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated write to meeting_action_items"
  ON public.meeting_action_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX idx_mai_meeting ON public.meeting_action_items (meeting_id);
CREATE INDEX idx_mai_task ON public.meeting_action_items (task_id);

-- 4. USER INTEGRATIONS (OAuth Refresh Tokens for external sync)
CREATE TABLE public.user_integrations (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('google', 'resend')),
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  PRIMARY KEY (user_id, provider)
);

-- Enable RLS for Integrations
ALTER TABLE public.user_integrations ENABLE ROW LEVEL SECURITY;

-- Encrypted tokens are strictly owned by the user
CREATE POLICY "Allow users to view own integrations"
  ON public.user_integrations FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Allow users to update own integrations"
  ON public.user_integrations FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
