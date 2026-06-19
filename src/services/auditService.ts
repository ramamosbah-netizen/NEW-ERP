import { logger } from '@/lib/logger';
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
      logger.error('Failed to write audit log entry:', err);
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
  },

  // --- Audit Center: investigation helpers (read-only over the same ledger) ---

  /**
   * Users available as investigation subjects (anyone with a profile).
   * Reused for the actor-timeline picker.
   */
  async getActors(): Promise<{ id: string; name: string; role: string | null }[]> {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, role')
      .order('full_name');
    if (error) throw error;
    const rows = (data || []) as { id: string; full_name: string | null; role: string | null }[];
    return rows.map(p => ({
      id: p.id,
      name: p.full_name || 'Unknown user',
      role: p.role || null,
    }));
  },

  /**
   * Finds entities in the trail by label / summary text, or by exact id.
   * Returns one row per distinct entity (most-recent first) so an investigator
   * can pick a subject without typing a UUID.
   */
  async searchEntities(term: string): Promise<
    { entity_type: string; entity_id: string; entity_label: string | null; module: string; last_at: string; events: number }[]
  > {
    const t = term.trim();
    if (!t) return [];
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(t);

    let query = supabase
      .from('audit_log')
      .select('entity_type, entity_id, entity_label, module, occurred_at')
      .order('occurred_at', { ascending: false })
      .limit(500);

    query = isUuid
      ? query.eq('entity_id', t)
      : query.or(`entity_label.ilike.%${t}%,summary.ilike.%${t}%,entity_type.ilike.%${t}%`);

    const { data, error } = await query;
    if (error) throw error;

    const map = new Map<string, { entity_type: string; entity_id: string; entity_label: string | null; module: string; last_at: string; events: number }>();
    const searchRows = (data || []) as { entity_type: string; entity_id: string; entity_label: string | null; module: string; occurred_at: string }[];
    for (const r of searchRows) {
      const existing = map.get(r.entity_id);
      if (existing) { existing.events++; continue; }
      map.set(r.entity_id, {
        entity_type: r.entity_type,
        entity_id: r.entity_id,
        entity_label: r.entity_label,
        module: r.module,
        last_at: r.occurred_at,
        events: 1,
      });
    }
    return Array.from(map.values()).slice(0, 50);
  },

  /**
   * Full chronological history for one subject (an entity or an actor),
   * oldest-first, with actor names batch-resolved.
   */
  async getTimeline(opts: { entityId?: string; actorId?: string }, limit = 500): Promise<AuditLog[]> {
    if (!opts.entityId && !opts.actorId) return [];
    let query = supabase
      .from('audit_log')
      .select('*')
      .order('occurred_at', { ascending: true })
      .limit(limit);
    if (opts.entityId) query = query.eq('entity_id', opts.entityId);
    if (opts.actorId) query = query.eq('actor_user_id', opts.actorId);

    const { data, error } = await query;
    if (error) throw error;
    const rows = (data || []) as AuditLog[];

    const ids = Array.from(new Set(rows.map(r => r.actor_user_id).filter(Boolean))) as string[];
    const names = new Map<string, string>();
    if (ids.length) {
      const { data: profs } = await supabase.from('profiles').select('id, full_name').in('id', ids);
      ((profs || []) as { id: string; full_name: string }[]).forEach(p => names.set(p.id, p.full_name));
    }
    return rows.map(r => ({
      ...r,
      actor_name: r.actor_user_id ? (names.get(r.actor_user_id) || 'Unknown user') : 'System',
    }));
  },
};

export default auditService;
