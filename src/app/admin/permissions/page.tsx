'use client';

// ============================================================
// JEET ERP — Permissions Matrix
// Roles × modules coverage grid ("who can do what"), heat-shaded by
// how many of each module's permissions a role is granted. Read-only;
// PDF + Excel export for audit.
// ============================================================

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { exportTablePdf, exportTableExcel } from '@/lib/finance-export';
import { KeySquare, FileDown, Sheet } from 'lucide-react';

interface Role { id: string; role_key: string; name: string; hierarchy_level: number; }
interface Perm { id: string; permission_key: string; module: string; }

export default function PermissionsMatrixPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [perms, setPerms] = useState<Perm[]>([]);
  const [grants, setGrants] = useState<Set<string>>(new Set()); // `${role_id}|${permission_id}`
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [rol, prm, rp] = await Promise.all([
          supabase.from('roles').select('id, role_key, name, hierarchy_level').order('hierarchy_level'),
          supabase.from('permissions').select('id, permission_key, module'),
          supabase.from('role_permissions').select('role_id, permission_id'),
        ]);
        setRoles((rol.data || []) as Role[]);
        setPerms((prm.data || []) as Perm[]);
        setGrants(new Set((rp.data || []).map((r: any) => `${r.role_id}|${r.permission_id}`)));
      } finally { setLoading(false); }
    })();
  }, []);

  const modules = useMemo(() => [...new Set(perms.map(p => p.module))].sort(), [perms]);
  const permsByModule = useMemo(() => { const m = new Map<string, Perm[]>(); perms.forEach(p => { if (!m.has(p.module)) m.set(p.module, []); m.get(p.module)!.push(p); }); return m; }, [perms]);

  // coverage[role_id][module] = granted count
  const coverage = useMemo(() => {
    const out = new Map<string, Map<string, number>>();
    roles.forEach(r => {
      const mm = new Map<string, number>();
      modules.forEach(mod => { const list = permsByModule.get(mod) || []; mm.set(mod, list.filter(p => grants.has(`${r.id}|${p.id}`)).length); });
      out.set(r.id, mm);
    });
    return out;
  }, [roles, modules, permsByModule, grants]);

  const roleTotal = (rid: string) => modules.reduce((a, mod) => a + (coverage.get(rid)?.get(mod) || 0), 0);
  const cellBg = (n: number, total: number) => {
    if (total === 0 || n === 0) return 'transparent';
    const ratio = n / total;
    return `color-mix(in srgb, var(--accent) ${Math.round(ratio * 70 + 12)}%, var(--surface))`;
  };

  const exportCols = ['Role', 'Hierarchy', ...modules, 'Total'];
  const exportRows = roles.map(r => [r.name, `L${r.hierarchy_level}`, ...modules.map(mod => `${coverage.get(r.id)?.get(mod) || 0}/${(permsByModule.get(mod) || []).length}`), roleTotal(r.id)]);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Permissions Matrix"
        subtitle="Who can do what — permission coverage by role and module"
        breadcrumbs={[{ label: 'Administration', href: '/admin/hub' }, { label: 'Permissions' }]}
        actions={roles.length > 0 ? (
          <div className="flex gap-2">
            <Button variant="secondary" icon={FileDown} onClick={() => exportTablePdf({ title: 'Permissions Matrix', subtitle: 'Granted / total permissions per role and module', columns: exportCols, rows: exportRows, fileName: 'permissions-matrix' })}>PDF</Button>
            <Button variant="secondary" icon={Sheet} onClick={() => exportTableExcel({ title: 'Permissions Matrix', columns: exportCols, rows: exportRows, fileName: 'permissions-matrix' })}>Excel</Button>
          </div>
        ) : undefined}
      />

      {loading ? (
        <Card><div className="p-8 text-center text-sm text-[var(--text-tertiary)]">Loading…</div></Card>
      ) : roles.length === 0 || perms.length === 0 ? (
        <Card><EmptyState icon={KeySquare} title="No permission model" description="The roles × permissions matrix will appear here once roles and permissions are configured." /></Card>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Roles</div><div className="text-2xl font-bold mt-1">{roles.length}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Permissions</div><div className="text-2xl font-bold mt-1">{perms.length}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Modules</div><div className="text-2xl font-bold mt-1">{modules.length}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Total grants</div><div className="text-2xl font-bold mt-1">{grants.size}</div></Card>
          </div>

          <Card className="p-0 overflow-x-auto">
            <div className="p-3 text-sm font-semibold text-[var(--text-primary)] border-b border-[var(--border)]">Coverage grid <span className="text-xs font-normal text-[var(--text-tertiary)]">— granted / total per module; darker = broader access</span></div>
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-[var(--border)] text-[var(--text-tertiary)]">
                  <th className="p-2.5 text-left sticky left-0 bg-[var(--surface)] z-10">Role</th>
                  {modules.map(m => <th key={m} className="p-2 text-center font-medium whitespace-nowrap">{m}</th>)}
                  <th className="p-2 text-center font-semibold">Total</th>
                </tr>
              </thead>
              <tbody>
                {roles.map(r => (
                  <tr key={r.id} className="border-b border-[var(--border)] last:border-0">
                    <td className="p-2.5 sticky left-0 bg-[var(--surface)] z-10"><div className="font-medium text-[var(--text-primary)] whitespace-nowrap">{r.name}</div><div className="text-[10px] text-[var(--text-tertiary)]">L{r.hierarchy_level}</div></td>
                    {modules.map(mod => {
                      const n = coverage.get(r.id)?.get(mod) || 0; const total = (permsByModule.get(mod) || []).length;
                      return <td key={mod} className="p-2 text-center" style={{ background: cellBg(n, total), color: n ? 'var(--text-primary)' : 'var(--text-tertiary)' }} title={`${r.name} · ${mod}: ${n}/${total}`}>{n === 0 ? '·' : `${n}/${total}`}</td>;
                    })}
                    <td className="p-2 text-center font-semibold text-[var(--text-primary)]">{roleTotal(r.id)}</td>
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
