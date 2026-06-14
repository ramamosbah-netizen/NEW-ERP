// ============================================================
// JEET ERP — Request for Quotation (RFQ) PDF Export
// Client-side document via jsPDF + autoTable. Renders the request
// sent to suppliers: header, RFQ details, the list of suppliers
// asked, the item table (no prices — suppliers fill those), and
// the cover message / terms.
// ============================================================

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { RFQ } from '@/services/rfqService';

const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const PRIMARY: [number, number, number] = [6, 8, 20];
const ACCENT: [number, number, number] = [37, 99, 235];
const GRAY: [number, number, number] = [100, 116, 139];
const LIGHT: [number, number, number] = [248, 250, 252];

const TYPE_LABEL: Record<string, string> = {
  SUPPLIER: 'Supplier', SUBCONTRACTOR: 'Subcontractor', BOTH: 'Supplier / Subcontractor',
};

export const rfqPDFService = {
  generate(rfq: RFQ): jsPDF {
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
    doc.text('REQUEST FOR QUOTATION', 20, 55);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...GRAY);
    doc.text(`RFQ No: ${rfq.rfq_number}`, 20, 61);
    doc.text(`Status: ${rfq.status}`, 20, 65.5);
    doc.text(`Date: ${fmtDate(rfq.created_at)}`, pageWidth / 2, 61);
    doc.text(`Quote by: ${fmtDate(rfq.due_date)}`, pageWidth / 2, 65.5);

    let y = 78;
    doc.setTextColor(...PRIMARY);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    const subjectLines = doc.splitTextToSize(rfq.subject || 'Request for Quotation', pageWidth - 30);
    doc.text(subjectLines, 15, y);
    y += subjectLines.length * 6 + 2;

    if (rfq.project_title) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(...GRAY);
      doc.text(`Project: ${rfq.project_title}`, 15, y);
      y += 7;
    }

    // ----- Suppliers requested -----
    autoTable(doc, {
      startY: y,
      theme: 'grid',
      styles: { fontSize: 8.5, cellPadding: 2.2, lineColor: [225, 230, 235], textColor: [40, 50, 65] },
      headStyles: { fillColor: ACCENT, textColor: [255, 255, 255], fontStyle: 'bold' },
      head: [['#', 'Supplier / Subcontractor', 'Type', 'Email']],
      body: (rfq.suppliers || []).map((s, i) => [
        String(i + 1), s.name, TYPE_LABEL[s.type] || s.type, s.email || '—',
      ]),
      columnStyles: { 0: { cellWidth: 10 }, 2: { cellWidth: 38 } },
      margin: { left: 15, right: 15 },
    });
    y = (doc as any).lastAutoTable.finalY + 6;

    // ----- Items table (prices left blank for the supplier to fill) -----
    if (y > pageHeight - 40) { doc.addPage(); y = 20; }
    autoTable(doc, {
      startY: y,
      theme: 'striped',
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: PRIMARY, textColor: [255, 255, 255], fontStyle: 'bold' },
      head: [['#', 'Code', 'Description', 'Unit', 'Qty', 'Unit Price (AED)', 'Total (AED)']],
      body: (rfq.items || []).map((it, i) => [
        String(i + 1), it.item_code || '—', it.description, it.unit, String(it.quantity), '', '',
      ]),
      columnStyles: {
        0: { cellWidth: 9 }, 1: { cellWidth: 22 }, 3: { cellWidth: 14 },
        4: { cellWidth: 14, halign: 'right' }, 5: { cellWidth: 30 }, 6: { cellWidth: 28 },
      },
      margin: { left: 15, right: 15 },
    });
    y = (doc as any).lastAutoTable.finalY + 6;

    // ----- Cover message / terms -----
    if (rfq.message && rfq.message.trim()) {
      if (y > pageHeight - 50) { doc.addPage(); y = 20; }
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); doc.setTextColor(...ACCENT);
      doc.text('NOTES & TERMS', 15, y); y += 5;
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(50, 60, 75);
      const lines = doc.splitTextToSize(rfq.message.trim(), pageWidth - 30);
      doc.text(lines, 15, y); y += lines.length * 4.5 + 6;
    }

    // ----- Footer -----
    const pages = doc.getNumberOfPages();
    for (let p = 1; p <= pages; p++) {
      doc.setPage(p);
      doc.setDrawColor(220, 225, 230); doc.setLineWidth(0.2);
      doc.line(15, pageHeight - 12, pageWidth - 15, pageHeight - 12);
      doc.setFontSize(7); doc.setTextColor(...GRAY);
      doc.text(`${rfq.rfq_number} · Request for Quotation · JEET INTECH L.L.C`, 15, pageHeight - 8);
      doc.text(`Page ${p} of ${pages}`, pageWidth - 15, pageHeight - 8, { align: 'right' });
    }

    return doc;
  },

  download(rfq: RFQ): void {
    const doc = this.generate(rfq);
    doc.save(`${rfq.rfq_number}.pdf`);
  },

  open(rfq: RFQ): void {
    const doc = this.generate(rfq);
    doc.output('dataurlnewwindow');
  },
};

export default rfqPDFService;
