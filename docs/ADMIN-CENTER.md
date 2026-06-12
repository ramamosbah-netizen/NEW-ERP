# JEET ERP — Administration Center

The Administration Center (`/admin`) is the no-code configuration platform for the entire ERP.
Administrators control workflows, approvals, numbering, forms, document templates, business
rules, users, permissions and sessions — without modifying source code.

## One-time setup

The Process Platform requires one database migration:

1. Open the **Supabase dashboard → SQL Editor**.
2. Paste the contents of `supabase/migrations/20260612090000_admin_platform_engine.sql`.
3. Run it.
4. Verify: `node scripts/verify-platform.mjs`

The migration is idempotent (safe to run twice) and seeds 14 default numbering rules plus an
example Purchase Order approval workflow.

Optionally also run `supabase/migrations/20260612130000_seed_default_workflows.sql` to seed
ready-made workflows for QTN (quotations), VO, GRN, INV (client invoices), TND (tenders),
SERVICE_REQ (tickets), PRJ (projects) and LEAVE — each editable in the Workflow Builder.

The WorkflowPanel is already wired into these detail pages: Purchase Orders, Quotations,
Variation Orders, Goods Receipts, Client Invoices, Tenders, Service Desk tickets and Projects.
As soon as a module has an active workflow, the panel appears on its detail page automatically.

---

## Areas

### 1. Users, Roles & Permissions (`/admin/settings` → Users & Roles)
- Create / edit / delete users (server-side via `/api/admin/users`, admin-only).
- Assign multiple RBAC roles per user; legacy `profiles.role` stays in sync.
- Per-role permission matrix with scopes: `ALL` / `TEAM` / `ASSIGNED` / `OWN`.
- Per-user effective-permission auditor.

### 2. Sessions & Account Access (`/admin/settings` → Sessions)
- Last sign-in, confirmation and ban status for every account.
- **Force sign-out** (revokes refresh tokens), **ban / unban** accounts.
- All actions audit-logged; self-ban prevented.

### 3. Workflow Builder (`/admin/workflows`)
- One workflow per module (only one **active** at a time; clone to make a new version).
- **Statuses**: label, key, color, initial/terminal flags, ordering. Unlimited custom statuses.
- **Transitions**: from→to, action button label, allowed roles, **approval matrix**
  (single / sequential / parallel with minimum-N), conditions (field/operator/value),
  SLA hours and escalation.
- The pipeline diagram renders automatically; click nodes/edges to edit.

How modules consume it — drop the panel into any detail page:

```tsx
import WorkflowPanel from '@/components/workflow/WorkflowPanel';

<WorkflowPanel
  moduleKey="PO"
  entityId={po.id}
  context={{ total: Number(po.total), supplier_name: po.supplier_name }}
  onStatusChange={() => refetch()}
/>
```

The panel renders nothing when no workflow is configured, so it is always safe
to include. It shows the current status chip, SLA deadline, approval progress,
action buttons (with comment + confirm), and the full history timeline.
The PO detail page (`/procurement/po/[id]`) is the reference implementation.

For custom UI, use the hook or service directly:

```ts
import useWorkflow from '@/hooks/useWorkflow';
const wf = useWorkflow('PO', poId, { total: po.total });
// wf.status, wf.transitions, wf.execute(id, comment), wf.history, wf.slaOverdue

import workflowService from '@/services/workflowService';
await workflowService.startInstance('PO', poId);
await workflowService.executeTransition('PO', poId, transitionId, { comment, context });
```

**Process analytics** appear automatically in the designer for active workflows:
volume by status, in-flight vs completed, SLA-overdue count, average completion time.

### 4. Business Rules (`/admin/rules`)
IF/THEN rules evaluated at trigger points (`ON_CREATE`, `ON_SUBMIT`, …):

> IF `total > 100000` THEN **Require approval: General Manager**
> IF `supplier_status = NEW` THEN **Notify: Finance Manager**
> IF `category = CRITICAL` THEN **Escalate after 24h**

```ts
import rulesService from '@/services/rulesService';

const { blocked, reason, actions } = await rulesService.evaluate('PO', 'ON_SUBMIT', record);
if (blocked) throw new Error(reason);
```

