// ============================================================
// JEET ERP — Testing & Commissioning Execution Hook
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import { tcService } from '@/services/tcService';
import { deviceImportService } from '@/services/deviceImportService';
import { tcReportPDFService } from '@/services/tcReportPDFService';
import { TCPackage, TCTestScript, TCDevice, TCTestResult } from '@/types/tc.types';

export function useTCExecution(packageId: string) {
  const [pkg, setPkg] = useState<TCPackage | null>(null);
  const [scripts, setScripts] = useState<TCTestScript[]>([]);
  const [devices, setDevices] = useState<TCDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchDetails = useCallback(async () => {
    if (!packageId) return;
    try {
      setLoading(true);
      const pkgData = await tcService.getPackageById(packageId);
      const scriptData = await tcService.getTestScripts(packageId);
      const deviceData = await tcService.getDevices(packageId);
      
      setPkg(pkgData);
      setScripts(scriptData);
      setDevices(deviceData);
      setError(null);
    } catch (err: any) {
      console.error('Error fetching T&C execution details:', err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [packageId]);

  useEffect(() => {
    fetchDetails();
  }, [packageId, fetchDetails]);

  const logTestResult = async (params: {
    script_id: string;
    device_id?: string;
    result: 'PASS' | 'FAIL' | 'NA';
    measured_value?: string;
    photo_paths?: string[];
    retest_of_id?: string;
    measuring_instrument_id?: string;
  }) => {
    try {
      const res = await tcService.logTestResult(params);
      await fetchDetails();
      return res;
    } catch (err: any) {
      console.error('Failed to log test result:', err);
      throw err;
    }
  };

  const scheduleWitness = async (witnessDate: string) => {
    try {
      const updated = await tcService.scheduleWitness(packageId, witnessDate);
      await fetchDetails();
      return updated;
    } catch (err: any) {
      console.error('Failed to schedule witness:', err);
      throw err;
    }
  };

  const submitWitnessSignOff = async (params: {
    witness_stage: 'INTERNAL' | 'CONSULTANT' | 'CLIENT';
    witness_name: string;
    designation: string;
    company: string;
    signature_path?: string;
    result: 'APPROVED' | 'APPROVED_WITH_COMMENTS' | 'REJECTED';
    comments?: string;
  }) => {
    try {
      const res = await tcService.submitWitnessSignOff({
        package_id: packageId,
        ...params
      });
      await fetchDetails();
      return res;
    } catch (err: any) {
      console.error('Failed to submit witness sign-off:', err);
      throw err;
    }
  };

  const importDevices = async (pasteText: string) => {
    try {
      const res = await deviceImportService.importDevices(packageId, pasteText);
      await fetchDetails();
      return res;
    } catch (err: any) {
      console.error('Failed to paste-import devices:', err);
      throw err;
    }
  };

  const generateTCReport = async () => {
    try {
      return await tcReportPDFService.generateAndFileTCReport(packageId);
    } catch (err: any) {
      console.error('Failed to compile T&C report PDF:', err);
      throw err;
    }
  };

  return {
    pkg,
    scripts,
    devices,
    loading,
    error,
    refetch: fetchDetails,
    logTestResult,
    scheduleWitness,
    submitWitnessSignOff,
    importDevices,
    generateTCReport
  };
}

export default useTCExecution;
// 
