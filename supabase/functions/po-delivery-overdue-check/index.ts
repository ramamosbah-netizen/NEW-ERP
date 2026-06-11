// @ts-nocheck
// ============================================================
// JEET ERP — po-delivery-overdue-check Edge Function
// Scheduled daily cron checking for overdue PO deliveries
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

    // 1. Fetch active, overdue POs
    // Conditions:
    // - status: APPROVED, SENT, ACKNOWLEDGED, PARTIALLY_DELIVERED
    // - delivery_status: NOT_DELIVERED, PARTIAL (not COMPLETE)
    // - required_delivery_date: is not null and has passed (< today)
    const { data: overduePOs, error: poErr } = await supabase
      .from("purchase_orders")
      .select("*")
      .in("status", ["APPROVED", "SENT", "ACKNOWLEDGED", "PARTIALLY_DELIVERED"])
      .neq("delivery_status", "COMPLETE")
      .not("required_delivery_date", "is", null)
      .lt("required_delivery_date", today)
      .eq("is_active", true);

    if (poErr) throw poErr;

    let tasksCreated = 0;

    for (const po of overduePOs || []) {
      const taskTitle = `Overdue Delivery Follow-up: PO ${po.po_number}`;
      
      // 2. Check if an active task for this PO already exists
      const { data: existingTasks, error: checkErr } = await supabase
        .from("tasks")
        .select("id")
        .eq("linked_entity_type", "LPO")
        .eq("linked_entity_id", po.id)
        .neq("status", "DONE")
        .neq("status", "DONE_AUTO")
        .neq("status", "CANCELLED")
        .eq("is_active", true);

      if (checkErr) throw checkErr;

      // 3. Create task if none exists
      if (!existingTasks || existingTasks.length === 0) {
        const dueDate = new Date();
        dueDate.setHours(dueDate.getHours() + 24); // due in 24 hours

        const { error: taskErr } = await supabase
          .from("tasks")
          .insert({
            title: taskTitle,
            description: `LPO ${po.po_number} issued to ${po.supplier_name} for ${po.total} AED was scheduled for delivery on ${new Date(po.required_delivery_date).toLocaleDateString('en-GB')}, but has not been fully received. Please contact the supplier to trace status.`,
            origin: "AUTO_RULE",
            project_id: po.project_id || null,
            linked_entity_type: "LPO",
            linked_entity_id: po.id,
            assignee_id: po.created_by,
            created_by: po.created_by, // assigned to PO author
            priority: "HIGH",
            status: "TODO",
            due_date: dueDate.toISOString(),
            tags: ["OVERDUE_DELIVERY", "LPO"]
          });

        if (taskErr) {
          console.error(`Failed to create task for PO ${po.po_number}:`, taskErr);
        } else {
          tasksCreated++;

          // 4. Emit event to trigger notification engine fan-out
          await supabase.from("system_events").insert({
            event_type: "task.assigned",
            entity_type: "PROJECT",
            entity_id: po.project_id || po.id,
            project_id: po.project_id || null,
            actor_user_id: po.created_by,
            payload: {
              po_number: po.po_number,
              supplier_name: po.supplier_name,
              required_delivery_date: po.required_delivery_date,
              task_title: taskTitle
            }
          });
        }
      }
    }

    return new Response(JSON.stringify({ success: true, processed_count: overduePOs?.length || 0, tasks_created: tasksCreated }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error: any) {
    console.error("PO overdue check failed:", error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
