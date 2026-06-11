// @ts-nocheck
// ============================================================
// JEET ERP — snag-overdue-check Edge Function
// Scheduled daily cron checking for overdue snags / defects
// ============================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.10.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase configuration.");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const today = new Date().toISOString().split('T')[0];

    // 1. Fetch outstanding snags past target date
    // Conditions:
    // - status: OPEN, IN_PROGRESS, READY_FOR_INSPECTION
    // - target_date: has passed (< today)
    const { data: overdueSnags, error: snagErr } = await supabase
      .from("snags")
      .select("*")
      .in("status", ["OPEN", "IN_PROGRESS", "READY_FOR_INSPECTION"])
      .lt("target_date", today);

    if (snagErr) throw snagErr;

    let tasksCreated = 0;

    for (const snag of overdueSnags || []) {
      const taskTitle = `Overdue Snag Rectification: ${snag.snag_number}`;

      // 2. Check if an active task for this snag already exists
      const { data: existingTasks, error: checkErr } = await supabase
        .from("tasks")
        .select("id")
        .eq("linked_entity_type", "SNAG")
        .eq("linked_entity_id", snag.id)
        .neq("status", "DONE")
        .neq("status", "DONE_AUTO")
        .neq("status", "CANCELLED")
        .eq("is_active", true);

      if (checkErr) throw checkErr;

      // 3. Create task if none exists
      if (!existingTasks || existingTasks.length === 0) {
        const dueDate = new Date();
        dueDate.setHours(dueDate.getHours() + 24); // due in 24 hours

        // Assignee: if snag is assigned, assign task to them, else assign to creator
        const assigneeId = snag.assigned_to || snag.created_by;

        const { error: taskErr } = await supabase
          .from("tasks")
          .insert({
            title: taskTitle,
            description: `Defect snag ${snag.snag_number} located at "${snag.location}" was due for rectification on ${new Date(snag.target_date).toLocaleDateString('en-GB')}. Description: ${snag.description}. Please complete rectification immediately.`,
            origin: "AUTO_RULE",
            project_id: snag.project_id,
            linked_entity_type: "SNAG",
            linked_entity_id: snag.id,
            assignee_id: assigneeId,
            created_by: snag.created_by,
            priority: snag.severity === "CRITICAL" ? "CRITICAL" : snag.severity === "MAJOR" ? "HIGH" : "MEDIUM",
            status: "TODO",
            due_date: dueDate.toISOString(),
            tags: ["OVERDUE_SNAG", "OPERATIONS"]
          });

        if (taskErr) {
          console.error(`Failed to create task for Snag ${snag.snag_number}:`, taskErr);
        } else {
          tasksCreated++;

          // 4. Emit event to trigger notification engine
          await supabase.from("system_events").insert({
            event_type: "snag.overdue",
            entity_type: "SNAG",
            entity_id: snag.id,
            project_id: snag.project_id,
            actor_user_id: snag.created_by,
            payload: {
              snag_number: snag.snag_number,
              description: snag.description,
              location: snag.location,
              target_date: snag.target_date,
              assigned_to: assigneeId,
              task_title: taskTitle
            }
          });
        }
      }
    }

    return new Response(JSON.stringify({ success: true, processed_count: overdueSnags?.length || 0, tasks_created: tasksCreated }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error: any) {
    console.error("Snag overdue check failed:", error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
