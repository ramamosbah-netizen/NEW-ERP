// ============================================================
// JEET ERP — Project Master Live Activity Stream Hook
// Realtime updates to project status history audits
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { ProjectStatusHistory } from '@/types/project.types';

export function useProjectActivity(projectId: string) {
  const [activities, setActivities] = useState<ProjectStatusHistory[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch initial activity list
  const fetchActivities = useCallback(async () => {
    if (!projectId) return;
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('project_status_history')
        .select('*')
        .eq('project_id', projectId)
        .order('changed_at', { ascending: false });

      if (error) throw error;

      // Resolve profiles for all history records
      const resolved = await Promise.all(
        (data || []).map(async (act) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', act.changed_by)
            .single();
          
          return {
            ...act,
            changed_by_name: profile?.full_name || 'System User'
          };
        })
      );

      setActivities(resolved);
    } catch (err) {
      console.error('Failed to fetch project activities:', err);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

  // Set up Supabase Realtime subscription for INSERTs on status history
  useEffect(() => {
    if (!projectId) return;

    const channelId = Math.random().toString(36).substring(2, 9);
    const channel = supabase
      .channel(`project-activity-${projectId}-${channelId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'project_status_history',
          filter: `project_id=eq.${projectId}`
        },
        async (payload) => {
          const newRecord = payload.new as ProjectStatusHistory;
          
          // Resolve name for the new log row
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', newRecord.changed_by)
            .single();
          
          const completeRecord = {
            ...newRecord,
            changed_by_name: profile?.full_name || 'System User'
          };

          setActivities((prev) => [completeRecord, ...prev]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId]);

  return { activities, loading, refetch: fetchActivities };
}
