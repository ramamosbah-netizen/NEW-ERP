-- ============================================================
-- Aura ERP — DATA-DRIVEN RBAC foundation (behavior-preserving)
-- ------------------------------------------------------------
-- Today the RLS gates (is_finance / is_hr) hardcode role keys, so a role
-- created from the Admin UI is invisible to real security. This migration makes
-- the gates ALSO read the existing role_permissions catalogue, via a
-- once-per-query capability resolver — WITHOUT changing any current access.
--
-- Strategy (additive, zero behavior change):
--   • add coarse capability permissions (finance.write, hr.manage)
--   • grant them to exactly the roles that already have that access today
--   • is_finance/is_hr = is_erp_admin() OR has_capability(...) OR <legacy role list>
-- So nothing loses access (legacy clause intact), but a NEW role granted the
-- capability now works in RLS with no code change. Once every role carries
-- capabilities, the legacy has_any_role(...) clause can be removed.
--
-- Idempotent. Apply, then re-run scripts/security-audit.mjs:
--   expect the existing matrix UNCHANGED (22/22) + the data-driven test PASS.
-- ============================================================

-- 1) Coarse capability permissions used by the RLS gates.
insert into public.permissions (permission_key, module, description) values
  ('finance.write', 'FINANCE', 'RLS gate: create/modify finance records (AR/AP/treasury/budgets/retention/expenses).'),
  ('hr.manage',     'HR',      'RLS gate: read & write payroll and employee compensation.')
on conflict (permission_key) do nothing;

-- 2) Grant the capabilities to the roles that already have this access today,
--    so the capability path mirrors the legacy role-key path exactly.
insert into public.role_permissions (role_id, permission_id, scope)
select r.id, p.id, 'ALL'
  from public.roles r
  cross join public.permissions p
 where p.permission_key = 'finance.write'
   and r.role_key in ('admin','gm','account','accountant','finance_manager','commercial_mgr')
on conflict (role_id, permission_id) do nothing;

insert into public.role_permissions (role_id, permission_id, scope)
select r.id, p.id, 'ALL'
  from public.roles r
  cross join public.permissions p
 where p.permission_key = 'hr.manage'
   and r.role_key in ('admin','gm','hr','hr_manager')
on conflict (role_id, permission_id) do nothing;

-- 3) Capability resolver — all permission_keys for the caller, from BOTH
--    user_roles AND the legacy profiles.role (matched to roles.role_key).
--    STABLE so it evaluates once per query (not per row); SECURITY DEFINER so it
--    can read the RBAC tables regardless of their RLS.
create or replace function public.auth_capabilities()
returns text[]
language sql
security definer
stable
as $$
  select coalesce(array_agg(distinct p.permission_key), '{}')
    from public.role_permissions rp
    join public.permissions p on p.id = rp.permission_id
    join public.roles r on r.id = rp.role_id and r.is_active = true
   where rp.role_id in (
     select ur.role_id from public.user_roles ur where ur.user_id = auth.uid()
     union
     select r2.id from public.roles r2
       join public.profiles pr on pr.id = auth.uid()
      where pr.role = r2.role_key
   );
$$;

create or replace function public.has_capability(p_key text)
returns boolean
language sql
security definer
stable
as $$
  select p_key = any (public.auth_capabilities());
$$;

-- 4) Rewrite the gates: capability OR legacy role list (admin always passes).
--    ADDITIVE — preserves all current access; enables data-driven roles.
create or replace function public.is_finance()
returns boolean language sql security definer stable as $$
  select public.is_erp_admin()
      or public.has_capability('finance.write')
      or public.has_any_role('gm','account','accountant','finance_manager','commercial_mgr');
$$;

create or replace function public.is_hr()
returns boolean language sql security definer stable as $$
  select public.is_erp_admin()
      or public.has_capability('hr.manage')
      or public.has_any_role('gm','hr','hr_manager');
$$;

NOTIFY pgrst, 'reload schema';
