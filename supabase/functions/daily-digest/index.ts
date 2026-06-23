// @ts-nocheck
// ============================================================
// JEET ERP — Platform Layer: daily-digest Edge Function
// Scheduled daily digest rollup (07:30 GST / 03:30 UTC Sun–Thu)
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

  const _job = await startJobRun("daily-digest");
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const resendApiKey = Deno.env.get("RESEND_API_KEY") ?? "";

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase configuration.");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Fetch all active users
    const { data: users, error: userError } = await supabase
      .from("profiles")
      .select("id, email, full_name, role");

    if (userError) throw userError;

    const todayStart = new Date();
    todayStart.setUTCHours(0,0,0,0);
    const todayEnd = new Date();
    todayEnd.setUTCHours(23,59,59,999);

    const yesterday = new Date();
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);

    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setUTCDate(thirtyDaysFromNow.getUTCDate() + 30);

    let sentCount = 0;

    for (const user of users || []) {
      // A. Query Pending Actions (ACTION_REQUIRED notifications)
      const { data: pendingActions } = await supabase
        .from("notifications")
        .select("title, body, link")
        .eq("user_id", user.id)
        .eq("severity", "ACTION_REQUIRED")
        .in("status", ["PENDING", "SENT", "DELIVERED"]);

      // B. Query Tasks Due Today / Overdue
      const { data: dueTasks } = await supabase
        .from("tasks")
        .select("title, due_date, priority")
        .eq("assignee_id", user.id)
        .eq("is_active", true)
        .in("status", ["TODO", "IN_PROGRESS", "BLOCKED"])
        .lte("due_date", todayEnd.toISOString());

      // C. Query Expiring Documents (next 30 days) on their projects
      // We look for projects where the user is project_manager or site_engineer
      const { data: myProjects } = await supabase
        .from("projects")
        .select("id")
        .or(`project_manager_id.eq.${user.id},site_engineer_id.eq.${user.id}`);

      const projectIds = (myProjects || []).map(p => p.id);
      let expiringDocs = [];
      if (projectIds.length > 0) {
        const { data: docs } = await supabase
          .from("documents")
          .select("title, expiry_date")
          .eq("entity_type", "PROJECT")
          .in("entity_id", projectIds)
          .eq("is_active", true)
          .gte("expiry_date", todayStart.toISOString().split("T")[0])
          .lte("expiry_date", thirtyDaysFromNow.toISOString().split("T")[0]);
        expiringDocs = docs || [];
      }

      // D. Query Meetings Scheduled for Today
      // Get meetings where user is listed as attendee
      const { data: myAttendances } = await supabase
        .from("meeting_attendees")
        .select("meeting_id")
        .eq("user_id", user.id);
      
      const meetingIds = (myAttendances || []).map(ma => ma.meeting_id);
      let meetingsToday = [];
      if (meetingIds.length > 0) {
        const { data: meetings } = await supabase
          .from("meetings")
          .select("title, starts_at, location")
          .in("id", meetingIds)
          .eq("status", "SCHEDULED")
          .gte("starts_at", todayStart.toISOString())
          .lte("starts_at", todayEnd.toISOString());
        meetingsToday = meetings || [];
      }

      // E. Query Project Status changes since yesterday
      const { data: statusChanges } = await supabase
        .from("project_status_history")
        .select(`
          from_status,
          to_status,
          comment,
          project:projects (name, project_number)
        `)
        .gte("changed_at", yesterday.toISOString());

      const formattedStatusChanges = (statusChanges || []).map((sc: any) => ({
        project_name: sc.project?.name || "Unknown Project",
        project_number: sc.project?.project_number || "",
        from_status: sc.from_status,
        to_status: sc.to_status,
        comment: sc.comment
      }));

      // Skip sending if digest has zero content across all categories
      const hasContent = 
        (pendingActions?.length ?? 0) > 0 || 
        (dueTasks?.length ?? 0) > 0 || 
        (expiringDocs?.length ?? 0) > 0 || 
        (meetingsToday?.length ?? 0) > 0 || 
        (formattedStatusChanges?.length ?? 0) > 0;

      if (!hasContent) continue;

      // 2. Build the HTML Email Markup
      let htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Your JEET ERP Daily Digest</title>
          <style>
            body { font-family: 'Figtree', sans-serif; background-color: #0A0E22; color: #E2E8F0; padding: 20px; }
            .card { background-color: #0D1527; border: 1px solid rgba(0,229,160,0.1); border-radius: 8px; max-width: 600px; margin: 0 auto; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
            .header { padding: 20px; border-bottom: 1px solid rgba(255,255,255,0.05); text-align: center; }
            .logo { font-size: 24px; font-weight: 800; color: #00E5A0; letter-spacing: 0.1em; }
            .subheader { font-size: 11px; color: #718096; text-transform: uppercase; margin-top: 5px; }
            .section { padding: 20px 30px; border-bottom: 1px solid rgba(255,255,255,0.03); }
            .section-title { font-size: 13px; font-weight: 800; color: #00E5A0; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 15px; }
            .item-title { font-size: 14px; font-weight: 700; color: #FFFFFF; }
            .item-desc { font-size: 13px; color: #A0AEC0; margin-top: 3px; }
            .item-meta { font-size: 11px; color: #718096; margin-top: 3px; }
            ul { padding-left: 15px; margin: 0; }
            li { margin-bottom: 12px; list-style-type: square; color: rgba(0,229,160,0.3); }
            li * { color: #E2E8F0; }
            .action-link { color: #22d3ee; text-decoration: none; font-weight: 600; }
            .footer { padding: 15px 30px; font-size: 11px; color: #718096; text-align: center; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="header">
              <div class="logo">JEET ERP</div>
              <div class="subheader">Daily Action Center Rollup</div>
            </div>
            <div class="content">
      `;

      // Section: Pending Approvals
      if (pendingActions && pendingActions.length > 0) {
        htmlContent += `
          <div class="section">
            <div class="section-title">Awaiting Approval</div>
            <ul>
              ${pendingActions.map(a => `
                <li>
                  <div class="item-title">${a.title}</div>
                  <div class="item-desc">${a.body}</div>
                  <div class="item-meta"><a href="http://localhost:3000${a.link}" class="action-link">Approve / Act &rarr;</a></div>
                </li>
              `).join("")}
            </ul>
          </div>
        `;
      }

      // Section: Tasks Due Today
      if (dueTasks && dueTasks.length > 0) {
        htmlContent += `
          <div class="section">
            <div class="section-title">Tasks Due Today / Overdue</div>
            <ul>
              ${dueTasks.map(t => `
                <li>
                  <div class="item-title">${t.title}</div>
                  <div class="item-meta">Priority: ${t.priority} | Due: ${t.due_date ? new Date(t.due_date).toLocaleDateString('en-GB') : "N/A"}</div>
                </li>
              `).join("")}
            </ul>
          </div>
        `;
      }

      // Section: Meetings Today
      if (meetingsToday && meetingsToday.length > 0) {
        htmlContent += `
          <div class="section">
            <div class="section-title">Meetings Today</div>
            <ul>
              ${meetingsToday.map(m => `
                <li>
                  <div class="item-title">${m.title}</div>
                  <div class="item-desc">Location: ${m.location || "Online"}</div>
                  <div class="item-meta">Starts: ${new Date(m.starts_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} GST</div>
                </li>
              `).join("")}
            </ul>
          </div>
        `;
      }

      // Section: Expiring Compliance Records
      if (expiringDocs.length > 0) {
        htmlContent += `
          <div class="section">
            <div class="section-title">Compliance Documents Expiring (30 Days)</div>
            <ul>
              ${expiringDocs.map(d => `
                <li>
                  <div class="item-title">${d.title}</div>
                  <div class="item-meta">Expiry Date: ${new Date(d.expiry_date).toLocaleDateString('en-GB')}</div>
                </li>
              `).join("")}
            </ul>
          </div>
        `;
      }

      // Section: Status Changes
      if (formattedStatusChanges.length > 0) {
        htmlContent += `
          <div class="section">
            <div class="section-title">Recent Project Status Changes</div>
            <ul>
              ${formattedStatusChanges.map(sc => `
                <li>
                  <div class="item-title">${sc.project_name} (${sc.project_number})</div>
                  <div class="item-desc">Transitioned from <strong>${sc.from_status}</strong> to <strong>${sc.to_status}</strong></div>
                  ${sc.comment ? `<div class="item-meta">Comment: "${sc.comment}"</div>` : ""}
                </li>
              `).join("")}
            </ul>
          </div>
        `;
      }

      htmlContent += `
            </div>
            <div class="footer">
              This is an aggregated daily digest compiled for your account. You can configure preference frequencies inside the ERP Portal.<br>
              JEET ERP © 2026. All rights reserved.
            </div>
          </div>
        </body>
        </html>
      `;

      // Send via Resend API
      if (resendApiKey && resendApiKey !== "YOUR_RESEND_KEY") {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${resendApiKey}`
          },
          body: JSON.stringify({
            from: "JEET ERP Digest <digest@jeet-erp.com>",
            to: user.email,
            subject: `[JEET ERP] Daily Digest Rollup - ${new Date().toLocaleDateString('en-GB')}`,
            html: htmlContent
          })
        });
      } else {
        console.log(`Mocking digest email dispatch for: ${user.email}`);
      }

      sentCount++;
    }

    await finishJobRun(_job, "SUCCESS", { items_processed: sentCount });
    return new Response(JSON.stringify({ success: true, emails_sent: sentCount }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error: any) {
    console.error("Daily digest generation failed:", error);
    await finishJobRun(_job, "FAILED", { error: error?.message ?? String(error) });
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
