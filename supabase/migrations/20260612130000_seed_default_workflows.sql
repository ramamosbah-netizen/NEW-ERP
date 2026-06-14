-- ============================================================
-- JEET ERP — Seed default workflows for core modules
-- Idempotent: each block is skipped when a workflow already
-- exists for the module. Admins can edit/clone these in the
-- Admin Center → Workflow Builder.
-- ============================================================

-- Helper to keep the seeds compact
create or replace function pg_temp.seed_workflow(
  p_module text,
  p_name text,
  p_desc text,
  p_statuses jsonb,    -- [{key,label,color,initial,terminal}]
  p_transitions jsonb  -- [{from,to,action,label,roles,approval_mode,approvers,sla}]
) returns void language plpgsql as $$
declare
  wf_id uuid;
  s jsonb;
  t jsonb;
  ids jsonb := '{}'::jsonb;
  i int := 0;
begin
  if exists (select 1 from public.workflow_definitions where module_key = p_module) then
    return;
  end if;

  insert into public.workflow_definitions (module_key, name, description, is_active)
  values (p_module, p_name, p_desc, true)
  returning id into wf_id;

  for s in select * from jsonb_array_elements(p_statuses) loop
    declare new_id uuid;
    begin
      insert into public.workflow_statuses (workflow_id, status_key, label, color, is_initial, is_terminal, sort_order)
      values (
        wf_id,
        s->>'key', s->>'label', coalesce(s->>'color', 'neutral'),
        coalesce((s->>'initial')::boolean, false),
        coalesce((s->>'terminal')::boolean, false),
        i
      )
      returning id into new_id;
      ids := ids || jsonb_build_object(s->>'key', new_id::text);
      i := i + 1;
    end;
  end loop;

  i := 0;
  for t in select * from jsonb_array_elements(p_transitions) loop
    insert into public.workflow_transitions
      (workflow_id, from_status_id, to_status_id, action_key, label, allowed_roles, approval, sla_hours, sort_order)
    values (
      wf_id,
      (ids->>(t->>'from'))::uuid,
      (ids->>(t->>'to'))::uuid,
      t->>'action', t->>'label',
      coalesce((select array_agg(x) from jsonb_array_elements_text(t->'roles') x), '{}'),
      jsonb_build_object(
        'mode', coalesce(t->>'approval_mode', 'NONE'),
        'approvers', coalesce(t->'approvers', '[]'::jsonb),
        'min_approvals', 1
      ),
      (t->>'sla')::int,
      i
    );
    i := i + 1;
  end loop;
end;
$$;

-- ---------- Quotation (QTN) ----------
select pg_temp.seed_workflow(
  'QTN', 'Quotation Approval',
  'Draft → Commercial Review → GM Approval → Sent → Accepted/Rejected',
  '[
    {"key":"DRAFT","label":"Draft","color":"neutral","initial":true},
    {"key":"PENDING_COMMERCIAL","label":"Commercial Review","color":"warning"},
    {"key":"PENDING_GM","label":"GM Approval","color":"warning"},
    {"key":"APPROVED","label":"Approved","color":"success"},
    {"key":"SENT","label":"Sent to Client","color":"info"},
    {"key":"ACCEPTED","label":"Accepted","color":"success","terminal":true},
    {"key":"REJECTED","label":"Rejected","color":"danger","terminal":true}
  ]'::jsonb,
  '[
    {"from":"DRAFT","to":"PENDING_COMMERCIAL","action":"SUBMIT","label":"Submit for Review","roles":[]},
    {"from":"PENDING_COMMERCIAL","to":"PENDING_GM","action":"COMMERCIAL_APPROVE","label":"Commercial Approve","roles":["admin","commercial_mgr","manager"],"approval_mode":"SINGLE","approvers":[{"type":"ROLE","value":"commercial_mgr"}],"sla":48},
    {"from":"PENDING_COMMERCIAL","to":"DRAFT","action":"RETURN","label":"Return to Draft","roles":["admin","commercial_mgr","manager"]},
    {"from":"PENDING_GM","to":"APPROVED","action":"GM_APPROVE","label":"GM Approve","roles":["admin","gm","manager"],"approval_mode":"SINGLE","approvers":[{"type":"ROLE","value":"gm"}],"sla":48},
    {"from":"PENDING_GM","to":"DRAFT","action":"GM_RETURN","label":"Return to Draft","roles":["admin","gm","manager"]},
    {"from":"APPROVED","to":"SENT","action":"SEND","label":"Send to Client","roles":[]},
    {"from":"SENT","to":"ACCEPTED","action":"CLIENT_ACCEPT","label":"Client Accepted","roles":[]},
    {"from":"SENT","to":"REJECTED","action":"CLIENT_REJECT","label":"Client Rejected","roles":[]}
  ]'::jsonb
);

