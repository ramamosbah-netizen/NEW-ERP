// ============================================================
// JEET ERP — Tender PDF Export Service
// Client-side document generation using jsPDF + autoTable.
// Renders a professional tender summary: header, key details,
// scope of work, technical & client requirements, BOQ value,
// awarded project, attachments and status history.
// ============================================================

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const fmtAED = (v: number) =>
  new Intl.NumberFormat('en-AE', { maximumFractionDigits: 0 }).format(v) + ' AED';

const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

export type TenderPdfData = {
  id: string;
  title: string;
  project_name?: string;
  client_name?: string;
  location?: string;
  deadline_date?: string;
  budget?: number | null;
  status?: string;
  scope_of_work?: string;
  tech_discipline?: string | null;
  tech_equipment_list?: string | null;
  tech_standards?: string | null;
  tech_notes?: string | null;
  client_special_requests?: string | null;
  client_compliance?: string | null;
  client_delivery_expectations?: string | null;
  client_warranty?: string | null;
  status_history?: { status: string; updated_at: string; note?: string }[];
  created_at?: string;
  updated_at?: string;
};

export type TenderPdfExtras = {
  boqStatus?: string;
  boqTotal?: number;
  projectNumber?: string | null;
  documents?: { file_name: string; file_size?: number }[];
};

const PRIMARY: [number, number, number] = [6, 8, 20];
const ACCENT: [number, number, number] = [37, 99, 235];
const GRAY: [number, number, number] = [100, 116, 139];
const LIGHT: [number, number, number] = [248, 250, 252];

