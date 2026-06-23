// ============================================================
// POST /api/intelligence/alert — risk-alert lifecycle transition (ACTIVE, Batch 2).
// Token-verified user → company membership check → dispatch THROUGH risk-contract.
// This route never mutates alert state directly — every change goes via a command.
// Body: { alertId, action: 'acknowledge'|'resolve'|'dismiss', note? }
// ============================================================

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { dispatchAlertCommand } from '@/lib/intelligence/risk-contract';
import { makeSupabaseAlertStore } from '@/lib/intelligence/risk-alert-store';
import { alertCompany } from '@/lib/intelligence/intelligence-service';
import { isCompanyAccessible } from '@/lib/company/serverCompany';
import type { RiskAction } from '@/types/intelligence.types';

export const dynamic = 'force-dynamic';

const ACTIONS: RiskAction[] = ['acknowledge', 'resolve', 'dismiss'];

export async function POST(req: Request) {
  try {
    const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
    if (!token) return NextResponse.json({ ok: false, error: 'Missing bearer token' }, { status: 401 });

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anon) return NextResponse.json({ ok: false, error: 'Supabase env not configured' }, { status: 500 });

    const asUser = createClient(url, anon, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: { user }, error: authErr } = await asUser.auth.getUser();
    if (authErr || !user) return NextResponse.json({ ok: false, error: 'Invalid session' }, { status: 401 });

    const body = await req.json().catch(() => ({} as Record<string, any>));
    const alertId = typeof body?.alertId === 'string' ? body.alertId : '';
    const action = body?.action as RiskAction;
    const note = typeof body?.note === 'string' ? body.note : undefined;
    if (!alertId || !ACTIONS.includes(action)) {
      return NextResponse.json({ ok: false, error: 'alertId and a valid action are required' }, { status: 400 });
    }

    // Company isolation: the user must belong to the alert's company.
    const companyId = await alertCompany(alertId);
    if (companyId === undefined) return NextResponse.json({ ok: false, error: 'Alert not found' }, { status: 404 });
    if (!(await isCompanyAccessible(user.id, companyId))) {
      return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
    }

    // Single mutation gateway: contract validates the transition, the injected
    // Supabase store performs the only DB write. No inline state mutation here.
    const store = makeSupabaseAlertStore();
    const result = await dispatchAlertCommand(store, alertId, action, { actorId: user.id, note });
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message ?? String(err) }, { status: 500 });
  }
}
