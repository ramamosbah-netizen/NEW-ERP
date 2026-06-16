'use client';

// ============================================================
// JEET ERP — Project Budget status card (read-only, additive)
// Surfaces the budget ceiling / committed / available for a project using the
// project_budget_ceiling() + project_budget_committed() DB helpers, and shows
// whether the budget guard is enforced (blocks over-budget PO approval) or just
// advisory. Optional previewAmount shows the impact of approving a pending PO.
// Degrades to nothing if there's no project, no budget, or the migration
// (20260616221000) isn't applied yet — so it can be dropped onto any page.
// ============================================================

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Wallet, AlertTriangle, ShieldCheck, Info } from 'lucide-react';

interface Props {
  projectId?: string | null;
  /** e.g. a pending PO's total — renders the projected impact if approved. */
  previewAmount?: number;
  /** exclude this PO from the committed total (avoids double-counting). */
  excludePoId?: string;
  previewLabel?: string;
  title?: string;
}

const fmt = (n: number) =>
  new Intl.NumberFormat('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);

export default function ProjectBudgetCard({
  projectId,
  previewAmount = 0,
  excludePoId,
  previewLabel = 'If approved',
  title = 'Project Budget',
}: Props) {
  const [state, setState] = useState<{ ceiling: number; committed: number; enforced: boolean } | null>(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    let active = true;
    if (!projectId) { setLoading(false); setState(null); return; }
    (async () => {
      setLoading(true);
      try {
        const [ceilingRes, committedRes, projRes] = await Promise.all([
          supabase.rpc('project_budget_ceiling', { p_project: projectId }),
          supabase.rpc('project_budget_committed', { p_project: projectId, p_exclude_po: excludePoId ?? null }),
          supabase.from('projects').select('budget_enforced').eq('id', projectId).single(),
        ]);
        if (!active) return;
        if (ceilingRes.error || committedRes.error) { setUnavailable(true); return; }
        setState({
          ceiling: Number(ceilingRes.data) || 0,
          committed: Number(committedRes.data) || 0,
          enforced: !!(projRes.data as any)?.budget_enforced,
        });
      } catch {
        if (active) setUnavailable(true);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [projectId, excludePoId]);

  if (!projectId || unavailable || loading || !state || state.ceiling <= 0) return null;

  const { ceiling, committed, enforced } = state;
  const available = ceiling - committed;
  const preview = Number(previewAmount) || 0;
  const projected = committed + preview;
  const usedPct = Math.max(0, Math.min(100, (committed / ceiling) * 100));
  const projPct = Math.max(0, Math.min(100, (projected / ceiling) * 100));
  const over = projected > ceiling + 0.005;
  const accent = over ? 'var(--status-danger-text)' : projPct >= 90 ? 'var(--status-warning-text)' : 'var(--accent)';

  const cardStyle: React.CSSProperties = {
    background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px', padding: '1rem 1.1rem',
    display: 'flex', flexDirection: 'column', gap: '0.85rem',
  };
  const figLabel: React.CSSProperties = { fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' };

  return (
    <div style={cardStyle}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.6rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)' }}>
          <Wallet size={15} /> {title}
        </div>
        <span
          title={enforced ? 'Approving an over-budget PO is blocked for this project.' : 'Over-budget POs are flagged but not blocked. Enable budget_enforced to block.'}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.62rem', fontWeight: 600,
            padding: '0.15rem 0.5rem', borderRadius: '999px',
            color: enforced ? 'var(--status-success-text)' : 'var(--text-secondary)',
            background: enforced ? 'var(--status-success-bg)' : 'var(--surface-hover, rgba(120,120,120,0.1))',
          }}
        >
          {enforced ? <ShieldCheck size={11} /> : <Info size={11} />}
          {enforced ? 'Enforced' : 'Advisory'}
        </span>
      </div>

      {/* Figures */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.6rem' }}>
        <div>
          <div style={figLabel}>Budget</div>
          <div style={{ fontFamily: 'monospace', fontSize: '0.85rem', color: 'var(--text-primary)' }}>{fmt(ceiling)}</div>
        </div>
        <div>
          <div style={figLabel}>Committed</div>
          <div style={{ fontFamily: 'monospace', fontSize: '0.85rem', color: 'var(--text-primary)' }}>{fmt(committed)}</div>
        </div>
        <div>
          <div style={figLabel}>Available</div>
          <div style={{ fontFamily: 'monospace', fontSize: '0.85rem', fontWeight: 700, color: available < 0 ? 'var(--status-danger-text)' : 'var(--text-primary)' }}>{fmt(available)}</div>
        </div>
      </div>

      {/* Bar: committed (solid) + projected delta (translucent) */}
      <div style={{ position: 'relative', height: '7px', borderRadius: '999px', background: 'var(--surface-active, rgba(120,120,120,0.15))', overflow: 'hidden' }}>
        {preview > 0 && (
          <div style={{ position: 'absolute', inset: 0, width: `${projPct}%`, background: accent, opacity: 0.3 }} />
        )}
        <div style={{ position: 'absolute', inset: 0, width: `${usedPct}%`, background: accent, borderRadius: '999px' }} />
      </div>

      {/* Preview line */}
      {preview > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.72rem', color: over ? 'var(--status-danger-text)' : 'var(--text-secondary)' }}>
          {over && <AlertTriangle size={13} />}
          <span>
            {previewLabel}: committed → <strong style={{ fontFamily: 'monospace' }}>{fmt(projected)}</strong>
            {' '}({over ? 'over by ' : 'available '} <strong style={{ fontFamily: 'monospace' }}>{fmt(Math.abs(ceiling - projected))}</strong>)
            {over && enforced && ' — approval will be blocked'}
          </span>
        </div>
      )}
    </div>
  );
}
