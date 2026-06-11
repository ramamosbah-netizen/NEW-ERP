// ============================================================
// JEET ERP — Client Invoice and Credit Note PDF Compiler
// Generates: FTA-compliant tax invoices & credit notes
// ============================================================

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { ClientInvoice, ClientInvoiceItem, CreditNote } from '@/types/finance.types';
import { convertAmountToWords } from './amountInWordsService';
import settingsService from './settingsService';

export const invoicePDFService = {
  /**
   * Generates a beautifully formatted jsPDF document for a client Tax Invoice.
   */
  async generateInvoicePDF(invoice: ClientInvoice, items: ClientInvoiceItem[]): Promise<jsPDF> {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const primaryColor = [15, 23, 42]; // Slate 900
    let accentColor = [0, 229, 160];  // Electric UAE Mint
    const textColor = [51, 65, 85];    // Slate 700
    const lightGrey = [241, 245, 249];  // Slate 100

    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    const margin = 15;

    // Dynamic config overrides
    let headerTitle = 'JEET MEP ERP';
    let headerSubtitle = 'ELECTRICAL & MECHANICAL WORKS LLC';
    let disclaimer = 'Office 402, Business Bay, Dubai, UAE | TRN: 100348291000003\nEmail: accounts@jeetmep.ae | Phone: +971 4 456 7890';

    try {
      const templates = await settingsService.getDocumentTemplates();
      headerTitle = templates.header_title || headerTitle;
      headerSubtitle = templates.header_subtitle || headerSubtitle;
      disclaimer = templates.invoice_disclaimer || disclaimer;
      if (templates.accent_color === 'slate') accentColor = [15, 23, 42];
      else if (templates.accent_color === 'gold') accentColor = [197, 160, 89];
      else if (templates.accent_color === 'red') accentColor = [239, 68, 68];
      else if (templates.accent_color === 'mint') accentColor = [0, 229, 160];
    } catch (e) {
      console.warn('Could not load document templates settings, using defaults:', e);
    }

    // --- Header / Letterhead ---
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(22);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text(headerTitle, margin, 20);

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(headerSubtitle, margin, 24);

    const splitDisclaimer = doc.splitTextToSize(disclaimer, pageWidth / 2 - 10);
    doc.text(splitDisclaimer, margin, 28);

    // Document Title (Right-aligned)
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(accentColor[0], accentColor[1], accentColor[2]);
    doc.text('TAX INVOICE', pageWidth - margin - 75, 20);

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text(`Invoice No: ${invoice.invoice_number}`, pageWidth - margin - 75, 26);
    doc.text(`Date: ${new Date(invoice.invoice_date).toLocaleDateString('en-GB')}`, pageWidth - margin - 75, 31);
    doc.text(`Due Date: ${new Date(invoice.due_date).toLocaleDateString('en-GB')}`, pageWidth - margin - 75, 36);

    // Horizontal Rule
    doc.setDrawColor(accentColor[0], accentColor[1], accentColor[2]);
    doc.setLineWidth(1.0);
    doc.line(margin, 40, pageWidth - margin, 40);

    // --- Client & Project Coordinates Grid ---
    let y = 46;
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text('BILL TO CLIENT:', margin, y);
    doc.text('PROJECT DETAILS:', pageWidth / 2 + 5, y);

    y += 5;
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(textColor[0], textColor[1], textColor[2]);

    // Client Info
    doc.text(`Client: ${invoice.client_name}`, margin, y);
    doc.text(`TRN: ${invoice.client_trn || 'N/A'}`, margin, y + 4.5);
    const splitAddress = doc.splitTextToSize(invoice.client_address || 'Dubai, UAE', pageWidth / 2 - 20);
    doc.text(splitAddress, margin, y + 9);

    // Project Info
    doc.text(`Project ID: ${invoice.project_id ? 'Yes' : 'Standalone Billing'}`, pageWidth / 2 + 5, y);
    doc.text(`Invoice Type: ${invoice.invoice_type}`, pageWidth / 2 + 5, y + 4.5);
    if (invoice.period_from && invoice.period_to) {
      const fromStr = new Date(invoice.period_from).toLocaleDateString('en-GB');
      const toStr = new Date(invoice.period_to).toLocaleDateString('en-GB');
      doc.text(`Billing Period: ${fromStr} to ${toStr}`, pageWidth / 2 + 5, y + 9);
    } else {
      doc.text(`Supply Date: ${new Date(invoice.supply_date).toLocaleDateString('en-GB')}`, pageWidth / 2 + 5, y + 9);
    }

    // --- Table of Items ---
    y += 24;

    const tableRows = items.map((item, idx) => [
      String(idx + 1),
      item.description,
      item.boq_reference || '-',
      item.unit,
      item.quantity.toString(),
      item.unit_price.toFixed(2),
      `${item.vat_rate}%`,
      item.vat_amount.toFixed(2),
      item.line_total.toFixed(2)
    ]);

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [['No', 'Description', 'BOQ Ref', 'Unit', 'Qty', 'Unit Price', 'VAT Rate', 'VAT Amt', 'Line Total']],
      body: tableRows,
      theme: 'grid',
      headStyles: {
        fillColor: [15, 23, 42] as any,
        textColor: [255, 255, 255] as any,
        font: 'helvetica',
        fontStyle: 'bold',
        fontSize: 8,
        halign: 'left',
      },
      columnStyles: {
        0: { cellWidth: 8, halign: 'center' },
        1: { cellWidth: 70 },
        2: { cellWidth: 15 },
        3: { cellWidth: 12, halign: 'center' },
        4: { cellWidth: 12, halign: 'right' },
        5: { cellWidth: 18, halign: 'right' },
        6: { cellWidth: 14, halign: 'center' },
        7: { cellWidth: 15, halign: 'right' },
        8: { cellWidth: 18, halign: 'right' },
      },
      styles: {
        fontSize: 8,
        font: 'helvetica',
        cellPadding: 1.5,
      }
    });

    // --- Totals and Deductions Block ---
    let currentY = (doc as any).lastAutoTable.finalY + 8;

    if (currentY > pageHeight - 75) {
      doc.addPage();
      currentY = margin + 10;
    }

    const fmtVal = (val: number) => {
      return new Intl.NumberFormat('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val);
    };

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(textColor[0], textColor[1], textColor[2]);

    const totalsStartX = pageWidth - margin - 80;
    const totalsValX = pageWidth - margin;

    doc.text('Subtotal (Taxable):', totalsStartX, currentY);
    doc.text(`${fmtVal(invoice.taxable_amount)} AED`, totalsValX, currentY, { align: 'right' });

    currentY += 4.5;
    doc.text('VAT Amount (5%):', totalsStartX, currentY);
    doc.text(`${fmtVal(invoice.vat_amount)} AED`, totalsValX, currentY, { align: 'right' });

    currentY += 4.5;
    doc.text('Total (Incl VAT):', totalsStartX, currentY);
    doc.text(`${fmtVal(invoice.total_incl_vat)} AED`, totalsValX, currentY, { align: 'right' });

    // Progress billing recoveries
    if (invoice.advance_recovery > 0) {
      currentY += 4.5;
      doc.setTextColor(239, 68, 68);
      doc.text('Less: Advance Recovery:', totalsStartX, currentY);
      doc.text(`-${fmtVal(invoice.advance_recovery)} AED`, totalsValX, currentY, { align: 'right' });
      doc.setTextColor(textColor[0], textColor[1], textColor[2]);
    }

    if (invoice.retention_held > 0) {
      currentY += 4.5;
      doc.setTextColor(239, 68, 68);
      doc.text('Less: Retention Held:', totalsStartX, currentY);
      doc.text(`-${fmtVal(invoice.retention_held)} AED`, totalsValX, currentY, { align: 'right' });
      doc.setTextColor(textColor[0], textColor[1], textColor[2]);
    }

    currentY += 5;
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text('Net Due Amount:', totalsStartX, currentY);
    doc.text(`${fmtVal(invoice.net_due)} AED`, totalsValX, currentY, { align: 'right' });

    // Amount in Words
    currentY += 8;
    doc.setFont('Helvetica', 'bolditalic');
    doc.setFontSize(8.5);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    const wordsText = `Amount in Words: ${convertAmountToWords(invoice.net_due)}`;
    const splitWords = doc.splitTextToSize(wordsText, pageWidth - 2 * margin);
    doc.text(splitWords, margin, currentY);

    if (invoice.notes) {
      currentY += 10;
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.text('INVOICE NOTES:', margin, currentY);
      doc.setFont('Helvetica', 'normal');
      const splitNotes = doc.splitTextToSize(invoice.notes, pageWidth - 2 * margin);
      doc.text(splitNotes, margin, currentY + 4);
    }

    // --- Signatures Section ---
    const sigY = pageHeight - 35;
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.3);
    const sigColWidth = (pageWidth - 2 * margin) / 2;

    // Prepared by
    doc.line(margin, sigY, margin + sigColWidth - 10, sigY);
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text('Prepared By (Accounts)', margin, sigY + 4);
    doc.setFont('Helvetica', 'normal');
    doc.text('JEET MEP Finance Department', margin, sigY + 8);

    // Approved by Client / Director
    doc.line(margin + sigColWidth + 10, sigY, pageWidth - margin, sigY);
    doc.setFont('Helvetica', 'bold');
    doc.text('Approved By (Management)', margin + sigColWidth + 10, sigY + 4);
    doc.setFont('Helvetica', 'normal');
    doc.text('Authorized Signatory', margin + sigColWidth + 10, sigY + 8);

    return doc;
  },

  /**
   * Generates a beautifully formatted jsPDF document for a Credit Note.
   */
  async generateCreditNotePDF(creditNote: CreditNote, invoice: ClientInvoice): Promise<jsPDF> {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const primaryColor = [15, 23, 42]; // Slate 900
    let accentColor = [239, 68, 68];  // Soft Red for credit notes
    const textColor = [51, 65, 85];    // Slate 700

    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    const margin = 15;

    // Dynamic config overrides
    let headerTitle = 'JEET MEP ERP';
    let headerSubtitle = 'ELECTRICAL & MECHANICAL WORKS LLC';
    let disclaimer = 'Office 402, Business Bay, Dubai, UAE | TRN: 100348291000003';

    try {
      const templates = await settingsService.getDocumentTemplates();
      headerTitle = templates.header_title || headerTitle;
      headerSubtitle = templates.header_subtitle || headerSubtitle;
      disclaimer = templates.invoice_disclaimer || disclaimer;
      if (templates.accent_color === 'slate') accentColor = [15, 23, 42];
      else if (templates.accent_color === 'gold') accentColor = [197, 160, 89];
      else if (templates.accent_color === 'red') accentColor = [239, 68, 68];
      else if (templates.accent_color === 'mint') accentColor = [0, 229, 160];
    } catch (e) {
      console.warn('Could not load document templates settings, using defaults:', e);
    }

    // --- Header ---
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(22);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text(headerTitle, margin, 20);

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(headerSubtitle, margin, 24);
    
    const splitDisclaimer = doc.splitTextToSize(disclaimer, pageWidth / 2 - 10);
    doc.text(splitDisclaimer, margin, 28);

    // Title
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(accentColor[0], accentColor[1], accentColor[2]);
    doc.text('CREDIT NOTE', pageWidth - margin - 75, 20);

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text(`Credit Note No: ${creditNote.credit_note_number}`, pageWidth - margin - 75, 26);
    doc.text(`Date: ${new Date(creditNote.created_at || Date.now()).toLocaleDateString('en-GB')}`, pageWidth - margin - 75, 31);
    doc.text(`Reference Invoice: ${invoice.invoice_number}`, pageWidth - margin - 75, 36);

    // Horizontal Rule
    doc.setDrawColor(accentColor[0], accentColor[1], accentColor[2]);
    doc.setLineWidth(1.0);
    doc.line(margin, 40, pageWidth - margin, 40);

    // Grid details
    let y = 46;
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text('CREDITED TO CLIENT:', margin, y);
    doc.text('REASON FOR CREDIT:', pageWidth / 2 + 5, y);

    y += 5;
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(textColor[0], textColor[1], textColor[2]);

    // Client Info
    doc.text(`Client: ${invoice.client_name}`, margin, y);
    doc.text(`TRN: ${invoice.client_trn || 'N/A'}`, margin, y + 4.5);

    // Reason info
    const splitReason = doc.splitTextToSize(creditNote.reason, pageWidth / 2 - 20);
    doc.text(splitReason, pageWidth / 2 + 5, y);

    // Credit details box
    y += 25;
    doc.setDrawColor(220, 220, 220);
    doc.setFillColor(248, 250, 252);
    doc.rect(margin, y, pageWidth - 2 * margin, 35, 'FD');

    doc.setFont('Helvetica', 'bold');
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text('CREDIT SUMMARY:', margin + 5, y + 8);

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.text(`Taxable Credited Amount:`, margin + 5, y + 16);
    doc.text(`${new Intl.NumberFormat('en-AE', { minimumFractionDigits: 2 }).format(creditNote.taxable_amount)} AED`, pageWidth - margin - 5, y + 16, { align: 'right' });

    doc.text(`VAT Credited Amount (5.00%):`, margin + 5, y + 22);
    doc.text(`${new Intl.NumberFormat('en-AE', { minimumFractionDigits: 2 }).format(creditNote.vat_amount)} AED`, pageWidth - margin - 5, y + 22, { align: 'right' });

    doc.line(margin + 5, y + 26, pageWidth - margin - 5, y + 26);
    doc.setFont('Helvetica', 'bold');
    doc.text(`Total Credited Value:`, margin + 5, y + 31);
    doc.text(`${new Intl.NumberFormat('en-AE', { minimumFractionDigits: 2 }).format(creditNote.total)} AED`, pageWidth - margin - 5, y + 31, { align: 'right' });

    // Word representation
    y += 45;
    doc.setFont('Helvetica', 'bolditalic');
    doc.setFontSize(8.5);
    const wordsText = `Amount in Words: ${convertAmountToWords(creditNote.total)}`;
    doc.text(wordsText, margin, y);

    // --- Signatures ---
    const sigY = pageHeight - 35;
    doc.line(margin, sigY, margin + 70, sigY);
    doc.text('Authorized Signatory', margin, sigY + 4);

    return doc;
  }
};

export default invoicePDFService;
