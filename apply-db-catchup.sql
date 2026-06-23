-- ============================================================================
-- AURA 0.2 — DB CATCH-UP (consolidated)   ·   audit 2026-06-23
-- ----------------------------------------------------------------------------
-- Audit result: the DB is ~95% in sync. This fixes the SPECIFIC gaps that broke
-- live flows (each was hit while using the app):
--   §1 maker-checker trigger bug — PR updates/approvals failed (42703)
--   §2 company_id WAVE 2 (PO/PR/GRN/invoices/employees) — rolled back earlier
--   §3 event_types FK — emitting quotation.submitted / vo.* etc. was rejected (23503)
--   §4 comparison_scoring_weights — default config row never seeded (406)
--
-- All additive + idempotent (safe to run / re-run). Supersedes the earlier
-- apply-fix-maker-checker-then-wave2.sql + 20260623130000 (both re-included).
-- ORDER MATTERS: §1 fixes the trigger BEFORE §2's backfill so it won't re-trip.
--
-- HOW: Supabase Dashboard → SQL Editor → paste ALL → Run.
--
--   §5 data_driven_rbac (capability RLS) · §6 workflow_override · §7 system_jobs
--      — the 3 migrations the audit found unapplied. Idempotent; they don't affect
--      core flows, but are now BUNDLED so ONE paste fully syncs the DB to the code.
-- ============================================================================


-- §1 — column-tolerant maker-checker (fixes 42703 on purchase_requests updates)
create or replace function public.enforce_maker_checker()
returns trigger language plpgsql as $$
declare
  v_created  text := to_jsonb(NEW) ->> 'created_by';
  v_appr_new text := to_jsonb(NEW) ->> 'approved_by';
  v_appr_old text := to_jsonb(OLD) ->> 'approved_by';
begin
  if tg_op = 'UPDATE'
     and v_appr_new is not null
     and v_appr_new is distinct from v_appr_old
     and v_created is not null
     and v_appr_new = v_created then
    raise exception 'maker-checker: the creator cannot approve their own % (created_by = approved_by)', tg_table_name
      using errcode = 'check_violation';
  end if;
  return NEW;
end $$;


-- §2 — company_id WAVE 2 (additive, idempotent)
ALTER TABLE public.purchase_requests ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id);
ALTER TABLE public.purchase_orders   ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id);
ALTER TABLE public.grns              ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id);
ALTER TABLE public.client_invoices   ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id);
ALTER TABLE public.supplier_invoices ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id);
ALTER TABLE public.employees         ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id);

