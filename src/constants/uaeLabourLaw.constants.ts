// ============================================================
// JEET ERP — UAE Labour Law Constants (Configurable Defaults)
// Reference: UAE Federal Decree-Law No. 33 of 2021 on Regulation of Labour Relations
// ============================================================

export const UAE_LABOUR_LAW = {
  // Annual Leave Entitlement
  ANNUAL_LEAVE: {
    ACC_RATE_FIRST_YEAR: 2.0, // 2 days per month after 6 months up to 1 year
    ACC_RATE_STANDARD: 2.5,   // 2.5 days per month (30 days per year) after 1 year
    PROBATION_ACCRUAL: false, // Accrues but cannot be availed during probation
  },

  // Sick Leave Entitlement (Tiered per year)
  SICK_LEAVE: {
    FULL_PAY_DAYS: 15,
    HALF_PAY_DAYS: 30,
    UNPAID_DAYS: 45,
    TOTAL_DAYS: 90,
  },

  // Maternity Leave
  MATERNITY_LEAVE: {
    FULL_PAY_DAYS: 45,
    HALF_PAY_DAYS: 15,
    TOTAL_DAYS: 60,
  },

  // Parental Leave
  PARENTAL_LEAVE: {
    FULL_PAY_DAYS: 5, // 5 working days within 6 months of childbirth
  },

  // Compassionate Leave
  COMPASSIONATE_LEAVE: {
    DEATH_SPOUSE_DAYS: 5,
    DEATH_RELATIVE_DAYS: 3, // Parent, child, sibling, grandparent
  },

  // Overtime Multipliers (Base = Basic Salary only)
  OVERTIME: {
    WEEKDAY_MULTIPLIER: 1.25,      // standard weekday OT: 1.25x
    RESTDAY_HOLIDAY_MULTIPLIER: 1.50, // rest days (Friday/Saturday depending on contract) or public holidays: 1.5x
  },

  // End of Service Benefits (Gratuity Math)
  GRATUITY: {
    MIN_SERVICE_DAYS: 365,          // 1 full year required
    FIRST_5_YEARS_DAYS_PER_YR: 21,  // 21 days basic salary per year
    BEYOND_5_YEARS_DAYS_PER_YR: 30, // 30 days basic salary per year
    CAP_MONTHS_BASIC: 24,           // capped at 24 months of basic salary
  },

  // Cost Burdening Configuration
  COST_BURDEN: {
    DEFAULT_MULTIPLIER: 1.25, // visa, health, gratuity overheads
  }
};
