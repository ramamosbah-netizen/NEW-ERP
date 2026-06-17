// ============================================================
// Aura ERP — Validation helper (zod)
// Thin wrapper so services can validate inbound payloads at write
// boundaries with consistent, user-friendly errors. Pattern:
//   validate(someSchema, input, 'invoice');
// ============================================================

import type { ZodType } from 'zod';

export class ValidationError extends Error {
  issues: { path: string; message: string }[];
  constructor(message: string, issues: { path: string; message: string }[]) {
    super(message);
    this.name = 'ValidationError';
    this.issues = issues;
  }
}

/**
 * Parses `data` against `schema`. Throws a ValidationError with a readable
 * summary on failure; returns the typed, parsed value on success.
 */
export function validate<T>(schema: ZodType<T>, data: unknown, label = 'input'): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const issues = result.error.issues.map(i => ({
      path: i.path.join('.'),
      message: i.message,
    }));
    const summary = issues.map(i => `${i.path || label}: ${i.message}`).join('; ');
    throw new ValidationError(`Invalid ${label}: ${summary}`, issues);
  }
  return result.data;
}