-- ---------- Variation Order (VO) ----------
select pg_temp.seed_workflow(
  'VO', 'Variation Order Approval',
  'Draft → Internal Approval → Client Approval → Closed',
  '[
    {"key":"DRAFT","label":"Draft","color":"neutral","initial":true},
    {"key":"PENDING_INTERNAL","label":"Internal Approval","color":"warning"},
    {"key":"PENDING_CLIENT","label":"Awaiting Client","color":"info"},
    {"key":"CLIENT_APPROVED","label":"Client Approved","color":"success"},
    {"key":"REJECTED","label":"Rejected","color":"danger"},
    {"key":"CLOSED","label":"Closed","color":"neutral","terminal":true}
  ]'::jsonb,
  '[
    {"from":"DRAFT","to":"PENDING_INTERNAL","action":"SUBMIT","label":"Submit for Approval","roles":[]},
    {"from":"PENDING_INTERNAL","to":"PENDING_CLIENT","action":"APPROVE","label":"Approve & Send to Client","roles":["admin","gm","manager"],"approval_mode":"SINGLE","approvers":[{"type":"ROLE","value":"gm"}],"sla":72},
    {"from":"PENDING_INTERNAL","to":"REJECTED","action":"REJECT","label":"Reject","roles":["admin","gm","manager"]},
    {"from":"PENDING_CLIENT","to":"CLIENT_APPROVED","action":"CLIENT_APPROVE","label":"Record Client Approval","roles":[]},
    {"from":"PENDING_CLIENT","to":"REJECTED","action":"CLIENT_REJECT","label":"Client Rejected","roles":[]},
    {"from":"REJECTED","to":"DRAFT","action":"REVISE","label":"Revise","roles":[]},
    {"from":"CLIENT_APPROVED","to":"CLOSED","action":"CLOSE","label":"Close","roles":["admin","manager","gm"]}
  ]'::jsonb
);

-- ---------- Goods Receipt Note (GRN) ----------
select pg_temp.seed_workflow(
  'GRN', 'Goods Receipt Inspection',
  'Received → Inspection → Accepted/Returned → Closed',
  '[
    {"key":"RECEIVED","label":"Received","color":"neutral","initial":true},
    {"key":"UNDER_INSPECTION","label":"Under Inspection","color":"warning"},
    {"key":"ACCEPTED","label":"Accepted","color":"success"},
    {"key":"PARTIAL_RETURN","label":"Partial Return","color":"danger"},
    {"key":"CLOSED","label":"Closed","color":"neutral","terminal":true}
  ]'::jsonb,
  '[
    {"from":"RECEIVED","to":"UNDER_INSPECTION","action":"INSPECT","label":"Start Inspection","roles":["admin","storekeeper","engineer","manager"],"sla":24},
    {"from":"UNDER_INSPECTION","to":"ACCEPTED","action":"ACCEPT","label":"Accept Materials","roles":["admin","storekeeper","engineer","manager"]},
    {"from":"UNDER_INSPECTION","to":"PARTIAL_RETURN","action":"FLAG_RETURNS","label":"Flag Returns","roles":["admin","storekeeper","engineer","manager"]},
    {"from":"ACCEPTED","to":"CLOSED","action":"CLOSE","label":"Close","roles":["admin","storekeeper","manager"]},
    {"from":"PARTIAL_RETURN","to":"CLOSED","action":"CLOSE_RETURNS","label":"Close After Returns","roles":["admin","storekeeper","manager"]}
  ]'::jsonb
);

