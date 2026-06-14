// ============================================================
// JEET ERP — Finance: Treasury service
// Bank facilities (loans/overdrafts/guarantees/LCs): limit vs
// utilization and maturity tracking. Self-contained.
// ============================================================

import { supabase } from '@/lib/supabase';

export type FacilityType = 'LOAN' | 'OVERDRAFT' | 'FACILITY' | 'BANK_GUARANTEE' | 'LC';
export type FacilityStatus = 'ACTIVE' | 'EXPIRED' | 'CLOSED' | 'RELEASED';

export interface Facility {
  id: string; type: FacilityType; reference: string | null; bank_name: string; beneficiary: string | null;
  facility_limit: number; utilized_amount: number; interest_rate: number | null;
  issue_date: string | null; maturity_date: string | null; status: FacilityStatus; notes: string | null;
  available: number; daysToMaturity: number | null; expiringSoon: boolean;
}

const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
const safe = async <T>(p: PromiseLike<{ data: T | null; error: unknown }>, fb: T): Promise<T> => {
  try { const { data } = await p; return data ?? fb; } catch { return fb; }
};

export const treasuryService = {
  async list(): Promise<Facility[]> {
    const rows = await safe<any[]>(supabase.from('treasury_facilities').select('*').order('maturity_date', { ascending: true }), []);
    const now = Date.now();
    return rows.map((f: any) => {
      const days = f.maturity_date ? Math.ceil((new Date(f.maturity_date).getTime() - now) / 86400000) : null;
      return {
        ...f, facility_limit: r2(f.facility_limit), utilized_amount: r2(f.utilized_amount),
        available: r2((Number(f.facility_limit) || 0) - (Number(f.utilized_amount) || 0)),
        daysToMaturity: days, expiringSoon: f.status === 'ACTIVE' && days !== null && days <= 60 && days >= 0,
      };
    });
  },

  async create(input: Partial<Facility>): Promise<void> {
    const { data: auth } = await supabase.auth.getUser();
    if (!input.bank_name) throw new Error('Bank name is required.');
    const { error } = await supabase.from('treasury_facilities').insert({
      type: input.type || 'FACILITY', reference: input.reference || null, bank_name: input.bank_name,
      beneficiary: input.beneficiary || null, facility_limit: Number(input.facility_limit) || 0,
      utilized_amount: Number(input.utilized_amount) || 0, interest_rate: input.interest_rate ?? null,
      issue_date: input.issue_date || null, maturity_date: input.maturity_date || null,
      status: 'ACTIVE', notes: input.notes || null, created_by: auth?.user?.id ?? null,
    });
    if (error) throw new Error(error.message);
  },

  async setStatus(id: string, status: FacilityStatus): Promise<void> {
    await supabase.from('treasury_facilities').update({ status, updated_at: new Date().toISOString() }).eq('id', id);
  },
};

export default treasuryService;
