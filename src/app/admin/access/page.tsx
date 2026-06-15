'use client';

// ============================================================
// JEET ERP — Access & Roles Analytics
// Role distribution, hierarchy spread, system/custom mix, and the
// permission + user count carried by each role. Read-only; export.
// ============================================================

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { exportTablePdf, exportTableExcel } from '@/lib/finance-export';
import { Users, FileDown, Sheet } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell, Legend } from 'recharts';

const PIE = ['var(--accent)', 'var(--status-info-text)', 'var(--status-success-text)', 'var(--status-warning-text)', 'var(--status-danger-text)', '#a855f7', '#64748b', '#0891b2'];

interface Role { id: string; role_key: string; name: string; hierarchy_level: number; is_system: boolean; is_active: boolean; }
interface Row extends Role { perms: number; users: number; }

export default function AccessAnalyticsPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [permByRole, setPermByRole] = useState<Map<string, number>>(new Map());
  const [userByRole, setUserByRole] = useState<Map<string, number>>(new Map());
  const [profileRoles, setProfileRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [rol, rp, ur, prof] = await Promise.all([
          supabase.from('roles').select('id, role_key, name, hierarchy_level, is_system, is_active').order('hierarchy_level'),
          supabase.from('role_permissions').select('role_id'),
          supabase.from('user_roles').select('role_id'),
          supabase.from('profiles').select('role'),
        ]);
        setRoles((rol.data || []) as Role[]);
        const pm = new Map<string, number>(); (rp.data || []).forEach((r: any) => pm.set(r.role_id, (pm.get(r.role_id) || 0) + 1)); setPermByRole(pm);
        const um = new Map<string, number>(); (ur.data || []).forEach((r: any) => um.set(r.role_id, (um.get(r.role_id) || 0) + 1)); setUserByRole(um);
        setProfileRoles((prof.data || []).map((p: any) => p.role || 'unassigned'));
      } finally { setLoading(false); }
    })();
  }, []);

  const rows = useMemo<Row[]>(() => roles.map(r => ({ ...r, perms: permByRole.get(r.id) || 0, users: userByRole.get(r.id) || 0 })), [roles, permByRole, userByRole]);

  const activeRoles = roles.filter(r => r.is_active).length;
  const systemRoles = roles.filter(r => r.is_system).length;
  const totalGrants = [...permByRole.values()].reduce((a, b) => a + b, 0);
  const avgPerms = roles.length ? Math.round(totalGrants / roles.length) : 0;

  const byProfileRole = useMemo(() => { const m = new Map<string, number>(); profileRoles.forEach(r => m.set(r, (m.get(r) || 0) + 1)); return [...m.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value); }, [profileRoles]);
  const byHierarchy = useMemo(() => rows.map(r => ({ name: r.name, level: r.hierarchy_level, perms: r.perms })).sort((a, b) => a.level - b.level), [rows]);
  const permChart = useMemo(() => [...rows].sort((a, b) => b.perms - a.perms).slice(0, 10).map(r => ({ name: r.name, value: r.perms })), [rows]);

  const exportCols = ['Role', 'Key', 'Hierarchy', 'Type', 'Status', 'Permissions', 'Users'];
  const exportRows = rows.map(r => [r.name, r.role_key, r.hierarchy_level, r.is_system ? 'System' : 'Custom', r.is_active ? 'Active' : 'Inactive', r.perms, r.users]);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Access & Roles Analytics"
        subtitle="Role distribution, hierarchy and the access each role carries"
        breadcrumbs={[{ label: 'Administration', href: '/admin/hub' }, { label: 'Access & Roles' }]}
        actions={roles.length > 0 ? (
          <div className="flex gap-2">
            <Button variant="secondary" icon={FileDown} onClick={() => exportTablePdf({ title: 'Roles & Access', columns: exportCols, rows: exportRows, fileName: 'roles-access' })}>PDF</Button>
            <Button variant="secondary" icon={Sheet} onClick={() => exportTableExcel({ title: 'Roles & Access', columns: exportCols, rows: exportRows, fileName: 'roles-access' })}>Excel</Button>
          </div>
        ) : undefined}
      />

      {loading ? (
        <Card><div className="p-8 text-center text-sm text-[var(--text-tertiary)]">Loading…</div></Card>
      ) : roles.length === 0 ? (
        <Card><EmptyState icon={Users} title="No roles" description="Roles and their access will be analysed here once the role catalogue is configured." /></Card>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Users</div><div className="text-2xl font-bold mt-1">{profileRoles.length}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Roles</div><div className="text-2xl font-bold mt-1">{roles.length}</div><div className="text-[11px] text-[var(--text-tertiary)]">{activeRoles} active</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">System roles</div><div className="text-2xl font-bold mt-1">{systemRoles}<span className="text-sm font-normal text-[var(--text-tertiary)]">/{roles.length}</span></div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Permission grants</div><div className="text-2xl font-bold mt-1">{totalGrants}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Avg perms / role</div><div className="text-2xl font-bold mt-1">{avgPerms}</div></Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <Card className="p-4">
              <div className="text-sm font-semibold text-[var(--text-primary)] mb-3">Users by role</div>
              <div style={{ width: '100%', height: 250 }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={byProfileRole} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={85} label={(e: any) => `${e.name} (${e.value})`} labelLine={false} fontSize={11}>{byProfileRole.map((e, i) => <Cell key={i} fill={PIE[i % PIE.length]} />)}</Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card className="p-4">
              <div className="text-sm font-semibold text-[var(--text-primary)] mb-3">Permissions per role (top 10)</div>
              <div style={{ width: '100%', height: 250 }}>
                <ResponsiveContainer>
                  <BarChart data={permChart} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} allowDecimals={false} />
                    <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }} />
                    <Tooltip />
                    <Bar dataKey="value" fill="var(--accent)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          <Card className="p-0 overflow-x-auto">
            <div className="p-3 text-sm font-semibold text-[var(--text-primary)] border-b border-[var(--border)]">Role catalogue ({rows.length})</div>
            <table className="w-full text-sm">
              <thead><tr className="border-b border-[var(--border)] text-left text-[var(--text-tertiary)] text-xs"><th className="p-3">Role</th><th className="p-3">Hierarchy</th><th className="p-3">Type</th><th className="p-3 text-right">Permissions</th><th className="p-3 text-right">Users</th><th className="p-3">Status</th></tr></thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-hover)]">
                    <td className="p-3"><div className="font-medium text-[var(--text-primary)]">{r.name}</div><div className="text-[11px] text-[var(--text-tertiary)]">{r.role_key}</div></td>
                    <td className="p-3 text-xs text-[var(--text-secondary)]">L{r.hierarchy_level}</td>
                    <td className="p-3 text-xs text-[var(--text-secondary)]">{r.is_system ? 'System' : 'Custom'}</td>
                    <td className="p-3 text-right text-xs font-medium text-[var(--text-primary)]">{r.perms}</td>
                    <td className="p-3 text-right text-xs text-[var(--text-secondary)]">{r.users}</td>
                    <td className="p-3"><span className="text-xs px-2 py-0.5 rounded-full" style={{ background: r.is_active ? 'var(--status-success-bg)' : 'var(--surface-active)', color: r.is_active ? 'var(--status-success-text)' : 'var(--text-tertiary)' }}>{r.is_active ? 'Active' : 'Inactive'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </div>
  );
}