CREATE INDEX IF NOT EXISTS idx_purchase_requests_company ON public.purchase_requests (company_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_company   ON public.purchase_orders (company_id);
CREATE INDEX IF NOT EXISTS idx_grns_company              ON public.grns (company_id);
CREATE INDEX IF NOT EXISTS idx_client_invoices_company   ON public.client_invoices (company_id);
CREATE INDEX IF NOT EXISTS idx_supplier_invoices_company ON public.supplier_invoices (company_id);
CREATE INDEX IF NOT EXISTS idx_employees_company         ON public.employees (company_id);

DO $$
DECLARE v_default UUID;
BEGIN
  SELECT id INTO v_default FROM public.companies WHERE code = 'JEET-CON' LIMIT 1;
  IF v_default IS NOT NULL THEN
    UPDATE public.purchase_requests SET company_id = v_default WHERE company_id IS NULL;
    UPDATE public.purchase_orders   SET company_id = v_default WHERE company_id IS NULL;
    UPDATE public.grns              SET company_id = v_default WHERE company_id IS NULL;
    UPDATE public.client_invoices   SET company_id = v_default WHERE company_id IS NULL;
    UPDATE public.supplier_invoices SET company_id = v_default WHERE company_id IS NULL;
    UPDATE public.employees         SET company_id = v_default WHERE company_id IS NULL;
  END IF;
END $$;


-- §3 — event_type auto-register (an append-only ledger must never reject a type)
create or replace function public.register_event_type()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.event_types (event_type, module, is_active)
  values (NEW.event_type, nullif(split_part(NEW.event_type, '.', 1), ''), true)
  on conflict (event_type) do nothing;
  return NEW;
end $$;
drop trigger if exists trg_register_event_type on public.system_events;
create trigger trg_register_event_type before insert on public.system_events
  for each row execute function public.register_event_type();


-- §4 — comparison_scoring_weights default row (fixes the 406; weights sum to 100)
INSERT INTO public.comparison_scoring_weights (weight_price, weight_delivery, weight_history, weight_payment, weight_compliance)
VALUES (45.00, 20.00, 20.00, 10.00, 5.00)
ON CONFLICT (id) DO NOTHING;


-- §5 — data-driven RBAC (capability gates; behavior-preserving, idempotent)
insert into public.permissions (permission_key, module, description) values
  ('finance.write', 'FINANCE', 'RLS gate: create/modify finance records (AR/AP/treasury/budgets/retention/expenses).'),
  ('hr.manage',     'HR',      'RLS gate: read & write payroll and employee compensation.')
on conflict (permission_key) do nothing;

insert into public.role_permissions (role_id, permission_id, scope)
select r.id, p.id, 'ALL'
  from public.roles r cross join public.permissions p
 where p.permission_key = 'finance.write'
   and r.role_key in ('admin','gm','account','accountant','finance_manager','commercial_mgr')
on conflict (role_id, permission_id) do nothing;

insert into public.role_permissions (role_id, permission_id, scope)
select r.id, p.id, 'ALL'
  from public.roles r cross join public.permissions p
 where p.permission_key = 'hr.manage'
   and r.role_key in ('admin','gm','hr','hr_manager')
on conflict (role_id, permission_id) do nothing;

create or replace function public.auth_capabilities()
returns text[] language sql security definer stable as $$
  select coalesce(array_agg(distinct p.permission_key), '{}')
    from public.role_permissions rp
    join public.permissions p on p.id = rp.permission_id
    join public.roles r on r.id = rp.role_id and r.is_active = true
   where rp.role_id in (
     select ur.role_id from public.user_roles ur where ur.user_id = auth.uid()
     union
     select r2.id from public.roles r2 join public.profiles pr on pr.id = auth.uid() where pr.role = r2.role_key
   );
$$;

create or replace function public.has_capability(p_key text)
returns boolean language sql security definer stable as $$
  select p_key = any (public.auth_capabilities());
$$;

create or replace function public.is_finance()
returns boolean language sql security definer stable as $$
  select public.is_erp_admin()
      or public.has_capability('finance.write')
      or public.has_any_role('gm','account','accountant','finance_manager','commercial_mgr');
$$;

create or replace function public.is_hr()
returns boolean language sql security definer stable as $$
  select public.is_erp_admin()
      or public.has_capability('hr.manage')
      or public.has_any_role('gm','hr','hr_manager');
$$;


-- §6 — workflow admin override (break-glass RPC; capability-gated, idempotent)
insert into public.permissions (permission_key, module, description) values
  ('workflow.override', 'SYSTEM', 'Break-glass: reassign/force/cancel/restart a workflow instance (bypasses approvals).')
on conflict (permission_key) do nothing;

insert into public.role_permissions (role_id, permission_id, scope)
select r.id, p.id, 'ALL'
  from public.roles r cross join public.permissions p
 where p.permission_key = 'workflow.override' and r.role_key = 'admin'
on conflict (role_id, permission_id) do nothing;

create or replace function public.admin_workflow_override(
  p_instance_id uuid, p_action text, p_reason text,
  p_to_status text default null, p_old_value text default null, p_new_approver jsonb default null
) returns public.workflow_instances language plpgsql security definer as $$
declare
  v_inst public.workflow_instances; v_uid uuid := auth.uid(); v_name text; v_entry jsonb; v_pending jsonb;
begin
  if not (
    public.is_erp_admin() or exists (
      select 1 from public.role_permissions rp join public.permissions p on p.id = rp.permission_id
       where p.permission_key = 'workflow.override'
         and rp.role_id in (
           select ur.role_id from public.user_roles ur where ur.user_id = v_uid
           union
           select r.id from public.roles r join public.profiles pr on pr.id = v_uid where pr.role = r.role_key
         )
    )
  ) then
    raise exception 'workflow override requires the workflow.override capability' using errcode = '42501';
  end if;
  if p_reason is null or length(btrim(p_reason)) < 3 then
    raise exception 'an override reason is required';
  end if;
  select * into v_inst from public.workflow_instances where id = p_instance_id for update;
  if not found then raise exception 'workflow instance % not found', p_instance_id; end if;
  select full_name into v_name from public.profiles where id = v_uid;
  v_entry := jsonb_build_object(
    'at', to_jsonb(now()), 'by', to_jsonb(v_uid), 'by_name', to_jsonb(coalesce(v_name, 'Admin')),
    'action', 'OVERRIDE_' || p_action,
    'from', to_jsonb(v_inst.current_status_key),
    'to', to_jsonb(coalesce(p_to_status, v_inst.current_status_key)),
    'comment', to_jsonb(p_reason)
  );
  if p_action in ('FORCE_STATUS', 'CANCEL', 'RESTART') then
    update public.workflow_instances
       set current_status_key = coalesce(p_to_status, current_status_key),
           pending_approvals = '[]'::jsonb,
           history = coalesce(history, '[]'::jsonb) || v_entry,
           sla_due_at = null, updated_at = now()
     where id = p_instance_id returning * into v_inst;
  elsif p_action = 'REASSIGN' then
    select jsonb_agg(
             case when elem->>'value' = p_old_value and p_new_approver is not null
                  then elem || jsonb_build_object('type', p_new_approver->'type', 'value', p_new_approver->'value', 'approved_by', 'null'::jsonb, 'approved_at', 'null'::jsonb)
                  else elem end)
      into v_pending
      from jsonb_array_elements(coalesce(v_inst.pending_approvals, '[]'::jsonb)) elem;
    update public.workflow_instances
       set pending_approvals = coalesce(v_pending, pending_approvals),
           history = coalesce(history, '[]'::jsonb) || v_entry, updated_at = now()
     where id = p_instance_id returning * into v_inst;
  else
    raise exception 'unknown override action: %', p_action;
  end if;
  return v_inst;
end $$;


-- §7 — system_jobs (scheduled-job run registry; admin System-Health console)
CREATE TABLE IF NOT EXISTS public.system_jobs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name        TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'RUNNING' CHECK (status IN ('RUNNING', 'SUCCESS', 'FAILED')),
  started_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
  finished_at     TIMESTAMP WITH TIME ZONE,
  duration_ms     INTEGER,
  items_processed INTEGER,
  error           TEXT,
  details         JSONB,
  created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now())
);
CREATE INDEX IF NOT EXISTS idx_system_jobs_name_started ON public.system_jobs (job_name, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_jobs_started      ON public.system_jobs (started_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_jobs_status       ON public.system_jobs (status);
ALTER TABLE public.system_jobs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "system_jobs read" ON public.system_jobs;
CREATE POLICY "system_jobs read" ON public.system_jobs FOR SELECT TO authenticated USING (true);
CREATE OR REPLACE FUNCTION public.prune_system_jobs(p_days INTEGER DEFAULT 90)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_deleted INTEGER;
BEGIN
  DELETE FROM public.system_jobs
   WHERE started_at < timezone('utc'::text, now()) - (p_days || ' days')::interval;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END; $$;


NOTIFY pgrst, 'reload schema';

-- Verify (optional):
--   select company_id from public.purchase_orders limit 1;          -- exists
--   select * from public.comparison_scoring_weights;                 -- 1 row, sums to 100
--   update public.purchase_requests set updated_at = now()           -- no longer 42703
--     where id = (select id from public.purchase_requests limit 1);
-- ============================================================================
