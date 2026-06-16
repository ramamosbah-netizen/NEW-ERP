-- ============================================================
-- JEET ERP — Seed BOQ workflow + simplify Tender (TND) workflow
-- Additive/idempotent. Replaces TND stages in place (keeps the
-- definition id so existing instances survive) and seeds BOQ new.
-- ============================================================

-- Guard-free upsert helper (unlike the original seed, this REPLACES):
create or replace function pg_temp.upsert_workflow(
  p_module text, p_name text, p_desc text, p_statuses jsonb, p_transitions jsonb
) returns void language plpgsql as $$
declare
  wf_id uuid; s jsonb; t jsonb; ids jsonb := '{}'::jsonb; i int := 0;
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
      ids := ids || jsonb_build_object(s->>'key', new_id::text);
      i := i + 1;
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
end;
$$;

-- ---------- BOQ: Estimator draft → Procurement cost-review → Commercial/Manager approve → feeds Quotation ----------
select pg_temp.upsert_workflow(
  'BOQ', 'BOQ Approval', 'Bill of Quantities — draft, cost review, approval; feeds the Quotation flow.',
  '[
    {"key":"DRAFT","label":"Draft","color":"neutral","initial":true},
    {"key":"COST_REVIEW","label":"Procurement Cost Review","color":"warning"},
    {"key":"PENDING_APPROVAL","label":"Commercial Approval","color":"warning"},
    {"key":"APPROVED","label":"Approved","color":"success"},
    {"key":"LINKED","label":"Linked to Quotation","color":"info","terminal":true},
    {"key":"REJECTED","label":"Rejected","color":"danger"}
  ]'::jsonb,
  '[
    {"from":"DRAFT","to":"COST_REVIEW","action":"SUBMIT_REVIEW","label":"Submit for Cost Review","roles":["admin","estimator","engineer","site_eng"]},
    {"from":"COST_REVIEW","to":"PENDING_APPROVAL","action":"COST_APPROVE","label":"Cost Reviewed","roles":["admin","procurement","manager"],"approval_mode":"SINGLE","approvers":[{"type":"ROLE","value":"procurement"}],"sla":48},
    {"from":"COST_REVIEW","to":"DRAFT","action":"COST_RETURN","label":"Return to Draft","roles":["admin","procurement","manager"]},
    {"from":"PENDING_APPROVAL","to":"APPROVED","action":"APPROVE","label":"Approve BOQ","roles":["admin","commercial_mgr","manager","gm"],"approval_mode":"SINGLE","approvers":[{"type":"ROLE","value":"commercial_mgr"}],"sla":48},
    {"from":"PENDING_APPROVAL","to":"REJECTED","action":"REJECT","label":"Reject","roles":["admin","commercial_mgr","manager"]},
    {"from":"REJECTED","to":"DRAFT","action":"REVISE","label":"Revise","roles":["admin","estimator","engineer","site_eng"]},
    {"from":"APPROVED","to":"LINKED","action":"LINK_QUOTE","label":"Create Quotation","roles":["admin","estimator","commercial_mgr","manager"]}
  ]'::jsonb
);

-- ---------- TND: simplified draft → engineer revision → manager approval (keeps bid outcome) ----------
select pg_temp.upsert_workflow(
  'TND', 'Tender Lifecycle', 'Tender — draft, engineer revision, manager approval, then bid outcome.',
  '[
    {"key":"DRAFT","label":"Draft","color":"neutral","initial":true},
    {"key":"ENGINEER_REVISION","label":"Engineer Revision","color":"warning"},
    {"key":"PENDING_APPROVAL","label":"Manager Approval","color":"warning"},
    {"key":"APPROVED","label":"Approved to Bid","color":"success"},
    {"key":"SUBMITTED","label":"Bid Submitted","color":"info"},
    {"key":"AWARDED","label":"Awarded","color":"success","terminal":true},
    {"key":"LOST","label":"Lost","color":"danger","terminal":true}
  ]'::jsonb,
  '[
    {"from":"DRAFT","to":"ENGINEER_REVISION","action":"SUBMIT_REVISION","label":"Submit for Revision","roles":[]},
    {"from":"ENGINEER_REVISION","to":"PENDING_APPROVAL","action":"SUBMIT_APPROVAL","label":"Submit for Approval","roles":["admin","engineer","site_eng","estimator"],"sla":48},
    {"from":"ENGINEER_REVISION","to":"DRAFT","action":"REVISION_RETURN","label":"Return to Draft","roles":["admin","engineer","site_eng","manager"]},
    {"from":"PENDING_APPROVAL","to":"APPROVED","action":"APPROVE","label":"Manager Approve","roles":["admin","manager","gm"],"approval_mode":"SINGLE","approvers":[{"type":"ROLE","value":"manager"}],"sla":48},
    {"from":"PENDING_APPROVAL","to":"DRAFT","action":"REJECT","label":"Reject to Draft","roles":["admin","manager","gm"]},
    {"from":"APPROVED","to":"SUBMITTED","action":"SUBMIT_BID","label":"Submit Bid","roles":[]},
    {"from":"SUBMITTED","to":"AWARDED","action":"AWARD","label":"Mark Awarded","roles":[]},
    {"from":"SUBMITTED","to":"LOST","action":"LOSE","label":"Mark Lost","roles":[]}
  ]'::jsonb
);

-- Remap any existing tender instance sitting on a status the new flow dropped
update public.workflow_instances
set current_status_key = 'DRAFT'
where workflow_id = (select id from public.workflow_definitions where module_key = 'TND')
  and current_status_key not in ('DRAFT','ENGINEER_REVISION','PENDING_APPROVAL','APPROVED','SUBMITTED','AWARDED','LOST');

notify pgrst, 'reload schema';
