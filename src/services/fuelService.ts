import { supabase } from '@/lib/supabase';
import type { FuelLog } from '@/types/fleet.types';
import { eventService } from './eventService';

export const fuelService = {
  /**
   * Fetches all fuel logs from the database, including vehicle, driver, and project details.
   */
  async getFuelLogs(): Promise<FuelLog[]> {
    const { data, error } = await supabase
      .from('fuel_logs')
      .select(`
        *,
        vehicles:vehicle_id (
          vehicle_code,
          plate_number
        ),
        employees:driver_id (
          full_name_en
        ),
        projects:project_id (
          name
        )
      `)
      .order('log_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data || []).map(row => ({
      ...row,
      vehicle_code: row.vehicles?.vehicle_code,
      plate_number: row.vehicles?.plate_number,
      driver_name: row.employees?.full_name_en,
      project_name: row.projects?.name
    })) as FuelLog[];
  },

  /**
   * Fetches fuel logs for a specific vehicle.
   */
  async getFuelLogsByVehicleId(vehicleId: string): Promise<FuelLog[]> {
    const { data, error } = await supabase
      .from('fuel_logs')
      .select(`
        *,
        vehicles:vehicle_id (
          vehicle_code,
          plate_number
        ),
        employees:driver_id (
          full_name_en
        ),
        projects:project_id (
          name
        )
      `)
      .eq('vehicle_id', vehicleId)
      .order('log_date', { ascending: false })
      .order('odometer_km', { ascending: false });

    if (error) throw error;

    return (data || []).map(row => ({
      ...row,
      vehicle_code: row.vehicles?.vehicle_code,
      plate_number: row.vehicles?.plate_number,
      driver_name: row.employees?.full_name_en,
      project_name: row.projects?.name
    })) as FuelLog[];
  },

  /**
   * Logs a new fuel fill-up, computes efficiency, checks for rolling anomalies, and updates vehicle mileage.
   */
  async createFuelLog(log: Omit<FuelLog, 'id' | 'efficiency_km_l' | 'is_anomaly' | 'created_at'>): Promise<FuelLog> {
    const now = new Date().toISOString();

    // 1. Get the last odometer reading for this vehicle prior to the current log
    const { data: prevLogs, error: prevErr } = await supabase
      .from('fuel_logs')
      .select('odometer_km')
      .eq('vehicle_id', log.vehicle_id)
      .lt('odometer_km', log.odometer_km)
      .order('odometer_km', { ascending: false })
      .limit(1);

    if (prevErr) throw prevErr;

    let efficiency = 0;
    if (prevLogs && prevLogs.length > 0) {
      const diffKm = log.odometer_km - prevLogs[0].odometer_km;
      efficiency = Math.round((diffKm / log.litres) * 100) / 100;
    }

    // 2. Compute anomaly status (deviation >30% from rolling baseline of last 5 fuel logs)
    let isAnomaly = false;
    let baselineVal = 0;
    let deviationVal = 0;

    // Fetch the last 5 logs for this vehicle to compute baseline
    const { data: baselineLogs, error: baseErr } = await supabase
      .from('fuel_logs')
      .select('efficiency_km_l')
      .eq('vehicle_id', log.vehicle_id)
      .gt('efficiency_km_l', 0) // exclude first logs with 0 efficiency
      .order('log_date', { ascending: false })
      .order('odometer_km', { ascending: false })
      .limit(5);

    if (baseErr) throw baseErr;

    if (efficiency > 0 && baselineLogs && baselineLogs.length >= 2) {
      const sum = baselineLogs.reduce((acc, row) => acc + Number(row.efficiency_km_l), 0);
      baselineVal = sum / baselineLogs.length;
      deviationVal = Math.round((Math.abs(efficiency - baselineVal) / baselineVal) * 100);
      
      // If consumption (which is litres/km or inversely km/L) deviates by >30%
      if (deviationVal > 30) {
        isAnomaly = true;
      }
    }

    // 3. Write fuel log record
    const { data: newLog, error: insertErr } = await supabase
      .from('fuel_logs')
      .insert({
        ...log,
        efficiency_km_l: efficiency,
        is_anomaly: isAnomaly
      })
      .select()
      .single();

    if (insertErr) throw insertErr;

    // 4. Update vehicle's odometer (if this log's odometer is greater than current)
    const { data: vehicle } = await supabase
      .from('vehicles')
      .select('odometer_km, plate_number, vehicle_code')
      .eq('id', log.vehicle_id)
      .single();

    if (vehicle && log.odometer_km > vehicle.odometer_km) {
      await supabase
        .from('vehicles')
        .update({
          odometer_km: log.odometer_km,
          updated_at: now
        })
        .eq('id', log.vehicle_id);
    }

    // 5. Emit Event if fuel anomaly detected
    if (isAnomaly && vehicle) {
      await eventService.emitEvent(
        'fleet.fuel_anomaly',
        'VEHICLE',
        log.vehicle_id,
        log.project_id || undefined,
        {
          vehicle_code: vehicle.vehicle_code,
          plate_number: vehicle.plate_number,
          efficiency: efficiency.toFixed(2),
          baseline: baselineVal.toFixed(2),
          deviation: deviationVal.toString()
        }
      );
    }

    return newLog as FuelLog;
  }
};
export default fuelService;
