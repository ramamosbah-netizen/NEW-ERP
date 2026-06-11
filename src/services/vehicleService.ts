import { supabase } from '@/lib/supabase';
import type { Vehicle, VehicleAssignment } from '@/types/fleet.types';

export const vehicleService = {
  /**
   * Fetches all active vehicles from the database, including the assigned driver name.
   */
  async getVehicles(): Promise<Vehicle[]> {
    const { data, error } = await supabase
      .from('vehicles')
      .select(`
        *,
        employees:assigned_driver_id (
          full_name_en
        ),
        fixed_assets:fixed_asset_id (
          asset_number
        )
      `)
      .eq('is_active', true)
      .order('vehicle_code', { ascending: true });

    if (error) throw error;

    return (data || []).map(row => ({
      ...row,
      driver_name: row.employees?.full_name_en,
      asset_number: row.fixed_assets?.asset_number
    })) as Vehicle[];
  },

  /**
   * Fetches a specific vehicle details by its ID.
   */
  async getVehicleById(id: string): Promise<Vehicle | null> {
    const { data, error } = await supabase
      .from('vehicles')
      .select(`
        *,
        employees:assigned_driver_id (
          full_name_en
        ),
        fixed_assets:fixed_asset_id (
          asset_number
        )
      `)
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    return {
      ...data,
      driver_name: data.employees?.full_name_en,
      asset_number: data.fixed_assets?.asset_number
    } as Vehicle;
  },

  /**
   * Creates a new vehicle record.
   */
  async createVehicle(vehicle: Omit<Vehicle, 'id' | 'vehicle_code' | 'created_at' | 'updated_at'>): Promise<Vehicle> {
    const { data, error } = await supabase
      .from('vehicles')
      .insert({
        ...vehicle,
        is_active: true
      })
      .select()
      .single();

    if (error) throw error;
    return data as Vehicle;
  },

  /**
   * Updates an existing vehicle record.
   */
  async updateVehicle(id: string, updates: Partial<Vehicle>): Promise<Vehicle> {
    const { data, error } = await supabase
      .from('vehicles')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as Vehicle;
  },

  /**
   * Soft deletes a vehicle record.
   */
  async deleteVehicle(id: string): Promise<void> {
    const { error } = await supabase
      .from('vehicles')
      .update({
        is_active: false,
        status: 'DISPOSED',
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (error) throw error;
  },

  /**
   * Fetches the entire custody assignment history for a specific vehicle.
   */
  async getAssignments(vehicleId: string): Promise<VehicleAssignment[]> {
    const { data, error } = await supabase
      .from('vehicle_assignments')
      .select(`
        *,
        employees:driver_id (
          full_name_en
        ),
        vehicles:vehicle_id (
          vehicle_code,
          plate_number
        ),
        projects:project_id (
          name
        )
      `)
      .eq('vehicle_id', vehicleId)
      .order('from_date', { ascending: false });

    if (error) throw error;

    return (data || []).map(row => ({
      ...row,
      driver_name: row.employees?.full_name_en,
      vehicle_code: row.vehicles?.vehicle_code,
      plate_number: row.vehicles?.plate_number,
      project_name: row.projects?.name
    })) as VehicleAssignment[];
  },

  /**
   * Gets the active assignment for a vehicle (if any).
   */
  async getActiveAssignment(vehicleId: string): Promise<VehicleAssignment | null> {
    const { data, error } = await supabase
      .from('vehicle_assignments')
      .select(`
        *,
        employees:driver_id (
          full_name_en
        ),
        vehicles:vehicle_id (
          vehicle_code,
          plate_number
        )
      `)
      .eq('vehicle_id', vehicleId)
      .is('to_date', null)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    return {
      ...data,
      driver_name: data.employees?.full_name_en,
      vehicle_code: data.vehicles?.vehicle_code,
      plate_number: data.vehicles?.plate_number
    } as VehicleAssignment;
  },

  /**
   * Assigns a vehicle to a driver. Closes any previous active assignment automatically.
   */
  async assignVehicle(assignment: Omit<VehicleAssignment, 'id' | 'to_date' | 'created_at' | 'updated_at'>): Promise<VehicleAssignment> {
    const active = await this.getActiveAssignment(assignment.vehicle_id);
    const now = new Date().toISOString();

    if (active) {
      // Close previous active assignment
      await supabase
        .from('vehicle_assignments')
        .update({
          to_date: now,
          return_odometer: assignment.handover_odometer,
          condition_notes: 'Closed automatically due to reassignment',
          updated_at: now
        })
        .eq('id', active.id);
    }

    // Insert new assignment
    const { data, error } = await supabase
      .from('vehicle_assignments')
      .insert({
        ...assignment,
        from_date: assignment.from_date || now
      })
      .select()
      .single();

    if (error) throw error;

    // Update vehicle's assigned driver and odometer
    await supabase
      .from('vehicles')
      .update({
        assigned_driver_id: assignment.driver_id,
        odometer_km: assignment.handover_odometer,
        updated_at: now
      })
      .eq('id', assignment.vehicle_id);

    return data as VehicleAssignment;
  },

  /**
   * Ends an assignment (driver hands back custody of the vehicle).
   */
  async endAssignment(
    assignmentId: string,
    returnOdometer: number,
    conditionNotes?: string | null,
    signaturePath?: string | null
  ): Promise<void> {
    const now = new Date().toISOString();

    // Fetch the assignment details first
    const { data: assignment, error: fetchErr } = await supabase
      .from('vehicle_assignments')
      .select('*')
      .eq('id', assignmentId)
      .single();

    if (fetchErr) throw fetchErr;
    if (!assignment) throw new Error('Assignment not found');

    if (returnOdometer < assignment.handover_odometer) {
      throw new Error(`Return odometer (${returnOdometer}) cannot be less than handover odometer (${assignment.handover_odometer})`);
    }

    // Update assignment
    const { error: updateAssignErr } = await supabase
      .from('vehicle_assignments')
      .update({
        to_date: now,
        return_odometer: returnOdometer,
        condition_notes: conditionNotes,
        signature_path: signaturePath,
        updated_at: now
      })
      .eq('id', assignmentId);

    if (updateAssignErr) throw updateAssignErr;

    // Clear active driver on the vehicle and update vehicle's odometer
    const { error: updateVehicleErr } = await supabase
      .from('vehicles')
      .update({
        assigned_driver_id: null,
        odometer_km: returnOdometer,
        updated_at: now
      })
      .eq('id', assignment.vehicle_id);

    if (updateVehicleErr) throw updateVehicleErr;
  }
};
export default vehicleService;
