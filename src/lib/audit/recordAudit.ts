import { auditService } from '@/services/auditService';

const SENSITIVE_KEYS = [
  'salary',
  'basic_salary',
  'housing_allowance',
  'transport_allowance',
  'other_allowance',
  'iban',
  'bank_account',
  'account_number',
  'routing_code',
  'password',
  'token',
  'secret',
  'key'
];

/**
 * Deep clones and recursively masks sensitive fields in an object.
 */
function maskSensitiveFields(obj: Record<string, any> | null): Record<string, any> | null {
  if (!obj) return null;
  
  const result: Record<string, any> = {};
  
  for (const [key, val] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    
    if (val !== null && typeof val === 'object') {
      result[key] = Array.isArray(val)
        ? val.map(item => typeof item === 'object' ? maskSensitiveFields(item) : item)
        : maskSensitiveFields(val);
    } else if (SENSITIVE_KEYS.some(k => lowerKey.includes(k))) {
      result[key] = '[MASKED]';
    } else {
      result[key] = val;
    }
  }
  
  return result;
}

/**
 * Audit recording helper. Cleans and masks sensitive payloads prior to DB logging.
 */
export async function recordAudit(params: {
  action: string;
  entity_type: string;
  entity_id: string;
  entity_label?: string | null;
  summary: string;
  before?: Record<string, any> | null;
  after?: Record<string, any> | null;
  module: string;
}): Promise<void> {
  const cleanBefore = maskSensitiveFields(params.before || null);
  const cleanAfter = maskSensitiveFields(params.after || null);

  await auditService.logEvent({
    ...params,
    before: cleanBefore,
    after: cleanAfter
  });
}

export default recordAudit;
