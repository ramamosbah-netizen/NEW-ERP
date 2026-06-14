# JEET ERP — Projects Module — Enterprise Roadmap & Gap Analysis

Mirrors the finance program: extend the Projects module with enterprise PM
capabilities **without breaking existing flows** (quotation→project, milestones→
AR billing, snags, handover, finance integration). New modules follow the
existing UI kit (`PageHeader`/`Card`/`Button` + Recharts) and the
separate-lookup data pattern (PostgREST embeds are unreliable here). Migrations
are applied manually in Supabase, then `NOTIFY pgrst, 'reload schema';`.

## Gap analysis (exists vs new)

| # | Capability | Status today | Plan |
|---|---|---|---|
| 1 | **Schedule / Gantt** | 🟡 flat milestone list (planned/actual dates) | Add task-level schedule with dependencies + a Gantt view; reuse milestones |
| 2 | **Progress & Earned Value (EVM)** | ❌ new | % complete per milestone/system → planned vs earned vs actual (PV/EV/AC, SPI/CPI) |
| 3 | **Daily Site Report (DSR)** | ❌ new | Manpower, weather, work done, materials, photos per day |
| 4 | **Resource / Manpower planning** | 🟡 PM/site-engineer fields + payroll-by-project | Allocations table + utilization view across projects |
| 5 | **Risk register** | ❌ new | Per-project risks (likelihood × impact, mitigation, owner, status) |
| 6 | **Project Executive Dashboard** | 🟡 finance side exists | Portfolio health: schedule + cost + margin + risk + handover readiness |
| 7 | **Snag / QA-QC** | 🟢 snagService + workflow + export | Surface a dedicated board + analytics (extend, not rebuild) |
| 8 | **Handover & DLP** | 🟢 handoverService + gates + cert | Add DLP defect tracking + warranty expiry reminders |
| 9 | **Fixes / polish** | — | Audit embed 400s, add audit logging + exports to project write paths |

**Reuse, don't rebuild:** snags (#7) and handover (#8) already exist — extend/surface
them. Resource planning (#4) builds on the existing payroll-by-project allocation.

## Build order (recommended)

1. **Daily Site Report (DSR)** — high daily-use value; new table + capture + list/PDF.
2. **Progress & EVM** — % complete → SPI/CPI; feeds the executive dashboard.
3. **Schedule / Gantt** — task schedule + dependencies + Gantt view.
4. **Risk register** — per-project risk matrix.
5. **Resource / Manpower planning** — allocations + utilization.
6. **Project Executive Dashboard** — portfolio schedule+cost+risk+handover health.
7. **Snag board + analytics** (surface existing) and **DLP/warranty tracking** (extend handover).
8. **Fixes/polish pass** — embed audit, audit logging, exports — folded in as we go.

Each module ships: migration, types, service, hook(s), dashboard + list + detail,
filters/search, export (PDF/Excel/CSV via the shared `finance-export` helper),
Recharts, nav + project-detail tab where relevant, RBAC (existing roles), audit
logging, and docs.

## Status
- ✅ **Module report** (`PROJECTS-MODULE-REPORT.md`) and this roadmap — done.
- ⏭ Next: **Daily Site Report (DSR)** — say "proceed".
