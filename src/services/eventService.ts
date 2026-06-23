// ============================================================
// JEET ERP — Platform Event Bus Service
// Provides single entry point to emit ERP system events
// ============================================================

import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';
import type { SystemEvent } from '@/types/events.types';

export const eventService = {
  /**
   * Emits a system event to the database event bus ledger.
   */
  async emitEvent(
    eventType: string,
    entityType?: string,
    entityId?: string,
    projectId?: string,
    payload: Record<string, any> = {},
    actorUserId?: string,
    companyId?: string,
    eventVersion = 1
  ): Promise<SystemEvent> {
    try {
      // 1. Resolve actor user if not explicitly passed
      let resolvedActorId = actorUserId;
      if (!resolvedActorId) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          resolvedActorId = user.id;
        }
      }

      // 2. Insert event record into ledger
      const { data, error } = await supabase
        .from('system_events')
        .insert({
          event_type: eventType,
          entity_type: entityType || null,
          entity_id: entityId || null,
          project_id: projectId || null,
          payload,
          actor_user_id: resolvedActorId || null,
          company_id: companyId || null,
          event_version: eventVersion
        })
        .select()
        .single();

      if (error) {
        logger.error('Failed to insert system event:', {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
        });
        throw error;
      }

      // Trigger Edge Function call asynchronously to process the event
      // This is dynamic fan-out so it updates UI instantly
      supabase.functions.invoke('process-event', {
        body: { event_id: data.id }
      }).catch(err => {
        logger.error('Asynchronous process-event invoke failed:', err);
      });

      return data as SystemEvent;
    } catch (error) {
      logger.error(`Error emitting event ${eventType}:`, error);
      throw error;
    }
  }
};
export default eventService;
