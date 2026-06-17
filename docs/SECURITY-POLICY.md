# Aura ERP — Security Policy: strict core, configurable operations

Guiding principle while the ERP is under active development:
**lock down what protects money and data; keep operational workflows flexible.**

## 🔒 STRICT — non-negotiable, enforced in the database (do not loosen)

These hold even against a direct anon-key write, independent of the UI:

| Control | Where |
|---|---|
| Finance **writes** restricted to finance roles (admin/accountant/gm/…) | RLS `is_finance()` on AR/AP/treasury/budget/petty-cash/retention/expenses |
| Payroll/compensation **read + write** restricted to HR/admin | RLS `is_hr()` on `employee_compensation`, payroll, EOSB, SIF |
| Invoice status machine, payment backing, math immutability, monotonic `amount_paid`, retention caps | `enforce_*` BEFORE triggers (`20260616220000`) |
| GL: balanced posting, post only into OPEN periods, posted entries immutable | `post_journal_entry` / triggers (`20260617110000`) |

Validated by `scripts/security-audit.mjs` (22/22 against the live DB).

## ⚙️ CONFIGURABLE — flexible during development (tune without redeploys)

| Knob | How |
|---|---|
| **Which workflow modules enforce maker-checker** | Setting `security.maker_checker_modules` (Admin → Settings). Default = the strict set below. Fail-safe: missing/unreadable → strict default. |
| Operational tables (projects, procurement ops, tasks, etc.) | Remain open `authenticated` RLS — read/write for any signed-in user, so feature work isn't blocked. |
| Client-side route fences / permission UI | Cosmetic only (real enforcement is RLS). |

### Maker-checker default set
`INV, SINV, PROFORMA, PAYMENT_REQ, BUDGET, PETTY_CASH, EXP`

To change at runtime, set `security.maker_checker_modules` to a JSON array of module keys, e.g.:

```json
["INV", "SINV", "PAYMENT_REQ"]
```

- **Widen** as a module matures (add its key).
- **Narrow** during heavy iteration (remove a key) — but the DB-level money controls above still apply regardless.
- Code: `src/lib/security/policy.ts` (`getMakerCheckerModules()`), consumed by `workflowService.executeTransition`.

## Rule of thumb for new work
- New money/approval flow → add its module key to maker-checker; rely on RLS/triggers for the hard guarantees.
- New operational feature → leave it flexible; lock it down later as part of the pre-launch hardening gate.
