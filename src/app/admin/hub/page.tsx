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
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import {
  Activity, Users, ShieldCheck, KeySquare, GitCompare, FileText, FileCode2,
  Hash, SlidersHorizontal, Layers, ScrollText, ChevronRight, ShieldAlert, Clock,
  Building2, Bell, Cpu, DollarSign, Package, FolderKanban, Wrench, Calendar, Share2, Database, Shield,
} from 'lucide-react';

interface Tile { href: string; label: string; desc: string; icon: React.ComponentType<{ size?: number | string; className?: string }>; }
const ANALYTICS: Tile[] = [
  { href: '/admin/audit/analytics', label: 'Audit & Activity Analytics', desc: 'Activity by module, action & actor', icon: Activity },
  { href: '/admin/access', label: 'Access & Roles', desc: 'Role distribution & hierarchy', icon: Users },
  { href: '/admin/permissions', label: 'Permissions Matrix', desc: 'Who can do what — role × module', icon: KeySquare },
  { href: '/admin/workflows/analytics', label: 'Workflow & Approvals', desc: 'Pending, SLA breaches, cycle time', icon: GitCompare },
  { href: '/admin/configuration', label: 'Configuration Audit', desc: 'Workflows, forms, templates, rules', icon: SlidersHorizontal },
];
const SETTINGS: Tile[] = [
  { href: '/admin/settings', label: 'Company & Branding', desc: 'Company profile & identity', icon: Building2 },
  { href: '/admin/settings/modules', label: 'Module Toggles', desc: 'Enable / disable modules', icon: SlidersHorizontal },
  { href: '/admin/settings/users', label: 'Users, Roles & Perms', desc: 'Accounts, roles & permissions', icon: Users },
  { href: '/admin/settings/sessions', label: 'Sessions & Access', desc: 'Active sessions & access', icon: KeySquare },
  { href: '/admin/settings/finance', label: 'Financial & Tax', desc: 'Finance, VAT & tax', icon: DollarSign },
  { href: '/admin/settings/procurement', label: 'Procurement', desc: 'Thresholds & approvals', icon: Package },
  { href: '/admin/settings/inventory', label: 'Inventory & Assets', desc: 'Stock & asset parameters', icon: Layers },
  { href: '/admin/settings/projects', label: 'Projects & Ops', desc: 'Project parameters', icon: FolderKanban },
  { href: '/admin/settings/maintenance', label: 'Maintenance & SLA', desc: 'Schedules & SLAs', icon: Wrench },
  { href: '/admin/settings/hr', label: 'HR & Workforce', desc: 'HR & payroll parameters', icon: Calendar },
  { href: '/admin/settings/notifications', label: 'Notifications & Alerts', desc: 'Channels & alert rules', icon: Bell },
  { href: '/admin/settings/pdf-templates', label: 'Document Templates', desc: 'PDF / document settings', icon: FileText },
  { href: '/admin/settings/integrations', label: 'Integrations', desc: 'Third-party config', icon: Share2 },
  { href: '/admin/settings/system', label: 'System Administration', desc: 'System-level controls', icon: Cpu },
  { href: '/admin/settings/security', label: 'Audit & Security', desc: 'Audit & security policy', icon: Shield },
  { href: '/admin/settings/backup', label: 'Backup & Recovery', desc: 'Backups & recovery', icon: Database },
];
const CONFIG: Tile[] = [
  { href: '/admin/workflows', label: 'Workflow Designer', desc: 'Statuses & transitions per module', icon: GitCompare },
  { href: '/admin/forms', label: 'Form Builder', desc: 'Dynamic form definitions', icon: FileCode2 },
  { href: '/admin/templates', label: 'Document Templates', desc: 'Printable document templates', icon: FileText },
  { href: '/admin/rules', label: 'Rules Engine', desc: 'No-code business rules', icon: SlidersHorizontal },
  { href: '/admin/numbering', label: 'Numbering', desc: 'Document-number sequences', icon: Hash },
  { href: '/admin/audit', label: 'Audit Log', desc: 'Raw audit-event trail', icon: ScrollText },
  { href: '/admin', label: 'Admin Center', desc: 'Configuration launcher', icon: Layers },
];

const ACTION_COLOR: Record<string, string> = { CREATE: 'var(--status-success-text)', UPDATE: 'var(--status-info-text)', DELETE: 'var(--status-danger-text)', APPROVE: 'var(--accent)', REJECT: 'var(--status-danger-text)', CHECK_IN: '#a855f7' };
const fmtAgo = (iso: string) => {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000), h = Math.floor(m / 60), d = Math.floor(h / 24);
  return d > 0 ? `${d}d ago` : h > 0 ? `${h}h ago` : m > 0 ? `${m}m ago` : 'just now';
};

