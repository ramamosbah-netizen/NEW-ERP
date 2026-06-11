// @ts-nocheck
// ============================================================
// JEET ERP — Platform Layer: leave-accrual Edge Function
// Scheduled monthly leave accumulator (run monthly on 1st)
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

    const today = new Date();
    const currentYear = today.getFullYear();

    // 1. Fetch active employees
    const { data: employees, error: empErr } = await supabase
      .from("employees")
      .select("id, full_name_en, employee_number, join_date")
      .eq("is_active", true)
      .eq("status", "ACTIVE");

    if (empErr) throw empErr;

    let updatedCount = 0;

    for (const emp of employees || []) {
      const joinDate = new Date(emp.join_date);
      
      // Calculate tenure in months
      const diffTime = Math.max(0, today.getTime() - joinDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      const tenureMonths = diffDays / 30; // approximate month division

      let monthlyAccrual = 0;

      if (tenureMonths >= 12) {
        // >= 1 year: 2.5 days per month (30 days/yr)
        monthlyAccrual = 2.5;
      } else if (tenureMonths >= 6) {
        // 6 months to 1 year: 2.0 days per month
        monthlyAccrual = 2.0;
      } else {
        // < 6 months: no accrual
        monthlyAccrual = 0;
      }

      if (monthlyAccrual > 0) {
        // Query current year annual leave balance
        const { data: balance, error: balErr } = await supabase
          .from("leave_balances")
          .select("*")
          .eq("employee_id", emp.id)
          .eq("year", currentYear)
          .eq("leave_type", "ANNUAL")
          .maybeSingle();

        if (balErr) {
          console.error(`Failed to fetch leave balance for ${emp.employee_number}:`, balErr);
          continue;
        }

        if (balance) {
          // Increment entitled days
          const newEntitled = Number(balance.entitled_days) + monthlyAccrual;
          const { error: updateErr } = await supabase
            .from("leave_balances")
            .update({ entitled_days: newEntitled })
            .eq("id", balance.id);

          if (!updateErr) updatedCount++;
        } else {
          // Create new balance record for the year
          const { error: insertErr } = await supabase
            .from("leave_balances")
            .insert({
              employee_id: emp.id,
              year: currentYear,
              leave_type: "ANNUAL",
              entitled_days: monthlyAccrual,
              taken_days: 0.0
            });

          if (!insertErr) updatedCount++;
        }
      }
    }

    return new Response(JSON.stringify({ success: true, accounts_accrued: updatedCount }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error: any) {
    console.error("Leave accrual calculation failed:", error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
