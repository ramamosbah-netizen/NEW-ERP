// ============================================================
// JEET ERP — Document Search Service
// Full-text search using Postgres tsvector websearch_to_tsquery
// ============================================================

import { supabase } from './supabase';
import type { Document } from '../types/document.types';

/**
 * Performs full-text search on documents using the Supabase search_documents RPC function.
 * Matches keywords against Title (Weight A), References (Weight A), Summary (Weight B), and Text Content (Weight C).
 */
export async function searchDocuments(
  query: string, 
  maxResults: number = 50
): Promise<Document[]> {
  if (!query || query.trim() === '') return [];

  const { data, error } = await supabase.rpc('search_documents', {
    search_query: query,
    max_results: maxResults
  });

  if (error) {
    console.error('Full text search RPC failed, falling back to text match:', error);
    // Fallback: simple client/server side like query
    const { data: fallbackData, error: fallbackError } = await supabase
      .from('documents')
      .select('*')
      .eq('is_active', true)
      .or(`title.ilike.%${query}%,original_filename.ilike.%${query}%,ai_summary.ilike.%${query}%`)
      .order('created_at', { ascending: false })
      .limit(maxResults);

    if (fallbackError) throw fallbackError;
    return (fallbackData || []) as Document[];
  }

  return (data || []) as Document[];
}
