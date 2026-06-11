import { supabase } from '@/lib/supabase';
import type { VehicleFine } from '@/types/fleet.types';

export const fineService = {
  /**
   * Fetches all traffic fines from the database, including vehicle and driver details.
   */
  async getFines(): Promise<VehicleFine[]> {
    const { data, error } = await supabase
      .from('vehicle_fines')
      .select(`
        *,
        vehicles:vehicle_id (
          vehicle_code,
          plate_number
        ),
        employees:driver_id (
          full_name_en
        )
      `)
      .order('fine_date', { ascending: false });

    if (error) throw error;

    return (data || []).map(row => ({
      ...row,
      vehicle_code: row.vehicles?.vehicle_code,
      plate_number: row.vehicles?.plate_number,
      driver_name: row.employees?.full_name_en
    })) as VehicleFine[];
  },

  /**
   * Fetches traffic fines for a specific vehicle.
   */
  async getFinesByVehicleId(vehicleId: string): Promise<VehicleFine[]> {
    const { data, error } = await supabase
      .from('vehicle_fines')
      .select(`
        *,
        vehicles:vehicle_id (
          vehicle_code,
          plate_number
        ),
        employees:driver_id (
          full_name_en
        )
      `)
      .eq('vehicle_id', vehicleId)
      .order('fine_date', { ascending: false });

    if (error) throw error;

    return (data || []).map(row => ({
      ...row,
      vehicle_code: row.vehicles?.vehicle_code,
      plate_number: row.vehicles?.plate_number,
      driver_name: row.employees?.full_name_en
    })) as VehicleFine[];
  },

  /**
   * Attempts to auto-resolve the active driver for a specific vehicle on a given fine date.
   */
  async resolveDriverForDate(vehicleId: string, fineDate: string): Promise<string | null> {
    // Look for assignments that overlap the fine date.
    // fineDate is a string like YYYY-MM-DD
    const fineStart = `${fineDate}T00:00:00.000Z`;
    const fineEnd = `${fineDate}T23:59:59.999Z`;

    const { data, error } = await supabase
      .from('vehicle_assignments')
      .select('driver_id')
      .eq('vehicle_id', vehicleId)
      .lte('from_date', fineEnd)
      .or(`to_date.is.null,to_date.gte.${fineStart}`)
      .order('from_date', { ascending: false })
      .limit(1);

    if (error) {
      console.warn('Error resolving driver for fine date:', error.message);
      return null;
    }

    if (data && data.length > 0) {
      return data[0].driver_id;
    }

    return null;
  },

  /**
   * Creates a new traffic fine record. Auto-resolves driver if not explicitly provided.
   */
  async createFine(fine: Omit<VehicleFine, 'id' | 'created_at' | 'updated_at'>): Promise<VehicleFine> {
    let resolvedDriverId = fine.driver_id;
    
    // Auto-resolve driver based on date if not explicitly specified
    if (!resolvedDriverId) {
      resolvedDriverId = await this.resolveDriverForDate(fine.vehicle_id, fine.fine_date);
    }

    const { data, error } = await supabase
      .from('vehicle_fines')
      .insert({
        ...fine,
        driver_id: resolvedDriverId
      })
      .select()
      .single();

    if (error) throw error;
    return data as VehicleFine;
  },

  /**
   * Updates fine fields (e.g. status, comments, payment details).
   */
  async updateFine(id: string, updates: Partial<VehicleFine>): Promise<VehicleFine> {
    const { data, error } = await supabase
      .from('vehicle_fines')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as VehicleFine;
  },

  /**
   * Marks a fine as Driver-Liable and posts a pending deduction adjustment to Phase 7 Employee Payroll.
   */
  async markFineDriverLiable(fineId: string, periodMonth: string): Promise<VehicleFine> {
    // 1. Fetch fine details
    const { data: fine, error: fetchErr } = await supabase
      .from('vehicle_fines')
      .select(`
        *,
        vehicles:vehicle_id (
          vehicle_code
        )
      `)
      .eq('id', fineId)
      .single();

    if (fetchErr) throw fetchErr;
    if (!fine) throw new Error('Fine record not found');
    if (!fine.driver_id) throw new Error('No driver attributed to this fine. Resolve driver first.');

    // Format periodMonth to YYYY-MM-01
    const pMonth = periodMonth.substring(0, 7) + '-01';
    
    // 2. Create the negative payroll adjustment
    const reasonText = `Traffic fine recovery: Fine No. ${fine.fine_number} for Vehicle ${fine.vehicles?.vehicle_code || 'N/A'}`;
    
    const { data: adjustment, error: adjErr } = await supabase
      .from('payroll_adjustments')
      .insert({
        employee_id: fine.driver_id,
        period_month: pMonth,
        adjustment_type: 'ADVANCE_RECOVERY',
        amount: -Math.abs(Number(fine.amount)), // Must be negative to deduct
        reason: reasonText,
        status: 'PENDING'
      })
      .select()
      .single();

    if (adjErr) throw adjErr;

    // 3. Link the adjustment to the fine and update paid status
    const { data: updatedFine, error: fineUpdateErr } = await supabase
      .from('vehicle_fines')
      .update({
        status: 'TRANSFERRED_TO_DRIVER',
        paid_by: 'DRIVER',
        payroll_adjustment_id: adjustment.id,
        updated_at: new Date().toISOString()
      })
      .eq('id', fineId)
      .select()
      .single();

    if (fineUpdateErr) throw fineUpdateErr;
    return updatedFine as VehicleFine;
  },

  /**
   * Bulk inserts multiple fines after human review.
   */
  async bulkCreateFines(fines: Omit<VehicleFine, 'id' | 'created_at' | 'updated_at'>[]): Promise<VehicleFine[]> {
    // Resolve drivers for each fine that doesn't have one
    const resolvedFines = await Promise.all(
      fines.map(async f => {
        let driverId = f.driver_id;
        if (!driverId) {
          driverId = await this.resolveDriverForDate(f.vehicle_id, f.fine_date);
        }
        return {
          ...f,
          driver_id: driverId
        };
      })
    );

    const { data, error } = await supabase
      .from('vehicle_fines')
      .insert(resolvedFines)
      .select();

    if (error) throw error;
    return data as VehicleFine[];
  }
};
export default fineService;
