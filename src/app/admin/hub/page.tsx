'use client';

// ============================================================
// Aura ERP — Enterprise Governance & Control Center
// The single command surface for administration: platform health,
// security posture, privileged-access visibility, high-risk activity,
// and a coherent navigation map over every admin area.
//
// Read-only aggregation over EXISTING tables/services (no migration):
//   • profiles / roles / permissions / role_permissions / user_roles  → access & privilege
//   • audit_log                                                        → activity & high-risk feed
//   • workflow_definitions / _instances                               → governance load (pending, SLA)
//   • document_templates / form_definitions / business_rules          → configuration inventory
//   • security policy (getMakerCheckerModules)                         → maker-checker posture
// ============================================================

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { getMakerCheckerModules, STRICT_MAKER_CHECKER_MODULES } from '@/lib/security/policy';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import {
  Activity, Users, KeySquare, GitCompare, FileText, FileCode2, Hash,
  SlidersHorizontal, ScrollText, ChevronRight, ShieldAlert, Clock,
  ShieldCheck, Lock, Gavel, Search, Layers, Building2, DollarSign,
  Package, FolderKanban, Wrench, Calendar, Bell, Share2, Cpu, Database,
  ArrowUpRight, AlertTriangle,
} from 'lucide-react';

// --- Console information architecture -------------------------------------
interface Tile { href: string; label: string; desc: string; icon: React.ComponentType<{ size?: number | string; className?: string }>; badge?: string; }
interface Section { title: string; tiles: Tile[]; }

const SECTIONS: Section[] = [
  {
    title: 'Access & Identity',
    tiles: [
      { href: '/admin/access', label: 'Roles & Access', desc: 'Role lifecycle, hierarchy & capability grants', icon: Users },
      { href: '/admin/permissions', label: 'Permissions Matrix', desc: 'Who can do what — role × module × scope', icon: KeySquare },
      { href: '/admin/settings/users', label: 'User Accounts', desc: 'Create, assign roles, deactivate', icon: Users },
      { href: '/admin/settings/sessions', label: 'Sessions & Access', desc: 'Active sessions, force sign-out, ban', icon: Lock },
    ],
  },
  {
    title: 'Governance & Workflow',
    tiles: [
      { href: '/admin/workflows', label: 'Workflow Designer', desc: 'Statuses, transitions & approval matrix', icon: GitCompare },
      { href: '/admin/workflows/admin', label: 'Workflow Override', desc: 'Break-glass force / restart / reassign — audited', icon: Gavel },
      { href: '/admin/workflows/analytics', label: 'Workflow Analytics', desc: 'Pending, SLA breaches, cycle time', icon: Activity },
      { href: '/admin/rules', label: 'Business Rules', desc: 'No-code thresholds, blocks & escalations', icon: SlidersHorizontal },
    ],
  },
  {
    title: 'Security & Audit',
    tiles: [
      { href: '/admin/security', label: 'Security Center', desc: 'Maker-checker policy, posture & high-risk feed', icon: ShieldCheck, badge: 'PR #15' },
      { href: '/admin/audit', label: 'Audit Log', desc: 'Immutable, write-once activity ledger', icon: ScrollText },
      { href: '/admin/audit?tab=investigation', label: 'Investigation', desc: 'Reconstruct a record or user timeline', icon: Search, badge: 'PR #16' },
      { href: '/admin/audit/analytics', label: 'Audit Analytics', desc: 'Activity by module, action & actor', icon: Activity },
      { href: '/admin/configuration', label: 'Configuration Audit', desc: 'Workflows, forms, templates, rules inventory', icon: SlidersHorizontal },
    ],
  },
  {
    title: 'Platform Configuration',
    tiles: [
      { href: '/admin/forms', label: 'Form Builder', desc: 'Dynamic form definitions & validation', icon: FileCode2 },
      { href: '/admin/templates', label: 'Document Templates', desc: 'Printable PDF templates & variables', icon: FileText },
      { href: '/admin/numbering', label: 'Numbering', desc: 'Document-number sequences per module', icon: Hash },
      { href: '/admin/settings/modules', label: 'Module Toggles', desc: 'Enable / disable modules', icon: Layers },
    ],
  },
  {
    title: 'System Settings',
    tiles: [
      { href: '/admin/settings', label: 'Company & Branding', desc: 'Company profile & identity', icon: Building2 },
      { href: '/admin/settings/finance', label: 'Financial & Tax', desc: 'Finance, VAT & tax parameters', icon: DollarSign },
      { href: '/admin/settings/procurement', label: 'Procurement', desc: 'Thresholds & approvals', icon: Package },
      { href: '/admin/settings/inventory', label: 'Inventory & Assets', desc: 'Stock & asset parameters', icon: Layers },
      { href: '/admin/settings/projects', label: 'Projects & Ops', desc: 'Project parameters', icon: FolderKanban },
      { href: '/admin/settings/maintenance', label: 'Maintenance & SLA', desc: 'Schedules & SLAs', icon: Wrench },
      { href: '/admin/settings/hr', label: 'HR & Workforce', desc: 'HR & payroll parameters', icon: Calendar },
      { href: '/admin/settings/notifications', label: 'Notifications', desc: 'Channels & alert rules', icon: Bell },
      { href: '/admin/settings/integrations', label: 'Integrations', desc: 'Third-party configuration', icon: Share2 },
      { href: '/admin/settings/system', label: 'System Administration', desc: 'System-level controls', icon: Cpu },
      { href: '/admin/settings/backup', label: 'Backup & Recovery', desc: 'Backups & recovery', icon: Database },
    ],
  },
];

