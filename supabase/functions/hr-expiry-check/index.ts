// @ts-nocheck
// ============================================================
// JEET ERP — Platform Layer: hr-expiry-check Edge Function
// Scheduled daily compliance scan for document expiries
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

  const _job = await startJobRun("hr-expiry-check");
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase configuration.");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split("T")[0];

    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setUTCDate(thirtyDaysFromNow.getUTCDate() + 30);
    const thirtyDaysFromNowStr = thirtyDaysFromNow.toISOString().split("T")[0];

    // Helper to calculate days remaining
    const getDaysRemaining = (expiryStr: string) => {
      const exp = new Date(expiryStr);
      const diff = exp.getTime() - today.getTime();
      return Math.ceil(diff / (1000 * 60 * 60 * 24));
    };

    // 1. Fetch active employees
    const { data: employees, error: empErr } = await supabase
      .from("employees")
      .select("id, full_name_en, employee_number, passport_expiry, emirates_id_expiry, visa_expiry, labour_card_expiry")
      .eq("is_active", true)
      .eq("status", "ACTIVE");

    if (empErr) throw empErr;

    let eventCount = 0;

    for (const emp of employees || []) {
      const docChecks = [
        { name: "Passport", expiry: emp.passport_expiry },
        { name: "Emirates ID", expiry: emp.emirates_id_expiry },
        { name: "Visa", expiry: emp.visa_expiry },
        { name: "Labour Card", expiry: emp.labour_card_expiry }
      ];

      for (const doc of docChecks) {
        if (!doc.expiry) continue;
        
        const daysLeft = getDaysRemaining(doc.expiry);

        if (doc.name === "Visa" && daysLeft <= 0) {
          // Critical visa violation
          const { data: event, error: eventErr } = await supabase
            .from("system_events")
            .insert({
              event_type: "hr.visa_expired_critical",
              entity_type: "EMPLOYEE",
              entity_id: emp.id,
              payload: {
                employee_name: emp.full_name_en,
                employee_number: emp.employee_number,
                document_name: doc.name,
                expiry_date: doc.expiry,
                days_overdue: Math.abs(daysLeft)
              }
            })
            .select()
            .single();

          if (!eventErr && event) {
            eventCount++;
            // Invoke fanout processor
            await supabase.functions.invoke("process-event", {
              body: { event_id: event.id }
            }).catch(e => console.error("Fanout failed:", e));
          }
        } else if (daysLeft > 0 && daysLeft <= 30) {
          // Document expiring event
          const { data: event, error: eventErr } = await supabase
            .from("system_events")
            .insert({
              event_type: "hr.document_expiring",
              entity_type: "EMPLOYEE",
              entity_id: emp.id,
              payload: {
                employee_name: emp.full_name_en,
                employee_number: emp.employee_number,
                document_name: doc.name,
                expiry_date: doc.expiry,
                days_remaining: daysLeft
              }
            })
            .select()
            .single();

          if (!eventErr && event) {
            eventCount++;
            // Invoke fanout processor
            await supabase.functions.invoke("process-event", {
              body: { event_id: event.id }
            }).catch(e => console.error("Fanout failed:", e));
          }
        }
      }
    }

    // 2. Fetch certifications expiring within 30 days
    const { data: certs, error: certErr } = await supabase
      .from("employee_certifications")
      .select(`
        *,
        employee:employees(id, full_name_en, employee_number)
      `)
      .gte("expiry_date", todayStr)
      .lte("expiry_date", thirtyDaysFromNowStr);

    if (certErr) throw certErr;

    for (const cert of certs || []) {
      const daysLeft = getDaysRemaining(cert.expiry_date);
      const empName = (cert.employee as any)?.full_name_en || "Employee";
      const empNumber = (cert.employee as any)?.employee_number || "";

      const { data: event, error: eventErr } = await supabase
        .from("system_events")
        .insert({
          event_type: "hr.document_expiring",
          entity_type: "EMPLOYEE",
          entity_id: cert.employee_id,
          payload: {
            employee_name: empName,
            employee_number: empNumber,
            document_name: `Certification: ${cert.cert_type.replace('_', ' ')}`,
            expiry_date: cert.expiry_date,
            days_remaining: daysLeft
          }
        })
        .select()
        .single();

      if (!eventErr && event) {
        eventCount++;
        await supabase.functions.invoke("process-event", {
          body: { event_id: event.id }
        }).catch(e => console.error("Fanout failed:", e));
      }
    }

    await finishJobRun(_job, "SUCCESS", { items_processed: eventCount });
    return new Response(JSON.stringify({ success: true, events_emitted: eventCount }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error: any) {
    console.error("HR expiry check failed:", error);
    await finishJobRun(_job, "FAILED", { error: error?.message ?? String(error) });
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
