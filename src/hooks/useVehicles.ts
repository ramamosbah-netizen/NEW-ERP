import { useState, useEffect, useCallback } from 'react';
import { vehicleService } from '@/services/vehicleService';
import { fineService } from '@/services/fineService';
import { fuelService } from '@/services/fuelService';
import { maintenanceService } from '@/services/maintenanceService';
import type { Vehicle, VehicleAssignment, VehicleFine, FuelLog, VehicleMaintenance } from '@/types/fleet.types';

export function useVehicles() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchVehicles = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await vehicleService.getVehicles();
      setVehicles(data);
    } catch (err: any) {
      console.error('Failed to load vehicles:', err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchVehicles();
  }, [fetchVehicles]);

  const createVehicle = async (vehicleData: any) => {
    const res = await vehicleService.createVehicle(vehicleData);
    await fetchVehicles();
    return res;
  };

  return {
    vehicles,
    loading,
    error,
    refetch: fetchVehicles,
    createVehicle
  };
}

export function useVehicle(vehicleId?: string) {
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [assignments, setAssignments] = useState<VehicleAssignment[]>([]);
  const [fines, setFines] = useState<VehicleFine[]>([]);
  const [fuelLogs, setFuelLogs] = useState<FuelLog[]>([]);
  const [maintenance, setMaintenance] = useState<VehicleMaintenance[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchDetails = useCallback(async () => {
    if (!vehicleId) return;
    try {
      setLoading(true);
      setError(null);

      const [vData, assignData, fineData, fuelData, maintData] = await Promise.all([
        vehicleService.getVehicleById(vehicleId),
        vehicleService.getAssignments(vehicleId),
        fineService.getFinesByVehicleId(vehicleId),
        fuelService.getFuelLogsByVehicleId(vehicleId),
        maintenanceService.getMaintenanceLogsByVehicleId(vehicleId)
      ]);

      setVehicle(vData);
      setAssignments(assignData);
      setFines(fineData);
      setFuelLogs(fuelData);
      setMaintenance(maintData);
    } catch (err: any) {
      console.error(`Failed to load details for vehicle ${vehicleId}:`, err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [vehicleId]);

  useEffect(() => {
    fetchDetails();
  }, [fetchDetails]);

  const updateProfile = async (updates: Partial<Vehicle>) => {
    if (!vehicleId) return;
    const res = await vehicleService.updateVehicle(vehicleId, updates);
    setVehicle(res);
    await fetchDetails();
    return res;
  };

  const deleteVehicle = async () => {
    if (!vehicleId) return;
    await vehicleService.deleteVehicle(vehicleId);
    setVehicle(null);
  };

  const assignDriver = async (params: any) => {
    if (!vehicleId) return;
    const res = await vehicleService.assignVehicle({
      ...params,
      vehicle_id: vehicleId
    });
    await fetchDetails();
    return res;
  };

  const endDriverAssignment = async (assignmentId: string, returnOdometer: number, conditionNotes?: string | null, signaturePath?: string | null) => {
    await vehicleService.endAssignment(assignmentId, returnOdometer, conditionNotes, signaturePath);
    await fetchDetails();
  };

  const addFuelLog = async (params: any) => {
    if (!vehicleId) return;
    const res = await fuelService.createFuelLog({
      ...params,
      vehicle_id: vehicleId
    });
    await fetchDetails();
    return res;
  };

  const addMaintenanceLog = async (params: any) => {
    if (!vehicleId) return;
    const res = await maintenanceService.createMaintenanceLog({
      ...params,
      vehicle_id: vehicleId
    });
    await fetchDetails();
    return res;
  };

  const updateMaintenanceLog = async (maintId: string, updates: any) => {
    const res = await maintenanceService.updateMaintenanceLog(maintId, updates);
    await fetchDetails();
    return res;
  };

  return {
    vehicle,
    assignments,
    fines,
    fuelLogs,
    maintenance,
    loading,
    error,
    refetch: fetchDetails,
    updateProfile,
    deleteVehicle,
    assignDriver,
    endDriverAssignment,
    addFuelLog,
    addMaintenanceLog,
    updateMaintenanceLog
  };
}
export default useVehicles;
