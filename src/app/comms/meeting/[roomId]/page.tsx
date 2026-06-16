'use client';

// ============================================================
// JEET ERP — In-app Meeting room (Jitsi IFrame API)
// Dedicated page: /comms/meeting/[roomId]. Full lifecycle —
// session record in comm_calls, attendance in comm_call_participants,
// host-leave / empty-room / inactivity auto-close.
// ============================================================

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { commsService } from '@/services/commsService';
import { ArrowLeft, Users, Clock, Loader2, Video } from 'lucide-react';

const JITSI_SRC = 'https://meet.jit.si/external_api.js';
const INACTIVITY_MS = 8 * 60 * 1000; // auto-end if host is alone this long

function loadJitsi(): Promise<any> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') return reject('no window');
    if ((window as any).JitsiMeetExternalAPI) return resolve((window as any).JitsiMeetExternalAPI);
    let s = document.querySelector(`script[src="${JITSI_SRC}"]`) as HTMLScriptElement | null;
    if (!s) { s = document.createElement('script'); s.src = JITSI_SRC; s.async = true; document.body.appendChild(s); }
    const t0 = Date.now();
    const iv = setInterval(() => {
      if ((window as any).JitsiMeetExternalAPI) { clearInterval(iv); resolve((window as any).JitsiMeetExternalAPI); }
      else if (Date.now() - t0 > 15000) { clearInterval(iv); reject('jitsi load timeout'); }
    }, 150);
  });
}

