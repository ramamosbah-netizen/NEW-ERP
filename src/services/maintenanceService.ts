import { supabase } from '@/lib/supabase';
import type { VehicleMaintenance } from '@/types/fleet.types';

export const maintenanceService = {
  /**
   * Fetches all vehicle maintenance logs, including vehicle details.
   */
  async getMaintenanceLogs(): Promise<VehicleMaintenance[]> {
    const { data, error } = await supabase
      .from('vehicle_maintenance')
      .select(`
        *,
        vehicles:vehicle_id (
          vehicle_code,
          plate_number
        )
      `)
      .order('service_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data || []).map(row => ({
      ...row,
      vehicle_code: row.vehicles?.vehicle_code,
      plate_number: row.vehicles?.plate_number
    })) as VehicleMaintenance[];
  },

  /**
   * Fetches maintenance logs for a specific vehicle.
   */
  async getMaintenanceLogsByVehicleId(vehicleId: string): Promise<VehicleMaintenance[]> {
    const { data, error } = await supabase
      .from('vehicle_maintenance')
      .select(`
        *,
        vehicles:vehicle_id (
          vehicle_code,
          plate_number
        )
      `)
      .eq('vehicle_id', vehicleId)
      .order('service_date', { ascending: false });

    if (error) throw error;

    return (data || []).map(row => ({
      ...row,
      vehicle_code: row.vehicles?.vehicle_code,
      plate_number: row.vehicles?.plate_number
    })) as VehicleMaintenance[];
  },

  /**
   * Creates a new vehicle maintenance log. Syncs vehicle odometer if completed.
   */
  async createMaintenanceLog(log: Omit<VehicleMaintenance, 'id' | 'created_at' | 'updated_at'>): Promise<VehicleMaintenance> {
    const { data, error } = await supabase
      .from('vehicle_maintenance')
      .insert(log)
      .select()
      .single();

    if (error) throw error;

    if (log.status === 'COMPLETED') {
      await this.syncVehicleOdometer(log.vehicle_id, log.odometer_km);
    }

    return data as VehicleMaintenance;
  },

  /**
   * Updates an existing maintenance log. Syncs vehicle odometer if status shifts to completed.
   */
  async updateMaintenanceLog(id: string, updates: Partial<VehicleMaintenance>): Promise<VehicleMaintenance> {
    const { data, error } = await supabase
      .from('vehicle_maintenance')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    if (updates.status === 'COMPLETED' && updates.odometer_km) {
      await this.syncVehicleOdometer(data.vehicle_id, updates.odometer_km);
    }

    return data as VehicleMaintenance;
  },

  /**
   * Internal helper to update a vehicle's odometer reading if the maintenance log shows a higher mileage.
   */
  async syncVehicleOdometer(vehicleId: string, odometerKm: number): Promise<void> {
    const { data: vehicle } = await supabase
      .from('vehicles')
      .select('odometer_km')
      .eq('id', vehicleId)
      .single();

    if (vehicle && odometerKm > vehicle.odometer_km) {
      await supabase
        .from('vehicles')
        .update({
          odometer_km: odometerKm,
          updated_at: new Date().toISOString()
        })
        .eq('id', vehicleId);
    }
  }
};
export default maintenanceService;
