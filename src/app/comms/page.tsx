'use client';

// ============================================================
// JEET ERP — Communication & Collaboration — Messenger
// 1:1 DMs, groups, department channels and project rooms with
// Supabase Realtime: reactions, mentions, threads, read receipts,
// file attachments and search. Additive; no existing logic touched.
// ============================================================

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { PageHeader } from '@/components/ui/PageHeader';
import { commsService } from '@/services/commsService';
import { commDocsService } from '@/services/commDocsService';
import type { Conversation, Message, DirectoryUser, Attachment } from '@/types/comms.types';
import {
  Hash, Users, MessageSquare, FolderKanban, Search, Plus, Send, Paperclip,
  Phone, Video, Smile, CornerUpLeft, X, Check, CheckCheck, AtSign, Trash2, Loader2,
} from 'lucide-react';

const EMOJIS = ['👍', '❤️', '😄', '🎉', '🙏', '🔥', '✅', '👀'];
const initials = (n?: string) => (n || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
const fmtTime = (s?: string | null) => s ? new Date(s).toLocaleTimeString('en-AE', { hour: '2-digit', minute: '2-digit' }) : '';
const fmtDay = (s: string) => new Date(s).toLocaleDateString('en-AE', { weekday: 'short', day: 'numeric', month: 'short' });
const convIcon = (t: string) => t === 'CHANNEL' ? Hash : t === 'GROUP' ? Users : t === 'PROJECT' ? FolderKanban : MessageSquare;

export default function CommsPage() {
  const router = useRouter();
  const params = useSearchParams();
  const [meId, setMeId] = useState<string | null>(null);
  const [directory, setDirectory] = useState<DirectoryUser[]>([]);
  const [convs, setConvs] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [active, setActive] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<Message[]>([]);
  const [showNew, setShowNew] = useState<false | 'dm' | 'group'>(false);
  const [loading, setLoading] = useState(true);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [pendingMentions, setPendingMentions] = useState<DirectoryUser[]>([]);
  const endRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const dirMap = useMemo(() => new Map(directory.map(u => [u.id, u.full_name])), [directory]);

  // bootstrap
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      setMeId(user.id);
      const [dir, cs] = await Promise.all([commsService.getDirectory(), commsService.getMyConversations(user.id)]);
      setDirectory(dir); setConvs(cs); setLoading(false);
      commsService.reapStaleMeetings(); // opportunistic cleanup of abandoned meetings
      const c = params.get('c'); if (c) setActiveId(c);
    })();
  }, []);

  const reloadConvs = useCallback(async () => { if (meId) setConvs(await commsService.getMyConversations(meId)); }, [meId]);

  // inbox realtime → refresh list
  useEffect(() => { if (!meId) return; const off = commsService.subscribeToInbox(meId, () => reloadConvs()); return off; }, [meId, reloadConvs]);

  // open conversation
  useEffect(() => {
    if (!activeId || !meId) return;
    let mounted = true;
    (async () => {
      const [conv, msgs] = await Promise.all([commsService.getConversation(activeId, meId), commsService.getMessages(activeId)]);
      if (!mounted) return;
      setActive(conv); setMessages(msgs);
      commsService.markRead(activeId, meId, msgs.map(m => m.id));
      reloadConvs();
    })();
    const off = commsService.subscribeToConversation(activeId,
      async (m: any) => {
        setMessages(prev => prev.some(x => x.id === m.id) ? prev.map(x => x.id === m.id ? { ...x, ...m, sender_name: dirMap.get(m.sender_id) } : x) : (m.parent_message_id ? prev : [...prev, { ...m, sender_name: dirMap.get(m.sender_id) }]));
        if (m.sender_id !== meId) commsService.markRead(activeId, meId, [m.id]);
      },
      async () => { const fresh = await commsService.getMessages(activeId); if (mounted) setMessages(fresh); },
    );
    return () => { mounted = false; off(); };
  }, [activeId, meId, dirMap, reloadConvs]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages.length]);

  // search (debounced)
  useEffect(() => {
    if (!search.trim() || !meId) { setSearchResults([]); return; }
    const t = setTimeout(async () => setSearchResults(await commsService.searchMessages(search, meId)), 300);
    return () => clearTimeout(t);
  }, [search, meId]);

  const grouped = useMemo(() => ({
    CHANNEL: convs.filter(c => c.type === 'CHANNEL'),
    DIRECT: convs.filter(c => c.type === 'DIRECT'),
    GROUP: convs.filter(c => c.type === 'GROUP'),
    PROJECT: convs.filter(c => c.type === 'PROJECT'),
  }), [convs]);

  const openConv = (id: string) => { setActiveId(id); setSearch(''); router.replace(`/comms?c=${id}`, { scroll: false }); };

  const handleSend = async () => {
    if ((!text.trim() && !pendingFiles.length) || !activeId || !meId || sending) return;
    setSending(true);
    try {
      let attachments: Attachment[] = [];
      for (const f of pendingFiles) { const path = await commDocsService.upload(f, meId); if (path) attachments.push({ name: f.name, path, mime: f.type, size: f.size }); }
      const mentions = pendingMentions.filter(u => text.includes(`@${u.full_name}`)).map(u => u.id);
      await commsService.sendMessage({ conversationId: activeId, senderId: meId, body: text.trim(), attachments, mentions });
      setText(''); setPendingFiles([]); setPendingMentions([]); setMentionQuery(null);
    } finally { setSending(false); }
  };

  const onType = (v: string) => {
    setText(v);
    const m = v.match(/@([\w]*)$/);
    setMentionQuery(m ? m[1].toLowerCase() : null);
  };
  const pickMention = (u: DirectoryUser) => {
    setText(t => t.replace(/@([\w]*)$/, `@${u.full_name} `));
    setPendingMentions(p => p.some(x => x.id === u.id) ? p : [...p, u]);
    setMentionQuery(null);
  };
  const mentionMatches = useMemo(() => mentionQuery === null ? [] : directory.filter(u => u.full_name.toLowerCase().includes(mentionQuery)).slice(0, 6), [mentionQuery, directory]);

  const react = (msgId: string, emoji: string) => { if (meId) commsService.toggleReaction(msgId, meId, emoji).then(() => { /* realtime refresh */ }); };

  const startCall = async (type: 'voice' | 'video') => {
    if (!active || !meId) return;
    const room = `JEET-${active.id.slice(0, 8)}-${Date.now().toString(36)}`;
    const call = await commsService.startMeeting({ roomName: room, type, conversationId: active.id, startedBy: meId, title: active.display_name || undefined });
    await commsService.sendMessage({ conversationId: active.id, senderId: meId, body: `started a ${type} call: ${call?.id || ''}:${room}`, type: 'call' });
    router.push(`/comms/meeting/${room}?type=${type}&conv=${active.id}&title=${encodeURIComponent(active.display_name || '')}`);
  };

  const startDirect = async (u: DirectoryUser) => { if (!meId) return; const c = await commsService.getOrCreateDirect(meId, u.id); if (c) { await reloadConvs(); setShowNew(false); openConv(c.id); } };

  return (
    <div className="flex flex-col gap-4 h-[calc(100vh-7rem)]">
      <PageHeader title="Messages" subtitle="Team chat, channels and project rooms" breadcrumbs={[{ label: 'Communication' }, { label: 'Messages' }]}
        actions={<button onClick={() => setShowNew('dm')} className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-sm font-medium text-white" style={{ background: 'var(--accent)' }}><Plus size={15} /> New chat</button>} />

      <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-[300px_1fr] gap-4">
        {/* conversation list */}
        <div className="flex flex-col rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
          <div className="p-2.5 border-b border-[var(--border)]">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search messages & people" className="w-full h-9 pl-8 pr-3 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] text-sm" />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading ? <div className="p-4 text-xs text-[var(--text-tertiary)]">Loading…</div> : search.trim() ? (
              <SearchPanel results={searchResults} directory={directory} dirMap={dirMap} openConv={openConv} startDirect={startDirect} query={search} />
            ) : (
              <>
                <Section title="Channels" items={grouped.CHANNEL} activeId={activeId} onOpen={openConv} />
                <Section title="Direct messages" items={grouped.DIRECT} activeId={activeId} onOpen={openConv} />
                <Section title="Groups" items={grouped.GROUP} activeId={activeId} onOpen={openConv} />
                <Section title="Project rooms" items={grouped.PROJECT} activeId={activeId} onOpen={openConv} />
                {convs.length === 0 && <div className="p-4 text-xs text-[var(--text-tertiary)]">No conversations yet. Start a new chat, or apply the comms migration if this is unexpected.</div>}
              </>
            )}
          </div>
        </div>

        {/* thread pane */}
        <div className="flex flex-col rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden min-h-0">
          {!active ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
              <MessageSquare size={40} className="text-[var(--text-tertiary)] mb-3" />
              <div className="text-sm font-medium text-[var(--text-primary)]">Select a conversation</div>
              <div className="text-xs text-[var(--text-tertiary)] mt-1">Pick a channel or person on the left, or start a new chat.</div>
            </div>
          ) : (
            <>
              <div className="px-4 py-2.5 border-b border-[var(--border)] flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  {React.createElement(convIcon(active.type), { size: 16, className: 'text-[var(--accent)] shrink-0' })}
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-[var(--text-primary)] truncate">{active.display_name}</div>
                    <div className="text-[11px] text-[var(--text-tertiary)]">{active.type === 'DIRECT' ? 'Direct message' : `${active.members?.length || 0} members`}</div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => startCall('voice')} title="Voice call" className="h-8 w-8 grid place-items-center rounded-lg hover:bg-[var(--surface-hover)] text-[var(--text-secondary)]"><Phone size={15} /></button>
                  <button onClick={() => startCall('video')} title="Video meeting" className="h-8 w-8 grid place-items-center rounded-lg hover:bg-[var(--surface-hover)] text-[var(--text-secondary)]"><Video size={15} /></button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-0.5">
                {messages.map((m, i) => {
                  const prev = messages[i - 1];
                  const newDay = !prev || new Date(prev.created_at).toDateString() !== new Date(m.created_at).toDateString();
                  const grouped2 = prev && prev.sender_id === m.sender_id && !newDay && (new Date(m.created_at).getTime() - new Date(prev.created_at).getTime() < 5 * 60000);
                  return (
                    <React.Fragment key={m.id}>
                      {newDay && <div className="flex items-center gap-2 my-3"><div className="flex-1 h-px bg-[var(--border)]" /><span className="text-[10px] text-[var(--text-tertiary)] font-medium">{fmtDay(m.created_at)}</span><div className="flex-1 h-px bg-[var(--border)]" /></div>}
                      <MessageRow 
                        m={m} 
                        me={meId} 
                        grouped={grouped2} 
                        onReact={react} 
                        onDelete={() => commsService.deleteMessage(m.id).then(() => setMessages(p => p.map(x => x.id === m.id ? { ...x, is_deleted: true, body: null } : x)))} 
                        dirMap={dirMap} 
                        onJoinCall={(_callId, roomName, type) => router.push(`/comms/meeting/${roomName}?type=${type}&conv=${active.id}&title=${encodeURIComponent(active.display_name || '')}`)}
                      />
                    </React.Fragment>
                  );
                })}
                <div ref={endRef} />
              </div>

              {/* composer */}
              <div className="border-t border-[var(--border)] p-3 relative">
                {mentionMatches.length > 0 && (
                  <div className="absolute bottom-[64px] left-3 right-3 bg-[var(--bg-card)] border border-[var(--border)] rounded-lg shadow-lg overflow-hidden z-10">
                    {mentionMatches.map(u => <button key={u.id} onClick={() => pickMention(u)} className="w-full text-left px-3 py-2 text-sm hover:bg-[var(--surface-hover)] flex items-center gap-2"><span className="h-6 w-6 rounded-full grid place-items-center text-[10px] font-bold text-white" style={{ background: 'var(--accent)' }}>{initials(u.full_name)}</span>{u.full_name}</button>)}
                  </div>
                )}
                {pendingFiles.length > 0 && <div className="flex flex-wrap gap-2 mb-2">{pendingFiles.map((f, i) => <span key={i} className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded bg-[var(--surface-active)]"><Paperclip size={11} />{f.name}<button onClick={() => setPendingFiles(p => p.filter((_, j) => j !== i))}><X size={11} /></button></span>)}</div>}
                <div className="flex items-end gap-2">
                  <button onClick={() => fileRef.current?.click()} className="h-9 w-9 grid place-items-center rounded-lg hover:bg-[var(--surface-hover)] text-[var(--text-secondary)] shrink-0"><Paperclip size={16} /></button>
                  <input ref={fileRef} type="file" multiple className="hidden" onChange={e => { if (e.target.files) setPendingFiles(p => [...p, ...Array.from(e.target.files!)]); e.target.value = ''; }} />
                  <textarea value={text} onChange={e => onType(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }} rows={1} placeholder={`Message ${active.display_name}`} className="flex-1 resize-none max-h-32 px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] text-sm" />
                  <button onClick={handleSend} disabled={sending} className="h-9 w-9 grid place-items-center rounded-lg text-white shrink-0 disabled:opacity-50" style={{ background: 'var(--accent)' }}>{sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}</button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {showNew && <NewChatModal mode={showNew} setMode={setShowNew} directory={directory} onDirect={startDirect} onGroup={async (name, ids) => { if (!meId) return; const c = await commsService.createGroup(name, ids, meId); if (c) { await reloadConvs(); setShowNew(false); openConv(c.id); } }} />}
    </div>
  );
}

function Section({ title, items, activeId, onOpen }: { title: string; items: Conversation[]; activeId: string | null; onOpen: (id: string) => void }) {
  if (!items.length) return null;
  return (
    <div className="py-1.5">
      <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">{title}</div>
      {items.map(c => {
        const Icon = convIcon(c.type);
        return (
          <button key={c.id} onClick={() => onOpen(c.id)} className="w-full text-left px-3 py-2 flex items-center gap-2.5 hover:bg-[var(--surface-hover)]" style={{ background: activeId === c.id ? 'var(--surface-active)' : 'transparent' }}>
            <span className="h-8 w-8 rounded-lg grid place-items-center shrink-0" style={{ background: 'var(--surface-active)' }}>{c.type === 'DIRECT' ? <span className="text-[10px] font-bold text-[var(--text-secondary)]">{initials(c.display_name)}</span> : <Icon size={15} className="text-[var(--text-secondary)]" />}</span>
            <span className="flex-1 min-w-0">
              <span className="flex items-center justify-between gap-2"><span className="text-sm font-medium text-[var(--text-primary)] truncate">{c.display_name}</span>{!!c.unread && <span className="text-[10px] font-bold text-white px-1.5 rounded-full shrink-0" style={{ background: 'var(--accent)' }}>{c.unread}</span>}</span>
              <span className="block text-[11px] text-[var(--text-tertiary)] truncate">{c.last_message?.is_deleted ? 'message deleted' : (c.last_message?.body || (c.last_message ? 'attachment' : 'No messages yet'))}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

function MessageRow({ 
  m, 
  me, 
  grouped, 
  onReact, 
  onDelete, 
  dirMap, 
  onJoinCall 
}: { 
  m: Message; 
  me: string | null; 
  grouped: boolean; 
  onReact: (id: string, e: string) => void; 
  onDelete: () => void; 
  dirMap: Map<string, string>; 
  onJoinCall?: (callId: string, roomName: string, type: 'voice' | 'video') => void; 
}) {
  const [hover, setHover] = useState(false);
  const [pick, setPick] = useState(false);
  const reactionGroups = useMemo(() => { const g = new Map<string, string[]>(); (m.reactions || []).forEach(r => { const a = g.get(r.emoji) || []; a.push(r.user_id); g.set(r.emoji, a); }); return [...g.entries()]; }, [m.reactions]);
  
  if (m.type === 'system') return <div className="text-center text-[11px] text-[var(--text-tertiary)] py-1">{m.sender_name || 'Someone'} {m.body}</div>;
  
  if (m.type === 'call') {
    const parts = (m.body || '').split(': ');
    const callDetails = parts[1] || '';
    const [callId, roomName] = callDetails.split(':');
    const isVoice = (m.body || '').includes('voice');
    
    return (
      <div className="text-center text-xs py-3 my-2 border border-dashed border-[var(--border)] bg-[var(--surface-hover)] rounded-xl flex flex-col items-center justify-center gap-2 max-w-sm mx-auto shadow-sm">
        <span className="font-semibold text-[var(--text-primary)]">Meeting Started</span>
        <span className="text-[11px] text-[var(--text-tertiary)]">{m.sender_name || 'Someone'} started a {isVoice ? 'voice' : 'video'} call</span>
        {callId && roomName && (
          <button 
            onClick={() => onJoinCall && onJoinCall(callId, roomName, isVoice ? 'voice' : 'video')}
            className="px-4 py-1.5 bg-[var(--accent)] text-white font-medium text-xs rounded-lg hover:bg-[var(--accent-hover)] transition-colors flex items-center gap-1 shadow-sm"
          >
            <Video size={13} /> Join Meeting
          </button>
        )}
      </div>
    );
  }
  return (
    <div className="group relative flex gap-2.5 px-1 py-0.5 rounded hover:bg-[var(--surface-hover)]" onMouseEnter={() => setHover(true)} onMouseLeave={() => { setHover(false); setPick(false); }}>
      <div className="w-8 shrink-0">{!grouped && <span className="h-8 w-8 rounded-full grid place-items-center text-[10px] font-bold text-white" style={{ background: 'var(--accent)' }}>{initials(m.sender_name)}</span>}</div>
      <div className="flex-1 min-w-0">
        {!grouped && <div className="flex items-baseline gap-2"><span className="text-sm font-semibold text-[var(--text-primary)]">{m.sender_name || 'Unknown'}</span><span className="text-[10px] text-[var(--text-tertiary)]">{fmtTime(m.created_at)}</span></div>}
        {m.is_deleted ? <div className="text-xs italic text-[var(--text-tertiary)]">message deleted</div> : (
          <>
            {m.body && <div className="text-sm text-[var(--text-primary)] whitespace-pre-wrap break-words">{renderBody(m.body, dirMap)}{m.edited_at && <span className="text-[10px] text-[var(--text-tertiary)] ml-1">(edited)</span>}</div>}
            {(m.attachments || []).map((a, i) => <AttachmentChip key={i} a={a} />)}
            {reactionGroups.length > 0 && <div className="flex flex-wrap gap-1 mt-1">{reactionGroups.map(([e, users]) => <button key={e} onClick={() => onReact(m.id, e)} className="text-[11px] px-1.5 py-0.5 rounded-full border" style={{ borderColor: me && users.includes(me) ? 'var(--accent)' : 'var(--border)', background: me && users.includes(me) ? 'var(--accent-glow)' : 'transparent' }}>{e} {users.length}</button>)}</div>}
            {(m.reply_count || 0) > 0 && <div className="text-[11px] text-[var(--accent)] mt-0.5 flex items-center gap-1"><CornerUpLeft size={11} />{m.reply_count} replies</div>}
            {me && m.read_by && m.read_by.filter(u => u !== me).length > 0 && <div className="text-[10px] text-[var(--text-tertiary)] mt-0.5 flex items-center gap-0.5"><CheckCheck size={11} className="text-[var(--accent)]" />Seen</div>}
          </>
        )}
      </div>
      {hover && !m.is_deleted && (
        <div className="absolute -top-3 right-2 flex items-center gap-0.5 bg-[var(--bg-card)] border border-[var(--border)] rounded-lg px-1 py-0.5 shadow-sm">
          <button onClick={() => setPick(p => !p)} className="h-6 w-6 grid place-items-center rounded hover:bg-[var(--surface-hover)]"><Smile size={13} /></button>
          {me === m.sender_id && <button onClick={onDelete} className="h-6 w-6 grid place-items-center rounded hover:bg-[var(--surface-hover)] text-[var(--status-danger-text)]"><Trash2 size={12} /></button>}
        </div>
      )}
      {pick && <div className="absolute top-3 right-2 z-10 flex gap-0.5 bg-[var(--bg-card)] border border-[var(--border)] rounded-lg p-1 shadow-lg">{EMOJIS.map(e => <button key={e} onClick={() => { onReact(m.id, e); setPick(false); }} className="h-7 w-7 grid place-items-center rounded hover:bg-[var(--surface-hover)] text-base">{e}</button>)}</div>}
    </div>
  );
}

function renderBody(body: string, dirMap: Map<string, string>) {
  // highlight @mentions (by name)
  const names = [...dirMap.values()];
  const parts = body.split(/(@[\w]+(?:\s[\w]+)?)/g);
  return parts.map((p, i) => p.startsWith('@') && names.some(n => p.slice(1).startsWith(n.split(' ')[0])) ? <span key={i} className="font-semibold" style={{ color: 'var(--accent)' }}>{p}</span> : <React.Fragment key={i}>{p}</React.Fragment>);
}

function AttachmentChip({ a }: { a: Attachment }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => { commDocsService.signedUrl(a.path).then(setUrl); }, [a.path]);
  return <a href={url || '#'} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 mt-1 px-2.5 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] text-xs text-[var(--text-secondary)] hover:border-[var(--accent)]"><Paperclip size={12} />{a.name}<span className="text-[10px] text-[var(--text-tertiary)]">{a.size ? `${Math.round(a.size / 1024)} KB` : ''}</span></a>;
}

function SearchPanel({ results, dirMap, openConv, startDirect, query, directory }: { results: Message[]; dirMap: Map<string, string>; openConv: (id: string) => void; startDirect: (u: DirectoryUser) => void; query: string; directory: DirectoryUser[] }) {
  const people = directory.filter(u => u.full_name.toLowerCase().includes(query.toLowerCase())).slice(0, 5);
  return (
    <div className="py-1.5">
      {people.length > 0 && <><div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">People</div>{people.map(u => <button key={u.id} onClick={() => startDirect(u)} className="w-full text-left px-3 py-2 flex items-center gap-2.5 hover:bg-[var(--surface-hover)]"><span className="h-8 w-8 rounded-full grid place-items-center text-[10px] font-bold text-white" style={{ background: 'var(--accent)' }}>{initials(u.full_name)}</span><span className="text-sm text-[var(--text-primary)]">{u.full_name}</span></button>)}</>}
      <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">Messages ({results.length})</div>
      {results.length === 0 ? <div className="px-3 py-2 text-xs text-[var(--text-tertiary)]">No messages found.</div> : results.map(m => <button key={m.id} onClick={() => openConv(m.conversation_id)} className="w-full text-left px-3 py-2 hover:bg-[var(--surface-hover)]"><div className="text-xs font-medium text-[var(--text-primary)]">{m.sender_name || 'Unknown'}</div><div className="text-xs text-[var(--text-tertiary)] truncate">{m.body}</div></button>)}
    </div>
  );
}

function NewChatModal({ mode, setMode, directory, onDirect, onGroup }: { mode: 'dm' | 'group'; setMode: (m: false | 'dm' | 'group') => void; directory: DirectoryUser[]; onDirect: (u: DirectoryUser) => void; onGroup: (name: string, ids: string[]) => void }) {
  const [q, setQ] = useState(''); const [sel, setSel] = useState<DirectoryUser[]>([]); const [name, setName] = useState('');
  const filtered = directory.filter(u => u.full_name.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="fixed inset-0 z-[1000] bg-slate-900/50 flex items-center justify-center p-4" onClick={() => setMode(false)}>
      <div className="w-full max-w-md bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b border-[var(--border)] flex items-center justify-between">
          <div className="flex gap-1">{(['dm', 'group'] as const).map(t => <button key={t} onClick={() => setMode(t)} className="text-sm font-medium px-3 py-1 rounded-lg" style={{ background: mode === t ? 'var(--surface-active)' : 'transparent', color: mode === t ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>{t === 'dm' ? 'Direct message' : 'New group'}</button>)}</div>
          <button onClick={() => setMode(false)}><X size={18} className="text-[var(--text-tertiary)]" /></button>
        </div>
        <div className="p-4 flex flex-col gap-3">
          {mode === 'group' && <input value={name} onChange={e => setName(e.target.value)} placeholder="Group name" className="w-full h-9 px-3 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] text-sm" />}
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search people…" className="w-full h-9 px-3 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] text-sm" />
          {mode === 'group' && sel.length > 0 && <div className="flex flex-wrap gap-1">{sel.map(u => <span key={u.id} className="text-[11px] px-2 py-1 rounded bg-[var(--surface-active)] flex items-center gap-1">{u.full_name}<button onClick={() => setSel(s => s.filter(x => x.id !== u.id))}><X size={11} /></button></span>)}</div>}
          <div className="max-h-60 overflow-y-auto border border-[var(--border)] rounded-lg">
            {filtered.map(u => { const on = sel.some(x => x.id === u.id); return (
              <button key={u.id} onClick={() => mode === 'dm' ? onDirect(u) : setSel(s => on ? s.filter(x => x.id !== u.id) : [...s, u])} className="w-full text-left px-3 py-2 flex items-center gap-2.5 hover:bg-[var(--surface-hover)]">
                <span className="h-7 w-7 rounded-full grid place-items-center text-[10px] font-bold text-white" style={{ background: 'var(--accent)' }}>{initials(u.full_name)}</span>
                <span className="flex-1 text-sm text-[var(--text-primary)]">{u.full_name}</span>
                {mode === 'group' && on && <Check size={15} className="text-[var(--accent)]" />}
              </button>
            ); })}
          </div>
          {mode === 'group' && <button onClick={() => name.trim() && sel.length && onGroup(name.trim(), sel.map(u => u.id))} disabled={!name.trim() || !sel.length} className="h-9 rounded-lg text-sm font-medium text-white disabled:opacity-50" style={{ background: 'var(--accent)' }}>Create group ({sel.length})</button>}
        </div>
      </div>
    </div>
  );
}
