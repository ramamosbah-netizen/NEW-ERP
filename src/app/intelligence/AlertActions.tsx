'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { allowedActions } from '@/lib/intelligence/risk-contract';
import type { RiskAction, RiskStatus } from '@/types/intelligence.types';

const LABEL: Record<RiskAction, string> = {
  acknowledge: 'Ack',
  resolve: 'Resolve',
  dismiss: 'Dismiss',
};

export default function AlertActions({ alertId, status }: { alertId: string; status: RiskStatus }) {
  const router = useRouter();
  const [busy, setBusy] = useState<RiskAction | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // UI affordances DERIVE from the contract — never hardcoded, so they can't drift.
  const available = allowedActions(status);
  if (available.length === 0) return null;

  async function run(action: RiskAction) {
    setBusy(action);
    setErr(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) { setErr('Not signed in'); return; }
      const res = await fetch('/api/intelligence/alert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ alertId, action }),
      });
      const json = await res.json();
      if (json.ok) router.refresh();
      else setErr(json.error || 'Failed');
    } catch (e: any) {
      setErr(e?.message ?? 'Failed');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex items-center gap-1.5 flex-shrink-0">
      {err && <span className="text-[0.625rem] text-[var(--error)] mr-1 max-w-[10rem] truncate">{err}</span>}
      {available.map(a => (
        <button
          key={a}
          onClick={() => run(a)}
          disabled={!!busy}
          className="px-2 py-0.5 rounded text-[0.625rem] font-medium border border-[var(--border-color)] text-[var(--text-secondary)] hover:border-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors disabled:opacity-50"
        >
          {busy === a ? '…' : LABEL[a]}
        </button>
      ))}
    </div>
  );
}