export const tenderPDFService = {
  generate(tender: TenderPdfData, extras: TenderPdfExtras = {}): jsPDF {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const refNo = `TND-${tender.id.substring(0, 8).toUpperCase()}`;

    // ----- Header band -----
    doc.setFillColor(...PRIMARY);
    doc.rect(0, 0, pageWidth, 40, 'F');

    doc.setFillColor(...ACCENT);
    doc.rect(15, 11, 7, 11, 'F');
    doc.setFillColor(255, 255, 255);
    doc.rect(19, 14, 7, 11, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(19);
    doc.text('JEET INTECH L.L.C', 32, 19);
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(180, 190, 200);
    doc.text('ELV & SECURITY SYSTEMS INTEGRATOR', 32, 24);

    doc.setFontSize(7.5);
    doc.setTextColor(255, 255, 255);
    doc.text([
      'Dubai, United Arab Emirates',
      'TRN: 100489562300003',
      'info@jeetintech.com',
    ], pageWidth - 15, 13, { align: 'right' });

    // ----- Title block -----
    doc.setFillColor(...LIGHT);
    doc.rect(15, 46, pageWidth - 30, 22, 'F');
    doc.setDrawColor(220, 225, 230);
    doc.rect(15, 46, pageWidth - 30, 22, 'S');

    doc.setTextColor(...PRIMARY);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.text('TENDER SUMMARY', 20, 55);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...GRAY);
    doc.text(`Reference: ${refNo}`, 20, 61);
    doc.text(`Status: ${(tender.status || 'Draft').toUpperCase()}`, 20, 65.5);
    doc.text(`Submission Deadline: ${fmtDate(tender.deadline_date)}`, pageWidth / 2, 61);
    doc.text(`Generated: ${fmtDate(new Date().toISOString())}`, pageWidth / 2, 65.5);

    let y = 78;

    // ----- Tender title -----
    doc.setTextColor(...PRIMARY);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    const titleLines = doc.splitTextToSize(tender.title || 'Untitled Tender', pageWidth - 30);
    doc.text(titleLines, 15, y);
    y += titleLines.length * 6 + 2;

    // ----- Key details table -----
    const budgetDisplay = (extras.boqTotal && extras.boqTotal > 0)
      ? `${fmtAED(extras.boqTotal)}  (from BOQ)`
      : (tender.budget ? fmtAED(tender.budget) : 'Unspecified');

    autoTable(doc, {
      startY: y,
      theme: 'grid',
      styles: { fontSize: 8.5, cellPadding: 2.2, lineColor: [225, 230, 235], textColor: [40, 50, 65] },
      headStyles: { fillColor: ACCENT, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8.5 },
      head: [['Tender Details', '']],
      body: [
        ['Project Scope Title', tender.project_name || '—'],
        ['Client Authority', tender.client_name || '—'],
        ['Project Location', tender.location || '—'],
        ['Budget Sum', budgetDisplay],
        ['BOQ Status', extras.boqStatus ? extras.boqStatus.replace(/_/g, ' ').toUpperCase() : 'No BOQ linked'],
        ['Awarded Project', extras.projectNumber || '—'],
      ],
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 55, fillColor: [248, 250, 252] }, 1: { cellWidth: 'auto' } },
      margin: { left: 15, right: 15 },
    });
    y = (doc as any).lastAutoTable.finalY + 6;

    // ----- Section renderer -----
    const section = (heading: string, body?: string | null) => {
      if (!body || !body.trim()) return;
      if (y > pageHeight - 30) { doc.addPage(); y = 20; }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(...ACCENT);
      doc.text(heading.toUpperCase(), 15, y);
      y += 1.5;
      doc.setDrawColor(...ACCENT);
      doc.setLineWidth(0.3);
      doc.line(15, y, pageWidth - 15, y);
      y += 4;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(50, 60, 75);
      const lines = doc.splitTextToSize(body.trim(), pageWidth - 30);
      for (const line of lines) {
        if (y > pageHeight - 20) { doc.addPage(); y = 20; }
        doc.text(line, 15, y);
        y += 4.5;
      }
      y += 4;
    };

    section('Scope of Work', tender.scope_of_work);
    section('Technical — Discipline', tender.tech_discipline);
    section('Technical — Equipment List', tender.tech_equipment_list);
    section('Technical — Standards & Codes', tender.tech_standards);
    section('Technical — Notes', tender.tech_notes);
    section('Client — Special Requests', tender.client_special_requests);
    section('Client — Compliance Requirements', tender.client_compliance);
    section('Client — Delivery Expectations', tender.client_delivery_expectations);
    section('Client — Warranty Terms', tender.client_warranty);

    // ----- Attachments -----
    if (extras.documents && extras.documents.length > 0) {
      if (y > pageHeight - 40) { doc.addPage(); y = 20; }
      autoTable(doc, {
        startY: y,
        theme: 'striped',
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: PRIMARY, textColor: [255, 255, 255], fontStyle: 'bold' },
        head: [['#', 'Attached Specification Document']],
        body: extras.documents.map((d, i) => [String(i + 1), d.file_name]),
        margin: { left: 15, right: 15 },
      });
      y = (doc as any).lastAutoTable.finalY + 6;
    }

    // ----- Status history -----
    if (tender.status_history && tender.status_history.length > 0) {
      if (y > pageHeight - 40) { doc.addPage(); y = 20; }
      autoTable(doc, {
        startY: y,
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 2, lineColor: [225, 230, 235] },
        headStyles: { fillColor: ACCENT, textColor: [255, 255, 255], fontStyle: 'bold' },
        head: [['Date', 'Status', 'Note']],
        body: tender.status_history.map(h => [
          fmtDate(h.updated_at),
          (h.status || '').toUpperCase(),
          h.note || '—',
        ]),
        columnStyles: { 0: { cellWidth: 28 }, 1: { cellWidth: 32 }, 2: { cellWidth: 'auto' } },
        margin: { left: 15, right: 15 },
      });
    }

    // ----- Footer on every page -----
    const pages = doc.getNumberOfPages();
    for (let p = 1; p <= pages; p++) {
      doc.setPage(p);
      doc.setDrawColor(220, 225, 230);
      doc.setLineWidth(0.2);
      doc.line(15, pageHeight - 12, pageWidth - 15, pageHeight - 12);
      doc.setFontSize(7);
      doc.setTextColor(...GRAY);
      doc.text(`${refNo} · Confidential Tender Document · JEET INTECH L.L.C`, 15, pageHeight - 8);
      doc.text(`Page ${p} of ${pages}`, pageWidth - 15, pageHeight - 8, { align: 'right' });
    }

    return doc;
  },

  download(tender: TenderPdfData, extras: TenderPdfExtras = {}): void {
    const doc = this.generate(tender, extras);
    const refNo = `TND-${tender.id.substring(0, 8).toUpperCase()}`;
    doc.save(`${refNo}_${(tender.title || 'tender').replace(/[^a-z0-9]+/gi, '_').slice(0, 40)}.pdf`);
  },
};

export default tenderPDFService;
