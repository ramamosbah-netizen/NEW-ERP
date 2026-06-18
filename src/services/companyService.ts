import { supabase } from '@/lib/supabase';
import { recordAudit } from '@/lib/audit/recordAudit';

// ============================================================
// Aura ERP — Company service (Multi-Company / Group foundation, Phase 0)
// CRUD over groups / companies / company_members. All writes are admin-only
// (enforced by RLS) and audited. Reads back the JEET group structure for the
// Administration → Companies governance page and the company switcher.
// ============================================================

export interface Group {
  id: string;
  name: string;
  code: string | null;
  is_active: boolean;
}

export interface Company {
  id: string;
  group_id: string | null;
  group_name?: string | null;
  name: string;
  code: string | null;
  legal_name: string | null;
  is_active: boolean;
  member_count?: number;
}

export interface CompanyMember {
  id: string;
  user_id: string;
  company_id: string;
  is_default: boolean;
  full_name: string | null;
  email: string | null;
}

export interface CompanyInput {
  group_id: string | null;
  name: string;
  code: string | null;
  legal_name?: string | null;
  is_active?: boolean;
}

export const companyService = {
  async getGroups(): Promise<Group[]> {
    const { data, error } = await supabase
      .from('groups')
      .select('id, name, code, is_active')
      .order('name');
    if (error) throw error;
    return (data || []) as Group[];
  },

  /** All companies with group name + member count (admin governance view). */
  async getCompanies(): Promise<Company[]> {
    const [{ data: companies, error }, { data: groups }, { data: members }] = await Promise.all([
      supabase.from('companies').select('id, group_id, name, code, legal_name, is_active').order('name'),
      supabase.from('groups').select('id, name'),
      supabase.from('company_members').select('company_id'),
    ]);
    if (error) throw error;
    const groupName = new Map(((groups || []) as { id: string; name: string }[]).map(g => [g.id, g.name]));
    const counts = new Map<string, number>();
    ((members || []) as { company_id: string }[]).forEach(m => counts.set(m.company_id, (counts.get(m.company_id) || 0) + 1));
    return ((companies || []) as Company[]).map(c => ({
      ...c,
      group_name: c.group_id ? groupName.get(c.group_id) ?? null : null,
      member_count: counts.get(c.id) || 0,
    }));
  },

  /** Companies the current user belongs to (for the switcher). Admins see all. */
  async getMyCompanies(): Promise<Company[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];
    const { data: prof } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
    if ((prof as { role?: string } | null)?.role === 'admin') return this.getCompanies();

    const { data: mem } = await supabase.from('company_members').select('company_id, is_default').eq('user_id', user.id);
    const ids = ((mem || []) as { company_id: string }[]).map(m => m.company_id);
    if (!ids.length) return [];
    const { data: companies, error } = await supabase
      .from('companies').select('id, group_id, name, code, legal_name, is_active').in('id', ids).order('name');
    if (error) throw error;
    return (companies || []) as Company[];
  },

  async createCompany(input: CompanyInput): Promise<Company> {
    const { data, error } = await supabase
      .from('companies')
      .insert({ group_id: input.group_id, name: input.name, code: input.code, legal_name: input.legal_name ?? null, is_active: input.is_active ?? true })
      .select('id, group_id, name, code, legal_name, is_active')
      .single();
    if (error) throw error;
    const company = data as Company;
    await recordAudit({ action: 'CREATE', entity_type: 'COMPANY', entity_id: company.id, entity_label: company.name, summary: `Created company ${company.name}`, after: company, module: 'SYSTEM' });
    return company;
  },

  async updateCompany(id: string, patch: Partial<CompanyInput>): Promise<void> {
    const { data: before } = await supabase.from('companies').select('*').eq('id', id).maybeSingle();
    const { error } = await supabase.from('companies').update(patch).eq('id', id);
    if (error) throw error;
    await recordAudit({ action: 'UPDATE', entity_type: 'COMPANY', entity_id: id, entity_label: patch.name ?? (before as { name?: string } | null)?.name ?? id, summary: `Updated company`, before: before as Record<string, unknown> | null, after: patch, module: 'SYSTEM' });
  },

  async setCompanyActive(id: string, active: boolean, name?: string): Promise<void> {
    const { error } = await supabase.from('companies').update({ is_active: active }).eq('id', id);
    if (error) throw error;
    await recordAudit({ action: 'UPDATE', entity_type: 'COMPANY', entity_id: id, entity_label: name ?? id, summary: `${active ? 'Activated' : 'Deactivated'} company`, after: { is_active: active }, module: 'SYSTEM' });
  },

  // ---------- members ----------
  async getMembers(companyId: string): Promise<CompanyMember[]> {
    const { data: mem, error } = await supabase
      .from('company_members')
      .select('id, user_id, company_id, is_default')
      .eq('company_id', companyId);
    if (error) throw error;
    const rows = (mem || []) as Omit<CompanyMember, 'full_name' | 'email'>[];
    if (!rows.length) return [];
    const { data: profs } = await supabase.from('profiles').select('id, full_name, email').in('id', rows.map(r => r.user_id));
    const pmap = new Map(((profs || []) as { id: string; full_name: string | null; email: string | null }[]).map(p => [p.id, p]));
    return rows.map(r => ({ ...r, full_name: pmap.get(r.user_id)?.full_name ?? null, email: pmap.get(r.user_id)?.email ?? null }));
  },

  async addMember(companyId: string, userId: string, companyName?: string): Promise<void> {
    const { error } = await supabase.from('company_members').insert({ company_id: companyId, user_id: userId, is_default: false });
    if (error) throw error;
    await recordAudit({ action: 'CREATE', entity_type: 'COMPANY_MEMBER', entity_id: companyId, entity_label: companyName ?? companyId, summary: `Added member to company`, after: { company_id: companyId, user_id: userId }, module: 'SYSTEM' });
  },

  async removeMember(memberId: string, companyId: string, companyName?: string): Promise<void> {
    const { error } = await supabase.from('company_members').delete().eq('id', memberId);
    if (error) throw error;
    await recordAudit({ action: 'DELETE', entity_type: 'COMPANY_MEMBER', entity_id: companyId, entity_label: companyName ?? companyId, summary: `Removed member from company`, before: { id: memberId }, module: 'SYSTEM' });
  },

  /** Make this company the user's default (clears any other default for that user). */
  async setDefaultCompany(userId: string, companyId: string): Promise<void> {
    await supabase.from('company_members').update({ is_default: false }).eq('user_id', userId).neq('company_id', companyId);
    const { error } = await supabase.from('company_members').update({ is_default: true }).eq('user_id', userId).eq('company_id', companyId);
    if (error) throw error;
  },

  /** Users for the add-member picker. */
  async listUsers(): Promise<{ id: string; full_name: string | null; email: string | null }[]> {
    const { data, error } = await supabase.from('profiles').select('id, full_name, email').order('full_name');
    if (error) throw error;
    return (data || []) as { id: string; full_name: string | null; email: string | null }[];
  },
};

export default companyService;
