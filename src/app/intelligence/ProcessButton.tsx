'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Cpu } from 'lucide-react';

export default function ProcessButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/intelligence/process', { method: 'POST' });
      const json = await res.json();
      if (json.ok) {
        const s = json.summary;
        setMsg(`Processed ${s.processed} event(s) → ${s.riskAlerts} alerts, ${s.recommendations} recs, ${s.insights} insights`);
        router.refresh();
      } else {
        setMsg(json.error || 'Failed');
      }
    } catch (e: any) {
      setMsg(e?.message ?? 'Failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      {msg && <span className="text-xs text-[var(--text-muted)] max-w-[22rem] truncate">{msg}</span>}
      <button
        onClick={run}
        disabled={busy}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--text-primary)] hover:border-[var(--text-muted)] transition-colors disabled:opacity-50"
      >
        <Cpu size={14} /> {busy ? 'Analyzing…' : 'Run analysis'}
      </button>
    </div>
  );
}
