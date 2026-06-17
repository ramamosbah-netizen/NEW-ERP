// ============================================================
// Aura ERP — Testing & Commissioning Packages Hook (React Query)
// ============================================================

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { tcService } from '@/services/tcService';
import type { TCScriptTemplate, WitnessRequired } from '@/types/tc.types';

const tcKeys = {
  packages: (pid: string) => ['tc', 'packages', pid] as const,
  templates: ['tc', 'templates'] as const,
};

export function useTCPackages(projectId?: string) {
  const qc = useQueryClient();

  const packagesQ = useQuery({
    queryKey: tcKeys.packages(projectId ?? ''),
    enabled: !!projectId,
    queryFn: () => tcService.getPackagesByProject(projectId!),
  });

  const templatesQ = useQuery({
    queryKey: tcKeys.templates,
    queryFn: async () => {
      const { data, error } = await supabase.from('tc_script_templates').select('*').order('name', { ascending: true });
      if (error) throw error;
      return (data || []) as TCScriptTemplate[];
    },
  });

  const createPackage = async (params: {
    system: string;
    title: string;
    assigned_engineer_id?: string;
    witness_required: WitnessRequired;
    notes?: string;
    templateId?: string;
  }) => {
    if (!projectId) throw new Error('Project ID is required to create a package');
    const newPkg = await tcService.createPackage({ project_id: projectId, ...params });
    await qc.invalidateQueries({ queryKey: tcKeys.packages(projectId) });
    return newPkg;
  };

  return {
    packages: packagesQ.data ?? [],
    templates: templatesQ.data ?? [],
    loading: packagesQ.isPending,
    error: ((packagesQ.error || templatesQ.error) as Error | null) ?? null,
    refetch: packagesQ.refetch,
    createPackage,
  };
}

export default useTCPackages;
