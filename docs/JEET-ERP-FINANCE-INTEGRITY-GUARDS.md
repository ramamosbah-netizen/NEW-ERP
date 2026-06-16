# JEET ERP — Finance Integrity Guards (DB triggers)

**Migration:** `supabase/migrations/20260616220000_finance_integrity_guards.sql`
**Apply:** manually in the Supabase SQL editor (idempotent; ends with `NOTIFY pgrst`).
**Touches RLS?** No. The collaborative `using(true)` policies are unchanged.

## Why

The most fraud-sensitive tables — `client_invoices`, `project_retention_ledger`,
`supplier_retention_ledger` — were enforced only in the app/workflow layer.
Because RLS is collaborative (`using(true)`), a direct anon-key write (Postman,
SQL, a script) could insert a `PAID` invoice or release retention **with no
approval and no workflow**. These `BEFORE` triggers fire on *any* write, so the
guarantees hold even when the app is bypassed.

This is **Stage 1** of the finance DB-authority work: *integrity*, not
*authorization*. It's deliberately additive so it cannot break the live AR
module (verified against `invoiceService` + `paymentService` — every legitimate
flow already satisfies these invariants).

## What it enforces

| # | Table | Invariant | Blocks |
|---|-------|-----------|--------|
| A | `client_invoices` | New rows must start in `DRAFT` | Inserting a row that is already `APPROVED`/`SENT`/`PAID` |
| B | `client_invoices` | `PAID` needs `amount_paid ≥ net_due`; `PARTIALLY_PAID` needs `amount_paid > 0` | Marking an invoice paid without recording a receipt |
| C | `client_invoices` | Contract-math fields frozen once posted (`APPROVED`+) | Editing `gross_claim`/`advance_recovery`/`retention_held`/VAT/`net_due`/`certified_amount` on an approved invoice |
| D | `client_invoices` | `amount_paid` is monotonic (never decreases) | Silently reversing a recorded receipt |
| E | `project_retention_ledger` | A `RELEASED` row can't exceed outstanding `HELD` | Releasing more client retention than was withheld |
| F | `supplier_retention_ledger` | Same cap, grouped by `supplier_id` | Over-releasing subcontractor retention (overpayment) |

Legitimate post-approval updates (status changes, `amount_paid`, `pdf_document_id`,
`write_off_reason`, `notes`, `updated_at`) are all still allowed.

## What is deliberately deferred (the pre-launch DB-authority gate)

These are **not** included because they would break the current single-admin
workflow, where one person both creates and approves:

- Role-based RLS lockdown / RPC-only writes (replace `using(true)`).
- Maker–checker / self-approval prevention (`created_by <> approver`).

Turn these on as part of onboarding real (untrusted) users — not before.

## Verify after applying

Run in the SQL editor — each should **fail** with a `check_violation`:

```sql
-- A: forging a PAID invoice directly should be rejected
insert into public.client_invoices
  (invoice_number, client_id, client_name, invoice_type, status,
   invoice_date, supply_date, due_date, created_by)
values
  ('TEST-FORGE-1', (select id from public.clients limit 1), 'X', 'STANDALONE',
   'PAID', now(), now(), now(), auth.uid());
-- → ERROR: client_invoices: new invoices must start in DRAFT (attempted PAID)
```

```sql
-- E: releasing retention with none held should be rejected
insert into public.project_retention_ledger (project_id, invoice_id, direction, amount)
values ((select id from public.projects limit 1),
        (select id from public.client_invoices limit 1), 'RELEASED', 1.00);
-- → ERROR: ... release of 1.00 exceeds outstanding retention held (0.00) ...
```

A normal `DRAFT` insert and the usual approve → send → record-payment flow
continue to work unchanged.

## Apply order

This migration is independent of the workflow seeds; apply it any time after the
base finance schema. Full outstanding order:
`190000 → 193000 → 200000 → 201000 → 210000 → 211000 → 212000 → 220000`.
