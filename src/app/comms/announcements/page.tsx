'use client';

// ============================================================
// JEET ERP — Company Announcements
// Broadcast to all / a department / a role, with priority and pin.
// Read-state per user. Additive.
// ============================================================

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { announcementService } from '@/services/announcementService';
import { DEPARTMENT_CHANNELS } from '@/types/comms.types';
import type { Announcement, AnnouncementPriority } from '@/types/comms.types';
import { Megaphone, Plus, Pin, PinOff, X, AlertTriangle, Archive } from 'lucide-react';

const PRIO: Record<AnnouncementPriority, { label: string; bg: string; text: string }> = {
  normal: { label: 'Normal', bg: 'var(--surface-active)', text: 'var(--text-secondary)' },
  important: { label: 'Important', bg: 'var(--status-warning-bg)', text: 'var(--status-warning-text)' },
  urgent: { label: 'Urgent', bg: 'var(--status-danger-bg)', text: 'var(--status-danger-text)' },
};

export default function AnnouncementsPage() {
  const [list, setList] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [meId, setMeId] = useState<string | null>(null);
  const [meRole, setMeRole] = useState<string>('');
  const [showCreate, setShowCreate] = useState(false);

  const load = async (uid?: string) => { setList(await announcementService.list(uid)); setLoading(false); };
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setMeId(user?.id || null);
      if (user) { const { data: p } = await supabase.from('profiles').select('role').eq('id', user.id).limit(1); setMeRole(p?.[0]?.role || ''); }
      load(user?.id);
    })();
  }, []);

  const canPost = ['admin', 'manager', 'administrator', 'general manager'].includes(meRole.toLowerCase()) || meRole === '';

  const markRead = (a: Announcement) => { if (meId && !a.read) { announcementService.markRead(a.id, meId); setList(l => l.map(x => x.id === a.id ? { ...x, read: true } : x)); } };

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Company Announcements" subtitle="Broadcasts to the whole company, a department or a role"
        breadcrumbs={[{ label: 'Communication', href: '/comms' }, { label: 'Announcements' }]}
        actions={canPost ? <Button variant="primary" icon={Plus} onClick={() => setShowCreate(true)}>New announcement</Button> : undefined} />

      {loading ? <Card><div className="p-8 text-center text-sm text-[var(--text-tertiary)]">Loading…</div></Card>
        : list.length === 0 ? <Card><EmptyState icon={Megaphone} title="No announcements" description="Company-wide announcements will appear here." /></Card>
          : (
            <div className="flex flex-col gap-3">
              {list.map(a => (
                <Card key={a.id} className="p-4" style={{ borderLeft: a.priority !== 'normal' ? `3px solid ${PRIO[a.priority].text}` : undefined }} onMouseEnter={() => markRead(a)}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        {a.is_pinned && <Pin size={13} className="text-[var(--accent)]" />}
                        <h3 className="text-sm font-semibold text-[var(--text-primary)]">{a.title}</h3>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: PRIO[a.priority].bg, color: PRIO[a.priority].text }}>{PRIO[a.priority].label}</span>
                        {a.audience !== 'all' && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--surface-active)] text-[var(--text-secondary)]">{a.audience === 'department' ? `#${a.department}` : a.target_role}</span>}
                        {!a.read && <span className="h-2 w-2 rounded-full" style={{ background: 'var(--accent)' }} />}
                      </div>
                      {a.body && <p className="text-sm text-[var(--text-secondary)] mt-1.5 whitespace-pre-wrap">{a.body}</p>}
                      <div className="text-[11px] text-[var(--text-tertiary)] mt-2">{a.author_name || 'System'} · {new Date(a.published_at).toLocaleString('en-AE', { dateStyle: 'medium', timeStyle: 'short' })}</div>
                    </div>
                    {canPost && (
                      <div className="flex items-center gap-1 shrink-0">
                        <button title={a.is_pinned ? 'Unpin' : 'Pin'} onClick={() => { announcementService.togglePin(a.id, !a.is_pinned); setList(l => l.map(x => x.id === a.id ? { ...x, is_pinned: !x.is_pinned } : x).sort((p, q) => Number(q.is_pinned) - Number(p.is_pinned))); }} className="h-7 w-7 grid place-items-center rounded-lg hover:bg-[var(--surface-hover)] text-[var(--text-secondary)]">{a.is_pinned ? <PinOff size={14} /> : <Pin size={14} />}</button>
                        <button title="Archive" onClick={() => { if (confirm('Archive this announcement?')) { announcementService.archive(a.id); setList(l => l.filter(x => x.id !== a.id)); } }} className="h-7 w-7 grid place-items-center rounded-lg hover:bg-[var(--surface-hover)] text-[var(--text-secondary)]"><Archive size={14} /></button>
                      </div>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}

      {showCreate && <CreateModal close={() => setShowCreate(false)} meId={meId} onCreated={(a) => { setList(l => [a, ...l].sort((p, q) => Number(q.is_pinned) - Number(p.is_pinned))); setShowCreate(false); }} />}
    </div>
  );
}

function CreateModal({ close, meId, onCreated }: { close: () => void; meId: string | null; onCreated: (a: Announcement) => void }) {
  const [title, setTitle] = useState(''); const [body, setBody] = useState('');
  const [priority, setPriority] = useState<AnnouncementPriority>('normal');
  const [audience, setAudience] = useState<'all' | 'department'>('all');
  const [department, setDepartment] = useState('finance');
  const [pinned, setPinned] = useState(false); const [saving, setSaving] = useState(false);
  const submit = async () => {
    if (!title.trim()) return; setSaving(true);
    const a = await announcementService.create({ title: title.trim(), body, author_id: meId, priority, audience, department: audience === 'department' ? department : null, is_pinned: pinned });
    setSaving(false);
    if (a) onCreated({ ...a, read: true } as Announcement); else alert('Could not publish — apply the comms migration first.');
  };
  return (
    <div className="fixed inset-0 z-[1000] bg-slate-900/50 flex items-center justify-center p-4" onClick={close}>
      <div className="w-full max-w-lg bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b border-[var(--border)] flex items-center justify-between"><h3 className="text-sm font-semibold text-[var(--text-primary)]">New announcement</h3><button onClick={close}><X size={18} className="text-[var(--text-tertiary)]" /></button></div>
        <div className="p-4 flex flex-col gap-3">
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Title" className="w-full h-9 px-3 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] text-sm" />
          <textarea value={body} onChange={e => setBody(e.target.value)} placeholder="Message…" rows={5} className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] text-sm resize-none" />
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs text-[var(--text-secondary)]">Priority<select value={priority} onChange={e => setPriority(e.target.value as AnnouncementPriority)} className="w-full h-9 mt-1 px-2 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] text-sm"><option value="normal">Normal</option><option value="important">Important</option><option value="urgent">Urgent</option></select></label>
            <label className="text-xs text-[var(--text-secondary)]">Audience<select value={audience} onChange={e => setAudience(e.target.value as any)} className="w-full h-9 mt-1 px-2 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] text-sm"><option value="all">Everyone</option><option value="department">Department</option></select></label>
          </div>
          {audience === 'department' && <select value={department} onChange={e => setDepartment(e.target.value)} className="w-full h-9 px-2 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] text-sm">{DEPARTMENT_CHANNELS.map(d => <option key={d.key} value={d.key}>{d.label}</option>)}</select>}
          <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)]"><input type="checkbox" checked={pinned} onChange={e => setPinned(e.target.checked)} /> Pin to top</label>
          <Button variant="primary" onClick={submit} isLoading={saving} disabled={!title.trim()}>Publish announcement</Button>
        </div>
      </div>
    </div>
  );
}
