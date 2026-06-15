# JEET ERP — My Workspace — Enterprise Roadmap

Extend the personal-productivity Core area with analytics + a unified view
**without breaking My Day, the task board, meetings or the notification inbox**.
New pages use the in-house UI kit + Recharts and the separate-lookup pattern.
All analytics over existing tables — **no migrations**.

## Build order (7-item program)

1. **Task Analytics** — by status / priority / origin / project, overdue, completion rate, throughput trend. `/tasks/analytics` *(no migration)*.
2. **Team Workload** — open tasks + load + overdue per assignee. `/tasks/team` *(no migration)*.
3. **Meeting Analytics & Action Items** — meetings by status, action-item tracking + overdue. `/meetings/analytics` *(no migration)*.
4. **Notifications & Alerts Analytics** — by severity / channel / status, unread + actioned rate, trend. `/notifications/analytics` *(no migration)*.
5. **Unified Calendar** — tasks (due) + meetings + leave + PPM in one month view. `/workspace/calendar` *(no migration)*.
6. **Activity Timeline** — recent cross-module activity from the audit log. `/workspace/activity` *(no migration)*.
7. **Workspace Hub** — `/workspace` landing with a live "needs attention" strip + module grid.

Each ships: page(s), filters/search, export (PDF/Excel via `finance-export`),
Recharts where useful, sidebar link, RBAC, and a roadmap update.

## Status
- ✅ **Module report** (`WORKSPACE-MODULE-REPORT.md`) + this roadmap.
- ✅ **Phase 1 — Task Analytics** (`/tasks/analytics`): KPIs (total, open, overdue, blocked, completion rate), by-status pie, open-by-priority, by-origin, created-vs-done throughput. PDF/Excel.
- ⏭ Then: Team Workload → Meeting Analytics → Notifications Analytics → Unified Calendar → Activity Timeline → Hub.
