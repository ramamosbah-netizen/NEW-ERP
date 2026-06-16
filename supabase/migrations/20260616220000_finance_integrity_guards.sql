-- ============================================================
-- JEET ERP — Finance integrity guards (defensive DB triggers)
-- ------------------------------------------------------------
-- The most fraud-sensitive tables (client_invoices, the retention ledgers)
-- are currently protected only in the app/workflow layer. RLS is collaborative
-- (`using(true)`), so a direct anon-key write could insert a PAID invoice or
-- release retention with no approval. These BEFORE triggers fire on ANY write
-- — including a bypass of the app — and enforce the financial INVARIANTS the
-- app already satisfies. Legitimate app flows (createInvoiceDraft, approve,
-- markAsSent, recordPayment, writeOff, releaseRetention) are unaffected.
--
-- SCOPE (deliberate): integrity only, not authorization.
--   ✓ status machine sanity (no inserting a pre-approved/pre-paid invoice)
--   ✓ money-status backing (PAID/PARTIALLY_PAID require recorded payment)
--   ✓ immutability of contract-math fields once an invoice is posted
--   ✓ amount_paid is monotonic (no silent un-recording of a receipt)
--   ✓ retention release cannot exceed retention held (client + supplier)
--
-- DEFERRED to the pre-launch DB-authority gate (would break the current
-- single-admin flow, where one person both creates and approves):
--   • role-based RLS lockdown / RPC-only writes
--   • maker–checker / self-approval prevention (created_by <> approver)
--
-- Idempotent. Apply manually in the Supabase SQL editor. Does NOT alter RLS.
-- ============================================================

-- 1) CLIENT INVOICES ----------------------------------------------------
create or replace function public.enforce_client_invoice_integrity()
returns trigger
language plpgsql
as $$
declare
  posted_statuses text[] := array['APPROVED','SENT','PARTIALLY_PAID','PAID','OVERDUE','WRITTEN_OFF','CANCELLED'];
begin
  -- A. New invoices must start in DRAFT — blocks inserting a row that is
  --    already APPROVED/SENT/PAID (the headline bypass). The app always
  --    inserts DRAFT (invoiceService.createInvoiceDraft).
  if tg_op = 'INSERT' then
    if new.status is not null and new.status <> 'DRAFT' then
      raise exception 'client_invoices: new invoices must start in DRAFT (attempted %)', new.status
        using errcode = 'check_violation';
    end if;
    return new;
  end if;

  -- ---- UPDATE path ----

  -- B. Money status requires payment backing. recordPayment sets amount_paid
  --    and status together; nothing else may flip an invoice to (PARTIALLY_)PAID.
  if new.status = 'PAID' and coalesce(new.amount_paid, 0) < coalesce(new.net_due, 0) then
    raise exception 'client_invoices: cannot mark PAID — amount_paid (%) < net_due (%)',
      coalesce(new.amount_paid, 0), coalesce(new.net_due, 0)
      using errcode = 'check_violation';
  end if;
  if new.status = 'PARTIALLY_PAID' and coalesce(new.amount_paid, 0) <= 0 then
    raise exception 'client_invoices: cannot mark PARTIALLY_PAID — no payment recorded'
      using errcode = 'check_violation';
  end if;

  -- C. Once posted (approved or beyond), the contract-math fields are frozen.
  --    Legit post-approval updates only touch status / amount_paid /
  --    pdf_document_id / write_off_reason / notes / updated_at.
  if old.status = any(posted_statuses) then
    if  coalesce(new.gross_claim, 0)      is distinct from coalesce(old.gross_claim, 0)
     or coalesce(new.advance_recovery, 0) is distinct from coalesce(old.advance_recovery, 0)
     or coalesce(new.retention_held, 0)   is distinct from coalesce(old.retention_held, 0)
     or coalesce(new.taxable_amount, 0)   is distinct from coalesce(old.taxable_amount, 0)
     or coalesce(new.vat_amount, 0)       is distinct from coalesce(old.vat_amount, 0)
     or coalesce(new.total_incl_vat, 0)   is distinct from coalesce(old.total_incl_vat, 0)
     or coalesce(new.net_due, 0)          is distinct from coalesce(old.net_due, 0)
     or coalesce(new.certified_amount, 0) is distinct from coalesce(old.certified_amount, 0)
    then
      raise exception 'client_invoices: contract-math fields are locked once the invoice is % (no edits after approval)', old.status
        using errcode = 'check_violation';
    end if;
  end if;

  -- D. amount_paid is monotonic — a recorded receipt cannot be silently reversed.
  if coalesce(new.amount_paid, 0) < coalesce(old.amount_paid, 0) then
    raise exception 'client_invoices: amount_paid cannot decrease (% -> %)',
      coalesce(old.amount_paid, 0), coalesce(new.amount_paid, 0)
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_client_invoice_integrity on public.client_invoices;
create trigger trg_client_invoice_integrity
  before insert or update on public.client_invoices
  for each row execute function public.enforce_client_invoice_integrity();

-- 2) CLIENT RETENTION LEDGER — release cannot exceed outstanding held ----
create or replace function public.enforce_project_retention_cap()
returns trigger
language plpgsql
as $$
declare
  net_held numeric(14,2);
begin
  if tg_op = 'INSERT' and new.direction = 'RELEASED' then
    select coalesce(sum(case when direction = 'HELD' then amount else -amount end), 0)
      into net_held
      from public.project_retention_ledger
     where project_id = new.project_id;
    if new.amount > net_held then
      raise exception 'project_retention_ledger: release of % exceeds outstanding retention held (%) for project %',
        new.amount, net_held, new.project_id
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_project_retention_cap on public.project_retention_ledger;
create trigger trg_project_retention_cap
  before insert on public.project_retention_ledger
  for each row execute function public.enforce_project_retention_cap();

-- 3) SUPPLIER RETENTION LEDGER — same cap, grouped by supplier -----------
create or replace function public.enforce_supplier_retention_cap()
returns trigger
language plpgsql
as $$
declare
  net_held numeric(14,2);
begin
  -- supplier_id may be null (ON DELETE SET NULL); only cap when we can group.
  if tg_op = 'INSERT' and new.direction = 'RELEASED' and new.supplier_id is not null then
    select coalesce(sum(case when direction = 'HELD' then amount else -amount end), 0)
      into net_held
      from public.supplier_retention_ledger
     where supplier_id = new.supplier_id;
    if new.amount > net_held then
      raise exception 'supplier_retention_ledger: release of % exceeds outstanding retention held (%) for supplier %',
        new.amount, net_held, new.supplier_id
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_supplier_retention_cap on public.supplier_retention_ledger;
create trigger trg_supplier_retention_cap
  before insert on public.supplier_retention_ledger
  for each row execute function public.enforce_supplier_retention_cap();

NOTIFY pgrst, 'reload schema';
