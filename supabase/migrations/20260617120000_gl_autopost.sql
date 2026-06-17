-- ============================================================
-- Aura ERP — GL AUTO-POSTING (Phase 3b)
-- ------------------------------------------------------------
-- Wires the AR/AP sub-ledgers into the posted general ledger
-- (20260617110000_general_ledger.sql) via AFTER triggers, so statements can be
-- read from POSTED books instead of being derived on the fly.
--
-- SAFETY DESIGN (important):
--   • RESILIENT — auto-posting NEVER blocks the business write. If a GL post
--     fails (closed period, rounding, bad mapping) the journal entry is left in
--     DRAFT for finance to review; the invoice/payment still succeeds.
--   • IDEMPOTENT — one entry per source document (source_module, source_id);
--     re-firing triggers does not double-post.
--   • REVERSIBLE — cancelling/writing-off a document posts a mirror reversal.
--   • SECURITY DEFINER — posts to the GL even though GL writes are finance-scoped.
--
-- ACCOUNT MAPPING (adjust here if your CoA differs):
--   1110 Bank · 1200 AR · 1210 Retention Receivable · 1250 Input VAT
--   2100 AP   · 2120 Advance from Customers · 2200 Output VAT
--   4100 Contract Revenue · 5100 Materials · 6100/6200/6300/6900 expenses
--
-- ⚠️ Finance-critical and written without DB access — VERIFY IN STAGING with the
--    sample scenarios in the comment at the bottom before trusting the books.
-- Idempotent migration. Depends on the GL core migration.
-- ============================================================

-- New account: advance billings are a liability until recovered against work.
insert into public.gl_accounts (code, name, type, normal_side, is_postable) values
  ('2120','Advance from Customers','LIABILITY','CREDIT',true)
on conflict (code) do nothing;

-- ------------------------------------------------------------
-- Generic poster: build a DRAFT entry from jsonb lines, then try to post.
-- p_lines: [{ "account": "1200", "debit": 100, "credit": 0, "desc": "..." }, ...]
-- Zero-value lines are skipped (the one-sided CHECK rejects 0/0 lines).
-- ------------------------------------------------------------
create or replace function public.gl_autopost(
  p_module text,
  p_source_id uuid,
  p_date date,
  p_memo text,
  p_project uuid,
  p_lines jsonb
) returns uuid
language plpgsql
security definer
as $$
declare
  v_entry  uuid;
  v_period text := to_char(coalesce(p_date, current_date), 'YYYY-MM');
  v_date   date := coalesce(p_date, current_date);
  v_line   jsonb;
  v_ln     int := 0;
  v_dr     numeric(14,2);
  v_cr     numeric(14,2);
begin
  -- idempotent: skip if a non-void entry already exists for this source doc
  select id into v_entry
    from public.journal_entries
   where source_module = p_module and source_id = p_source_id and status <> 'VOID'
   limit 1;
  if found then
    return v_entry;
  end if;

  -- ensure the target period exists (auto-open if missing)
  insert into public.accounting_periods (code, name, start_date, end_date, status)
  values (v_period, to_char(v_date, 'Mon YYYY'),
          date_trunc('month', v_date)::date,
          (date_trunc('month', v_date) + interval '1 month - 1 day')::date, 'OPEN')
  on conflict (code) do nothing;

  insert into public.journal_entries (entry_date, period_code, memo, source_module, source_id, created_by)
  values (v_date, v_period, p_memo, p_module, p_source_id, auth.uid())
  returning id into v_entry;

  for v_line in select * from jsonb_array_elements(p_lines) loop
    v_dr := round(coalesce((v_line->>'debit')::numeric, 0), 2);
    v_cr := round(coalesce((v_line->>'credit')::numeric, 0), 2);
    if v_dr = 0 and v_cr = 0 then
      continue;  -- skip empty lines
    end if;
    v_ln := v_ln + 1;
    insert into public.journal_lines (entry_id, line_no, account_code, description, debit, credit, project_id)
    values (v_entry, v_ln, v_line->>'account', coalesce(v_line->>'desc', p_memo), v_dr, v_cr, p_project);
  end loop;

  -- try to post; on ANY failure leave the entry DRAFT (never block the caller)
  begin
    perform public.post_journal_entry(v_entry);
  exception when others then
    null;  -- entry remains DRAFT for finance review
  end;

  return v_entry;