export default function AdminHubPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [s, setS] = useState({ users: 0, roles: 0, activeRoles: 0, perms: 0, grants: 0, events30: 0, sensitive: 0, wfDefs: 0, wfActive: 0, pending: 0, slaBreach: 0, templates: 0, forms: 0, rules: 0 });
  const [chart, setChart] = useState<{ day: string; value: number }[]>([]);
  const [recent, setRecent] = useState<any[]>([]);
  const [nameMap, setNameMap] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    (async () => {
      try {
        const now = Date.now();
        const d30 = new Date(now - 30 * 864e5).toISOString();
        const [usr, rol, perm, rp, aud, wfd, wfi, tpl, frm, rul] = await Promise.all([
          supabase.from('profiles').select('id', { count: 'exact', head: true }),
          supabase.from('roles').select('is_active'),
          supabase.from('permissions').select('id', { count: 'exact', head: true }),
          supabase.from('role_permissions').select('role_id', { count: 'exact', head: true }),
          supabase.from('audit_log').select('occurred_at, action, module, actor_user_id, actor_role, entity_label, summary').order('occurred_at', { ascending: false }).limit(400),
          supabase.from('workflow_definitions').select('is_active'),
          supabase.from('workflow_instances').select('pending_approvals, sla_due_at, current_status_key'),
          supabase.from('document_templates').select('id', { count: 'exact', head: true }),
          supabase.from('form_definitions').select('id', { count: 'exact', head: true }),
          supabase.from('business_rules').select('id', { count: 'exact', head: true }),
        ]);
        const roles = rol.data || [];
        const allEvents = (aud.data || []) as any[];
        const aevents = allEvents.filter(e => e.occurred_at >= d30);
        const wdefs = wfd.data || [];
        const winst = wfi.data || [];
        const pending = winst.filter((w: any) => Array.isArray(w.pending_approvals) ? w.pending_approvals.length > 0 : !!w.pending_approvals && Object.keys(w.pending_approvals || {}).length > 0).length;
        const slaBreach = winst.filter((w: any) => w.sla_due_at && new Date(w.sla_due_at).getTime() < now).length;

        // 14-day activity sparkline
        const dayMap = new Map<string, number>();
        for (let i = 13; i >= 0; i--) dayMap.set(new Date(now - i * 864e5).toISOString().slice(0, 10), 0);
        allEvents.forEach(e => { const k = (e.occurred_at || '').slice(0, 10); if (dayMap.has(k)) dayMap.set(k, (dayMap.get(k) || 0) + 1); });
        setChart([...dayMap.entries()].map(([d, v]) => ({ day: d.slice(5), value: v })));

        // recent feed + actor names
        const rec = allEvents.slice(0, 7);
        setRecent(rec);
        const ids = [...new Set(rec.map(e => e.actor_user_id).filter(Boolean))] as string[];
        if (ids.length) { const { data: p } = await supabase.from('profiles').select('id, full_name').in('id', ids); setNameMap(new Map((p || []).map((x: any) => [x.id, x.full_name]))); }

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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <Card className="p-4 lg:col-span-2">
          <div className="text-sm font-semibold text-[var(--text-primary)] mb-3">Platform activity — last 14 days</div>
          <div style={{ width: '100%', height: 200 }}>
            <ResponsiveContainer>
              <AreaChart data={chart}>
                <defs><linearGradient id="ahFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--accent)" stopOpacity={0.3} /><stop offset="100%" stopColor="var(--accent)" stopOpacity={0} /></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="day" tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }} interval={2} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} allowDecimals={false} width={28} />
                <Tooltip />
                <Area dataKey="value" stroke="var(--accent)" fill="url(#ahFill)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card className="p-0 overflow-hidden">
          <div className="p-3 text-sm font-semibold text-[var(--text-primary)] border-b border-[var(--border)] flex items-center justify-between">
            <span>Recent activity</span>
            <button onClick={() => router.push('/admin/audit/analytics')} className="text-xs text-[var(--accent)]">View all</button>
          </div>
          <div className="divide-y divide-[var(--border)]">
            {recent.length === 0 ? (
              <div className="p-4 text-xs text-[var(--text-tertiary)]">{loading ? 'Loading…' : 'No recent activity.'}</div>
            ) : recent.map((e, i) => (
              <div key={i} className="px-3 py-2 flex items-start gap-2">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0" style={{ background: ACTION_COLOR[e.action] || 'var(--text-tertiary)' }} />
                <div className="min-w-0 flex-1">
                  <div className="text-xs text-[var(--text-primary)] truncate">{e.entity_label || e.summary || e.action}</div>
                  <div className="text-[10px] text-[var(--text-tertiary)] truncate">{(e.actor_user_id ? (nameMap.get(e.actor_user_id) || e.actor_role || '') : (e.actor_role || ''))} · {e.action} · {(e.module || '—').toUpperCase()} · {fmtAgo(e.occurred_at)}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div>
        <div className="text-sm font-semibold text-[var(--text-primary)] mb-2">Governance & analytics</div>
        {tileGrid(ANALYTICS)}
      </div>
      <div>
        <div className="text-sm font-semibold text-[var(--text-primary)] mb-2">Settings</div>
        {tileGrid(SETTINGS)}
      </div>
      <div>
        <div className="text-sm font-semibold text-[var(--text-primary)] mb-2">Configuration & builders</div>
        {tileGrid(CONFIG)}
      </div>
    </div>
  );
}
