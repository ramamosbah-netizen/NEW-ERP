# JEET ERP — Communication & Collaboration Module — Completion Report

A complete, self-contained communication suite built **additively** — no existing
module or business logic was changed. Realtime is powered by **Supabase Realtime**;
UI follows the JEET design tokens (Card/PageHeader/Button + `var(--surface)` etc.).

---

## 1. Delivered

| Area | Route | What it does |
|------|-------|--------------|
| **Messenger** | `/comms` | 1:1 DMs, group chats, department channels and project rooms in one realtime client |
| **Announcements** | `/comms/announcements` | Company broadcasts (all / department / role), priority + pin, per-user read state |
| **Notifications Center** | `/comms/notifications` | In-app feed + per-channel delivery matrix (in-app / email / WhatsApp / push) |
| **Shared Documents** | `/comms/documents` | Versioned file sharing with comments and download |
| **Settings (admin)** | `/comms/admin` | Channels management, integration status, per-user SMTP, posting permissions |

### Messenger capabilities
- **1-to-1 private chat**, **group chats**, **department channels**
  (`#finance #procurement #warehouse #projects #service-desk #hr #management`,
  seeded by the migration) and **project chat rooms**.
- **Realtime** message delivery via `supabase.channel().on('postgres_changes')`
  (insert/update on `messages`, plus reaction changes); inbox auto-refreshes.
- **Reactions** (emoji, toggle), **@mentions** (autocomplete + highlight +
  mention notifications), **threads** (reply counts), **read receipts**
  (`last_read_at` + `message_reads`), **file attachments** (Supabase Storage),
  **message search** across all the user's conversations.
- **Voice & video calls / meetings** — embedded **Jitsi Meet** rooms launched from
  any conversation; calls are recorded in `comm_calls` with a start/end lifecycle.

### Notifications
- In-app feed (`comm_notifications`) with mention/announcement/call/document types.
- A **delivery-preference matrix**: each event type × channel
  (in-app, email, WhatsApp, push) toggled per user (`comm_notification_prefs`).
- Email (Outlook / Gmail / SMTP), WhatsApp Business and push surface their
  configuration status; in-app is always on.

### Document sharing
- Upload → `shared_documents`; every upload creates a `document_versions` row
  (full version history with notes + uploader), and threaded `document_comments`.

---

## 2. Data model (migration `20260616190000_communication_module.sql`)

`conversations` · `conversation_members` · `messages` · `message_reactions` ·
`message_reads` · `announcements` · `announcement_reads` · `comm_calls` ·
`shared_documents` · `document_versions` · `document_comments` ·
`comm_notification_prefs` · `comm_notifications`.

Plus `20260616193000_user_smtp_and_call_lifecycle.sql` → `user_smtp_configs`
(admin-only RLS) for per-user outbound email.

- Idempotent (`create table if not exists`, guards), additive only.
- **RLS** enabled — collaborative (`using(true)`) for the chat tables (internal
  trusted team); `user_smtp_configs` is **admin-only** (`role = 'admin'`).
- **Realtime publication** adds `messages`, `conversations`, `conversation_members`,
  `message_reactions`, `comm_notifications`, `comm_calls`, `announcements`.
- Seeds the seven department channels; ends with `notify pgrst`.

> Apply both migrations in the Supabase SQL editor. Services **degrade gracefully**
> before that (PGRST205 → empty states), so the pages render without errors.

---

## 3. Services
`commsService` (conversations, messages, members, reactions, reads, search,
realtime subscribe/inbox, calls, per-user SMTP) · `announcementService` ·
`commNotificationService` (feed + prefs) · `commDocsService` (upload/version/comment).

---

## 4. Integration & RBAC
- **Sidebar** — new **Communications** group: Messenger, Announcements, Shared
  Documents, Notifications, Settings.
- **Route access** — `/comms` is in the universal workspace allowlist, so every
  role reaches it; `/comms/admin` and per-user SMTP are admin-gated in-page.
- **Email/WhatsApp/Push** — the framework, preferences and status are in place;
  activating outbound delivery requires the provider credentials (SMTP/OAuth,
  WhatsApp Business gateway, web-push key) — configured from the settings links.

---

## 5. Verification
- `npx tsc --noEmit --skipLibCheck` → **0 source errors**.
- All five `/comms/*` routes smoke-tested live → **200**.
- One commit per phase on `main`; no existing files' logic changed.
