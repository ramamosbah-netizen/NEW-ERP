// JEET ERP — Communication notifications: in-app feed + channel preferences
import { supabase } from '@/lib/supabase';
import type { CommNotification, NotificationPref, NotifChannel } from '@/types/comms.types';

const CHANNELS: NotifChannel[] = ['in_app', 'email', 'whatsapp', 'push'];
const EVENTS = ['all', 'mention', 'dm', 'channel', 'announcement', 'call'] as const;

export const commNotificationService = {
  async list(userId: string): Promise<CommNotification[]> {
    const { data, error } = await supabase.from('comm_notifications').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(100);
    if (error) return [];
    const rows = (data || []) as CommNotification[];
    const ids = [...new Set(rows.map(r => r.actor_id).filter(Boolean))] as string[];
    const nm = new Map<string, string>();
    if (ids.length) { const { data: p } = await supabase.from('profiles').select('id, full_name').in('id', ids); (p || []).forEach((x: any) => nm.set(x.id, x.full_name)); }
    return rows.map(n => ({ ...n, actor_name: n.actor_id ? nm.get(n.actor_id) : undefined }));
  },
  async unreadCount(userId: string): Promise<number> {
    const { count } = await supabase.from('comm_notifications').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('is_read', false);
    return count || 0;
  },
  async markRead(id: string): Promise<void> { await supabase.from('comm_notifications').update({ is_read: true }).eq('id', id); },
  async markAllRead(userId: string): Promise<void> { await supabase.from('comm_notifications').update({ is_read: true }).eq('user_id', userId).eq('is_read', false); },

  async getPrefs(userId: string): Promise<NotificationPref[]> {
    const { data, error } = await supabase.from('comm_notification_prefs').select('*').eq('user_id', userId);
    if (error) return [];
    const existing = new Map((data || []).map((p: any) => [`${p.channel}|${p.event_type}`, p.enabled]));
    // present a full matrix (default enabled for in_app, off for others unless set)
    const out: NotificationPref[] = [];
    for (const channel of CHANNELS) for (const event_type of EVENTS) {
      const key = `${channel}|${event_type}`;
      const def = channel === 'in_app';
      out.push({ user_id: userId, channel, event_type, enabled: existing.has(key) ? !!existing.get(key) : def });
    }
    return out;
  },
  async setPref(userId: string, channel: NotifChannel, eventType: string, enabled: boolean): Promise<void> {
    await supabase.from('comm_notification_prefs').upsert({ user_id: userId, channel, event_type: eventType, enabled }, { onConflict: 'user_id,channel,event_type' });
  },
};
