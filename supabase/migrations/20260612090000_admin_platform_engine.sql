-- ============================================================
-- JEET ERP — Admin Platform Engine
-- Workflow engine, business rules, numbering, forms, templates,
-- notification rules. All configurable from the Admin Center
-- with zero code changes in consuming modules.
-- ============================================================

-- ------------------------------------------------------------
-- 1. WORKFLOW DEFINITIONS
-- ------------------------------------------------------------
create table if not exists public.workflow_definitions (
  id uuid primary key default gen_random_uuid(),
  module_key text not null,                -- e.g. 'PO', 'MAR', 'INVOICE', 'LEAVE_REQUEST', custom keys allowed
  name text not null,
  description text,
  is_active boolean not null default false, -- only one active workflow per module_key (enforced below)
  version integer not null default 1,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists workflow_definitions_active_module
  on public.workflow_definitions (module_key) where (is_active = true);

-- ------------------------------------------------------------
-- 2. WORKFLOW STATUSES
-- ------------------------------------------------------------
create table if not exists public.workflow_statuses (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null references public.workflow_definitions(id) on delete cascade,
  status_key text not null,                -- e.g. 'DRAFT', 'UNDER_REVIEW', custom keys
  label text not null,
  color text not null default 'neutral',   -- neutral | info | success | warning | danger
  is_initial boolean not null default false,
  is_terminal boolean not null default false,
  sort_order integer not null default 0,
  unique (workflow_id, status_key)
);

-- ------------------------------------------------------------
-- 3. WORKFLOW TRANSITIONS
-- approval jsonb shape:
--   { "mode": "NONE"|"SINGLE"|"SEQUENTIAL"|"PARALLEL",
--     "approvers": [{ "type": "ROLE"|"USER"|"DEPARTMENT", "value": "<key/id>" }],
--     "min_approvals": 1 }
-- notifications jsonb shape:
--   [{ "event": "ON_EXECUTE", "channels": ["IN_APP","EMAIL"], "recipients": [{"type":"ROLE","value":"gm"}], "template": "..." }]
-- conditions jsonb shape (all must pass):
--   [{ "field": "total", "operator": ">", "value": 100000 }]
-- escalation jsonb shape:
--   { "after_hours": 24, "to": { "type": "ROLE", "value": "gm" }, "channels": ["IN_APP"] }
-- ------------------------------------------------------------
create table if not exists public.workflow_transitions (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null references public.workflow_definitions(id) on delete cascade,
  from_status_id uuid not null references public.workflow_statuses(id) on delete cascade,
  to_status_id uuid not null references public.workflow_statuses(id) on delete cascade,
  action_key text not null,                -- e.g. 'SUBMIT', 'APPROVE', 'REJECT', 'RETURN', custom
  label text not null,
  allowed_roles text[] not null default '{}',   -- role_keys allowed to execute; empty = everyone
  approval jsonb not null default '{"mode":"NONE","approvers":[],"min_approvals":1}'::jsonb,
  notifications jsonb not null default '[]'::jsonb,
  conditions jsonb not null default '[]'::jsonb,
  sla_hours integer,
  escalation jsonb,
  sort_order integer not null default 0
);

-- ------------------------------------------------------------
-- 4. WORKFLOW INSTANCES (runtime tracking per record)
-- history entry shape:
--   { "at": iso, "by": uuid, "by_name": text, "action": text,
--     "from": status_key, "to": status_key, "comment": text }
-- ------------------------------------------------------------
create table if not exists public.workflow_instances (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null references public.workflow_definitions(id) on delete cascade,
  entity_type text not null,               -- module_key of the record
  entity_id uuid not null,
  current_status_key text not null,
  history jsonb not null default '[]'::jsonb,
  pending_approvals jsonb not null default '[]'::jsonb, -- [{"type":"ROLE","value":"gm","approved_by":null}]
  sla_due_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (entity_type, entity_id)
);

create index if not exists workflow_instances_entity on public.workflow_instances (entity_type, entity_id);
create index if not exists workflow_instances_status on public.workflow_instances (entity_type, current_status_key);

-- ------------------------------------------------------------
-- 5. BUSINESS RULES
-- conditions: [{ "field": "total", "operator": ">", "value": 100000, "join": "AND" }]
-- actions:    [{ "type": "REQUIRE_APPROVAL"|"NOTIFY"|"ESCALATE"|"BLOCK"|"SET_FIELD",
--                "params": { ... } }]
-- ------------------------------------------------------------
create table if not exists public.business_rules (
  id uuid primary key default gen_random_uuid(),
  module_key text not null,
  name text not null,
  description text,
  trigger_event text not null default 'ON_SUBMIT',  -- ON_CREATE | ON_SUBMIT | ON_APPROVE | ON_REJECT | ON_CLOSE | ON_UPDATE
  conditions jsonb not null default '[]'::jsonb,
  actions jsonb not null default '[]'::jsonb,
  priority integer not null default 100,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists business_rules_module on public.business_rules (module_key, trigger_event) where (is_active = true);

-- ------------------------------------------------------------
-- 6. NUMBERING RULES + atomic generator
-- format preview example: JI-PO-2026-0001
-- ------------------------------------------------------------
create table if not exists public.numbering_rules (
  id uuid primary key default gen_random_uuid(),
  module_key text not null unique,         -- 'PO','GRN','INV','QTN','TND','PRJ','VO','MAR','MIR','PR','RFQ', custom
  prefix text not null default '',
  separator text not null default '-',
  include_year boolean not null default true,
  include_month boolean not null default false,
  padding integer not null default 4,
  next_sequence bigint not null default 1,
  reset_period text not null default 'YEARLY',  -- NEVER | YEARLY | MONTHLY
  period_marker text,                      -- internal: tracks which period last increment happened in
  is_active boolean not null default true,
  updated_at timestamptz not null default now()
);

-- Atomic, race-safe number generation
create or replace function public.generate_document_number(p_module_key text)
returns text
language plpgsql
security definer
as $$
declare
  r public.numbering_rules%rowtype;
  v_marker text;
  v_seq bigint;
  v_parts text[];
  v_result text;
begin
  select * into r from public.numbering_rules
   where module_key = p_module_key and is_active = true
   for update;

  if not found then
    -- No rule configured: fall back to module-key + timestamp
    return p_module_key || '-' || to_char(now(), 'YYYYMMDDHH24MISS');
  end if;

  -- Determine the current period marker
  v_marker := case r.reset_period
    when 'YEARLY'  then to_char(now(), 'YYYY')
    when 'MONTHLY' then to_char(now(), 'YYYY-MM')
    else 'STATIC'
  end;

  -- Reset sequence when the period rolls over
  if r.period_marker is distinct from v_marker then
    v_seq := 1;
  else
    v_seq := r.next_sequence;
  end if;

  update public.numbering_rules
     set next_sequence = v_seq + 1,
         period_marker = v_marker,
         updated_at = now()
   where id = r.id;

  v_parts := array[]::text[];
  if r.prefix <> '' then v_parts := v_parts || r.prefix; end if;
  if r.include_year then v_parts := v_parts || to_char(now(), 'YYYY'); end if;
  if r.include_month then v_parts := v_parts || to_char(now(), 'MM'); end if;
  v_parts := v_parts || lpad(v_seq::text, greatest(r.padding, 1), '0');

  v_result := array_to_string(v_parts, r.separator);
  return v_result;
end;
$$;

-- ------------------------------------------------------------
-- 7. FORM DEFINITIONS
-- schema jsonb shape:
-- { "tabs": [{ "id", "label", "sections": [{ "id", "label", "columns": 2,
--     "fields": [{ "id","key","label","type","required","hidden","readonly",
--                  "placeholder","default_value","options":[{"value","label"}],
--                  "validation": {"min","max","pattern","message"},
--                  "conditional": {"field","operator","value"} }] }] }] }
-- ------------------------------------------------------------
create table if not exists public.form_definitions (
  id uuid primary key default gen_random_uuid(),
  module_key text not null,
  name text not null,
  description text,
  schema jsonb not null default '{"tabs":[]}'::jsonb,
  version integer not null default 1,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists form_definitions_active_module
  on public.form_definitions (module_key) where (is_active = true);

-- ------------------------------------------------------------
-- 8. DOCUMENT TEMPLATES
-- content jsonb shape:
-- { "header": { "show_logo": true, "title": "", "subtitle": "", "show_qr": false },
--   "body_html": "<h1>{{DocumentNo}}</h1> ...",
--   "footer": { "text": "", "show_page_numbers": true },
--   "watermark": { "text": "", "enabled": false },
--   "signature_blocks": [{ "label": "Prepared By" }, { "label": "Approved By" }],
--   "variables": ["ProjectName","ClientName","DocumentNo","Date","PreparedBy"] }
-- ------------------------------------------------------------
create table if not exists public.document_templates (
  id uuid primary key default gen_random_uuid(),
  template_key text not null unique,       -- 'MAR','MIR','LPO','RFQ','QTN','INV','DELIVERY_NOTE','HANDOVER', custom
  name text not null,
  module_key text,
  description text,
  content jsonb not null default '{}'::jsonb,
  paper_size text not null default 'A4',
  orientation text not null default 'portrait',
  version integer not null default 1,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 9. NOTIFICATION RULES
-- recipients jsonb: [{"type":"ROLE"|"USER"|"DEPARTMENT"|"CREATOR"|"ASSIGNEE","value":"..."}]
-- ------------------------------------------------------------
create table if not exists public.notification_rules (
  id uuid primary key default gen_random_uuid(),
  module_key text not null,
  event_key text not null,                 -- ON_CREATE | ON_SUBMIT | ON_APPROVE | ON_REJECT | ON_RETURN | ON_CLOSE | ON_ESCALATE | ON_OVERDUE
  name text not null,
  channels text[] not null default '{IN_APP}',  -- IN_APP | EMAIL | SMS | WHATSAPP
  recipients jsonb not null default '[]'::jsonb,
  subject_template text,
  body_template text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists notification_rules_module on public.notification_rules (module_key, event_key) where (is_active = true);

-- ------------------------------------------------------------
-- RLS: read for all authenticated users (modules consume configs),
-- write restricted to active admins.
-- ------------------------------------------------------------
create or replace function public.is_erp_admin()
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1
      from public.user_roles ur
      join public.roles r on r.id = ur.role_id
     where ur.user_id = auth.uid()
       and r.role_key = 'admin'
       and r.is_active = true
  ) or exists (
    select 1 from public.profiles p
     where p.id = auth.uid() and p.role = 'admin'
  );
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'workflow_definitions','workflow_statuses','workflow_transitions',
    'business_rules','numbering_rules','form_definitions',
    'document_templates','notification_rules'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "%s_read" on public.%I', t, t);
    execute format('create policy "%s_read" on public.%I for select to authenticated using (true)', t, t);
    execute format('drop policy if exists "%s_admin_write" on public.%I', t, t);
    execute format('create policy "%s_admin_write" on public.%I for all to authenticated using (public.is_erp_admin()) with check (public.is_erp_admin())', t, t);
  end loop;
end $$;

-- workflow_instances: any authenticated user can read/write instances (runtime data
-- driven by application logic; entity-level security lives on the entity tables)
alter table public.workflow_instances enable row level security;
drop policy if exists "workflow_instances_rw" on public.workflow_instances;
create policy "workflow_instances_rw" on public.workflow_instances
  for all to authenticated using (true) with check (true);

-- ------------------------------------------------------------
-- SEED: default numbering rules
-- ------------------------------------------------------------
insert into public.numbering_rules (module_key, prefix, include_year, padding, reset_period) values
  ('PO',   'JI-PO',  true, 3, 'YEARLY'),
  ('GRN',  'JI-GRN', true, 3, 'YEARLY'),
  ('INV',  'JI-INV', true, 4, 'YEARLY'),
  ('QTN',  'JI-QTN', true, 4, 'YEARLY'),
  ('TND',  'TND',    true, 4, 'YEARLY'),
  ('PRJ',  'PRJ',    true, 3, 'YEARLY'),
  ('VO',   'VO',     true, 3, 'YEARLY'),
  ('MAR',  'MAR',    true, 4, 'YEARLY'),
  ('MIR',  'MIR',    true, 4, 'YEARLY'),
  ('PR',   'PR',     true, 4, 'YEARLY'),
  ('RFQ',  'RFQ',    true, 4, 'YEARLY'),
  ('NCR',  'NCR',    true, 4, 'YEARLY'),
  ('PTW',  'PTW',    true, 4, 'YEARLY'),
  ('EXP',  'EXP',    true, 4, 'MONTHLY')
on conflict (module_key) do nothing;

-- ------------------------------------------------------------
-- SEED: default Purchase Order approval workflow (example)
-- ------------------------------------------------------------
do $$
declare
  wf_id uuid;
  s_draft uuid; s_pending uuid; s_approved uuid; s_rejected uuid; s_closed uuid;
begin
  if exists (select 1 from public.workflow_definitions where module_key = 'PO') then
    return;
  end if;

  insert into public.workflow_definitions (module_key, name, description, is_active)
  values ('PO', 'Purchase Order Approval', 'Default LPO approval flow: Draft → Pending Approval → Approved/Rejected → Closed', true)
  returning id into wf_id;

  insert into public.workflow_statuses (workflow_id, status_key, label, color, is_initial, sort_order)
  values (wf_id, 'DRAFT', 'Draft', 'neutral', true, 0) returning id into s_draft;
  insert into public.workflow_statuses (workflow_id, status_key, label, color, sort_order)
  values (wf_id, 'PENDING_APPROVAL', 'Pending Approval', 'warning', 1) returning id into s_pending;
  insert into public.workflow_statuses (workflow_id, status_key, label, color, sort_order)
  values (wf_id, 'APPROVED', 'Approved', 'success', 2) returning id into s_approved;
  insert into public.workflow_statuses (workflow_id, status_key, label, color, sort_order)
  values (wf_id, 'REJECTED', 'Rejected', 'danger', 3) returning id into s_rejected;
  insert into public.workflow_statuses (workflow_id, status_key, label, color, is_terminal, sort_order)
  values (wf_id, 'CLOSED', 'Closed', 'neutral', true, 4) returning id into s_closed;

  insert into public.workflow_transitions (workflow_id, from_status_id, to_status_id, action_key, label, allowed_roles, approval, sla_hours, sort_order) values
    (wf_id, s_draft, s_pending, 'SUBMIT', 'Submit for Approval', '{}', '{"mode":"NONE","approvers":[],"min_approvals":1}', null, 0),
    (wf_id, s_pending, s_approved, 'APPROVE', 'Approve', '{admin,gm,manager}', '{"mode":"SINGLE","approvers":[{"type":"ROLE","value":"gm"}],"min_approvals":1}', 48, 1),
    (wf_id, s_pending, s_rejected, 'REJECT', 'Reject', '{admin,gm,manager}', '{"mode":"NONE","approvers":[],"min_approvals":1}', null, 2),
    (wf_id, s_rejected, s_draft, 'RETURN', 'Return to Draft', '{}', '{"mode":"NONE","approvers":[],"min_approvals":1}', null, 3),
    (wf_id, s_approved, s_closed, 'CLOSE', 'Close', '{admin,gm,manager,account}', '{"mode":"NONE","approvers":[],"min_approvals":1}', null, 4);
end $$;
