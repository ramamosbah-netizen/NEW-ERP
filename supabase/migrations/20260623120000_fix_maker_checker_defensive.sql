-- ============================================================
-- Fix: make enforce_maker_checker() column-tolerant
-- ------------------------------------------------------------
-- The maker-checker trigger (20260617100000_rls_lockdown.sql) is attached to
-- purchase_requests / project_budgets / petty_cash and read NEW.created_by
-- directly. purchase_requests has NO created_by column (it uses requested_by),
-- so the trigger raised `42703: record "new" has no field "created_by"` on ANY
-- update to that table — breaking PR approvals and any UPDATE (e.g. the
-- multi-company company_id backfill).
--
-- This rewrite reads fields via to_jsonb(NEW/OLD) ->> '...', which returns NULL
-- for an absent column instead of erroring. Enforcement is UNCHANGED for tables
-- that carry both created_by and approved_by. Trigger bindings are untouched.
-- ============================================================

create or replace function public.enforce_maker_checker()
returns trigger
language plpgsql
as $$
declare
  v_created  text := to_jsonb(NEW) ->> 'created_by';
  v_appr_new text := to_jsonb(NEW) ->> 'approved_by';
  v_appr_old text := to_jsonb(OLD) ->> 'approved_by';
begin
  if tg_op = 'UPDATE'
     and v_appr_new is not null
     and v_appr_new is distinct from v_appr_old   -- this update sets/changes the approval
     and v_created is not null                    -- table actually has a created_by
     and v_appr_new = v_created then              -- creator == approver
    raise exception 'maker-checker: the creator cannot approve their own % (created_by = approved_by)', tg_table_name
      using errcode = 'check_violation';
  end if;
  return NEW;
end $$;

NOTIFY pgrst, 'reload schema';
