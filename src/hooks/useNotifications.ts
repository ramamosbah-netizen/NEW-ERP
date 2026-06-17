// ============================================================
// JEET ERP — Notifications Hook (Realtime-enabled)
// Subscribes to notifications table and alerts bell on insertion
// ============================================================

import { logger } from '@/lib/logger';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { notificationService } from '@/services/notificationService';
import type { Notification } from '@/types/notification.types';

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchList = useCallback(async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const data = await notificationService.fetchNotifications(user.id);
      setNotifications(data);
      setError(null);
    } catch (err: any) {
      logger.error('Error fetching notifications:', err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchList();

    // Subscribe to Supabase Realtime for notifications
    let active = true;
    let channel: any;
    
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user || !active) return;

      const channelId = Math.random().toString(36).substring(2, 9);
      channel = supabase
        .channel(`user-notifications-${user.id}-${channelId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`
          },
          (payload: any) => {
            if (!active) return;
            if (payload.eventType === 'INSERT') {
              setNotifications(prev => [payload.new as Notification, ...prev]);
            } else if (payload.eventType === 'UPDATE') {
              setNotifications(prev =>
                prev.map(n => n.id === payload.new.id ? (payload.new as Notification) : n)
              );
            } else if (payload.eventType === 'DELETE') {
              setNotifications(prev => prev.filter(n => n.id !== payload.old.id));
            }
          }
        );

      channel.subscribe((status: string) => {
        if (!active && status === 'SUBSCRIBED') {
          supabase.removeChannel(channel);
        }
      });
    });

    return () => {
      active = false;
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [fetchList]);

  const markRead = async (id: string, actioned = false) => {
    await notificationService.markAsRead(id, actioned);
    // State will be updated by Realtime trigger, but we sync locally for speed
    setNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, status: actioned ? 'ACTIONED' : 'READ', read_at: new Date().toISOString() } : n)
    );
  };

  const markAllRead = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await notificationService.markAllAsRead(user.id);
    setNotifications(prev =>
      prev.map(n => ['PENDING', 'SENT', 'DELIVERED'].includes(n.status) ? { ...n, status: 'READ', read_at: new Date().toISOString() } : n)
    );
  };

  const unreadCount = notifications.filter(n => ['PENDING', 'SENT', 'DELIVERED'].includes(n.status)).length;

  return {
    notifications,
    unreadCount,
    loading,
    error,
    refetch: fetchList,
    markRead,
    markAllRead
  };
}
export default useNotifications;
