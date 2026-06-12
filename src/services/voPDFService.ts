// ============================================================
// JEET ERP — Variation Order PDF Generation Service
// Location: src/services/voPDFService.ts
// Branded client-facing document generation using jsPDF + autoTable.
// Files to DMS category: COMMERCIAL, subcategory: VARIATION_ORDER.
// ============================================================

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase } from '@/lib/supabase';
import { convertAmountToWords } from './amountInWordsService';
import type { VariationOrder, VOItem } from '@/types/vo.types';
import settingsService from './settingsService';

const fmt = (v: number) => {
  const isNeg = v < 0;
  const abs = Math.abs(v);
  const formatted = new Intl.NumberFormat('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(abs);
  return (isNeg ? '-' : '') + formatted;
};

export const voPDFService = {
  /**
   * Generates a jsPDF document for a Variation Order.
   */
  async generateVOReport(vo: VariationOrder, items: VOItem[]): Promise<jsPDF> {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    // Fetch project original value for revised calculation
    let originalContractValue = 0;
    let projectNumber = '';
    let projectName = '';
    
    const { data: project } = await supabase
      .from('projects')
      .select('original_contract_value, project_number, name')
      .eq('id', vo.project_id)
      .single();

    if (project) {
      originalContractValue = Number(project.original_contract_value || 0);
      projectNumber = project.project_number;
      projectName = project.name;
    }

    let headerTitle = 'JEET INTECH L.L.C';
    let headerSubtitle = 'ELV & SECURITY SYSTEMS INTEGRATOR';
    let addressLine = 'Dubai, United Arab Emirates';
    let trnLine = 'TRN: 100489562300003';
    let contactLine = 'info@jeetintech.com | www.jeetintech.com';
    let footerDisclaimer = 'JEET INTECH L.L.C  |  Dubai, UAE  |  TRN: 100489562300003  |  info@jeetintech.com  |  Confidential Variation Sheet';
    let primaryColor: [number, number, number] = [6, 8, 20]; // Deep Obsidian Black
    let secondaryColor: [number, number, number] = [37, 99, 235]; // Electric Mint

    try {
      const profile = await settingsService.getCompanyProfile();
      headerTitle = profile.company_name || headerTitle;
      addressLine = profile.address || addressLine;
      trnLine = `TRN: ${profile.trn}` || trnLine;
      contactLine = `${profile.email} | ${profile.website}` || contactLine;

      const templates = await settingsService.getDocumentTemplates();
      headerSubtitle = templates.header_subtitle || headerSubtitle;
      footerDisclaimer = templates.vo_disclaimer || footerDisclaimer;
      if (templates.accent_color === 'slate') {
        secondaryColor = [15, 23, 42];
      } else if (templates.accent_color === 'gold') {
        secondaryColor = [197, 160, 89];
      } else if (templates.accent_color === 'red') {
        secondaryColor = [239, 68, 68];
      } else if (templates.accent_color === 'mint') {
        secondaryColor = [37, 99, 235];
      }
    } catch (e) {
      console.warn('Could not load company settings for VO report:', e);
    }

    const grayText: [number, number, number] = [100, 116, 139]; // Slate Gray
    const lightBg: [number, number, number] = [248, 250, 252];

    // ============================================================
    // HEADER SECTION
    // ============================================================
    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.rect(0, 0, pageWidth, 42, 'F');

    // Logo
    doc.setFillColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
    doc.rect(15, 12, 8, 12, 'F');
    doc.setFillColor(255, 255, 255);
    doc.rect(20, 15, 8, 12, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.text(headerTitle, 35, 20);
    
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(180, 190, 200);
    doc.text(headerSubtitle, 35, 26);

    // Company metadata right side
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    doc.text([
      headerTitle,
      addressLine,
      trnLine,
      contactLine
    ], pageWidth - 15, 14, { align: 'right' });

    // Document Title Card
    doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
    doc.rect(15, 48, pageWidth - 30, 26, 'F');
    doc.setDrawColor(220, 225, 230);
    doc.rect(15, 48, pageWidth - 30, 26, 'S');

    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('VARIATION ORDER (VO)', 20, 56);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(grayText[0], grayText[1], grayText[2]);
    
    doc.text(`VO Number: ${vo.vo_number} (Project Sequence: VO-${String(vo.project_vo_sequence).padStart(2, '0')})`, 20, 62);
    doc.text(`Date of Issue: ${new Date(vo.created_at).toLocaleDateString('en-GB')}`, 20, 67);
    
    doc.text(`Project Ref: ${projectNumber} — ${projectName}`, pageWidth / 2, 62);
    doc.text(`VO Type: ${vo.vo_type}`, pageWidth / 2, 67);

    // Client Instruction Metadata
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text('AUTHORITY & INSTRUCTION:', 15, 82);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(grayText[0], grayText[1], grayText[2]);
    doc.text([
      `Origin Source: ${vo.origin}`,
      `Instruction Ref No: ${vo.instruction_reference}`,
      `Instruction Date: ${new Date(vo.instruction_date).toLocaleDateString('en-GB')}`
    ], 15, 87);

    // Project Details right side
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text('CONTRACT DETAILS:', pageWidth / 2 + 10, 82);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(grayText[0], grayText[1], grayText[2]);
    doc.text([
      `Client Partner: ${vo.client_name || 'N/A'}`,
      `Original contract: AED ${fmt(originalContractValue)}`,
      `EOT Extension: ${vo.time_impact_days} Calendar Days`
    ], pageWidth / 2 + 10, 87);

    // Divider
    doc.setDrawColor(230, 235, 240);
    doc.line(15, 105, pageWidth - 15, 105);

    // Subject/Title & Justification
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text(`VO Title: ${vo.title}`, 15, 111);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(50, 50, 50);
    
    const descWrapped = doc.splitTextToSize(vo.description || 'No description provided.', pageWidth - 30);
    doc.text(descWrapped, 15, 118);
    
    let currentY = 118 + (descWrapped.length * 4.5) + 4;
    
    if (vo.justification) {
      doc.setFont('helvetica', 'bold');
      doc.text('Justification for change:', 15, currentY);
      currentY += 4.5;
      doc.setFont('helvetica', 'normal');
      const justWrapped = doc.splitTextToSize(vo.justification, pageWidth - 30);
      doc.text(justWrapped, 15, currentY);
      currentY += (justWrapped.length * 4) + 6;
    } else {
      currentY += 2;
    }

    // ============================================================
    // BILL OF QUANTITIES / ITEMS TABLE
    // ============================================================
    const columns = [
      { header: 'No', dataKey: 'no' },
      { header: 'Action', dataKey: 'action' },
      { header: 'Description', dataKey: 'description' },
      { header: 'Unit', dataKey: 'unit' },
      { header: 'Qty', dataKey: 'qty' },
      { header: 'Rate (AED)', dataKey: 'unit_sell' },
      { header: 'Amount (AED)', dataKey: 'line_sell' }
    ];

    const rows = items.map((item, idx) => ({
      no: idx + 1,
      action: item.action,
      description: item.description,
      unit: item.unit,
      qty: item.quantity,
      unit_sell: fmt(item.unit_sell),
      line_sell: fmt(item.line_sell)
    }));

    autoTable(doc, {
      columns: columns,
      body: rows,
      startY: currentY,
      theme: 'plain',
      styles: {
        fontSize: 8,
        cellPadding: 2,
        valign: 'middle'
      },
      columnStyles: {
        no: { cellWidth: 10, halign: 'center' },
        action: { cellWidth: 18, halign: 'center' },
        description: { cellWidth: 80 },
        unit: { cellWidth: 15, halign: 'center' },
        qty: { cellWidth: 15, halign: 'center' },
        unit_sell: { cellWidth: 22, halign: 'right' },
        line_sell: { cellWidth: 25, halign: 'right' }
      },
      didParseCell: (data) => {
        const row = data.row.raw as any;
        if (row && row.action === 'OMIT') {
          data.cell.styles.textColor = [180, 50, 50]; // RED for omissions
        }
      },
      margin: { left: 15, right: 15 }
    });

    let finalY = (doc as any).lastAutoTable.finalY + 8;

    // Check page overflow
    if (finalY > pageHeight - 65) {
      doc.addPage();
      finalY = 20;
    }

    // Totals Box
    const startX = pageWidth - 95;
    doc.setTextColor(grayText[0], grayText[1], grayText[2]);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);

    // Subtotal
    doc.text('VO Net Subtotal (Excl. VAT)', startX, finalY);
    doc.text(`AED ${fmt(vo.sell_amount)}`, pageWidth - 15, finalY, { align: 'right' });
    finalY += 5;

    // VAT
    doc.text(`VAT @ 5.00%`, startX, finalY);
    doc.text(`AED ${fmt(vo.vat_amount)}`, pageWidth - 15, finalY, { align: 'right' });
    finalY += 6;

    // Grand total
    doc.setFillColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
    doc.rect(startX - 2, finalY - 4, pageWidth - startX - 13, 8, 'F');
    
    doc.setTextColor(6, 8, 20);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.text('VO Grand Total Net Effect', startX, finalY);
    doc.text(`AED ${fmt(vo.total_incl_vat)}`, pageWidth - 15, finalY, { align: 'right' });
    finalY += 10;

    // Net Effect on Contract Value
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text('CONTRACT AMENDMENT IMPACT:', 15, finalY - 8);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text([
      `Original Contract Value: AED ${fmt(originalContractValue)}`,
      `Approved Variations Net: AED ${fmt(vo.sell_amount)}`,
      `Revised Contract Value:  AED ${fmt(originalContractValue + vo.sell_amount)}`
    ], 15, finalY - 3);

    // Amount in words
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text('NET VARIATION VALUE IN WORDS (EXCL. VAT):', 15, finalY + 12);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(grayText[0], grayText[1], grayText[2]);
    const wordsText = convertAmountToWords(vo.sell_amount);
    const wordsWrapped = doc.splitTextToSize(wordsText, startX - 10);
    doc.text(wordsWrapped, 15, finalY + 16);

    // Running footer
    this.addPageBorderAndFooter(doc, 1, 1, vo.vo_number, footerDisclaimer, primaryColor);

    // Signatures blocks
    let sigY = Math.max(finalY + 28, pageHeight - 54);
    doc.setDrawColor(210, 215, 220);
    doc.line(15, sigY, pageWidth - 15, sigY);
    sigY += 5;

    // Left sign: JEET Authorized Signatory
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text('PREPARED BY (JEET INTECH)', 20, sigY);
    doc.setFont('helvetica', 'normal');
    doc.text([
      'Commercial Operations Department',
      'JEET INTECH L.L.C',
      `Status: ${vo.status}`
    ], 20, sigY + 5);

    // Right sign: Client Approval block
    doc.setFont('helvetica', 'bold');
    doc.text('CLIENT SIGN-OFF / APPROVAL', pageWidth / 2 + 15, sigY);
    doc.setFont('helvetica', 'normal');
    doc.text([
      'Client Representative Signature & Stamp',
      `Approval Ref: ${vo.client_approval_ref || 'Awaiting Formal Signature'}`,
      `Approval Date: ${vo.client_approval_date ? new Date(vo.client_approval_date).toLocaleDateString('en-GB') : '—'}`
    ], pageWidth / 2 + 15, sigY + 5);

    return doc;
  },

  /**
   * Header and footer formatter
   */
  addPageBorderAndFooter(doc: jsPDF, pageNum: number, totalPages: number, voNo: string, footerDisclaimer?: string, primaryColor: [number, number, number] = [6, 8, 20]) {
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    // Page Border
    doc.setDrawColor(230, 235, 240);
    doc.rect(8, 8, pageWidth - 16, pageHeight - 16);

    // Running Footer
    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.rect(8, pageHeight - 13, pageWidth - 16, 5, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    const textStr = footerDisclaimer || 'JEET INTECH L.L.C  |  Dubai, UAE  |  TRN: 100489562300003  |  info@jeetintech.com  |  Confidential Variation Sheet';
    doc.text(textStr, 12, pageHeight - 9.5);
    doc.text(`Page ${pageNum} of ${totalPages}`, pageWidth - 12, pageHeight - 9.5, { align: 'right' });
  }
};

export default voPDFService;