-- ---------- Client Invoice (INV) ----------
select pg_temp.seed_workflow(
  'INV', 'Client Invoice Approval',
  'Draft → Finance Approval → Sent → Paid/Written-off',
  '[
    {"key":"DRAFT","label":"Draft","color":"neutral","initial":true},
    {"key":"PENDING_APPROVAL","label":"Finance Approval","color":"warning"},
    {"key":"APPROVED","label":"Approved","color":"success"},
    {"key":"SENT","label":"Sent","color":"info"},
    {"key":"PAID","label":"Paid","color":"success","terminal":true},
    {"key":"WRITTEN_OFF","label":"Written Off","color":"danger","terminal":true}
  ]'::jsonb,
  '[
    {"from":"DRAFT","to":"PENDING_APPROVAL","action":"SUBMIT","label":"Submit for Approval","roles":[]},
    {"from":"PENDING_APPROVAL","to":"APPROVED","action":"APPROVE","label":"Approve","roles":["admin","account","manager","gm"],"approval_mode":"SINGLE","approvers":[{"type":"ROLE","value":"account"}],"sla":48},
    {"from":"PENDING_APPROVAL","to":"DRAFT","action":"RETURN","label":"Return to Draft","roles":["admin","account","manager","gm"]},
    {"from":"APPROVED","to":"SENT","action":"SEND","label":"Mark Sent","roles":["admin","account"]},
    {"from":"SENT","to":"PAID","action":"MARK_PAID","label":"Mark Paid","roles":["admin","account"]},
    {"from":"SENT","to":"WRITTEN_OFF","action":"WRITE_OFF","label":"Write Off","roles":["admin","gm"]}
  ]'::jsonb
);

-- ---------- Tender (TND) ----------
select pg_temp.seed_workflow(
  'TND', 'Tender Lifecycle',
  'Registration → Qualification → Evaluation → Submission → Award/Archive',
  '[
    {"key":"DRAFT","label":"Registered","color":"neutral","initial":true},
    {"key":"QUALIFICATION","label":"Qualification","color":"warning"},
    {"key":"EVALUATION","label":"Tech/Comm Evaluation","color":"warning"},
    {"key":"SUBMITTED","label":"Bid Submitted","color":"info"},
    {"key":"AWARDED","label":"Awarded","color":"success","terminal":true},
    {"key":"LOST","label":"Lost","color":"danger","terminal":true},
    {"key":"ARCHIVED","label":"Archived","color":"neutral","terminal":true}
  ]'::jsonb,
  '[
    {"from":"DRAFT","to":"QUALIFICATION","action":"QUALIFY","label":"Start Qualification","roles":[]},
    {"from":"QUALIFICATION","to":"EVALUATION","action":"EVALUATE","label":"Start Evaluation","roles":["admin","manager","commercial_mgr","gm"],"sla":120},
    {"from":"QUALIFICATION","to":"ARCHIVED","action":"NO_BID","label":"No-Bid (Archive)","roles":["admin","manager","gm"]},
    {"from":"EVALUATION","to":"SUBMITTED","action":"SUBMIT_BID","label":"Submit Bid","roles":["admin","manager","commercial_mgr","gm"],"approval_mode":"SINGLE","approvers":[{"type":"ROLE","value":"gm"}]},
    {"from":"SUBMITTED","to":"AWARDED","action":"AWARD","label":"Mark Awarded","roles":[]},
    {"from":"SUBMITTED","to":"LOST","action":"LOSE","label":"Mark Lost","roles":[]}
  ]'::jsonb
);

-- ---------- Service Request (SERVICE_REQ) ----------
select pg_temp.seed_workflow(
  'SERVICE_REQ', 'Service Ticket Flow',
  'New → Assigned → In Progress → Resolved → Closed',
  '[
    {"key":"NEW","label":"New","color":"info","initial":true},
    {"key":"ASSIGNED","label":"Assigned","color":"warning"},
    {"key":"IN_PROGRESS","label":"In Progress","color":"warning"},
    {"key":"ON_HOLD","label":"On Hold (Parts)","color":"neutral"},
    {"key":"RESOLVED","label":"Resolved","color":"success"},
    {"key":"CLOSED","label":"Closed","color":"neutral","terminal":true}
  ]'::jsonb,
  '[
    {"from":"NEW","to":"ASSIGNED","action":"ASSIGN","label":"Assign Technician","roles":["admin","manager","engineer"],"sla":4},
    {"from":"ASSIGNED","to":"IN_PROGRESS","action":"START","label":"Start Work","roles":[],"sla":8},
    {"from":"IN_PROGRESS","to":"ON_HOLD","action":"HOLD","label":"Hold for Parts","roles":[]},
    {"from":"ON_HOLD","to":"IN_PROGRESS","action":"RESUME","label":"Resume","roles":[]},
    {"from":"IN_PROGRESS","to":"RESOLVED","action":"RESOLVE","label":"Resolve","roles":[],"sla":48},
    {"from":"RESOLVED","to":"CLOSED","action":"CLOSE","label":"Close Ticket","roles":["admin","manager"]},
    {"from":"RESOLVED","to":"IN_PROGRESS","action":"REOPEN","label":"Reopen","roles":[]}
  ]'::jsonb
);

