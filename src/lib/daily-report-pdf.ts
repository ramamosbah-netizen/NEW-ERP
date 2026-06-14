// ============================================================
// JEET ERP — Daily Site Report PDF (for the consultant/client)
// ============================================================

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { DailySiteReport } from '@/services/dailySiteReportService';

const PRIMARY: [number, number, number] = [6, 8, 20];
const ACCENT: [number, number, number] = [37, 99, 235];
const GRAY: [number, number, number] = [100, 116, 139];

const fmtDate = (d?: string | null) => d ? new Date(d).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }) : '—';

export const dailyReportPDF = {
  generate(r: DailySiteReport): jsPDF {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const w = doc.internal.pageSize.getWidth();
    const h = doc.internal.pageSize.getHeight();

    doc.setFillColor(...PRIMARY); doc.rect(0, 0, w, 30, 'F');
    doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(16);
    doc.text('JEET INTECH L.L.C', 14, 14);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(180, 190, 200);
    doc.text('ELV & SECURITY SYSTEMS INTEGRATOR', 14, 19);
    doc.setTextColor(255, 255, 255); doc.setFontSize(11); doc.setFont('helvetica', 'bold');
    doc.text('DAILY SITE REPORT', w - 14, 16, { align: 'right' });

    doc.setTextColor(...PRIMARY); doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...GRAY);
    let y = 40;
    doc.text(`Project: ${r.project_number || ''} — ${r.project_name || ''}`, 14, y);
    doc.text(`Date: ${fmtDate(r.report_date)}`, w - 14, y, { align: 'right' }); y += 6;
    doc.text(`Weather: ${r.weather || '—'}${r.temperature_c != null ? ` · ${r.temperature_c}°C` : ''}`, 14, y);
    doc.text(`Total manpower: ${r.total_manpower}`, w - 14, y, { align: 'right' }); y += 8;

    if (r.manpower?.length) {
      autoTable(doc, {
        startY: y, theme: 'grid', styles: { fontSize: 9, cellPadding: 2 },
        head: [['Trade', 'Manpower']], headStyles: { fillColor: ACCENT, textColor: [255, 255, 255] },
        body: r.manpower.map(m => [m.trade, String(m.count)]),
        columnStyles: { 1: { halign: 'right', cellWidth: 40 } }, margin: { left: 14, right: 14 },
      });
      y = (doc as any).lastAutoTable.finalY + 6;
    }

    const section = (title: string, text?: string | null) => {
      if (!text || !text.trim()) return;
      if (y > h - 30) { doc.addPage(); y = 20; }
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); doc.setTextColor(...ACCENT);
      doc.text(title, 14, y); y += 5;
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(50, 60, 75);
      const lines = doc.splitTextToSize(text.trim(), w - 28);
      doc.text(lines, 14, y); y += lines.length * 4.5 + 5;
    };
    section('WORK EXECUTED', r.work_done);
    section('MATERIALS RECEIVED', r.materials_received);
    section('EQUIPMENT ON SITE', r.equipment_on_site);
    section('DELAYS / ISSUES', r.delays_issues);
    section('SAFETY / HSE', r.safety_notes);
    section('VISITORS', r.visitors);

    if ((r.photo_document_ids || []).length) {
      if (y > h - 20) { doc.addPage(); y = 20; }
      doc.setFontSize(8); doc.setTextColor(...GRAY);
      doc.text(`${r.photo_document_ids.length} photo(s) attached in the document register.`, 14, y);
    }

    // Footer
    doc.setDrawColor(220, 225, 230); doc.line(14, h - 12, w - 14, h - 12);
    doc.setFontSize(7); doc.setTextColor(...GRAY);
    doc.text(`Daily Site Report · ${r.project_number || ''} · ${fmtDate(r.report_date)} · ${r.status}`, 14, h - 8);
    doc.text('JEET INTECH L.L.C', w - 14, h - 8, { align: 'right' });
    return doc;
  },

  download(r: DailySiteReport): void {
    this.generate(r).save(`DSR_${r.project_number || 'project'}_${r.report_date}.pdf`);
  },
};

export default dailyReportPDF;
