-- ============================================================
-- Aura ERP — Workflow override (admin "break-glass") — ENFORCED + AUDITED
-- ------------------------------------------------------------
-- Lets an admin unstick a workflow: reassign an approver, force a status,
-- cancel, or restart. This BYPASSES maker-checker/approvals, so it is the single
-- most fraud-sensitive action in the platform. It is therefore:
--   • capability-gated server-side (SECURITY DEFINER checks role_permissions
--     directly — self-contained, no dependency on the data-driven RBAC migration)
--   • reason-required
--   • recorded in the instance history (the app also writes an audit_log row)
-- Idempotent.
-- ============================================================

-- 1) The override capability + grant to admin by default.
insert into public.permissions (permission_key, module, description) values
  ('workflow.override', 'SYSTEM', 'Break-glass: reassign/force/cancel/restart a workflow instance (bypasses approvals).')
on conflict (permission_key) do nothing;

insert into public.role_permissions (role_id, permission_id, scope)
select r.id, p.id, 'ALL'
  from public.roles r
  cross join public.permissions p
 where p.permission_key = 'workflow.override' and r.role_key = 'admin'
on conflict (role_id, permission_id) do nothing;

-- 2) The enforced override RPC.
create or replace function public.admin_workflow_override(
  p_instance_id uuid,
  p_action      text,                 -- REASSIGN | FORCE_STATUS | CANCEL | RESTART
  p_reason      text,
  p_to_status   text default null,    -- target status_key for FORCE_STATUS/CANCEL/RESTART
  p_old_value   text default null,    -- approver value to replace (REASSIGN)
  p_new_approver jsonb default null   -- {"type":"ROLE","value":"gm"} (REASSIGN)
) returns public.workflow_instances
language plpgsql
security definer
as $$
declare
  v_inst    public.workflow_instances;
  v_uid     uuid := auth.uid();
  v_name    text;
  v_entry   jsonb;
  v_pending jsonb;
begin
  -- capability gate (admin OR holds workflow.override via any of their roles)
  if not (
    public.is_erp_admin() or exists (
      select 1
        from public.role_permissions rp
        join public.permissions p on p.id = rp.permission_id
       where p.permission_key = 'workflow.override'
         and rp.role_id in (
           select ur.role_id from public.user_roles ur where ur.user_id = v_uid
           union
           select r.id from public.roles r join public.profiles pr on pr.id = v_uid where pr.role = r.role_key
         )
    )
  ) then
    raise exception 'workflow override requires the workflow.override capability'
      using errcode = '42501';
  end if;

  if p_reason is null or length(btrim(p_reason)) < 3 then
    raise exception 'an override reason is required';
  end if;

  select * into v_inst from public.workflow_instances where id = p_instance_id for update;
  if not found then raise exception 'workflow instance % not found', p_instance_id; end if;

  select full_name into v_name from public.profiles where id = v_uid;

  v_entry := jsonb_build_object(
    'at', to_jsonb(now()), 'by', to_jsonb(v_uid), 'by_name', to_jsonb(coalesce(v_name, 'Admin')),
    'action', 'OVERRIDE_' || p_action,
    'from', to_jsonb(v_inst.current_status_key),
    'to', to_jsonb(coalesce(p_to_status, v_inst.current_status_key)),
    'comment', to_jsonb(p_reason)
  );

  if p_action in ('FORCE_STATUS', 'CANCEL', 'RESTART') then
    update public.workflow_instances
       set current_status_key = coalesce(p_to_status, current_status_key),
           pending_approvals  = '[]'::jsonb,
           history            = coalesce(history, '[]'::jsonb) || v_entry,
           sla_due_at         = null,
           updated_at         = now()
     where id = p_instance_id
     returning * into v_inst;

  elsif p_action = 'REASSIGN' then
    select jsonb_agg(
             case when elem->>'value' = p_old_value and p_new_approver is not null
                  then elem || jsonb_build_object('type', p_new_approver->'type', 'value', p_new_approver->'value', 'approved_by', 'null'::jsonb, 'approved_at', 'null'::jsonb)
                  else elem end
           )
      into v_pending
      from jsonb_array_elements(coalesce(v_inst.pending_approvals, '[]'::jsonb)) elem;

    update public.workflow_instances
       set pending_approvals = coalesce(v_pending, pending_approvals),
           history           = coalesce(history, '[]'::jsonb) || v_entry,
           updated_at        = now()
     where id = p_instance_id
     returning * into v_inst;

  else
    raise exception 'unknown override action: %', p_action;
  end if;

  return v_inst;
end $$;

NOTIFY pgrst, 'reload schema';
