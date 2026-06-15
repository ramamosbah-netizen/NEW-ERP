'use client';

// ============================================================
// JEET ERP — HR: Attendance & GPS
// Daily check-in/out with browser geolocation, per-day summary.
// Migration adds the table; degrades gracefully without it.
// ============================================================

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import attendanceService, { Attendance } from '@/services/attendanceService';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { exportTablePdf, exportTableExcel } from '@/lib/finance-export';
import { MapPin, FileDown, Sheet, LogIn, LogOut } from 'lucide-react';

const today = () => new Date().toISOString().slice(0, 10);
const fmtTime = (d: string | null) => d ? new Date(d).toLocaleTimeString('en-AE', { hour: '2-digit', minute: '2-digit' }) : '—';

function getGeo(): Promise<{ lat?: number; lng?: number }> {
  return new Promise(resolve => {
    if (!navigator.geolocation) return resolve({});
    navigator.geolocation.getCurrentPosition(
      p => resolve({ lat: Math.round(p.coords.latitude * 1e6) / 1e6, lng: Math.round(p.coords.longitude * 1e6) / 1e6 }),
      () => resolve({}), { timeout: 8000 }
    );
  });
}

export default function AttendancePage() {
  const [date, setDate] = useState(today());
  const [records, setRecords] = useState<Attendance[]>([]);
  const [employees, setEmployees] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [checkInEmp, setCheckInEmp] = useState('');

  const empMap = useMemo(() => new Map(employees.map(e => [e.id, e.name])), [employees]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [rec, em] = await Promise.all([attendanceService.list({ date }), supabase.from('employees').select('id, full_name_en').eq('is_active', true)]);
      setRecords(rec);
      setEmployees((em.data || []).map((e: any) => ({ id: e.id, name: e.full_name_en })));
    } finally { setLoading(false); }
  }, [date]);
  useEffect(() => { load(); }, [load]);

  const doCheckIn = async () => {
    if (!checkInEmp) { alert('Select an employee to check in.'); return; }
    setBusy(true);
    try { const geo = await getGeo(); await attendanceService.checkIn(checkInEmp, geo); setCheckInEmp(''); await load(); }
    catch (e: any) { alert(e?.message || 'Check-in failed — apply the attendance migration.'); } finally { setBusy(false); }
  };
  const doCheckOut = async (r: Attendance) => {
    setBusy(true);
    try { const geo = await getGeo(); await attendanceService.checkOut(r, geo); await load(); }
    catch (e: any) { alert(e?.message || 'Check-out failed'); } finally { setBusy(false); }
  };

  const isToday = date === today();
  const checkedIn = records.filter(r => r.check_in_at && !r.check_out_at).length;
  const completed = records.filter(r => r.check_out_at).length;
  const totalHours = records.reduce((s, r) => s + Number(r.hours || 0), 0);
  const notCheckedIn = isToday ? employees.filter(e => !records.some(r => r.employee_id === e.id)) : [];

  const exportCols = ['Employee', 'Date', 'Check in', 'Check out', 'Hours', 'Location'];
  const exportRows = records.map(r => [empMap.get(r.employee_id) || '', r.work_date, fmtTime(r.check_in_at), fmtTime(r.check_out_at), r.hours, r.check_in_lat ? `${r.check_in_lat}, ${r.check_in_lng}` : '']);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Attendance & GPS"
        subtitle="Daily check-in / check-out with geolocation"
        breadcrumbs={[{ label: 'HR', href: '/hr' }, { label: 'Attendance' }]}
        actions={records.length > 0 ? (
          <div className="flex gap-2">
            <Button variant="secondary" icon={FileDown} onClick={() => exportTablePdf({ title: 'Attendance', subtitle: date, columns: exportCols, rows: exportRows, fileName: 'attendance' })}>PDF</Button>
            <Button variant="secondary" icon={Sheet} onClick={() => exportTableExcel({ title: 'Attendance', subtitle: date, columns: exportCols, rows: exportRows, fileName: 'attendance' })}>Excel</Button>
          </div>
        ) : undefined}
      />

      <Card className="p-4 flex flex-col md:flex-row md:items-end gap-3">
        <label className="text-xs text-[var(--text-secondary)]">Date<input type="date" value={date} onChange={e => setDate(e.target.value)} className="block mt-1 px-2 h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm" /></label>
        {isToday && (
          <div className="flex items-end gap-2 md:ml-auto">
            <label className="text-xs text-[var(--text-secondary)]">Check in employee
              <select value={checkInEmp} onChange={e => setCheckInEmp(e.target.value)} className="block mt-1 px-2 h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm w-56"><option value="">Select…</option>{notCheckedIn.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</select>
            </label>
            <Button icon={LogIn} onClick={doCheckIn} isLoading={busy}>Check in (GPS)</Button>
          </div>
        )}
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Records</div><div className="text-2xl font-bold mt-1">{records.length}</div></Card>
        <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">On site (in, no out)</div><div className="text-2xl font-bold mt-1" style={{ color: checkedIn ? 'var(--status-success-text)' : 'var(--text-primary)' }}>{checkedIn}</div></Card>
        <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Completed</div><div className="text-2xl font-bold mt-1">{completed}</div></Card>
        <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Total hours</div><div className="text-2xl font-bold mt-1">{Math.round(totalHours * 10) / 10}</div></Card>
      </div>

      {loading ? (
        <Card><div className="p-8 text-center text-sm text-[var(--text-tertiary)]">Loading…</div></Card>
      ) : records.length === 0 ? (
        <Card><EmptyState icon={MapPin} title="No attendance" description={isToday ? 'Check in an employee to start. Apply the attendance migration if it fails.' : 'No attendance recorded for this date.'} /></Card>
      ) : (
        <Card className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-[var(--border)] text-left text-[var(--text-tertiary)] text-xs">
              <th className="p-3">Employee</th><th className="p-3">Check in</th><th className="p-3">Check out</th><th className="p-3 text-right">Hours</th><th className="p-3">Location</th><th className="p-3"></th>
            </tr></thead>
            <tbody>
              {records.map(r => (
                <tr key={r.id} className="border-b border-[var(--border)] last:border-0">
                  <td className="p-3 font-medium text-[var(--text-primary)]">{empMap.get(r.employee_id) || '—'}</td>
                  <td className="p-3 text-xs text-[var(--text-secondary)]">{fmtTime(r.check_in_at)}</td>
                  <td className="p-3 text-xs text-[var(--text-secondary)]">{fmtTime(r.check_out_at)}</td>
                  <td className="p-3 text-right tabular-nums">{r.hours ? `${r.hours}h` : '—'}</td>
                  <td className="p-3 text-xs">{r.check_in_lat ? <a href={`https://maps.google.com/?q=${r.check_in_lat},${r.check_in_lng}`} target="_blank" rel="noreferrer" className="text-[var(--accent)] inline-flex items-center gap-1" onClick={e => e.stopPropagation()}><MapPin size={11} />Map</a> : <span className="text-[var(--text-tertiary)]">—</span>}</td>
                  <td className="p-3 text-right">{r.check_in_at && !r.check_out_at && isToday ? <Button variant="secondary" icon={LogOut} onClick={() => doCheckOut(r)} disabled={busy}>Check out</Button> : null}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
