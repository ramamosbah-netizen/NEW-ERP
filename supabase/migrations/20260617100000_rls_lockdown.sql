-- ============================================================
-- Aura ERP — RLS LOCKDOWN + MAKER-CHECKER  (Phase 2 / DB-authority gate)
-- ------------------------------------------------------------
-- Closes the headline risk: until now almost every table was
-- `FOR ALL TO authenticated USING(true)`, i.e. ANY signed-in user could
-- read/write finance, salaries, everything. This migration replaces those
-- blanket policies on the SENSITIVE domains with role-scoped policies, and
-- adds maker-checker (creator <> approver) on the approval-bearing tables.
--
-- DESIGN PRINCIPLES (so this is safe to apply):
--   • Admins ALWAYS pass (is_erp_admin bypass in every write policy) — you
--     cannot lock yourself out.
--   • Reads on financial/operational tables stay open to authenticated
--     (ERP staff need cross-module visibility); only WRITES are scoped.
--   • Payroll/compensation tables are scoped on BOTH read AND write (salaries).
--   • Every table is guarded by to_regclass(): a name that doesn't exist in
--     your DB is silently skipped, never errors.
--   • Idempotent: drops ALL existing policies on each target table (handles the
--     varied legacy policy names) then recreates the scoped set.
--
-- ⚠️  MAKER-CHECKER: once applied, the creator of a PR / budget / petty-cash
--     entry can no longer approve their OWN record. You need at least two
--     users (a maker and a checker). This is the intended behaviour.
--
-- Apply in STAGING first and smoke-test each module. A rollback block is at
-- the very bottom (commented out) to restore open policies if needed.
-- ============================================================

-- ------------------------------------------------------------
-- 1. ROLE HELPER FUNCTIONS  (SECURITY DEFINER, STABLE)
--    Resolve the caller's roles from BOTH the RBAC tables (user_roles→roles)
--    and the legacy profiles.role column, since the app uses both.
-- ------------------------------------------------------------
create or replace function public.auth_role_keys()
returns text[]
language sql
security definer
stable
as $$
  select coalesce(array_agg(distinct rk), '{}')
  from (
    select r.role_key as rk
      from public.user_roles ur
      join public.roles r on r.id = ur.role_id
     where ur.user_id = auth.uid() and r.is_active = true
    union
    select p.role
      from public.profiles p
     where p.id = auth.uid() and p.role is not null
  ) s;
$$;

create or replace function public.has_any_role(variadic keys text[])
returns boolean
language sql
security definer
stable
as $$
  select public.auth_role_keys() && keys;  -- array overlap
$$;

-- Domain predicates (admin always included via is_erp_admin()).
create or replace function public.is_finance()
returns boolean language sql security definer stable as $$
  select public.is_erp_admin()
      or public.has_any_role('gm','account','accountant','finance_manager','commercial_mgr');
$$;

create or replace function public.is_hr()
returns boolean language sql security definer stable as $$
  select public.is_erp_admin()
      or public.has_any_role('gm','hr','hr_manager');
$$;

-- ------------------------------------------------------------
-- 2. FINANCE TABLES — open read, finance-scoped write
-- ------------------------------------------------------------
do $$
declare
  t text;
  pol record;
  finance_tables text[] := array[
    -- AR
    'client_invoices','client_invoice_items','client_payments','payment_allocations',
    'credit_notes','credit_note_items',
    -- AP
    'supplier_invoices','supplier_invoice_items','supplier_payments','supplier_payment_allocations',
    -- tax + numbering sequences
    'vat_periods','client_invoice_sequences','client_payment_sequences','credit_note_sequences',
    'supplier_invoice_sequences','supplier_payment_sequences',
    -- treasury / cash / bank
    'petty_cash','petty_cash_funds','petty_cash_transactions','petty_cash_replenishments',
    'bank_accounts','bank_reconciliations','bank_statement_lines','bank_transactions',
    'treasury_facilities','treasury_drawdowns','treasury_repayments',
    -- budgets, commitments, retention, expenses
    'project_budgets','project_budget_lines','cost_commitments','commitment_ledger',
    'project_retention_ledger','supplier_retention_ledger',
    'expenses','expense_claims','ap_accounts'
  ];
