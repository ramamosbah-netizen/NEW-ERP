// ============================================================
// JEET ERP — Supplier Comparison Sheet PDF Exporter
// Client-side document builder using jsPDF and jspdf-autotable
// Renders premium landscape layouts and signature seals
// ============================================================

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase } from './supabase';
import { comparisonService } from './comparison-service';

const fmtAED = (v: number) => {
  return 'AED ' + new Intl.NumberFormat('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
};

export const comparisonPDFService = {
  
  async generate(comparisonId: string): Promise<Blob> {
    const comp = await comparisonService.fetchComparisonById(comparisonId);
    if (!comp) throw new Error('Supplier comparison sheet not found.');

    // Create a landscape PDF
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth(); // A4 Landscape is ~297mm
    const pageHeight = doc.internal.pageSize.getHeight(); // A4 Landscape is ~210mm

    // --- Design System Constants ---
    const primaryColor: [number, number, number] = [6, 8, 20]; // Deep Obsidian Black
    const mintColor: [number, number, number] = [37, 99, 235]; // Electric Mint
    const slateGray: [number, number, number] = [100, 116, 139]; // Slate Gray
    const lightRowBg: [number, number, number] = [248, 250, 252]; // Soft Gray

    // ============================================================
    // PAGE 1 — COMPARISON METRICS SUMMARY & OVERRIDES LOGS
    // ============================================================
    
    // Top banner
    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.rect(0, 0, pageWidth, 35, 'F');

    // Corporate Logo Icon
    doc.setFillColor(mintColor[0], mintColor[1], mintColor[2]);
    doc.rect(15, 8, 6, 10, 'F');
    doc.setFillColor(255, 255, 255);
    doc.rect(19, 11, 6, 10, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text('JEET INTECH L.L.C', 28, 15);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(180, 190, 200);
    doc.text('SUPPLIER COMPARISON INTEL ENGINE', 28, 20);

    // TRN details
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    doc.text([
      'JEET INTECH L.L.C',
      'TRN: 100489562300003',
      'Dubai, United Arab Emirates',
      'info@jeetintech.com'
    ], pageWidth - 15, 9, { align: 'right' });

    // Document Title Block
    doc.setFillColor(243, 244, 246);
    doc.rect(15, 40, pageWidth - 30, 22, 'F');
    doc.setDrawColor(209, 213, 219);
    doc.rect(15, 40, pageWidth - 30, 22, 'S');

    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text(`SUPPLIER COMPARISON: ${comp.comparison_number} (Rev.${comp.revision})`, 20, 47);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(slateGray[0], slateGray[1], slateGray[2]);
    doc.text(`Project: ${comp.project_name} | Ref: ${comp.project_ref}`, 20, 52);
    doc.text(`Client: ${comp.client_name} | Quote Ref: ${comp.quotation_ref}`, 20, 57);
    
    doc.text(`Date: ${new Date(comp.comparison_date).toLocaleDateString('en-GB')}`, pageWidth / 2 + 30, 47);
    doc.text(`Target Margin: ${comp.target_margin_pct}%`, pageWidth / 2 + 30, 52);
    doc.text(`Status: ${comp.status}`, pageWidth / 2 + 30, 57);

    // Prepare by
    doc.text(`Prepared By: ${comp.prepared_by_name}`, pageWidth - 110, 47);
    doc.text(`Currency: ${comp.currency}`, pageWidth - 110, 52);

    // Financial KPI Cards layout
    const kpiWidth = (pageWidth - 30) / 4 - 3;
    const kpiY = 66;

    // Card 1: BOQ Material Budget
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.rect(15, kpiY, kpiWidth, 18, 'F');
    doc.rect(15, kpiY, kpiWidth, 18, 'S');
    doc.setTextColor(slateGray[0], slateGray[1], slateGray[2]);
    doc.setFontSize(7.5);
    doc.text('TOTAL BOQ BUDGET COST', 19, kpiY + 5);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(fmtAED(comp.total_boq_material_cost), 19, kpiY + 12);

    // Card 2: Awarded Supplier Cost
    doc.setFillColor(248, 250, 252);
    doc.rect(15 + kpiWidth + 4, kpiY, kpiWidth, 18, 'F');
    doc.rect(15 + kpiWidth + 4, kpiY, kpiWidth, 18, 'S');
    doc.setTextColor(slateGray[0], slateGray[1], slateGray[2]);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text('TOTAL PROCUREMENT AWARD', 19 + kpiWidth + 4, kpiY + 5);
    doc.setTextColor(0, 150, 90); // Greenish text
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(fmtAED(comp.total_selected_supplier_cost), 19 + kpiWidth + 4, kpiY + 12);

    // Card 3: Margin achieved
    doc.setFillColor(248, 250, 252);
    doc.rect(15 + 2 * kpiWidth + 8, kpiY, kpiWidth, 18, 'F');
    doc.rect(15 + 2 * kpiWidth + 8, kpiY, kpiWidth, 18, 'S');
    doc.setTextColor(slateGray[0], slateGray[1], slateGray[2]);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text('COMPOSITE MARGIN %', 19 + 2 * kpiWidth + 8, kpiY + 5);
    const mColor = comp.overall_margin_pct >= comp.target_margin_pct ? [16, 185, 129] : [239, 68, 68];
    doc.setTextColor(mColor[0], mColor[1], mColor[2]);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(`${Number(comp.overall_margin_pct).toFixed(2)}%`, 19 + 2 * kpiWidth + 8, kpiY + 12);

    // Card 4: Savings vs Budget
    doc.setFillColor(248, 250, 252);
    doc.rect(15 + 3 * kpiWidth + 12, kpiY, kpiWidth, 18, 'F');
    doc.rect(15 + 3 * kpiWidth + 12, kpiY, kpiWidth, 18, 'S');
    doc.setTextColor(slateGray[0], slateGray[1], slateGray[2]);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text('PROCUREMENT SAVINGS VS BOQ', 19 + 3 * kpiWidth + 12, kpiY + 5);
    doc.setTextColor(6, 182, 212); // Teal
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(`${fmtAED(comp.total_savings_vs_boq)} (${Number(comp.total_savings_pct).toFixed(1)}%)`, 19 + 3 * kpiWidth + 12, kpiY + 12);

    // Overrides section
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('SUPPLIER RECOMMENDATION OVERRIDES AUDIT LOG', 15, 92);

    const overriddenItems = comp.items.filter((i: any) => !i.selection_matches_recommendation);
    
    if (overriddenItems.length === 0) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8.5);
      doc.setTextColor(slateGray[0], slateGray[1], slateGray[2]);
      doc.text('No supplier recommendation overrides logged. All selections match Rank 1 scored options.', 15, 98);
    } else {
      const auditRows = overriddenItems.map((item: any) => {
        const selOffer = (item.offers || []).find((o: any) => o.id === item.selected_supplier_offer_id);
        const recOffer = (item.offers || []).find((o: any) => o.id === item.recommended_supplier_offer_id);
        return [
          item.description,
          `${item.quantity} ${item.unit}`,
          recOffer ? recOffer.supplier_name : 'N/A',
          selOffer ? selOffer.supplier_name : 'N/A',
          fmtAED(item.override_cost_impact),
          item.override_reason || 'N/A'
        ];
      });

      autoTable(doc, {
        startY: 96,
        margin: { left: 15, right: 15 },
        head: [['Item Description', 'Qty', 'Recommended Supplier', 'Selected Supplier', 'Cost Impact', 'Justification Reason']],
        body: auditRows,
        styles: { fontSize: 7.5, cellPadding: 2 },
        headStyles: { fillColor: primaryColor, textColor: [255, 255, 255], fontStyle: 'bold' }
      });
    }

    // SIGNATURE SEALS BLOCK at bottom
    const sigY = pageHeight - 42;
    doc.setDrawColor(229, 231, 235);
    doc.line(15, sigY, pageWidth - 15, sigY);

    // Estimator
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(slateGray[0], slateGray[1], slateGray[2]);
    doc.text('PREPARED BY (Procurement)', 15, sigY + 5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text(comp.prepared_by_name, 15, sigY + 10);
    doc.setFont('helvetica', 'italic');
    doc.text('Signature Logged electronically', 15, sigY + 14);

    // Commercial Manager
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(slateGray[0], slateGray[1], slateGray[2]);
    doc.text('COMMERCIAL MANAGER REVIEW', pageWidth / 2 - 40, sigY + 5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text(comp.commercial_approver_id ? 'Commercial Manager' : 'PENDING REVIEW', pageWidth / 2 - 40, sigY + 10);
    if (comp.commercial_approved_at) {
      doc.setFont('helvetica', 'italic');
      doc.text(`Authorized: ${new Date(comp.commercial_approved_at).toLocaleDateString('en-GB')}`, pageWidth / 2 - 40, sigY + 14);
    }

    // General Manager
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(slateGray[0], slateGray[1], slateGray[2]);
    doc.text('GENERAL MANAGER FINAL SIGN-OFF', pageWidth - 100, sigY + 5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text(comp.gm_approver_id ? 'General Manager' : 'PENDING SIGN-OFF', pageWidth - 100, sigY + 10);

    // Render signature drawing if available!
    if (comp.gm_comment && comp.gm_comment.includes('[SIGNATURE:')) {
      try {
        const sigData = comp.gm_comment.match(/\[SIGNATURE:(data:image\/png;base64,[^\]]+)\]/);
        if (sigData && sigData[1]) {
          const imgBase64 = sigData[1];
          doc.addImage(imgBase64, 'PNG', pageWidth - 98, sigY + 12, 35, 12);
        }
      } catch (err) {
        console.error('Error drawing GM signature in PDF:', err);
      }
    }

    if (comp.gm_approved_at) {
      doc.setFont('helvetica', 'italic');
      doc.text(`Approved & Sealed: ${new Date(comp.gm_approved_at).toLocaleDateString('en-GB')}`, pageWidth - 100, sigY + 28);
    }

    // Add watermark if not approved
    if (comp.status !== 'APPROVED') {
      doc.setFontSize(45);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(239, 68, 68, 0.08); // faint red transparent watermark
      doc.text('DRAFT COMPARISON SHEET', pageWidth / 2, pageHeight / 2 - 10, { align: 'center', angle: 25 });
    }

    // ============================================================
    // PAGE 2 — DETAILED SUPPLIER matrix grid
    // ============================================================
    doc.addPage();
    
    // Header for Page 2
    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.rect(0, 0, pageWidth, 22, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(`COMPARISON SHEET MATRIX GRID: ${comp.comparison_number}`, 15, 11);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(180, 190, 200);
    doc.text(`Project: ${comp.project_name} | Client: ${comp.client_name}`, 15, 16);

    // Render Matrix Table Columns
    // Standard left columns: description, qty, boq unit, boq total.
    // Dynamic supplier columns: up to 3 suppliers compared side by side.
    const allSupplierNames = Array.from(
      new Set(
        comp.items.flatMap((item: any) => 
          (item.offers || []).map((o: any) => o.supplier_name)
        )
      )
    ).sort() as string[];

    const headers: string[] = ['No', 'Item Description / Details', 'Qty / Unit', 'BOQ Mat. (AED)'];
    
    allSupplierNames.forEach((sup) => {
      // Clean supplier name for header display
      const shortened = sup.length > 22 ? sup.substring(0, 20) + '..' : sup;
      headers.push(`${shortened}\nPrice | Lead | Pay | Score`);
    });

    headers.push('Selected Supplier\nProcured Cost');

    // Compile rows
    const matrixRows = comp.items.map((item: any, idx: number) => {
      const row: any[] = [
        idx + 1,
        `${item.description}\nCode: ${item.item_code || 'N/A'}`,
        `${item.quantity} ${item.unit}`,
        fmtAED(item.boq_total_material_cost)
      ];

      allSupplierNames.forEach((sup) => {
        const offer = (item.offers || []).find((o: any) => o.supplier_name === sup);
        if (offer) {
          const compTag = offer.is_compliant ? '' : ' (NC)';
          row.push(`${fmtAED(offer.unit_price)}${compTag}\nLd: ${offer.delivery_days ?? '-'}d | Pay: ${offer.payment_terms_days}d | Sc: ${offer.score_total.toFixed(0)}`);
        } else {
          row.push('-\n-');
        }
      });

      const chosenOffer = (item.offers || []).find((o: any) => o.id === item.selected_supplier_offer_id);
      row.push(chosenOffer ? `${chosenOffer.supplier_name}\n${fmtAED(item.selected_total_cost)}` : 'NOT SELECTED\n-');

      return row;
    });

    // Totals footer row
    const totalsRow = [
      '',
      'Grand Totals',
      '',
      fmtAED(comp.total_boq_material_cost),
    ];
    allSupplierNames.forEach(() => {
      totalsRow.push('');
    });
    totalsRow.push(`Selected Award:\n${fmtAED(comp.total_selected_supplier_cost)}`);
    matrixRows.push(totalsRow);

    autoTable(doc, {
      startY: 28,
      margin: { left: 10, right: 10 },
      head: [headers],
      body: matrixRows,
      styles: { fontSize: 7, cellPadding: 1.5, overflow: 'linebreak', font: 'helvetica' },
      headStyles: { fillColor: primaryColor, textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center' },
      columnStyles: {
        '0': { cellWidth: 8 },
        '1': { cellWidth: 50 },
        '2': { cellWidth: 14 },
        '3': { cellWidth: 22 },
        // selected supplier
        [(headers.length - 1).toString()]: { cellWidth: 35, fontStyle: 'bold', fillColor: [243, 244, 246] }
      },
      didParseCell: (data) => {
        // Highlight totals row in table footer
        if (data.row.index === matrixRows.length - 1) {
          data.cell.styles.fillColor = [229, 231, 235];
          data.cell.styles.fontStyle = 'bold';
        }
      }
    });

    // Save as blob
    const pdfBlob = doc.output('blob');
    return pdfBlob;
  }
};
