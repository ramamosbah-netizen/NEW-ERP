'use client';

// ============================================================
// AURA 0.2 — Client emit helper (server-resolved company_id).
//
// Emits an event through the server route (/api/events/emit) so that company_id
// and actor are resolved/verified on the SERVER from the signed-in user's
// membership. Prefer this over the legacy direct-insert in `eventService` for
// any new or intelligence-relevant emitters.
//
// `requestedCompanyId` is only a hint (the active company from the switcher);
// the server overrides it if the user is not a member.
// ============================================================

import { supabase } from '@/lib/supabase';

export interface EmitOptions {
  eventType: string;
  entityType?: string;
  entityId?: string;
  projectId?: string;
  payload?: Record<string, any>;
  requestedCompanyId?: string | null;
  eventVersion?: number;
}

export interface EmitResult {
  ok: boolean;
  event?: Record<string, any>;
  company_id?: string | null;
  error?: string;
}

export async function emitEvent(opts: EmitOptions): Promise<EmitResult> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) return { ok: false, error: 'Not authenticated' };

  const res = await fetch('/api/events/emit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(opts),
  });
  return res.json() as Promise<EmitResult>;
}
