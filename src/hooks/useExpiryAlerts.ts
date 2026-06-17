// ============================================================
// Aura ERP — Document Expiry Alerts React Hook (React Query)
// ============================================================

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { DocumentExpiryAlert } from '@/types/document.types';

const alertsKey = ['document-expiry-alerts'] as const;

export function useExpiryAlerts() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: alertsKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('document_expiry_alerts')
        .select('*, document:documents(title, original_filename, category, subcategory, entity_type, entity_id)')
        .eq('status', 'PENDING')
        .order('expiry_date', { ascending: true });
      if (error) throw error;
      return (data || []) as DocumentExpiryAlert[];
    },
  });

  const alerts = q.data ?? [];

  const acknowledgeAlert = async (alertId: string) => {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) throw new Error('Authentication required');
    const { error } = await supabase
      .from('document_expiry_alerts')
      .update({ status: 'ACKNOWLEDGED', acknowledged_by: user.id, acknowledged_at: new Date().toISOString() })
      .eq('id', alertId);
    if (error) throw error;
    await qc.invalidateQueries({ queryKey: alertsKey });
    return true;
  };

  const getGroupedAlerts = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const groups = {
      expired: [] as DocumentExpiryAlert[],
      within7d: [] as DocumentExpiryAlert[],
      within30d: [] as DocumentExpiryAlert[],
      within60d: [] as DocumentExpiryAlert[],
      within90d: [] as DocumentExpiryAlert[],
    };
    alerts.forEach((alert) => {
      const expDate = new Date(alert.expiry_date);
      expDate.setHours(0, 0, 0, 0);
      const diffDays = Math.ceil((expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays < 0) groups.expired.push(alert);
      else if (diffDays <= 7) groups.within7d.push(alert);
      else if (diffDays <= 30) groups.within30d.push(alert);
      else if (diffDays <= 60) groups.within60d.push(alert);
      else if (diffDays <= 90) groups.within90d.push(alert);
    });
    return groups;
  };

  return {
    alerts,
    groupedAlerts: getGroupedAlerts(),
    loading: q.isPending,
    error: (q.error as Error | null) ?? null,
    refetch: q.refetch,
    acknowledgeAlert,
  };
}
