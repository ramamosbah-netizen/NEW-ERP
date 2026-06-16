'use client';

// ============================================================
// JEET ERP — Notifications Center
// In-app feed + per-channel delivery preferences
// (in-app / email / WhatsApp / push). Additive.
// ============================================================

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { commNotificationService } from '@/services/commNotificationService';
import type { CommNotification, NotificationPref, NotifChannel } from '@/types/comms.types';
import { Bell, CheckCheck, AtSign, Megaphone, Phone, FileText, MessageSquare, Monitor, Mail, MessageCircle, Smartphone } from 'lucide-react';

const TYPE_ICON: Record<string, any> = { message: MessageSquare, mention: AtSign, announcement: Megaphone, call: Phone, document: FileText };
const CHANNELS: { key: NotifChannel; label: string; icon: any; note?: string }[] = [
  { key: 'in_app', label: 'In-app', icon: Monitor },
  { key: 'email', label: 'Email', icon: Mail, note: 'Outlook / Gmail / SMTP' },
  { key: 'whatsapp', label: 'WhatsApp', icon: MessageCircle, note: 'WhatsApp Business' },
  { key: 'push', label: 'Push', icon: Smartphone },
];
const EVENTS: { key: string; label: string }[] = [
  { key: 'all', label: 'Everything' }, { key: 'mention', label: 'Mentions' }, { key: 'dm', label: 'Direct messages' },
  { key: 'channel', label: 'Channel messages' }, { key: 'announcement', label: 'Announcements' }, { key: 'call', label: 'Calls' },
];
const fmtAgo = (iso: string) => { const d = Date.now() - new Date(iso).getTime(); const m = Math.floor(d / 60000), h = Math.floor(m / 60), dd = Math.floor(h / 24); return dd ? `${dd}d` : h ? `${h}h` : m ? `${m}m` : 'now'; };

export default function NotificationsCenterPage() {
  const router = useRouter();
  const [meId, setMeId] = useState<string | null>(null);
  const [feed, setFeed] = useState<CommNotification[]>([]);
  const [prefs, setPrefs] = useState<NotificationPref[]>([]);
  const [tab, setTab] = useState<'feed' | 'prefs'>('feed');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      setMeId(user.id);
      const [f, p] = await Promise.all([commNotificationService.list(user.id), commNotificationService.getPrefs(user.id)]);
      setFeed(f); setPrefs(p); setLoading(false);
    })();
  }, []);

  const prefOn = (c: NotifChannel, e: string) => prefs.find(p => p.channel === c && p.event_type === e)?.enabled ?? false;
  const toggle = (c: NotifChannel, e: string) => {
    if (!meId) return; const next = !prefOn(c, e);
    setPrefs(p => p.map(x => x.channel === c && x.event_type === e ? { ...x, enabled: next } : x));
    commNotificationService.setPref(meId, c, e, next);
  };
  const markAll = () => { if (meId) { commNotificationService.markAllRead(meId); setFeed(f => f.map(n => ({ ...n, is_read: true }))); } };
  const open = (n: CommNotification) => { if (!n.is_read) { commNotificationService.markRead(n.id); setFeed(f => f.map(x => x.id === n.id ? { ...x, is_read: true } : x)); } if (n.link) router.push(n.link); };
  const unread = feed.filter(n => !n.is_read).length;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Notifications Center" subtitle="Your in-app feed and how each event reaches you"
        breadcrumbs={[{ label: 'Communication', href: '/comms' }, { label: 'Notifications' }]}
        actions={tab === 'feed' && unread > 0 ? <Button variant="secondary" icon={CheckCheck} onClick={markAll}>Mark all read</Button> : undefined} />

      <Card className="p-1.5 flex gap-1 w-fit">
        {(['feed', 'prefs'] as const).map(t => <button key={t} onClick={() => setTab(t)} className="px-4 h-8 rounded-lg text-sm font-medium" style={{ background: tab === t ? 'var(--accent)' : 'transparent', color: tab === t ? '#fff' : 'var(--text-secondary)' }}>{t === 'feed' ? `Feed${unread ? ` (${unread})` : ''}` : 'Delivery preferences'}</button>)}
      </Card>

      {loading ? <Card><div className="p-8 text-center text-sm text-[var(--text-tertiary)]">Loading…</div></Card> : tab === 'feed' ? (
        feed.length === 0 ? <Card><EmptyState icon={Bell} title="You're all caught up" description="Mentions, announcements and call alerts will appear here." /></Card> : (
          <Card className="p-0 overflow-hidden divide-y divide-[var(--border)]">
            {feed.map(n => { const Icon = TYPE_ICON[n.type] || Bell; return (
              <button key={n.id} onClick={() => open(n)} className="w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-[var(--surface-hover)]" style={{ background: n.is_read ? 'transparent' : 'var(--accent-glow)' }}>
                <span className="h-8 w-8 rounded-lg grid place-items-center shrink-0" style={{ background: 'var(--surface-active)' }}><Icon size={15} className="text-[var(--accent)]" /></span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm text-[var(--text-primary)]">{n.title || n.type}{n.actor_name ? <span className="text-[var(--text-tertiary)] font-normal"> · {n.actor_name}</span> : ''}</span>
                  {n.body && <span className="block text-xs text-[var(--text-tertiary)] truncate">{n.body}</span>}
                </span>
                <span className="text-[11px] text-[var(--text-tertiary)] shrink-0">{fmtAgo(n.created_at)}</span>
              </button>
            ); })}
          </Card>
        )
      ) : (
        <>
          <Card className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-[var(--border)] text-left text-[var(--text-tertiary)] text-xs"><th className="p-3">Event</th>{CHANNELS.map(c => <th key={c.key} className="p-3 text-center"><div className="flex flex-col items-center gap-0.5"><c.icon size={15} />{c.label}</div></th>)}</tr></thead>
              <tbody>
                {EVENTS.map(ev => (
                  <tr key={ev.key} className="border-b border-[var(--border)] last:border-0">
                    <td className="p-3 font-medium text-[var(--text-primary)]">{ev.label}</td>
                    {CHANNELS.map(c => (
                      <td key={c.key} className="p-3 text-center">
                        <button onClick={() => toggle(c.key, ev.key)} className="relative inline-flex h-5 w-9 items-center rounded-full transition-colors" style={{ background: prefOn(c.key, ev.key) ? 'var(--accent)' : 'var(--border)' }}>
                          <span className="inline-block h-4 w-4 transform rounded-full bg-white transition-transform" style={{ transform: prefOn(c.key, ev.key) ? 'translateX(18px)' : 'translateX(2px)' }} />
                        </button>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <Card className="p-4 flex items-start gap-2 text-xs text-[var(--text-tertiary)]">
            <Bell size={14} className="mt-0.5 shrink-0" />
            <span>In-app delivery is always available. Email (Outlook / Gmail / SMTP), WhatsApp Business and push require their integration credentials to be configured in <a href="/comms/admin" className="text-[var(--accent)]">Communication settings</a> before those channels deliver.</span>
          </Card>
        </>
      )}
    </div>
  );
}
