-- ============================================================
-- JEET ERP — Seed PR, Snag/NCR and Testing&Commissioning workflows
-- Additive/idempotent. Panels wired onto pr/[id], snags drawer, tc/[id].
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

-- ---------- Purchase Request: Site Engineer draft → PM/Manager approval → convert/direct ----------
select pg_temp.upsert_workflow(
  'PR', 'Purchase Request Approval', 'PR — drafted, approved, then converted to RFQ/PO (or direct purchase).',
  '[
    {"key":"DRAFT","label":"Draft","color":"neutral","initial":true},
    {"key":"SUBMITTED","label":"Pending Approval","color":"warning"},
    {"key":"APPROVED","label":"Approved","color":"success"},
    {"key":"CONVERTED","label":"Converted to RFQ/PO","color":"info","terminal":true},
    {"key":"DIRECT_PURCHASED","label":"Direct Purchased","color":"info","terminal":true},
    {"key":"REJECTED","label":"Rejected","color":"danger","terminal":true}
  ]'::jsonb,
  '[
    {"from":"DRAFT","to":"SUBMITTED","action":"SUBMIT","label":"Submit for Approval","roles":["admin","site_eng","engineer","procurement"]},
    {"from":"SUBMITTED","to":"APPROVED","action":"APPROVE","label":"Approve","roles":["admin","pm","manager","gm"],"approval_mode":"SINGLE","approvers":[{"type":"ROLE","value":"manager"}],"sla":48},
    {"from":"SUBMITTED","to":"DRAFT","action":"RETURN","label":"Return to Draft","roles":["admin","pm","manager"]},
    {"from":"SUBMITTED","to":"REJECTED","action":"REJECT","label":"Reject","roles":["admin","pm","manager"]},
    {"from":"APPROVED","to":"CONVERTED","action":"CONVERT","label":"Convert to RFQ/PO","roles":["admin","procurement"]},
    {"from":"APPROVED","to":"DIRECT_PURCHASED","action":"DIRECT_PURCHASE","label":"Direct Purchase","roles":["admin","procurement","manager"]}
  ]'::jsonb
);

-- ---------- Snag / NCR: raise → fix → verify (PM) ----------
select pg_temp.upsert_workflow(
  'SNAG', 'Snag / NCR Resolution', 'Snag/NCR — raised on site, fixed by the team, verified by the PM.',
  '[
    {"key":"OPEN","label":"Open","color":"danger","initial":true},
    {"key":"IN_PROGRESS","label":"In Progress","color":"warning"},
    {"key":"FIXED","label":"Awaiting Verification","color":"info"},
    {"key":"VERIFIED","label":"Verified / Closed","color":"success","terminal":true},
    {"key":"WAIVED","label":"Waived","color":"neutral","terminal":true}
  ]'::jsonb,
  '[
    {"from":"OPEN","to":"IN_PROGRESS","action":"START","label":"Start Fix","roles":["admin","technician","site_eng","engineer"],"sla":72},
    {"from":"IN_PROGRESS","to":"FIXED","action":"MARK_FIXED","label":"Mark Fixed","roles":["admin","technician","site_eng","engineer"]},
    {"from":"FIXED","to":"VERIFIED","action":"VERIFY","label":"Verify & Close","roles":["admin","pm","manager","engineer"],"approval_mode":"SINGLE","approvers":[{"type":"ROLE","value":"pm"}],"sla":48},
    {"from":"FIXED","to":"IN_PROGRESS","action":"REJECT_FIX","label":"Reject Fix / Reopen","roles":["admin","pm","manager","engineer"]},
    {"from":"OPEN","to":"WAIVED","action":"WAIVE","label":"Waive","roles":["admin","pm","manager"]}
  ]'::jsonb
);

-- ---------- Testing & Commissioning: test → witness → approve ----------
select pg_temp.upsert_workflow(
  'TC', 'Testing & Commissioning', 'T&C package — tested (calibrated tools), client-witnessed, approved.',
  '[
    {"key":"DRAFT","label":"Draft","color":"neutral","initial":true},
    {"key":"IN_PROGRESS","label":"Testing","color":"warning"},
    {"key":"FAILED","label":"Has Failures","color":"danger"},
    {"key":"COMPLETED","label":"Tests Complete","color":"info"},
    {"key":"WITNESSED","label":"Client Witnessed","color":"info"},
    {"key":"APPROVED","label":"Approved","color":"success","terminal":true}
  ]'::jsonb,
  '[
    {"from":"DRAFT","to":"IN_PROGRESS","action":"START","label":"Start Testing","roles":["admin","technician","site_eng","engineer"]},
    {"from":"IN_PROGRESS","to":"COMPLETED","action":"COMPLETE","label":"Complete Tests","roles":["admin","technician","site_eng","engineer"]},
    {"from":"IN_PROGRESS","to":"FAILED","action":"FAIL","label":"Flag Failures","roles":["admin","technician","site_eng","engineer"]},
    {"from":"FAILED","to":"IN_PROGRESS","action":"RETEST","label":"Re-test","roles":["admin","technician","site_eng"]},
    {"from":"COMPLETED","to":"WITNESSED","action":"WITNESS","label":"Client Witnessed","roles":["admin","pm","manager","engineer"]},
    {"from":"WITNESSED","to":"APPROVED","action":"APPROVE","label":"Approve T&C","roles":["admin","pm","manager","gm"],"approval_mode":"SINGLE","approvers":[{"type":"ROLE","value":"manager"}],"sla":72}
  ]'::jsonb
);

notify pgrst, 'reload schema';