begin
  foreach t in array finance_tables loop
    if to_regclass('public.' || t) is null then
      continue;  -- table not in this DB; skip safely
    end if;

    -- drop every existing policy (names vary across the legacy schemas)
    for pol in
      select policyname from pg_policies where schemaname = 'public' and tablename = t
    loop
      execute format('drop policy %I on public.%I', pol.policyname, t);
    end loop;

    execute format('alter table public.%I enable row level security', t);
    -- open read (OR-combined, so reads stay broad)
    execute format(
      'create policy "%s_sel" on public.%I for select to authenticated using (true)', t, t);
    -- finance-scoped write (insert/update/delete)
    execute format(
      'create policy "%s_mod" on public.%I for all to authenticated using (public.is_finance()) with check (public.is_finance())', t, t);
  end loop;
end $$;

-- ------------------------------------------------------------
-- 3. PAYROLL / COMPENSATION — HR-scoped read AND write (salary data)
-- ------------------------------------------------------------
do $$
declare
  t text;
  pol record;
  hr_tables text[] := array[
    'employee_compensation','employee_salaries','salary_structures',
    'payroll_runs','payroll_items','payroll_lines','payslips',
    'eosb_records','eosb_settlements','gratuity_records',
    'sif_files','sif_records','wps_files',
    'employee_advances','salary_advances'
  ];
begin
  foreach t in array hr_tables loop
    if to_regclass('public.' || t) is null then
      continue;
    end if;

    for pol in
      select policyname from pg_policies where schemaname = 'public' and tablename = t
    loop
      execute format('drop policy %I on public.%I', pol.policyname, t);
    end loop;

    execute format('alter table public.%I enable row level security', t);
    -- restricted read + write: HR / GM / Admin only
    execute format(
      'create policy "%s_all" on public.%I for all to authenticated using (public.is_hr()) with check (public.is_hr())', t, t);
  end loop;
end $$;

-- ------------------------------------------------------------
-- 4. MAKER-CHECKER — creator cannot approve their own record
--    Applies to tables carrying both created_by and approved_by.
-- ------------------------------------------------------------
create or replace function public.enforce_maker_checker()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE'
     and new.approved_by is not null
     and new.approved_by is distinct from old.approved_by   -- this update is the approval
     and new.approved_by = new.created_by then
    raise exception 'maker-checker: the creator cannot approve their own % (created_by = approved_by)', tg_table_name
      using errcode = 'check_violation';
  end if;
  return new;
end $$;

do $$
declare
  t text;
  mc_tables text[] := array['purchase_requests','project_budgets','petty_cash'];
begin
  foreach t in array mc_tables loop
    if to_regclass('public.' || t) is null then
      continue;
    end if;
    execute format('drop trigger if exists trg_maker_checker on public.%I', t);
    execute format(
      'create trigger trg_maker_checker before update on public.%I for each row execute function public.enforce_maker_checker()', t);
  end loop;
end $$;

NOTIFY pgrst, 'reload schema';

-- ============================================================
-- ROLLBACK (uncomment to restore the previous open posture)
-- ------------------------------------------------------------
-- do $$
-- declare t text; pol record;
--   all_tables text[] := array[
--     'client_invoices','client_invoice_items','client_payments','payment_allocations',
--     'credit_notes','credit_note_items','supplier_invoices','supplier_invoice_items',
--     'supplier_payments','supplier_payment_allocations','vat_periods',
--     'client_invoice_sequences','client_payment_sequences','credit_note_sequences',
--     'supplier_invoice_sequences','supplier_payment_sequences','petty_cash',
--     'petty_cash_funds','petty_cash_transactions','petty_cash_replenishments',
--     'bank_accounts','bank_reconciliations','bank_statement_lines','bank_transactions',
--     'treasury_facilities','treasury_drawdowns','treasury_repayments','project_budgets',
--     'project_budget_lines','cost_commitments','commitment_ledger','project_retention_ledger',
--     'supplier_retention_ledger','expenses','expense_claims','ap_accounts',
--     'employee_compensation','employee_salaries','salary_structures','payroll_runs',
--     'payroll_items','payroll_lines','payslips','eosb_records','eosb_settlements',
--     'gratuity_records','sif_files','sif_records','wps_files','employee_advances','salary_advances'
--   ];
-- begin
--   foreach t in array all_tables loop
--     if to_regclass('public.'||t) is null then continue; end if;
--     for pol in select policyname from pg_policies where schemaname='public' and tablename=t loop
--       execute format('drop policy %I on public.%I', pol.policyname, t);
--     end loop;
--     execute format('create policy "%s_open" on public.%I for all to authenticated using (true) with check (true)', t, t);
--   end loop;
--   foreach t in array array['purchase_requests','project_budgets','petty_cash'] loop
--     if to_regclass('public.'||t) is null then continue; end if;
--     execute format('drop trigger if exists trg_maker_checker on public.%I', t);
--   end loop;
-- end $$;
-- NOTIFY pgrst, 'reload schema';
