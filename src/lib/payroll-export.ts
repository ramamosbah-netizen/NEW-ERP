// ============================================================
// JEET ERP — Payroll sheet Excel export
// Produces the payroll run's sheet (per-employee gross/net) as
// .xlsx — the final output the accounts team needs without opening
// the HR/payroll module.
// ============================================================

import * as XLSX from 'xlsx';
import { supabase } from '@/lib/supabase';

const money = (v: number) => Math.round((Number(v) || 0) * 100) / 100;

/** period: 'YYYY-MM' (the run's month). Throws if no run found. */
export async function exportPayrollSheetExcel(period: string): Promise<void> {
  const periodMonth = `${period}-01`;
  const { data: run } = await supabase
    .from('payroll_runs').select('id, period_month, status, gross_total, net_total')
    .eq('period_month', periodMonth).maybeSingle();
  if (!run) throw new Error(`No payroll run found for ${period}`);

  const { data: lines } = await supabase
    .from('payroll_lines').select('employee_id, gross_pay, net_pay').eq('run_id', run.id);
  const empIds = Array.from(new Set((lines || []).map((l: any) => l.employee_id)));
  const { data: emps } = empIds.length
    ? await supabase.from('employees').select('id, employee_number, full_name_en, designation, department, assigned_project_id').in('id', empIds)
    : { data: [] as any[] };
  const empById = new Map((emps || []).map((e: any) => [e.id, e]));

  const header = [
    ['JEET INTECH L.L.C — Payroll Sheet'],
    [`Period: ${period}`, '', `Status: ${run.status}`, '', `Generated: ${new Date().toLocaleString('en-AE')}`],
    [],
    ['#', 'Employee No', 'Name', 'Designation', 'Department', 'Gross Pay (AED)', 'Net Pay (AED)'],
  ];
  const body = (lines || []).map((l: any, i: number) => {
    const e = empById.get(l.employee_id) || {};
    return [i + 1, e.employee_number || '', e.full_name_en || '', e.designation || '', e.department || '',
      money(l.gross_pay), money(l.net_pay)];
  });
  body.push([]);
  body.push(['', '', '', '', 'TOTAL', money(run.gross_total), money(run.net_total)]);

  const ws = XLSX.utils.aoa_to_sheet([...header, ...body]);
  ws['!cols'] = [{ wch: 5 }, { wch: 14 }, { wch: 28 }, { wch: 22 }, { wch: 14 }, { wch: 16 }, { wch: 16 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Payroll');
  XLSX.writeFile(wb, `payroll_${period}.xlsx`);
}
