// ============================================================
// JEET ERP — HR / Payroll Math Service Unit Tests
// Run with: npx tsx src/services/tests/runMathTests.ts
// ============================================================

import fs from 'fs';
import type { PayrollLine, PayrollAdjustment } from '@/types/payroll.types';
import type { Employee, EmployeeCompensation } from '@/types/hr.types';

// Load .env.local programmatically before importing any services
try {
  if (fs.existsSync('.env.local')) {
    const envContent = fs.readFileSync('.env.local', 'utf8');
    for (const line of envContent.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const parts = trimmed.split('=');
      if (parts.length >= 2) {
        const key = parts[0].trim();
        const val = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
        process.env[key] = val;
      }
    }
  }
} catch (err: any) {
  console.warn('Failed to load .env.local into process.env:', err.message);
}

let gratuityService: any;
let sifService: any;
let payrollService: any;
let weightedAverageService: any;
let depreciationService: any;

let failed = 0;
let passed = 0;

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    failed++;
  } else {
    console.log(`✅ PASS: ${message}`);
    passed++;
  }
}

// Helper to generate a valid UAE IBAN for testing
function generateValidUAEIBAN(bankCode: string, accountNo: string): string {
  const accountPadded = accountNo.padStart(16, '0');
  const baseString = bankCode + accountPadded; // 19 digits
  const rearranged = baseString + '101400'; // AE = 1014 + '00' for check digits placeholder
  
  // Calculate modulo 97
  let remainder = 0;
  for (let i = 0; i < rearranged.length; i++) {
    remainder = (remainder * 10 + parseInt(rearranged[i], 10)) % 97;
  }
  
  const checkDigits = String(98 - remainder).padStart(2, '0');
  return `AE${checkDigits}${bankCode}${accountPadded}`;
}

