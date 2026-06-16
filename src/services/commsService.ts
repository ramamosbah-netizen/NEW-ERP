// ============================================================
// JEET ERP — Communication & Collaboration — core service
// Conversations, messages, members, reactions, read receipts,
// search and Supabase Realtime helpers. Degrades gracefully when
// the migration has not yet been applied (PGRST205/204 -> []).
// ============================================================

import { supabase } from '@/lib/supabase';
import type {
  Conversation, ConversationMember, Message, MessageReaction,
  DirectoryUser, Attachment,
} from '@/types/comms.types';

const MISSING = (e: any) => e && (e.code === 'PGRST205' || e.code === 'PGRST204' || e.code === '42P01');

async function nameMap(ids: (string | null | undefined)[]): Promise<Map<string, string>> {
  const uniq = [...new Set(ids.filter(Boolean))] as string[];
  if (!uniq.length) return new Map();
  const { data } = await supabase.from('profiles').select('id, full_name').in('id', uniq);
  return new Map((data || []).map((p: any) => [p.id, p.full_name as string]));
}

export const commsService = {
  async getDirectory(excludeId?: string): Promise<DirectoryUser[]> {
    const { data, error } = await supabase.from('profiles').select('id, full_name, email, role').order('full_name');
    if (error) return [];
    return (data || []).filter((u: any) => u.id !== excludeId) as DirectoryUser[];
  },

  // ---- conversations ----
  async getMyConversations(userId: string): Promise<Conversation[]> {
    try {
      const [{ data: mem }, { data: channels }] = await Promise.all([
        supabase.from('conversation_members').select('conversation_id, last_read_at').eq('user_id', userId),
        supabase.from('conversations').select('*').eq('type', 'CHANNEL').eq('is_archived', false),
      ]);
      const myReadMap = new Map<string, string | null>((mem || []).map((m: any) => [m.conversation_id, m.last_read_at]));
      const memberIds = (mem || []).map((m: any) => m.conversation_id);
      const channelList = (channels || []) as Conversation[];
      const ids = [...new Set([...memberIds, ...channelList.map(c => c.id)])];
      if (!ids.length) return [];

      const { data: convs } = await supabase.from('conversations').select('*').in('id', ids).eq('is_archived', false).order('last_message_at', { ascending: false });
      const allConvs = (convs || []) as Conversation[];

      // members (for DM display names) + last messages
      const { data: allMembers } = await supabase.from('conversation_members').select('conversation_id, user_id, role, last_read_at, is_muted').in('conversation_id', ids);
      const { data: recent } = await supabase.from('messages').select('id, conversation_id, sender_id, body, type, created_at, is_deleted').in('conversation_id', ids).order('created_at', { ascending: false }).limit(600);

      const nm = await nameMap([...(allMembers || []).map((m: any) => m.user_id), ...(recent || []).map((m: any) => m.sender_id)]);
      const membersByConv = new Map<string, ConversationMember[]>();
      (allMembers || []).forEach((m: any) => {
        const arr = membersByConv.get(m.conversation_id) || [];
        arr.push({ ...m, full_name: nm.get(m.user_id) }); membersByConv.set(m.conversation_id, arr);
      });
      const lastByConv = new Map<string, Message>();
      const unreadByConv = new Map<string, number>();
      (recent || []).forEach((msg: any) => {
        if (!lastByConv.has(msg.conversation_id)) lastByConv.set(msg.conversation_id, { ...msg, sender_name: nm.get(msg.sender_id) });
        const lr = myReadMap.get(msg.conversation_id);
        if (msg.sender_id !== userId && (!lr || msg.created_at > lr)) unreadByConv.set(msg.conversation_id, (unreadByConv.get(msg.conversation_id) || 0) + 1);
      });

      return allConvs.map(c => {
        const members = membersByConv.get(c.id) || [];
        let display = c.name || '';
        if (c.type === 'DIRECT') { const other = members.find(m => m.user_id !== userId); display = other?.full_name || 'Direct message'; }
        return { ...c, members, display_name: display, last_message: lastByConv.get(c.id) || null, unread: unreadByConv.get(c.id) || 0 };
      });
    } catch (e) { if (MISSING(e)) return []; return []; }
  },

  async getConversation(id: string, userId: string): Promise<Conversation | null> {
    const { data, error } = await supabase.from('conversations').select('*').eq('id', id).limit(1);
    if (error || !data?.length) return null;
    const conv = data[0] as Conversation;
    const { data: mem } = await supabase.from('conversation_members').select('*').eq('conversation_id', id);
    const nm = await nameMap((mem || []).map((m: any) => m.user_id));
    conv.members = (mem || []).map((m: any) => ({ ...m, full_name: nm.get(m.user_id) }));
    if (conv.type === 'DIRECT') { const other = conv.members.find(m => m.user_id !== userId); conv.display_name = other?.full_name || 'Direct message'; }
    else conv.display_name = conv.name || '';
    return conv;
  },

  async getChannel(channelKey: string): Promise<Conversation | null> {
    const { data } = await supabase.from('conversations').select('*').eq('type', 'CHANNEL').eq('channel_key', channelKey).limit(1);
    return data?.[0] ? (data[0] as Conversation) : null;
  },

  async getOrCreateDirect(meId: string, otherId: string): Promise<Conversation | null> {
    // find an existing DM containing exactly both
    const { data: mine } = await supabase.from('conversation_members').select('conversation_id').eq('user_id', meId);
    const myIds = (mine || []).map((m: any) => m.conversation_id);
    if (myIds.length) {
      const { data: shared } = await supabase.from('conversation_members').select('conversation_id').eq('user_id', otherId).in('conversation_id', myIds);
      const candidateIds = (shared || []).map((m: any) => m.conversation_id);
      if (candidateIds.length) {
        const { data: dms } = await supabase.from('conversations').select('*').in('id', candidateIds).eq('type', 'DIRECT');
        if (dms?.length) return this.getConversation(dms[0].id, meId);
      }
    }
    const { data: conv, error } = await supabase.from('conversations').insert({ type: 'DIRECT', created_by: meId }).select().single();
    if (error || !conv) return null;
    await supabase.from('conversation_members').insert([
      { conversation_id: conv.id, user_id: meId, role: 'owner' },
      { conversation_id: conv.id, user_id: otherId, role: 'member' },
    ]);
    return this.getConversation(conv.id, meId);
  },

  async createGroup(name: string, memberIds: string[], creatorId: string, type: 'GROUP' | 'PROJECT' = 'GROUP', projectId?: string): Promise<Conversation | null> {
    const { data: conv, error } = await supabase.from('conversations').insert({ type, name, created_by: creatorId, project_id: projectId || null }).select().single();
    if (error || !conv) return null;
    const ids = [...new Set([creatorId, ...memberIds])];
    await supabase.from('conversation_members').insert(ids.map(uid => ({ conversation_id: conv.id, user_id: uid, role: uid === creatorId ? 'owner' : 'member' })));
    return this.getConversation(conv.id, creatorId);
  },

  async getProjectRoom(projectId: string): Promise<Conversation | null> {
    const { data } = await supabase.from('conversations').select('*').eq('type', 'PROJECT').eq('project_id', projectId).limit(1);
    return data?.[0] ? (data[0] as Conversation) : null;
  },

  async joinChannel(conversationId: string, userId: string): Promise<void> {
    await supabase.from('conversation_members').upsert({ conversation_id: conversationId, user_id: userId, role: 'member' }, { onConflict: 'conversation_id,user_id' });
  },

  async addMembers(conversationId: string, userIds: string[]): Promise<void> {
    if (!userIds.length) return;
    await supabase.from('conversation_members').upsert(userIds.map(uid => ({ conversation_id: conversationId, user_id: uid, role: 'member' })), { onConflict: 'conversation_id,user_id' });
  },

  // ---- messages ----
  async getMessages(conversationId: string, limit = 80): Promise<Message[]> {
    try {
      const { data, error } = await supabase.from('messages').select('*').eq('conversation_id', conversationId).is('parent_message_id', null).order('created_at', { ascending: false }).limit(limit);
      if (error) { if (MISSING(error)) return []; return []; }
      const rows = (data || []).reverse() as Message[];
      const ids = rows.map(r => r.id);
      const [{ data: reactions }, { data: replies }, { data: reads }] = await Promise.all([
        ids.length ? supabase.from('message_reactions').select('*').in('message_id', ids) : Promise.resolve({ data: [] } as any),
        ids.length ? supabase.from('messages').select('parent_message_id').in('parent_message_id', ids) : Promise.resolve({ data: [] } as any),
        ids.length ? supabase.from('message_reads').select('message_id, user_id').in('message_id', ids) : Promise.resolve({ data: [] } as any),
      ]);
      const nm = await nameMap(rows.map(r => r.sender_id));
      const reByMsg = new Map<string, MessageReaction[]>();
      (reactions || []).forEach((r: any) => { const a = reByMsg.get(r.message_id) || []; a.push(r); reByMsg.set(r.message_id, a); });
      const replyCount = new Map<string, number>();
      (replies || []).forEach((r: any) => replyCount.set(r.parent_message_id, (replyCount.get(r.parent_message_id) || 0) + 1));
      const readBy = new Map<string, string[]>();
      (reads || []).forEach((r: any) => { const a = readBy.get(r.message_id) || []; a.push(r.user_id); readBy.set(r.message_id, a); });
      return rows.map(r => ({ ...r, sender_name: r.sender_id ? nm.get(r.sender_id) : undefined, reactions: reByMsg.get(r.id) || [], reply_count: replyCount.get(r.id) || 0, read_by: readBy.get(r.id) || [] }));
    } catch (e) { return []; }
  },

  async getThread(parentId: string): Promise<Message[]> {
    const { data } = await supabase.from('messages').select('*').eq('parent_message_id', parentId).order('created_at', { ascending: true });
    const rows = (data || []) as Message[];
    const nm = await nameMap(rows.map(r => r.sender_id));
    return rows.map(r => ({ ...r, sender_name: r.sender_id ? nm.get(r.sender_id) : undefined }));
  },

  async sendMessage(p: { conversationId: string; senderId: string; body: string; attachments?: Attachment[]; mentions?: string[]; parentId?: string; type?: string }): Promise<Message | null> {
    const { data, error } = await supabase.from('messages').insert({
      conversation_id: p.conversationId, sender_id: p.senderId, body: p.body || null,
      type: p.type || (p.attachments?.length ? 'file' : 'text'),
      attachments: p.attachments || [], mentions: p.mentions || [], parent_message_id: p.parentId || null,
    }).select().single();
    if (error) return null;
    await supabase.from('conversations').update({ last_message_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', p.conversationId);
    // fan-out notifications to mentioned users
    if (p.mentions?.length) {
      await supabase.from('comm_notifications').insert(p.mentions.filter(u => u !== p.senderId).map(uid => ({
        user_id: uid, type: 'mention', title: 'You were mentioned', body: (p.body || '').slice(0, 120), actor_id: p.senderId, conversation_id: p.conversationId, link: `/comms?c=${p.conversationId}`,
      }))).then(() => {}, () => {});
    }
    return data as Message;
  },

  async editMessage(id: string, body: string): Promise<void> {
    await supabase.from('messages').update({ body, edited_at: new Date().toISOString() }).eq('id', id);
  },
  async deleteMessage(id: string): Promise<void> {
    await supabase.from('messages').update({ is_deleted: true, body: null, attachments: [] }).eq('id', id);
  },

  async toggleReaction(messageId: string, userId: string, emoji: string): Promise<void> {
    const { data } = await supabase.from('message_reactions').select('emoji').eq('message_id', messageId).eq('user_id', userId).eq('emoji', emoji).limit(1);
    if (data?.length) await supabase.from('message_reactions').delete().eq('message_id', messageId).eq('user_id', userId).eq('emoji', emoji);
    else await supabase.from('message_reactions').insert({ message_id: messageId, user_id: userId, emoji });
  },

  async markRead(conversationId: string, userId: string, messageIds: string[] = []): Promise<void> {
    await supabase.from('conversation_members').update({ last_read_at: new Date().toISOString() }).eq('conversation_id', conversationId).eq('user_id', userId);
    if (messageIds.length) await supabase.from('message_reads').upsert(messageIds.map(mid => ({ message_id: mid, user_id: userId })), { onConflict: 'message_id,user_id' }).then(() => {}, () => {});
  },

  async searchMessages(query: string, userId: string): Promise<Message[]> {
    if (!query.trim()) return [];
    try {
      const { data: mem } = await supabase.from('conversation_members').select('conversation_id').eq('user_id', userId);
      const { data: chans } = await supabase.from('conversations').select('id').eq('type', 'CHANNEL');
      const ids = [...new Set([...(mem || []).map((m: any) => m.conversation_id), ...(chans || []).map((c: any) => c.id)])];
      if (!ids.length) return [];
      const { data } = await supabase.from('messages').select('*').in('conversation_id', ids).ilike('body', `%${query}%`).eq('is_deleted', false).order('created_at', { ascending: false }).limit(50);
      const rows = (data || []) as Message[];
      const nm = await nameMap(rows.map(r => r.sender_id));
      return rows.map(r => ({ ...r, sender_name: r.sender_id ? nm.get(r.sender_id) : undefined }));
    } catch { return []; }
  },

  // ---- realtime ----
  subscribeToConversation(conversationId: string, onMessage: (m: any) => void, onReaction?: (r: any) => void) {
    const id = Math.random().toString(36).slice(2, 9);
    const channel = supabase.channel(`conv-${conversationId}-${id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` }, (payload) => onMessage(payload.new))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` }, (payload) => onMessage(payload.new))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'message_reactions' }, (payload) => onReaction?.(payload))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  },

  subscribeToInbox(userId: string, onChange: () => void) {
    const id = Math.random().toString(36).slice(2, 9);
    const channel = supabase.channel(`inbox-${userId}-${id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => onChange())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  },

  // ---- SMTP configurations ----
  async getUserSmtpConfig(userId: string): Promise<any> {
    const { data, error } = await supabase.from('user_smtp_configs').select('*').eq('user_id', userId).limit(1);
    if (error || !data?.length) return null;
    return data[0];
  },
  async saveUserSmtpConfig(userId: string, host: string, port: number, username: string, password: string, senderEmail: string): Promise<boolean> {
    const { error } = await supabase.from('user_smtp_configs').upsert({
      user_id: userId,
      host,
      port,
      username,
      password,
      sender_email: senderEmail,
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id' });
    return !error;
  },
  async deleteUserSmtpConfig(userId: string): Promise<boolean> {
    const { error } = await supabase.from('user_smtp_configs').delete().eq('user_id', userId);
    return !error;
  },
  async getAllUserSmtpConfigs(): Promise<any[]> {
    const { data, error } = await supabase.from('user_smtp_configs').select('*').order('updated_at', { ascending: false });
    if (error) return [];
    const ids = (data || []).map((r: any) => r.user_id);
    const nm = await nameMap(ids);
    return (data || []).map((r: any) => ({ ...r, user_name: nm.get(r.user_id) || 'Unknown User' }));
  },

  // ---- meetings / calls lifecycle ----
  async getMeetingByRoom(roomName: string): Promise<any | null> {
    const { data } = await supabase.from('comm_calls').select('*').eq('room_name', roomName).in('status', ['ringing', 'ongoing', 'active']).order('started_at', { ascending: false }).limit(1);
    return data?.[0] || null;
  },

  async startMeeting(p: { roomName: string; type: 'voice' | 'video'; conversationId?: string | null; startedBy: string; title?: string }): Promise<any | null> {
    const { data, error } = await supabase.from('comm_calls').insert({
      conversation_id: p.conversationId || null, type: p.type, room_name: p.roomName,
      room_url: `/comms/meeting/${p.roomName}`, started_by: p.startedBy, title: p.title || null,
      status: 'active', participant_count: 0, last_activity_at: new Date().toISOString(),
    }).select().single();
    if (error) return null;
    return data;
  },

  // join existing live meeting for this room, or start a fresh one
  async getOrStartMeeting(roomName: string, p: { type: 'voice' | 'video'; conversationId?: string | null; startedBy: string; title?: string }): Promise<any | null> {
    const existing = await this.getMeetingByRoom(roomName);
    if (existing) return existing;
    return this.startMeeting({ roomName, ...p });
  },

  async recordParticipantJoin(callId: string, userId: string, displayName?: string): Promise<void> {
    await supabase.from('comm_call_participants').upsert({ call_id: callId, user_id: userId, display_name: displayName || null, joined_at: new Date().toISOString(), left_at: null }, { onConflict: 'call_id,user_id' }).then(() => {}, () => {});
    await supabase.from('comm_calls').update({ last_activity_at: new Date().toISOString() }).eq('id', callId).then(() => {}, () => {});
  },

  async recordParticipantLeave(callId: string, userId: string): Promise<void> {
    const { data } = await supabase.from('comm_call_participants').select('joined_at').eq('call_id', callId).eq('user_id', userId).limit(1);
    const joined = data?.[0]?.joined_at;
    const dur = joined ? Math.max(0, Math.round((Date.now() - new Date(joined).getTime()) / 1000)) : null;
    await supabase.from('comm_call_participants').update({ left_at: new Date().toISOString(), duration_seconds: dur }).eq('call_id', callId).eq('user_id', userId).then(() => {}, () => {});
  },

  async updateMeetingActivity(callId: string, count: number): Promise<void> {
    const patch: any = { participant_count: count, last_activity_at: new Date().toISOString() };
    const { data } = await supabase.from('comm_calls').select('peak_participants').eq('id', callId).limit(1);
    const peak = data?.[0]?.peak_participants || 0;
    if (count > peak) patch.peak_participants = count;
    await supabase.from('comm_calls').update(patch).eq('id', callId).then(() => {}, () => {});
  },

  async updateMeetingStatus(callId: string, status: string): Promise<void> {
    await supabase.from('comm_calls').update({ status }).eq('id', callId).then(() => {}, () => {});
  },

  async endMeeting(callId: string): Promise<void> {
    const { data } = await supabase.from('comm_calls').select('started_at, status').eq('id', callId).limit(1);
    if (!data?.[0] || data[0].status === 'completed' || data[0].status === 'ended') return;
    const started = data[0].started_at;
    const dur = started ? Math.max(0, Math.round((Date.now() - new Date(started).getTime()) / 1000)) : null;
    const now = new Date().toISOString();
    await supabase.from('comm_calls').update({ status: 'completed', ended_at: now, duration_seconds: dur, participant_count: 0 }).eq('id', callId);
    // close any still-open attendance rows
    await supabase.from('comm_call_participants').update({ left_at: now }).eq('call_id', callId).is('left_at', null).then(() => {}, () => {});
  },

  // back-compat alias
  async endCall(callId: string): Promise<void> { return this.endMeeting(callId); },

  // Opportunistic cleanup: close meetings still marked live whose last activity
  // is older than the threshold (e.g. everyone hard-closed their tab). Prefers the
  // server-side reap_stale_meetings() RPC; falls back to a client-side sweep.
  async reapStaleMeetings(thresholdMinutes = 15): Promise<number> {
    try {
      const rpc = await supabase.rpc('reap_stale_meetings', { p_minutes: thresholdMinutes });
      if (!rpc.error) return (rpc.data as number) || 0;
      // fallback (RPC not installed yet)
      const cutoff = new Date(Date.now() - thresholdMinutes * 60000).toISOString();
      const { data: stale } = await supabase.from('comm_calls').select('id, started_at').in('status', ['ringing', 'ongoing', 'active']).lt('last_activity_at', cutoff);
      if (!stale?.length) return 0;
      const now = new Date().toISOString();
      for (const c of stale as any[]) {
        const dur = c.started_at ? Math.max(0, Math.round((Date.now() - new Date(c.started_at).getTime()) / 1000)) : null;
        await supabase.from('comm_calls').update({ status: 'completed', ended_at: now, duration_seconds: dur, participant_count: 0 }).eq('id', c.id);
      }
      await supabase.from('comm_call_participants').update({ left_at: now }).in('call_id', (stale as any[]).map(c => c.id)).is('left_at', null).then(() => {}, () => {});
      return stale.length;
    } catch { return 0; }
  },

  async getMeetings(limit = 100): Promise<any[]> {
    const { data, error } = await supabase.from('comm_calls').select('*').order('started_at', { ascending: false }).limit(limit);
    if (error) return [];
    const rows = data || [];
    const nm = await nameMap(rows.map((r: any) => r.started_by));
    return rows.map((r: any) => ({ ...r, host_name: r.started_by ? nm.get(r.started_by) : undefined }));
  },

  async getMeetingAttendance(callId: string): Promise<any[]> {
    const { data } = await supabase.from('comm_call_participants').select('*').eq('call_id', callId).order('joined_at');
    const rows = data || [];
    const nm = await nameMap(rows.map((r: any) => r.user_id));
    return rows.map((r: any) => ({ ...r, user_name: r.user_id ? nm.get(r.user_id) : (r.display_name || 'Guest') }));
  },
};
