'use client';

// ============================================================
// Aura ERP — Security Center
// Three safe, read/config-only surfaces:
//   1) Maker-checker policy — which workflow modules enforce creator<>approver
//      (writes the security.maker_checker_modules setting consumed by the RLS/
//       workflow layer; no service-role, no DB writes beyond the setting)
//   2) High-risk activity — governance-sensitive events from audit_log
//   3) Security posture — what is strict (DB-enforced) vs configurable
// The full write-heavy RLS harness stays CLI (scripts/security-audit.mjs).
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import settingsService from '@/services/settingsService';
import { MODULE_CATALOG } from '@/types/platform.types';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ShieldCheck, AlertTriangle, Save, Lock, Activity } from 'lucide-react';

const MC_KEY = 'security.maker_checker_modules';
const STRICT_DEFAULT = ['INV', 'SINV', 'PROFORMA', 'PAYMENT_REQ', 'BUDGET', 'PETTY_CASH', 'EXP'];

const fmtAgo = (iso: string) => {
  if (!iso) return '';
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000), h = Math.floor(m / 60), d = Math.floor(h / 24);
  return d > 0 ? `${d}d ago` : h > 0 ? `${h}h ago` : m > 0 ? `${m}m ago` : 'just now';
};
const RISK_COLOR: Record<string, string> = {
  DELETE: 'var(--status-danger-text)', OVERRIDE: 'var(--status-danger-text)', REJECT: 'var(--status-warning-text)',
  APPROVE: 'var(--accent)', CREATE: 'var(--status-success-text)', UPDATE: 'var(--status-info-text)',
};

