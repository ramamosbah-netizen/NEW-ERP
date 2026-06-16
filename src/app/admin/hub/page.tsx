'use client';

// ============================================================
// JEET ERP — Administration & Governance Hub
// Platform roll-up: users, roles, audit volume, pending approvals,
// SLA breaches and config inventory, plus links to every admin page.
// Read-only; batched plain queries (no migration).
// ============================================================

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import {
  Activity, Users, ShieldCheck, KeySquare, GitCompare, FileText, FileCode2,
  Hash, SlidersHorizontal, Layers, ScrollText, ChevronRight, ShieldAlert, Clock,
  Building2, Bell, Cpu,
} from 'lucide-react';

interface Tile { href: string; label: string; desc: string; icon: React.ComponentType<{ size?: number | string; className?: string }>; }
const ANALYTICS: Tile[] = [
  { href: '/admin/audit/analytics', label: 'Audit & Activity Analytics', desc: 'Activity by module, action & actor', icon: Activity },
  { href: '/admin/access', label: 'Access & Roles', desc: 'Role distribution & hierarchy', icon: Users },
  { href: '/admin/permissions', label: 'Permissions Matrix', desc: 'Who can do what — role × module', icon: KeySquare },
  { href: '/admin/workflows/analytics', label: 'Workflow & Approvals', desc: 'Pending, SLA breaches, cycle time', icon: GitCompare },
  { href: '/admin/configuration', label: 'Configuration Audit', desc: 'Workflows, forms, templates, rules', icon: SlidersHorizontal },
];
const CONFIG: Tile[] = [
  { href: '/admin/settings', label: 'General Config', desc: 'Company, branding & module toggles', icon: Building2 },
  { href: '/admin/settings/access', label: 'Access Control', desc: 'Users, roles, permissions & sessions', icon: ShieldCheck },
  { href: '/admin/settings/operational', label: 'Operational Scales', desc: 'Finance, procurement, inventory, projects, HR', icon: SlidersHorizontal },
  { href: '/admin/settings/alerts', label: 'Templates & Alerts', desc: 'Notifications, templates & integrations', icon: Bell },
  { href: '/admin/settings/system', label: 'System & Advanced', desc: 'System admin, audit/security & backup', icon: Cpu },
  { href: '/admin/workflows', label: 'Workflow Designer', desc: 'Statuses & transitions per module', icon: GitCompare },
  { href: '/admin/forms', label: 'Form Builder', desc: 'Dynamic form definitions', icon: FileCode2 },
  { href: '/admin/templates', label: 'Document Templates', desc: 'Printable document templates', icon: FileText },
  { href: '/admin/rules', label: 'Rules Engine', desc: 'No-code business rules', icon: SlidersHorizontal },
  { href: '/admin/numbering', label: 'Numbering', desc: 'Document-number sequences', icon: Hash },
  { href: '/admin/audit', label: 'Audit Log', desc: 'Raw audit-event trail', icon: ScrollText },
  { href: '/admin', label: 'Admin Center', desc: 'Configuration launcher', icon: Layers },
];

