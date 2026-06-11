// ============================================================
// JEET ERP — Meetings Service Client
// Handles creation, calendar feeds, responses, minutes, and AI parsing
// ============================================================

import { supabase } from '@/lib/supabase';
import type { Meeting, MeetingStatus, AttendeeResponse, MeetingAttendee, MeetingActionItem } from '@/types/meeting.types';
import { documentService } from '@/lib/document-service';

export const meetingService = {
  /**
   * Fetches all scheduled meetings.
   */
  async fetchMeetings(filters: {
    project_id?: string;
    organizer_id?: string;
    status?: MeetingStatus;
  } = {}): Promise<Meeting[]> {
    let query = supabase
      .from('meetings')
      .select(`
        *,
        project:projects (name),
        organizer:profiles!organizer_id (full_name)
      `)
      .order('starts_at', { ascending: true });

    if (filters.project_id) query = query.eq('project_id', filters.project_id);
    if (filters.organizer_id) query = query.eq('organizer_id', filters.organizer_id);
    if (filters.status) query = query.eq('status', filters.status);

    const { data, error } = await query;
    if (error) throw error;

    return (data || []).map((m: any) => ({
      ...m,
      project_name: m.project?.name,
      organizer_name: m.organizer?.full_name
    })) as Meeting[];
  },

  /**
   * Fetches meeting details along with attendees and action items.
   */
  async fetchMeetingById(id: string): Promise<Meeting | null> {
    const { data: meeting, error } = await supabase
      .from('meetings')
      .select(`
        *,
        project:projects (name),
        organizer:profiles!organizer_id (full_name)
      `)
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    // Fetch attendees
    const { data: attendees } = await supabase
      .from('meeting_attendees')
      .select(`
        *,
        profile:profiles (full_name, email)
      `)
      .eq('meeting_id', id);

    // Fetch action items
    const { data: actionItems } = await supabase
      .from('meeting_action_items')
      .select(`
        *,
        assignee:profiles (full_name)
      `)
      .eq('meeting_id', id);

    const formattedAttendees = (attendees || []).map((a: any) => ({
      ...a,
      full_name: a.profile?.full_name || a.external_name || 'External Guest',
      email: a.profile?.email || a.external_email
    }));

    const formattedActionItems = (actionItems || []).map((ai: any) => ({
      ...ai,
      assignee_name: ai.assignee?.full_name
    }));

    return {
      ...meeting,
      project_name: meeting.project?.name,
      organizer_name: meeting.organizer?.full_name,
      attendees: formattedAttendees,
      action_items: formattedActionItems
    } as Meeting;
  },

  /**
   * Schedules a new meeting.
   */
  async createMeeting(
    meetingData: Omit<Meeting, 'id' | 'created_at' | 'attendees' | 'action_items'>,
    attendees: Array<{ user_id?: string; external_name?: string; external_email?: string }>
  ): Promise<Meeting> {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) throw new Error('Authentication required.');

    const { data: meeting, error } = await supabase
      .from('meetings')
      .insert({
        ...meetingData,
        organizer_id: user.id,
        status: 'SCHEDULED'
      })
      .select()
      .single();

    if (error) throw error;

    // Add attendees
    if (attendees.length > 0) {
      const attendeesToInsert = attendees.map(a => ({
        meeting_id: meeting.id,
        user_id: a.user_id || null,
        external_name: a.external_name || null,
        external_email: a.external_email || null,
        response: 'PENDING'
      }));

      const { error: attError } = await supabase
        .from('meeting_attendees')
        .insert(attendeesToInsert);

      if (attError) {
        // Rollback meeting
        await supabase.from('meetings').delete().eq('id', meeting.id);
        throw attError;
      }
    }

    // Trigger meeting.scheduled event to fan-out notifications
    supabase.functions.invoke('process-event', {
      body: {
        action: 'emit-event',
        event_type: 'meeting.scheduled',
        entity_type: 'MEETING',
        entity_id: meeting.id,
        project_id: meeting.project_id || null,
        payload: {
          meeting_id: meeting.id,
          title: meeting.title,
          starts_at: meeting.starts_at,
          attendee_ids: attendees.map(a => a.user_id).filter(Boolean)
        }
      }
    }).catch(err => console.error(err));

    return meeting as Meeting;
  },

  /**
   * Updates meeting status or time boundaries.
   */
  async updateMeeting(id: string, updates: Partial<Meeting>): Promise<boolean> {
    const cleanUpdates = { ...updates };
    delete cleanUpdates.attendees;
    delete cleanUpdates.action_items;
    delete cleanUpdates.project_name;
    delete cleanUpdates.organizer_name;

    const { error } = await supabase
      .from('meetings')
      .update(cleanUpdates)
      .eq('id', id);

    if (error) throw error;

    // Trigger calendar-sync integration
    supabase.functions.invoke('calendar-sync', {
      body: { meeting_id: id, action: 'update' }
    }).catch(err => console.error(err));

    return true;
  },

  /**
   * Responds to an invitation (RSVP).
   */
  async respondToInvitation(meetingId: string, userId: string, response: AttendeeResponse): Promise<boolean> {
    const { error } = await supabase
      .from('meeting_attendees')
      .update({ response })
      .eq('meeting_id', meetingId)
      .eq('user_id', userId);

    if (error) throw error;
    return true;
  },

  /**
   * Invokes Gemini via Edge Function to extract checklist items from raw meeting minutes.
   */
  async extractActionItems(minutesText: string): Promise<Array<{
    description: string;
    suggested_assignee_name?: string;
    suggested_due_days?: number;
  }>> {
    const { data, error } = await supabase.functions.invoke('process-event', {
      body: {
        action: 'extract-minutes',
        minutes: minutesText
      }
    });

    if (error) throw error;
    return data.action_items || [];
  },

  /**
   * Publishes minutes, creates action tasks, and files notes in project DMS.
   */
  async publishMinutes(
    meetingId: string,
    minutesMarkdown: string,
    actionItems: Array<{ description: string; assignee_id?: string; due_date?: string }>
  ): Promise<boolean> {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) throw new Error('Authentication required.');

    // 1. Save minutes to meeting record
    const { error: meetingErr } = await supabase
      .from('meetings')
      .update({
        minutes: minutesMarkdown,
        minutes_published_at: new Date().toISOString(),
        status: 'COMPLETED'
      })
      .eq('id', meetingId);

    if (meetingErr) throw meetingErr;

    // 2. Resolve meeting context
    const meeting = await this.fetchMeetingById(meetingId);
    if (!meeting) throw new Error('Meeting not found.');

    // 3. Create action item tasks
    for (const item of actionItems) {
      // Create ERP task (Origin: MEETING_ACTION)
      const task = await supabase
        .from('tasks')
        .insert({
          title: `Action: ${item.description}`,
          description: `Action item assigned from meeting "${meeting.title}" on ${new Date(meeting.starts_at).toLocaleDateString('en-GB')}`,
          origin: 'MEETING_ACTION',
          project_id: meeting.project_id || null,
          linked_entity_type: 'MEETING',
          linked_entity_id: meetingId,
          assignee_id: item.assignee_id || null,
          created_by: user.id,
          priority: 'MEDIUM',
          due_date: item.due_date ? new Date(item.due_date).toISOString() : null,
          status: 'TODO'
        })
        .select()
        .single();

      if (task.data) {
        // Save back into meeting_action_items
        await supabase
          .from('meeting_action_items')
          .insert({
            meeting_id: meetingId,
            description: item.description,
            assignee_id: item.assignee_id || null,
            due_date: item.due_date || null,
            task_id: task.data.id
          });

        // Trigger task.assigned notification
        if (item.assignee_id) {
          supabase.functions.invoke('process-event', {
            body: {
              action: 'emit-event',
              event_type: 'task.assigned',
              entity_type: 'TASK',
              entity_id: task.data.id,
              project_id: meeting.project_id || null,
              payload: {
                task_id: task.data.id,
                title: task.data.title,
                description: task.data.description,
                assignee_id: item.assignee_id
              }
            }
          }).catch(err => console.error(err));
        }
      }
    }

    // 4. File minutes as PDF / Document in DMS category CORRESPONDENCE/MEETING_MINUTES
    if (meeting.project_id) {
      try {
        const fileContent = `# Minutes of Meeting: ${meeting.title}\n\nDate: ${new Date(meeting.starts_at).toLocaleDateString('en-GB')}\nOrganizer: ${meeting.organizer_name || ''}\n\n## Agenda\n${meeting.agenda || ''}\n\n## Minutes\n${minutesMarkdown}`;
        const blob = new Blob([fileContent], { type: 'text/markdown' });
        const file = new File([blob], `Minutes_${meeting.title.replace(/\s+/g, '_')}_${Date.now()}.md`, { type: 'text/markdown' });

        // Trigger upload
        const { runUploadPipeline } = await import('@/lib/document-upload-service');
        await runUploadPipeline(
          file,
          'PROJECT',
          meeting.project_id,
          ['minutes', 'action-items'],
          false
        );
      } catch (err) {
        console.error('Failed to auto-archive minutes to DMS:', err);
      }
    }

    // 5. Emit event to notify attendees
    const attendeeIds = (meeting.attendees || []).map(a => a.user_id).filter(Boolean) as string[];
    supabase.functions.invoke('process-event', {
      body: {
        action: 'emit-event',
        event_type: 'meeting.minutes_published',
        entity_type: 'MEETING',
        entity_id: meetingId,
        project_id: meeting.project_id || null,
        payload: {
          meeting_id: meetingId,
          title: meeting.title,
          attendees: attendeeIds
        }
      }
    }).catch(err => console.error(err));

    return true;
  }
};
export default meetingService;
