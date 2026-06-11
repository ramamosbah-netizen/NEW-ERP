import { supabase } from '@/lib/supabase';
import type { AuditLog, AuditLogFilter } from '@/types/audit.types';

export const auditService = {
  /**
   * Inserts a new immutable audit log entry.
   */
  async logEvent(params: {
    actor_user_id?: string | null;
    action: string;
    entity_type: string;
    entity_id: string;
    entity_label?: string | null;
    summary: string;
    before?: Record<string, any> | null;
    after?: Record<string, any> | null;
    module: string;
    source?: 'UI' | 'API' | 'CRON' | 'WEBHOOK';
  }): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const actorId = params.actor_user_id || user?.id || null;

      // Determine actor role key dynamically if logged in
      let actorRole: string | null = null;
      if (actorId) {
        const { data: roles } = await supabase
          .from('user_roles')
          .select('role:roles(role_key)')
          .eq('user_id', actorId)
          .limit(1);
        
        if (roles && roles.length > 0) {
          actorRole = (roles[0].role as any)?.role_key || null;
        }
      }

      // Fetch IP if client-side (standard IP check API)
      let clientIp: string | null = null;
      if (typeof window !== 'undefined') {
        try {
          const res = await fetch('https://api.ipify.org?format=json');
          if (res.ok) {
            const data = await res.json();
            clientIp = data.ip;
          }
        } catch {
          // ignore ip fetching failures to prevent blocking operations
        }
      }

      const { error } = await supabase
        .from('audit_log')
        .insert({
          actor_user_id: actorId,
          actor_role: actorRole,
          action: params.action,
          entity_type: params.entity_type,
          entity_id: params.entity_id,
          entity_label: params.entity_label || null,
          summary: params.summary,
          before: params.before || null,
          after: params.after || null,
          ip: clientIp,
          source: params.source || 'UI',
          module: params.module
        });

      if (error) throw error;
    } catch (err) {
      console.error('Failed to write audit log entry:', err);
    }
  },

  /**
   * Fetches audit logs with granular filters.
   */
  async getLogs(filters?: AuditLogFilter): Promise<AuditLog[]> {
    let query = supabase
      .from('audit_log')
      .select('*')
      .order('occurred_at', { ascending: false });

    if (filters) {
      if (filters.module) query = query.eq('module', filters.module);
      if (filters.entity_type) query = query.eq('entity_type', filters.entity_type);
      if (filters.entity_id) query = query.eq('entity_id', filters.entity_id);
      if (filters.actor_user_id) query = query.eq('actor_user_id', filters.actor_user_id);
      if (filters.action) query = query.eq('action', filters.action);
      
      if (filters.startDate) query = query.gte('occurred_at', filters.startDate);
      if (filters.endDate) query = query.lte('occurred_at', filters.endDate);
      
      if (filters.search) {
        query = query.or(`summary.ilike.%${filters.search}%,entity_type.ilike.%${filters.search}%,action.ilike.%${filters.search}%`);
      }
    }

    const { data: logs, error } = await query.limit(100);
    if (error) throw error;

    // Resolve actor names via profile join
    const enrichedLogs: AuditLog[] = [];
    for (const log of (logs || [])) {
      let actorName = 'System';
      if (log.actor_user_id) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', log.actor_user_id)
          .maybeSingle();
        if (profile) {
          actorName = profile.full_name;
        }
      }
      enrichedLogs.push({
        ...log,
        actor_name: actorName
      });
    }

    return enrichedLogs;
  }
};

export default auditService;
