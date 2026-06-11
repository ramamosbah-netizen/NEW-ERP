// ============================================================
// JEET ERP — Meetings & Minutes Coordination Portal
// Route: /meetings
// ============================================================

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useMeetings, useMeetingDetail } from '@/hooks/useMeetings';
import { useTasks } from '@/hooks/useTasks';
import CalendarGrid from '@/components/meetings/CalendarGrid';
import MeetingScheduler from '@/components/meetings/MeetingScheduler';
import MinutesEditor from '@/components/meetings/MinutesEditor';
import TaskDetailDrawer from '@/components/tasks/TaskDetailDrawer';
import { 
  Calendar, 
  Users, 
  MapPin, 
  FileText, 
  Clock, 
  Check, 
  X, 
  HelpCircle, 
  Sparkles, 
  Layers,
  LayoutGrid,
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import type { Meeting, AttendeeResponse } from '@/types/meeting.types';

export default function MeetingsPage() {
  const router = useRouter();
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');
  const [userId, setUserId] = useState<string | null>(null);

  // Filters
  const [filters, setFilters] = useState<any>({
    project_id: '',
    status: ''
  });

  const { meetings, loading, error, refetch, respondInvitation } = useMeetings(filters);
  const { tasks } = useTasks(); // pull all tasks to display on calendar

  // Modals / Inspectors State
  const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'details' | 'minutes' | 'attendees'>('details');
  const [isEditingMinutes, setIsEditingMinutes] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  // Fetch single meeting details using hook
  const { meeting: meetingDetail, refetch: refetchDetail } = useMeetingDetail(selectedMeetingId);
  const [projects, setProjects] = useState<any[]>([]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.replace('/signin');
      } else {
        setUserId(user.id);
      }
    });

    supabase.from('projects').select('id, name').eq('is_active', true).then(({ data }) => {
      if (data) setProjects(data);
    });
  }, [router]);

  const handleFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFilters((prev: any) => ({ ...prev, [name]: value }));
  };

  const handleRSVP = async (mId: string, response: AttendeeResponse) => {
    if (!userId) return;
    try {
      await respondInvitation(mId, userId, response);
      if (selectedMeetingId === mId) {
        refetchDetail();
      }
      refetch();
    } catch (err) {
      console.error(err);
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  };

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  };

  const getRSVPBadge = (response: AttendeeResponse) => {
    switch (response) {
      case 'ACCEPTED':
        return <span className="px-2 py-0.5 rounded text-[9px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">ACCEPTED</span>;
      case 'DECLINED':
        return <span className="px-2 py-0.5 rounded text-[9px] font-mono bg-red-500/10 text-red-400 border border-red-500/25">DECLINED</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[9px] font-mono bg-slate-900 text-slate-400 border border-slate-800">PENDING</span>;
    }
  };

  const getMyRSVP = (meeting: Meeting) => {
    if (!userId || !meeting.attendees) return 'PENDING';
    const match = meeting.attendees.find(a => a.user_id === userId);
    return match ? match.response : 'PENDING';
  };

  const isOrganizer = meetingDetail?.organizer_id === userId;

  return (
    <div className="flex flex-col min-h-screen w-full relative z-10">
<main className="quote-container flex-1 py-8 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h1 className="quote-header-title flex items-center gap-2">
              <Calendar className="text-emerald-400" size={26} />
              Meetings & Minutes Manager
            </h1>
            <p className="quote-header-subtitle">Central coordination logs linking project agendas, RSVPs, and AI task generators.</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                refetch();
                if (selectedMeetingId) refetchDetail();
              }}
              className="quote-btn quote-btn-secondary text-xs"
              disabled={loading}
            >
              <RefreshCw className={loading ? 'animate-spin' : ''} size={14} />
              Sync
            </button>
            <MeetingScheduler onMeetingCreated={() => refetch()} />
          </div>
        </div>

        {/* Filter Bar and View Mode Switcher */}
        <div className="quote-card flex flex-col md:flex-row justify-between items-center gap-4 py-4">
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            {/* Project Filter */}
            <div className="flex items-center gap-1 bg-slate-950 border border-slate-900 rounded-lg px-2 py-0.5">
              <Layers size={12} className="text-slate-500" />
              <select
                name="project_id"
                value={filters.project_id}
                onChange={handleFilterChange}
                className="bg-transparent text-xs text-slate-300 py-1 outline-none font-mono"
              >
                <option value="">All Projects</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-1 bg-slate-950 border border-slate-900 rounded-lg px-2 py-0.5">
              <Clock size={12} className="text-slate-500" />
              <select
                name="status"
                value={filters.status}
                onChange={handleFilterChange}
                className="bg-transparent text-xs text-slate-300 py-1 outline-none font-mono"
              >
                <option value="">All Meetings</option>
                <option value="SCHEDULED">Scheduled</option>
                <option value="COMPLETED">Completed</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>
          </div>

          {/* View Toggles */}
          <div className="flex bg-slate-950/60 border border-slate-900 p-0.5 rounded-lg">
            <button
              onClick={() => setViewMode('calendar')}
              className={`px-3 py-1.5 rounded text-xs font-semibold flex items-center gap-1.5 transition-all ${
                viewMode === 'calendar'
                  ? 'bg-emerald-500 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Calendar View
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 rounded text-xs font-semibold flex items-center gap-1.5 transition-all ${
                viewMode === 'list'
                  ? 'bg-emerald-500 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Agenda List
            </button>
          </div>
        </div>

        {/* Board Main Area */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <RefreshCw className="animate-spin text-emerald-400" size={32} />
            <span className="text-slate-400 font-mono text-sm">RETRIEVING COORDINATION AGENDAS...</span>
          </div>
        ) : error ? (
          <div className="p-4 bg-red-950/20 border border-red-500/10 text-red-300 rounded-xl text-center text-xs">
            Failed to fetch meetings list: {error.message}
          </div>
        ) : viewMode === 'calendar' ? (
          <CalendarGrid
            meetings={meetings}
            tasks={tasks}
            onSelectMeeting={(m) => {
              setSelectedMeetingId(m.id);
              setActiveTab('details');
              setIsEditingMinutes(false);
            }}
            onSelectTask={(t) => setSelectedTaskId(t.id)}
          />
        ) : meetings.length === 0 ? (
          <div className="quote-card py-20 text-center text-slate-500 text-sm">
            <Calendar size={48} className="mx-auto mb-4 opacity-10 text-slate-400" />
            No meetings found. Schedule a coordination meeting above.
          </div>
        ) : (
          <div className="quote-card p-0 overflow-hidden">
            <div className="quote-table-wrap">
              <table className="quote-table">
                <thead>
                  <tr>
                    <th>Meeting Details</th>
                    <th>Associated Project</th>
                    <th>Location / Connection</th>
                    <th>Status</th>
                    <th>Your RSVP</th>
                  </tr>
                </thead>
                <tbody>
                  {meetings.map(m => {
                    const myRsvp = getMyRSVP(m);
                    return (
                      <tr
                        key={m.id}
                        onClick={() => {
                          setSelectedMeetingId(m.id);
                          setActiveTab('details');
                          setIsEditingMinutes(false);
                        }}
                        className="cursor-pointer hover:bg-slate-900/40 border-b border-slate-900/60"
                      >
                        <td className="py-4">
                          <div className="font-semibold text-xs text-slate-200">{m.title}</div>
                          <div className="text-[10px] text-slate-500 font-mono mt-1 flex items-center gap-1.5">
                            <Clock size={10} />
                            {formatDate(m.starts_at)} @ {formatTime(m.starts_at)} - {formatTime(m.ends_at)}
                          </div>
                        </td>
                        <td className="py-4 text-xs text-slate-400 font-mono">
                          {m.project_name || '-'}
                        </td>
                        <td className="py-4 text-xs text-slate-400 truncate max-w-[180px]">
                          {m.location || <span className="text-slate-650 italic">Not specified</span>}
                        </td>
                        <td className="py-4 text-xs">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-bold font-mono tracking-wider border ${
                            m.status === 'COMPLETED'
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                              : m.status === 'CANCELLED'
                              ? 'bg-red-500/10 text-red-400 border-red-500/20'
                              : 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20'
                          }`}>
                            {m.status}
                          </span>
                        </td>
                        <td className="py-4" onClick={(e) => e.stopPropagation()}>
                          {m.status === 'SCHEDULED' ? (
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => handleRSVP(m.id, 'ACCEPTED')}
                                className={`p-1 rounded text-xs transition-colors border ${
                                  myRsvp === 'ACCEPTED'
                                    ? 'bg-emerald-500/20 border-emerald-500/45 text-emerald-400'
                                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-emerald-400'
                                }`}
                                title="Accept invitation"
                              >
                                <Check size={12} />
                              </button>
                              <button
                                onClick={() => handleRSVP(m.id, 'DECLINED')}
                                className={`p-1 rounded text-xs transition-colors border ${
                                  myRsvp === 'DECLINED'
                                    ? 'bg-red-500/20 border-red-500/45 text-red-400'
                                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-red-400'
                                }`}
                                title="Decline invitation"
                              >
                                <X size={12} />
                              </button>
                            </div>
                          ) : (
                            <span className="text-slate-600 italic text-[11px]">Closed</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* Meeting Detail Inspector Modal */}
      {selectedMeetingId && meetingDetail && (
        <div className="quote-modal-overlay">
          <div className="quote-modal max-w-2xl">
            <div className="quote-modal-header bg-slate-900/50">
              <div>
                <span className="text-[10px] font-mono text-emerald-400 uppercase tracking-widest block font-bold">
                  Agenda Inspector
                </span>
                <h3 className="font-semibold text-slate-200 text-sm mt-0.5">{meetingDetail.title}</h3>
              </div>
              <button
                onClick={() => setSelectedMeetingId(null)}
                className="text-slate-400 hover:text-slate-200"
              >
                ✕
              </button>
            </div>

            {/* Content Tabs */}
            <div className="quote-tabs px-6 pt-3 bg-slate-950">
              <button
                onClick={() => { setActiveTab('details'); setIsEditingMinutes(false); }}
                className={`quote-tab ${activeTab === 'details' && !isEditingMinutes ? 'active' : ''}`}
              >
                Information
              </button>
              <button
                onClick={() => { setActiveTab('attendees'); setIsEditingMinutes(false); }}
                className={`quote-tab ${activeTab === 'attendees' && !isEditingMinutes ? 'active' : ''}`}
              >
                Attendees ({meetingDetail.attendees?.length || 0})
              </button>
              <button
                onClick={() => { setActiveTab('minutes'); }}
                className={`quote-tab ${activeTab === 'minutes' || isEditingMinutes ? 'active' : ''}`}
              >
                Minutes & Tasks
              </button>
            </div>

            <div className="quote-modal-body space-y-4 max-h-[60vh] overflow-y-auto custom-scrollbar">
              
              {/* DETAILS TAB */}
              {activeTab === 'details' && (
                <div className="space-y-4 text-left">
                  {/* Meta box */}
                  <div className="p-4 bg-slate-900/30 border border-slate-900 rounded-xl grid grid-cols-2 gap-4 text-xs">
                    <div>
                      <span className="text-slate-500 block">Date & Time</span>
                      <span className="font-mono text-slate-200 font-bold block mt-1">
                        {formatDate(meetingDetail.starts_at)}
                      </span>
                      <span className="font-mono text-slate-400 text-[10px] block">
                        {formatTime(meetingDetail.starts_at)} - {formatTime(meetingDetail.ends_at)} (UAE GST)
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-500 block">Location / Call</span>
                      {meetingDetail.location ? (
                        <span className="font-semibold text-cyan-400 block mt-1 truncate max-w-[200px]">
                          {meetingDetail.location}
                        </span>
                      ) : (
                        <span className="text-slate-650 italic block mt-1">Not specified</span>
                      )}
                    </div>

                    <div className="border-t border-slate-950/40 pt-2.5 mt-1">
                      <span className="text-slate-500 block">Organizer</span>
                      <span className="text-slate-300 font-bold block mt-0.5">
                        {meetingDetail.organizer_name}
                      </span>
                    </div>

                    <div className="border-t border-slate-950/40 pt-2.5 mt-1">
                      <span className="text-slate-500 block">Associated Project</span>
                      <span className="text-slate-300 font-mono block mt-0.5 truncate max-w-[200px]">
                        {meetingDetail.project_name || 'Unlinked'}
                      </span>
                    </div>
                  </div>

                  {/* Agenda */}
                  {meetingDetail.agenda && (
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Agenda Details</label>
                      <div className="p-3.5 bg-slate-950 border border-slate-900 rounded-xl text-slate-300 text-xs leading-relaxed whitespace-pre-wrap">
                        {meetingDetail.agenda}
                      </div>
                    </div>
                  )}

                  {/* RSVP Call to Action */}
                  {meetingDetail.status === 'SCHEDULED' && (
                    <div className="p-4 bg-slate-900/10 border border-slate-900 rounded-xl flex items-center justify-between">
                      <div>
                        <div className="text-xs font-semibold text-slate-200">Confirm your RSVP Response</div>
                        <p className="text-[10px] text-slate-500 mt-0.5">Let the organizer know if you are attending.</p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleRSVP(meetingDetail.id, 'ACCEPTED')}
                          className={`quote-btn bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/25 px-3 py-1 text-xs`}
                        >
                          ✓ Accept
                        </button>
                        <button
                          onClick={() => handleRSVP(meetingDetail.id, 'DECLINED')}
                          className={`quote-btn bg-red-500/15 border border-red-500/30 text-red-300 hover:bg-red-500/25 px-3 py-1 text-xs`}
                        >
                          ✕ Decline
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ATTENDEES TAB */}
              {activeTab === 'attendees' && (
                <div className="space-y-3 text-left">
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Attendee Checklist</h4>
                  <div className="divide-y divide-slate-900/60 max-h-[300px] overflow-y-auto pr-1">
                    {(meetingDetail.attendees || []).map((att) => (
                      <div key={att.id} className="py-2.5 flex items-center justify-between text-xs">
                        <div>
                          <div className="font-semibold text-slate-200">{att.full_name}</div>
                          {att.email && <div className="text-[10px] text-slate-500 font-mono mt-0.5">{att.email}</div>}
                        </div>
                        <div>
                          {getRSVPBadge(att.response)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* MINUTES & TASKS TAB */}
              {activeTab === 'minutes' && (
                <div className="space-y-4 text-left">
                  {isEditingMinutes ? (
                    <MinutesEditor
                      meetingId={meetingDetail.id}
                      onPublished={() => {
                        setIsEditingMinutes(false);
                        refetchDetail();
                        refetch();
                      }}
                      onCancel={() => setIsEditingMinutes(false)}
                    />
                  ) : meetingDetail.minutes ? (
                    <div className="space-y-4">
                      {/* Published details */}
                      <div className="flex justify-between items-center text-[10px] text-slate-500 border-b border-slate-900 pb-2">
                        <span>Status: Completed</span>
                        {meetingDetail.minutes_published_at && (
                          <span>Published: {formatDate(meetingDetail.minutes_published_at)} {formatTime(meetingDetail.minutes_published_at)}</span>
                        )}
                      </div>

                      {/* Minutes Content */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Minutes Content</label>
                        <div className="p-3.5 bg-slate-950 border border-slate-900 rounded-xl text-slate-300 text-xs leading-relaxed whitespace-pre-wrap font-mono">
                          {meetingDetail.minutes}
                        </div>
                      </div>

                      {/* Created action items */}
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Action Items & Deliverables</label>
                        {(!meetingDetail.action_items || meetingDetail.action_items.length === 0) ? (
                          <p className="text-xs text-slate-650 italic">No action items were assigned.</p>
                        ) : (
                          <div className="divide-y divide-slate-900/60 border border-slate-900 rounded-xl overflow-hidden bg-slate-950/20">
                            {meetingDetail.action_items.map((ai) => (
                              <div
                                key={ai.id}
                                onClick={() => {
                                  if (ai.task_id) {
                                    setSelectedTaskId(ai.task_id);
                                  }
                                }}
                                className="p-2.5 flex items-center justify-between text-xs hover:bg-slate-900/20 cursor-pointer group"
                              >
                                <div className="min-w-0 flex-1">
                                  <div className="font-semibold text-slate-300 group-hover:text-emerald-400 truncate pr-2">
                                    {ai.description}
                                  </div>
                                  <div className="text-[9px] text-slate-500 flex items-center gap-2 mt-0.5">
                                    <span>Assignee: {ai.assignee_name || 'Unassigned'}</span>
                                    {ai.due_date && <span>Due: {formatDate(ai.due_date)}</span>}
                                  </div>
                                </div>
                                <span className="text-[8px] font-mono font-bold text-slate-500 border border-slate-800 px-1 py-0.5 rounded">
                                  TASK
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="py-8 text-center space-y-4">
                      <FileText size={36} className="mx-auto text-slate-600 opacity-20" />
                      <div>
                        <h4 className="text-xs font-semibold text-slate-400">Minutes not published yet</h4>
                        <p className="text-[10px] text-slate-500 mt-0.5">Publish minutes to record discussions and auto-generate task items.</p>
                      </div>
                      {(isOrganizer || true) && (
                        <button
                          type="button"
                          onClick={() => setIsEditingMinutes(true)}
                          className="quote-btn quote-btn-primary text-xs"
                        >
                          <Sparkles size={12} />
                          Publish Minutes (AI Assisted)
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

            </div>
          </div>
        </div>
      )}

      {/* Task Drawer Inspector Overlay */}
      {selectedTaskId && (
        <>
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50" onClick={() => setSelectedTaskId(null)} />
          <TaskDetailDrawer
            taskId={selectedTaskId}
            onClose={() => setSelectedTaskId(null)}
            onTaskUpdated={() => {
              refetch();
              if (selectedMeetingId) refetchDetail();
            }}
          />
        </>
      )}
    </div>
  );
}
