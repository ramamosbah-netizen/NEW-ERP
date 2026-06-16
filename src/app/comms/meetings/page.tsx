'use client';

// ============================================================
// JEET ERP — Meeting Analytics
// History of voice/video meetings with duration, peak participants,
// status and per-meeting attendance. Read-only.
// ============================================================

import React, { useState, useEffect, useMemo } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { commsService } from '@/services/commsService';
import { Video, Phone, Users, Clock, X, Radio } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

const LIVE = ['ringing', 'ongoing', 'active'];
const fmtDur = (s?: number | null) => { if (!s) return '—'; const m = Math.floor(s / 60), sec = s % 60; return m ? `${m}m ${sec}s` : `${sec}s`; };
const fmtWhen = (s?: string) => s ? new Date(s).toLocaleString('en-AE', { dateStyle: 'short', timeStyle: 'short' }) : '—';

export default function MeetingAnalyticsPage() {
  const [meetings, setMeetings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<any | null>(null);

  useEffect(() => { commsService.getMeetings(200).then(m => { setMeetings(m); setLoading(false); }); }, []);

  const live = meetings.filter(m => LIVE.includes(m.status));
  const totalSecs = meetings.reduce((a, m) => a + (m.duration_seconds || 0), 0);
  const ended = meetings.filter(m => m.duration_seconds);
  const avgMin = ended.length ? Math.round(totalSecs / ended.length / 60) : 0;
  const peak = meetings.reduce((a, m) => a + (m.peak_participants || 0), 0);

  const byDay = useMemo(() => {
    const map = new Map<string, number>();
    for (let i = 13; i >= 0; i--) map.set(new Date(Date.now() - i * 864e5).toISOString().slice(0, 10), 0);
    meetings.forEach(m => { const k = (m.started_at || '').slice(0, 10); if (map.has(k)) map.set(k, (map.get(k) || 0) + 1); });
    return [...map.entries()].map(([d, v]) => ({ day: d.slice(5), value: v }));
  }, [meetings]);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Meeting Analytics" subtitle="Voice & video meeting history, duration and attendance"
        breadcrumbs={[{ label: 'Communication', href: '/comms' }, { label: 'Meetings' }]} />

      {loading ? <Card><div className="p-8 text-center text-sm text-[var(--text-tertiary)]">Loading…</div></Card>
        : meetings.length === 0 ? <Card><EmptyState icon={Video} title="No meetings yet" description="Voice and video meetings started from chat will be tracked here (apply the meeting-lifecycle migration)." /></Card>
          : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Meetings</div><div className="text-2xl font-bold mt-1">{meetings.length}</div></Card>
                <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Live now</div><div className="text-2xl font-bold mt-1" style={{ color: live.length ? 'var(--status-success-text)' : 'var(--text-primary)' }}>{live.length}</div></Card>
                <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Total minutes</div><div className="text-2xl font-bold mt-1">{Math.round(totalSecs / 60)}</div></Card>
                <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Avg duration</div><div className="text-2xl font-bold mt-1">{avgMin}<span className="text-sm font-normal text-[var(--text-tertiary)]"> min</span></div></Card>
                <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Total attendance</div><div className="text-2xl font-bold mt-1">{peak}</div></Card>
              </div>

              <Card className="p-4">
                <div className="text-sm font-semibold text-[var(--text-primary)] mb-3">Meetings — last 14 days</div>
                <div style={{ width: '100%', height: 220 }}>
                  <ResponsiveContainer>
                    <BarChart data={byDay}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="day" tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }} interval={1} />
                      <YAxis tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="value" fill="var(--accent)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              <Card className="p-0 overflow-x-auto">
                <div className="p-3 text-sm font-semibold text-[var(--text-primary)] border-b border-[var(--border)]">Meeting history ({meetings.length})</div>
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-[var(--border)] text-left text-[var(--text-tertiary)] text-xs"><th className="p-3">Meeting</th><th className="p-3">Host</th><th className="p-3">Type</th><th className="p-3">Peak</th><th className="p-3">Duration</th><th className="p-3">Status</th><th className="p-3">Started</th></tr></thead>
                  <tbody>
                    {meetings.map(m => (
                      <tr key={m.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-hover)] cursor-pointer" onClick={() => setOpen(m)}>
                        <td className="p-3 font-medium text-[var(--text-primary)] flex items-center gap-2">{m.type === 'voice' ? <Phone size={14} className="text-[var(--accent)]" /> : <Video size={14} className="text-[var(--accent)]" />}{m.title || m.room_name}</td>
                        <td className="p-3 text-xs text-[var(--text-secondary)]">{m.host_name || '—'}</td>
                        <td className="p-3 text-xs text-[var(--text-secondary)]">{m.type}</td>
                        <td className="p-3 text-xs text-[var(--text-secondary)]">{m.peak_participants || 0}</td>
                        <td className="p-3 text-xs text-[var(--text-secondary)]">{fmtDur(m.duration_seconds)}</td>
                        <td className="p-3"><span className="text-xs px-2 py-0.5 rounded-full inline-flex items-center gap-1" style={{ background: 'var(--surface-active)', color: LIVE.includes(m.status) ? 'var(--status-success-text)' : 'var(--text-secondary)' }}>{LIVE.includes(m.status) && <Radio size={10} className="animate-pulse" />}{m.status}</span></td>
                        <td className="p-3 text-xs text-[var(--text-tertiary)]">{fmtWhen(m.started_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            </>
          )}

      {open && <AttendanceDrawer meeting={open} close={() => setOpen(null)} />}
    </div>
  );
}

function AttendanceDrawer({ meeting, close }: { meeting: any; close: () => void }) {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { commsService.getMeetingAttendance(meeting.id).then(r => { setRows(r); setLoading(false); }); }, [meeting.id]);
  return (
    <div className="fixed inset-0 z-[1000] flex justify-end" onClick={close}>
      <div className="absolute inset-0 bg-slate-900/40" />
      <div className="relative w-full max-w-sm bg-[var(--surface)] border-l border-[var(--border)] h-full overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b border-[var(--border)] flex items-start justify-between"><div><div className="text-sm font-semibold text-[var(--text-primary)]">{meeting.title || meeting.room_name}</div><div className="text-[11px] text-[var(--text-tertiary)] mt-0.5">{fmtDur(meeting.duration_seconds)} · {meeting.peak_participants || 0} peak</div></div><button onClick={close}><X size={18} className="text-[var(--text-tertiary)]" /></button></div>
        <div className="p-4">
          <div className="text-xs font-semibold text-[var(--text-primary)] mb-2 flex items-center gap-1.5"><Users size={14} /> Attendance ({rows.length})</div>
          {loading ? <div className="text-xs text-[var(--text-tertiary)]">Loading…</div> : rows.length === 0 ? <div className="text-xs text-[var(--text-tertiary)]">No attendance recorded.</div> : (
            <div className="flex flex-col gap-1.5">
              {rows.map(r => (
                <div key={r.id} className="flex items-center justify-between p-2.5 rounded-lg border border-[var(--border)]">
                  <span className="text-sm text-[var(--text-primary)]">{r.user_name}</span>
                  <span className="text-[11px] text-[var(--text-tertiary)] inline-flex items-center gap-1"><Clock size={11} />{fmtDur(r.duration_seconds)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
