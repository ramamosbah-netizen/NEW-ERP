// ============================================================
// JEET ERP — Quotation PDF Generation Service
// Client-side document generation using jsPDF + autoTable
// Supports Mode A (Auto-layout rendering) & Mode B (Template fill)
// ============================================================

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase } from './supabase';
import { quotationService } from './quotation-service';
import { amountToWords } from './amount-to-words';

const fmt = (v: number) => new Intl.NumberFormat('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);

export const quotationPDFService = {
  
  // 1. Generate PDF Blob for a quotation
  async generate(quotationId: string): Promise<Blob> {
    const quote = await quotationService.fetchQuotationById(quotationId);
    if (!quote) throw new Error('Quotation not found.');

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    
    // --- Colors & Branding Constants ---
    const primaryColor: [number, number, number] = [6, 8, 20]; // Deep Obsidian Black
    const secondaryColor: [number, number, number] = [37, 99, 235]; // Electric Mint (var(--primary))
    const grayText: [number, number, number] = [100, 116, 139]; // Slate Gray
    const lightBg: [number, number, number] = [248, 250, 252]; // Off-white/slate-50

    // ============================================================
    // PAGE 1 — HEADER & CLIENT DETAILS
    // ============================================================

    // Background accent strip
    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.rect(0, 0, pageWidth, 45, 'F');

    // JEET INTECH LOGO (Vector Drawn for premium quality)
    doc.setFillColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
    doc.rect(15, 12, 8, 12, 'F');
    doc.setFillColor(255, 255, 255);
    doc.rect(20, 15, 8, 12, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.text('JEET INTECH L.L.C', 35, 20);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(180, 190, 200);
    doc.text('ELV & SECURITY SYSTEMS INTEGRATOR', 35, 26);

    // Company Header Right Info
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    doc.text([
      'JEET INTECH L.L.C',
      'Dubai, United Arab Emirates',
      'TRN: 100489562300003',
      'info@jeetintech.com | www.jeetintech.com'
    ], pageWidth - 15, 15, { align: 'right' });

    // Document Title
    doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
    doc.rect(15, 50, pageWidth - 30, 25, 'F');
    doc.setDrawColor(220, 225, 230);
    doc.rect(15, 50, pageWidth - 30, 25, 'S');

    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('QUOTATION', 20, 58);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(grayText[0], grayText[1], grayText[2]);
    
    // Metadata column 1
    doc.text(`Quotation No: ${quote.quotation_number} ${quote.revision_label}`, 20, 64);
    doc.text(`Date: ${new Date(quote.quotation_date).toLocaleDateString('en-GB')}`, 20, 69);
    
    // Metadata column 2
    doc.text(`Project Ref: ${quote.project_ref}`, pageWidth / 2, 64);
    doc.text(`Valid Until: ${new Date(quote.valid_until).toLocaleDateString('en-GB')}`, pageWidth / 2, 69);

    if (quote.tender_ref) {
      doc.text(`Tender Ref: ${quote.tender_ref}`, pageWidth - 45, 64);
    }

    // CLIENT DETAILS CARD
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text('TO:', 15, 84);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(quote.client_name, 15, 90);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(grayText[0], grayText[1], grayText[2]);
    doc.text([
      quote.client_address_line1 || '',
      quote.client_address_line2 || '',
      `${quote.client_city || ''}, ${quote.client_country || 'UAE'}`.trim()
    ].filter(Boolean), 15, 96);

    // ATTN Contact Right Card
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text('CONTACT PERSON:', pageWidth / 2 + 10, 84);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(grayText[0], grayText[1], grayText[2]);
    doc.text([
      `Attn: ${quote.client_contact_person || 'N/A'}`,
      `Email: ${quote.client_contact_email || 'N/A'}`,
      `Phone: ${quote.client_contact_phone || 'N/A'}`
    ], pageWidth / 2 + 10, 90);

    // Subject
    doc.setDrawColor(230, 235, 240);
    doc.line(15, 115, pageWidth - 15, 115);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text(`Subject: ${quote.subject}`, 15, 122);

    // Scope Summary & Salutation
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(50, 50, 50);
    doc.text(`Dear ${quote.client_contact_person || 'Sir/Madam'},`, 15, 134);

    const salutationBody = 'We are pleased to submit our commercial proposal for the referenced project. Under the scope, JEET INTECH LLC will supply, install, test, and commission the system as outlined below.';
    const scopePara = quote.scope_summary || salutationBody;

    const splitScope = doc.splitTextToSize(scopePara, pageWidth - 30);
    doc.text(splitScope, 15, 142);

    // Footer on page 1
    this.addPageBorderAndFooter(doc, 1, 3, quote.quotation_number);

    // ============================================================
    // PAGE 2 — BILL OF QUANTITIES TABLE
    // ============================================================
    doc.addPage();

    // Standard columns
    const columns = [
      { header: 'No', dataKey: 'no' },
      { header: 'Description', dataKey: 'description' },
      { header: 'Unit', dataKey: 'unit' },
      { header: 'Qty', dataKey: 'qty' },
      { header: 'Unit Price (AED)', dataKey: 'unit_price' },
      { header: 'Total (AED)', dataKey: 'total' }
    ];

    // Standard items
    const standardLines = quote.lines.filter((l: any) => !l.is_optional);
    const optionalLines = quote.lines.filter((l: any) => l.is_optional);

    // Map lines to autotable rows
    // Grouped by System if toggle enabled or system header row shaded
    const rows: any[] = [];
    let currentSystem = '';
    let itemIndex = 1;

    standardLines.forEach((line: any) => {
      if (line.system !== currentSystem) {
        currentSystem = line.system;
        rows.push({
          no: '',
          description: currentSystem.toUpperCase() + ' SYSTEM',
          unit: '',
          qty: '',
          unit_price: '',
          total: '',
          isHeader: true
        });
      }
      rows.push({
        no: itemIndex++,
        description: line.description,
        unit: line.unit,
        qty: line.quantity,
        unit_price: fmt(line.unit_sell_price_after_discount),
        total: fmt(line.line_total)
      });
    });

    // Add optional items if present
    if (optionalLines.length > 0) {
      rows.push({
        no: '',
        description: 'OPTIONAL ITEMS (Not Included in Total)',
        unit: '',
        qty: '',
        unit_price: '',
        total: '',
        isHeader: true,
        isOptionalHeader: true
      });

      optionalLines.forEach((line: any) => {
        rows.push({
          no: '*',
          description: line.description,
          unit: line.unit,
          qty: line.quantity,
          unit_price: fmt(line.unit_sell_price_after_discount),
          total: fmt(line.line_total),
          isOptional: true
        });
      });
    }

    autoTable(doc, {
      columns: columns,
      body: rows,
      startY: 20,
      theme: 'plain',
      styles: {
        fontSize: 8,
        cellPadding: 2,
        valign: 'middle'
      },
      columnStyles: {
        no: { cellWidth: 10, halign: 'center' },
        description: { cellWidth: 90 },
        unit: { cellWidth: 15, halign: 'center' },
        qty: { cellWidth: 15, halign: 'center' },
        unit_price: { cellWidth: 25, halign: 'right' },
        total: { cellWidth: 25, halign: 'right' }
      },
      didParseCell: (data) => {
        const row = data.row.raw as any;
        if (row && row.isHeader) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = row.isOptionalHeader ? [240, 245, 255] as [number, number, number] : [230, 245, 240] as [number, number, number];
          data.cell.styles.textColor = primaryColor;
          if (data.column.dataKey !== 'description') {
            data.cell.text = ['']; // Clear empty columns on headers
          }
        }
        if (row && row.isOptional) {
          data.cell.styles.textColor = grayText;
          data.cell.styles.fontStyle = 'italic';
        }
      },
      margin: { left: 15, right: 15 }
    });

    // Draw totals block below table
    let finalY = (doc as any).lastAutoTable.finalY + 8;
    
    // Check if we need to wrap page
    if (finalY > pageHeight - 65) {
      doc.addPage();
      finalY = 20;
    }

    const startX = pageWidth - 95;
    doc.setTextColor(grayText[0], grayText[1], grayText[2]);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    
    // Subtotal Row
    doc.text('SUBTOTAL (Excl. VAT)', startX, finalY);
    doc.text(`AED ${fmt(quote.subtotal_ex_vat)}`, pageWidth - 15, finalY, { align: 'right' });
    finalY += 5;

    // Discount Row
    if (quote.discount_amount > 0) {
      doc.text('DISCOUNT', startX, finalY);
      doc.text(`AED -${fmt(quote.discount_amount)}`, pageWidth - 15, finalY, { align: 'right' });
      finalY += 5;

      doc.text('SUBTOTAL AFTER DISCOUNT', startX, finalY);
      doc.text(`AED ${fmt(quote.subtotal_after_discount)}`, pageWidth - 15, finalY, { align: 'right' });
      finalY += 5;
    }

    // VAT Row
    doc.text(`VAT @ ${quote.vat_rate}%`, startX, finalY);
    doc.text(`AED ${fmt(quote.vat_amount)}`, pageWidth - 15, finalY, { align: 'right' });
    finalY += 6;

    // Grand Total Row
    doc.setFillColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
    doc.rect(startX - 2, finalY - 4, pageWidth - startX - 13, 8, 'F');
    
    doc.setTextColor(6, 8, 20);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('GRAND TOTAL (Incl. VAT)', startX, finalY);
    doc.text(`AED ${fmt(quote.grand_total_with_vat)}`, pageWidth - 15, finalY, { align: 'right' });
    finalY += 10;

    // Amount In Words
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text('GRAND TOTAL (EXCL. VAT) IN WORDS:', 15, finalY);
    finalY += 4.5;
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(grayText[0], grayText[1], grayText[2]);
    const wordsWrapped = doc.splitTextToSize(quote.grand_total_in_words || amountToWords(quote.subtotal_ex_vat), pageWidth - 30);
    doc.text(wordsWrapped, 15, finalY);

    this.addPageBorderAndFooter(doc, 2, 3, quote.quotation_number);

    // ============================================================
    // PAGE 3 — COMMERCIAL TERMS & SIGNATURES
    // ============================================================
    doc.addPage();
    let termY = 25;

    const printTerm = (title: string, content: string) => {
      if (!content) return;
      
      // Check for spacing overflow
      if (termY > pageHeight - 35) {
        doc.addPage();
        this.addPageBorderAndFooter(doc, 3, 3, quote.quotation_number);
        termY = 25;
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text(title, 15, termY);
      termY += 4;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(grayText[0], grayText[1], grayText[2]);
      const wrapped = doc.splitTextToSize(content, pageWidth - 30);
      doc.text(wrapped, 15, termY);
      termY += (wrapped.length * 4) + 6;
    };

    printTerm('PAYMENT TERMS', quote.payment_terms);
    printTerm('DELIVERY PERIOD', quote.delivery_period);
    printTerm('WARRANTY TERMS', quote.warranty_terms);
    printTerm('TERMS & CONDITIONS', quote.terms_and_conditions);
    printTerm('INCLUSIONS', quote.inclusions);
    printTerm('EXCLUSIONS', quote.exclusions);
    printTerm('NOTES', quote.notes_client);

    // Signatures Card Section at the bottom of the page
    termY = Math.max(termY, pageHeight - 60);

    doc.setDrawColor(210, 215, 220);
    doc.line(15, termY, pageWidth - 15, termY);
    termY += 6;

    // Prepared By (Left)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text('PREPARED BY', 20, termY);
    termY += 5;
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.text([
      quote.prepared_by_name || 'Muhammad',
      quote.prepared_by_title || 'Estimator',
      'JEET INTECH L.L.C'
    ], 20, termY);

    // Approved By (Right)
    doc.setFont('helvetica', 'bold');
    doc.text('APPROVED BY', pageWidth / 2 + 20, termY - 5);
    
    if (quote.status === 'APPROVED' || quote.status === 'SENT_TO_CLIENT' || quote.status === 'ACCEPTED') {
      doc.text([
        'General Manager',
        'JEET INTECH L.L.C',
        `Date: ${quote.gm_approved_at ? new Date(quote.gm_approved_at).toLocaleDateString('en-GB') : ''}`
      ], pageWidth / 2 + 20, termY);

      // Render GM signature placeholder or drawing if reference exists
      if (quote.gm_signature_ref) {
        try {
          doc.addImage(quote.gm_signature_ref, 'PNG', pageWidth / 2 + 20, termY + 12, 35, 12);
        } catch (e) {
          doc.setFont('courier', 'italic');
          doc.setFontSize(10);
          doc.text('[Signed]', pageWidth / 2 + 20, termY + 16);
        }
      }
    } else {
      doc.setTextColor(grayText[0], grayText[1], grayText[2]);
      doc.setFont('helvetica', 'normal');
      doc.text('Awaiting GM Approval & Signature', pageWidth / 2 + 20, termY);
    }

    this.addPageBorderAndFooter(doc, 3, 3, quote.quotation_number);

    return doc.output('blob');
  },

  // Helper to add border and page info
  addPageBorderAndFooter(doc: jsPDF, pageNum: number, totalPages: number, quoteNo: string) {
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const primaryColor: [number, number, number] = [6, 8, 20];
    const secondaryColor: [number, number, number] = [37, 99, 235];

    // Page Border
    doc.setDrawColor(230, 235, 240);
    doc.rect(8, 8, pageWidth - 16, pageHeight - 16);

    // Running Header (except first page)
    if (pageNum > 1) {
      doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.rect(8, 8, pageWidth - 16, 8, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.text('JEET INTECH L.L.C  |  QUOTATION', 12, 13);
      doc.text(quoteNo, pageWidth - 12, 13, { align: 'right' });
    }

    // Running Footer (on all pages)
    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.rect(8, pageHeight - 14, pageWidth - 16, 6, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.text('JEET INTECH L.L.C  |  Dubai, UAE  |  TRN: 100489562300003  |  +971 4 123 4567  |  info@jeetintech.com', 12, pageHeight - 10);
    doc.text(`Page ${pageNum} of ${totalPages}`, pageWidth - 12, pageHeight - 10, { align: 'right' });
  },

  // 2. Preview URL helper
  async preview(quotationId: string): Promise<string> {
    const blob = await this.generate(quotationId);
    return URL.createObjectURL(blob);
  },

  // 3. Upload to Supabase Storage quotations/{id}/JI-QT-YYYY-NNN-RevX.pdf
  async upload(quotationId: string, blob: Blob): Promise<string> {
    const quote = await quotationService.fetchQuotationById(quotationId);
    if (!quote) throw new Error('Quotation not found.');

    const filename = `${quote.quotation_number}-${quote.revision_label}.pdf`;
    const filepath = `quotations/${quotationId}/${filename}`;

    // Upload to 'tender-documents' storage bucket
    const { data, error } = await supabase.storage
      .from('tender-documents')
      .upload(filepath, blob, {
        cacheControl: '3600',
        upsert: true
      });

    if (error) throw error;

    // Get public URL
    const { data: publicUrl } = supabase.storage
      .from('tender-documents')
      .getPublicUrl(filepath);

    return publicUrl.publicUrl;
  },

  // 4. Download PDF file
  async download(quotationId: string): Promise<void> {
    const quote = await quotationService.fetchQuotationById(quotationId);
    if (!quote) throw new Error('Quotation not found.');
    
    const blob = await this.generate(quotationId);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${quote.quotation_number}-${quote.revision_label}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
};
