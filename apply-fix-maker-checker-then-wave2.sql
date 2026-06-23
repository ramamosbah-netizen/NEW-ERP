-- ============================================================================
-- APPLY: fix the maker-checker trigger + complete company_id WAVE 2
-- ----------------------------------------------------------------------------
-- Your multi-company apply stopped at wave 2's backfill with:
--     ERROR 42703: record "new" has no field "created_by"
--     PL/pgSQL function enforce_maker_checker() ... UPDATE purchase_requests ...
--
-- Already committed (no action needed): companies/company_members (foundation)
-- and WAVE 1 — so the quotations.company_id error is ALREADY fixed.
-- WAVE 2 rolled back (its transaction aborted on the trigger). This script
-- fixes the trigger, then re-runs wave 2. Additive + idempotent — safe to run.
--
-- HOW: Supabase Dashboard → SQL Editor → paste ALL → Run.
-- ============================================================================


-- §1 — column-tolerant maker-checker (fixes the 42703; PR approvals work again)
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


-- §2 — company_id WAVE 2 (ADDITIVE, idempotent)
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
DECLARE
  v_default UUID;
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

NOTIFY pgrst, 'reload schema';

-- Verify (optional):
--   select company_id from public.purchase_orders limit 1;   -- column now exists
--   update public.purchase_requests set updated_at = now() where id = (select id from public.purchase_requests limit 1);  -- no longer errors
-- ============================================================================
