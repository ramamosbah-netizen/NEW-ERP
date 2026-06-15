# JEET ERP — Administration Module — Current-State Report

What the Administration / platform area provides today, the data behind it, and
the governance gaps an enterprise layer should close. Written before any code so
the roadmap is grounded in the live schema.

---

## 1. What exists today

| Page | Route | Purpose |
|------|-------|---------|
| Administration Center | `/admin` | Config launcher (workflows, permissions, forms, templates, parameters) |
| Settings | `/admin/settings` | Users, Roles & Permissions; module toggles; parameters |
| Workflow Designer | `/admin/workflows`, `/admin/workflows/[id]` | Status/transition designer per module |
| Numbering | `/admin/numbering` | Document-number sequences |
| Rules | `/admin/rules` | No-code business-rules engine |
| Forms | `/admin/forms`, `/admin/forms/[id]` | Dynamic form-definition builder |
| Templates | `/admin/templates` | Document templates |
| Audit Log | `/admin/audit` | Raw audit-event list |

Services: `auditService`, `userRoleService`, `permissionService`, `workflowService`
(incl. `getWorkflowAnalytics`), `formBuilderService`, `numberingService`,
`rulesService`, `templateService`, `settingsService`.

---

## 2. Data model (probed against live DB)

- **`audit_log`** (59 rows) — `occurred_at, actor_user_id, actor_role, action
  (CREATE/UPDATE/DELETE/APPROVE/CHECK_IN…), entity_type, entity_id, entity_label,
  summary, before, after, ip, source, module`. Real spread: UPDATE 38, CREATE 15,
  DELETE 3, APPROVE 2; modules SYSTEM 38, INVENTORY 11, PROCUREMENT 7, …
- **`profiles`** (7) — `id, full_name, email, role` (the simple per-user role).
- **`roles`** (14) — `role_key, name, hierarchy_level (10–200), is_system, is_active`.
  Catalogue: admin(L10) → GM(L20) → … → viewer(L200), all system roles.
- **`user_roles`** (5) — `user_id, role_id, assigned_by, assigned_at`.
- **`permissions`** (51) — `permission_key, module, description`, across 10 modules
  (HR 7, PROCUREMENT 7, SERVICE 6, TESTING 6, INVENTORY 6, QUOTATION 5, FINANCE 4,
  SYSTEM 4, FLEET 3, ASSET 3).
- **`role_permissions`** (163) — `role_id, permission_id, scope` — the matrix.
- **`workflow_definitions`** (9) — `module_key, name, is_active, version`.
- **`workflow_instances`** (6) — `workflow_id, entity_type, entity_id,
  current_status_key, history (jsonb), pending_approvals (jsonb), sla_due_at`.
- **`document_templates`** (1), **`form_definitions`** (0), **`business_rules`** (0).
- Not present: `number_sequences`, `app_settings`, `login_audit`, `workflow_steps`
  (PGRST205 — services degrade gracefully).

---

## 3. Gaps an enterprise layer should close

1. **No audit analytics** — 59 events sit in a flat list; nothing trends activity by
   module/action/actor/time or surfaces **security-sensitive actions** (deletes,
   permission changes, approvals) for review.
2. **No access/role analytics** — you can edit users & roles, but nothing shows the
   **role distribution**, hierarchy spread, system-vs-custom mix, or how many
   permissions each role carries.
3. **No permissions matrix** — 14 roles × 51 permissions (163 grants) exist with no
   single governance grid to answer "who can do what," nor an export for audit.
4. **Workflow oversight is thin** — `getWorkflowAnalytics` exists but there's no
   dedicated surface for **pending approvals, SLA breaches, cycle time** across all
   instances, nor an active/inactive definition inventory.
5. **No configuration audit** — workflows/forms/templates/rules are managed
   individually; nothing inventories them together with **active/inactive, version,
   and module coverage** to spot gaps and drift.
6. **No governance hub** — the Admin Center is a config launcher, not an
   operational roll-up of platform health.

---

## 4. Constraints honoured

- **No existing business logic changes.** Every new page is additive, read-only
  analytics over existing tables/services.
- **No migrations required** — all source tables already exist.
- House pattern: `PageHeader`/`Card`/`Button`/`EmptyState` + Recharts, batched
  separate-lookup queries, PDF + Excel export, new light/amber design tokens.
- Admin routes remain admin-gated (the universal workspace stays for all roles).
