// JEET ERP — Company Announcements service
import { supabase } from '@/lib/supabase';
import type { Announcement } from '@/types/comms.types';

export const announcementService = {
  async list(userId?: string): Promise<Announcement[]> {
    const { data, error } = await supabase.from('announcements').select('*').eq('is_active', true).order('is_pinned', { ascending: false }).order('published_at', { ascending: false });
    if (error) return [];
    const rows = (data || []) as Announcement[];
    const ids = [...new Set(rows.map(r => r.author_id).filter(Boolean))] as string[];
    const nm = new Map<string, string>();
    if (ids.length) { const { data: p } = await supabase.from('profiles').select('id, full_name').in('id', ids); (p || []).forEach((x: any) => nm.set(x.id, x.full_name)); }
    let readSet = new Set<string>();
    if (userId && rows.length) { const { data: r } = await supabase.from('announcement_reads').select('announcement_id').eq('user_id', userId); readSet = new Set((r || []).map((x: any) => x.announcement_id)); }
    return rows.map(a => ({ ...a, author_name: a.author_id ? nm.get(a.author_id) : undefined, read: readSet.has(a.id) }));
  },
  async create(a: Partial<Announcement>): Promise<Announcement | null> {
    const { data, error } = await supabase.from('announcements').insert({
      title: a.title, body: a.body || null, author_id: a.author_id || null,
      audience: a.audience || 'all', department: a.department || null, target_role: a.target_role || null,
      priority: a.priority || 'normal', is_pinned: a.is_pinned || false, attachments: a.attachments || [],
      expires_at: a.expires_at || null,
    }).select().single();
    if (error) return null;
    return data as Announcement;
  },
  async togglePin(id: string, pinned: boolean): Promise<void> { await supabase.from('announcements').update({ is_pinned: pinned }).eq('id', id); },
  async archive(id: string): Promise<void> { await supabase.from('announcements').update({ is_active: false }).eq('id', id); },
  async markRead(id: string, userId: string): Promise<void> { await supabase.from('announcement_reads').upsert({ announcement_id: id, user_id: userId }, { onConflict: 'announcement_id,user_id' }).then(() => {}, () => {}); },
};
