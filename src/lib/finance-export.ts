// ============================================================
// JEET ERP — Finance: shared table export (PDF + Excel + CSV)
// One helper used by every finance report/list so exports look
// consistent. PDF via jsPDF + autoTable; Excel/CSV via SheetJS.
// ============================================================

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

export interface ExportTable {
  title: string;
  subtitle?: string;
  columns: string[];
  rows: (string | number)[][];
  fileName?: string;     // without extension
}

const PRIMARY: [number, number, number] = [6, 8, 20];
const ACCENT: [number, number, number] = [37, 99, 235];
const safeName = (s: string) => (s || 'export').replace(/[^a-z0-9]+/gi, '_').slice(0, 60);

export function exportTablePdf(t: ExportTable): void {
  const landscape = t.columns.length > 6;
  const doc = new jsPDF({ orientation: landscape ? 'landscape' : 'portrait', unit: 'mm', format: 'a4' });
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();

  doc.setFillColor(...PRIMARY); doc.rect(0, 0, w, 26, 'F');
  doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(13);
  doc.text('JEET INTECH L.L.C', 14, 12);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(180, 190, 200);
  doc.text('ELV & SECURITY SYSTEMS INTEGRATOR', 14, 17);
  doc.setTextColor(255, 255, 255); doc.setFontSize(8);
  doc.text(new Date().toLocaleString('en-AE'), w - 14, 12, { align: 'right' });

  doc.setTextColor(...PRIMARY); doc.setFont('helvetica', 'bold'); doc.setFontSize(13);
  doc.text(t.title, 14, 36);
  if (t.subtitle) { doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(100, 116, 139); doc.text(t.subtitle, 14, 42); }

  autoTable(doc, {
    startY: t.subtitle ? 46 : 40,
    head: [t.columns], body: t.rows.map(r => r.map(c => (c === null || c === undefined) ? '' : String(c))),
    theme: 'striped', styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: ACCENT, textColor: [255, 255, 255], fontStyle: 'bold' },
    margin: { left: 14, right: 14 },
  });

  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p); doc.setFontSize(7); doc.setTextColor(100, 116, 139);
    doc.text(`${t.title} · JEET INTECH L.L.C`, 14, h - 8);
    doc.text(`Page ${p} of ${pages}`, w - 14, h - 8, { align: 'right' });
  }
  doc.save(`${safeName(t.fileName || t.title)}.pdf`);
}

export function exportTableExcel(t: ExportTable): void {
  const aoa: any[][] = [[t.title]];
  if (t.subtitle) aoa.push([t.subtitle]);
  aoa.push([]); aoa.push(t.columns); aoa.push(...t.rows);
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = t.columns.map((c, i) => ({ wch: Math.min(40, Math.max(12, c.length + 2, ...t.rows.map(r => String(r[i] ?? '').length + 2))) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  XLSX.writeFile(wb, `${safeName(t.fileName || t.title)}.xlsx`);
}

export function exportTableCsv(t: ExportTable): void {
  const esc = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = [t.columns.map(esc).join(','), ...t.rows.map(r => r.map(esc).join(','))].join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
  const a = document.createElement('a'); a.href = url; a.download = `${safeName(t.fileName || t.title)}.csv`; a.click(); URL.revokeObjectURL(url);
}