export default function AdminHubPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [s, setS] = useState({ users: 0, roles: 0, activeRoles: 0, perms: 0, grants: 0, events30: 0, sensitive: 0, wfDefs: 0, wfActive: 0, pending: 0, slaBreach: 0, templates: 0, forms: 0, rules: 0 });

  useEffect(() => {
    (async () => {
      try {
        const d30 = new Date(Date.now() - 30 * 864e5).toISOString();
        const [usr, rol, perm, rp, aud, wfd, wfi, tpl, frm, rul] = await Promise.all([
          supabase.from('profiles').select('id', { count: 'exact', head: true }),
          supabase.from('roles').select('is_active'),
          supabase.from('permissions').select('id', { count: 'exact', head: true }),
          supabase.from('role_permissions').select('role_id', { count: 'exact', head: true }),
          supabase.from('audit_log').select('action, occurred_at').gte('occurred_at', d30),
          supabase.from('workflow_definitions').select('is_active'),
          supabase.from('workflow_instances').select('pending_approvals, sla_due_at, current_status_key'),
          supabase.from('document_templates').select('id', { count: 'exact', head: true }),
          supabase.from('form_definitions').select('id', { count: 'exact', head: true }),
          supabase.from('business_rules').select('id', { count: 'exact', head: true }),
        ]);
        const roles = rol.data || [];
        const aevents = aud.data || [];
        const wdefs = wfd.data || [];
        const winst = wfi.data || [];
        const now = Date.now();
        const pending = winst.filter((w: any) => Array.isArray(w.pending_approvals) ? w.pending_approvals.length > 0 : !!w.pending_approvals && Object.keys(w.pending_approvals || {}).length > 0).length;
        const slaBreach = winst.filter((w: any) => w.sla_due_at && new Date(w.sla_due_at).getTime() < now).length;
        setS({
          users: usr.count || 0,
          roles: roles.length,
          activeRoles: roles.filter((r: any) => r.is_active).length,
          perms: perm.count || 0,
          grants: rp.count || 0,
          events30: aevents.length,
          sensitive: aevents.filter((e: any) => e.action === 'DELETE' || e.action === 'APPROVE' || e.action === 'REJECT').length,
          wfDefs: wdefs.length,
          wfActive: wdefs.filter((w: any) => w.is_active).length,
          pending, slaBreach,
          templates: tpl.count || 0,
          forms: frm.count || 0,
          rules: rul.count || 0,
        });
      } finally { setLoading(false); }
    })();
  }, []);

  const kpis = useMemo(() => ([
    { label: 'Users', value: s.users, sub: `${s.roles} roles · ${s.activeRoles} active`, color: 'var(--accent)' },
    { label: 'Permissions', value: s.perms, sub: `${s.grants} role grants`, color: 'var(--text-primary)' },
    { label: 'Audit events (30d)', value: s.events30, sub: `${s.sensitive} sensitive`, color: 'var(--text-primary)' },
    { label: 'Workflows', value: s.wfDefs, sub: `${s.wfActive} active`, color: 'var(--text-primary)' },
    { label: 'Pending approvals', value: s.pending, sub: 'open workflow instances', color: s.pending ? 'var(--status-warning-text)' : 'var(--text-primary)' },
    { label: 'SLA breaches', value: s.slaBreach, sub: 'past due', color: s.slaBreach ? 'var(--status-danger-text)' : 'var(--text-primary)' },
    { label: 'Config objects', value: s.templates + s.forms + s.rules + s.wfDefs, sub: `${s.templates} tpl · ${s.forms} forms · ${s.rules} rules`, color: 'var(--text-primary)' },
  ]), [s]);

  const tileGrid = (tiles: Tile[]) => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {tiles.map(t => { const Icon = t.icon; return (
        <button key={t.href} onClick={() => router.push(t.href)} className="text-left">
          <Card className="p-4 hover:bg-[var(--surface-hover)] transition-colors h-full">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg" style={{ background: 'var(--surface-active)' }}><Icon size={18} className="text-[var(--accent)]" /></div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1 text-sm font-semibold text-[var(--text-primary)]">{t.label}<ChevronRight size={14} className="text-[var(--text-tertiary)]" /></div>
                <div className="text-xs text-[var(--text-secondary)] mt-0.5">{t.desc}</div>
              </div>
            </div>
          </Card>
        </button>
      ); })}
    </div>
  );

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Administration & Governance Hub" subtitle="Platform health, access governance and configuration at a glance" breadcrumbs={[{ label: 'Administration' }, { label: 'Hub' }]} />

      {(s.slaBreach > 0 || s.pending > 0 || s.sensitive > 0) && (
        <Card className="p-4 border-l-4" style={{ borderLeftColor: 'var(--status-warning-text)' }}>
          <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)] mb-2"><ShieldAlert size={16} /> Needs attention</div>
          <div className="flex flex-wrap gap-2">
            {s.slaBreach > 0 && <button onClick={() => router.push('/admin/workflows/analytics')} className="text-xs px-3 py-1.5 rounded-md inline-flex items-center gap-1" style={{ background: 'var(--status-danger-bg)', color: 'var(--status-danger-text)' }}><Clock size={13} />{s.slaBreach} workflow SLA breach(es) →</button>}
            {s.pending > 0 && <button onClick={() => router.push('/admin/workflows/analytics')} className="text-xs px-3 py-1.5 rounded-md" style={{ background: 'var(--status-warning-bg)', color: 'var(--status-warning-text)' }}>{s.pending} pending approval(s) →</button>}
            {s.sensitive > 0 && <button onClick={() => router.push('/admin/audit/analytics')} className="text-xs px-3 py-1.5 rounded-md" style={{ background: 'var(--surface-active)', color: 'var(--text-secondary)' }}>{s.sensitive} sensitive action(s) in 30d →</button>}
          </div>
        </Card>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {kpis.map(k => (
          <Card key={k.label} className="p-4">
            <div className="text-xs text-[var(--text-secondary)]">{k.label}</div>
            <div className="text-xl font-bold mt-1" style={{ color: k.color }}>{loading ? '—' : k.value}</div>
            <div className="text-[11px] text-[var(--text-tertiary)] mt-0.5">{k.sub}</div>
          </Card>
        ))}
      </div>

      <div>
        <div className="text-sm font-semibold text-[var(--text-primary)] mb-2">Governance & analytics</div>
        {tileGrid(ANALYTICS)}
      </div>
      <div>
        <div className="text-sm font-semibold text-[var(--text-primary)] mb-2">Configuration</div>
        {tileGrid(CONFIG)}
      </div>
    </div>
  );
}
