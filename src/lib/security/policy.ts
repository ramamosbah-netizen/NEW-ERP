// ============================================================
// Aura ERP — Security policy (strict by default, operations configurable)
// ------------------------------------------------------------
// Philosophy while the ERP is under active development:
//   • STRICT, non-negotiable, DB-enforced — do not loosen:
//       - RLS: finance writes = finance roles; payroll/comp read+write = HR only
//       - DB integrity triggers (invoice status machine, payment backing,
//         math immutability, retention caps) + GL balanced/period/immutable posting
//   • CONFIGURABLE, flexible during development — tune without redeploys:
//       - which workflow modules enforce maker-checker (this file)
//       - operational tables stay open `authenticated` RLS
//
// Maker-checker (creator ≠ approver) defaults to a strict set of fraud-sensitive
// modules, and can be widened/narrowed at runtime via the
// `security.maker_checker_modules` setting (Admin → Settings). It ALWAYS falls
// back to the strict default if the setting is missing or unreadable (fail-safe).
// ============================================================

import { settingsService } from '@/services/settingsService';

export const MAKER_CHECKER_SETTING_KEY = 'security.maker_checker_modules';

/** Strict, safe default — money-critical workflow modules. */
export const STRICT_MAKER_CHECKER_MODULES: readonly string[] = [
  'INV',         // Client invoice (AR)
  'SINV',        // Supplier bill (AP)
  'PROFORMA',    // Proforma invoice
  'PAYMENT_REQ', // Payment request
  'BUDGET',      // Budget approval
  'PETTY_CASH',  // Petty cash
  'EXP',         // Expense claim
];

let cache: { at: number; set: Set<string> } | null = null;
const TTL_MS = 60_000; // config changes propagate within ~1 minute

/**
 * Returns the set of module keys where workflow maker-checker is enforced.
 * Reads the runtime setting (cached briefly); falls back to the strict default
 * on any error or when unset, so security never silently weakens.
 */
export async function getMakerCheckerModules(): Promise<Set<string>> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.set;

  let modules: string[] = [...STRICT_MAKER_CHECKER_MODULES];
  try {
    const configured = await settingsService.getSettingByKey<string[]>(
      MAKER_CHECKER_SETTING_KEY,
      modules,
    );
    if (Array.isArray(configured) && configured.length > 0) modules = configured;
  } catch {
    // fail-safe: keep the strict default
  }

  cache = { at: Date.now(), set: new Set(modules) };
  return cache.set;
}

/** Clears the in-memory cache (call after updating the setting for instant effect). */
export function clearMakerCheckerCache(): void {
  cache = null;
}
