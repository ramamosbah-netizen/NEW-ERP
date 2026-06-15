// ============================================================
// JEET ERP — HR: Training & Competency service
// Skill catalogue, employee×skill matrix and training records.
// Audit-logged; degrades to [] before the migration is applied.
// ============================================================

import { supabase } from '@/lib/supabase';
import { auditService } from './auditService';

export interface Skill { id: string; name: string; category: string | null; description: string | null; is_active: boolean; }
export interface Competency { id: string; employee_id: string; skill_id: string; level: number; notes: string | null; }
export interface Training { id: string; employee_id: string; course_name: string; provider: string | null; completed_date: string | null; expiry_date: string | null; status: string; notes: string | null; created_by_name: string | null; created_at: string; }

const MISSING = (e: any) => e && (e.code === 'PGRST205' || e.code === 'PGRST204' || /could not find the table|does not exist/i.test(e.message || ''));

export const competencyService = {
  async listSkills(): Promise<Skill[]> {
    const { data, error } = await supabase.from('competency_skills').select('*').order('name');
    if (error) { if (MISSING(error)) return []; throw error; }
    return (data || []) as Skill[];
  },
  async addSkill(input: { name: string; category?: string; description?: string }): Promise<string> {
    const { data, error } = await supabase.from('competency_skills').insert({ name: input.name, category: input.category || null, description: input.description || null }).select('id').single();
    if (error) throw error;
    auditService.logEvent({ module: 'HR', action: 'CREATE', entity_type: 'competency_skill', entity_id: data.id, summary: `Skill: ${input.name}` });
    return data.id;
  },
  async removeSkill(id: string): Promise<void> {
    const { error } = await supabase.from('competency_skills').delete().eq('id', id);
    if (error) throw error;
    auditService.logEvent({ module: 'HR', action: 'DELETE', entity_type: 'competency_skill', entity_id: id, summary: 'Removed skill' });
  },

  async listCompetencies(): Promise<Competency[]> {
    const { data, error } = await supabase.from('employee_competencies').select('*');
    if (error) { if (MISSING(error)) return []; throw error; }
    return (data || []) as Competency[];
  },
  async setCompetency(employee_id: string, skill_id: string, level: number): Promise<void> {
    const { error } = await supabase.from('employee_competencies').upsert({ employee_id, skill_id, level, updated_at: new Date().toISOString() }, { onConflict: 'employee_id,skill_id' });
    if (error) throw error;
    auditService.logEvent({ module: 'HR', action: 'UPDATE', entity_type: 'employee_competency', entity_id: `${employee_id}:${skill_id}`, summary: `Set competency level ${level}` });
  },

  async listTraining(): Promise<Training[]> {
    const { data, error } = await supabase.from('training_records').select('*').order('completed_date', { ascending: false });
    if (error) { if (MISSING(error)) return []; throw error; }
    return (data || []) as Training[];
  },
  async addTraining(input: Partial<Training> & { employee_id: string; course_name: string }): Promise<string> {
    const payload = { employee_id: input.employee_id, course_name: input.course_name, provider: input.provider || null, completed_date: input.completed_date || null, expiry_date: input.expiry_date || null, status: input.status || 'COMPLETED', notes: input.notes || null, created_by_name: input.created_by_name || null };
    const { data, error } = await supabase.from('training_records').insert(payload).select('id').single();
    if (error) throw error;
    auditService.logEvent({ module: 'HR', action: 'CREATE', entity_type: 'training_record', entity_id: data.id, summary: `Training: ${input.course_name}` });
    return data.id;
  },
  async removeTraining(id: string): Promise<void> {
    const { error } = await supabase.from('training_records').delete().eq('id', id);
    if (error) throw error;
    auditService.logEvent({ module: 'HR', action: 'DELETE', entity_type: 'training_record', entity_id: id, summary: 'Removed training' });
  },
};

export default competencyService;
