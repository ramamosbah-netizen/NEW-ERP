// ============================================================
// Aura ERP — Meetings Module React Hooks (React Query)
// ============================================================

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { meetingService } from '@/services/meetingService';
import type { Meeting, MeetingStatus, AttendeeResponse } from '@/types/meeting.types';

interface MeetingFilters {
  project_id?: string;
  organizer_id?: string;
  status?: MeetingStatus;
}

const mKeys = {
  lists: ['meetings', 'list'] as const,
  list: (f: MeetingFilters) => ['meetings', 'list', f] as const,
  detail: (id: string) => ['meetings', 'detail', id] as const,
};

export function useMeetings(filters: MeetingFilters = {}) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: mKeys.list(filters), queryFn: () => meetingService.fetchMeetings(filters) });

  const scheduleMeeting = async (
    meetingData: Omit<Meeting, 'id' | 'created_at' | 'attendees' | 'action_items'>,
    attendees: Array<{ user_id?: string; external_name?: string; external_email?: string }>,
  ) => {
    const res = await meetingService.createMeeting(meetingData, attendees);
    await qc.invalidateQueries({ queryKey: mKeys.lists });
    return res;
  };

  const respondInvitation = async (meetingId: string, userId: string, response: AttendeeResponse) => {
    await meetingService.respondToInvitation(meetingId, userId, response);
    await qc.invalidateQueries({ queryKey: mKeys.lists });
  };

  return {
    meetings: q.data ?? [],
    loading: q.isPending,
    error: (q.error as Error | null) ?? null,
    refetch: q.refetch,
    scheduleMeeting,
    respondInvitation,
  };
}

export function useMeetingDetail(meetingId: string | null) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: mKeys.detail(meetingId ?? ''),
    enabled: !!meetingId,
    queryFn: () => meetingService.fetchMeetingById(meetingId!),
  });

  const extractAIActionItems = async (minutesText: string) => meetingService.extractActionItems(minutesText);

  const publishMinutes = async (
    minutesMarkdown: string,
    actionItems: Array<{ description: string; assignee_id?: string; due_date?: string }>,
  ) => {
    if (!meetingId) return false;
    const res = await meetingService.publishMinutes(meetingId, minutesMarkdown, actionItems);
    if (res) await qc.invalidateQueries({ queryKey: mKeys.detail(meetingId) });
    return res;
  };

  return {
    meeting: q.data ?? null,
    loading: q.isLoading,
    error: (q.error as Error | null) ?? null,
    refetch: q.refetch,
    extractAIActionItems,
    publishMinutes,
  };
}
