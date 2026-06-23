// ============================================================
// AURA 0.2 — Supabase RiskAlertStore (persistence adapter)
// The implementation BEHIND risk-contract.ts — the ONLY place alert-state DB
// writes happen. Server-only (service role). The contract stays infra-free;
// this adapter is the only thing that knows about Supabase or column names.
// ============================================================

import supabaseAdmin from '@/lib/supabaseAdmin';
import type { RiskStatus } from '@/types/intelligence.types';
import type { RiskAlertStore, AlertPatch } from '@/lib/intelligence/risk-contract';

export function makeSupabaseAlertStore(): RiskAlertStore {
  return {
    async getStatus(alertId: string): Promise<RiskStatus | null> {
      const { data, error } = await supabaseAdmin
        .from('intel_risk_alert')
        .select('status')
        .eq('id', alertId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data ? (data as { status: RiskStatus }).status : null;
    },

    async applyPatch(alertId: string, patch: AlertPatch): Promise<void> {
      const { error } = await supabaseAdmin
        .from('intel_risk_alert')
        .update(patch)
        .eq('id', alertId);
      if (error) throw new Error(error.message);
    },
  };
}
