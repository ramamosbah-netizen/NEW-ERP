-- ============================================================
-- Aura ERP — GL backfill + period close + reporting view (Phase 3c)
-- ------------------------------------------------------------
-- 1) Period close / reopen functions (finance closes, admin reopens).
-- 2) A trial-balance view the reporting layer reads from the POSTED ledger.
-- 3) One-time BACKFILL: posts already-approved AR/AP docs + payments that
--    existed before the auto-post triggers were added. Idempotent (gl_autopost
--    dedups on source_module+source_id), so it is safe to re-run.
-- Depends on the GL core + auto-post migrations.
-- ============================================================

-- ------------------------------------------------------------
-- 1. PERIOD CLOSE / REOPEN
-- ------------------------------------------------------------
create or replace function public.close_accounting_period(p_code text)
returns void language plpgsql security definer as $$
begin
  if not public.is_finance() then
    raise exception 'Only finance/admin may close an accounting period';
  end if;
  update public.accounting_periods
     set status = 'CLOSED', closed_by = auth.uid(), closed_at = now()
   where code = p_code and status = 'OPEN';
  if not found then
    raise exception 'Period % not found or not OPEN', p_code;
  end if;
end $$;

create or replace function public.reopen_accounting_period(p_code text)
returns void language plpgsql security definer as $$
begin
  if not public.is_erp_admin() then
    raise exception 'Only an admin may reopen a closed period';
  end if;
  update public.accounting_periods
     set status = 'OPEN', closed_by = null, closed_at = null
   where code = p_code and status = 'CLOSED';
  if not found then
    raise exception 'Period % not found or not CLOSED', p_code;
  end if;
end $$;

-- ------------------------------------------------------------
-- 2. TRIAL BALANCE VIEW (posted ledger only)
-- ------------------------------------------------------------
create or replace view public.gl_trial_balance as
select a.code, a.name, a.type, a.normal_side,
       coalesce(sum(l.debit), 0)            as debit,
       coalesce(sum(l.credit), 0)           as credit,
       coalesce(sum(l.debit - l.credit), 0) as balance
  from public.gl_accounts a
  left join public.journal_lines l   on l.account_code = a.code
  left join public.journal_entries e on e.id = l.entry_id and e.status = 'POSTED'
 group by a.code, a.name, a.type, a.normal_side
 order by a.code;

grant select on public.gl_trial_balance to authenticated;

-- ------------------------------------------------------------
-- 3. ONE-TIME BACKFILL of pre-existing documents
-- ------------------------------------------------------------
do $$
declare
  r record;
  v_expense text;
  v_lines jsonb;
begin
  -- Client receipts: Dr Bank / Cr AR
  for r in select * from public.client_payments loop
    perform public.gl_autopost('AR_RECEIPT', r.id, r.payment_date,
      'Client receipt ' || r.payment_number, null,
      jsonb_build_array(
        jsonb_build_object('account','1110','debit',  r.amount),
        jsonb_build_object('account','1200','credit', r.amount)));
  end loop;

  -- Supplier payments: Dr AP / Cr Bank
  for r in select * from public.supplier_payments loop
    perform public.gl_autopost('AP_PAYMENT', r.id, r.payment_date,
      'Supplier payment ' || r.payment_number, null,
      jsonb_build_array(
        jsonb_build_object('account','2100','debit',  r.amount),
        jsonb_build_object('account','1110','credit', r.amount)));
  end loop;

  -- Supplier invoices (recognised)
  for r in select * from public.supplier_invoices
            where status = any (array['APPROVED','SCHEDULED','PARTIALLY_PAID','PAID']) loop
    v_expense := case
      when r.invoice_type = 'PO_MATCHED'               then '5100'
      when r.expense_category = 'RENT'                 then '6200'
      when r.expense_category = 'UTILITIES'            then '6300'
      when r.expense_category = 'SALARIES_PLACEHOLDER' then '6100'
      when r.expense_category = 'FUEL'                 then '6900'
      else '6900' end;
    perform public.gl_autopost('AP_INVOICE', r.id, r.invoice_date,
      'Supplier invoice ' || r.internal_ref, r.project_id,
      jsonb_build_array(
        jsonb_build_object('account', v_expense, 'debit',  r.taxable_amount),
        jsonb_build_object('account','1250',     'debit',  r.vat_amount),
        jsonb_build_object('account','2100',     'credit', r.total)));
  end loop;

  -- Client invoices (recognised) — mirror the trigger mapping
  for r in select * from public.client_invoices
            where status = any (array['APPROVED','SENT','PARTIALLY_PAID','PAID','OVERDUE']) loop
    if r.invoice_type = 'ADVANCE' then
      v_lines := jsonb_build_array(
        jsonb_build_object('account','1200','debit',  r.total_incl_vat),
        jsonb_build_object('account','2120','credit', r.taxable_amount),
        jsonb_build_object('account','2200','credit', r.vat_amount));
    elsif r.invoice_type = 'RETENTION_RELEASE' then
      v_lines := jsonb_build_array(
        jsonb_build_object('account','1200','debit',  r.total_incl_vat),
        jsonb_build_object('account','1210','credit', r.taxable_amount),
        jsonb_build_object('account','2200','credit', r.vat_amount));
    else
      v_lines := jsonb_build_array(
        jsonb_build_object('account','1200','debit',  r.net_due),
        jsonb_build_object('account','1210','debit',  r.retention_held),
        jsonb_build_object('account','2120','debit',  r.advance_recovery),
        jsonb_build_object('account','4100','credit', r.taxable_amount),
        jsonb_build_object('account','2200','credit', r.vat_amount));
    end if;
    perform public.gl_autopost('AR_INVOICE', r.id, r.invoice_date,
      'Client invoice ' || r.invoice_number, r.project_id, v_lines);
  end loop;
end $$;

NOTIFY pgrst, 'reload schema';