end $$;

-- Reverse a previously posted source-doc entry (cancellation/write-off).
create or replace function public.gl_autovoid(p_module text, p_source_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_entry  uuid;
  v_rev    uuid;
  v_period text := to_char(current_date, 'YYYY-MM');
begin
  select id into v_entry
    from public.journal_entries
   where source_module = p_module and source_id = p_source_id and status = 'POSTED'
   limit 1;
  if not found then return; end if;
  if exists (select 1 from public.journal_entries where reverses_id = v_entry) then
    return;  -- already reversed
  end if;

  insert into public.accounting_periods (code, name, start_date, end_date, status)
  values (v_period, to_char(current_date, 'Mon YYYY'),
          date_trunc('month', current_date)::date,
          (date_trunc('month', current_date) + interval '1 month - 1 day')::date, 'OPEN')
  on conflict (code) do nothing;

  begin
    v_rev := public.reverse_journal_entry(v_entry, v_period);
    perform public.post_journal_entry(v_rev);
  exception when others then
    null;
  end;
end $$;

-- ------------------------------------------------------------
-- AR — client receipts:  Dr Bank / Cr AR
-- ------------------------------------------------------------
create or replace function public.gl_trg_client_payment()
returns trigger language plpgsql security definer as $$
begin
  perform public.gl_autopost('AR_RECEIPT', new.id, new.payment_date,
    'Client receipt ' || new.payment_number, null,
    jsonb_build_array(
      jsonb_build_object('account','1110','debit',  new.amount, 'desc','Bank receipt'),
      jsonb_build_object('account','1200','credit', new.amount, 'desc','AR settled')
    ));
  return new;
end $$;

drop trigger if exists trg_gl_client_payment on public.client_payments;
create trigger trg_gl_client_payment
  after insert on public.client_payments
  for each row execute function public.gl_trg_client_payment();

-- ------------------------------------------------------------
-- AP — supplier disbursements:  Dr AP / Cr Bank
-- ------------------------------------------------------------
create or replace function public.gl_trg_supplier_payment()
returns trigger language plpgsql security definer as $$
begin
  perform public.gl_autopost('AP_PAYMENT', new.id, new.payment_date,
    'Supplier payment ' || new.payment_number, null,
    jsonb_build_array(
      jsonb_build_object('account','2100','debit',  new.amount, 'desc','AP settled'),
      jsonb_build_object('account','1110','credit', new.amount, 'desc','Bank payment')
    ));
  return new;
end $$;

drop trigger if exists trg_gl_supplier_payment on public.supplier_payments;
create trigger trg_gl_supplier_payment
  after insert on public.supplier_payments
  for each row execute function public.gl_trg_supplier_payment();

-- ------------------------------------------------------------
-- AP — supplier invoice recognition (at APPROVED):
--   Dr Expense/COGS + Dr Input VAT / Cr AP ; reverse on CANCELLED
-- ------------------------------------------------------------
create or replace function public.gl_trg_supplier_invoice()
returns trigger language plpgsql security definer as $$
declare v_expense text;
begin
  if new.status = any (array['APPROVED','SCHEDULED','PARTIALLY_PAID','PAID']) then
    v_expense := case
      when new.invoice_type = 'PO_MATCHED'              then '5100'  -- Materials
      when new.expense_category = 'RENT'                then '6200'
      when new.expense_category = 'UTILITIES'           then '6300'
      when new.expense_category = 'SALARIES_PLACEHOLDER' then '6100'
      when new.expense_category = 'FUEL'                then '6900'
      else '6900'  -- Other
    end;
    perform public.gl_autopost('AP_INVOICE', new.id, new.invoice_date,
      'Supplier invoice ' || new.internal_ref, new.project_id,
      jsonb_build_array(
        jsonb_build_object('account', v_expense, 'debit',  new.taxable_amount, 'desc','Expense / COGS'),
        jsonb_build_object('account','1250',     'debit',  new.vat_amount,     'desc','Input VAT'),
        jsonb_build_object('account','2100',     'credit', new.total,          'desc','Accounts payable')
      ));
  elsif new.status = 'CANCELLED' then
    perform public.gl_autovoid('AP_INVOICE', new.id);
  end if;
  return new;
end $$;

drop trigger if exists trg_gl_supplier_invoice on public.supplier_invoices;
create trigger trg_gl_supplier_invoice
  after insert or update on public.supplier_invoices
  for each row execute function public.gl_trg_supplier_invoice();

-- ------------------------------------------------------------
-- AR — client invoice recognition (at APPROVED+), by invoice_type.
--   PROGRESS/FINAL/STANDALONE:
--     Dr AR(net_due) + Dr Retention(1210) + Dr Advance recovered(2120)
--       / Cr Revenue(4100) + Cr Output VAT(2200)
--     (Dr side = total_incl_vat = Cr side — always balances; zero legs skipped)
--   ADVANCE:           Dr AR / Cr Advance(2120) + Cr VAT
--   RETENTION_RELEASE: Dr AR / Cr Retention(1210) + Cr VAT
--   Reverse on CANCELLED / WRITTEN_OFF.
-- ------------------------------------------------------------
create or replace function public.gl_trg_client_invoice()
returns trigger language plpgsql security definer as $$
declare v_lines jsonb;
begin
  if new.status = any (array['APPROVED','SENT','PARTIALLY_PAID','PAID','OVERDUE']) then
    if new.invoice_type = 'ADVANCE' then
      v_lines := jsonb_build_array(
        jsonb_build_object('account','1200','debit',  new.total_incl_vat, 'desc','AR advance bill'),
        jsonb_build_object('account','2120','credit', new.taxable_amount, 'desc','Advance from customer'),
        jsonb_build_object('account','2200','credit', new.vat_amount,     'desc','Output VAT')
      );
    elsif new.invoice_type = 'RETENTION_RELEASE' then
      v_lines := jsonb_build_array(
        jsonb_build_object('account','1200','debit',  new.total_incl_vat, 'desc','AR retention release'),
        jsonb_build_object('account','1210','credit', new.taxable_amount, 'desc','Retention receivable released'),
        jsonb_build_object('account','2200','credit', new.vat_amount,     'desc','Output VAT')
      );
    else  -- PROGRESS / FINAL / STANDALONE
      v_lines := jsonb_build_array(
        jsonb_build_object('account','1200','debit',  new.net_due,         'desc','AR net due'),
        jsonb_build_object('account','1210','debit',  new.retention_held,  'desc','Retention held'),
        jsonb_build_object('account','2120','debit',  new.advance_recovery,'desc','Advance recovered'),
        jsonb_build_object('account','4100','credit', new.taxable_amount,  'desc','Contract revenue'),
        jsonb_build_object('account','2200','credit', new.vat_amount,      'desc','Output VAT')
      );
    end if;

    perform public.gl_autopost('AR_INVOICE', new.id, new.invoice_date,
      'Client invoice ' || new.invoice_number, new.project_id, v_lines);

  elsif new.status = any (array['CANCELLED','WRITTEN_OFF']) then
    perform public.gl_autovoid('AR_INVOICE', new.id);
  end if;
  return new;
end $$;

drop trigger if exists trg_gl_client_invoice on public.client_invoices;
create trigger trg_gl_client_invoice
  after insert or update on public.client_invoices
  for each row execute function public.gl_trg_client_invoice();

NOTIFY pgrst, 'reload schema';

-- ============================================================
-- STAGING VERIFICATION (run after applying, then review):
--   -- 1) every posted entry must balance:
--   select entry_no, source_module,
--          sum(debit) dr, sum(credit) cr
--     from public.journal_entries e join public.journal_lines l on l.entry_id = e.id
--    where e.status = 'POSTED'
--    group by 1,2 having sum(debit) <> sum(credit);   -- expect 0 rows
--
--   -- 2) anything that failed to auto-post (left DRAFT) for finance to review:
--   select * from public.journal_entries where status = 'DRAFT' and source_module is not null;
--
--   -- 3) trial balance:
--   select a.code, a.name,
--          sum(l.debit) dr, sum(l.credit) cr, sum(l.debit - l.credit) bal
--     from public.journal_lines l
--     join public.journal_entries e on e.id = l.entry_id and e.status='POSTED'
--     join public.gl_accounts a on a.code = l.account_code
--    group by 1,2 order by 1;
-- ============================================================
