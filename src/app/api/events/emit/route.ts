// ============================================================
// POST /api/events/emit — the canonical SERVER-SIDE event emit path.
//
// Flow:  user (bearer token) → verify identity server-side → resolve company_id
//        server-side from membership → write to system_events ledger.
//
// Frontends should emit through THIS route (via lib/events/emit-client) rather
// than inserting events directly, so company_id + actor are server-authoritative
// and the Intelligence layer downstream is never fed a spoofed company.
// ============================================================

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import supabaseAdmin from '@/lib/supabaseAdmin';
import { resolveCompanyIdForUser } from '@/lib/company/serverCompany';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
    if (!token) {
      return NextResponse.json({ ok: false, error: 'Missing bearer token' }, { status: 401 });
    }

    // Identity is verified with the USER'S OWN token (never the service role).
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anon) {
      return NextResponse.json({ ok: false, error: 'Supabase env not configured' }, { status: 500 });
    }
    const asUser = createClient(url, anon, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: { user }, error: authErr } = await asUser.auth.getUser();
    if (authErr || !user) {
      return NextResponse.json({ ok: false, error: 'Invalid session' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({} as Record<string, any>));
    const {
      eventType, entityType, entityId, projectId,
      payload = {}, requestedCompanyId = null, eventVersion = 1,
    } = body ?? {};
    if (!eventType || typeof eventType !== 'string') {
      return NextResponse.json({ ok: false, error: 'eventType is required' }, { status: 400 });
    }

    // company_id resolved SERVER-SIDE from membership — not trusted blindly from the client.
    const companyId = await resolveCompanyIdForUser(user.id, requestedCompanyId);

    const { data, error } = await supabaseAdmin
      .from('system_events')
      .insert({
        event_type: eventType,
        entity_type: entityType ?? null,
        entity_id: entityId ?? null,
        project_id: projectId ?? null,
        payload,
        actor_user_id: user.id,
        company_id: companyId,
        event_version: eventVersion,
      })
      .select()
      .single();
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, event: data, company_id: companyId });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message ?? String(err) }, { status: 500 });
  }
}
