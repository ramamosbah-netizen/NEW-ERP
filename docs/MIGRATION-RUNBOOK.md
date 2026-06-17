# Aura ERP — Hardening migrations runbook (2026-06-17)

This covers applying the security + general-ledger migrations and verifying them.
Apply in **staging first**, smoke-test, then production. All migrations are
idempotent and can be re-run safely.

## Migration order

| # | File | Status | Purpose |
|---|------|--------|---------|
| 1 | `20260617100000_rls_lockdown.sql` | applied ✅ | Role-scoped RLS + maker-checker |
| 2 | `20260617110000_general_ledger.sql` | applied ✅ | Posted double-entry GL core |
| 3 | `20260617120000_gl_autopost.sql` | **to apply** | Auto-post AR/AP/payments into the GL |
| 4 | `20260617130000_gl_backfill_and_periods.sql` | **to apply** | Period close/reopen, TB view, one-time backfill |

> They share `create or replace` helpers (`is_finance`, etc.) with identical
> definitions, so order/re-runs are safe. #2 was made self-contained after a
> first-run `is_finance() does not exist` error.

## Apply

In the Supabase SQL editor (runs each script in one transaction), paste and run
`...120000...` then `...130000...`.

## Verify (after #3 + #4)

```sql
-- 1) every POSTED entry must balance  → expect 0 rows
select e.entry_no, e.source_module, sum(l.debit) dr, sum(l.credit) cr
  from public.journal_entries e join public.journal_lines l on l.entry_id = e.id
 where e.status = 'POSTED'
 group by 1,2 having sum(l.debit) <> sum(l.credit);

-- 2) anything that could NOT auto-post (held DRAFT for finance review)
select id, entry_no, source_module, memo from public.journal_entries
 where status = 'DRAFT' and source_module is not null;

-- 3) trial balance (also visible at /finance/ledger)
select * from public.gl_trial_balance where debit <> 0 or credit <> 0;
```

The `/finance/ledger` page shows the trial balance, period close/reopen, and a
banner for any DRAFT entries needing review.

## Operational notes

- **Maker-checker is now live.** A single user can no longer create *and* approve
  a Purchase Request, Project Budget, Petty Cash entry, or any workflow-driven
  document. You need at least two users (a maker and a checker). To approve
  routinely as one person again, you'd have to drop the `trg_maker_checker`
  triggers and revert the `executeTransition` check — not recommended.
- **Auto-posting never blocks operations.** If a journal post fails (closed
  period, bad mapping), the invoice/payment still succeeds and the entry is left
  DRAFT (see verification query #2).
- **App deploy required.** The workflow maker-checker, React Query, Aura branding,
  zod validation, and the Ledger page live in the app build — deploy to activate.

## Rollback

- RLS lockdown: uncomment the rollback block at the bottom of
  `20260617100000_rls_lockdown.sql` and run it (restores open policies, drops the
  maker-checker triggers).
- GL: it is additive. To disable auto-posting without dropping data:
  ```sql
  drop trigger if exists trg_gl_client_invoice  on public.client_invoices;
  drop trigger if exists trg_gl_client_payment  on public.client_payments;
  drop trigger if exists trg_gl_supplier_invoice on public.supplier_invoices;
  drop trigger if exists trg_gl_supplier_payment on public.supplier_payments;
  ```

## Account mapping (auto-posting)

`1110` Bank · `1200` AR · `1210` Retention Receivable · `1250` Input VAT ·
`2100` AP · `2120` Advance from Customers · `2200` Output VAT ·
`4100` Contract Revenue · `5100` Materials · `6100/6200/6300/6900` expenses.
Adjust in `20260617120000_gl_autopost.sql` (and the backfill block of `...130000`)
if your chart of accounts differs.