export default function MeetingRoomPage() {
  const params = useParams();
  const search = useSearchParams();
  const router = useRouter();
  const roomId = decodeURIComponent(String(params?.roomId || ''));
  const type = (search.get('type') as 'voice' | 'video') || 'video';

  const [meId, setMeId] = useState<string | null>(null);
  const [status, setStatus] = useState<'connecting' | 'live' | 'ended' | 'error'>('connecting');
  const [count, setCount] = useState(1);
  const [elapsed, setElapsed] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<any>(null);
  const callRef = useRef<any>(null);
  const meRef = useRef<string | null>(null);
  const isHostRef = useRef(false);
  const aloneTimer = useRef<any>(null);
  const startedTs = useRef<number>(Date.now());

  const finalize = useCallback(async (endForAll: boolean) => {
    if (status === 'ended') return;
    setStatus('ended');
    if (aloneTimer.current) clearTimeout(aloneTimer.current);
    const call = callRef.current;
    try {
      if (call && meRef.current) await commsService.recordParticipantLeave(call.id, meRef.current);
      if (call && endForAll) await commsService.endMeeting(call.id);
    } catch { /* best-effort */ }
    try { apiRef.current?.dispose(); } catch { /* */ }
    apiRef.current = null;
  }, [status]);

  const armAloneTimer = useCallback(() => {
    if (aloneTimer.current) clearTimeout(aloneTimer.current);
    aloneTimer.current = setTimeout(() => {
      if (apiRef.current && (apiRef.current.getNumberOfParticipants?.() ?? 1) <= 1) {
        finalize(true).then(() => { apiRef.current?.executeCommand?.('hangup'); });
      }
    }, INACTIVITY_MS);
  }, [finalize]);

  // bootstrap: user + meeting record + jitsi
  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !roomId) { setStatus('error'); return; }
      meRef.current = user.id; if (mounted) setMeId(user.id);
      const { data: prof } = await supabase.from('profiles').select('full_name').eq('id', user.id).limit(1);
      const displayName = prof?.[0]?.full_name || 'JEET user';

      const call = await commsService.getOrStartMeeting(roomId, { type, conversationId: search.get('conv'), startedBy: user.id, title: search.get('title') || undefined });
      callRef.current = call;
      isHostRef.current = !!call && call.started_by === user.id;
      if (call) startedTs.current = new Date(call.started_at).getTime();

      let JitsiAPI: any;
      try { JitsiAPI = await loadJitsi(); } catch { if (mounted) setStatus('error'); return; }
      if (!mounted || !containerRef.current) return;

      const api = new JitsiAPI('meet.jit.si', {
        roomName: roomId,
        parentNode: containerRef.current,
        width: '100%', height: '100%',
        userInfo: { displayName },
        configOverwrite: { startWithAudioMuted: type === 'voice', startWithVideoMuted: type === 'voice', prejoinPageEnabled: false, disableDeepLinking: true },
        interfaceConfigOverwrite: { MOBILE_APP_PROMO: false },
      });
      apiRef.current = api;

      const syncCount = () => { const n = api.getNumberOfParticipants?.() ?? 1; setCount(n); if (call) commsService.updateMeetingActivity(call.id, n); };

      api.addEventListener('videoConferenceJoined', async () => {
        if (mounted) setStatus('live');
        if (call) { await commsService.recordParticipantJoin(call.id, user.id, displayName); await commsService.updateMeetingStatus(call.id, 'active'); }
        syncCount();
      });
      api.addEventListener('participantJoined', () => { syncCount(); if (aloneTimer.current) clearTimeout(aloneTimer.current); });
      api.addEventListener('participantLeft', () => { syncCount(); if ((api.getNumberOfParticipants?.() ?? 1) <= 1) armAloneTimer(); });
      api.addEventListener('videoConferenceLeft', async () => {
        const remaining = api.getNumberOfParticipants?.() ?? 0;
        await finalize(isHostRef.current || remaining <= 1);   // host leaving (or last person) ends the meeting
        if (mounted) router.push('/comms');
      });
      api.addEventListener('readyToClose', () => { finalize(false); if (mounted) router.push('/comms'); });
    })();

    return () => { mounted = false; const c = callRef.current; if (apiRef.current) { try { apiRef.current.dispose(); } catch { /* */ } apiRef.current = null; } if (c && meRef.current) commsService.recordParticipantLeave(c.id, meRef.current); if (aloneTimer.current) clearTimeout(aloneTimer.current); };
  }, [roomId]);

  // elapsed timer
  useEffect(() => { if (status !== 'live') return; const iv = setInterval(() => setElapsed(Math.floor((Date.now() - startedTs.current) / 1000)), 1000); return () => clearInterval(iv); }, [status]);
  const mmss = `${String(Math.floor(elapsed / 60)).padStart(2, '0')}:${String(elapsed % 60).padStart(2, '0')}`;

  const leave = () => { try { apiRef.current?.executeCommand?.('hangup'); } catch { finalize(isHostRef.current); router.push('/comms'); } };

  return (
    <div className="fixed inset-0 z-[60] bg-slate-950 flex flex-col">
      <div className="h-14 px-4 flex items-center justify-between bg-[var(--bg-card)] border-b border-[var(--border)]">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={leave} className="h-8 w-8 grid place-items-center rounded-lg hover:bg-[var(--surface-hover)] text-[var(--text-secondary)]"><ArrowLeft size={16} /></button>
          <Video size={16} className="text-[var(--accent)] shrink-0" />
          <div className="min-w-0"><div className="text-sm font-semibold text-[var(--text-primary)] truncate">{search.get('title') || roomId}</div><div className="text-[11px] text-[var(--text-tertiary)] flex items-center gap-2">{status === 'live' ? <span className="inline-flex items-center gap-1 text-[var(--status-success-text)]"><span className="w-1.5 h-1.5 rounded-full bg-[var(--status-success-text)] animate-pulse" />Live</span> : status === 'connecting' ? 'Connecting…' : status === 'ended' ? 'Ended' : 'Error'}</div></div>
        </div>
        <div className="flex items-center gap-3 text-xs text-[var(--text-secondary)]">
          <span className="inline-flex items-center gap-1"><Users size={13} />{count}</span>
          <span className="inline-flex items-center gap-1 tabular-nums"><Clock size={13} />{mmss}</span>
          <button onClick={leave} className="h-8 px-3 rounded-lg text-white text-xs font-semibold" style={{ background: 'var(--status-danger-text)' }}>Leave</button>
        </div>
      </div>

      <div className="flex-1 relative">
        {status === 'connecting' && <div className="absolute inset-0 grid place-items-center text-white/70"><div className="flex flex-col items-center gap-2"><Loader2 size={28} className="animate-spin" /><span className="text-sm">Connecting to meeting…</span></div></div>}
        {status === 'error' && <div className="absolute inset-0 grid place-items-center text-white/70"><div className="flex flex-col items-center gap-2 text-center px-6"><span className="text-sm">Couldn't start the meeting.</span><button onClick={() => router.push('/comms')} className="text-xs text-[var(--accent)]">Back to messages</button></div></div>}
        <div ref={containerRef} className="absolute inset-0" />
      </div>
    </div>
  );
}
