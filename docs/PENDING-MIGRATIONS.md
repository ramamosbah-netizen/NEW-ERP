# JEET ERP — Pending Migrations (apply in order)

These are the migrations added by the enterprise programs that still need to be
applied in the Supabase SQL editor. Run them **top to bottom**. All are
idempotent (`create table if not exists`, `add column if not exists`,
`drop policy if exists`), so re-running is safe. Each ends with
`NOTIFY pgrst, 'reload schema';` so PostgREST picks up the change immediately.

| # | File | Module | Adds |
|---|------|--------|------|
| 1 | `20260615120000_daily_site_reports.sql` | Projects | `daily_site_reports` |
| 2 | `20260615140000_project_wbs.sql` | Projects | `project_wbs` |
| 3 | `20260615160000_project_resource_allocations.sql` | Projects | `project_resource_allocations` |
| 4 | `20260615180000_project_risks.sql` | Projects | `project_risks` |
| 5 | `20260615200000_project_warranties_dlp.sql` | Projects | `project_warranties` + `project_dlp_defects` |
| 6 | `20260615220000_project_site_records.sql` | Projects | `project_site_records` (RFI/SI/NCR) |
| 7 | `20260615240000_inventory_gl_mappings.sql` | Warehouse | `inventory_gl_mappings` |
| 8 | `20260615260000_clients_crm_fields.sql` | Pre-Sales | CRM columns on `clients` |
| 9 | `20260615280000_competitor_tracking.sql` | Pre-Sales | `competitors` + `tender_competitors` |

> AMC & Service required **no** migrations.
> The full verbatim SQL for each file lives in `supabase/migrations/`. They can be
> pasted individually, or all at once (they are independent except #9 references
> `tenders`, which already exists).
