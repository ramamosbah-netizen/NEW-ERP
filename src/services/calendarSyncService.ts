// ============================================================
// JEET ERP — Google Calendar Synchronization client
// Interacts with Supabase Edge Functions for token refresh and API pushes
// ============================================================

import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';

export const calendarSyncService = {
  /**
   * Syncs a meeting detail change to Google Calendars (under feature flag).
   */
  async syncMeeting(meetingId: string, action: 'create' | 'update' | 'cancel'): Promise<boolean> {
    try {
      // 1. Invoke OAuth background sync edge function
      const { data, error } = await supabase.functions.invoke('calendar-sync', {
        body: {
          meeting_id: meetingId,
          sync_action: action
        }
      });

      if (error) {
        logger.warn('Google Calendar synchronization bypassed or failed:', error.message);
        return false; // non-blocking sync failure
      }

      return data?.success || false;
    } catch (err) {
      logger.warn('Google Calendar integration connection failure (non-blocking):', err);
      return false;
    }
  },

  /**
   * Triggers the user authorization setup flow redirect.
   */
  async getAuthUrl(provider = 'google'): Promise<string | null> {
    const { data: { publicUrl } } = supabase.storage.from('temp').getPublicUrl('dummy'); // mock route
    // Simply return the function route helper pointing to authorization screen
    const { data, error } = await supabase.functions.invoke('calendar-sync', {
      body: { action: 'get-auth-url', redirect_back: window.location.href }
    });
    if (error) return null;
    return data?.auth_url || null;
  }
};
export default calendarSyncService;
