export interface DepreciationScheduleRowInput {
  period_month: string;
  opening_nbv: number;
  depreciation_amount: number;
  closing_nbv: number;
  accumulated: number;
}

export const depreciationService = {
  /**
   * Helper to format a date to YYYY-MM-01 (first of the month)
   */
  getPeriodMonth(dateStr: string): string {
    const date = new Date(dateStr);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}-01`;
  },

  /**
   * Generates a complete depreciation schedule using Straight-Line method.
   * Charges a full month's depreciation in the acquisition month (Full-Month Convention).
   */
  generateSchedule(
    acquisitionDateStr: string,
    acquisitionCost: number,
    salvageValue: number,
    usefulLifeMonths: number
  ): DepreciationScheduleRowInput[] {
    if (acquisitionCost < 0 || salvageValue < 0 || usefulLifeMonths <= 0) {
      throw new Error('Invalid cost, salvage, or life parameters');
    }
    if (salvageValue > acquisitionCost) {
      throw new Error('Salvage value cannot exceed acquisition cost');
    }

    const schedule: DepreciationScheduleRowInput[] = [];
    const depreciableAmount = acquisitionCost - salvageValue;
    
    // Round to 2 decimals for currency
    const monthlyDepRate = depreciableAmount / usefulLifeMonths;
    const standardMonthlyDep = Math.round(monthlyDepRate * 100) / 100;

    // Start date (first of the acquisition month)
    const startDate = new Date(acquisitionDateStr);
    let currentYear = startDate.getFullYear();
    let currentMonth = startDate.getMonth(); // 0-indexed

    let openingNBV = acquisitionCost;
    let accumulatedDep = 0;

    for (let i = 1; i <= usefulLifeMonths; i++) {
      // Calculate period month string
      const periodMonthStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`;

      let depAmount = standardMonthlyDep;

      // Final month capping or check guard to ensure we don't exceed salvage value
      if (i === usefulLifeMonths || (openingNBV - depAmount) < salvageValue) {
        depAmount = Math.max(0, Math.round((openingNBV - salvageValue) * 100) / 100);
      }

      const closingNBV = Math.round((openingNBV - depAmount) * 100) / 100;
      accumulatedDep = Math.round((accumulatedDep + depAmount) * 100) / 100;

      schedule.push({
        period_month: periodMonthStr,
        opening_nbv: openingNBV,
        depreciation_amount: depAmount,
        closing_nbv: closingNBV,
        accumulated: accumulatedDep
      });

      // Prepare for next month
      openingNBV = closingNBV;
      currentMonth++;
      if (currentMonth > 11) {
        currentMonth = 0;
        currentYear++;
      }
    }

    return schedule;
  },

  /**
   * Retrieves the closing NBV at a specific target period month from a generated schedule.
   * If the period is before the acquisition month, returns acquisition cost.
   * If the period is after the last schedule month, returns the salvage value.
   */
  getNbvAtPeriod(schedule: DepreciationScheduleRowInput[], targetPeriodMonthStr: string): number {
    if (schedule.length === 0) return 0;
    
    const targetPeriod = this.getPeriodMonth(targetPeriodMonthStr);
    
    // Check if target is before the first month
    if (targetPeriod < schedule[0].period_month) {
      return schedule[0].opening_nbv;
    }

    const row = schedule.find(r => r.period_month === targetPeriod);
    if (row) {
      return row.closing_nbv;
    }

    // Check if target is after the last month
    if (targetPeriod > schedule[schedule.length - 1].period_month) {
      return schedule[schedule.length - 1].closing_nbv;
    }

    // Fallback if there's a gap (should not happen if contiguous)
    return schedule[schedule.length - 1].closing_nbv;
  },

  /**
   * Truncates the depreciation schedule up to the disposal period and returns it.
   * Truncation month (disposal month) will be the final row.
   */
  truncateScheduleForDisposal(
    schedule: DepreciationScheduleRowInput[],
    disposalDateStr: string
  ): DepreciationScheduleRowInput[] {
    const disposalPeriod = this.getPeriodMonth(disposalDateStr);
    return schedule.filter(row => row.period_month <= disposalPeriod);
  },

  /**
   * Calculates Gain or Loss on Asset Disposal: proceeds - NBV at disposal
   */
  calculateDisposalGainLoss(nbvAtDisposal: number, proceeds: number): number {
    return Math.round((proceeds - nbvAtDisposal) * 100) / 100;
  }
};
