// @ts-nocheck
// ============================================================
// JEET ERP — Platform Layer: meeting-reminders Edge Function
// Scheduled check running every 15 minutes to trigger starting_soon reminders.
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
    const supabaseUrl = (Deno.env.get("SUPABASE_URL") ?? "").trim();
    const supabaseServiceKey = (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "").trim();
    const supabaseAnonKey = (Deno.env.get("SUPABASE_ANON_KEY") ?? "").trim();

    if (!supabaseUrl || !supabaseServiceKey || !supabaseAnonKey) {
      throw new Error("Missing Supabase configuration.");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const now = new Date();
    const thirtyMinutesFromNow = new Date(now.getTime() + 30 * 60 * 1000);

    // 1. Fetch meetings starting soon
    const { data: meetings, error: fetchErr } = await supabase
      .from("meetings")
      .select("*")
      .eq("status", "SCHEDULED")
      .gt("starts_at", now.toISOString())
      .lte("starts_at", thirtyMinutesFromNow.toISOString());

    if (fetchErr) throw fetchErr;

    let reminderCount = 0;

    for (const meeting of meetings || []) {
      // 2. Avoid duplicate reminder check: check if meeting.starting_soon was already emitted
      const { data: existingEvent } = await supabase
        .from("system_events")
        .select("id")
        .eq("event_type", "meeting.starting_soon")
        .eq("entity_id", meeting.id)
        .limit(1);

      if (existingEvent && existingEvent.length > 0) {
        continue; // Reminder already sent
      }

      // 3. Get attendee list user IDs to put in payload
      const { data: attendees } = await supabase
        .from("meeting_attendees")
        .select("user_id")
        .eq("meeting_id", meeting.id)
        .not("user_id", "is", null);

      const attendeeIds = (attendees || []).map((a: any) => a.user_id);

      // 4. Emit starting_soon event
      const { data: newEvent } = await supabase
        .from("system_events")
        .insert({
          event_type: "meeting.starting_soon",
          entity_type: "MEETING",
          entity_id: meeting.id,
          project_id: meeting.project_id || null,
          payload: {
            meeting_id: meeting.id,
            title: meeting.title,
            starts_at: meeting.starts_at,
            location: meeting.location,
            attendees: attendeeIds
          }
        })
        .select()
        .single();

      if (newEvent) {
        // Trigger event processor via explicit fetch
        const invokeUrl = `${supabaseUrl}/functions/v1/process-event`;
        await fetch(invokeUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${supabaseAnonKey}`,
            "apikey": supabaseAnonKey
          },
          body: JSON.stringify({ event_id: newEvent.id })
        })
        .then(async (res) => {
          if (!res.ok) {
            console.error(`Failed to invoke process-event from reminders (status ${res.status}): ${await res.text()}`);
          }
        })
        .catch((err: any) => console.error("Reminder process fetch failed:", err));
      }

      reminderCount++;
    }

    return new Response(JSON.stringify({ success: true, reminders_sent: reminderCount }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error: any) {
    console.error("Meeting reminders check failed:", error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
