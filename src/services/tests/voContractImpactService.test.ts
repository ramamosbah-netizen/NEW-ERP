// ============================================================
// JEET ERP — Variation Order Calculations Unit Tests
// Run with: npx tsx src/services/tests/voContractImpactService.test.ts
// ============================================================

import { 
  calculateVOMargin, 
  calculateContractImpact, 
  validateInvoiceCeiling 
} from '../voContractImpactService';

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

async function runTests() {
  console.log('--- Executing Variation Order Math Test Suite ---');

  // ============================================================
  // TEST CASE 1: VO Margin Calculations
  // ============================================================
  console.log('\n--- Test Case 1: VO Margin Calculations ---');

  // A. Positive Addition VO (high margin)
  const marginAdd = calculateVOMargin(25000, 15000);
  assert(marginAdd.marginAmount === 10000, `Addition Margin Amount should be 10000, got ${marginAdd.marginAmount}`);
  assert(marginAdd.marginPct === 40, `Addition Margin Pct should be 40%, got ${marginAdd.marginPct}%`);

  // B. Omission VO (Negative Amount)
  const marginOmit = calculateVOMargin(-12000, -8000);
  assert(marginOmit.marginAmount === -4000, `Omission Margin Amount should be -4000, got ${marginOmit.marginAmount}`);
  assert(marginOmit.marginPct === 33.33, `Omission Margin Pct should be 33.33%, got ${marginOmit.marginPct}%`);

  // C. Zero Sell VO (re-rate or dayworks credit with no cost/sell)
  const marginZero = calculateVOMargin(0, 0);
  assert(marginZero.marginAmount === 0, `Zero VO Margin Amount should be 0, got ${marginZero.marginAmount}`);
  assert(marginZero.marginPct === 0, `Zero VO Margin Pct should be 0%, got ${marginZero.marginPct}%`);

  // ============================================================
  // TEST CASE 2: Contract Impact (Contract Value & Completion Date)
  // ============================================================
  console.log('\n--- Test Case 2: Contract Value & EOT Recomputes ---');

  // Core project: AED 500,000, Target Completion: 2026-12-31
  const originalContractValue = 500000;
  const plannedEndDate = '2026-12-31';

  // Approved VOs:
  // VO 1: Addition +AED 25,000, EOT +15 days
  // VO 2: Omission -AED 12,000, EOT -5 days
  // VO 3: Substitution +AED 5,000, EOT +2 days
  const approvedVOs = [
    { sell_amount: 25000, time_impact_days: 15 },
    { sell_amount: -12000, time_impact_days: -5 },
    { sell_amount: 5000, time_impact_days: 2 }
  ];

  const impact = calculateContractImpact({
    originalContractValue,
    plannedEndDate,
    approvedVOs
  });

  assert(impact.voCount === 3, `VO Count should be 3, got ${impact.voCount}`);
  assert(impact.voTotalSell === 18000, `VO Total Sell should be 18000 (25k - 12k + 5k), got ${impact.voTotalSell}`);
  assert(impact.revisedContractValue === 518000, `Revised contract value should be 518000, got ${impact.revisedContractValue}`);
  // Target completion EOT: 15 - 5 + 2 = 12 days.
  // 2026-12-31 + 12 days = 2027-01-12.
  assert(impact.revisedEndDate === '2027-01-12', `Revised target completion date should be 2027-01-12, got ${impact.revisedEndDate}`);

  // ============================================================
  // TEST CASE 3: Over-claim Invoice Ceiling Reconcile
  // ============================================================
  console.log('\n--- Test Case 3: Over-claim Guard ---');

  // Revised Contract Value = AED 518,000
  const revisedValue = 518000;

  // A. Progress claim under ceiling (invoiced: 400k, current claim: 100k, total: 500k <= 518k)
  const guardOk = validateInvoiceCeiling(revisedValue, 400000, 100000);
  assert(guardOk.valid === true, `Progress claim of 100k should be allowed`);
  assert(guardOk.exceededBy === 0, `Exceeded amount should be 0, got ${guardOk.exceededBy}`);

  // B. Progress claim exactly at ceiling (invoiced: 500k, current: 18k, total: 518k)
  const guardExact = validateInvoiceCeiling(revisedValue, 500000, 18000);
  assert(guardExact.valid === true, `Progress claim up to exact ceiling should be allowed`);

  // C. Progress claim exceeding ceiling (invoiced: 500k, current: 20k, total: 520k > 518k)
  const guardOver = validateInvoiceCeiling(revisedValue, 500000, 20000);
  assert(guardOver.valid === false, `Progress claim exceeding ceiling by 2k should be BLOCKED`);
  assert(guardOver.exceededBy === 2000, `Exceeded by amount should be 2000, got ${guardOver.exceededBy}`);

  console.log(`\n=== Test Results: ${passed} passed, ${failed} failed ===`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
