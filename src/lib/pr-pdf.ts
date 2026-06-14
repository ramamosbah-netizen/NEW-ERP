// ============================================================
// JEET ERP — Purchase Request (PR) PDF Export
// Client-side document generation using jsPDF + autoTable.
// Renders a professional PR: header, request details, item
// table with estimated costs, justification and sign-off.
// ============================================================

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const fmtAED = (v: number) =>
  new Intl.NumberFormat('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v || 0);
const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const CATEGORY_LABEL: Record<string, string> = {
  PROJECT_MATERIAL: 'Project Material', TOOLS: 'Tools', IT_EQUIPMENT: 'IT Equipment',
  FURNITURE: 'Furniture', CONSUMABLES: 'Office Consumables', SAMPLE: 'Sample',
  SERVICES: 'Services', OTHER: 'Other',
};
const PAYMENT_LABEL: Record<string, string> = {
  BANK_TRANSFER: 'Bank Transfer', CHEQUE: 'Cheque', CASH: 'Cash',
  CREDIT: 'Credit (on account)', PETTY_CASH: 'Petty Cash', LC: 'Letter of Credit',
};

export interface PRPdfData {
  pr_number: string;
  status: string;
  category: string;
  title: string;
  project_number?: string | null;
  justification?: string | null;
  required_by_date?: string | null;
  payment_method?: string | null;
  estimated_total?: number;
  requested_by_name?: string | null;
  notes?: string | null;
  created_at?: string;
  items: Array<{
    line_no: number;
    description: string;
    brand?: string | null;
    unit: string;
    quantity: number;
    estimated_unit_cost: number;
    estimated_line_total: number;
    system?: string | null;
  }>;
}

const PRIMARY: [number, number, number] = [6, 8, 20];
const ACCENT: [number, number, number] = [37, 99, 235];
const GRAY: [number, number, number] = [100, 116, 139];
const LIGHT: [number, number, number] = [248, 250, 252];

export const prPDFService = {
  generate(pr: PRPdfData): jsPDF {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

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
    doc.setTextColor(255, 255, 255);
    doc.text(['Dubai, United Arab Emirates', 'TRN: 100489562300003', 'info@jeetintech.com'], pageWidth - 15, 13, { align: 'right' });

    // ----- Title block -----
    doc.setFillColor(...LIGHT);
    doc.rect(15, 46, pageWidth - 30, 22, 'F');
    doc.setDrawColor(220, 225, 230);
    doc.rect(15, 46, pageWidth - 30, 22, 'S');
    doc.setTextColor(...PRIMARY);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.text('PURCHASE REQUEST', 20, 55);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...GRAY);
    doc.text(`PR No: ${pr.pr_number}`, 20, 61);
    doc.text(`Status: ${(pr.status || '').toUpperCase()}`, 20, 65.5);
    doc.text(`Date: ${fmtDate(pr.created_at)}`, pageWidth / 2, 61);
    doc.text(`Required by: ${fmtDate(pr.required_by_date)}`, pageWidth / 2, 65.5);

    let y = 78;
    doc.setTextColor(...PRIMARY);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    const titleLines = doc.splitTextToSize(pr.title || 'Purchase Request', pageWidth - 30);
    doc.text(titleLines, 15, y);
    y += titleLines.length * 6 + 2;

    // ----- Details table -----
    autoTable(doc, {
      startY: y,
      theme: 'grid',
      styles: { fontSize: 8.5, cellPadding: 2.2, lineColor: [225, 230, 235], textColor: [40, 50, 65] },
      headStyles: { fillColor: ACCENT, textColor: [255, 255, 255], fontStyle: 'bold' },
      head: [['Request Details', '']],
      body: [
        ['Category', CATEGORY_LABEL[pr.category] || pr.category],
        ['Project', pr.project_number || 'Overhead (no project)'],
        ['Requested by', pr.requested_by_name || '—'],
        ['Mode of payment', pr.payment_method ? (PAYMENT_LABEL[pr.payment_method] || pr.payment_method) : '—'],
        ['Estimated total', `${fmtAED(pr.estimated_total || 0)} AED`],
      ],
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 55, fillColor: [248, 250, 252] }, 1: { cellWidth: 'auto' } },
      margin: { left: 15, right: 15 },
    });
    y = (doc as any).lastAutoTable.finalY + 6;

    // ----- Items table -----
    autoTable(doc, {
      startY: y,
      theme: 'striped',
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: PRIMARY, textColor: [255, 255, 255], fontStyle: 'bold' },
      head: [['#', 'Description', 'Brand', 'Unit', 'Qty', 'Est. Unit', 'Est. Total']],
      body: pr.items.map(it => [
        String(it.line_no),
        it.description + (it.system ? `\n${it.system}` : ''),
        it.brand || '—',
        it.unit,
        String(it.quantity),
        fmtAED(it.estimated_unit_cost),
        fmtAED(it.estimated_line_total),
      ]),
      columnStyles: {
        0: { cellWidth: 10 }, 3: { cellWidth: 16 }, 4: { cellWidth: 16, halign: 'right' },
        5: { cellWidth: 24, halign: 'right' }, 6: { cellWidth: 26, halign: 'right' },
      },
      foot: [['', '', '', '', '', 'Total', `${fmtAED(pr.estimated_total || 0)} AED`]],
      footStyles: { fillColor: [240, 243, 247], textColor: PRIMARY, fontStyle: 'bold', halign: 'right' },
      margin: { left: 15, right: 15 },
    });
    y = (doc as any).lastAutoTable.finalY + 6;

    // ----- Justification -----
    if (pr.justification && pr.justification.trim()) {
      if (y > pageHeight - 50) { doc.addPage(); y = 20; }
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); doc.setTextColor(...ACCENT);
      doc.text('JUSTIFICATION', 15, y); y += 5;
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(50, 60, 75);
      const lines = doc.splitTextToSize(pr.justification.trim(), pageWidth - 30);
      doc.text(lines, 15, y); y += lines.length * 4.5 + 6;
    }

    // ----- Sign-off -----
    if (y > pageHeight - 40) { doc.addPage(); y = 20; }
    const blocks = ['Requested By', 'Reviewed By', 'Approved By'];
    const bw = (pageWidth - 30) / 3;
    blocks.forEach((label, i) => {
      const x = 15 + i * bw;
      doc.setDrawColor(120, 120, 120);
      doc.line(x, y + 16, x + bw - 8, y + 16);
      doc.setFontSize(8); doc.setTextColor(...GRAY);
      doc.text(label, x, y + 21);
    });

    // ----- Footer -----
    const pages = doc.getNumberOfPages();
    for (let p = 1; p <= pages; p++) {
      doc.setPage(p);
      doc.setDrawColor(220, 225, 230); doc.setLineWidth(0.2);
      doc.line(15, pageHeight - 12, pageWidth - 15, pageHeight - 12);
      doc.setFontSize(7); doc.setTextColor(...GRAY);
      doc.text(`${pr.pr_number} · Purchase Request · JEET INTECH L.L.C`, 15, pageHeight - 8);
      doc.text(`Page ${p} of ${pages}`, pageWidth - 15, pageHeight - 8, { align: 'right' });
    }

    return doc;
  },

  download(pr: PRPdfData): void {
    const doc = this.generate(pr);
    doc.save(`${pr.pr_number}_${(pr.title || 'request').replace(/[^a-z0-9]+/gi, '_').slice(0, 40)}.pdf`);
  },

  open(pr: PRPdfData): void {
    const doc = this.generate(pr);
    doc.output('dataurlnewwindow');
  },
};

export default prPDFService;
