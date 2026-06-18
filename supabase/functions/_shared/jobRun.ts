// @ts-nocheck
// ============================================================
// Aura ERP — shared edge-function run logger (System Health)
// Records one row per scheduled-job invocation in `system_jobs`.
//
// Design: completely FAIL-SAFE — it owns its own service-role client and
// swallows every error. If logging fails for any reason it must NEVER affect
// the job's real work. Usage in a function:
//
//   import { startJobRun, finishJobRun } from "../_shared/jobRun.ts";
//   const job = await startJobRun("escalation-check");
//   try {
//     ...work...
//     await finishJobRun(job, "SUCCESS", { items_processed: n });
//     return ok;
//   } catch (e) {
//     await finishJobRun(job, "FAILED", { error: e.message });
//     return error;
//   }
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.10.0";

function serviceClient() {
  try {
    const url = (Deno.env.get("SUPABASE_URL") ?? "").trim();
    const key = (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "").trim();
    if (!url || !key) return null;
    return createClient(url, key);
  } catch {
    return null;
  }
}

export async function startJobRun(jobName: string) {
  try {
    const sb = serviceClient();
    if (!sb) return null;
    const { data } = await sb
      .from("system_jobs")
      .insert({ job_name: jobName, status: "RUNNING", started_at: new Date().toISOString() })
      .select("id")
      .single();
    return data?.id ? { id: data.id, sb, startedAt: Date.now() } : null;
  } catch {
    return null;
  }
}

export async function finishJobRun(
  handle: { id: string; sb: any; startedAt: number } | null,
  status: "SUCCESS" | "FAILED",
  info: Record<string, unknown> = {},
) {
  try {
    if (!handle || !handle.id || !handle.sb) return;
    await handle.sb
      .from("system_jobs")
      .update({
        status,
        finished_at: new Date().toISOString(),
        duration_ms: Date.now() - (handle.startedAt || Date.now()),
        items_processed: typeof info.items_processed === "number" ? info.items_processed : null,
        error: status === "FAILED" ? String(info.error ?? "unknown error") : null,
        details: info,
      })
      .eq("id", handle.id);
  } catch {
    // fire-and-forget — logging must never break the job
  }
}
