'use client';

// ============================================================
// Aura ERP — Role Management (CRUD + capability assignment)
// Full role lifecycle: create / edit / activate / delete, and assign the
// capabilities (permission keys + scope) that — with the data-driven RBAC
// migration — actually gate the database via RLS.
// ============================================================

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { userRoleService } from '@/services/userRoleService';
import { permissionService } from '@/services/permissionService';
import type { Role, Permission, PermissionScope } from '@/types/rbac.types';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Plus, Pencil, Trash2, KeySquare, Power, AlertTriangle, ShieldCheck } from 'lucide-react';

const SCOPES: (PermissionScope | 'NONE')[] = ['NONE', 'ALL', 'TEAM', 'ASSIGNED', 'OWN'];
const inputCls = 'w-full px-3 py-2 rounded-md border border-[var(--border-color)] bg-[var(--bg-dark)] text-sm text-[var(--text-primary)]';

export default function RoleManagementTab() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [permCount, setPermCount] = useState<Map<string, number>>(new Map());
  const [userCount, setUserCount] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Role | null>(null);
  const [capRole, setCapRole] = useState<Role | null>(null);
  const [form, setForm] = useState({ role_key: '', name: '', description: '', hierarchy_level: 100 });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [rs, rp, ur] = await Promise.all([
        userRoleService.getRoles(),
        supabase.from('role_permissions').select('role_id'),
        supabase.from('user_roles').select('role_id'),
      ]);
      setRoles(rs);
      const pm = new Map<string, number>(); (rp.data || []).forEach((r: any) => pm.set(r.role_id, (pm.get(r.role_id) || 0) + 1)); setPermCount(pm);
      const um = new Map<string, number>(); (ur.data || []).forEach((r: any) => um.set(r.role_id, (um.get(r.role_id) || 0) + 1)); setUserCount(um);
      setError(null);
    } catch (e: any) { setError(e.message); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setForm({ role_key: '', name: '', description: '', hierarchy_level: 100 }); setError(null); setCreating(true); };
  const openEdit = (r: Role) => { setForm({ role_key: r.role_key, name: r.name, description: r.description || '', hierarchy_level: r.hierarchy_level }); setError(null); setEditing(r); };

  const saveCreate = async () => {
    setBusy(true); setError(null);
    try { await userRoleService.createRole(form); setCreating(false); await load(); }
    catch (e: any) { setError(e.message); } finally { setBusy(false); }
  };
  const saveEdit = async () => {
    if (!editing) return;
    setBusy(true); setError(null);
    try { await userRoleService.updateRole(editing.id, { name: form.name, description: form.description, hierarchy_level: form.hierarchy_level }); setEditing(null); await load(); }
    catch (e: any) { setError(e.message); } finally { setBusy(false); }
  };
  const toggle = async (r: Role) => {
    setBusy(true); setError(null);
    try { await userRoleService.toggleRoleStatus(r.id, !r.is_active); await load(); }
    catch (e: any) { setError(e.message); } finally { setBusy(false); }
  };
  const remove = async (r: Role) => {
    if (!window.confirm(`Delete role "${r.name}"? This cannot be undone.`)) return;
    setBusy(true); setError(null);
    try { await userRoleService.deleteRole(r.id); await load(); }
    catch (e: any) { setError(e.message); } finally { setBusy(false); }
  };

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <div className="flex items-center gap-2 rounded-md border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] p-3 text-sm text-[var(--status-danger-text)]">
          <AlertTriangle size={16} /> {error}
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-xs text-[var(--text-secondary)]">Create roles and grant capabilities. Capabilities gate the database via RLS once the data-driven RBAC migration is applied.</p>
        <Button size="sm" icon={Plus} onClick={openCreate}>New Role</Button>
      </div>

      <Card className="p-0 overflow-x-auto">
        {loading ? (
          <div className="p-8 text-center text-sm text-[var(--text-tertiary)]">Loading…</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border-color)] text-left text-xs text-[var(--text-tertiary)]">
                <th className="p-3">Role</th><th className="p-3">Hierarchy</th><th className="p-3">Type</th>
                <th className="p-3 text-right">Users</th><th className="p-3 text-right">Capabilities</th>
                <th className="p-3">Status</th><th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {roles.map(r => (
                <tr key={r.id} className="border-b border-[var(--border-color)] last:border-0 hover:bg-[var(--surface-hover)]">
                  <td className="p-3"><div className="font-medium text-[var(--text-primary)]">{r.name}</div><div className="text-[11px] font-mono text-[var(--text-tertiary)]">{r.role_key}</div></td>
                  <td className="p-3 text-xs text-[var(--text-secondary)]">L{r.hierarchy_level}</td>
                  <td className="p-3 text-xs text-[var(--text-secondary)]">{r.is_system ? 'System' : 'Custom'}</td>
                  <td className="p-3 text-right text-xs">{userCount.get(r.id) || 0}</td>
                  <td className="p-3 text-right text-xs">{permCount.get(r.id) || 0}</td>
                  <td className="p-3"><span className="text-xs px-2 py-0.5 rounded-full" style={{ background: r.is_active ? 'var(--status-success-bg)' : 'var(--surface-active)', color: r.is_active ? 'var(--status-success-text)' : 'var(--text-tertiary)' }}>{r.is_active ? 'Active' : 'Inactive'}</span></td>
                  <td className="p-3">
                    <div className="flex items-center justify-end gap-1">
                      <button title="Capabilities" onClick={() => setCapRole(r)} className="p-1.5 rounded hover:bg-[var(--surface-active)] text-[var(--accent)]"><KeySquare size={15} /></button>
                      <button title="Edit" onClick={() => openEdit(r)} className="p-1.5 rounded hover:bg-[var(--surface-active)] text-[var(--text-secondary)]"><Pencil size={15} /></button>
                      <button title={r.is_active ? 'Deactivate' : 'Activate'} disabled={busy} onClick={() => toggle(r)} className="p-1.5 rounded hover:bg-[var(--surface-active)] text-[var(--text-secondary)] disabled:opacity-40"><Power size={15} /></button>
                      <button title={r.is_system ? 'System roles cannot be deleted' : 'Delete'} disabled={busy || r.is_system} onClick={() => remove(r)} className="p-1.5 rounded hover:bg-[var(--status-danger-bg)] text-[var(--status-danger-text)] disabled:opacity-30 disabled:cursor-not-allowed"><Trash2 size={15} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {roles.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-sm text-[var(--text-tertiary)]">No roles yet.</td></tr>}
            </tbody>
          </table>
        )}
      </Card>

      {/* Create / Edit modal */}
      <Modal
        isOpen={creating || !!editing}
        onClose={() => { setCreating(false); setEditing(null); }}
        title={creating ? 'New Role' : `Edit Role — ${editing?.name}`}
        footer={<>
          <Button variant="secondary" onClick={() => { setCreating(false); setEditing(null); }}>Cancel</Button>
          <Button disabled={busy} onClick={creating ? saveCreate : saveEdit}>{busy ? 'Saving…' : creating ? 'Create role' : 'Save changes'}</Button>
        </>}
      >
        <div className="flex flex-col gap-3">
          <label className="text-xs font-medium text-[var(--text-secondary)]">Name
            <input className={inputCls + ' mt-1'} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Site Accountant" />
          </label>
          <label className="text-xs font-medium text-[var(--text-secondary)]">Role key {creating ? '' : '(immutable)'}
            <input className={inputCls + ' mt-1 font-mono disabled:opacity-60'} value={form.role_key} disabled={!creating} onChange={e => setForm({ ...form, role_key: e.target.value })} placeholder="e.g. site_accountant" />
          </label>
          <label className="text-xs font-medium text-[var(--text-secondary)]">Description
            <textarea className={inputCls + ' mt-1'} rows={2} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
          </label>
          <label className="text-xs font-medium text-[var(--text-secondary)]">Hierarchy level <span className="text-[var(--text-tertiary)]">(lower = more senior; admin ≤ 10)</span>
            <input type="number" className={inputCls + ' mt-1'} value={form.hierarchy_level} onChange={e => setForm({ ...form, hierarchy_level: parseInt(e.target.value, 10) || 0 })} />
          </label>
        </div>
      </Modal>

      {/* Capability assignment */}
      {capRole && <CapabilityEditor role={capRole} onClose={() => setCapRole(null)} onSaved={load} />}
    </div>
  );
}

