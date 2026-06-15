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
| 3 | **Daily Site Report (DSR)** | ✅ **DONE** | `daily_site_reports`; manpower-by-trade, weather, work/materials/equipment/delays/safety/visitors, photo upload, draft→submit, PDF; `/projects/daily-reports` |
| 4 | **Resource / Manpower planning** | 🟡 PM/site-engineer fields + payroll-by-project | Allocations table + utilization view across projects |
| 5 | **Risk register** | ❌ new | Per-project risks (likelihood × impact, mitigation, owner, status) |
| 6 | **Project Executive Dashboard** | 🟡 finance side exists | Portfolio health: schedule + cost + margin + risk + handover readiness |
| 7 | **Snag / QA-QC** | 🟢 snagService + workflow + export | Surface a dedicated board + analytics (extend, not rebuild) |
| 8 | **Handover & DLP** | 🟢 handoverService + gates + cert | Add DLP defect tracking + warranty expiry reminders |
| 9 | **Fixes / polish** | — | Audit embed 400s, add audit logging + exports to project write paths |

**Reuse, don't rebuild:** snags (#7) and handover (#8) already exist — extend/surface
them. Resource planning (#4) builds on the existing payroll-by-project allocation.

## Build order (full 12-module program)

1. ✅ **Daily Site Report (DSR)** — table + capture + list + photo upload + PDF.
2. ✅ **WBS (Work Breakdown Structure)** — hierarchical work packages, budget/weight, rolled-up progress, seed-from-systems. `/projects/wbs`.
3. ✅ **Schedule / Gantt** — Gantt timeline over WBS (planned dates + progress, today line, overdue). `/projects/schedule`.
4. ✅ **Progress & EVM** — PV/EV/AC + SPI/CPI/EAC/VAC over WBS + actuals, chart + per-WBS table + PDF/Excel. `/projects/evm`.
5. ✅ **Resource Planning** — manpower/equipment/subcontractor allocations, planned cost, cross-project utilization/double-booking, chart + PDF/Excel. `/projects/resources`.
6. ✅ **Risk Register** — 5×5 likelihood×impact heat map, rating, mitigation, owner, status, PDF/Excel. `/projects/risks`.
7. ✅ **Project Executive Dashboard** — batched portfolio rollup: contract/billed/collected/committed + projected margin, WBS progress, open-risk exposure, charts, drill-through, PDF/Excel. `/projects/dashboard`.
8. ✅ **Testing & Commissioning** — existing `/tc` module surfaced in the Projects nav; extended the Executive Dashboard with a T&C-readiness rollup (packages done/total + avg completion per project, portfolio KPI + column + export).
9. ✅ **DLP & Warranty Tracking** — warranty register (DLP/manufacturer/supplier, auto expiry status + reminders) + DLP-period defect tracker (severity/status/assignee, auto DEF-### ref), tabs, KPIs, PDF/Excel. `/projects/dlp`.
10. **RFI / SI / NCR** — Requests for Information, Site Instructions, Non-Conformance Reports. ← next
11. **Snag Analytics & QA Dashboard** — surface existing snags + analytics.
12. **Audit & Export Polish** — embed-400 audit, audit logging, PDF/Excel/CSV across project pages.

Each module ships: migration, types, service, hook(s), dashboard + list + detail,
filters/search, export (PDF/Excel/CSV via the shared `finance-export` helper),
Recharts, nav + project-detail tab where relevant, RBAC (existing roles), audit
logging, and docs.

## Status
- ✅ **Module report** + roadmap.
- ✅ **Phase 1 — Daily Site Report (DSR)**.
- ⏭ Next: **Progress & Earned Value (EVM)** — say "proceed".
