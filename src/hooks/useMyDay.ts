// ============================================================
// Aura ERP — My Day Dashboard Hook (React Query)
// Aggregates tasks, meetings, notifications, and compliance alerts.
// ============================================================

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { taskService } from '@/services/taskService';
import { meetingService } from '@/services/meetingService';
import { notificationService } from '@/services/notificationService';

const EMPTY = {
  needsAction: [] as any[],
  urgentOverdueTasks: [] as any[],
  tasksToday: [] as any[],
  meetingsToday: [] as any[],
  tasksThisWeek: [] as any[],
  expiringDocs: [] as any[],
  recentlyCompleted: [] as any[],
};

async function buildMyDay(): Promise<typeof EMPTY> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return EMPTY;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
  const endOfWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

  // 1. Needs Action notifications
  const notifications = await notificationService.fetchNotifications(user.id, 50, true);
  const needsAction = notifications.filter(n => n.severity === 'ACTION_REQUIRED');

  // 2. Tasks
  const allTasks = await taskService.fetchTasks({ assignee_id: user.id });
  const openTasks = allTasks.filter(t => ['TODO', 'IN_PROGRESS', 'BLOCKED'].includes(t.status));
  const doneTasks = allTasks.filter(t => ['DONE', 'DONE_AUTO'].includes(t.status));

  const urgentOverdueTasks = openTasks.filter(t => t.priority === 'URGENT' || (t.due_date && new Date(t.due_date) < today));
  const tasksToday = openTasks.filter(t => {
    if (!t.due_date) return false;
    const d = new Date(t.due_date);
    return d >= today && d < tomorrow;
  });
  const tasksThisWeek = openTasks.filter(t => {
    if (!t.due_date) return false;
    const d = new Date(t.due_date);
    return d >= tomorrow && d <= endOfWeek;
  });
  const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
  const recentlyCompleted = doneTasks.filter(t => t.completed_at && new Date(t.completed_at) >= fortyEightHoursAgo);

  // 3. Meetings today
  const allMeetings = await meetingService.fetchMeetings({ status: 'SCHEDULED' });
  const userMeetings = allMeetings.filter(m => m.organizer_id === user.id || (m.attendees || []).some(a => a.user_id === user.id));
  const meetingsToday = userMeetings.filter(m => {
    const d = new Date(m.starts_at);
    return d >= today && d < tomorrow;
  });

  // 4. Expiring compliance docs (30 days) on the user's projects
  const { data: myProjects } = await supabase
    .from('projects')
    .select('id, name')
    .or(`project_manager_id.eq.${user.id},site_engineer_id.eq.${user.id}`);
  const projectIds = (myProjects || []).map(p => p.id);

  let expiringDocs: any[] = [];
  if (projectIds.length > 0) {
    const thirtyDays = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const todayStr = today.toISOString().split('T')[0];
    const { data: docs } = await supabase
      .from('documents')
      .select('id, title, expiry_date, entity_id')
      .eq('entity_type', 'PROJECT')
      .in('entity_id', projectIds)
      .eq('is_active', true)
      .gte('expiry_date', todayStr)
      .lte('expiry_date', thirtyDays);
    expiringDocs = (docs || []).map((d: any) => ({
      ...d,
      project_name: (myProjects || []).find(p => p.id === d.entity_id)?.name || 'Assigned Project',
    }));
  }

  return {
    needsAction, urgentOverdueTasks, tasksToday, meetingsToday,
    tasksThisWeek, expiringDocs, recentlyCompleted,
  };
}

export function useMyDay() {
  const q = useQuery({ queryKey: ['my-day'], queryFn: buildMyDay });
  const d = q.data ?? EMPTY;
  return {
    needsAction: d.needsAction,
    urgentOverdueTasks: d.urgentOverdueTasks,
    tasksToday: d.tasksToday,
    meetingsToday: d.meetingsToday,
    tasksThisWeek: d.tasksThisWeek,
    expiringDocs: d.expiringDocs,
    recentlyCompleted: d.recentlyCompleted,
    loading: q.isPending,
    error: (q.error as Error | null) ?? null,
    refetch: q.refetch,
  };
}

export default useMyDay;
