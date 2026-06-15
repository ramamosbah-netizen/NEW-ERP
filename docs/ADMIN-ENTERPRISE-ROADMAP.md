# JEET ERP — Administration — Enterprise Roadmap

Six additive governance/analytics surfaces layered on the existing Administration
module. Every phase is **read-only over existing tables** (no migrations, no logic
changes), uses the house UI kit + Recharts on the new design tokens, and exports to
PDF + Excel. One git commit per page.

---

## Phases

| # | Page | Route | Answers |
|---|------|-------|---------|
| 1 | **Administration & Governance Hub** | `/admin/hub` | "What's the state of the platform & who's doing what?" |
| 2 | **Audit & Activity Analytics** | `/admin/audit/analytics` | Activity by module/action/actor/time; security-sensitive actions |
| 3 | **Access & Roles Analytics** | `/admin/access` | Role distribution, hierarchy spread, system/custom, perms per role |
| 4 | **Permissions Matrix** | `/admin/permissions` | Roles × module permission coverage — "who can do what" + export |
| 5 | **Workflow & Approvals Analytics** | `/admin/workflows/analytics` | Pending approvals, SLA breaches, cycle time, definition inventory |
| 6 | **Platform Configuration Audit** | `/admin/configuration` | Inventory of workflows/forms/templates/rules — active, version, coverage |

---

## Cross-cutting

- **Governance focus** — phases 2–4 are the highest value: they turn the audit
  trail and the 14×51 permission model into reviewable, exportable oversight (the
  kind of artefact an external auditor or ISO/SOC review asks for).
- **Security lens** — the audit analytics highlights **DELETE**, **APPROVE** and
  permission/role changes separately so privileged actions are easy to review.
- **SLA lens** — workflow analytics flags instances **past `sla_due_at`** and those
  with outstanding `pending_approvals`.
- **Exports** — every analytics page exposes PDF + Excel via `finance-export`.
- **Empty-safe** — pages degrade to clean empty states where a table is empty
  (forms, rules, sequences).
- **RBAC** — all routes stay under `/admin/*` (admin-gated); the universal
  workspace remains available to every role.

---

## Out of scope (future)

- Live login/session audit (needs a `login_audit` table + auth hook).
- Automated anomaly detection / alerting on the audit stream.
- Config change-approval workflow (governance-of-governance).
- Per-field data-retention / PII redaction policy engine.
