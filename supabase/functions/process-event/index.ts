// @ts-nocheck
// ============================================================
// JEET ERP — Platform Layer: process-event Edge Function
// Handles event fan-out: matches event to notification & task rules,
// resolves recipients, applies templates, and triggers delivery.
// ============================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.10.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// GST offset (UTC+4)
const GST_OFFSET = 4 * 60 * 60 * 1000;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = (Deno.env.get("SUPABASE_URL") ?? "").trim();
    const supabaseServiceKey = (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "").trim();
    const supabaseAnonKey = (Deno.env.get("SUPABASE_ANON_KEY") ?? "").trim();
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const { event_id, action, minutes } = body;

    // Handle AJAX Action: Extract action items from meeting minutes
    if (action === "extract-minutes") {
      const geminiApiKey = Deno.env.get("GEMINI_API_KEY") ?? "";
      if (!geminiApiKey) {
        throw new Error("Missing GEMINI_API_KEY");
      }

      const prompt = `You are an AI assistant for JEET ERP. Read the following meeting minutes and extract specific, action-oriented action items.
      Return a JSON object containing a list named "action_items" where each action item matches this structure:
      {
        "description": "Short description of what needs to be done",
        "suggested_assignee_name": "Full name of suggested assignee if mentioned, or null",
        "suggested_due_days": Number (suggested deadline in number of calendar days from today, e.g. 3, 7, 14, or null)
      }
      Do not output markdown code blocks or formatting. Output raw JSON only.
      
      Minutes:
      ${minutes}`;

      const geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: "application/json" }
          })
        }
      );

      if (!geminiRes.ok) {
        throw new Error(`Gemini minutes extraction failed: ${await geminiRes.text()}`);
      }

      const geminiData = await geminiRes.json();
      const text = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
      const parsed = JSON.parse(text.trim());

      return new Response(JSON.stringify(parsed), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Handle AJAX Action: emit event manually from Edge Function context
    if (action === "emit-event") {
      const { event_type, entity_type, entity_id, project_id, payload } = body;
      const { data, error } = await supabase
        .from("system_events")
        .insert({ event_type, entity_type, entity_id, project_id, payload })
        .select()
        .single();
      
      if (error) throw error;
      
      // process newly inserted event
      return new Response(JSON.stringify({ success: true, event_id: data.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    if (!event_id) {
      return new Response(JSON.stringify({ error: "Missing event_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // 1. Fetch system event details
    const { data: event, error: eventErr } = await supabase
      .from("system_events")
      .select("*")
      .eq("id", event_id)
      .single();

    if (eventErr || !event) {
      throw new Error(`Event not found: ${eventErr?.message || "Unknown error"}`);
    }

    // 2. Load and execute Task Rules (Auto-generated Tasks)
    const { data: taskRules } = await supabase
      .from("task_rules")
      .select("*")
      .eq("event_type", event.event_type)
      .eq("is_active", true);

    for (const rule of taskRules || []) {
      const assignees = await resolveRecipientIds(supabase, rule.assignee_strategy, rule.assignee_value, event);
      
      for (const assigneeId of assignees) {
        // Calculate task due date using Asia/Dubai business hours
        const dueDate = calculateDueDate(new Date(), rule.due_hours);

        // Replace templates
        const title = replaceTemplates(rule.title_template, event);
        const description = replaceTemplates(rule.description_template, event);

        // Verify if project_id exists in projects table
        let validatedProjectId = null;
        if (event.project_id) {
          const { data: projRecord } = await supabase
            .from("projects")
            .select("id")
            .eq("id", event.project_id)
            .single();
          if (projRecord) {
            validatedProjectId = event.project_id;
          }
        }

        try {
          await supabase
            .from("tasks")
            .insert({
              title,
              description,
              origin: "AUTO_RULE",
              source_event_id: event.id,
              task_rule_id: rule.id,
              project_id: validatedProjectId,
              linked_entity_type: event.entity_type,
              linked_entity_id: event.entity_id,
              assignee_id: assigneeId,
              created_by: event.actor_user_id || assigneeId, // fallbacks
              priority: rule.priority,
              due_date: dueDate.toISOString(),
              status: "TODO"
            });
        } catch (err: any) {
          // Log unique constraint failures gracefully (idempotency check)
          console.warn("Task insertion skipped (likely duplicate):", err.message);
        }
      }
    }

    // Handle Task Auto-completion
    // If there is any rule where auto_complete_on_event is this event, close matching pending tasks
    const { data: autoCloseRules } = await supabase
      .from("task_rules")
      .select("id")
      .eq("auto_complete_on_event", event.event_type);

    if (autoCloseRules && autoCloseRules.length > 0) {
      const ruleIds = autoCloseRules.map(r => r.id);
      
      // Auto-complete tasks linked to the same entity
      await supabase
        .from("tasks")
        .update({
          status: "DONE_AUTO",
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .in("task_rule_id", ruleIds)
        .eq("linked_entity_id", event.entity_id)
        .in("status", ["TODO", "IN_PROGRESS", "BLOCKED"]);
      
      // Cancel corresponding escalation timers by resolving all system events for this entity
      const { data: relatedEvents } = await supabase
        .from("system_events")
        .select("id")
        .eq("entity_id", event.entity_id);
      
      if (relatedEvents && relatedEvents.length > 0) {
        const eventIds = relatedEvents.map((e: any) => e.id);
        await supabase
          .from("escalation_timers")
          .update({ cancelled: true })
          .in("event_id", eventIds);
      }
    }

    // 3. Load and execute Notification Rules
    const { data: notificationRules } = await supabase
      .from("notification_rules")
      .select("*")
      .eq("event_type", event.event_type)
      .eq("is_active", true);

    for (const rule of notificationRules || []) {
      const recipients = await resolveRecipientIds(supabase, rule.recipient_strategy, rule.recipient_value, event);

      for (const rId of recipients) {
        // A. Check user delivery preferences
        const eventModule = event.event_type.split(".")[0].toUpperCase();
        
        // Fetch preferences
        const { data: pref } = await supabase
          .from("user_notification_preferences")
          .select("*")
          .eq("user_id", rId)
          .eq("event_module", eventModule);

        for (const channel of rule.channels) {
          const channelPref = (pref || []).find(p => p.channel === channel);
          const deliveryMode = channelPref ? channelPref.mode : getDefaultPreference(channel, rule.severity);

          if (deliveryMode === "OFF") continue;

          // Replace templates
          const title = replaceTemplates(rule.title_template, event);
          const body = replaceTemplates(rule.body_template, event);
          const link = replaceTemplates(rule.link_template, event);

          if (deliveryMode === "INSTANT") {
            let status = "PENDING";
            if (channel === "WHATSAPP") {
              const { data: ws } = await supabase
                .from("whatsapp_settings")
                .select("whatsapp_enabled")
                .single();
              
              if (!ws || !ws.whatsapp_enabled) {
                status = "SKIPPED_CHANNEL_INACTIVE";
              }
            }

            const { data: notif } = await supabase
              .from("notifications")
              .insert({
                user_id: rId,
                event_id: event.id,
                channel,
                severity: rule.severity,
                title,
                body,
                link,
                status
              })
              .select()
              .single();

            // Trigger Resend Edge Function if email channel instant via explicit fetch
            if (channel === "EMAIL" && notif) {
              const invokeUrl = `${supabaseUrl}/functions/v1/send-email`;
              await fetch(invokeUrl, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "Authorization": `Bearer ${supabaseAnonKey}`,
                  "apikey": supabaseAnonKey
                },
                body: JSON.stringify({ notification_id: notif.id })
              })
              .then(async (res) => {
                if (!res.ok) {
                  console.error(`Failed to invoke send-email (status ${res.status}): ${await res.text()}`);
                }
              })
              .catch((err: any) => console.error("send-email fetch failed:", err));
            }

            // Trigger send-whatsapp Edge Function if whatsapp channel instant via explicit fetch
            if (channel === "WHATSAPP" && status === "PENDING" && notif) {
              const invokeUrl = `${supabaseUrl}/functions/v1/send-whatsapp`;
              await fetch(invokeUrl, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "Authorization": `Bearer ${supabaseAnonKey}`,
                  "apikey": supabaseAnonKey
                },
                body: JSON.stringify({ notification_id: notif.id })
              })
              .then(async (res) => {
                if (!res.ok) {
                  console.error(`Failed to invoke send-whatsapp (status ${res.status}): ${await res.text()}`);
                }
              })
              .catch((err: any) => console.error("send-whatsapp fetch failed:", err));
            }
          } else if (deliveryMode === "DIGEST" && rule.is_digest_eligible) {
            // Queue for digest daily rollup: set status to PENDING but label as digest roll later
            // (Daily digest cron reads all pending eligibility records)
            try {
              await supabase
                .from("notifications")
                .insert({
                  user_id: rId,
                  event_id: event.id,
                  channel,
                  severity: rule.severity,
                  title,
                  body,
                  link,
                  status: "PENDING"
                });
            } catch (e) {
              // Ignore duplicates
            }
          }
        }
      }

      // B. Create escalation timer if configured
      if (rule.escalation_hours && rule.escalation_hours > 0) {
        const escalateAt = calculateDueDate(new Date(), rule.escalation_hours);
        
        try {
          await supabase
            .from("escalation_timers")
            .insert({
              event_id: event.id,
              notification_rule_id: rule.id,
              escalate_at: escalateAt.toISOString()
            });
        } catch (e) {
          // Ignore duplicates
        }
      }
    }

    // 4. Mark event as processed
    await supabase
      .from("system_events")
      .update({ processed_at: new Date().toISOString() })
      .eq("id", event.id);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error: any) {
    console.error("Event processing failed:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});

// ============================================================
// HELPER ROUTINES
// ============================================================

function replaceTemplates(template: string, event: any): string {
  if (!template) return "";
  return template
    .replace(/\{\{\s*payload\.(\w+)\s*\}\}/g, (_, key) => {
      return event.payload?.[key] !== undefined ? String(event.payload[key]) : "";
    })
    .replace(/\{\{\s*entity_id\s*\}\}/g, event.entity_id || "")
    .replace(/\{\{\s*project_id\s*\}\}/g, event.project_id || "");
}

async function resolveRecipientIds(supabase: any, strategy: string, val: string | undefined, event: any): Promise<string[]> {
  const list: string[] = [];

  if (strategy === "ROLE" && val) {
    const { data } = await supabase
      .from("profiles")
      .select("id")
      .eq("role", val);
    if (data) list.push(...data.map((d: any) => d.id));
  } else if (strategy === "PREPARED_BY") {
    // Look up who prepared the entity
    if (event.entity_type === "QUOTATION") {
      const { data } = await supabase.from("quotations").select("prepared_by").eq("id", event.entity_id).single();
      if (data?.prepared_by) list.push(data.prepared_by);
    } else if (event.entity_type === "COMPARISON") {
      const { data } = await supabase.from("supplier_comparisons").select("created_by").eq("id", event.entity_id).single();
      if (data?.created_by) list.push(data.created_by);
    } else if (event.entity_type === "PROJECT") {
      const { data } = await supabase.from("projects").select("created_by").eq("id", event.entity_id).single();
      if (data?.created_by) list.push(data.created_by);
    }
  } else if (strategy === "PROJECT_ROLE" && val && event.project_id) {
    // project_manager or site_engineer
    const colName = (val === "project_manager") ? "project_manager_id" : "site_engineer_id";
    const { data } = await supabase.from("projects").select(colName).eq("id", event.project_id).single();
    if (data && data[colName]) {
      list.push(data[colName]);
    }
  } else if (strategy === "SPECIFIC_USER_FROM_PAYLOAD" && val) {
    const item = event.payload?.[val];
    if (Array.isArray(item)) {
      list.push(...item);
    } else if (item) {
      list.push(item);
    }
  }

  return [...new Set(list)]; // Deduplicate
}

function getDefaultPreference(channel: string, severity: string): string {
  if (channel === "IN_APP") return "INSTANT";
  if (channel === "EMAIL") {
    return (severity === "CRITICAL" || severity === "ACTION_REQUIRED") ? "INSTANT" : "DIGEST";
  }
  return "OFF";
}

// Business hour calculation copy (Asia/Dubai)
function calculateDueDate(start: Date, hoursToAdd: number): Date {
  let current = new Date(start.getTime());

  // Helper check
  const isWeekend = (d: Date) => {
    const gstTime = new Date(d.getTime() + GST_OFFSET);
    const day = gstTime.getUTCDay();
    return day === 5 || day === 6; // Fri, Sat
  };

  const shiftToStartOfNextDay = (d: Date) => {
    const gstTime = new Date(d.getTime() + GST_OFFSET);
    const nextDay = new Date(Date.UTC(
      gstTime.getUTCFullYear(),
      gstTime.getUTCMonth(),
      gstTime.getUTCDate() + 1,
      8,
      0
    ));
    return new Date(nextDay.getTime() - GST_OFFSET);
  };

  // Skip starting on weekend
  if (isWeekend(current)) {
    const gstTime = new Date(current.getTime() + GST_OFFSET);
    current = new Date(Date.UTC(gstTime.getUTCFullYear(), gstTime.getUTCMonth(), gstTime.getUTCDate(), 8, 0) - GST_OFFSET);
    while (isWeekend(current)) {
      current = shiftToStartOfNextDay(current);
    }
  } else {
    const gstTime = new Date(current.getTime() + GST_OFFSET);
    const hour = gstTime.getUTCHours();
    if (hour < 8) {
      current = new Date(Date.UTC(gstTime.getUTCFullYear(), gstTime.getUTCMonth(), gstTime.getUTCDate(), 8, 0) - GST_OFFSET);
    } else if (hour >= 18) {
      current = shiftToStartOfNextDay(current);
      while (isWeekend(current)) {
        current = shiftToStartOfNextDay(current);
      }
    }
  }

  let remaining = hoursToAdd;
  while (remaining > 0) {
    const gstTime = new Date(current.getTime() + GST_OFFSET);
    const hour = gstTime.getUTCHours();
    const minutes = gstTime.getUTCMinutes();
    const hoursLeftToday = 18 - (hour + minutes / 60);

    if (remaining <= hoursLeftToday) {
      current = new Date(current.getTime() + Math.round(remaining * 60) * 60 * 1000);
      remaining = 0;
    } else {
      remaining -= hoursLeftToday;
      current = shiftToStartOfNextDay(current);
      while (isWeekend(current)) {
        current = shiftToStartOfNextDay(current);
      }
    }
  }

  return current;
}
