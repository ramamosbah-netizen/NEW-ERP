// ============================================================
// JEET ERP — Meeting Scheduler & Attendee Picker Component
// ============================================================

'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useMeetings } from '@/hooks/useMeetings';
import { Calendar, User, Briefcase, Plus, MapPin, AlertCircle, Users, Mail, X } from 'lucide-react';

type Props = {
  onMeetingCreated: () => void;
  projectId?: string;
};

export const MeetingScheduler: React.FC<Props> = ({ onMeetingCreated, projectId }) => {
  const [isOpen, setIsOpen] = useState(false);
  const { scheduleMeeting } = useMeetings();

  // Form States
  const [title, setTitle] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState(projectId || '');
  const [location, setLocation] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [agenda, setAgenda] = useState('');

  // Attendees States
  const [selectedProfileIds, setSelectedProfileIds] = useState<string[]>([]);
  const [externalName, setExternalName] = useState('');
  const [externalEmail, setExternalEmail] = useState('');
  const [externalAttendees, setExternalAttendees] = useState<Array<{ name: string; email: string }>>([]);

  // Fetch lists
  const [projects, setProjects] = useState<Array<{ id: string; name: string }>>([]);
  const [profiles, setProfiles] = useState<Array<{ id: string; full_name: string; role: string; email: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      // Fetch projects
      supabase.from('projects').select('id, name').eq('is_active', true).then(({ data }) => {
        if (data) setProjects(data);
      });
      // Fetch profiles
      supabase.from('profiles').select('id, full_name, role, email').then(({ data }) => {
        if (data) setProfiles(data);
      });
    }
  }, [isOpen]);

  const addExternalAttendee = () => {
    if (!externalName.trim() || !externalEmail.trim()) return;
    if (!externalEmail.includes('@')) {
      setError('Please provide a valid email address');
      return;
    }
    setExternalAttendees(prev => [...prev, { name: externalName.trim(), email: externalEmail.trim() }]);
    setExternalName('');
    setExternalEmail('');
    setError(null);
  };

  const removeExternalAttendee = (idx: number) => {
    setExternalAttendees(prev => prev.filter((_, i) => i !== idx));
  };

  const toggleProfileSelect = (pId: string) => {
    setSelectedProfileIds(prev =>
      prev.includes(pId) ? prev.filter(id => id !== pId) : [...prev, pId]
    );
  };

  const resetForm = () => {
    setTitle('');
    setSelectedProjectId(projectId || '');
    setLocation('');
    setStartsAt('');
    setEndsAt('');
    setAgenda('');
    setSelectedProfileIds([]);
    setExternalAttendees([]);
    setExternalName('');
    setExternalEmail('');
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError('Meeting title is required');
      return;
    }
    if (!startsAt || !endsAt) {
      setError('Start and End times are required');
      return;
    }
    if (new Date(startsAt) >= new Date(endsAt)) {
      setError('End time must be after start time');
      return;
    }

    try {
      setLoading(true);

      const userRes = await supabase.auth.getUser();
      const currentUser = userRes.data.user;
      if (!currentUser) throw new Error('Authentication required');

      const meetingData = {
        title: title.trim(),
        project_id: selectedProjectId || undefined,
        location: location.trim() || undefined,
        starts_at: new Date(startsAt).toISOString(),
        ends_at: new Date(endsAt).toISOString(),
        agenda: agenda.trim() || undefined,
        status: 'SCHEDULED' as const,
        organizer_id: currentUser.id
      };

      const attendees = [
        ...selectedProfileIds.map(uid => ({ user_id: uid })),
        ...externalAttendees.map(ext => ({ external_name: ext.name, external_email: ext.email }))
      ];

      await scheduleMeeting(meetingData, attendees);

      resetForm();
      onMeetingCreated();
      setIsOpen(false);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to schedule meeting');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <button
        onClick={() => setIsOpen(true)}
        className="quote-btn quote-btn-primary"
      >
        <Plus size={16} />
        Schedule Meeting
      </button>

      {isOpen && (
        <div className="quote-modal-overlay">
          <div className="quote-modal max-w-2xl">
            <div className="quote-modal-header">
              <h3 className="font-semibold text-slate-200 text-base flex items-center gap-2">
                <Calendar size={18} className="text-emerald-400" />
                Schedule Coordination Meeting
              </h3>
              <button
                onClick={() => {
                  resetForm();
                  setIsOpen(false);
                }}
                className="text-slate-400 hover:text-slate-200"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="quote-modal-body space-y-4">
              {error && (
                <div className="p-3 bg-red-950/40 border border-red-500/20 text-red-300 rounded-lg flex items-start gap-2 text-xs">
                  <AlertCircle size={16} className="text-red-400 mt-0.5 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Title */}
              <div className="quote-form-group">
                <label>Meeting Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Weekly Site Coordination Meeting"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="quote-form-input"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Project */}
                <div className="quote-form-group">
                  <label className="flex items-center gap-1"><Briefcase size={12} /> Project Link</label>
                  <select
                    value={selectedProjectId}
                    onChange={(e) => setSelectedProjectId(e.target.value)}
                    className="quote-form-input text-xs"
                  >
                    <option value="">No Project Link</option>
                    {projects.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>

                {/* Location */}
                <div className="quote-form-group">
                  <label className="flex items-center gap-1"><MapPin size={12} /> Location / Link</label>
                  <input
                    type="text"
                    placeholder="e.g. Conference Room B or Teams/Zoom Link"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="quote-form-input text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Start Date/Time */}
                <div className="quote-form-group">
                  <label className="flex items-center gap-1"><Calendar size={12} /> Starts At</label>
                  <input
                    type="datetime-local"
                    required
                    value={startsAt}
                    onChange={(e) => setStartsAt(e.target.value)}
                    className="quote-form-input font-mono text-xs"
                  />
                </div>

                {/* End Date/Time */}
                <div className="quote-form-group">
                  <label className="flex items-center gap-1"><Calendar size={12} /> Ends At</label>
                  <input
                    type="datetime-local"
                    required
                    value={endsAt}
                    onChange={(e) => setEndsAt(e.target.value)}
                    className="quote-form-input font-mono text-xs"
                  />
                </div>
              </div>

              {/* Agenda */}
              <div className="quote-form-group">
                <label>Agenda</label>
                <textarea
                  placeholder="Outline topics to be discussed..."
                  value={agenda}
                  onChange={(e) => setAgenda(e.target.value)}
                  className="quote-form-textarea text-xs"
                  rows={2}
                />
              </div>

              {/* Attendee Picker - Internal Team */}
              <div className="border-t border-slate-900/60 pt-4 space-y-2">
                <label className="flex items-center gap-1.5 text-xs font-bold text-slate-300 uppercase tracking-wide">
                  <Users size={13} className="text-emerald-400" />
                  Select Internal Team Members
                </label>
                <div className="max-h-28 overflow-y-auto border border-slate-900 rounded-lg p-2 grid grid-cols-2 gap-2 bg-slate-950/40 custom-scrollbar">
                  {profiles.map(p => {
                    const selected = selectedProfileIds.includes(p.id);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => toggleProfileSelect(p.id)}
                        className={`p-1.5 rounded text-left text-xs transition-all border flex items-center justify-between ${
                          selected
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                            : 'bg-slate-900 border-slate-900 text-slate-400 hover:border-slate-800'
                        }`}
                      >
                        <div className="truncate pr-1">
                          <div className="font-semibold truncate">{p.full_name}</div>
                          <div className="text-[9px] text-slate-500 truncate">{p.role}</div>
                        </div>
                        {selected && <span className="text-[10px] font-bold">✓</span>}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Attendee Picker - External Guests */}
              <div className="space-y-2 pt-1">
                <label className="flex items-center gap-1.5 text-xs font-bold text-slate-300 uppercase tracking-wide">
                  <Mail size={13} className="text-emerald-400" />
                  Invite External Guests (Suppliers, Clients)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Guest Name"
                    value={externalName}
                    onChange={(e) => setExternalName(e.target.value)}
                    className="flex-1 bg-slate-950 border border-slate-850 rounded px-2.5 py-1 text-xs text-slate-200 outline-none"
                  />
                  <input
                    type="email"
                    placeholder="Guest Email"
                    value={externalEmail}
                    onChange={(e) => setExternalEmail(e.target.value)}
                    className="flex-1 bg-slate-950 border border-slate-850 rounded px-2.5 py-1 text-xs text-slate-200 outline-none"
                  />
                  <button
                    type="button"
                    onClick={addExternalAttendee}
                    className="bg-slate-900 border border-slate-800 text-slate-300 hover:text-emerald-400 hover:border-emerald-500/20 text-xs px-3 rounded font-semibold transition-all"
                  >
                    Add
                  </button>
                </div>

                {externalAttendees.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1.5">
                    {externalAttendees.map((ext, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-900 border border-slate-850 text-[10px] text-slate-300 font-mono"
                      >
                        {ext.name} ({ext.email})
                        <button
                          type="button"
                          onClick={() => removeExternalAttendee(idx)}
                          className="text-slate-500 hover:text-red-400"
                        >
                          <X size={10} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Submit Actions */}
              <div className="flex justify-end gap-2 pt-4 border-t border-slate-900/60">
                <button
                  type="button"
                  onClick={() => {
                    resetForm();
                    setIsOpen(false);
                  }}
                  className="quote-btn quote-btn-secondary"
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="quote-btn quote-btn-primary"
                  disabled={loading}
                >
                  {loading ? 'Scheduling...' : 'Schedule Meeting'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default MeetingScheduler;
