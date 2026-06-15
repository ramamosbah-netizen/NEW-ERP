# JEET ERP — My Workspace — Current-State Report

Scope: the **Core** sidebar group — `src/app/{dashboard, myday, tasks, meetings,
notifications}/*`, `src/services/{taskService, meetingService, notificationService,
eventService, kpiService, reportingService, calendarSyncService}.ts`,
`src/types/{task, meeting, notification}.types.ts`.

The personal productivity surface is functional — the gap is **analytics + a
unified workspace view** over tasks, meetings, alerts and activity.

## 1. Pages (UI today)

| Route | Purpose |
|-------|---------|
| `/dashboard` | Executive KPI dashboard (`kpiService`) |
| `/myday` | Personal "My Day" view (tasks, schedule) |
| `/tasks` | Task list/board |
| `/tasks/workload` | Team workload heat strip (`WorkloadHeatStrip`) |
| `/meetings` | Meetings (agenda, minutes, action items) |
| `/notifications` + `/preferences` | Alerts & logs inbox + channel preferences |

Sidebar **Core**: Dashboard, My Day, Tasks, Meetings, Alerts & Logs.

## 2. Data model (probed)

- **tasks** (10) — `title, description, origin (MANUAL/AUTO_RULE/MEETING_ACTION/AI_SUGGESTED), project_id, linked_entity_type/id, assignee_id, priority (LOW…URGENT), status (TODO/IN_PROGRESS/BLOCKED/DONE/DONE_AUTO/CANCELLED), due_date, completed_at, recurrence, blocked_reason, tags`.
- **meetings** (1) — `title, project_id, organizer_id, location, starts_at, ends_at, agenda, status (SCHEDULED…), minutes, google_event_id, recurrence`.
- **meeting_action_items** — action items from meetings (assignee, due, status).
- **notifications** (124) — `user_id, event_id, channel (IN_APP/EMAIL), severity (INFO/ACTION_REQUIRED/CRITICAL), title, body, link, status (PENDING/READ), read_at, actioned_at`.

## 3. Services (logic today)

- **taskService** — task CRUD, status transitions, recurrence, auto-tasks from rules.
- **meetingService** — meetings + minutes + action items, Google sync.
- **notificationService** — alert delivery, read/actioned state, preferences.
- **eventService** — domain events that drive auto-tasks + notifications.
- **kpiService / reportingService** — dashboard KPIs.

## 4. Gap analysis (build targets)

| # | Capability | Status today |
|---|-----------|--------------|
| 1 | **Task Analytics** (status/priority/origin, overdue, throughput) | ❌ none |
| 2 | **Team Workload** (load by assignee, overdue) | 🟡 heat strip only |
| 3 | **Meeting Analytics & Action Items** (overdue actions) | ❌ none |
| 4 | **Notifications & Alerts Analytics** (severity/channel, unread/actioned) | ❌ none |
| 5 | **Unified Calendar** (tasks + meetings + leave + PPM) | ❌ none |
| 6 | **Activity Timeline** (recent cross-module activity) | ❌ none |
| 7 | **Workspace Hub** | ❌ none |

**Reuse, don't rebuild:** My Day, the task board and the notification inbox are
mature — this program is **analytics + a unified workspace landing**.
