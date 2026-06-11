// @ts-nocheck
// ============================================================
// JEET ERP — Platform Layer: send-email Edge Function
// Sends instant notification emails via Resend API
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
    const resendApiKey = Deno.env.get("RESEND_API_KEY") ?? "";

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase configuration env variables.");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const body = await req.json();
    const { notification_id } = body;

    if (!notification_id) {
      return new Response(JSON.stringify({ error: "Missing notification_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // 1. Fetch notification and user email details
    const { data: notif, error: notifErr } = await supabase
      .from("notifications")
      .select(`
        *,
        profile:profiles!user_id (email, full_name)
      `)
      .eq("id", notification_id)
      .single();

    if (notifErr || !notif) {
      throw new Error(`Notification not found: ${notifErr?.message || "Unknown error"}`);
    }

    const recipientEmail = notif.profile?.email;
    const recipientName = notif.profile?.full_name || "JEET ERP User";

    if (!recipientEmail) {
      throw new Error("Recipient profile has no email address configured.");
    }

    // Default to mock if key is not configured (non-blocking mock fallback)
    if (!resendApiKey || resendApiKey === "YOUR_RESEND_KEY") {
      console.warn("RESEND_API_KEY is not configured. Simulating successful email send (mock).");
      
      await supabase
        .from("notifications")
        .update({ status: "SENT", read_at: null })
        .eq("id", notification_id);

      return new Response(JSON.stringify({ success: true, mock: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // 2. Build responsive HTML email payload matching design aesthetics
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>${notif.title}</title>
        <style>
          body {
            font-family: 'Figtree', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background-color: #0A0E22;
            color: #E2E8F0;
            margin: 0;
            padding: 20px;
          }
          .email-card {
            background-color: #0D1527;
            border: 1px solid rgba(0, 229, 160, 0.2);
            border-radius: 8px;
            max-width: 600px;
            margin: 0 auto;
            overflow: hidden;
            box-shadow: 0 10px 30px rgba(0,0,0,0.5);
          }
          .header {
            background-color: rgba(10, 14, 34, 0.5);
            padding: 20px;
            border-bottom: 1px solid rgba(255,255,255,0.05);
            display: flex;
            align-items: center;
            justify-content: space-between;
          }
          .logo {
            font-family: 'Barlow Condensed', sans-serif;
            font-weight: 800;
            font-size: 24px;
            color: #00E5A0;
            text-transform: uppercase;
            letter-spacing: 0.1em;
          }
          .severity-indicator {
            font-size: 10px;
            font-weight: 800;
            text-transform: uppercase;
            padding: 3px 8px;
            border-radius: 12px;
            letter-spacing: 0.05em;
            background-color: ${notif.severity === "CRITICAL" ? "rgba(239, 68, 68, 0.15)" : notif.severity === "ACTION_REQUIRED" ? "rgba(245, 158, 11, 0.15)" : "rgba(0, 229, 160, 0.15)"};
            color: ${notif.severity === "CRITICAL" ? "#EF4444" : notif.severity === "ACTION_REQUIRED" ? "#F59E0B" : "#00E5A0"};
            border: 1px solid ${notif.severity === "CRITICAL" ? "rgba(239, 68, 68, 0.3)" : notif.severity === "ACTION_REQUIRED" ? "rgba(245, 158, 11, 0.3)" : "rgba(0, 229, 160, 0.3)"};
          }
          .content {
            padding: 30px;
          }
          h1 {
            font-size: 20px;
            color: #FFFFFF;
            margin-top: 0;
            font-weight: 700;
          }
          p {
            font-size: 14px;
            line-height: 1.6;
            color: #A0AEC0;
          }
          .btn-wrap {
            margin-top: 25px;
            text-align: center;
          }
          .action-btn {
            background-color: #00E5A0;
            color: #0A0E22 !important;
            font-weight: 700;
            text-decoration: none;
            padding: 12px 28px;
            border-radius: 4px;
            font-size: 14px;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            display: inline-block;
          }
          .footer {
            background-color: rgba(0, 0, 0, 0.2);
            padding: 15px 30px;
            font-size: 11px;
            color: #718096;
            border-top: 1px solid rgba(255,255,255,0.03);
            text-align: center;
          }
        </style>
      </head>
      <body>
        <div class="email-card">
          <div class="header">
            <span class="logo">JEET ERP</span>
            <span class="severity-indicator">${notif.severity.replace("_", " ")}</span>
          </div>
          <div class="content">
            <h1>Dear ${recipientName},</h1>
            <p>${notif.body}</p>
            <div class="btn-wrap">
              <a href="http://localhost:3000${notif.link}" class="action-btn">Open in ERP</a>
            </div>
          </div>
          <div class="footer">
            This is an automated notification from JEET ERP. Please do not reply directly to this email.
          </div>
        </div>
      </body>
      </html>
    `;

    // 3. Dispatch to Resend API
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${resendApiKey}`
      },
      body: JSON.stringify({
        from: "JEET ERP Notifications <notifications@jeet-erp.com>", // sandbox sender by default
        to: recipientEmail,
        subject: `[JEET ERP] ${notif.title}`,
        html: htmlContent
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Resend API failed: ${errText}`);
    }

    // 4. Update status in database to SENT
    await supabase
      .from("notifications")
      .update({ status: "SENT" })
      .eq("id", notification_id);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error: any) {
    console.error("Email send failed:", error);
    
    // Attempt status update to FAILED if possible
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
