// ============================================================
// JEET ERP — PPM Visits Scheduler Service
// Distributes PPM visits evenly across the contract duration.
// ============================================================

import { supabase } from '@/lib/supabase';
import type { AMCContract } from '@/types/amc.types';
import type { PPMVisit } from '@/types/ppm.types';

export const ppmScheduleService = {
  /**
   * Generates unscheduled PPM visits distributed evenly across the contract period.
   * Spacing is calculated based on visits_per_year over a 12-month period.
   */
  async generatePPMVisitsForContract(contract: AMCContract): Promise<PPMVisit[]> {
    const { id: contractId, contract_number, start_date, visits_per_year } = contract;
    const visits: Omit<PPMVisit, 'id' | 'created_at'>[] = [];

    const start = new Date(start_date);
    const intervalMonths = 12 / visits_per_year;

    for (let i = 0; i < visits_per_year; i++) {
      // Calculate target month (first day of the targeted month)
      const targetMonthDate = new Date(
        start.getFullYear(),
        start.getMonth() + Math.floor(i * intervalMonths),
        1
      );
      
      const targetMonthStr = `${targetMonthDate.getFullYear()}-${String(
        targetMonthDate.getMonth() + 1
      ).padStart(2, '0')}-01`;

      visits.push({
        contract_id: contractId,
        visit_number: `${contract_number}-PPM-${String(i + 1).padStart(2, '0')}`,
        target_month: targetMonthStr,
        status: 'UNSCHEDULED'
      });
    }

    // Insert visits into Supabase
    const { data, error } = await supabase
      .from('ppm_visits')
      .insert(visits)
      .select();

    if (error) {
      console.error('Failed to generate PPM visits:', error);
      throw error;
    }

    return (data || []) as PPMVisit[];
  }
};
