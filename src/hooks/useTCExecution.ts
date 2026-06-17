// ============================================================
// Aura ERP — Testing & Commissioning Execution Hook (React Query)
// ============================================================

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { tcService } from '@/services/tcService';
import { deviceImportService } from '@/services/deviceImportService';
import { tcReportPDFService } from '@/services/tcReportPDFService';

const tcExecKey = (id: string) => ['tc-execution', id] as const;

export function useTCExecution(packageId: string) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: tcExecKey(packageId),
    enabled: !!packageId,
    queryFn: async () => {
      const [pkg, scripts, devices] = await Promise.all([
        tcService.getPackageById(packageId),
        tcService.getTestScripts(packageId),
        tcService.getDevices(packageId),
      ]);
      return { pkg, scripts, devices };
    },
  });

  const inv = () => qc.invalidateQueries({ queryKey: tcExecKey(packageId) });

  const logTestResult = async (params: {
    script_id: string; device_id?: string; result: 'PASS' | 'FAIL' | 'NA';
    measured_value?: string; photo_paths?: string[]; retest_of_id?: string; measuring_instrument_id?: string;
  }) => { const res = await tcService.logTestResult(params); await inv(); return res; };

  const scheduleWitness = async (witnessDate: string) => { const u = await tcService.scheduleWitness(packageId, witnessDate); await inv(); return u; };

  const submitWitnessSignOff = async (params: {
    witness_stage: 'INTERNAL' | 'CONSULTANT' | 'CLIENT'; witness_name: string; designation: string;
    company: string; signature_path?: string; result: 'APPROVED' | 'APPROVED_WITH_COMMENTS' | 'REJECTED'; comments?: string;
  }) => { const res = await tcService.submitWitnessSignOff({ package_id: packageId, ...params }); await inv(); return res; };

  const importDevices = async (pasteText: string) => { const res = await deviceImportService.importDevices(packageId, pasteText); await inv(); return res; };
  const generateTCReport = async () => tcReportPDFService.generateAndFileTCReport(packageId);

  return {
    pkg: q.data?.pkg ?? null,
    scripts: q.data?.scripts ?? [],
    devices: q.data?.devices ?? [],
    loading: q.isPending,
    error: (q.error as Error | null) ?? null,
    refetch: q.refetch,
    logTestResult,
    scheduleWitness,
    submitWitnessSignOff,
    importDevices,
    generateTCReport,
  };
}

export default useTCExecution;