// Governance-sensitive events that belong in the control center's risk lens.
const HIGH_RISK_ACTIONS = new Set(['DELETE', 'OVERRIDE', 'FORCE_STATUS', 'RESTART', 'REASSIGN', 'APPROVE', 'REJECT', 'BAN', 'UNBAN']);
const HIGH_RISK_ENTITIES = new Set(['ROLE', 'USER_ACCOUNT', 'PERMISSION', 'SYSTEM_SETTING', 'WORKFLOW', 'WORKFLOW_INSTANCE']);
const isHighRisk = (e: { action?: string; entity_type?: string }) =>
  HIGH_RISK_ACTIONS.has((e.action || '').toUpperCase()) ||
  Array.from(HIGH_RISK_ENTITIES).some(t => (e.entity_type || '').toUpperCase().includes(t));

// Dangerous capability keys we surface as "privileged access".
const PRIVILEGED_CAPS: { key: string; label: string; icon: React.ComponentType<{ size?: number | string; className?: string }> }[] = [
  { key: 'workflow.override', label: 'Workflow override', icon: Gavel },
  { key: 'finance.write', label: 'Finance write', icon: DollarSign },
  { key: 'hr.manage', label: 'HR / payroll', icon: Users },
];

const ACTION_COLOR: Record<string, string> = {
  CREATE: 'var(--status-success-text)', UPDATE: 'var(--status-info-text)', DELETE: 'var(--status-danger-text)',
  APPROVE: 'var(--status-success-text)', REJECT: 'var(--status-danger-text)', OVERRIDE: 'var(--status-warning-text)',
};
const toneForAction = (a: string) => ACTION_COLOR[(a || '').toUpperCase()] || (isHighRisk({ action: a }) ? 'var(--status-warning-text)' : 'var(--text-tertiary)');

const fmtAgo = (iso: string) => {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000), h = Math.floor(m / 60), d = Math.floor(h / 24);
  return d > 0 ? `${d}d ago` : h > 0 ? `${h}h ago` : m > 0 ? `${m}m ago` : 'just now';
};

type AuditRow = { occurred_at: string; action: string; module: string; actor_user_id: string | null; actor_role: string | null; entity_label: string | null; entity_type: string; summary: string };
type Privilege = { key: string; label: string; roles: number; users: number; icon: React.ComponentType<{ size?: number | string; className?: string }> };

