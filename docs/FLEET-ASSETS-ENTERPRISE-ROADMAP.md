# JEET ERP — Fleet & Assets — Enterprise Roadmap

Twelve additive analytics surfaces layered on the existing Fleet and Fixed-Assets
modules. Every phase is **read-only over existing tables** (no migrations, no logic
changes), uses the house UI kit + Recharts, and exports to PDF + Excel. One git
commit per page.

---

## Phases

| # | Page | Route | Answers |
|---|------|-------|---------|
| 1 | **Fleet & Assets Hub** | `/fleet/hub` | "What's the state of my fleet & assets right now?" |
| 2 | **Fleet Dashboard** | `/fleet/dashboard` | Vehicles by status / type / ownership / emirate; fleet value & odometer |
| 3 | **Vehicle Compliance Tracker** | `/fleet/compliance` | Registration & insurance expiring/expired — impound risk |
| 4 | **Fuel Analytics** | `/fleet/fuel-analytics` | Spend, litres, efficiency (km/l), anomalies, cost/km, station spend |
| 5 | **Traffic Fines Analytics** | `/fleet/fines-analytics` | Unpaid exposure, driver liability, black points, violation hot-spots |
| 6 | **Maintenance & Downtime** | `/fleet/maintenance` | Cost by type, downtime days, availability, service-due radar |
| 7 | **Total Cost of Ownership** | `/fleet/tco` | Purchase + fuel + fines + maintenance per vehicle; cost/km |
| 8 | **Fixed Asset Dashboard** | `/assets/dashboard` | NBV vs cost, category mix, depreciation %, status |
| 9 | **Depreciation Forecast** | `/assets/depreciation-forecast` | Projected monthly depreciation & NBV run-off |
| 10 | **Disposals & Gain/Loss** | `/assets/disposals` | Disposal P&L, method mix, proceeds vs NBV |
| 11 | **Tools & Equipment Register** | `/tools` | Tool inventory by category/status/condition/custody (fills missing UI) |
| 12 | **Calibration Tracker** | `/tools/calibration` | Instruments due / overdue for calibration |

---

## Cross-cutting

- **Compliance focus** — phases 3 and 12 mirror the HR certification tracker:
  expiring-soon (≤30/≤60d) and expired buckets with colour-coded urgency. These are
  the highest-value additions because they prevent fines, impound and audit findings.
- **TCO (phase 7)** is the analytical centrepiece — it joins four cost streams per
  vehicle into a single comparable cost-per-kilometre.
- **Exports** — every analytics page exposes PDF + Excel via `finance-export`.
- **Empty-safe** — all tables are currently empty; each page renders a clean
  `EmptyState` until data arrives.
- **RBAC** — `/fleet/*`, `/assets/*` and `/tools/*` are reachable by the
  **Fleet Coordinator** role (plus unrestricted admin/manager/engineer); the
  universal workspace remains available to every role.

---

## Out of scope (future)

- Telematics / GPS live tracking integration.
- Salik/fuel-card API auto-reconciliation.
- Automated insurance-renewal workflow with reminders to drivers.
- Asset barcode/QR check-in-out for tools.
