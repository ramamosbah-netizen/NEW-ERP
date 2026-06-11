// ============================================================
// JEET ERP — Document Expiry Alerts React Hook
// Fetches, groups, and acknowledges expiry alert records
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { DocumentExpiryAlert } from '@/types/document.types';

export function useExpiryAlerts() {
  const [alerts, setAlerts] = useState<DocumentExpiryAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchAlerts = useCallback(async () => {
    try {
      setLoading(true);
      // Fetch alerts along with inner document title and details
      const { data, error: fetchErr } = await supabase
        .from('document_expiry_alerts')
        .select('*, document:documents(title, original_filename, category, subcategory, entity_type, entity_id)')
        .eq('status', 'PENDING')
        .order('expiry_date', { ascending: true });

      if (fetchErr) throw fetchErr;
      setAlerts(data || []);
      setError(null);
    } catch (err: any) {
      console.error('Error fetching expiry alerts:', err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  // Acknowledge alert
  const acknowledgeAlert = async (alertId: string) => {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) throw new Error('Authentication required');

    const { error: ackErr } = await supabase
      .from('document_expiry_alerts')
      .update({
        status: 'ACKNOWLEDGED',
        acknowledged_by: user.id,
        acknowledged_at: new Date().toISOString()
      })
      .eq('id', alertId);

    if (ackErr) throw ackErr;

    // Refresh list
    await fetchAlerts();
    return true;
  };

  // Group alerts by time window (expired, 7d, 30d, 60d, 90d)
  const getGroupedAlerts = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const groups = {
      expired: [] as DocumentExpiryAlert[],
      within7d: [] as DocumentExpiryAlert[],
      within30d: [] as DocumentExpiryAlert[],
      within60d: [] as DocumentExpiryAlert[],
      within90d: [] as DocumentExpiryAlert[]
    };

    alerts.forEach((alert) => {
      const expDate = new Date(alert.expiry_date);
      expDate.setHours(0, 0, 0, 0);
      const diffTime = expDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays < 0) {
        groups.expired.push(alert);
      } else if (diffDays <= 7) {
        groups.within7d.push(alert);
      } else if (diffDays <= 30) {
        groups.within30d.push(alert);
      } else if (diffDays <= 60) {
        groups.within60d.push(alert);
      } else if (diffDays <= 90) {
        groups.within90d.push(alert);
      }
    });

    return groups;
  };

  return {
    alerts,
    groupedAlerts: getGroupedAlerts(),
    loading,
    error,
    refetch: fetchAlerts,
    acknowledgeAlert
  };
}