export default function ControlCenterPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [s, setS] = useState({ users: 0, roles: 0, activeRoles: 0, perms: 0, grants: 0, events30: 0, highRisk30: 0, wfDefs: 0, wfActive: 0, pending: 0, slaBreach: 0, templates: 0, forms: 0, rules: 0, admins: 0 });
  const [chart, setChart] = useState<{ day: string; value: number }[]>([]);
  const [risk, setRisk] = useState<AuditRow[]>([]);
  const [nameMap, setNameMap] = useState<Map<string, string>>(new Map());
  const [posture, setPosture] = useState<{ mcActive: number; mcStrict: number; mcCustom: boolean }>({ mcActive: STRICT_MAKER_CHECKER_MODULES.length, mcStrict: STRICT_MAKER_CHECKER_MODULES.length, mcCustom: false });
  const [privileges, setPrivileges] = useState<Privilege[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const now = Date.now();
        const d30 = new Date(now - 30 * 864e5).toISOString();

        const [usr, rol, perm, rp, aud, wfd, wfi, tpl, frm, rul, adminCnt] = await Promise.all([
          supabase.from('profiles').select('id', { count: 'exact', head: true }),
          supabase.from('roles').select('is_active'),
          supabase.from('permissions').select('id', { count: 'exact', head: true }),
          supabase.from('role_permissions').select('role_id', { count: 'exact', head: true }),
          supabase.from('audit_log').select('occurred_at, action, module, actor_user_id, actor_role, entity_label, entity_type, summary').order('occurred_at', { ascending: false }).limit(500),
          supabase.from('workflow_definitions').select('is_active'),
          supabase.from('workflow_instances').select('pending_approvals, sla_due_at, current_status_key'),
          supabase.from('document_templates').select('id', { count: 'exact', head: true }),
          supabase.from('form_definitions').select('id', { count: 'exact', head: true }),
          supabase.from('business_rules').select('id', { count: 'exact', head: true }),
          supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'admin'),
        ]);

        const roles = rol.data || [];
        const allEvents = (aud.data || []) as AuditRow[];
        const aevents = allEvents.filter(e => e.occurred_at >= d30);
        const wdefs = wfd.data || [];
        const winst = (wfi.data || []) as { pending_approvals: unknown; sla_due_at: string | null }[];
        const pending = winst.filter(w => Array.isArray(w.pending_approvals) ? w.pending_approvals.length > 0 : !!w.pending_approvals && Object.keys((w.pending_approvals as object) || {}).length > 0).length;
        const slaBreach = winst.filter(w => w.sla_due_at && new Date(w.sla_due_at).getTime() < now).length;

        // 14-day activity sparkline
        const dayMap = new Map<string, number>();
        for (let i = 13; i >= 0; i--) dayMap.set(new Date(now - i * 864e5).toISOString().slice(0, 10), 0);
        allEvents.forEach(e => { const k = (e.occurred_at || '').slice(0, 10); if (dayMap.has(k)) dayMap.set(k, (dayMap.get(k) || 0) + 1); });
        setChart([...dayMap.entries()].map(([d, v]) => ({ day: d.slice(5), value: v })));

        // high-risk feed
        const riskFeed = allEvents.filter(isHighRisk).slice(0, 8);
        setRisk(riskFeed);

        // resolve actor names for the feed
        const ids = [...new Set(riskFeed.map(e => e.actor_user_id).filter(Boolean))] as string[];
        if (ids.length) {
          const { data: p } = await supabase.from('profiles').select('id, full_name').in('id', ids);
          setNameMap(new Map(((p || []) as { id: string; full_name: string }[]).map(x => [x.id, x.full_name])));
        }

        setS({
          users: usr.count || 0,
          roles: roles.length,
          activeRoles: roles.filter((r: { is_active: boolean }) => r.is_active).length,
          perms: perm.count || 0,
          grants: rp.count || 0,
          events30: aevents.length,
          highRisk30: aevents.filter(isHighRisk).length,
          wfDefs: wdefs.length,
          wfActive: wdefs.filter((w: { is_active: boolean }) => w.is_active).length,
          pending, slaBreach,
          templates: tpl.count || 0,
          forms: frm.count || 0,
          rules: rul.count || 0,
          admins: adminCnt.count || 0,
        });

        // --- security posture (maker-checker) ---
        try {
          const mc = await getMakerCheckerModules();
          setPosture({
            mcActive: mc.size,
            mcStrict: STRICT_MAKER_CHECKER_MODULES.length,
            mcCustom: mc.size !== STRICT_MAKER_CHECKER_MODULES.length || ![...STRICT_MAKER_CHECKER_MODULES].every(m => mc.has(m)),
          });
        } catch { /* fail-safe: keep strict default */ }

        // --- privileged-access visibility (who holds dangerous capabilities) ---
        try {
          const capKeys = PRIVILEGED_CAPS.map(c => c.key);
          const { data: capPerms } = await supabase.from('permissions').select('id, permission_key').in('permission_key', capKeys);
          const permRows = (capPerms || []) as { id: string; permission_key: string }[];
          if (permRows.length) {
            const permIdToKey = new Map(permRows.map(p => [p.id, p.permission_key]));
            const { data: capRP } = await supabase.from('role_permissions').select('role_id, permission_id').in('permission_id', permRows.map(p => p.id));
            const rpRows = (capRP || []) as { role_id: string; permission_id: string }[];
            const keyToRoleIds = new Map<string, Set<string>>(capKeys.map(k => [k, new Set<string>()]));
            const allCapRoleIds = new Set<string>();
            rpRows.forEach(r => { const k = permIdToKey.get(r.permission_id); if (k) { keyToRoleIds.get(k)!.add(r.role_id); allCapRoleIds.add(r.role_id); } });

            let urRows: { user_id: string; role_id: string }[] = [];
            if (allCapRoleIds.size) {
              const { data: capUR } = await supabase.from('user_roles').select('user_id, role_id').in('role_id', [...allCapRoleIds]);
              urRows = (capUR || []) as { user_id: string; role_id: string }[];
            }
            setPrivileges(PRIVILEGED_CAPS.map(c => {
              const roleIds = keyToRoleIds.get(c.key) || new Set<string>();
              const users = new Set(urRows.filter(u => roleIds.has(u.role_id)).map(u => u.user_id));
              return { key: c.key, label: c.label, roles: roleIds.size, users: users.size, icon: c.icon };
            }));
          }
        } catch { /* capabilities migration may not be applied — leave empty */ }
      } finally { setLoading(false); }
    })();
  }, []);

  const kpis = useMemo(() => ([
    { label: 'Users', value: s.users, sub: `${s.admins} admin${s.admins === 1 ? '' : 's'}`, tone: 'var(--text-primary)' },
    { label: 'Roles', value: s.roles, sub: `${s.activeRoles} active`, tone: 'var(--text-primary)' },
    { label: 'Permissions', value: s.perms, sub: `${s.grants} grants`, tone: 'var(--text-primary)' },
    { label: 'Workflows', value: s.wfDefs, sub: `${s.wfActive} active`, tone: 'var(--text-primary)' },
    { label: 'Pending approvals', value: s.pending, sub: 'in-flight', tone: s.pending ? 'var(--status-warning-text)' : 'var(--text-primary)' },
    { label: 'SLA breaches', value: s.slaBreach, sub: 'past due', tone: s.slaBreach ? 'var(--status-danger-text)' : 'var(--status-success-text)' },
    { label: 'High-risk (30d)', value: s.highRisk30, sub: `of ${s.events30} events`, tone: s.highRisk30 ? 'var(--status-warning-text)' : 'var(--text-primary)' },
  ]), [s]);

  const go = (href: string) => router.push(href);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Governance & Control Center"
        subtitle="Platform health, access governance, security posture and configuration — one command surface"
        breadcrumbs={[{ label: 'Administration' }, { label: 'Control Center' }]}
      />

      {/* Attention band */}
      {(s.slaBreach > 0 || s.pending > 0 || s.highRisk30 > 0) && (
        <Card className="p-4 border-l-4" style={{ borderLeftColor: 'var(--status-warning-text)' }}>
          <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)] mb-2"><ShieldAlert size={16} /> Needs attention</div>
          <div className="flex flex-wrap gap-2">
            {s.slaBreach > 0 && <button onClick={() => go('/admin/workflows/admin')} className="text-xs px-3 py-1.5 rounded-md inline-flex items-center gap-1" style={{ background: 'var(--status-danger-bg)', color: 'var(--status-danger-text)' }}><Clock size={13} />{s.slaBreach} workflow SLA breach{s.slaBreach === 1 ? '' : 'es'} — resolve →</button>}
            {s.pending > 0 && <button onClick={() => go('/admin/workflows/analytics')} className="text-xs px-3 py-1.5 rounded-md inline-flex items-center gap-1" style={{ background: 'var(--status-warning-bg)', color: 'var(--status-warning-text)' }}>{s.pending} pending approval{s.pending === 1 ? '' : 's'} →</button>}
            {s.highRisk30 > 0 && <button onClick={() => go('/admin/audit?tab=investigation')} className="text-xs px-3 py-1.5 rounded-md inline-flex items-center gap-1" style={{ background: 'var(--surface-active)', color: 'var(--text-secondary)' }}><AlertTriangle size={13} />{s.highRisk30} high-risk action{s.highRisk30 === 1 ? '' : 's'} (30d) →</button>}
          </div>
        </Card>
      )}

      {/* KPI command band */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {kpis.map(k => (
          <Card key={k.label} className="p-4">
            <div className="text-xs text-[var(--text-secondary)]">{k.label}</div>
            <div className="text-xl font-bold mt-1" style={{ color: k.tone }}>{loading ? '—' : k.value}</div>
            <div className="text-[11px] text-[var(--text-tertiary)] mt-0.5">{k.sub}</div>
          </Card>
        ))}
      </div>

      {/* Governance posture + privileged access */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Security posture */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]"><ShieldCheck size={16} className="text-[var(--status-success-text)]" /> Security posture</div>
            <button onClick={() => go('/admin/security')} className="text-xs text-[var(--accent)] inline-flex items-center gap-0.5">Security Center <ArrowUpRight size={12} /></button>
          </div>
          <div className="flex flex-col gap-2.5">
            <PostureRow ok label="Finance writes" detail="RLS-enforced — finance roles only" />
            <PostureRow ok label="Payroll & compensation" detail="RLS-enforced — HR only (read + write)" />
            <PostureRow ok label="General ledger" detail="Balanced + period-locked + immutable posting" />
            <PostureRow ok label="Audit ledger" detail="Write-once — UPDATE/DELETE rejected by trigger" />
            <div className="flex items-center justify-between gap-2 pt-2 mt-1 border-t border-[var(--border)]">
              <div className="min-w-0">
                <div className="text-xs font-medium text-[var(--text-primary)]">Maker-checker enforcement</div>
                <div className="text-[11px] text-[var(--text-tertiary)]">{posture.mcCustom ? 'Customised at runtime' : 'Strict default'} · creator ≠ approver</div>
              </div>
              <span className="text-xs px-2 py-1 rounded-md whitespace-nowrap" style={{ background: 'var(--surface-active)', color: 'var(--text-secondary)' }}>{loading ? '—' : `${posture.mcActive} module${posture.mcActive === 1 ? '' : 's'}`}</span>
            </div>
          </div>
        </Card>

        {/* Privileged access */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]"><KeySquare size={16} className="text-[var(--status-warning-text)]" /> Privileged access</div>
            <button onClick={() => go('/admin/permissions')} className="text-xs text-[var(--accent)] inline-flex items-center gap-0.5">Permissions <ArrowUpRight size={12} /></button>
          </div>
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs text-[var(--text-primary)]"><ShieldCheck size={14} className="text-[var(--status-danger-text)]" /> Administrators</div>
              <span className="text-sm font-semibold text-[var(--text-primary)]">{loading ? '—' : s.admins}</span>
            </div>
            {privileges.length === 0 ? (
              <div className="text-[11px] text-[var(--text-tertiary)] py-2">
                {loading ? 'Loading capability grants…' : 'No capability grants found — the data-driven RBAC migration may not be applied yet.'}
              </div>
            ) : privileges.map(p => {
              const Icon = p.icon;
              return (
                <div key={p.key} className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs text-[var(--text-primary)] min-w-0">
                    <Icon size={14} className="text-[var(--text-tertiary)] shrink-0" />
                    <span className="truncate">{p.label}</span>
                    <code className="text-[10px] text-[var(--text-tertiary)] font-mono hidden sm:inline">{p.key}</code>
                  </div>
                  <span className="text-xs text-[var(--text-secondary)] whitespace-nowrap">
                    <strong className="text-[var(--text-primary)]">{p.users}</strong> user{p.users === 1 ? '' : 's'} · {p.roles} role{p.roles === 1 ? '' : 's'}
                  </span>
                </div>
              );
            })}
            <p className="text-[10px] text-[var(--text-tertiary)] pt-1 mt-1 border-t border-[var(--border)]">Fewer holders = tighter control. Review grants after every role change.</p>
          </div>
        </Card>
      </div>

      {/* Activity + high-risk feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <Card className="p-4 lg:col-span-2">
          <div className="text-sm font-semibold text-[var(--text-primary)] mb-3">Platform activity — last 14 days</div>
          <div style={{ width: '100%', height: 200 }}>
            <ResponsiveContainer>
              <AreaChart data={chart}>
                <defs><linearGradient id="ccFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--accent)" stopOpacity={0.3} /><stop offset="100%" stopColor="var(--accent)" stopOpacity={0} /></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="day" tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }} interval={2} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} allowDecimals={false} width={28} />
                <Tooltip />
                <Area dataKey="value" stroke="var(--accent)" fill="url(#ccFill)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card className="p-0 overflow-hidden">
          <div className="p-3 text-sm font-semibold text-[var(--text-primary)] border-b border-[var(--border)] flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5"><ShieldAlert size={14} className="text-[var(--status-warning-text)]" /> High-risk activity</span>
            <button onClick={() => go('/admin/audit?tab=investigation')} className="text-xs text-[var(--accent)]">Investigate</button>
          </div>
          <div className="divide-y divide-[var(--border)] max-h-[220px] overflow-y-auto">
            {risk.length === 0 ? (
              <div className="p-4 text-xs text-[var(--text-tertiary)]">{loading ? 'Loading…' : 'No high-risk activity recorded.'}</div>
            ) : risk.map((e, i) => (
              <div key={i} className="px-3 py-2 flex items-start gap-2">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0" style={{ background: toneForAction(e.action) }} />
                <div className="min-w-0 flex-1">
                  <div className="text-xs text-[var(--text-primary)] truncate">{e.entity_label || e.summary || e.action}</div>
                  <div className="text-[10px] text-[var(--text-tertiary)] truncate">
                    {(e.actor_user_id ? (nameMap.get(e.actor_user_id) || e.actor_role || 'Unknown') : (e.actor_role || 'System'))} · {e.action} · {(e.entity_type || e.module || '—').toUpperCase()} · {fmtAgo(e.occurred_at)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Console navigation */}
      {SECTIONS.map(section => (
        <div key={section.title}>
          <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)] mb-2">{section.title}</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {section.tiles.map(t => {
              const Icon = t.icon;
              return (
                <button key={t.href} onClick={() => go(t.href)} className="text-left">
                  <Card className="p-4 hover:bg-[var(--surface-hover)] transition-colors h-full">
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg" style={{ background: 'var(--surface-active)' }}><Icon size={18} className="text-[var(--accent)]" /></div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1 text-sm font-semibold text-[var(--text-primary)]">
                          {t.label}
                          {t.badge && <span className="text-[9px] font-medium px-1 py-0.5 rounded" style={{ background: 'var(--surface-active)', color: 'var(--text-tertiary)' }}>{t.badge}</span>}
                          <ChevronRight size={14} className="text-[var(--text-tertiary)] ml-auto" />
                        </div>
                        <div className="text-xs text-[var(--text-secondary)] mt-0.5">{t.desc}</div>
                      </div>
                    </div>
                  </Card>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function PostureRow({ ok, label, detail }: { ok: boolean; label: string; detail: string }) {
  return (
    <div className="flex items-start gap-2">
      <ShieldCheck size={14} className="mt-0.5 shrink-0" style={{ color: ok ? 'var(--status-success-text)' : 'var(--text-tertiary)' }} />
      <div className="min-w-0">
        <div className="text-xs font-medium text-[var(--text-primary)]">{label}</div>
        <div className="text-[11px] text-[var(--text-tertiary)]">{detail}</div>
      </div>
    </div>
  );
}
