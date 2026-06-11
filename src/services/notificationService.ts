// ============================================================
// JEET ERP — Notification Engine Service
// Handles client-side notification fetching, updates, and user preferences
// ============================================================

import { supabase } from '@/lib/supabase';
import type { Notification, UserNotificationPreference, NotificationPreferenceMode, NotificationChannel } from '@/types/notification.types';

export const notificationService = {
  /**
   * Fetches unread or all notifications for the active user.
   */
  async fetchNotifications(userId: string, limit = 50, onlyUnread = false): Promise<Notification[]> {
    let query = supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (onlyUnread) {
      query = query.in('status', ['PENDING', 'SENT', 'DELIVERED']);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data || []) as Notification[];
  },

  /**
   * Marks a specific notification as READ/ACTIONED.
   */
  async markAsRead(notificationId: string, actioned = false): Promise<boolean> {
    const status = actioned ? 'ACTIONED' : 'READ';
    const updatePayload: any = {
      status,
      read_at: new Date().toISOString()
    };
    if (actioned) {
      updatePayload.actioned_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from('notifications')
      .update(updatePayload)
      .eq('id', notificationId);

    if (error) throw error;
    return true;
  },

  /**
   * Marks all pending/unread notifications for a user as READ.
   */
  async markAllAsRead(userId: string): Promise<boolean> {
    const { error } = await supabase
      .from('notifications')
      .update({
        status: 'READ',
        read_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .in('status', ['PENDING', 'SENT', 'DELIVERED']);

    if (error) throw error;
    return true;
  },

  /**
   * Fetches the notification preference matrix for a user.
   */
  async fetchPreferences(userId: string): Promise<UserNotificationPreference[]> {
    const { data, error } = await supabase
      .from('user_notification_preferences')
      .select('*')
      .eq('user_id', userId);

    if (error) throw error;
    return (data || []) as UserNotificationPreference[];
  },

  /**
   * Updates or inserts a user notification preference.
   */
  async updatePreference(
    userId: string,
    eventModule: string,
    channel: NotificationChannel,
    mode: NotificationPreferenceMode
  ): Promise<boolean> {
    const { error } = await supabase
      .from('user_notification_preferences')
      .upsert({
        user_id: userId,
        event_module: eventModule,
        channel,
        mode
      });

    if (error) throw error;
    return true;
  }
};
export default notificationService;
