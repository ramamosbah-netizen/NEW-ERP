# JEET ERP — Design System & UX Architecture

The single reference for the unified ERP UI. Goal: every page looks and behaves
the same — SAP/Odoo/Dynamics-grade consistency — by consuming one token set and
one component kit, in both light and dark mode.

---

## 1. Shell architecture (hub-based)

```
RootLayout (theme boot script)
└─ AppShell
   ├─ AppSidebar      → only the 11 business hubs (hubs.ts)
   ├─ AppTopbar       → breadcrumb · search (⌘K) · density · theme · profile
   ├─ HubHeader       → active hub title + header tabs (per hub)
   └─ <main>          → the page (uses PageHeader + DS components)
```

- **Sidebar = hubs only.** Source of truth: `src/components/layout/hubs.ts`
  (`HUBS`). Sub-pages are reached via the **HubHeader tabs**, not the sidebar.
- **Routes are unchanged.** Hubs are a navigation layer over existing pages;
  every deep link still resolves. The ⌘K command palette reaches any route.
- To add/move a page in the nav: edit `hubs.ts` only.

## 2. Theme

Two modes, driven by `body` classes, persisted in `localStorage['erp-theme']`
(`system | light | dark`) and applied before paint by the boot script in
`app/layout.tsx` (no flash). Toggle lives in the topbar.

- Light = `:root`. Dark = `@media (prefers-color-scheme: dark)` **and**
  `body.theme-dark` (manual). Light is forced with `:root.force-light`.
- **Never hard-code colors.** Use the tokens below so both themes work for free.

## 3. Tokens (`app/globals.css`)

| Group | Tokens |
|-------|--------|
| Surfaces | `--bg-dark`, `--bg-card`, `--bg-card-hover`, `--surface`, `--surface-hover`, `--surface-active` |
| Text | `--text-primary`, `--text-secondary`, `--text-muted` / `--text-tertiary` |
| Brand | `--primary`, `--primary-hover`, `--accent`, `--accent-glow` |
| Borders | `--border` / `--border-color`, `--border-focus` |
| Status | `--status-{neutral,success,warning,danger,info}-{bg,text,border}` |
| Spacing | `--space-1..12`, `--spacing-card-padding`, `--spacing-field-padding` |
| Radii | `--radius-sm/md/lg/xl/2xl/full` |
| Elevation | `--shadow-xs/sm/md/lg/xl` |
| Type | `--font-heading`, `--font-body`, `--font-mono` |
| Motion | `--transition-fast`, `--transition-smooth` |

## 4. Component kit (`@/components/ui`)

Import everything from the barrel: `import { PageHeader, Card, Button, DataTable, Tabs, Toolbar } from '@/components/ui';`

| Component | Use for |
|-----------|---------|
| `PageHeader` | Page title, breadcrumbs, reference id, status, actions — **top of every page** |
| `Card` | Surface container (padding, border, radius) |
| `KPICard` | Metric tiles in dashboard grids |
| `Button` | All actions. Variants: primary/secondary/muted/danger/success/warning |
| `DataTable` | Tabular data (sorting, empty state) |
| `Tabs` | In-page section switching (underline/pill) |
| `Toolbar`, `SearchInput`, `SelectFilter` | The filter/search/actions row above a table |
| `FormField` | Inputs (text/number/date/select/toggle/…) |
| `Modal`, `Drawer` | Dialogs / side panels |
| `StatusChip` | Status pills (maps status → color) |
| `EmptyState` | Empty / not-found states |

### Standard page skeleton

```tsx
import { PageHeader, Card, Toolbar, SearchInput, Button, DataTable } from '@/components/ui';

export default function Page() {
  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Purchase Orders" subtitle="…" actions={<Button variant="primary">New</Button>} />
      <Toolbar actions={<Button>Export</Button>}>
        <SearchInput placeholder="Search…" />
      </Toolbar>
      <Card padding={false}><DataTable columns={…} rows={…} /></Card>
    </div>
  );
}
```

## 5. Migration playbook (progressive rollout)

The kit + tokens already exist; the work is **replacing per-module CSS and
inline/custom styling with the kit**, one module at a time.

**Per page:**
1. Wrap with the standard skeleton; replace the page's custom header with `PageHeader`.
2. Replace ad-hoc tab bars with `Tabs`; filter rows with `Toolbar`.
3. Replace bespoke buttons/cards/tables/inputs with `Button`/`Card`/`DataTable`/`FormField`.
4. Swap hard-coded colors for tokens; delete now-dead rules from the module CSS.
5. Verify in **both** light and dark.

**CSS files to retire** (replace rules with tokens/kit, then delete the import):
`dashboard.css, hr.css, pricing.css, quotations.css, snags.css, tc.css,
tenders.css, timesheets.css, handover.css, comparisons.css, whatsapp.css,
boq.css, settings.css`. Keep `globals.css`, `layout.css`, `auth.css`.

**Rollout order** (highest traffic / worst inconsistency first):
1. ✅ Shell + tokens + kit (Phase 1–2 — done)
2. ✅ Global cleanup: fixed 418 invalid `text-[var(--text-primary)]0` color
   classes (a find/replace artifact that rendered with no color) across 44 files
   → `text-[var(--text-muted)]`. Finance hub page migrated to the standard
   skeleton (PageHeader + `flex flex-col gap-5`). (Phase 3 — started)
3. Finance · Procurement (remaining pages; retire "mint terminal" wrappers)
4. Projects · Sales
5. HR · Inventory · Fleet
6. Service · Comms · Admin
7. Detail/`[id]` pages and dialogs

Each module migration is additive and independently shippable; the shell and
deep links never change, so partial rollout is always in a working state.
