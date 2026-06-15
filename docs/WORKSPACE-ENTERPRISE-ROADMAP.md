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
- ✅ **Phase 2 — Team Workload** (`/tasks/team`): per-assignee open load, in-progress/blocked/overdue/high-urgent, KPIs (members loaded, open, avg load, unassigned), stacked workload-by-assignee chart, table. PDF/Excel.
- ✅ **Phase 3 — Meeting Analytics & Action Items** (`/meetings/analytics`): KPIs (meetings, upcoming, minutes published vs completed, open + overdue actions), meetings-by-status + per-month charts, open-action-item table (assignee + meeting + due). PDF/Excel.
- ✅ **Phase 4 — Notifications & Alerts Analytics** (`/notifications/analytics`): KPIs (total, unread, critical, read rate, actioned rate), by-severity pie, by-channel, 14-day volume trend, unread-critical/action-required table. PDF/Excel.
- ✅ **Phase 5 — Unified Calendar** (`/workspace/calendar`): month grid merging tasks (due), meetings, leave (spanning days) and PPM visits, colour-coded with a legend, prev/next month nav, today marker, click-through. No migration.
- ✅ **Phase 6 — Activity Timeline** (`/workspace/activity`): chronological feed from `audit_log` grouped by day (Today/Yesterday/…), KPIs (24h / 7d / modules / actors), activity-by-module chart, module filter, colour-coded actions, actor names. PDF/Excel.
- ✅ **Phase 7 — My Workspace Hub** (`/workspace`): personal entry point with a live attention strip (my open + overdue tasks, unread alerts, today's meetings) + module grid. See `WORKSPACE-ENTERPRISE-COMPLETE.md`.

**🎉 All 7 modules complete.** Full report: [`WORKSPACE-ENTERPRISE-COMPLETE.md`](./WORKSPACE-ENTERPRISE-COMPLETE.md). No migrations required.

### Add-on — Approvals Inbox (`/workspace/approvals`)
- ✅ "What needs my approval?" — one inbox aggregating pending items from **10 sources** across every module: Purchase Requests, Purchase Orders, Quote Comparisons, Material Requisitions, Supplier Invoices (Procurement/Finance), Quotations (Sales), Payroll Runs / Leave / Timesheets (HR), AMC Contracts (Service).
- KPIs (pending count, value at stake, oldest waiting, categories), by-category chart, category filter, age-highlighted queue with click-through to each item's approval screen. PDF/Excel. No migration.
