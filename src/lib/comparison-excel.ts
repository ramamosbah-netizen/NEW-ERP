// ============================================================
// JEET ERP — Supplier Comparison Sheet Excel Exporter
// Client-side multi-sheet Excel generator using SheetJS (xlsx)
// ============================================================

import * as XLSX from 'xlsx';
import { comparisonService } from './comparison-service';

const fmtAED = (v: number) => {
  return 'AED ' + new Intl.NumberFormat('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
};

export const comparisonExcelService = {
  
  async generate(comparisonId: string): Promise<void> {
    const comp = await comparisonService.fetchComparisonById(comparisonId);
    if (!comp) throw new Error('Supplier comparison sheet not found.');

    const wb = XLSX.utils.book_new();

    // ============================================================
    // SHEET 1: PROJECT & FINANCIAL SUMMARY
    // ============================================================
    const projectInfoData = [
      ['JEET INTECH L.L.C — SUPPLIER COMPARISON SHEET SUMMARY'],
      [],
      ['COMPARISON META-DATA'],
      ['Sheet Number', comp.comparison_number],
      ['Revision', `Rev.${comp.revision}`],
      ['Status', comp.status],
      ['Tender Reference', comp.tender_ref || 'N/A'],
      ['Quotation Reference', comp.quotation_ref || 'N/A'],
      ['Project Reference', comp.project_ref],
      ['Project Subject/Name', comp.project_name],
      ['Date Generated', new Date(comp.comparison_date).toLocaleDateString('en-GB')],
      ['Prepared By', comp.prepared_by_name],
      ['Currency', comp.currency],
      [],
      ['FINANCIAL SCORECARD'],
      ['Total BOQ Material Budget (AED)', comp.total_boq_material_cost],
      ['Total Project Material Revenue (AED)', comp.total_quotation_material_revenue],
      ['Total Selected Supplier Award Cost (AED)', comp.total_selected_supplier_cost],
      ['Total Lowest Possible Cost (AED)', comp.total_lowest_supplier_cost],
      ['Total Savings vs BOQ (AED)', comp.total_savings_vs_boq],
      ['Savings Percentage (%)', `${comp.total_savings_pct.toFixed(1)}%`],
      ['Composite Gross Margin Amount (AED)', comp.overall_margin_amount],
      ['Composite Margin Percentage (%)', `${comp.overall_margin_pct.toFixed(2)}%`],
      ['Margin Health Status', comp.margin_status],
      [],
      ['AUDIT COUNTS'],
      ['Supplier Recommendation Overrides', comp.override_count],
      ['Line Item Exceptions (<3 quotes)', comp.exception_count],
      ['Potential Extra Savings Bypassed (AED)', comp.potential_extra_savings]
    ];

    const projectInfoSheet = XLSX.utils.aoa_to_sheet(projectInfoData);
    
    // Column widths for Sheet 1
    projectInfoSheet['!cols'] = [
      { wch: 40 }, // label
      { wch: 55 }  // value
    ];

    XLSX.utils.book_append_sheet(wb, projectInfoSheet, 'Project Info');

    // ============================================================
    // SHEET 2: DETAILED SIDE-BY-SIDE MATRIX GRID
    // ============================================================
    
    // Extract unique supplier names
    const allSupplierNames = Array.from(
      new Set(
        comp.items.flatMap((item: any) => 
          (item.offers || []).map((o: any) => o.supplier_name)
        )
      )
    ).sort() as string[];

    const itemsHeaders = [
      '#',
      'System',
      'Category',
      'Item Code',
      'Item Description',
      'Quantity',
      'Unit',
      'BOQ Unit Budget (AED)',
      'BOQ Total Budget (AED)',
    ];

    // Add headers for each supplier dynamically
    allSupplierNames.forEach(sup => {
      itemsHeaders.push(`${sup} - Unit Price (AED)`);
      itemsHeaders.push(`${sup} - Lead (Days)`);
      itemsHeaders.push(`${sup} - Credit Terms (Days)`);
      itemsHeaders.push(`${sup} - Compliant`);
      itemsHeaders.push(`${sup} - Composite Score`);
      itemsHeaders.push(`${sup} - Rank`);
    });

    itemsHeaders.push('Selected Supplier');
    itemsHeaders.push('Selected Unit Cost (AED)');
    itemsHeaders.push('Selected Total Cost (AED)');
    itemsHeaders.push('BOQ Savings (AED)');
    itemsHeaders.push('Margin Amount (AED)');
    itemsHeaders.push('Margin %');
    itemsHeaders.push('Override Justification Reason');

    const matrixRows = comp.items.map((item: any, idx: number) => {
      const row: any[] = [
        idx + 1,
        item.system,
        item.category,
        item.item_code || '—',
        item.description,
        item.quantity,
        item.unit,
        item.boq_unit_material_cost,
        item.boq_total_material_cost,
      ];

      allSupplierNames.forEach(sup => {
        const offer = (item.offers || []).find((o: any) => o.supplier_name === sup);
        if (offer) {
          row.push(offer.unit_price);
          row.push(offer.delivery_days ?? 'TBC');
          row.push(offer.payment_terms_days);
          row.push(offer.is_compliant ? 'YES' : 'NO');
          row.push(offer.score_total);
          row.push(offer.rank);
        } else {
          row.push('', '', '', '', '', '');
        }
      });

      const selectedOffer = (item.offers || []).find((o: any) => o.id === item.selected_supplier_offer_id);
      
      row.push(selectedOffer ? selectedOffer.supplier_name : 'NOT SELECTED');
      row.push(item.selected_unit_cost);
      row.push(item.selected_total_cost);
      row.push(item.item_savings_vs_boq);
      row.push(item.item_margin_amount);
      row.push(item.item_margin_pct);
      row.push(item.override_reason || '');

      return row;
    });

    // Add aggregate totals row
    const totalsRow = [
      'TOTALS',
      '',
      '',
      '',
      'Grand Total Aggregations',
      '',
      '',
      '',
      comp.total_boq_material_cost,
    ];

    allSupplierNames.forEach(() => {
      totalsRow.push('', '', '', '', '', '');
    });

    totalsRow.push(
      '',
      '',
      comp.total_selected_supplier_cost,
      comp.total_savings_vs_boq,
      comp.overall_margin_amount,
      comp.overall_margin_pct,
      ''
    );
    matrixRows.push(totalsRow);

    const matrixSheet = XLSX.utils.aoa_to_sheet([itemsHeaders, ...matrixRows]);
    
    // Set widths for standard matrix columns
    const colWidths = [
      { wch: 5 },   // #
      { wch: 15 },  // System
      { wch: 15 },  // Category
      { wch: 15 },  // Code
      { wch: 45 },  // Description
      { wch: 10 },  // Qty
      { wch: 8 },   // Unit
      { wch: 22 },  // BOQ Unit
      { wch: 22 },  // BOQ Total
    ];

    // Supplier columns widths
    allSupplierNames.forEach(() => {
      colWidths.push(
        { wch: 22 }, // Price
        { wch: 12 }, // Lead
        { wch: 16 }, // Credit
        { wch: 12 }, // Compliant
        { wch: 14 }, // Score
        { wch: 8 }   // Rank
      );
    });

    // Selected columns widths
    colWidths.push(
      { wch: 25 }, // Sel Supplier name
      { wch: 22 }, // Sel Unit Cost
      { wch: 22 }, // Sel Total Cost
      { wch: 20 }, // Savings vs BOQ
      { wch: 20 }, // Margin Amt
      { wch: 12 }, // Margin %
      { wch: 45 }  // Justification Reason
    );

    matrixSheet['!cols'] = colWidths;
    XLSX.utils.book_append_sheet(wb, matrixSheet, 'Comparison Matrix');

    // ============================================================
    // SHEET 3: SUPPLIER OFFERS & SCORES SCOREBOARD
    // ============================================================
    const scoreHeaders = [
      'Supplier Corporate Name',
      'Item Description',
      'Qty',
      'Unit price (AED)',
      'Total price (AED)',
      'Delivery days',
      'Credit Terms (Days)',
      'Specifications Compliant',
      'Price score',
      'Delivery score',
      'Supplier History score',
      'Payment terms score',
      'Compliance score',
      'Composite Total score',
      'Evaluation Rank',
      'Auto Recommended'
    ];

    const scoreRows: any[] = [];

    comp.items.forEach((item: any) => {
      (item.offers || []).forEach((o: any) => {
        scoreRows.push([
          o.supplier_name,
          item.description,
          item.quantity,
          o.unit_price,
          o.total_price,
          o.delivery_days ?? 'TBC',
          o.payment_terms_days,
          o.is_compliant ? 'YES' : 'NO',
          o.score_price,
          o.score_delivery,
          o.score_history,
          o.score_payment,
          o.score_compliance,
          o.score_total,
          o.rank,
          o.is_recommended ? 'YES (RANK 1)' : 'NO'
        ]);
      });
    });

    const scoresSheet = XLSX.utils.aoa_to_sheet([scoreHeaders, ...scoreRows]);
    scoresSheet['!cols'] = [
      { wch: 30 }, // supplier
      { wch: 40 }, // item description
      { wch: 8 },  // qty
      { wch: 18 }, // unit price
      { wch: 18 }, // total price
      { wch: 14 }, // lead time
      { wch: 20 }, // credit terms
      { wch: 22 }, // compliant
      { wch: 14 }, // price score
      { wch: 14 }, // lead score
      { wch: 16 }, // history score
      { wch: 16 }, // payment score
      { wch: 14 }, // comp score
      { wch: 16 }, // composite score
      { wch: 12 }, // rank
      { wch: 18 }  // recommended
    ];

    XLSX.utils.book_append_sheet(wb, scoresSheet, 'Supplier Scores');

    // Trigger XLSX Write in browser
    XLSX.writeFile(wb, `${comp.comparison_number}_Rev${comp.revision}_Supplier_Comparison.xlsx`);
  }
};
