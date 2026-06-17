# Aura ERP — Role & RLS Security Audit (do this BEFORE production)

The RLS lockdown (`20260617100000_rls_lockdown.sql`) and maker-checker were
authored but **not runtime-tested**. This checklist validates them. The most
important cases are the **negative** ones — confirming a role is *blocked*, not
just that admin works.

## 0. Setup
Create one active test user per role (Admin → Users), each with a real login:

| Test user | Role key |
|---|---|
| audit.admin | `admin` |
| audit.finance | `accountant` (or `account`) |
| audit.hr | `hr` |
| audit.pm | `pm` / `manager` |
| audit.proc | `procurement` |
| audit.store | `storekeeper` |
| audit.eng | `engineer` |

> Reminder: RLS is enforced in Postgres, so test by **logging in as each user**
> in the app (not as admin). UI hiding ≠ RLS — the real test is whether the DB
> returns/accepts data.

## 1. Finance write lockdown  (expect: only finance roles + admin can write)
Locked tables: client/supplier invoices & payments, petty cash, treasury, bank,
budgets, commitments, retention, expenses.

| Action | admin | finance | hr | pm | proc | store | eng |
|---|---|---|---|---|---|---|---|
| **Read** finance lists (`/finance/...`) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Create** client invoice (`/finance/ar/create`) | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Record** a payment | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Edit** petty cash / treasury | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |

🔴 **Critical negative test:** log in as `engineer`, open `/finance/ar/create`,
fill a valid invoice, hit save → **must fail** (RLS `client_invoices_mod`). If it
saves, the lockdown didn't apply — stop and fix before launch.

## 2. Payroll / salary confidentiality  (expect: HR + admin only, READ included)
Locked tables: `employee_compensation`, `payroll_*`, `eosb_*`, `sif_*`, advances.

| Action | admin | hr | finance | pm | eng |
|---|---|---|---|---|---|
| **Read** salaries / compensation | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Run / approve** payroll | ✅ | ✅ | ❌ | ❌ | ❌ |
| **View** EOSB liability | ✅ | ✅ | ❌ | ❌ | ❌ |

🔴 **Critical negative test:** as `pm` or `finance`, open an employee detail →
the **compensation section must be empty / error**, not show salary figures.

## 3. Maker-checker  (needs TWO users)
Enforced on: `INV, SINV, PROFORMA, PAYMENT_REQ, BUDGET, PETTY_CASH, EXP` (workflow)
and PR / budget / petty-cash (DB triggers).

1. As **user A** create + submit a client invoice (INV).
2. As **user A** try to approve it → **must be blocked** ("cannot approve a record you created").
3. As **user B** (finance) approve it → **must succeed**.
4. ✅ Confirm a non-sensitive flow (e.g. PO, quotation) can still be created AND
   progressed by the *same* user (these are intentionally flexible).

## 4. GL posting integrity (already verified balanced — re-confirm controls)
- As `finance`, try to **post into a CLOSED period** → must fail.
- Try to **edit a POSTED journal entry** → must fail (immutable; reverse instead).
- Trial balance at `/finance/ledger` → debits = credits (0 unbalanced rows).

## 5. Admin sanity
- `admin` can do everything above (no false blocks).
- No legitimate flow is blocked for the role that owns it (watch for false positives).

## Sign-off
- [ ] Section 1 — finance write lockdown (incl. negative)
- [ ] Section 2 — payroll confidentiality (incl. negative)
- [ ] Section 3 — maker-checker (two users)
- [ ] Section 4 — GL posting controls
- [ ] Section 5 — admin sanity / no false blocks

Only deploy to production once every box is ticked.
