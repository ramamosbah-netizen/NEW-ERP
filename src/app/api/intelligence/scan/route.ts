// POST /api/intelligence/scan — poll CORE for temporal risk conditions and emit
// the matching events into system_events. Then POST /api/intelligence/process
// scores them into alerts. (Intended to be called on a schedule + on demand.)
import { NextResponse } from 'next/server';
import { scanCoreSignals } from '@/lib/intelligence/signal-scan';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const summary = await scanCoreSignals();
    return NextResponse.json({ ok: true, summary });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message ?? String(err) }, { status: 500 });
  }
}
