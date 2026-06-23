// POST /api/intelligence/process — drain the event ledger through the engines.
import { NextResponse } from 'next/server';
import { processUnprocessedEvents } from '@/lib/intelligence/event-processor';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const summary = await processUnprocessedEvents();
    return NextResponse.json({ ok: true, summary });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message ?? String(err) }, { status: 500 });
  }
}