### 5. Document Numbering (`/admin/numbering`)
- Format: prefix + year + month + padded sequence (e.g. `MAR-2026-0001`).
- Reset yearly / monthly / never. Live preview while editing.
- Generation is **atomic** via the `generate_document_number()` RPC (row-locked, race-safe).

```ts
import numberingService from '@/services/numberingService';
const docNo = await numberingService.generateNumber('MAR'); // 'MAR-2026-0001'
```

`poNumberService` already consumes configured rules and falls back to the legacy
sequence tables when none exist — fully backward compatible.

### 6. Forms Builder (`/admin/forms`)
- Schema: tabs → sections (1–3 columns) → fields.
- 15 field types: text, textarea, number, currency, date, time, dropdown, multi-select,
  checkbox, radio, file, image, signature, table, rich text.
- Required / hidden / read-only flags, validation (min/max/pattern), default values,
  **conditional visibility** (show field X when field Y matches a condition).
- Live preview panel; activate one form per module.

Modules render the configured form with one component:

```tsx
import DynamicForm from '@/components/forms/DynamicForm';

<DynamicForm
  moduleKey="MAR"
  initialValues={record}
  onSubmit={async (values) => save(values)}
  onNoForm={() => setUseBuiltinForm(true)}   // fall back when nothing configured
/>
```

It renders tabs, sections, all 15 field types, applies conditional visibility
live, validates on submit (jumping to the first tab with an error), and
returns the values map. Lower-level helpers:

```ts
import formBuilderService from '@/services/formBuilderService';
const form = await formBuilderService.getActiveForm('MAR');
const errors = formBuilderService.validate(form.schema, values);
```

### 7. Document Templates (`/admin/templates`)
- Header (logo / title / subtitle / QR), HTML body with `{{Variables}}`, footer,
  watermark, signature blocks. Paper size + orientation.
- Live preview with sample data; test print opens a print-ready window.
- Company branding (name, TRN, logo) resolves automatically from company settings.

```ts
import templateService from '@/services/templateService';
await templateService.print('MAR', { DocumentNo: docNo, ProjectName: project.name, ... });
```

Built-in variables: `CompanyName`, `CompanyAddress`, `CompanyPhone`, `CompanyEmail`,
`CompanyTRN`, `Date` — plus anything you pass in the variables map.

### 8. Global Settings (`/admin/settings`)
Company profile & branding, module toggles, finance & VAT, procurement thresholds,
inventory & asset lives, project stages, maintenance SLA, HR, notifications,
PDF branding, integrations, security (session timeout), backup.

### 9. Audit Log (`/admin/audit`)
Every platform change (workflows, rules, numbering, templates, users, sessions,
settings) writes a forensic entry: actor, action, before/after, timestamp.

---

## Database objects

| Table | Purpose |
|---|---|
| `workflow_definitions` | One row per workflow version per module |
| `workflow_statuses` | Pipeline statuses (nodes) |
| `workflow_transitions` | Actions between statuses (edges) with approval/conditions/SLA |
| `workflow_instances` | Runtime state per record: current status, history, pending approvals |
| `business_rules` | IF/THEN rules per module/trigger |
| `numbering_rules` | Numbering formats + sequences |
| `form_definitions` | Form schemas (tabs/sections/fields jsonb) |
| `document_templates` | Print template content jsonb |
| `notification_rules` | (pre-existing) notifications system config — event type, recipients, channels, escalation. Workflow transitions additionally carry their own notification config in `workflow_transitions.notifications` |

RLS: every config table is readable by all authenticated users (modules must read
configuration) and writable only by active admins (`is_erp_admin()`).

## Architecture

```
src/types/platform.types.ts     ← all platform types + MODULE_CATALOG
src/lib/workflow/engine.ts      ← pure evaluation core (no I/O, testable)
src/services/workflowService.ts ← definition CRUD + runtime instances + analytics
src/services/rulesService.ts    ← rule CRUD + evaluate()
src/services/numberingService.ts← rule CRUD + atomic generateNumber()
src/services/formBuilderService.ts ← schema CRUD + validate()/visibility
src/services/templateService.ts ← template CRUD + renderToHtml()/print()
src/app/admin/*                 ← Admin Center UI pages
```
