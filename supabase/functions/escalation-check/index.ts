// @ts-nocheck
// ============================================================
// JEET ERP — Platform Layer: escalation-check Edge Function
// Scheduled check running every 15 minutes to trigger escalations.
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

  const _job = await startJobRun("escalation-check");
  try {
    const supabaseUrl = (Deno.env.get("SUPABASE_URL") ?? "").trim();
    const supabaseServiceKey = (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "").trim();

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase configuration.");
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "") || supabaseServiceKey;
    const finalAuth = authHeader || `Bearer ${token}`;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const now = new Date().toISOString();

    // 1. Fetch overdue, active timers
    const { data: timers, error: fetchErr } = await supabase
      .from("escalation_timers")
      .select(`
        *,
        event:system_events (*)
      `)
      .eq("escalated", false)
      .eq("cancelled", false)
      .lte("escalate_at", now);

    if (fetchErr) throw fetchErr;

    let fireCount = 0;

    for (const timer of timers || []) {
      // 2. Mark as escalated
      await supabase
        .from("escalation_timers")
        .update({ escalated: true })
        .eq("id", timer.id);

      // 3. Emit approval.escalation event
      // This will flow through the Event Bus processor and notify GMs / admins
      const { data: newEvent } = await supabase
        .from("system_events")
        .insert({
          event_type: "approval.escalation",
          entity_type: timer.event?.entity_type || null,
          entity_id: timer.event?.entity_id || null,
          project_id: timer.event?.project_id || null,
          payload: {
            original_event_id: timer.event_id,
            original_event_type: timer.event?.event_type,
            escalate_at: timer.escalate_at,
            original_payload: timer.event?.payload || {}
          }
        })
        .select()
        .single();

      if (newEvent) {
        // Invoke process-event Edge Function via explicit fetch
        const invokeUrl = `${supabaseUrl}/functions/v1/process-event`;
        await fetch(invokeUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": finalAuth,
            "apikey": token
          },
          body: JSON.stringify({ event_id: newEvent.id })
        })
        .then(async (res) => {
          if (!res.ok) {
            console.error(`Failed to invoke process-event for escalation (status ${res.status}): ${await res.text()}`);
          }
        })
        .catch((err: any) => console.error("Escalation event fan-out fetch failed:", err));
      }

      fireCount++;
    }

    // --- Document Expiry Alerts Check ---
    const { data: pendingAlerts, error: alertsFetchErr } = await supabase
      .from("document_expiry_alerts")
      .select(`
        *,
        document:documents (*)
      `)
      .eq("status", "PENDING");

    if (alertsFetchErr) throw alertsFetchErr;

    const todayMs = new Date().getTime();
    let sentAlertsCount = 0;

    for (const alert of pendingAlerts || []) {
      const expiryTime = new Date(alert.expiry_date).getTime();
      const alertTime = expiryTime - alert.alert_days_before * 24 * 60 * 60 * 1000;
      
      if (alertTime <= todayMs) {
        // Mark alert as SENT
        const { error: updateAlertErr } = await supabase
          .from("document_expiry_alerts")
          .update({
            status: "SENT",
            alert_sent_at: now
          })
          .eq("id", alert.id);

        if (updateAlertErr) {
          console.error(`Failed to update alert status for alert ID ${alert.id}:`, updateAlertErr);
          continue;
        }

        // Emit document.expiring event
        const doc = alert.document;
        if (doc) {
          const { data: newEvent, error: insertEventErr } = await supabase
            .from("system_events")
            .insert({
              event_type: "document.expiring",
              entity_type: "DOCUMENT",
              entity_id: doc.id,
              project_id: doc.entity_type === "PROJECT" ? doc.entity_id : null,
              payload: {
                title: doc.title,
                original_filename: doc.original_filename,
                expiry_date: doc.expiry_date,
                days_remaining: alert.alert_days_before
              },
              actor_user_id: doc.uploaded_by
            })
            .select()
            .single();

          if (insertEventErr) {
            console.error(`Failed to emit document.expiring event for alert ID ${alert.id}:`, insertEventErr);
          } else if (newEvent) {
            sentAlertsCount++;
            // Invoke process-event Edge Function via explicit fetch
            const invokeUrl = `${supabaseUrl}/functions/v1/process-event`;
            await fetch(invokeUrl, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": finalAuth,
                "apikey": token
              },
              body: JSON.stringify({ event_id: newEvent.id })
            })
            .then(async (res) => {
              if (!res.ok) {
                console.error(`Failed to invoke process-event for expiry (status ${res.status}): ${await res.text()}`);
              }
            })
            .catch((err: any) => console.error("Expiry event fan-out fetch failed:", err));
          }
        }
      }
    }

    await finishJobRun(_job, "SUCCESS", { items_processed: fireCount + sentAlertsCount, escalated: fireCount, alerts: sentAlertsCount });
    return new Response(JSON.stringify({
      success: true,
      escalated_count: fireCount,
      sent_alerts_count: sentAlertsCount
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error: any) {
    console.error("Escalation check failed:", error);
    await finishJobRun(_job, "FAILED", { error: error?.message ?? String(error) });
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
