-- ============================================================
-- JEET ERP — Pre-Sales: CRM fields on clients
-- Extends the minimal clients table with light CRM attributes so
-- the new Client Directory & 360 can segment and track accounts.
-- Additive only; existing data and policies are untouched.
-- ============================================================

alter table public.clients
  add column if not exists segment text,                 -- ENTERPRISE | SME | GOVERNMENT | DEVELOPER | ...
  add column if not exists industry text,
  add column if not exists owner_name text,              -- account owner / sales rep
  add column if not exists status text default 'ACTIVE', -- LEAD | PROSPECT | ACTIVE | INACTIVE
  add column if not exists website text,
  add column if not exists trn text,                     -- UAE tax registration number
  add column if not exists notes text;

NOTIFY pgrst, 'reload schema';
