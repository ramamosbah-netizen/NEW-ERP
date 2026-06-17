// ============================================================
// JEET ERP — My Day Dashboard Hook
// Aggregates tasks, meetings, notifications, and compliance alerts
// ============================================================

import { logger } from '@/lib/logger';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { taskService } from '@/services/taskService';
import { meetingService } from '@/services/meetingService';
import { notificationService } from '@/services/notificationService';
import type { Task } from '@/types/task.types';
import type { Meeting } from '@/types/meeting.types';
import type { Notification } from '@/types/notification.types';

export function useMyDay() {
  const [needsAction, setNeedsAction] = useState<Notification[]>([]);
  const [urgentOverdueTasks, setUrgentOverdueTasks] = useState<Task[]>([]);
  const [tasksToday, setTasksToday] = useState<Task[]>([]);
  const [meetingsToday, setMeetingsToday] = useState<Meeting[]>([]);
  
  // Radar States
  const [tasksThisWeek, setTasksThisWeek] = useState<Task[]>([]);
  const [expiringDocs, setExpiringDocs] = useState<any[]>([]);
  const [recentlyCompleted, setRecentlyCompleted] = useState<Task[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchMyDayData = useCallback(async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const today = new Date();
      today.setHours(0,0,0,0);
      const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
      const endOfWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

      // 1. Fetch Needs Action (Pending ACTION_REQUIRED notifications)
      const notifications = await notificationService.fetchNotifications(user.id, 50, true);
      const actionRequired = notifications.filter(n => n.severity === 'ACTION_REQUIRED');
      setNeedsAction(actionRequired);

      // 2. Fetch Tasks (Manual + Auto)
      const allTasks = await taskService.fetchTasks({ assignee_id: user.id });
      
      const openTasks = allTasks.filter(t => ['TODO', 'IN_PROGRESS', 'BLOCKED'].includes(t.status));
      const doneTasks = allTasks.filter(t => ['DONE', 'DONE_AUTO'].includes(t.status));

      // Urgent or Overdue
      const urgentOrOverdue = openTasks.filter(t => 
        t.priority === 'URGENT' || (t.due_date && new Date(t.due_date) < today)
      );
      setUrgentOverdueTasks(urgentOrOverdue);

      // Due Today
      const dueToday = openTasks.filter(t => {
        if (!t.due_date) return false;
        const d = new Date(t.due_date);
        return d >= today && d < tomorrow;
      });
      setTasksToday(dueToday);

      // Due This Week (excluding today)
      const dueWeek = openTasks.filter(t => {
        if (!t.due_date) return false;
        const d = new Date(t.due_date);
        return d >= tomorrow && d <= endOfWeek;
      });
      setTasksThisWeek(dueWeek);

      // Recently Completed (last 48 hours)
      const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
      const recentDone = doneTasks.filter(t => t.completed_at && new Date(t.completed_at) >= fortyEightHoursAgo);
      setRecentlyCompleted(recentDone);

      // 3. Fetch Meetings Today
      const allMeetings = await meetingService.fetchMeetings({ status: 'SCHEDULED' });
      // Filter where user is attendee or organizer
      const userMeetings = allMeetings.filter(m => 
        m.organizer_id === user.id || (m.attendees || []).some(a => a.user_id === user.id)
      );
      const meetings = userMeetings.filter(m => {
        const d = new Date(m.starts_at);
        return d >= today && d < tomorrow;
      });
      setMeetingsToday(meetings);

      // 4. Fetch Expiring Compliance Documents (30 days) on projects they manage/engineer
      const { data: myProjects } = await supabase
        .from('projects')
        .select('id, name')
        .or(`project_manager_id.eq.${user.id},site_engineer_id.eq.${user.id}`);

      const projectIds = (myProjects || []).map(p => p.id);
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

        const formattedDocs = (docs || []).map((d: any) => {
          const proj = (myProjects || []).find(p => p.id === d.entity_id);
          return {
            ...d,
            project_name: proj?.name || 'Assigned Project'
          };
        });
        setExpiringDocs(formattedDocs);
      } else {
        setExpiringDocs([]);
      }

      setError(null);
    } catch (err: any) {
      logger.error('Failed to load My Day feed:', err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMyDayData();
  }, [fetchMyDayData]);

  return {
    needsAction,
    urgentOverdueTasks,
    tasksToday,
    meetingsToday,
    tasksThisWeek,
    expiringDocs,
    recentlyCompleted,
    loading,
    error,
    refetch: fetchMyDayData
  };
}
export default useMyDay;
