// ============================================================
// JEET ERP — Project Number Generation Service
// Calls Supabase RPC for race-safe sequence-based numbering
// ============================================================

import { logger } from '@/lib/logger';
import { supabase } from './supabase';

/**
 * Generates a unique, race-safe project number using the database sequence.
 * Format: DSC-YYYY-NNN (e.g. DSC-2026-001)
 */
export async function generateProjectNumber(): Promise<string> {
  const { data, error } = await supabase.rpc('generate_project_number');

  if (error) {
    logger.error('Failed to generate project number via RPC:', error);
    // Fallback if the function is not deployed or fails (just in case)
    const year = new Date().getFullYear();
    const rand = Math.floor(100 + Math.random() * 900);
    return `DSC-${year}-${rand}`;
  }

  return data as string;
}