export default function SecurityCenterPage() {
  const [selected, setSelected] = useState<Set<string>>(new Set(STRICT_DEFAULT));
  const [savedSet, setSavedSet] = useState<string[]>(STRICT_DEFAULT);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState(false);
  const [events, setEvents] = useState<any[]>([]);
  const [names, setNames] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const mc = await settingsService.getSettingByKey<string[]>(MC_KEY, STRICT_DEFAULT);
      const arr = Array.isArray(mc) && mc.length ? mc : STRICT_DEFAULT;
      setSelected(new Set(arr)); setSavedSet(arr);

      const { data } = await supabase
        .from('audit_log')
        .select('occurred_at, action, entity_type, entity_label, actor_user_id, actor_role, module, summary')
        .or('action.in.(DELETE,OVERRIDE,APPROVE,REJECT),entity_type.in.(ROLE,USER_ACCOUNT,SYSTEM_SETTING,WORKFLOW,WORKFLOW_INSTANCE)')
        .order('occurred_at', { ascending: false })
        .limit(60);
      const evs = data || [];
      setEvents(evs);
      const ids = [...new Set(evs.map((e: any) => e.actor_user_id).filter(Boolean))] as string[];
      if (ids.length) {
        const { data: p } = await supabase.from('profiles').select('id, full_name').in('id', ids);
        setNames(new Map((p || []).map((x: any) => [x.id, x.full_name])));
      }
      setError(null);
    } catch (e: any) { setError(e.message); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const toggle = (key: string) => setSelected(s => { const n = new Set(s); n.has(key) ? n.delete(key) : n.add(key); return n; });
  const dirty = JSON.stringify([...selected].sort()) !== JSON.stringify([...savedSet].sort());

  const save = async () => {
    setSaving(true); setError(null);
    try {
      const arr = [...selected];
      await settingsService.updateSetting(MC_KEY, arr);
      setSavedSet(arr); setSavedMsg(true); setTimeout(() => setSavedMsg(false), 2500);
    } catch (e: any) { setError(e.message); } finally { setSaving(false); }
  };

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Security Center"
        subtitle="Maker-checker policy, high-risk activity, and the platform's security posture"
        breadcrumbs={[{ label: 'Administration', href: '/admin/hub' }, { label: 'Security Center' }]}
      />

      {error && <div className="flex items-center gap-2 rounded-md border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] p-3 text-sm text-[var(--status-danger-text)]"><AlertTriangle size={16} /> {error}</div>}

      {/* 1. Maker-checker policy */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]"><Lock size={16} className="text-[var(--accent)]" /> Maker-checker enforcement</div>
          <div className="flex items-center gap-2">
            {savedMsg && <span className="text-xs text-[var(--status-success-text)]">Saved</span>}
            <Button size="sm" icon={Save} disabled={!dirty || saving} onClick={save}>{saving ? 'Saving…' : 'Save policy'}</Button>
          </div>
        </div>
        <p className="text-xs text-[var(--text-secondary)] mb-3">
          On these modules, the creator of a record cannot also approve it. Other workflows stay flexible. Changes take effect within ~1 minute. Money controls (RLS, GL) remain enforced in the database regardless.
        </p>
        {loading ? <div className="text-xs text-[var(--text-tertiary)]">Loading…</div> : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {MODULE_CATALOG.map(m => {
              const on = selected.has(m.key);
              return (
                <button key={m.key} onClick={() => toggle(m.key)}
                  className="flex items-center gap-2 text-left rounded-md border p-2 transition-colors"
                  style={{ borderColor: on ? 'var(--accent)' : 'var(--border-color)', background: on ? 'var(--surface-active)' : 'transparent' }}>
                  <span className="w-3.5 h-3.5 rounded-sm flex-shrink-0 flex items-center justify-center" style={{ background: on ? 'var(--accent)' : 'transparent', border: on ? 'none' : '1px solid var(--border-color)' }}>
                    {on && <ShieldCheck size={11} className="text-white" />}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-xs font-medium text-[var(--text-primary)] truncate">{m.label}</span>
                    <span className="block text-[10px] font-mono text-[var(--text-tertiary)]">{m.key}</span>
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </Card>

      {/* 2. High-risk activity */}
      <Card className="p-0 overflow-hidden">
        <div className="px-4 py-3 border-b border-[var(--border-color)] flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]"><Activity size={16} className="text-[var(--accent)]" /> High-risk activity</div>
        {loading ? <div className="p-6 text-center text-xs text-[var(--text-tertiary)]">Loading…</div> : events.length === 0 ? (
          <div className="p-6 text-center text-xs text-[var(--text-tertiary)]">No governance-sensitive events recorded.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-[var(--border-color)] text-left text-xs text-[var(--text-tertiary)]"><th className="p-3">When</th><th className="p-3">Actor</th><th className="p-3">Action</th><th className="p-3">Entity</th><th className="p-3">Detail</th></tr></thead>
              <tbody>
                {events.map((e, i) => (
                  <tr key={i} className="border-b border-[var(--border-color)] last:border-0">
                    <td className="p-3 text-xs text-[var(--text-tertiary)] whitespace-nowrap">{fmtAgo(e.occurred_at)}</td>
                    <td className="p-3 text-xs">{e.actor_user_id ? (names.get(e.actor_user_id) || e.actor_role || '—') : (e.actor_role || 'System')}</td>
                    <td className="p-3"><span className="text-xs font-semibold" style={{ color: RISK_COLOR[e.action] || 'var(--text-secondary)' }}>{e.action}</span></td>
                    <td className="p-3 text-xs text-[var(--text-secondary)]">{e.entity_type}{e.entity_label ? ` · ${e.entity_label}` : ''}</td>
                    <td className="p-3 text-xs text-[var(--text-tertiary)] max-w-[320px] truncate">{e.summary}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* 3. Posture */}
      <Card className="p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)] mb-3"><ShieldCheck size={16} className="text-[var(--accent)]" /> Security posture</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div>
            <div className="font-semibold text-[var(--text-primary)] mb-1">Strict (DB-enforced)</div>
            <ul className="list-disc pl-4 space-y-1 text-[var(--text-secondary)]">
              <li>Finance writes restricted to finance roles (RLS)</li>
              <li>Payroll / compensation read+write restricted to HR (RLS)</li>
              <li>Invoice / payment / retention integrity triggers</li>
              <li>GL: balanced posting, period lock, posted-entry immutability</li>
              <li>Workflow override gated + audited (workflow.override)</li>
            </ul>
          </div>
          <div>
            <div className="font-semibold text-[var(--text-primary)] mb-1">Configurable (here / settings)</div>
            <ul className="list-disc pl-4 space-y-1 text-[var(--text-secondary)]">
              <li>Maker-checker modules (above)</li>
              <li>Role capabilities (Access Control → Manage Roles)</li>
              <li>Password rules &amp; session timeout (Settings → Security)</li>
              <li>Operational tables stay open to authenticated users</li>
            </ul>
          </div>
        </div>
        <p className="text-[11px] text-[var(--text-tertiary)] mt-3">Full role-by-role RLS verification runs via <code>node scripts/security-audit.mjs</code> (uses the service-role key; run from a trusted environment, not the browser).</p>
      </Card>
    </div>
  );
}
