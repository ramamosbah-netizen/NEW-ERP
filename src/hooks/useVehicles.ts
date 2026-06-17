// ============================================================
// Aura ERP — Fleet Vehicle React Hooks (React Query)
// ============================================================

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { vehicleService } from '@/services/vehicleService';
import { fineService } from '@/services/fineService';
import { fuelService } from '@/services/fuelService';
import { maintenanceService } from '@/services/maintenanceService';
import type { Vehicle } from '@/types/fleet.types';

const vehKeys = {
  lists: ['vehicles', 'list'] as const,
  detail: (id: string) => ['vehicles', 'detail', id] as const,
};

export function useVehicles() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: vehKeys.lists, queryFn: () => vehicleService.getVehicles() });

  const createVehicle = async (vehicleData: any) => {
    const res = await vehicleService.createVehicle(vehicleData);
    await qc.invalidateQueries({ queryKey: vehKeys.lists });
    return res;
  };

  return {
    vehicles: q.data ?? [],
    loading: q.isPending,
    error: (q.error as Error | null) ?? null,
    refetch: q.refetch,
    createVehicle,
  };
}

export function useVehicle(vehicleId?: string) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: vehKeys.detail(vehicleId ?? ''),
    enabled: !!vehicleId,
    queryFn: async () => {
      const [vehicle, assignments, fines, fuelLogs, maintenance] = await Promise.all([
        vehicleService.getVehicleById(vehicleId!),
        vehicleService.getAssignments(vehicleId!),
        fineService.getFinesByVehicleId(vehicleId!),
        fuelService.getFuelLogsByVehicleId(vehicleId!),
        maintenanceService.getMaintenanceLogsByVehicleId(vehicleId!),
      ]);
      return { vehicle, assignments, fines, fuelLogs, maintenance };
    },
  });

  const inv = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: vehKeys.detail(vehicleId ?? '') }),
      qc.invalidateQueries({ queryKey: vehKeys.lists }),
    ]);
  };

  const updateProfile = async (updates: Partial<Vehicle>) => { if (!vehicleId) return; const res = await vehicleService.updateVehicle(vehicleId, updates); await inv(); return res; };
  const deleteVehicle = async () => { if (!vehicleId) return; await vehicleService.deleteVehicle(vehicleId); await qc.invalidateQueries({ queryKey: vehKeys.lists }); };
  const assignDriver = async (params: any) => { if (!vehicleId) return; const res = await vehicleService.assignVehicle({ ...params, vehicle_id: vehicleId }); await inv(); return res; };
  const endDriverAssignment = async (assignmentId: string, returnOdometer: number, conditionNotes?: string | null, signaturePath?: string | null) => { await vehicleService.endAssignment(assignmentId, returnOdometer, conditionNotes, signaturePath); await inv(); };
  const addFuelLog = async (params: any) => { if (!vehicleId) return; const res = await fuelService.createFuelLog({ ...params, vehicle_id: vehicleId }); await inv(); return res; };
  const addMaintenanceLog = async (params: any) => { if (!vehicleId) return; const res = await maintenanceService.createMaintenanceLog({ ...params, vehicle_id: vehicleId }); await inv(); return res; };
  const updateMaintenanceLog = async (maintId: string, updates: any) => { const res = await maintenanceService.updateMaintenanceLog(maintId, updates); await inv(); return res; };

  return {
    vehicle: q.data?.vehicle ?? null,
    assignments: q.data?.assignments ?? [],
    fines: q.data?.fines ?? [],
    fuelLogs: q.data?.fuelLogs ?? [],
    maintenance: q.data?.maintenance ?? [],
    loading: q.isLoading,
    error: (q.error as Error | null) ?? null,
    refetch: q.refetch,
    updateProfile,
    deleteVehicle,
    assignDriver,
    endDriverAssignment,
    addFuelLog,
    addMaintenanceLog,
    updateMaintenanceLog,
  };
}

export default useVehicles;
