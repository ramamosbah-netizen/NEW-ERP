// ============================================================
// JEET ERP — HR: Attendance & GPS service
// Daily check-in/out with geolocation. Audit-logged; degrades
// to [] before the migration is applied.
// ============================================================

import { supabase } from '@/lib/supabase';
import { auditService } from './auditService';

export interface Attendance {
  id: string;
  employee_id: string;
  work_date: string;
  check_in_at: string | null;
  check_out_at: string | null;
  check_in_lat: number | null;
  check_in_lng: number | null;
  check_out_lat: number | null;
  check_out_lng: number | null;
  location_label: string | null;
  status: string;
  hours: number;
  notes: string | null;
}

const MISSING = (e: any) => e && (e.code === 'PGRST205' || e.code === 'PGRST204' || /could not find the table|does not exist/i.test(e.message || ''));
const today = () => new Date().toISOString().slice(0, 10);

export const attendanceService = {
  async list(opts?: { date?: string }): Promise<Attendance[]> {
    let q = supabase.from('attendance_records').select('*').order('check_in_at', { ascending: false });
    if (opts?.date) q = q.eq('work_date', opts.date);
    const { data, error } = await q;
    if (error) { if (MISSING(error)) return []; throw error; }
    return (data || []) as Attendance[];
  },

  async checkIn(employee_id: string, geo?: { lat?: number; lng?: number; label?: string }): Promise<void> {
    const payload = {
      employee_id, work_date: today(), check_in_at: new Date().toISOString(),
      check_in_lat: geo?.lat ?? null, check_in_lng: geo?.lng ?? null, location_label: geo?.label || null, status: 'PRESENT',
    };
    const { error } = await supabase.from('attendance_records').upsert(payload, { onConflict: 'employee_id,work_date' });
    if (error) throw error;
    auditService.logEvent({ module: 'HR', action: 'CHECK_IN', entity_type: 'attendance', entity_id: employee_id, summary: 'Checked in' });
  },

  async checkOut(record: Attendance, geo?: { lat?: number; lng?: number }): Promise<void> {
    const out = new Date();
    const hours = record.check_in_at ? Math.round((out.getTime() - new Date(record.check_in_at).getTime()) / 3600000 * 100) / 100 : 0;
    const { error } = await supabase.from('attendance_records').update({
      check_out_at: out.toISOString(), check_out_lat: geo?.lat ?? null, check_out_lng: geo?.lng ?? null, hours, updated_at: out.toISOString(),
    }).eq('id', record.id);
    if (error) throw error;
    auditService.logEvent({ module: 'HR', action: 'CHECK_OUT', entity_type: 'attendance', entity_id: record.id, summary: `Checked out (${hours}h)` });
  },
};

export default attendanceService;