function CapabilityEditor({ role, onClose, onSaved }: { role: Role; onClose: () => void; onSaved: () => void }) {
  const [perms, setPerms] = useState<Permission[]>([]);
  const [scopes, setScopes] = useState<Record<string, PermissionScope | 'NONE'>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [all, current] = await Promise.all([permissionService.getPermissions(), permissionService.getRolePermissions(role.id)]);
        setPerms(all);
        const map: Record<string, PermissionScope | 'NONE'> = {};
        all.forEach(p => { map[p.id] = 'NONE'; });
        current.forEach(rp => { map[rp.permission_id] = rp.scope; });
        setScopes(map);
      } catch (e: any) { setErr(e.message); } finally { setLoading(false); }
    })();
  }, [role.id]);

  const grouped = useMemo(() => {
    const g: Record<string, Permission[]> = {};
    perms.forEach(p => { (g[p.module] ||= []).push(p); });
    return Object.entries(g).sort((a, b) => a[0].localeCompare(b[0]));
  }, [perms]);

  const granted = Object.values(scopes).filter(s => s !== 'NONE').length;

  const save = async () => {
    setBusy(true); setErr(null);
    try {
      const mappings = Object.entries(scopes).filter(([, s]) => s !== 'NONE').map(([permissionId, scope]) => ({ permissionId, scope: scope as PermissionScope }));
      await permissionService.updateRolePermissions(role.id, mappings);
      onSaved(); onClose();
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };

  return (
    <Modal
      isOpen onClose={onClose} size="lg"
      title={`Capabilities — ${role.name}`}
      footer={<>
        <span className="mr-auto text-xs text-[var(--text-tertiary)]">{granted} capabilities granted</span>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save capabilities'}</Button>
      </>}
    >
      {err && <div className="mb-3 flex items-center gap-2 text-sm text-[var(--status-danger-text)]"><AlertTriangle size={15} /> {err}</div>}
      <div className="mb-3 flex items-start gap-2 rounded-md border border-[var(--border-color)] bg-[var(--surface-hover)] p-2.5 text-[11px] text-[var(--text-secondary)]">
        <ShieldCheck size={14} className="mt-0.5 text-[var(--accent)]" />
        <span>Coarse gates like <code>finance.write</code> and <code>hr.manage</code> drive RLS once the data-driven RBAC migration is applied. Scope: ALL &gt; TEAM &gt; ASSIGNED &gt; OWN.</span>
      </div>
      {loading ? (
        <div className="p-6 text-center text-sm text-[var(--text-tertiary)]">Loading capabilities…</div>
      ) : (
        <div className="flex flex-col gap-4">
          {grouped.map(([module, list]) => (
            <div key={module}>
              <div className="text-xs font-semibold text-[var(--text-primary)] uppercase tracking-wide mb-1.5">{module}</div>
              <div className="flex flex-col gap-1">
                {list.map(p => (
                  <div key={p.id} className="flex items-center justify-between gap-3 py-1 border-b border-[var(--border-color)] last:border-0">
                    <div className="min-w-0">
                      <div className="text-xs font-mono text-[var(--text-primary)] truncate">{p.permission_key}</div>
                      {p.description && <div className="text-[10px] text-[var(--text-tertiary)] truncate">{p.description}</div>}
                    </div>
                    <select
                      className="px-2 py-1 rounded border border-[var(--border-color)] bg-[var(--bg-dark)] text-xs text-[var(--text-primary)] flex-shrink-0"
                      value={scopes[p.id] || 'NONE'}
                      onChange={e => setScopes(s => ({ ...s, [p.id]: e.target.value as PermissionScope | 'NONE' }))}
                    >
                      {SCOPES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {perms.length === 0 && <div className="p-4 text-center text-sm text-[var(--text-tertiary)]">No permissions in the catalog.</div>}
        </div>
      )}
    </Modal>
  );
}
