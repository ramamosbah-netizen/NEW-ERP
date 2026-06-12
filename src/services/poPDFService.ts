// ============================================================
// JEET ERP — Purchase Order (LPO) PDF Compiler Service
// ============================================================

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { PurchaseOrder, POItem } from '@/types/po.types';

export const poPDFService = {
  /**
   * Generates a beautifully formatted jsPDF document for the LPO.
   */
  async generatePOPDF(po: PurchaseOrder, items: POItem[]): Promise<jsPDF> {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    // Color Palette
    const primaryColor = [15, 23, 42]; // Slate 900
    const accentColor = [37, 99, 235];  // Electric Mint
    const textColor = [51, 65, 85];    // Slate 700
    const lightGrey = [241, 245, 249];  // Slate 100

    // Page Coordinates
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    const margin = 15;

    // --- Header / Letterhead ---
    // Brand Logo Name
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(22);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text('JEET MEP ERP', margin, 20);

    // Subtitle
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text('ELECTRICAL & MECHANICAL WORKS LLC', margin, 24);
    doc.text('Office 402, Business Bay, Dubai, UAE | TRN: 100348291000003', margin, 28);
    doc.text('Email: procurement@jeetmep.ae | Phone: +971 4 456 7890', margin, 32);

    // Document Title (Right-aligned)
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(accentColor[0], accentColor[1], accentColor[2]);
    doc.text('LOCAL PURCHASE ORDER', pageWidth - margin - 75, 20);

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text(`LPO Ref: ${po.po_number}`, pageWidth - margin - 75, 26);
    doc.text(`Revision: Rev ${po.revision_number}`, pageWidth - margin - 75, 31);
    doc.text(`Date: ${new Date(po.created_at || Date.now()).toLocaleDateString('en-GB')}`, pageWidth - margin - 75, 36);

    // Horizontal Rule
    doc.setDrawColor(accentColor[0], accentColor[1], accentColor[2]);
    doc.setLineWidth(1.0);
    doc.line(margin, 40, pageWidth - margin, 40);

    // --- Supplier & Project Coordinates Grid ---
    let y = 46;
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text('SUPPLIER DETAILS:', margin, y);
    doc.text('PROJECT COORDINATES:', pageWidth / 2 + 5, y);

    y += 5;
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(textColor[0], textColor[1], textColor[2]);

    // Supplier Info
    doc.text(`Supplier: ${po.supplier_name}`, margin, y);
    doc.text(`TRN: ${po.supplier_trn || 'N/A'}`, margin, y + 4.5);
    doc.text(`Contact: ${po.supplier_contact || 'N/A'}`, margin, y + 9);
    doc.text(`Email: ${po.supplier_email || 'N/A'}`, margin, y + 13.5);
    doc.text(`Phone: ${po.supplier_phone || 'N/A'}`, margin, y + 18);

    // Project Info
    const projectText = po.project_name ? `${po.project_name} (${po.project_number || 'N/A'})` : 'OVERHEAD / GENERAL';
    doc.text(`Project: ${projectText}`, pageWidth / 2 + 5, y);
    doc.text(`Type: ${po.po_type}`, pageWidth / 2 + 5, y + 4.5);
    doc.text(`Delivery Location: ${po.delivery_address || 'As specified below'}`, pageWidth / 2 + 5, y + 9);
    
    const delDateStr = po.required_delivery_date 
      ? new Date(po.required_delivery_date).toLocaleDateString('en-GB') 
      : po.promised_delivery_days 
        ? `${po.promised_delivery_days} Days from LPO`
        : 'Immediate';
    doc.text(`Required Date: ${delDateStr}`, pageWidth / 2 + 5, y + 13.5);
    
    doc.text(`Payment Terms: ${po.payment_terms_text || `${po.payment_terms_days} Days Net`}`, pageWidth / 2 + 5, y + 18);

    // --- Table of Items ---
    y += 24;

    const tableRows = items.map((item, idx) => [
      String(idx + 1),
      item.item_code || '-',
      item.description,
      item.brand || '-',
      item.unit,
      item.quantity.toString(),
      item.unit_price.toFixed(2),
      item.line_total.toFixed(2),
    ]);

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [['No', 'Item Code', 'Description', 'Brand', 'Unit', 'Qty', 'Unit Price (AED)', 'Total (AED)']],
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
        1: { cellWidth: 20 },
        2: { cellWidth: 65 },
        3: { cellWidth: 20 },
        4: { cellWidth: 12, halign: 'center' },
        5: { cellWidth: 15, halign: 'right' },
        6: { cellWidth: 20, halign: 'right' },
        7: { cellWidth: 20, halign: 'right' },
      },
      styles: {
        fontSize: 8,
        font: 'helvetica',
        cellPadding: 1.5,
      },
      didParseCell: (data) => {
        // Right align values
        if (data.column.index === 5 || data.column.index === 6 || data.column.index === 7) {
          if (data.section === 'head') {
            data.cell.styles.halign = 'right';
          }
        }
      }
    });

    // --- Totals Block ---
    // Fetch last table Y coordinate
    let currentY = (doc as any).lastAutoTable.finalY + 8;

    // Guard if totals push past page height (create new page)
    if (currentY > pageHeight - 65) {
      doc.addPage();
      currentY = margin + 10;
    }

    const fmtVal = (val: number) => {
      return new Intl.NumberFormat('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val);
    };

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(textColor[0], textColor[1], textColor[2]);

    const totalsStartX = pageWidth - margin - 75;
    const totalsValX = pageWidth - margin;

    doc.text('Subtotal:', totalsStartX, currentY);
    doc.text(`${fmtVal(po.subtotal)} AED`, totalsValX, currentY, { align: 'right' });

    if (po.discount_amount > 0) {
      currentY += 4.5;
      doc.text('Discount:', totalsStartX, currentY);
      doc.text(`-${fmtVal(po.discount_amount)} AED`, totalsValX, currentY, { align: 'right' });
    }

    currentY += 4.5;
    doc.text('VAT (5.00%):', totalsStartX, currentY);
    doc.text(`${fmtVal(po.vat_amount)} AED`, totalsValX, currentY, { align: 'right' });

    currentY += 5;
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text('Grand Total:', totalsStartX, currentY);
    doc.text(`${fmtVal(po.total)} AED`, totalsValX, currentY, { align: 'right' });

    // --- Terms & Notes Block ---
    let notesY = (doc as any).lastAutoTable.finalY + 8;
    if (notesY > pageHeight - 65) {
      // already resolved or need to adjust
    } else {
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text('TERMS & CONDITIONS:', margin, notesY);
      
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(textColor[0], textColor[1], textColor[2]);
      
      const tcText = po.terms_conditions || 
        '1. Delivery must be strictly as per the specified date and address.\n' +
        '2. Delivery note must state the LPO reference number clearly.\n' +
        '3. Payment will be processed as per agreed payment terms after receipt of material in good condition and submission of invoice.';
      
      const splitTC = doc.splitTextToSize(tcText, pageWidth / 2 - 10);
      doc.text(splitTC, margin, notesY + 4);

      if (po.notes_to_supplier) {
        doc.setFont('Helvetica', 'bold');
        doc.text('NOTES TO SUPPLIER:', margin, notesY + 22);
        doc.setFont('Helvetica', 'normal');
        const splitNotes = doc.splitTextToSize(po.notes_to_supplier, pageWidth / 2 - 10);
        doc.text(splitNotes, margin, notesY + 26);
      }
    }

    // --- Signatures Section (Always at bottom) ---
    const sigY = pageHeight - 35;
    
    // Draw signature dividers
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.3);
    
    const sigColWidth = (pageWidth - 2 * margin) / 3;
    
    // Column 1: Prepared By
    doc.line(margin, sigY, margin + sigColWidth - 10, sigY);
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text('Prepared By', margin, sigY + 4);
    doc.setFont('Helvetica', 'normal');
    doc.text('Procurement Engineer', margin, sigY + 8);
    
    // Column 2: Verified By (Commercial Stage)
    doc.line(margin + sigColWidth + 5, sigY, margin + 2 * sigColWidth - 5, sigY);
    doc.setFont('Helvetica', 'bold');
    doc.text('Verified By', margin + sigColWidth + 5, sigY + 4);
    doc.setFont('Helvetica', 'normal');
    doc.text('Commercial Manager', margin + sigColWidth + 5, sigY + 8);

    // Column 3: Approved By (GM Stage)
    doc.line(margin + 2 * sigColWidth + 10, sigY, pageWidth - margin, sigY);
    doc.setFont('Helvetica', 'bold');
    doc.text('Approved By', margin + 2 * sigColWidth + 10, sigY + 4);
    doc.setFont('Helvetica', 'normal');
    doc.text('General Manager', margin + 2 * sigColWidth + 10, sigY + 8);

    return doc;
  }
};

export default poPDFService;
