// ============================================================
// JEET ERP — Meetings Module React Hook
// Handles scheduling lists, RSVPs, and action items extraction
// ============================================================

import { logger } from '@/lib/logger';
import { useState, useEffect, useCallback } from 'react';
import { meetingService } from '@/services/meetingService';
import type { Meeting, MeetingStatus, AttendeeResponse } from '@/types/meeting.types';

export function useMeetings(filters: {
  project_id?: string;
  organizer_id?: string;
  status?: MeetingStatus;
} = {}) {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchList = useCallback(async () => {
    try {
      setLoading(true);
      const data = await meetingService.fetchMeetings(filters);
      setMeetings(data);
      setError(null);
    } catch (err: any) {
      logger.error('Failed to fetch meetings list:', err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [JSON.stringify(filters)]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const scheduleMeeting = async (
    meetingData: Omit<Meeting, 'id' | 'created_at' | 'attendees' | 'action_items'>,
    attendees: Array<{ user_id?: string; external_name?: string; external_email?: string }>
  ) => {
    const res = await meetingService.createMeeting(meetingData, attendees);
    await fetchList();
    return res;
  };

  const respondInvitation = async (meetingId: string, userId: string, response: AttendeeResponse) => {
    await meetingService.respondToInvitation(meetingId, userId, response);
    // Update local state response
    setMeetings(prev =>
      prev.map(m => {
        if (m.id !== meetingId) return m;
        const updatedAttendees = (m.attendees || []).map(a => 
          a.user_id === userId ? { ...a, response } : a
        );
        return { ...m, attendees: updatedAttendees };
      })
    );
  };

  return {
    meetings,
    loading,
    error,
    refetch: fetchList,
    scheduleMeeting,
    respondInvitation
  };
}

/**
 * Hook for managing details, actions, and publishing minutes for a single meeting.
 */
export function useMeetingDetail(meetingId: string | null) {
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchDetails = useCallback(async () => {
    if (!meetingId) return;
    try {
      setLoading(true);
      const data = await meetingService.fetchMeetingById(meetingId);
      setMeeting(data);
      setError(null);
    } catch (err: any) {
      logger.error('Failed to load meeting details:', err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [meetingId]);

  useEffect(() => {
    fetchDetails();
  }, [fetchDetails]);

  const extractAIActionItems = async (minutesText: string) => {
    return await meetingService.extractActionItems(minutesText);
  };

  const publishMinutes = async (
    minutesMarkdown: string,
    actionItems: Array<{ description: string; assignee_id?: string; due_date?: string }>
  ) => {
    if (!meetingId) return false;
    const res = await meetingService.publishMinutes(meetingId, minutesMarkdown, actionItems);
    if (res) {
      await fetchDetails();
    }
    return res;
  };

  return {
    meeting,
    loading,
    error,
    refetch: fetchDetails,
    extractAIActionItems,
    publishMinutes
  };
}
