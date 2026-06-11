// ============================================================
// JEET ERP — Testing & Commissioning Packages Hook
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { tcService } from '@/services/tcService';
import { TCPackage, TCScriptTemplate, WitnessRequired } from '@/types/tc.types';

export function useTCPackages(projectId?: string) {
  const [packages, setPackages] = useState<TCPackage[]>([]);
  const [templates, setTemplates] = useState<TCScriptTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchPackages = useCallback(async () => {
    if (!projectId) return;
    try {
      setLoading(true);
      const data = await tcService.getPackagesByProject(projectId);
      setPackages(data);
      setError(null);
    } catch (err: any) {
      console.error('Error fetching T&C packages:', err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  const fetchTemplates = useCallback(async () => {
    try {
      const { data, error: tErr } = await supabase
        .from('tc_script_templates')
        .select('*')
        .order('name', { ascending: true });

      if (tErr) throw tErr;
      setTemplates(data as TCScriptTemplate[]);
    } catch (err: any) {
      console.error('Error fetching script templates:', err);
    }
  }, []);

  useEffect(() => {
    if (projectId) {
      fetchPackages();
    }
    fetchTemplates();
  }, [projectId, fetchPackages, fetchTemplates]);

  const createPackage = async (params: {
    system: string;
    title: string;
    assigned_engineer_id?: string;
    witness_required: WitnessRequired;
    notes?: string;
    templateId?: string;
  }) => {
    if (!projectId) throw new Error('Project ID is required to create a package');
    try {
      const newPkg = await tcService.createPackage({
        project_id: projectId,
        ...params
      });
      await fetchPackages();
      return newPkg;
    } catch (err: any) {
      console.error('Failed to create T&C package:', err);
      throw err;
    }
  };

  return {
    packages,
    templates,
    loading,
    error,
    refetch: fetchPackages,
    createPackage
  };
}

export default useTCPackages;
