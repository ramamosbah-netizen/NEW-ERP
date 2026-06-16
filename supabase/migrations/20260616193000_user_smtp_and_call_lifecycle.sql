-- ---------- User SMTP Configurations ----------
create table if not exists public.user_smtp_configs (
  user_id uuid references public.profiles(id) on delete cascade primary key,
  host text not null,
  port integer not null default 587,
  username text not null,
  password text not null, -- Stores SMTP password
  sender_email text not null,
  updated_at timestamptz not null default now()
);

-- Enable RLS
alter table public.user_smtp_configs enable row level security;

-- RLS Policy: Only profiles with role = 'admin' can select/insert/update/delete
create policy admin_all_smtp_configs on public.user_smtp_configs
  for all to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- Enable Realtime for the table
alter publication supabase_realtime add table public.user_smtp_configs;

notify pgrst, 'reload schema';
