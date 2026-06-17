-- ============================================================
-- Aura ERP — GENERAL LEDGER core (Phase 3 / posted double-entry)
-- ------------------------------------------------------------
-- Today P&L / Trial Balance / Balance Sheet are DERIVED on the fly from the
-- AR/AP sub-ledgers (financialReportsService). This adds a real, posted,
-- immutable double-entry ledger so statements can tie out to a frozen book
-- and periods can be closed.
--
-- This migration is ADDITIVE — it creates new tables/functions only and does
-- not alter existing modules, so it is safe to apply on its own. The NEXT
-- sub-phase wires auto-posting from AR/AP/inventory events into here.
--
-- Integrity enforced in the DB (not just the app):
--   • a journal entry can only be POSTED when its lines balance (Σdebit = Σcredit > 0)
--   • entries can only post into an OPEN period
--   • once POSTED, the entry and its lines are immutable (reverse, don't edit)
--   • each line is either a debit or a credit, never both, never negative
-- Idempotent. RLS: open read, finance-scoped write (see is_finance()).
-- ============================================================

-- ------------------------------------------------------------
-- 0. ROLE HELPERS (self-contained)
--    Normally created by 20260617100000_rls_lockdown.sql, but defined here too
--    (idempotent create-or-replace) so this migration applies in any order /
--    on its own. Depends only on is_erp_admin() (admin_platform_engine) and the
--    roles / user_roles / profiles tables, which already exist.
-- ------------------------------------------------------------
create or replace function public.auth_role_keys()
returns text[] language sql security definer stable as $$
  select coalesce(array_agg(distinct rk), '{}')
  from (
    select r.role_key as rk
      from public.user_roles ur
      join public.roles r on r.id = ur.role_id
     where ur.user_id = auth.uid() and r.is_active = true
    union
    select p.role from public.profiles p where p.id = auth.uid() and p.role is not null
  ) s;
$$;

create or replace function public.has_any_role(variadic keys text[])
returns boolean language sql security definer stable as $$
  select public.auth_role_keys() && keys;
$$;

create or replace function public.is_finance()
returns boolean language sql security definer stable as $$
  select public.is_erp_admin()
      or public.has_any_role('gm','account','accountant','finance_manager','commercial_mgr');
$$;

-- ------------------------------------------------------------
-- 1. CHART OF ACCOUNTS
--    `type` aligns with financialReportsService.classify() (leading digit).
-- ------------------------------------------------------------
create table if not exists public.gl_accounts (
  code        text primary key,
  name        text not null,
  type        text not null check (type in ('ASSET','LIABILITY','EQUITY','REVENUE','EXPENSE')),
  normal_side text not null check (normal_side in ('DEBIT','CREDIT')),
  parent_code text references public.gl_accounts(code),
  is_postable boolean not null default true,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 2. ACCOUNTING PERIODS
-- ------------------------------------------------------------
create table if not exists public.accounting_periods (
  code       text primary key,                 -- 'YYYY-MM'
  name       text not null,
  start_date date not null,
  end_date   date not null,
  status     text not null default 'OPEN' check (status in ('OPEN','CLOSED','LOCKED')),
  closed_by  uuid references auth.users(id),
  closed_at  timestamptz,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 3. JOURNAL ENTRIES + LINES
-- ------------------------------------------------------------
create table if not exists public.journal_entries (
  id            uuid primary key default gen_random_uuid(),
  entry_no      text unique,
  entry_date    date not null default current_date,
  period_code   text not null references public.accounting_periods(code),
  memo          text,
  source_module text,                           -- 'AR','AP','INVENTORY','PAYROLL','MANUAL', ...
  source_id     uuid,                           -- originating record (invoice/payment/...)
  status        text not null default 'DRAFT' check (status in ('DRAFT','POSTED','VOID')),
  reverses_id   uuid references public.journal_entries(id),
  created_by    uuid references auth.users(id),
  posted_by     uuid references auth.users(id),
  posted_at     timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists public.journal_lines (
  id          uuid primary key default gen_random_uuid(),
  entry_id    uuid not null references public.journal_entries(id) on delete cascade,
  line_no     integer not null default 1,
  account_code text not null references public.gl_accounts(code),
  description text,
  debit       numeric(14,2) not null default 0 check (debit  >= 0),
  credit      numeric(14,2) not null default 0 check (credit >= 0),
  project_id  uuid,
  cost_center text,
  -- a line is a debit XOR a credit (never both, never empty)
  constraint journal_line_one_sided check (
    (debit > 0 and credit = 0) or (credit > 0 and debit = 0)
  )
);

create index if not exists journal_entries_period on public.journal_entries (period_code);
create index if not exists journal_entries_source on public.journal_entries (source_module, source_id);
create index if not exists journal_lines_entry   on public.journal_lines (entry_id);
create index if not exists journal_lines_account on public.journal_lines (account_code);

-- ------------------------------------------------------------
-- 4. INTEGRITY: immutability of posted entries/lines
-- ------------------------------------------------------------
create or replace function public.gl_block_posted_entry_change()
returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    if old.status = 'POSTED' then
      raise exception 'GL: posted journal entries cannot be deleted (reverse it instead)'
        using errcode = 'check_violation';
    end if;
    return old;
  end if;
  -- UPDATE: once POSTED, only status -> VOID is allowed, nothing else.
  if old.status = 'POSTED' then
    if new.status = old.status
       or new.entry_date is distinct from old.entry_date
       or new.period_code is distinct from old.period_code
       or new.memo is distinct from old.memo
       or new.source_module is distinct from old.source_module
       or new.source_id is distinct from old.source_id then
      raise exception 'GL: a posted journal entry is immutable (reverse it instead)'
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_gl_entry_immutable on public.journal_entries;
create trigger trg_gl_entry_immutable
  before update or delete on public.journal_entries
  for each row execute function public.gl_block_posted_entry_change();

create or replace function public.gl_block_posted_line_change()
returns trigger language plpgsql as $$
declare st text;
begin
  select status into st from public.journal_entries
   where id = coalesce(new.entry_id, old.entry_id);
  if st = 'POSTED' then
    raise exception 'GL: lines of a posted journal entry are immutable'
      using errcode = 'check_violation';
  end if;
  return coalesce(new, old);
end $$;

drop trigger if exists trg_gl_line_immutable on public.journal_lines;
create trigger trg_gl_line_immutable
  before insert or update or delete on public.journal_lines
  for each row execute function public.gl_block_posted_line_change();

-- ------------------------------------------------------------
-- 5. POST / REVERSE  (the only sanctioned way to commit a balanced entry)
-- ------------------------------------------------------------
create or replace function public.post_journal_entry(p_entry_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_status text;
  v_period text;
  v_period_status text;
  v_debit numeric(14,2);
  v_credit numeric(14,2);
begin
  select status, period_code into v_status, v_period
    from public.journal_entries where id = p_entry_id for update;
  if not found then raise exception 'GL: entry % not found', p_entry_id; end if;
  if v_status <> 'DRAFT' then raise exception 'GL: only DRAFT entries can be posted (was %)', v_status; end if;

  select status into v_period_status from public.accounting_periods where code = v_period;
  if v_period_status is null then raise exception 'GL: period % does not exist', v_period; end if;
  if v_period_status <> 'OPEN' then raise exception 'GL: period % is % (not OPEN)', v_period, v_period_status; end if;

  select coalesce(sum(debit),0), coalesce(sum(credit),0)
    into v_debit, v_credit from public.journal_lines where entry_id = p_entry_id;

  if v_debit = 0 then raise exception 'GL: cannot post an empty entry'; end if;
  if v_debit <> v_credit then
    raise exception 'GL: entry is unbalanced (debit % <> credit %)', v_debit, v_credit
      using errcode = 'check_violation';
  end if;

  update public.journal_entries
     set status = 'POSTED', posted_by = auth.uid(), posted_at = now(), updated_at = now()
   where id = p_entry_id;
end $$;

-- Reverse a posted entry by creating a mirror DRAFT entry (then post it).
create or replace function public.reverse_journal_entry(p_entry_id uuid, p_period text default null)
returns uuid
language plpgsql
security definer
as $$
declare
  v_new uuid;
  v_period text;
begin
  if (select status from public.journal_entries where id = p_entry_id) <> 'POSTED' then
    raise exception 'GL: only POSTED entries can be reversed';
  end if;
  v_period := coalesce(p_period, to_char(current_date, 'YYYY-MM'));

  insert into public.journal_entries (entry_date, period_code, memo, source_module, source_id, reverses_id, created_by)
  select current_date, v_period, 'Reversal of ' || coalesce(entry_no, id::text), source_module, source_id, id, auth.uid()
    from public.journal_entries where id = p_entry_id
  returning id into v_new;

  insert into public.journal_lines (entry_id, line_no, account_code, description, debit, credit, project_id, cost_center)
  select v_new, line_no, account_code, description, credit, debit, project_id, cost_center  -- swap debit/credit
    from public.journal_lines where entry_id = p_entry_id;

  return v_new;
end $$;

-- ------------------------------------------------------------
-- 6. RLS — open read, finance-scoped write (relies on is_finance())
-- ------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['gl_accounts','accounting_periods','journal_entries','journal_lines'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "%s_sel" on public.%I', t, t);
    execute format('create policy "%s_sel" on public.%I for select to authenticated using (true)', t, t);
    execute format('drop policy if exists "%s_mod" on public.%I', t, t);
    execute format('create policy "%s_mod" on public.%I for all to authenticated using (public.is_finance()) with check (public.is_finance())', t, t);
  end loop;
end $$;

-- ------------------------------------------------------------
-- 7. SEED: UAE contractor chart of accounts (leading digit = type)
-- ------------------------------------------------------------
insert into public.gl_accounts (code, name, type, normal_side, is_postable) values
  ('1000','Assets','ASSET','DEBIT',false),
  ('1100','Cash on Hand','ASSET','DEBIT',true),
  ('1110','Bank Accounts','ASSET','DEBIT',true),
  ('1200','Accounts Receivable','ASSET','DEBIT',true),
  ('1210','Retention Receivable','ASSET','DEBIT',true),
  ('1250','VAT Receivable (Input)','ASSET','DEBIT',true),
  ('1300','Inventory','ASSET','DEBIT',true),
  ('1400','Work In Progress','ASSET','DEBIT',true),
  ('1500','Fixed Assets','ASSET','DEBIT',true),
  ('1510','Accumulated Depreciation','ASSET','CREDIT',true),
  ('2000','Liabilities','LIABILITY','CREDIT',false),
  ('2100','Accounts Payable','LIABILITY','CREDIT',true),
  ('2110','Retention Payable','LIABILITY','CREDIT',true),
  ('2200','VAT Payable (Output)','LIABILITY','CREDIT',true),
  ('2300','Accruals','LIABILITY','CREDIT',true),
  ('2400','Loans & Facilities','LIABILITY','CREDIT',true),
  ('3000','Equity','EQUITY','CREDIT',false),
  ('3100','Share Capital','EQUITY','CREDIT',true),
  ('3200','Retained Earnings','EQUITY','CREDIT',true),
  ('4000','Revenue','REVENUE','CREDIT',false),
  ('4100','Contract Revenue','REVENUE','CREDIT',true),
  ('4200','AMC Revenue','REVENUE','CREDIT',true),
  ('4300','Service Revenue','REVENUE','CREDIT',true),
  ('5000','Cost of Sales','EXPENSE','DEBIT',false),
  ('5100','Materials','EXPENSE','DEBIT',true),
  ('5200','Subcontractor Costs','EXPENSE','DEBIT',true),
  ('5300','Direct Labour','EXPENSE','DEBIT',true),
  ('5400','Equipment & Plant','EXPENSE','DEBIT',true),
  ('6000','Operating Expenses','EXPENSE','DEBIT',false),
  ('6100','Salaries & Wages','EXPENSE','DEBIT',true),
  ('6200','Rent','EXPENSE','DEBIT',true),
  ('6300','Utilities','EXPENSE','DEBIT',true),
  ('6400','Depreciation Expense','EXPENSE','DEBIT',true),
  ('6900','Other Expenses','EXPENSE','DEBIT',true)
on conflict (code) do nothing;

-- Seed the current + next month as OPEN periods so posting can start.
insert into public.accounting_periods (code, name, start_date, end_date, status)
select to_char(d, 'YYYY-MM'),
       to_char(d, 'Mon YYYY'),
       date_trunc('month', d)::date,
       (date_trunc('month', d) + interval '1 month - 1 day')::date,
       'OPEN'
from generate_series(date_trunc('month', current_date),
                     date_trunc('month', current_date) + interval '1 month',
                     interval '1 month') d
on conflict (code) do nothing;

NOTIFY pgrst, 'reload schema';
