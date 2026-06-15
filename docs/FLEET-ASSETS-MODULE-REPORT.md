# JEET ERP — Fleet & Assets Module — Current-State Report

A review of what exists today across the **Fleet** and **Fixed Assets** areas, the
data model behind them, and the gaps an enterprise layer should close. Written
before any new code so the roadmap is grounded in the live schema.

---

## 1. What exists today

### Fleet
| Page | Route | Purpose |
|------|-------|---------|
| Fleet Registry | `/fleet` | Vehicle list + KPIs (status, fines, fuel, maintenance) |
| Vehicle Detail | `/fleet/[id]` | Full vehicle record: assignments, fuel, fines, maintenance, docs |
| Traffic Fines | `/fleet/fines` | Fines register with driver-liability resolution |

### Fixed Assets
| Page | Route | Purpose |
|------|-------|---------|
| Fixed Assets | `/assets` | Asset register + KPIs (cost, NBV, status) |
| Asset Detail | `/assets/[id]` | Acquisition, depreciation schedule, custody, disposal |
| Depreciation | `/assets/depreciation` | Monthly straight-line depreciation run + journal |

### Services & types (already built, solid)
`vehicleService`, `fuelService`, `fineService`, `vehicleValidation` ·
`fixedAssetService`, `depreciationService`, `disposalService` · `toolService`.
Types: `fleet.types.ts`, `asset.types.ts`, `tool.types.ts`.

---

## 2. Data model (probed against live DB)

All tables exist and are currently **empty** (pre-data), so new pages must degrade
gracefully to empty states — the same pattern used across every prior module.

- **`vehicles`** — `vehicle_code, plate_number, plate_emirate, make, model, year,
  vehicle_type (PICKUP/VAN/CAR/TRUCK/BUS/LIFT_MACHINE), ownership (OWNED/LEASED/RENTED),
  status (ACTIVE/IN_WORKSHOP/OFF_ROAD/SOLD/DISPOSED), purchase_cost, odometer_km,
  registration_expiry, insurance_expiry, insurance_company, salik_*, assigned_driver_id,
  assigned_department, fixed_asset_id`.
- **`fuel_logs`** — `log_date, odometer_km, litres, amount, fuel_type, station,
  driver_id, project_id, efficiency_km_l, is_anomaly`.
- **`vehicle_fines`** — `fine_number, fine_date, location, violation_type, amount,
  black_points, source, driver_id, status (UNPAID/PAID/DISPUTED/TRANSFERRED_TO_DRIVER),
  paid_date, paid_by`.
- **`vehicle_maintenance`** — `type (SERVICE/REPAIR/TYRE/BATTERY/ACCIDENT/INSPECTION),
  service_date, odometer_km, vendor, cost, next_service_date, downtime_days,
  status (SCHEDULED/IN_PROGRESS/COMPLETED)`.
- **`vehicle_assignments`** — driver↔vehicle handovers with odometer + project.
- **`fixed_assets`** — `asset_number, name, category (VEHICLE/IT_EQUIPMENT/
  TOOLS_INSTRUMENTS/OFFICE_FURNITURE/SITE_EQUIPMENT/SOFTWARE/OTHER), acquisition_cost,
  salvage_value, useful_life_months, accumulated_depreciation, net_book_value,
  status (ACTIVE/FULLY_DEPRECIATED/DISPOSED/WRITTEN_OFF), custodian_id, location`.
- **`depreciation_schedule`** — period rows: `opening_nbv, depreciation_amount,
  closing_nbv, accumulated, posted`.
- **`asset_disposals`** — `disposal_date, method (SALE/SCRAP/TRADE_IN/LOST), proceeds,
  nbv_at_disposal, gain_loss, buyer`.
- **`tools`** — `tool_number, name, category, status (AVAILABLE/ISSUED/UNDER_MAINTENANCE/
  UNDER_CALIBRATION/LOST/RETIRED), condition (GOOD/FAIR/NEEDS_REPAIR), requires_calibration,
  next_calibration_due, current_custodian_id, purchase_cost`.
- **`tool_assignments`**, **`tool_maintenance`** — issue/return + calibration history.

---

## 3. Gaps an enterprise layer should close

1. **No fleet command center** — KPIs live only inside the registry; there's no
   roll-up across fuel, fines, maintenance and compliance.
2. **Compliance is invisible** — `registration_expiry` and `insurance_expiry` are
   stored per vehicle but **nothing surfaces what's expiring** (a real UAE risk:
   driving on expired registration/insurance carries fines and impound).
3. **Fuel has no analytics** — litres, cost, `efficiency_km_l` and `is_anomaly` are
   captured but never trended; no cost-per-km, no anomaly board, no station spend.
4. **Fines are a flat list** — no analytics on unpaid exposure, driver liability,
   black-point accumulation, or violation hot-spots.
5. **Maintenance & downtime untracked** — cost and `downtime_days` exist but there's
   no availability/uptime view or "service due soon" radar.
6. **No Total Cost of Ownership** — purchase + fuel + fines + maintenance per vehicle
   is the single most useful fleet metric and is not computed anywhere.
7. **Fixed-asset analytics thin** — register + per-asset depreciation exist, but no
   portfolio dashboard (NBV vs cost, category mix, depreciation curve, disposal P&L).
8. **Tools register has services & types but NO UI** — `toolService`/`tool.types` are
   fully built; there is no page to view tools, custody, or **calibration due** (a
   compliance gap for test instruments that must be calibrated).

---

## 4. Constraints honoured

- **No existing business logic changes.** Every new page is additive, read-only
  analytics over the existing tables/services.
- **No migrations required** — all tables already exist.
- New pages follow the house pattern: `PageHeader`/`Card`/`Button`/`EmptyState` +
  Recharts, batched separate-lookup queries, PDF + Excel export, light theme.
- Routes nest under the existing `/fleet`, `/assets`, plus a new `/tools` area;
  gated for the **Fleet Coordinator** role (workspace always available).
