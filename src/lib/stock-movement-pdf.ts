// ============================================================
// JEET ERP — Stock Movement Receipt (handover voucher)
// A signed acknowledgement of a stock movement between the
// storekeeper (issuer) and the receiver. jsPDF + autoTable.
// ============================================================

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const PRIMARY: [number, number, number] = [6, 8, 20];
const ACCENT: [number, number, number] = [37, 99, 235];
const GRAY: [number, number, number] = [100, 116, 139];
const LIGHT: [number, number, number] = [248, 250, 252];

const TYPE_LABEL: Record<string, string> = {
  GRN_RECEIPT: 'Goods Receipt', ISSUE_TO_PROJECT: 'Issue to Project / Site',
  ISSUE_TO_TICKET: 'Issue to Ticket', RETURN_FROM_SITE: 'Return from Site',
  RETURN_TO_SUPPLIER: 'Return to Supplier', TRANSFER_OUT: 'Store Transfer (Out)',
  TRANSFER_IN: 'Store Transfer (In)', ADJUSTMENT_IN: 'Stock Adjustment (+)',
  ADJUSTMENT_OUT: 'Stock Adjustment (−)', WRITE_OFF: 'Write-off / Damaged',
};

export interface MovementReceiptData {
  receipt_no: string;          // transaction_number
  type: string;
  date?: string;
  item_code: string;
  description: string;
  unit: string;
  qty: number;
  unit_cost: number;
  from_name: string;
  to_name: string;
  project_number?: string | null;
  issued_by: string;           // storekeeper
  received_by: string;         // receiver
  reason?: string | null;
}

const fmtDate = (d?: string) =>
  d ? new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const fmtAED = (v: number) => new Intl.NumberFormat('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v || 0);

export const stockMovementPDF = {
  generate(d: MovementReceiptData): jsPDF {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    // Header band
    doc.setFillColor(...PRIMARY);
    doc.rect(0, 0, pageWidth, 38, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(18);
    doc.text('JEET INTECH L.L.C', 15, 18);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5);
    doc.setTextColor(180, 190, 200);
    doc.text('ELV & SECURITY SYSTEMS INTEGRATOR', 15, 23);
    doc.setTextColor(255, 255, 255);
    doc.text(['Dubai, United Arab Emirates', 'TRN: 100489562300003'], pageWidth - 15, 14, { align: 'right' });

    // Title
    doc.setFillColor(...LIGHT);
    doc.rect(15, 44, pageWidth - 30, 20, 'F');
    doc.setDrawColor(220, 225, 230); doc.rect(15, 44, pageWidth - 30, 20, 'S');
    doc.setTextColor(...PRIMARY); doc.setFont('helvetica', 'bold'); doc.setFontSize(14);
    doc.text('STOCK MOVEMENT RECEIPT', 20, 53);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...GRAY);
    doc.text(`Receipt No: ${d.receipt_no}`, 20, 59);
    doc.text(`Date: ${fmtDate(d.date)}`, pageWidth / 2, 59);

    let y = 74;
    doc.setTextColor(...ACCENT); doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
    doc.text(TYPE_LABEL[d.type] || d.type, 15, y);
    y += 6;

    // Movement details
    autoTable(doc, {
      startY: y,
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 2.5, lineColor: [225, 230, 235], textColor: [40, 50, 65] },
      head: [['Movement Details', '']],
      headStyles: { fillColor: ACCENT, textColor: [255, 255, 255], fontStyle: 'bold' },
      body: [
        ['From', d.from_name],
        ['To', d.to_name],
        ['Project', d.project_number || '—'],
        ['Reason / note', d.reason || '—'],
      ],
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 50, fillColor: [248, 250, 252] }, 1: { cellWidth: 'auto' } },
      margin: { left: 15, right: 15 },
    });
    y = (doc as any).lastAutoTable.finalY + 6;

    // Item line
    autoTable(doc, {
      startY: y,
      theme: 'striped',
      styles: { fontSize: 9, cellPadding: 2.5 },
      head: [['Item Code', 'Description', 'Unit', 'Qty', 'Unit Cost', 'Value']],
      headStyles: { fillColor: PRIMARY, textColor: [255, 255, 255], fontStyle: 'bold' },
      body: [[
        d.item_code, d.description, d.unit, String(Math.abs(d.qty)),
        `${fmtAED(d.unit_cost)} AED`, `${fmtAED(Math.abs(d.qty) * d.unit_cost)} AED`,
      ]],
      columnStyles: { 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' } },
      margin: { left: 15, right: 15 },
    });
    y = (doc as any).lastAutoTable.finalY + 16;

    // Signatures
    doc.setFontSize(9); doc.setTextColor(50, 60, 75); doc.setFont('helvetica', 'bold');
    const colW = (pageWidth - 30) / 2;
    doc.text('Issued by (Storekeeper)', 15, y);
    doc.text('Received by', 15 + colW, y);
    doc.setFont('helvetica', 'normal'); doc.setTextColor(...GRAY);
    doc.text(d.issued_by || '—', 15, y + 6);
    doc.text(d.received_by || '—', 15 + colW, y + 6);
    doc.setDrawColor(120, 120, 120);
    doc.line(15, y + 20, 15 + colW - 12, y + 20);
    doc.line(15 + colW, y + 20, 15 + colW + colW - 12, y + 20);
    doc.setFontSize(7.5); doc.text('Signature & date', 15, y + 24); doc.text('Signature & date', 15 + colW, y + 24);

    // Footer
    doc.setDrawColor(220, 225, 230); doc.setLineWidth(0.2);
    doc.line(15, pageHeight - 12, pageWidth - 15, pageHeight - 12);
    doc.setFontSize(7); doc.setTextColor(...GRAY);
    doc.text(`${d.receipt_no} · Stock Movement Receipt · JEET INTECH L.L.C`, 15, pageHeight - 8);

    return doc;
  },

  download(d: MovementReceiptData): void {
    this.generate(d).save(`receipt_${d.receipt_no}.pdf`);
  },
};

export default stockMovementPDF;