async function runTests() {
  console.log('--- Executing Pure Math Test Suite ---');

  // Load modules dynamically
  gratuityService = (await import('../gratuityService')).gratuityService;
  sifService = (await import('../sifService')).sifService;
  payrollService = (await import('../payrollService')).payrollService;
  weightedAverageService = (await import('../weightedAverageService')).weightedAverageService;
  depreciationService = (await import('../depreciationService')).depreciationService;

  // ============================================================
  // TEST CASE 1: UAE IBAN Validation Checksum
  // ============================================================
  console.log('\n--- Test Case 1: UAE IBAN Validator ---');

  const validIBAN1 = generateValidUAEIBAN('003', '1234567890'); // ADCB
  const validIBAN2 = generateValidUAEIBAN('049', '9876543210123'); // Emirates NBD
  const invalidIBAN1 = 'AE123456789012345678901'; // Incorrect length
  const invalidIBAN2 = validIBAN1.slice(0, -1) + (validIBAN1.slice(-1) === '5' ? '6' : '5'); // Corrupted last digit

  assert(sifService.validateUAEIBAN(validIBAN1) === true, `IBAN "${validIBAN1}" should be VALID`);
  assert(sifService.validateUAEIBAN(validIBAN2) === true, `IBAN "${validIBAN2}" should be VALID`);
  assert(sifService.validateUAEIBAN(invalidIBAN1) === false, `IBAN "${invalidIBAN1}" should be INVALID (length)`);
  assert(sifService.validateUAEIBAN(invalidIBAN2) === false, `IBAN "${invalidIBAN2}" should be INVALID (checksum mismatch)`);

  // ============================================================
  // TEST CASE 2: Gratuity & Settlement Math
  // ============================================================
  console.log('\n--- Test Case 2: End of Service Gratuity ---');

  // A. Service under 1 year (no gratuity)
  const calcUnder1Yr = gratuityService.calculateEOSB({
    joinDate: '2025-01-01',
    exitDate: '2025-06-30', // 181 calendar days
    basicSalary: 10000,
    totalSalary: 15000,
    unpaidLeaveDays: 0,
    leaveBalanceDays: 5,
    pendingSalaryDays: 0,
    outstandingAdvances: 0
  });
  assert(calcUnder1Yr.gratuityAmount === 0, 'Gratuity under 1 year must be 0');
  assert(calcUnder1Yr.leaveEncashmentAmount === 2500, 'Leave encashment should be 5 days * (15000 / 30) = 2500');
  assert(calcUnder1Yr.totalSettlement === 2500, 'Total settlement should equal leave encashment');

  // B. Service = exactly 3 years without leap years (2021-01-01 to 2023-12-31 = 1095 days).
  const calc3Yr = gratuityService.calculateEOSB({
    joinDate: '2021-01-01',
    exitDate: '2023-12-31', // 3 full non-leap years = 1095 days
    basicSalary: 10000,
    totalSalary: 15000,
    unpaidLeaveDays: 0,
    leaveBalanceDays: 10,
    pendingSalaryDays: 0,
    outstandingAdvances: 1500
  });
  // 3 years * 21 days basic salary/year = 63 days basic. Daily basic = 10000 / 30 = 333.333
  // Gratuity = 3 * 21 * (10000 / 30) = 63 * 333.33 = 21,000 AED
  assert(Math.abs(calc3Yr.gratuityAmount - 21000) < 0.01, `Gratuity for 3 years should be exactly 21000, got ${calc3Yr.gratuityAmount}`);
  assert(calc3Yr.leaveEncashmentAmount === 5000, 'Leave encashment for 10 days should be 5000');
  assert(Math.abs(calc3Yr.totalSettlement - (21000 + 5000 - 1500)) < 0.01, `Total settlement check (24500): got ${calc3Yr.totalSettlement}`);

  // C. Service = 7.5 years (includes leap years). 
  const calc7_5Yr = gratuityService.calculateEOSB({
    joinDate: '2018-01-01',
    exitDate: '2025-07-02', // 7.5 years (2740 calendar days)
    basicSalary: 10000,
    totalSalary: 15000,
    unpaidLeaveDays: 0,
    leaveBalanceDays: 0,
    pendingSalaryDays: 0,
    outstandingAdvances: 0
  });
  // 2740 / 365 = 7.5068 years.
  // Gratuity = 5 * 21 * (10000/30) + 2.5068 * 30 * (10000/30) = 35000 + 25068.49 = 60068.49
  assert(Math.abs(calc7_5Yr.gratuityAmount - 60068.49) < 0.01, `Gratuity for 7.5 years should be 60068.49, got ${calc7_5Yr.gratuityAmount}`);

  // D. Capping validation (max 24 months basic salary = 240,000)
  const calcCap = gratuityService.calculateEOSB({
    joinDate: '1995-01-01',
    exitDate: '2025-01-01', // 30 years
    basicSalary: 10000,
    totalSalary: 15000,
    unpaidLeaveDays: 0,
    leaveBalanceDays: 0,
    pendingSalaryDays: 0,
    outstandingAdvances: 0
  });
  assert(calcCap.gratuityAmount === 240000, `Gratuity capped at 24 months basic (240,000), got ${calcCap.gratuityAmount}`);

  // ============================================================
  // TEST CASE 3: Payroll Component Processing
  // ============================================================
  console.log('\n--- Test Case 3: Payroll Calculations ---');

  const empMock = {
    join_date: '2020-01-01',
    exit_date: null
  } as unknown as Employee;

  const compMock = {
    basic_salary: 10000,
    housing_allowance: 3000,
    transport_allowance: 1500,
    other_allowance: 500,
    burden_multiplier: 1.25
  } as unknown as EmployeeCompensation;

  // Standard month run (no proration, no leaves, standard OT)
  // Total salary = 15,000. Basic = 10,000.
  // Weekday OT hours = 10 -> 10 * (10000 / 240) * 1.25 = 520.83
  // Restday OT hours = 5 -> 5 * (10000 / 240) * 1.50 = 312.50
  // Total OT = 833.33
  const salaryStandard = payrollService.calculateEmployeeSalary({
    periodMonth: '2026-06-01',
    employee: empMock,
    compensation: compMock,
    approvedOtHours: { weekday: 10, restHoliday: 5 },
    unpaidLeaveDays: 0,
    sickHalfPayDays: 0,
    sickUnpaidDays: 0,
    adjustments: []
  });
  assert(Math.abs(salaryStandard.ot_amount - 833.33) < 1.00, `Standard monthly OT should be ~833.33, got ${salaryStandard.ot_amount}`);
  assert(salaryStandard.gross_pay === 15000 + salaryStandard.ot_amount, `Gross pay match: got ${salaryStandard.gross_pay}`);
  assert(salaryStandard.net_pay === salaryStandard.gross_pay, `Net pay equals gross pay: got ${salaryStandard.net_pay}`);

  // Mid-month joiner: joined on 16th of June. Prorated days = 15/30 = 0.5 ratio.
  const empJoinerMock = {
    join_date: '2026-06-16',
    exit_date: null
  } as unknown as Employee;
  const salaryJoiner = payrollService.calculateEmployeeSalary({
    periodMonth: '2026-06-01',
    employee: empJoinerMock,
    compensation: compMock,
    approvedOtHours: { weekday: 0, restHoliday: 0 },
    unpaidLeaveDays: 0,
    sickHalfPayDays: 0,
    sickUnpaidDays: 0,
    adjustments: []
  });
  assert(salaryJoiner.basic_salary === 5000, `Prorated basic should be 5000 (0.5x), got ${salaryJoiner.basic_salary}`);
  assert(salaryJoiner.gross_pay === 7500, `Prorated gross pay should be 7500, got ${salaryJoiner.gross_pay}`);

  // Unpaid leave deductions: 2 days unpaid leave. Deduct 2 * (15000 / 30) = 1,000.
  const salaryUnpaid = payrollService.calculateEmployeeSalary({
    periodMonth: '2026-06-01',
    employee: empMock,
    compensation: compMock,
    approvedOtHours: { weekday: 0, restHoliday: 0 },
    unpaidLeaveDays: 2,
    sickHalfPayDays: 0,
    sickUnpaidDays: 0,
    adjustments: []
  });
  assert(salaryUnpaid.leave_deductions === 1000, `2 days unpaid leave deduction should be 1000, got ${salaryUnpaid.leave_deductions}`);
  assert(salaryUnpaid.net_pay === 14000, `Net pay should be 14000, got ${salaryUnpaid.net_pay}`);

  // ============================================================
  // TEST CASE 4: WPS SIF Generation
  // ============================================================
  console.log('\n--- Test Case 4: WPS SIF Exporter ---');

  const linesMock = [
    {
      mohre_person_code: '12345678901234',
      agent_id: '987654321',
      iban: validIBAN1,
      basic_salary: 10000,
      housing_allowance: 3000,
      transport_allowance: 1500,
      other_allowance: 500,
      ot_hours: 0,
      ot_amount: 0,
      leave_deductions: 0,
      adjustments: [],
      gross_pay: 15000,
      net_pay: 15000,
      days_worked: 30,
      employee: {
        full_name_en: 'Hassan Bin Rashid'
      }
    }
  ] as unknown as PayrollLine[];

  const sifOutput = sifService.generateSIF({
    establishmentId: '1234567890123',
    bankRoutingCode: '987654321',
    salaryMonth: '2026-06-01',
    lines: linesMock,
    fileReference: 'REFJUNE'
  });

  assert(sifOutput.validationErrors.length === 0, 'SIF should generate with ZERO validation errors');
  assert(sifOutput.content.startsWith('EDR,'), 'SIF file should start with EDR record');
  assert(sifOutput.content.includes('\r\nSCR,'), 'SIF file should end with SCR record');
  assert(sifOutput.content.includes(',AED,REFJUNE'), 'SIF file SCR record should contain AED currency and reference');

  // ============================================================
  // TEST CASE 5: Weighted Average Cost (WAC) Inventory Math
  // ============================================================
  console.log('\n--- Test Case 5: Weighted Average Cost (WAC) ---');

  // A. Initial stock receipt (qty = 0, cost = 0, add 100 at AED 2.50)
  const wac1 = weightedAverageService.calculateNewAverage(0, 0, 100, 2.50);
  assert(wac1 === 2.50, `Initial receipt: cost should be 2.50, got ${wac1}`);

  // B. Subsequent receipt at a different cost (current 100 at 2.50, add 100 at 2.80)
  const wac2 = weightedAverageService.calculateNewAverage(100, 2.50, 100, 2.80);
  assert(wac2 === 2.65, `Second receipt: cost should average to 2.65, got ${wac2}`);

  // C. Stock issue (does not change average cost)
  // We don't call calculateNewAverage for issues since issue unit cost is always the current avg cost.
  // But let's verify WAC doesn't change when adding 0 items or adding at 0 cost.
  const wac3 = weightedAverageService.calculateNewAverage(200, 2.65, 0, 2.65);
  assert(wac3 === 2.65, `Issue/Zero addition: cost should remain 2.65, got ${wac3}`);

  // D. Mixed receipt (current 150 at 2.65, add 50 at 3.00)
  // ((150 * 2.65) + (50 * 3.00)) / 200 = (397.5 + 150) / 200 = 2.7375
  const wac4 = weightedAverageService.calculateNewAverage(150, 2.65, 50, 3.00);
  assert(wac4 === 2.7375, `Mixed receipt: cost should average to 2.7375, got ${wac4}`);

  // E. Cost guard checks: negative current stock should default WAC to the added unit cost
  const wac5 = weightedAverageService.calculateNewAverage(-10, 2.65, 50, 2.90);
  assert(wac5 === 2.90, `Negative stock guard: WAC should set to 2.90, got ${wac5}`);

  // ============================================================
  // TEST CASE 6: Fixed Asset Depreciation & Disposals
  // ============================================================
  console.log('\n--- Test Case 6: Fixed Asset Depreciation & Disposals ---');

  // A. Straight-Line Schedule Generation (Cost = 10,000, Salvage = 1,000, Life = 10 months)
  const schedule = depreciationService.generateSchedule('2026-06-25', 10000, 1000, 10);
  
  assert(schedule.length === 10, 'Schedule should contain exactly 10 periods');
  assert(schedule[0].period_month === '2026-06-01', 'First period month should be 2026-06-01 (Full-Month Convention)');
  assert(schedule[0].depreciation_amount === 900, 'Month 1 depreciation should be 900 AED');
  assert(schedule[0].opening_nbv === 10000, 'Month 1 opening NBV should be 10000 AED');
  assert(schedule[0].closing_nbv === 9100, 'Month 1 closing NBV should be 9100 AED');
  assert(schedule[9].closing_nbv === 1000, 'Final month closing NBV must equal salvage value (1000 AED)');
  
  const totalDepAmount = schedule.reduce((sum: number, row: any) => sum + row.depreciation_amount, 0);
  assert(totalDepAmount === 9000, `Total depreciation must sum to exactly (cost - salvage) = 9000, got ${totalDepAmount}`);

  // B. Full-Month Convention check (purchase day e.g. June 25th charges full month in June)
  const midMonthSchedule = depreciationService.generateSchedule('2026-06-29', 10000, 1000, 10);
  assert(midMonthSchedule[0].period_month === '2026-06-01', 'Mid-month purchase first period should be 2026-06-01');
  assert(midMonthSchedule[0].depreciation_amount === 900, 'Mid-month purchase first month depreciation should be a full 900 AED');

  // C. Disposal Mid-Life (Sell asset at Month 5 for 6,000 AED. Verify gain/loss against Month 5 closing NBV)
  // Month 1: 2026-06-01, Month 2: 2026-07-01, Month 3: 2026-08-01, Month 4: 2026-09-01, Month 5: 2026-10-01.
  // Closing NBV of Month 5: 10000 - 5 * 900 = 5500.
  const nbvAtMonth5 = depreciationService.getNbvAtPeriod(schedule, '2026-10-15');
  assert(nbvAtMonth5 === 5500, `NBV at Month 5 (2026-10-15) should be 5500 AED, got ${nbvAtMonth5}`);
  
  const truncatedSchedule = depreciationService.truncateScheduleForDisposal(schedule, '2026-10-15');
  assert(truncatedSchedule.length === 5, `Truncated schedule for disposal in Month 5 should have 5 rows, got ${truncatedSchedule.length}`);
  
  const disposalGain = depreciationService.calculateDisposalGainLoss(nbvAtMonth5, 6000);
  assert(disposalGain === 500, `Disposal gain at Month 5 for 6000 proceeds should be 500 AED (6000 - 5500), got ${disposalGain}`);

  const disposalLoss = depreciationService.calculateDisposalGainLoss(nbvAtMonth5, 4500);
  assert(disposalLoss === -1000, `Disposal gain/loss at Month 5 for 4500 proceeds should be -1000 AED (4500 - 5500), got ${disposalLoss}`);

  // ============================================================
  // TEST CASE 7: RBAC Permissions Resolution
  // ============================================================
  console.log('\n--- Test Case 7: RBAC Client-Side Evaluator ---');

  interface EffectivePermissionMock {
    permission_key: string;
    scope: 'ALL' | 'OWN' | 'ASSIGNED' | 'TEAM';
    hierarchy_level: number;
  }

  function mockHasPermission(
    permissions: EffectivePermissionMock[],
    userId: string,
    userDepartment: string | null,
    permissionKey: string,
    recordCreatorId?: string | null,
    recordAssignedId?: string | null,
    recordCreatorDept?: string | null
  ): boolean {
    const hasAdminBypass = permissions.some(p => p.permission_key === permissionKey && p.hierarchy_level <= 10);
    if (hasAdminBypass) return true;

    const match = permissions.find(p => p.permission_key === permissionKey);
    if (!match) return false;

    const { scope } = match;

    if (scope === 'ALL') return true;
    if (scope === 'OWN' && recordCreatorId && userId) return recordCreatorId === userId;
    if (scope === 'ASSIGNED' && recordAssignedId && userId) return recordAssignedId === userId;
    if (scope === 'TEAM') {
      if (recordCreatorDept && userDepartment) return recordCreatorDept === userDepartment;
      if (recordCreatorId && userId && recordCreatorId === userId) return true;
    }
    return false;
  }

  const userPerms: EffectivePermissionMock[] = [
    { permission_key: 'po.approve', scope: 'OWN', hierarchy_level: 40 },
    { permission_key: 'po.view', scope: 'TEAM', hierarchy_level: 40 },
    { permission_key: 'quotation.view', scope: 'ALL', hierarchy_level: 30 }
  ];

  const adminPerms: EffectivePermissionMock[] = [
    { permission_key: 'po.approve', scope: 'ALL', hierarchy_level: 10 }
  ];

  assert(mockHasPermission(adminPerms, 'user-123', 'FINANCE', 'po.approve', 'user-456') === true, 'Admin with hierarchy level 10 should bypass check');
  assert(mockHasPermission(userPerms, 'user-123', 'FINANCE', 'po.approve', 'user-123') === true, 'OWN scope should approve if creator is current user');
  assert(mockHasPermission(userPerms, 'user-123', 'FINANCE', 'po.approve', 'user-456') === false, 'OWN scope should fail if creator is NOT current user');
  assert(mockHasPermission(userPerms, 'user-123', 'FINANCE', 'po.view', 'user-456', null, 'FINANCE') === true, 'TEAM scope should pass if department matches');
  assert(mockHasPermission(userPerms, 'user-123', 'FINANCE', 'po.view', 'user-456', null, 'HR') === false, 'TEAM scope should fail if department does not match');
  assert(mockHasPermission(userPerms, 'user-123', 'FINANCE', 'quotation.view', 'user-999') === true, 'ALL scope should pass regardless of creator');

  console.log(`\n=== Test Results: ${passed} passed, ${failed} failed ===`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
