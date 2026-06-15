// ============================================================
// JEET ERP — Pre-Sales: Client / CRM service
// CRUD over clients (+ optional CRM fields with a PGRST204
// fallback so it works before the migration is applied) and a
// per-client 360 aggregation. Audit-logged.
// ============================================================

import { supabase } from '@/lib/supabase';
import { auditService } from './auditService';

export interface Client {
  id: string;
  name: string;
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  country?: string | null;
  contact_person?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  // CRM (may be absent before migration)
  segment?: string | null;
  industry?: string | null;
  owner_name?: string | null;
  status?: string | null;
  website?: string | null;
  trn?: string | null;
  notes?: string | null;
  created_at?: string;
}

const CRM_FIELDS = ['segment', 'industry', 'owner_name', 'status', 'website', 'trn', 'notes'];
const CORE_FIELDS = ['name', 'address_line1', 'address_line2', 'city', 'country', 'contact_person', 'contact_email', 'contact_phone'];

function pick(input: any, keys: string[]) {
  const out: any = {};
  keys.forEach(k => { if (k in input && input[k] !== undefined) out[k] = input[k]; });
  return out;
}

export const clientService = {
  async list(): Promise<Client[]> {
    const { data, error } = await supabase.from('clients').select('*').order('name');
    if (error) throw error;
    return (data || []) as Client[];
  },

  async get(id: string): Promise<Client | null> {
    const { data, error } = await supabase.from('clients').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return (data as Client) || null;
  },

  // create/update with graceful degradation if CRM columns don't exist yet
  async save(input: Partial<Client> & { name: string }, id?: string): Promise<string> {
    const full = { ...pick(input, CORE_FIELDS), ...pick(input, CRM_FIELDS) };
    const core = pick(input, CORE_FIELDS);

    const run = async (payload: any) => {
      if (id) return supabase.from('clients').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', id).select('id').single();
      return supabase.from('clients').insert(payload).select('id').single();
    };

    let { data, error } = await run(full);
    if (error && (error.code === 'PGRST204' || /column .* does not exist/i.test(error.message || ''))) {
      // CRM migration not applied — retry with core fields only
      ({ data, error } = await run(core));
    }
    if (error) throw error;
    const savedId = (data as any).id;
    auditService.logEvent({ module: 'Sales', action: id ? 'UPDATE' : 'CREATE', entity_type: 'client', entity_id: savedId, summary: `${id ? 'Updated' : 'Created'} client ${input.name}` });
    return savedId;
  },

  // Per-client 360: tenders (by name), quotations + AMC (by client_id)
  async get360(id: string, clientName: string) {
    const [tn, qt, amc] = await Promise.all([
      clientName ? supabase.from('tenders').select('id, title, project_name, status, budget, deadline_date, created_at').eq('client_name', clientName) : Promise.resolve({ data: [] as any[] }),
      supabase.from('quotations').select('id, quotation_number, status, grand_total_with_vat, quotation_date, linked_project_id, actual_project_id, client_response').eq('client_id', id),
      supabase.from('amc_contracts').select('id, contract_number, status, annual_value, end_date, site_name').eq('client_id', id),
    ]);
    return { tenders: tn.data || [], quotations: qt.data || [], contracts: amc.data || [] };
  },
};

export default clientService;
