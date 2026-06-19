// @ts-nocheck
// ============================================================
// JEET ERP — invoice-overdue-check Edge Function
// Scheduled daily cron checking for overdue client invoices
// ============================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.10.0";
import { startJobRun, finishJobRun } from "../_shared/jobRun.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const _job = await startJobRun("invoice-overdue-check");
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase configuration.");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const today = new Date().toISOString().split('T')[0];

    // 1. Fetch outstanding client invoices past due date
    // Conditions:
    // - status: SENT, PARTIALLY_PAID
    // - due_date: has passed (< today)
    // - is_active: true
    const { data: overdueInvoices, error: invErr } = await supabase
      .from("client_invoices")
      .select("*")
      .in("status", ["SENT", "PARTIALLY_PAID"])
      .lt("due_date", today)
      .eq("is_active", true);

    if (invErr) throw invErr;

    let tasksCreated = 0;

    for (const inv of overdueInvoices || []) {
      const taskTitle = `Overdue Payment Follow-up: Invoice ${inv.invoice_number}`;
      const outstandingAmt = Number(inv.net_due || inv.total_incl_vat) - Number(inv.amount_paid);

      if (outstandingAmt <= 0) continue;

      // 2. Check if an active task for this invoice already exists
      const { data: existingTasks, error: checkErr } = await supabase
        .from("tasks")
        .select("id")
        .eq("linked_entity_type", "CLIENT_INVOICE")
        .eq("linked_entity_id", inv.id)
        .neq("status", "DONE")
        .neq("status", "DONE_AUTO")
        .neq("status", "CANCELLED")
        .eq("is_active", true);

      if (checkErr) throw checkErr;

      // 3. Create task if none exists
      if (!existingTasks || existingTasks.length === 0) {
        const dueDate = new Date();
        dueDate.setHours(dueDate.getHours() + 48); // due in 48 hours

        const { error: taskErr } = await supabase
          .from("tasks")
          .insert({
            title: taskTitle,
            description: `Invoice ${inv.invoice_number} for client ${inv.client_name} (Project: ${inv.project_id || 'N/A'}) was due on ${new Date(inv.due_date).toLocaleDateString('en-GB')} for ${inv.net_due} AED. There is an outstanding balance of ${outstandingAmt.toFixed(2)} AED. Please contact the client commercial team to pursue payment.`,
            origin: "AUTO_RULE",
            project_id: inv.project_id || null,
            linked_entity_type: "CLIENT_INVOICE",
            linked_entity_id: inv.id,
            assignee_id: inv.created_by,
            created_by: inv.created_by,
            priority: "HIGH",
            status: "TODO",
            due_date: dueDate.toISOString(),
            tags: ["OVERDUE_INVOICE", "FINANCE"]
          });

        if (taskErr) {
          console.error(`Failed to create task for Invoice ${inv.invoice_number}:`, taskErr);
        } else {
          tasksCreated++;

          // 4. Emit event to trigger notification engine
          await supabase.from("system_events").insert({
            event_type: "invoice.overdue",
            entity_type: "CLIENT_INVOICE",
            entity_id: inv.id,
            project_id: inv.project_id || null,
            actor_user_id: inv.created_by,
            payload: {
              invoice_number: inv.invoice_number,
              client_name: inv.client_name,
              due_date: inv.due_date,
              outstanding_amount: outstandingAmt,
              task_title: taskTitle
            }
          });
        }
      }
    }

    await finishJobRun(_job, "SUCCESS", { items_processed: tasksCreated });
    return new Response(JSON.stringify({ success: true, processed_count: overdueInvoices?.length || 0, tasks_created: tasksCreated }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error: any) {
    console.error("Invoice overdue check failed:", error);
    await finishJobRun(_job, "FAILED", { error: error?.message ?? String(error) });
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
