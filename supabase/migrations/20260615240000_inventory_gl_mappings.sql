-- ============================================================
-- JEET ERP — Warehouse: Inventory GL Integration
-- Maps each stock movement type to a debit/credit GL account so the
-- accounting team can post inventory, WIP and COGS journals from the
-- movement ledger. Collaborative RLS (matches the rest of the app).
-- ============================================================

create table if not exists public.inventory_gl_mappings (
  id uuid primary key default gen_random_uuid(),
  transaction_type text not null unique,               -- matches stock_transactions.type
  debit_account_code text,
  debit_account_name text,
  credit_account_code text,
  credit_account_name text,
  updated_at timestamptz not null default now()
);

alter table public.inventory_gl_mappings enable row level security;

drop policy if exists "inventory_gl_mappings_all" on public.inventory_gl_mappings;
create policy "inventory_gl_mappings_all" on public.inventory_gl_mappings for all using (true) with check (true);

-- Seed sensible defaults for a UAE ELV/MEP contractor (idempotent).
insert into public.inventory_gl_mappings (transaction_type, debit_account_code, debit_account_name, credit_account_code, credit_account_name) values
  ('GRN_RECEIPT',       '1300', 'Inventory',                 '2100', 'GRNI Accrual'),
  ('ISSUE_TO_PROJECT',  '1400', 'WIP - Project Materials',   '1300', 'Inventory'),
  ('ISSUE_TO_TICKET',   '5100', 'Service COGS',              '1300', 'Inventory'),
  ('RETURN_FROM_SITE',  '1300', 'Inventory',                 '1400', 'WIP - Project Materials'),
  ('RETURN_TO_SUPPLIER','2100', 'GRNI Accrual',              '1300', 'Inventory'),
  ('TRANSFER_OUT',      '1300', 'Inventory',                 '1300', 'Inventory'),
  ('TRANSFER_IN',       '1300', 'Inventory',                 '1300', 'Inventory'),
  ('ADJUSTMENT_IN',     '1300', 'Inventory',                 '4900', 'Inventory Gain'),
  ('ADJUSTMENT_OUT',    '5900', 'Inventory Loss',            '1300', 'Inventory'),
  ('WRITE_OFF',         '5910', 'Inventory Write-off',       '1300', 'Inventory')
on conflict (transaction_type) do nothing;

NOTIFY pgrst, 'reload schema';
