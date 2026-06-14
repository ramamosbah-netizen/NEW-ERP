// ============================================================
// JEET ERP — Goods Receipt Note (GRN) PDF Export
// Renders the receipt: header, supplier/LPO/delivery details,
// received-items table (ordered/received/rejected) and sign-off.
// ============================================================

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

export interface GRNPdfData {
  grn_number: string;
  status: string;
  po_number?: string | null;
  supplier_name?: string | null;
  receiver_name?: string | null;
  received_at?: string;
  delivery_note_ref?: string | null;
  location?: string;
  driver_name?: string | null;
  vehicle_no?: string | null;
  notes?: string | null;
  items: Array<{
    description: string;
    item_code?: string | null;
    brand?: string | null;
    unit: string;
    po_qty?: number;
    qty_received: number;
    qty_rejected: number;
    notes?: string | null;
  }>;
}

const PRIMARY: [number, number, number] = [6, 8, 20];
const ACCENT: [number, number, number] = [37, 99, 235];
const GRAY: [number, number, number] = [100, 116, 139];
const LIGHT: [number, number, number] = [248, 250, 252];

export const grnPDFService = {
  generate(grn: GRNPdfData): jsPDF {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

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

    doc.setFillColor(...LIGHT);
    doc.rect(15, 46, pageWidth - 30, 22, 'F');
    doc.setDrawColor(220, 225, 230);
    doc.rect(15, 46, pageWidth - 30, 22, 'S');
    doc.setTextColor(...PRIMARY);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.text('GOODS RECEIPT NOTE', 20, 55);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...GRAY);
    doc.text(`GRN No: ${grn.grn_number}`, 20, 61);
    doc.text(`Status: ${(grn.status || '').toUpperCase()}`, 20, 65.5);
    doc.text(`Received: ${fmtDate(grn.received_at)}`, pageWidth / 2, 61);
    doc.text(`Against LPO: ${grn.po_number || '—'}`, pageWidth / 2, 65.5);

    let y = 76;
    autoTable(doc, {
      startY: y,
      theme: 'grid',
      styles: { fontSize: 8.5, cellPadding: 2.2, lineColor: [225, 230, 235], textColor: [40, 50, 65] },
      headStyles: { fillColor: ACCENT, textColor: [255, 255, 255], fontStyle: 'bold' },
      head: [['Receipt Details', '']],
      body: [
        ['Supplier', grn.supplier_name || '—'],
        ['Delivery Note Ref', grn.delivery_note_ref || '—'],
        ['Received by', grn.receiver_name || '—'],
        ['Offloading point', grn.location || '—'],
        ['Vehicle / Driver', `${grn.vehicle_no || '—'} / ${grn.driver_name || '—'}`],
      ],
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 55, fillColor: [248, 250, 252] }, 1: { cellWidth: 'auto' } },
      margin: { left: 15, right: 15 },
    });
    y = (doc as any).lastAutoTable.finalY + 6;

    autoTable(doc, {
      startY: y,
      theme: 'striped',
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: PRIMARY, textColor: [255, 255, 255], fontStyle: 'bold' },
      head: [['#', 'Description', 'Brand', 'Unit', 'Ordered', 'Received', 'Rejected', 'Remarks']],
      body: grn.items.map((it, i) => [
        String(i + 1),
        it.description + (it.item_code ? `\n${it.item_code}` : ''),
        it.brand || '—',
        it.unit,
        it.po_qty != null ? String(it.po_qty) : '—',
        String(it.qty_received),
        String(it.qty_rejected),
        it.notes || '—',
      ]),
      columnStyles: {
        0: { cellWidth: 9 }, 3: { cellWidth: 14 },
        4: { cellWidth: 18, halign: 'right' }, 5: { cellWidth: 18, halign: 'right' }, 6: { cellWidth: 18, halign: 'right' },
      },
      margin: { left: 15, right: 15 },
    });
    y = (doc as any).lastAutoTable.finalY + 6;

    if (grn.notes && grn.notes.trim()) {
      if (y > pageHeight - 50) { doc.addPage(); y = 20; }
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); doc.setTextColor(...ACCENT);
      doc.text('REMARKS', 15, y); y += 5;
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(50, 60, 75);
      const lines = doc.splitTextToSize(grn.notes.trim(), pageWidth - 30);
      doc.text(lines, 15, y); y += lines.length * 4.5 + 6;
    }

    if (y > pageHeight - 40) { doc.addPage(); y = 20; }
    const blocks = ['Received By', 'Store Keeper', 'Verified By'];
    const bw = (pageWidth - 30) / 3;
    blocks.forEach((label, i) => {
      const x = 15 + i * bw;
      doc.setDrawColor(120, 120, 120);
      doc.line(x, y + 16, x + bw - 8, y + 16);
      doc.setFontSize(8); doc.setTextColor(...GRAY);
      doc.text(label, x, y + 21);
    });

    const pages = doc.getNumberOfPages();
    for (let p = 1; p <= pages; p++) {
      doc.setPage(p);
      doc.setDrawColor(220, 225, 230); doc.setLineWidth(0.2);
      doc.line(15, pageHeight - 12, pageWidth - 15, pageHeight - 12);
      doc.setFontSize(7); doc.setTextColor(...GRAY);
      doc.text(`${grn.grn_number} · Goods Receipt Note · JEET INTECH L.L.C`, 15, pageHeight - 8);
      doc.text(`Page ${p} of ${pages}`, pageWidth - 15, pageHeight - 8, { align: 'right' });
    }

    return doc;
  },

  download(grn: GRNPdfData): void {
    this.generate(grn).save(`${grn.grn_number}_receipt.pdf`);
  },
  open(grn: GRNPdfData): void {
    this.generate(grn).output('dataurlnewwindow');
  },
};

export default grnPDFService;
