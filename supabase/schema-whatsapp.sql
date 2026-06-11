-- ============================================================
-- JEET ERP — WhatsApp Integration Module Schema
-- Tables: settings, chat sessions, message logs, templates registry
-- ============================================================

-- Reset tables safely
DROP TABLE IF EXISTS public.whatsapp_messages CASCADE;
DROP TABLE IF EXISTS public.whatsapp_chats CASCADE;
DROP TABLE IF EXISTS public.whatsapp_templates CASCADE;
DROP TABLE IF EXISTS public.whatsapp_settings CASCADE;

-- 1. WHATSAPP SETTINGS (Single-row configuration)
CREATE TABLE public.whatsapp_settings (
  id BOOLEAN PRIMARY KEY DEFAULT true,
  whatsapp_enabled BOOLEAN NOT NULL DEFAULT false,
  phone_number_id TEXT,
  waba_id TEXT,
  access_token TEXT,
  verify_token TEXT DEFAULT 'jeet_erp_verify_token' NOT NULL,
  gemini_api_key TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT single_row CHECK (id = true)
);

-- Enable RLS for Settings
ALTER TABLE public.whatsapp_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read to whatsapp_settings"
  ON public.whatsapp_settings FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow admin and manager write to whatsapp_settings"
  ON public.whatsapp_settings FOR ALL TO authenticated 
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'manager')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'manager')));

-- Seed settings table
INSERT INTO public.whatsapp_settings (id, whatsapp_enabled, verify_token)
VALUES (true, false, 'jeet_erp_verify_token')
ON CONFLICT (id) DO NOTHING;


-- 2. WHATSAPP CHATS (Conversation Sessions)
CREATE TABLE public.whatsapp_chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number TEXT UNIQUE NOT NULL, -- Format: E.164 (e.g. +971501234567 or 971501234567)
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  contract_id UUID REFERENCES public.amc_contracts(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'AUTO_REPLY' CHECK (status IN ('AUTO_REPLY', 'HUMAN_AGENT', 'CLOSED')),
  assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  last_message_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for Chats
ALTER TABLE public.whatsapp_chats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read/write access to whatsapp_chats"
  ON public.whatsapp_chats FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Indices for fast matching
CREATE INDEX idx_wa_chats_phone ON public.whatsapp_chats (phone_number);
CREATE INDEX idx_wa_chats_status ON public.whatsapp_chats (status);
CREATE INDEX idx_wa_chats_client ON public.whatsapp_chats (client_id);


-- 3. WHATSAPP MESSAGES (Chat history log)
CREATE TABLE public.whatsapp_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID REFERENCES public.whatsapp_chats(id) ON DELETE CASCADE NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('INBOUND', 'OUTBOUND')),
  sender_name TEXT,
  message_body TEXT,
  message_type TEXT NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'document', 'audio', 'video', 'location')),
  media_url TEXT, -- Meta internal URL or public URL
  dms_document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL,
  message_id TEXT UNIQUE, -- Meta Message ID (used for status updates and idempotency)
  status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('queued', 'sent', 'delivered', 'read', 'failed')),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for Messages
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read/write access to whatsapp_messages"
  ON public.whatsapp_messages FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Indices for performance
CREATE INDEX idx_wa_messages_chat ON public.whatsapp_messages (chat_id);
CREATE INDEX idx_wa_messages_message_id ON public.whatsapp_messages (message_id);
CREATE INDEX idx_wa_messages_created ON public.whatsapp_messages (created_at DESC);


-- 4. WHATSAPP TEMPLATES REGISTRY (Outbound mapping config)
CREATE TABLE public.whatsapp_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT UNIQUE NOT NULL, -- e.g., 'ticket.created'
  template_name TEXT NOT NULL, -- Name approved in Meta Business manager
  language_code TEXT DEFAULT 'en' NOT NULL,
  body_template TEXT NOT NULL, -- Local copy for previewing
  variables TEXT[] NOT NULL DEFAULT '{}'::text[], -- Order matching parameters
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for Templates
ALTER TABLE public.whatsapp_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read to whatsapp_templates"
  ON public.whatsapp_templates FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow admin/manager write to whatsapp_templates"
  ON public.whatsapp_templates FOR ALL TO authenticated 
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'manager')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'manager')));

-- Seed WhatsApp Templates
INSERT INTO public.whatsapp_templates (event_type, template_name, language_code, body_template, variables)
VALUES 
  ('ticket.created', 'ticket_confirmation', 'en', 'Dear {{client_name}}, your service ticket {{ticket_number}} has been created successfully. Site: {{site_address}}. Standard SLA times apply.', '{client_name,ticket_number,site_address}'),
  ('ticket.assigned', 'technician_dispatch', 'en', 'Dear {{client_name}}, technician {{tech_name}} (Phone: {{tech_phone}}) has been assigned to ticket {{ticket_number}} and is heading to your site.', '{client_name,tech_name,tech_phone,ticket_number}'),
  ('ppm.visit_scheduled', 'ppm_visit_scheduled', 'en', 'Dear {{client_name}}, a PPM maintenance visit has been scheduled for {{scheduled_date}} under contract {{contract_number}}.', '{client_name,scheduled_date,contract_number}'),
  ('invoice.reminder', 'invoice_reminder', 'en', 'Dear {{client_name}}, this is a friendly reminder that tax invoice {{invoice_number}} of amount {{net_due}} AED remains unpaid. Due date: {{due_date}}.', '{client_name,invoice_number,net_due,due_date}'),
  ('amc.renewal_due', 'amc_renewal_due', 'en', 'Dear {{client_name}}, your AMC contract {{contract_number}} is due for renewal on {{end_date}}. Please review the draft renewal proposal.', '{client_name,contract_number,end_date}')
ON CONFLICT (event_type) DO UPDATE SET
  template_name = EXCLUDED.template_name,
  body_template = EXCLUDED.body_template,
  variables = EXCLUDED.variables;


-- 5. ALTER PROFILES TABLE (Add Phone column)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone TEXT;
