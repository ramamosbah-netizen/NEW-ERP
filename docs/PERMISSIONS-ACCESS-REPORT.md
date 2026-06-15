# JEET ERP — Role-Based Access & Per-User Workspace — Report

How navigation access and the personal workspace are gated by role, end to end.

---

## 1. Overview

Two layers, one source of truth:

1. **Route gating** — a role allowlist (`src/lib/permissions/routeAccess.ts`)
   decides which routes a role may reach. It drives **both** the sidebar (hides
   links) and the page guard (blocks deep-links), so they can never disagree.
2. **Per-user scoping** — the personal workspace pages default to *the signed-in
   user's own data* (a **Mine / Everyone** toggle), and Approvals is role-aware.

Design principle throughout: **never lock out legacy users.** `admin`, `manager`
and `engineer` are unrestricted; gating only applies to roles explicitly listed.

---

## 2. How route gating works

`src/lib/permissions/routeAccess.ts` exports `isRouteAllowed(role, pathname)`:

- `admin` → everything.
- A role **not** in `ROLE_ALLOWLIST` → unrestricted (everything) — this covers the
  current `manager` and `engineer` users.
- A role **in** `ROLE_ALLOWLIST` → may reach its module prefixes **plus** the
  universal `WORKSPACE_ROUTES`; everything else is denied (prefix match).

Consumed in two places:
- `src/components/layout/AppSidebar.tsx` — `section.items.filter(isRouteAllowed)`; empty sections disappear.
- `src/components/layout/AppShell.tsx` — if `!isRouteAllowed(role, pathname)` it renders an **access-denied** screen, so a direct URL can't bypass the sidebar.

Roles come from `profiles.role` (currently `admin` / `manager` / `engineer`); the
richer catalogue (General Manager, Procurement Officer, Storekeeper, …) lives in
the `roles` table and is assigned in **Admin → Users, Roles & Permissions**.

---

## 3. Universal workspace

Every role — restricted or not — keeps the personal productivity surface, because
those pages already scope to the signed-in user:

`/` · `/dashboard` · `/profile` · `/myday` · `/tasks` · `/meetings` ·
`/notifications` · `/workspace` (incl. **Approvals**, **Calendar**, analytics).

---

## 4. Role → module access matrix

`●` allowed · blank denied. Workspace is implicitly allowed for all.

| Role | Workspace | Sales/Tenders | Projects | Procurement | Warehouse | Finance | AMC/Service | HR/Payroll | Fleet | Admin |
|------|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| Admin | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● |
| Manager *(unrestricted)* | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● |
| Engineer *(unrestricted)* | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● |
| Accountant | ● | | | | | ● | | | | |
| Procurement Officer | ● | | | ● | ● | | | | | |
| Storekeeper | ● | | | | ● | | | | | |
| HR Manager | ● | | | | | | | ● | | |
| Service Coordinator | ● | | | | | | ● | | | |
| Estimator | ● | ● | | | | | | | | |
| Site Engineer | ● | | ● | | | | | | | |
| Field Technician | ● | | | | | | ● *(desk/PPM)* | | | |
| Fleet Coordinator | ● | | | | | | | | ● | |

*(Accountant also reaches `/documents`, `/assets`, `/reports`. Auditor/Viewer is
left unrestricted by design — read-everywhere — until an RLS read-only layer exists.)*

---

## 5. Per-user workspace scoping

Each personal page has a **Mine / Everyone** toggle (defaults to **Mine**),
filtering by the user-owning column. Managers/admins flip to *Everyone* for the
team view.

| Page | "Mine" filters on |
|------|-------------------|
| Task Analytics (`/tasks/analytics`) | `tasks.assignee_id` = me |
| Team Workload (`/tasks/team`) | team-wide by design (answers "who is overloaded") |
| Meeting Analytics (`/meetings/analytics`) | `meetings.organizer_id` = me + action items assigned to me |
| Notifications Analytics (`/notifications/analytics`) | `notifications.user_id` = me |
| Unified Calendar (`/workspace/calendar`) | my tasks + my meetings (leave/PPM stay as shared context) |
| Activity Timeline (`/workspace/activity`) | `audit_log.actor_user_id` = me |
| Workspace Hub (`/workspace`) | personal: my open/overdue tasks, unread alerts, today's meetings |

### Approvals (`/workspace/approvals`) — role-aware
Aggregates pending items from **10 sources** (PRs, POs, comparisons, MRFs,
supplier invoices, quotations, payroll runs, leave, timesheets, AMC contracts):

- **Approver roles** (`admin, administrator, manager, general manager, commercial
  manager, project manager, accountant, hr manager, finance, finance manager,
  financial director`) → see **everything pending** to approve.
- **Everyone else** → see only **their own submissions** awaiting approval
  (matched on `created_by` / `requested_by` / `prepared_by`, or their `employees`
  record for leave/timesheets).
- A Mine / Everyone toggle is available to all; the user's role is shown in-header.

---

## 6. Verification

- Gating logic: **17/17** scenarios pass (e.g. accountant → `/finance` + `/workspace/approvals` ✓, `/procurement` ✗; storekeeper → `/warehouse` ✓, `/finance` ✗; manager/engineer/admin → all ✓).
- All user-owning columns probed against the live DB (`tasks.assignee_id`, `notifications.user_id`, `meetings.organizer_id`, `audit_log.actor_user_id`, and every approval-source creator field).
- `npx tsc --noEmit --skipLibCheck` → **0 source errors**.

---

## 7. Security note (important)

This is a **navigation / visibility** fence — it hides sidebar links and blocks
in-app deep-links. It is **not** a data-security boundary: Supabase **RLS is
collaborative** (`using(true)`) across the app, so the REST API itself does not
enforce per-role row access. For true per-role *data* restriction, a separate RLS
hardening effort is required (policies keyed to `auth.uid()` / role claims). The
current model suits an internal, trusted-team ERP; revisit before exposing the
API to less-trusted users.

---

## 8. How to configure

1. **Admin → Users, Roles & Permissions** — set a user's role.
2. Setting a role to a scoped value (e.g. *Storekeeper*) immediately collapses
   their sidebar to Warehouse + personal workspace; other URLs show access-denied.
3. To restrict a new role, add a line to `ROLE_ALLOWLIST` in
   `src/lib/permissions/routeAccess.ts` with its module prefixes (workspace is
   appended automatically).
4. Leave a role **out** of `ROLE_ALLOWLIST` to keep it unrestricted.
