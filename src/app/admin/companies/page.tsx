'use client';

// ============================================================
// Aura ERP — Administration → Companies (Multi-Company Governance, Phase 0)
// Manage the JEET group structure: operating companies and their members.
// Writes are admin-only (RLS) and audited. This is the governance surface for
// the Group → Company tenancy backbone; per-module data scoping follows.
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { companyService, type Company, type Group, type CompanyMember } from '@/services/companyService';
import {
  Building2, Plus, Pencil, Users, Power, Star, Trash2, X, ShieldAlert, Layers,
} from 'lucide-react';

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null);

  // company create/edit
  const [editing, setEditing] = useState<Company | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<{ name: string; code: string; legal_name: string; group_id: string }>({ name: '', code: '', legal_name: '', group_id: '' });
  const [saving, setSaving] = useState(false);

  // members
  const [membersFor, setMembersFor] = useState<Company | null>(null);
  const [members, setMembers] = useState<CompanyMember[]>([]);
  const [users, setUsers] = useState<{ id: string; full_name: string | null; email: string | null }[]>([]);
  const [addUserId, setAddUserId] = useState('');

  const load = useCallback(async () => {
    const [cos, grps] = await Promise.all([companyService.getCompanies(), companyService.getGroups()]);
    setCompanies(cos); setGroups(grps);
    setLoading(false);
  }, []);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: prof } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
        setIsAdmin((prof as { role?: string } | null)?.role === 'admin');
      }
      await load();
    })();
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', code: '', legal_name: '', group_id: groups[0]?.id || '' });
    setShowForm(true);
  };
  const openEdit = (c: Company) => {
    setEditing(c);
    setForm({ name: c.name, code: c.code || '', legal_name: c.legal_name || '', group_id: c.group_id || '' });
    setShowForm(true);
  };

  const save = async () => {
    if (!form.name.trim()) { setToast({ kind: 'err', msg: 'Name is required' }); return; }
    setSaving(true);
    try {
      if (editing) {
        await companyService.updateCompany(editing.id, { name: form.name.trim(), code: form.code.trim() || null, legal_name: form.legal_name.trim() || null, group_id: form.group_id || null });
        setToast({ kind: 'ok', msg: 'Company updated' });
      } else {
        await companyService.createCompany({ name: form.name.trim(), code: form.code.trim() || null, legal_name: form.legal_name.trim() || null, group_id: form.group_id || null });
        setToast({ kind: 'ok', msg: 'Company created' });
      }
      setShowForm(false);
      await load();
    } catch (e: unknown) {
      setToast({ kind: 'err', msg: e instanceof Error ? e.message : 'Save failed' });
    } finally { setSaving(false); }
  };

  const toggleActive = async (c: Company) => {
    try {
      await companyService.setCompanyActive(c.id, !c.is_active, c.name);
      await load();
    } catch (e: unknown) {
      setToast({ kind: 'err', msg: e instanceof Error ? e.message : 'Update failed' });
    }
  };

  const openMembers = async (c: Company) => {
    setMembersFor(c);
    setAddUserId('');
    const [mem, usr] = await Promise.all([companyService.getMembers(c.id), companyService.listUsers()]);
    setMembers(mem); setUsers(usr);
  };
  const reloadMembers = async (companyId: string) => setMembers(await companyService.getMembers(companyId));

  const addMember = async () => {
    if (!membersFor || !addUserId) return;
    try {
      await companyService.addMember(membersFor.id, addUserId, membersFor.name);
      setAddUserId('');
      await reloadMembers(membersFor.id);
      await load();
    } catch (e: unknown) { setToast({ kind: 'err', msg: e instanceof Error ? e.message : 'Add failed' }); }
  };
  const removeMember = async (m: CompanyMember) => {
    if (!membersFor) return;
    try {
      await companyService.removeMember(m.id, membersFor.id, membersFor.name);
      await reloadMembers(membersFor.id);
      await load();
    } catch (e: unknown) { setToast({ kind: 'err', msg: e instanceof Error ? e.message : 'Remove failed' }); }
  };
  const makeDefault = async (m: CompanyMember) => {
    if (!membersFor) return;
    try {
      await companyService.setDefaultCompany(m.user_id, membersFor.id);
      await reloadMembers(membersFor.id);
    } catch (e: unknown) { setToast({ kind: 'err', msg: e instanceof Error ? e.message : 'Failed' }); }
  };

  const memberIds = new Set(members.map(m => m.user_id));
  const addable = users.filter(u => !memberIds.has(u.id));

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Companies"
        subtitle="Group structure & operating companies — the multi-company tenancy backbone"
        breadcrumbs={[{ label: 'Administration', href: '/admin/hub' }, { label: 'Companies' }]}
      />

      {!isAdmin && !loading && (
        <Card className="p-3 border-l-4 flex items-center gap-2 text-xs" style={{ borderLeftColor: 'var(--status-warning-text)' }}>
          <ShieldAlert size={14} className="text-[var(--status-warning-text)]" />
          <span className="text-[var(--text-secondary)]">Read-only — administrator access is required to manage companies.</span>
        </Card>
      )}

      {/* Group summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4">
          <div className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]"><Layers size={13} /> Groups</div>
          <div className="text-xl font-bold mt-1 text-[var(--text-primary)]">{loading ? '—' : groups.length}</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]"><Building2 size={13} /> Companies</div>
          <div className="text-xl font-bold mt-1 text-[var(--text-primary)]">{loading ? '—' : companies.length}</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]"><Power size={13} /> Active</div>
          <div className="text-xl font-bold mt-1 text-[var(--status-success-text)]">{loading ? '—' : companies.filter(c => c.is_active).length}</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]"><Users size={13} /> Memberships</div>
          <div className="text-xl font-bold mt-1 text-[var(--text-primary)]">{loading ? '—' : companies.reduce((s, c) => s + (c.member_count || 0), 0)}</div>
        </Card>
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="p-3 border-b border-[var(--border)] flex items-center justify-between">
          <div className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2"><Building2 size={15} /> Operating companies</div>
          {isAdmin && <Button size="sm" variant="primary" icon={Plus} onClick={openCreate}>New company</Button>}
        </div>
        <div className="overflow-x-auto">
          <table className="quote-table">
            <thead>
              <tr><th>Company</th><th>Code</th><th>Group</th><th>Members</th><th>Status</th><th style={{ textAlign: 'right' }}>Actions</th></tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="p-6 text-center text-xs text-[var(--text-tertiary)]">Loading…</td></tr>
              ) : companies.length === 0 ? (
                <tr><td colSpan={6} className="p-6 text-center text-xs text-[var(--text-tertiary)]">No companies. Run the Phase 0 migration to seed the JEET group.</td></tr>
              ) : companies.map(c => (
                <tr key={c.id}>
                  <td>
                    <div className="text-xs font-medium text-[var(--text-primary)]">{c.name}</div>
                    {c.legal_name && <div className="text-[11px] text-[var(--text-tertiary)]">{c.legal_name}</div>}
                  </td>
                  <td><span className="text-xs font-mono text-[var(--text-secondary)]">{c.code || '—'}</span></td>
                  <td><span className="text-xs text-[var(--text-secondary)]">{c.group_name || '—'}</span></td>
                  <td><span className="text-xs text-[var(--text-secondary)]">{c.member_count ?? 0}</span></td>
                  <td>
                    <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[0.625rem] font-semibold uppercase border"
                      style={c.is_active
                        ? { background: 'var(--status-success-bg)', color: 'var(--status-success-text)', borderColor: 'var(--status-success-border)' }
                        : { background: 'var(--status-neutral-bg)', color: 'var(--status-neutral-text)', borderColor: 'var(--status-neutral-border)' }}>
                      {c.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>
                    <div className="flex justify-end gap-1.5">
                      <Button size="sm" variant="muted" icon={Users} onClick={() => openMembers(c)}>Members</Button>
                      {isAdmin && <Button size="sm" variant="muted" icon={Pencil} onClick={() => openEdit(c)}>Edit</Button>}
                      {isAdmin && <Button size="sm" variant="muted" icon={Power} onClick={() => toggleActive(c)}>{c.is_active ? 'Deactivate' : 'Activate'}</Button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Create / edit company */}
      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title={editing ? 'Edit company' : 'New company'} size="md"
        footer={<div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button><Button variant="primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button></div>}>
        <div className="flex flex-col gap-3">
          <div className="quote-form-group">
            <label>Name *</label>
            <input className="quote-form-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="JEET MEP" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="quote-form-group">
              <label>Code</label>
              <input className="quote-form-input" value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} placeholder="JEET-MEP" />
            </div>
            <div className="quote-form-group">
              <label>Group</label>
              <select className="quote-form-input" value={form.group_id} onChange={e => setForm(f => ({ ...f, group_id: e.target.value }))}>
                <option value="">— none —</option>
                {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>
          </div>
          <div className="quote-form-group">
            <label>Legal name</label>
            <input className="quote-form-input" value={form.legal_name} onChange={e => setForm(f => ({ ...f, legal_name: e.target.value }))} placeholder="JEET MEP Contracting L.L.C" />
          </div>
        </div>
      </Modal>

      {/* Members */}
      <Modal isOpen={!!membersFor} onClose={() => setMembersFor(null)} title={membersFor ? `Members — ${membersFor.name}` : ''} size="md">
        <div className="flex flex-col gap-3">
          {isAdmin && (
            <div className="flex gap-2">
              <select className="quote-form-input flex-1" value={addUserId} onChange={e => setAddUserId(e.target.value)}>
                <option value="">Add a user…</option>
                {addable.map(u => <option key={u.id} value={u.id}>{u.full_name || u.email || u.id}</option>)}
              </select>
              <Button variant="primary" icon={Plus} onClick={addMember} disabled={!addUserId}>Add</Button>
            </div>
          )}
          <div className="border border-[var(--border)] rounded-md divide-y divide-[var(--border)] max-h-[320px] overflow-y-auto">
            {members.length === 0 ? (
              <div className="p-4 text-xs text-[var(--text-tertiary)]">No members yet.</div>
            ) : members.map(m => (
              <div key={m.id} className="flex items-center justify-between gap-2 px-3 py-2">
                <div className="min-w-0">
                  <div className="text-xs font-medium text-[var(--text-primary)] truncate">{m.full_name || 'Unknown user'}{m.is_default && <span className="ml-1.5 text-[10px] text-[var(--accent)]">★ default</span>}</div>
                  <div className="text-[11px] text-[var(--text-tertiary)] truncate">{m.email || m.user_id}</div>
                </div>
                {isAdmin && (
                  <div className="flex items-center gap-1.5 shrink-0">
                    {!m.is_default && <Button size="sm" variant="muted" icon={Star} onClick={() => makeDefault(m)}>Default</Button>}
                    <Button size="sm" variant="muted" icon={Trash2} onClick={() => removeMember(m)}>Remove</Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </Modal>

      {toast && (
        <div className="fixed bottom-5 right-5 z-[960] px-4 py-2.5 rounded-lg border text-sm shadow-lg flex items-center gap-2"
          style={{
            background: toast.kind === 'ok' ? 'var(--status-success-bg)' : 'var(--status-danger-bg)',
            color: toast.kind === 'ok' ? 'var(--status-success-text)' : 'var(--status-danger-text)',
            borderColor: toast.kind === 'ok' ? 'var(--status-success-border)' : 'var(--status-danger-border)',
          }}>
          {toast.msg}<button onClick={() => setToast(null)}><X size={13} /></button>
        </div>
      )}
    </div>
  );
}
