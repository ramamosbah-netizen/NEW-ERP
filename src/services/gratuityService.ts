// ============================================================
// JEET ERP — UAE Gratuity and EOSB Service
// Reference: UAE Federal Decree-Law No. 33 of 2021
// ============================================================

import { UAE_LABOUR_LAW } from '@/constants/uaeLabourLaw.constants';
import type { EosbCalculation } from '@/types/payroll.types';

export const gratuityService = {
  /**
   * Calculates the End of Service Benefit (gratuity) and leave encashment.
   * Basic salary is used for gratuity. Total salary is used for leave balance encashment.
   */
  calculateEOSB(params: {
    joinDate: string; // YYYY-MM-DD
    exitDate: string; // YYYY-MM-DD
    basicSalary: number;
    totalSalary: number;
    unpaidLeaveDays: number;
    leaveBalanceDays: number;
    pendingSalaryDays: number;
    outstandingAdvances: number;
  }): EosbCalculation {
    const {
      joinDate,
      exitDate,
      basicSalary,
      totalSalary,
      unpaidLeaveDays,
      leaveBalanceDays,
      pendingSalaryDays,
      outstandingAdvances
    } = params;

    const start = new Date(joinDate);
    const end = new Date(exitDate);
    
    // Total calendar days of service
    const diffTime = Math.max(0, end.getTime() - start.getTime());
    const calendarDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // inclusive
    
    // Effective service days excludes unpaid leave
    const effectiveServiceDays = Math.max(0, calendarDays - unpaidLeaveDays);
    
    let gratuityAmount = 0;
    
    // Gratuity requires at least 365 days of service
    const minDays = UAE_LABOUR_LAW.GRATUITY.MIN_SERVICE_DAYS;
    if (effectiveServiceDays >= minDays) {
      const daysInYear = 365;
      const first5YearsLimit = 5 * daysInYear;
      
      const first5YearsDays = Math.min(effectiveServiceDays, first5YearsLimit);
      const beyond5YearsDays = Math.max(0, effectiveServiceDays - first5YearsLimit);
      
      const dailyBasic = basicSalary / 30; // UAE law assumes 30 days month division
      
      // 21 days for first 5 years
      const gratuityFirst5 = (first5YearsDays / daysInYear) * UAE_LABOUR_LAW.GRATUITY.FIRST_5_YEARS_DAYS_PER_YR * dailyBasic;
      
      // 30 days beyond 5 years
      const gratuityBeyond5 = (beyond5YearsDays / daysInYear) * UAE_LABOUR_LAW.GRATUITY.BEYOND_5_YEARS_DAYS_PER_YR * dailyBasic;
      
      gratuityAmount = gratuityFirst5 + gratuityBeyond5;
      
      // Gratuity cap: 24 months of basic salary
      const capLimit = basicSalary * UAE_LABOUR_LAW.GRATUITY.CAP_MONTHS_BASIC;
      if (gratuityAmount > capLimit) {
        gratuityAmount = capLimit;
      }
    }

    // Leave encashment: balance × total_salary / 30
    const leaveEncashmentAmount = Math.max(0, leaveBalanceDays * (totalSalary / 30));
    
    // Pending salary: pendingDays * total_salary / 30
    const pendingSalary = Math.max(0, pendingSalaryDays * (totalSalary / 30));
    
    // Total settlement
    const totalSettlement = gratuityAmount + leaveEncashmentAmount + pendingSalary - outstandingAdvances;

    return {
      serviceDays: calendarDays,
      unpaidLeaveDays,
      effectiveServiceDays,
      gratuityAmount: Math.round(gratuityAmount * 100) / 100,
      leaveEncashmentDays: leaveBalanceDays,
      leaveEncashmentAmount: Math.round(leaveEncashmentAmount * 100) / 100,
      pendingSalary: Math.round(pendingSalary * 100) / 100,
      outstandingAdvances: Math.round(outstandingAdvances * 100) / 100,
      totalSettlement: Math.round(totalSettlement * 100) / 100,
      joinDate,
      exitDate,
      basicSalary,
      totalSalary
    };
  }
};

export default gratuityService;
