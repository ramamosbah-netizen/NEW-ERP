-- ============================================================
-- JEET ERP — Budget-availability guard for PO approval (opt-in)
-- ------------------------------------------------------------
-- The app ALREADY detects budget overruns at PO approval
-- (poApprovalService emits `po.budget_exceeded`) — but it only *warns* and
-- proceeds. This adds a DB-level guard that can actually *block* approving a
-- PO that would push a project's committed cost over its budget ceiling.
--
-- SAFE BY DEFAULT — opt-in per project:
--   • new column projects.budget_enforced (default FALSE) → today's behaviour
--     is unchanged; nothing is blocked until a project is explicitly opted in.
--   • does NOT modify any existing service code, and does NOT alter RLS.
--   • fires on INSERT/UPDATE → also catches a direct anon-key bypass that
--     forges an APPROVED PO.
--
-- Ceiling = approved project_budgets (total_budget + contingency), latest
-- revision; falls back to projects.budget_cost. Committed = open/approved POs
-- (excl. this one) + open manual cost_commitments (excl. PO/PAYROLL, which are
-- already represented by live PO/payroll records). Amounts use PO `total`
-- (gross, incl. VAT) to match the existing commitment ledger.
--
-- Idempotent. Apply manually in the Supabase SQL editor; ends with NOTIFY pgrst.
-- ============================================================

-- 0) Opt-in flag --------------------------------------------------------
alter table public.projects
  add column if not exists budget_enforced boolean not null default false;

-- 1) Helpers (reusable by UI too) --------------------------------------
create or replace function public.project_budget_ceiling(p_project uuid)
returns numeric
language sql
stable
as $$
  select coalesce(
    nullif((select pb.total_budget + pb.contingency
              from public.project_budgets pb
             where pb.project_id = p_project and pb.status = 'APPROVED'
             order by pb.revision_no desc
             limit 1), 0),
    (select pr.budget_cost from public.projects pr where pr.id = p_project),
    0
  );
$$;

create or replace function public.project_budget_committed(p_project uuid, p_exclude_po uuid default null)
returns numeric
language sql
stable
as $$
  select coalesce((select sum(po.total)
                     from public.purchase_orders po
                    where po.project_id = p_project
                      and po.status in ('APPROVED','SENT','ACKNOWLEDGED','PARTIALLY_DELIVERED','DELIVERED')
                      and (p_exclude_po is null or po.id <> p_exclude_po)), 0)
       + coalesce((select sum(cc.amount)
                     from public.cost_commitments cc
                    where cc.project_id = p_project
                      and cc.status in ('OPEN','PARTIAL')
                      and cc.source_type not in ('PO','PAYROLL')), 0);
$$;

-- 2) Guard trigger ------------------------------------------------------
create or replace function public.enforce_po_budget()
returns trigger
language plpgsql
as $$
declare
  v_enforced  boolean;
  v_ceiling   numeric(14,2);
  v_committed numeric(14,2);
  v_after     numeric(14,2);
begin
  -- only the transition INTO approved matters
  if new.status <> 'APPROVED' then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.status = 'APPROVED' then
    return new; -- already approved, not a new transition
  end if;
  if new.project_id is null then
    return new; -- overhead PO, no project budget
  end if;

  select coalesce(p.budget_enforced, false) into v_enforced
    from public.projects p where p.id = new.project_id;
  if not coalesce(v_enforced, false) then
    return new; -- enforcement not opted in for this project
  end if;

  v_ceiling := public.project_budget_ceiling(new.project_id);
  if v_ceiling <= 0 then
    return new; -- no budget defined → nothing to enforce
  end if;

  v_committed := public.project_budget_committed(new.project_id, new.id);
  v_after := v_committed + coalesce(new.total, 0);

  if v_after > v_ceiling then
    raise exception
      'PO budget guard: approving % would raise committed cost to % AED, over the project budget ceiling of % AED (available % AED). Raise the budget, reduce the PO, or disable budget_enforced on the project.',
      new.po_number, round(v_after, 2), round(v_ceiling, 2), round(v_ceiling - v_committed, 2)
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_po_budget on public.purchase_orders;
create trigger trg_enforce_po_budget
  before insert or update on public.purchase_orders
  for each row execute function public.enforce_po_budget();

NOTIFY pgrst, 'reload schema';
