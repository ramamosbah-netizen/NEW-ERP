-- ============================================================
-- JEET ERP — Seed PO + Supplier-Invoice workflows
-- These two record pages already render <WorkflowPanel> but had no
-- workflow definition, so the panel was empty. Additive/idempotent.
-- ============================================================

create or replace function pg_temp.upsert_workflow(
  p_module text, p_name text, p_desc text, p_statuses jsonb, p_transitions jsonb
) returns void language plpgsql as $$
declare wf_id uuid; s jsonb; t jsonb; ids jsonb := '{}'::jsonb; i int := 0;
begin
  select id into wf_id from public.workflow_definitions where module_key = p_module;
  if wf_id is null then
    insert into public.workflow_definitions (module_key, name, description, is_active)
    values (p_module, p_name, p_desc, true) returning id into wf_id;
  else
    update public.workflow_definitions set name = p_name, description = p_desc, is_active = true, updated_at = now() where id = wf_id;
    delete from public.workflow_transitions where workflow_id = wf_id;
    delete from public.workflow_statuses where workflow_id = wf_id;
  end if;
  for s in select * from jsonb_array_elements(p_statuses) loop
    declare new_id uuid;
    begin
      insert into public.workflow_statuses (workflow_id, status_key, label, color, is_initial, is_terminal, sort_order)
      values (wf_id, s->>'key', s->>'label', coalesce(s->>'color','neutral'),
              coalesce((s->>'initial')::boolean,false), coalesce((s->>'terminal')::boolean,false), i)
      returning id into new_id;
      ids := ids || jsonb_build_object(s->>'key', new_id::text); i := i + 1;
    end;
  end loop;
  i := 0;
  for t in select * from jsonb_array_elements(p_transitions) loop
    insert into public.workflow_transitions
      (workflow_id, from_status_id, to_status_id, action_key, label, allowed_roles, approval, sla_hours, sort_order)
    values (wf_id, (ids->>(t->>'from'))::uuid, (ids->>(t->>'to'))::uuid, t->>'action', t->>'label',
            coalesce((select array_agg(x) from jsonb_array_elements_text(t->'roles') x), '{}'),
            jsonb_build_object('mode', coalesce(t->>'approval_mode','NONE'), 'approvers', coalesce(t->'approvers','[]'::jsonb), 'min_approvals', 1),
            (t->>'sla')::int, i);
    i := i + 1;
  end loop;
end; $$;

-- ---------- Purchase Order: Procurement draft → Manager/GM approval → send → receive → close ----------
select pg_temp.upsert_workflow(
  'PO', 'Purchase Order Approval', 'PO — drafted by procurement, approved (threshold-gated), sent, received and closed.',
  '[
    {"key":"DRAFT","label":"Draft","color":"neutral","initial":true},
    {"key":"PENDING_APPROVAL","label":"Pending Approval","color":"warning"},
    {"key":"APPROVED","label":"Approved","color":"success"},
    {"key":"SENT","label":"Sent to Supplier","color":"info"},
    {"key":"RECEIVING","label":"Receiving","color":"warning"},
    {"key":"CLOSED","label":"Closed","color":"neutral","terminal":true},
    {"key":"CANCELLED","label":"Cancelled","color":"danger","terminal":true}
  ]'::jsonb,
  '[
    {"from":"DRAFT","to":"PENDING_APPROVAL","action":"SUBMIT","label":"Submit for Approval","roles":["admin","procurement","manager"]},
    {"from":"DRAFT","to":"CANCELLED","action":"CANCEL","label":"Cancel","roles":["admin","procurement","manager"]},
    {"from":"PENDING_APPROVAL","to":"APPROVED","action":"APPROVE","label":"Approve","roles":["admin","manager","gm","procurement"],"approval_mode":"SINGLE","approvers":[{"type":"ROLE","value":"manager"}],"sla":48},
    {"from":"PENDING_APPROVAL","to":"DRAFT","action":"RETURN","label":"Return to Draft","roles":["admin","manager","gm"]},
    {"from":"PENDING_APPROVAL","to":"CANCELLED","action":"REJECT_CANCEL","label":"Reject & Cancel","roles":["admin","manager","gm"]},
    {"from":"APPROVED","to":"SENT","action":"SEND","label":"Send to Supplier","roles":["admin","procurement"]},
    {"from":"SENT","to":"RECEIVING","action":"RECEIVE","label":"Start Receiving","roles":["admin","procurement","storekeeper"]},
    {"from":"RECEIVING","to":"CLOSED","action":"CLOSE","label":"Close PO","roles":["admin","procurement","manager"]},
    {"from":"SENT","to":"CLOSED","action":"CLOSE_DIRECT","label":"Close","roles":["admin","procurement","manager"]}
  ]'::jsonb
);

-- ---------- Supplier Invoice: register → 3-way match → approve (Accountant) → pay ----------
select pg_temp.upsert_workflow(
  'SINV', 'Supplier Invoice Approval', 'AP supplier invoice — register, 3-way match, finance approval, payment.',
  '[
    {"key":"DRAFT","label":"Expected / Draft","color":"neutral","initial":true},
    {"key":"REGISTERED","label":"Registered (matched)","color":"warning"},
    {"key":"EXCEPTION","label":"Match Exception","color":"danger"},
    {"key":"APPROVED","label":"Approved for Payment","color":"success"},
    {"key":"PAID","label":"Paid","color":"success","terminal":true},
    {"key":"REJECTED","label":"Rejected","color":"danger","terminal":true}
  ]'::jsonb,
  '[
    {"from":"DRAFT","to":"REGISTERED","action":"REGISTER","label":"Register & Match","roles":["admin","account","procurement"]},
    {"from":"REGISTERED","to":"EXCEPTION","action":"FLAG","label":"Flag Match Exception","roles":["admin","account","procurement"]},
    {"from":"REGISTERED","to":"APPROVED","action":"APPROVE","label":"Approve for Payment","roles":["admin","account","manager","gm"],"approval_mode":"SINGLE","approvers":[{"type":"ROLE","value":"account"}],"sla":48},
    {"from":"REGISTERED","to":"REJECTED","action":"REJECT","label":"Reject","roles":["admin","account","manager"]},
    {"from":"EXCEPTION","to":"APPROVED","action":"OVERRIDE","label":"Override & Approve","roles":["admin","manager","gm"]},
    {"from":"EXCEPTION","to":"REJECTED","action":"REJECT_EXC","label":"Reject","roles":["admin","account","manager"]},
    {"from":"APPROVED","to":"PAID","action":"PAY","label":"Mark Paid","roles":["admin","account"]}
  ]'::jsonb
);

notify pgrst, 'reload schema';
