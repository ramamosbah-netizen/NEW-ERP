// @ts-nocheck
// ============================================================
// JEET ERP — retention-release-check Edge Function
// Scheduled daily cron checking for expired project DLPs to alert retention release tickets
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

    // 1. Fetch projects in DLP status that have completed their DLP period
    // Conditions:
    // - status: DLP
    // - dlp_end_date: has passed (<= today)
    // - is_active: true
    const { data: dlpFinishedProjects, error: projErr } = await supabase
      .from("projects")
      .select("*, profiles!project_manager_id(full_name, email)")
      .eq("status", "DLP")
      .lte("dlp_end_date", today)
      .eq("is_active", true);

    if (projErr) throw projErr;

    let tasksCreated = 0;

    for (const proj of dlpFinishedProjects || []) {
      const taskTitle = `Retention Release Follow-up: Project ${proj.project_number}`;
      
      // 2. Check if an active task for this project's retention already exists
      const { data: existingTasks, error: checkErr } = await supabase
        .from("tasks")
        .select("id")
        .eq("linked_entity_type", "PROJECT_RETENTION")
        .eq("linked_entity_id", proj.id)
        .neq("status", "DONE")
        .neq("status", "DONE_AUTO")
        .neq("status", "CANCELLED")
        .eq("is_active", true);

      if (checkErr) throw checkErr;

      // 3. Create task if none exists
      if (!existingTasks || existingTasks.length === 0) {
        const dueDate = new Date();
        dueDate.setHours(dueDate.getHours() + 72); // due in 3 days (72 hours)

        const assigneeId = proj.project_manager_id || proj.created_by;

        const { error: taskErr } = await supabase
          .from("tasks")
          .insert({
            title: taskTitle,
            description: `Defects Liability Period (DLP) for project ${proj.project_number} (${proj.name}) ended on ${new Date(proj.dlp_end_date).toLocaleDateString('en-GB')}. Please coordinate the final inspection certificate from the consultant, issue the final billing release claim, and request the client to release the retained retention (Value: ${proj.retention_pct}% of contract).`,
            origin: "AUTO_RULE",
            project_id: proj.id,
            linked_entity_type: "PROJECT_RETENTION",
            linked_entity_id: proj.id,
            assignee_id: assigneeId,
            created_by: proj.created_by,
            priority: "MEDIUM",
            status: "TODO",
            due_date: dueDate.toISOString(),
            tags: ["RETENTION_RELEASE", "PROJECT_DLP"]
          });

        if (taskErr) {
          console.error(`Failed to create task for Project ${proj.project_number}:`, taskErr);
        } else {
          tasksCreated++;

          // 4. Emit event to trigger notification engine
          await supabase.from("system_events").insert({
            event_type: "project.status_changed", // Or specific retention release event if rules exist
            entity_type: "PROJECT",
            entity_id: proj.id,
            project_id: proj.id,
            actor_user_id: assigneeId,
            payload: {
              project_number: proj.project_number,
              project_name: proj.name,
              dlp_end_date: proj.dlp_end_date,
              retention_pct: proj.retention_pct,
              task_title: taskTitle
            }
          });
        }
      }
    }

    return new Response(JSON.stringify({ success: true, processed_count: dlpFinishedProjects?.length || 0, tasks_created: tasksCreated }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error: any) {
    console.error("Retention release check failed:", error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