-- ---------- Project (PRJ) ----------
select pg_temp.seed_workflow(
  'PRJ', 'Project Delivery Phases',
  'Mobilization → Execution → Testing → Handover → DLP → Closed',
  '[
    {"key":"MOBILIZATION","label":"Mobilization","color":"info","initial":true},
    {"key":"IN_PROGRESS","label":"In Progress","color":"warning"},
    {"key":"TESTING","label":"Testing & Comm.","color":"warning"},
    {"key":"HANDOVER","label":"Handover","color":"info"},
    {"key":"DLP","label":"DLP (Warranty)","color":"success"},
    {"key":"CLOSED","label":"Closed","color":"neutral","terminal":true},
    {"key":"ON_HOLD","label":"On Hold","color":"danger"}
  ]'::jsonb,
  '[
    {"from":"MOBILIZATION","to":"IN_PROGRESS","action":"START_WORKS","label":"Start Works","roles":["admin","manager","pm","engineer"]},
    {"from":"IN_PROGRESS","to":"TESTING","action":"START_TC","label":"Start T&C","roles":["admin","manager","pm","engineer"]},
    {"from":"TESTING","to":"HANDOVER","action":"HANDOVER","label":"Begin Handover","roles":["admin","manager","pm"],"approval_mode":"SINGLE","approvers":[{"type":"ROLE","value":"manager"}]},
    {"from":"HANDOVER","to":"DLP","action":"ENTER_DLP","label":"Enter DLP","roles":["admin","manager","pm"]},
    {"from":"DLP","to":"CLOSED","action":"CLOSE","label":"Close Project","roles":["admin","manager","gm"]},
    {"from":"IN_PROGRESS","to":"ON_HOLD","action":"HOLD","label":"Put On Hold","roles":["admin","manager","gm"]},
    {"from":"ON_HOLD","to":"IN_PROGRESS","action":"RESUME","label":"Resume","roles":["admin","manager","gm"]}
  ]'::jsonb
);

-- ---------- Leave Request (LEAVE) ----------
select pg_temp.seed_workflow(
  'LEAVE', 'Leave Request Approval',
  'Submitted → Manager Approval → HR Confirmation → Approved/Rejected',
  '[
    {"key":"SUBMITTED","label":"Submitted","color":"info","initial":true},
    {"key":"MANAGER_REVIEW","label":"Manager Review","color":"warning"},
    {"key":"HR_REVIEW","label":"HR Confirmation","color":"warning"},
    {"key":"APPROVED","label":"Approved","color":"success","terminal":true},
    {"key":"REJECTED","label":"Rejected","color":"danger","terminal":true}
  ]'::jsonb,
  '[
    {"from":"SUBMITTED","to":"MANAGER_REVIEW","action":"ROUTE","label":"Route to Manager","roles":[],"sla":24},
    {"from":"MANAGER_REVIEW","to":"HR_REVIEW","action":"MANAGER_APPROVE","label":"Manager Approve","roles":["admin","manager","gm"],"approval_mode":"SINGLE","approvers":[{"type":"ROLE","value":"manager"}],"sla":48},
    {"from":"MANAGER_REVIEW","to":"REJECTED","action":"MANAGER_REJECT","label":"Reject","roles":["admin","manager","gm"]},
    {"from":"HR_REVIEW","to":"APPROVED","action":"HR_CONFIRM","label":"HR Confirm","roles":["admin","manager"],"sla":24},
    {"from":"HR_REVIEW","to":"REJECTED","action":"HR_REJECT","label":"Reject","roles":["admin","manager"]}
  ]'::jsonb
);

drop function pg_temp.seed_workflow(text, text, text, jsonb, jsonb);
