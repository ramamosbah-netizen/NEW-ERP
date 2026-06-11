// ============================================================
// BOQ Export Utilities — PDF & Excel Generation
// Client-side document generation using jspdf + xlsx
// ============================================================

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { formatCurrency, BOQ_STATUS_LABELS } from './boq-calculations';
import type { BOQItem, CostElements, Financials, BOQStatus } from './boq-calculations';

// --- Types ---

type TenderRef = {
  id: string;
  title: string;
  project_name: string;
  client_name: string;
  location: string;
};

type BOQRef = {
  id: string;
  status: BOQStatus;
  version: number;
  created_at: string;
};

type ApprovalEntry = {
  stage: string;
  approved_by: string;
  email: string;
  approved_at: string;
  note: string;
};

// --- PDF Export ---

export function exportBOQToPDF(
  tender: TenderRef,
  boq: BOQRef,
  items: BOQItem[],
  costElements: CostElements,
  financials: Financials,
  approvalHistory: ApprovalEntry[]
): void {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 15;

  // ---- Company Header ----
  doc.setFillColor(6, 8, 20);
  doc.rect(0, 0, pageWidth, 38, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('AURA ERP', 14, 16);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(180, 180, 200);
  doc.text('Enterprise Resource Planning System', 14, 22);
  doc.text('Bill of Quantities — Financial Costing Report', 14, 27);

  // Reference numbers on right
  doc.setFontSize(8);
  doc.setTextColor(150, 160, 180);
  doc.text(`Tender Ref: ${tender.id.slice(0, 8).toUpperCase()}`, pageWidth - 14, 16, { align: 'right' });
  doc.text(`BOQ Ref: ${boq.id.slice(0, 8).toUpperCase()}`, pageWidth - 14, 21, { align: 'right' });
  doc.text(`Version: v${boq.version}`, pageWidth - 14, 26, { align: 'right' });
  doc.text(`Status: ${BOQ_STATUS_LABELS[boq.status]}`, pageWidth - 14, 31, { align: 'right' });

  y = 45;

  // ---- Tender Info ----
  doc.setTextColor(40, 40, 60);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('PROJECT INFORMATION', 14, y);
  y += 6;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(60, 60, 80);
  const infoLines = [
    [`Tender Title:`, tender.title],
    [`Project Name:`, tender.project_name],
    [`Client:`, tender.client_name],
    [`Location:`, tender.location],
    [`Generated:`, new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })],
  ];

  infoLines.forEach(([label, value]) => {
    doc.setFont('helvetica', 'bold');
    doc.text(label, 14, y);
    doc.setFont('helvetica', 'normal');
    doc.text(value, 50, y);
    y += 5;
  });

  y += 4;

  // ---- Items Table ----
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(40, 40, 60);
  doc.text('BOQ LINE ITEMS SUMMARY', 14, y);
  y += 3;

  const tableHead = [[
    '#', 
    'Code',
    'Item Description', 
    'Qty', 
    'Unit',
    'Supply Cost', 
    'Labour Cost', 
    'Subcontract', 
    'Equipment', 
    'Logistics', 
    'Wastage', 
    'Risk', 
    'Overhead', 
    'Total Cost',
    'Profit',
    'Selling Cost'
  ]];
  
  const tableBody = items.map((item, idx) => [
    String(idx + 1),
    item.item_code || '—',
    item.name || '—',
    String(item.quantity),
    item.unit || 'Pcs',
    formatCurrency(item.material_total_cost || 0),
    formatCurrency(item.gross_labour_cost || 0),
    formatCurrency(item.subcontract_cost || 0),
    formatCurrency(item.equipment_cost || 0),
    formatCurrency(item.logistics_cost || 0),
    formatCurrency(item.wastage_cost || 0),
    formatCurrency(item.risk_cost || 0),
    formatCurrency(item.site_overhead_cost || 0),
    formatCurrency(item.total_cost || 0),
    formatCurrency(item.profit_value || 0),
    formatCurrency(item.total_price || 0),
  ]);

  // Add summaries row
  tableBody.push([
    '', 
    'Totals Summary:', 
    '',
    String(items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0)), 
    '',
    formatCurrency(financials.supply_total),
    formatCurrency(financials.labor_total),
    formatCurrency(financials.subcontract_cost),
    formatCurrency(financials.equipment_cost),
    formatCurrency(financials.logistics_cost),
    formatCurrency(financials.wastage_value),
    formatCurrency(financials.risk_cost),
    formatCurrency(financials.overhead_value),
    formatCurrency(financials.direct_total + financials.indirect_total),
    formatCurrency(financials.profit_value),
    formatCurrency(financials.total_selling_price),
  ]);

  autoTable(doc, {
    startY: y,
    head: tableHead,
    body: tableBody,
    theme: 'grid',
    headStyles: {
      fillColor: [99, 102, 241],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 6.5,
    },
    bodyStyles: {
      fontSize: 6,
      textColor: [40, 40, 60],
    },
    alternateRowStyles: { fillColor: [245, 245, 252] },
    columnStyles: {
      0: { cellWidth: 6, halign: 'center' },
      1: { cellWidth: 15 },
      2: { cellWidth: 42 },
      3: { cellWidth: 8, halign: 'center' },
      4: { cellWidth: 8, halign: 'center' },
      5: { cellWidth: 16, halign: 'right' },
      6: { cellWidth: 16, halign: 'right' },
      7: { cellWidth: 16, halign: 'right' },
      8: { cellWidth: 16, halign: 'right' },
      9: { cellWidth: 16, halign: 'right' },
      10: { cellWidth: 14, halign: 'right' },
      11: { cellWidth: 14, halign: 'right' },
      12: { cellWidth: 14, halign: 'right' },
      13: { cellWidth: 18, halign: 'right' },
      14: { cellWidth: 14, halign: 'right' },
      15: { cellWidth: 22, halign: 'right' },
    },
    margin: { left: 14, right: 14 },
    didParseCell: function (data) {
      if (data.row.index === tableBody.length - 1) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = [235, 235, 250];
      }
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = (doc as any).lastAutoTable.finalY + 8;

  // ---- Financial Breakdown ----
  if (y > 200) {
    doc.addPage();
    y = 15;
  }

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(40, 40, 60);
  doc.text('FINANCIAL ESTIMATION BREAKDOWN', 14, y);
  y += 3;

  const finRows = [
    ['Material Supply Cost Total', formatCurrency(financials.supply_total)],
    ['Labour Cost Total', formatCurrency(financials.labor_total)],
    ['  └ Technicians Labour', formatCurrency(financials.labor_breakdown.technician)],
    ['  └ Engineers Labour', formatCurrency(financials.labor_breakdown.engineer)],
    ['  └ Project Managers Labour', formatCurrency(financials.labor_breakdown.project_manager)],
    ['Subcontractor Cost Total', formatCurrency(financials.subcontract_cost)],
    ['Equipment Cost Total', formatCurrency(financials.equipment_cost)],
    ['Logistics Cost Total', formatCurrency(financials.logistics_cost)],
    ['Wastage Amount Total', formatCurrency(financials.wastage_value)],
    ['Risk Amount Total', formatCurrency(financials.risk_cost)],
    ['Site Overhead Amount Total', formatCurrency(financials.overhead_value)],
    ['', ''],
    ['DIRECT COST TOTAL (Material + Labour + Subcontract + Equipment + Logistics + Wastage)', formatCurrency(financials.direct_total)],
    ['INDIRECT COST TOTAL (Risk + Site Overhead)', formatCurrency(financials.indirect_total)],
    ['ESTIMATED TOTAL COST (Direct + Indirect)', formatCurrency(financials.direct_total + financials.indirect_total)],
    ['Profit Amount Total', formatCurrency(financials.profit_value)],
    ['', ''],
    ['AVERAGE UNIT SELLING PRICE', formatCurrency(financials.unit_selling_price)],
    ['GRAND TOTAL ITEM SELLING PRICE', formatCurrency(financials.total_selling_price)],
  ];

  autoTable(doc, {
    startY: y,
    body: finRows,
    theme: 'plain',
    bodyStyles: { fontSize: 8.5, textColor: [40, 40, 60] },
    columnStyles: {
      0: { cellWidth: 130 },
      1: { cellWidth: 50, halign: 'right' },
    },
    margin: { left: 14, right: 14 },
    didParseCell: function (data) {
      const text = String(data.cell.raw);
      if (text.includes('TOTAL') || text.includes('PRICE') || text.includes('Cost Total')) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fontSize = 8.5;
      }
      if (text === 'GRAND TOTAL ITEM SELLING PRICE') {
        data.cell.styles.fillColor = [99, 102, 241];
        data.cell.styles.textColor = [255, 255, 255];
        data.cell.styles.fontSize = 9.5;
      }
      if (data.row.index === finRows.length - 1 && data.column.index === 1) {
        data.cell.styles.fillColor = [99, 102, 241];
        data.cell.styles.textColor = [255, 255, 255];
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fontSize = 9.5;
      }
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = (doc as any).lastAutoTable.finalY + 8;

  // ---- Approval Signatures ----
  if (approvalHistory.length > 0) {
    if (y > 230) {
      doc.addPage();
      y = 15;
    }

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(40, 40, 60);
    doc.text('APPROVAL SIGNATURES', 14, y);
    y += 3;

    const approvalHead = [['Stage', 'Approved By', 'Email', 'Date', 'Note']];
    const approvalBody = approvalHistory.map((entry) => [
      entry.stage,
      entry.approved_by,
      entry.email,
      new Date(entry.approved_at).toLocaleDateString(),
      entry.note || '—',
    ]);

    autoTable(doc, {
      startY: y,
      head: approvalHead,
      body: approvalBody,
      theme: 'grid',
      headStyles: {
        fillColor: [16, 185, 129],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8,
      },
      bodyStyles: { fontSize: 7.5, textColor: [40, 40, 60] },
      margin: { left: 14, right: 14 },
    });
  }

  // ---- Footer ----
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(160, 160, 180);
    doc.text(
      `Aura ERP — BOQ Report v${boq.version} — Page ${i} of ${pageCount}`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 8,
      { align: 'center' }
    );
  }

  // Download
  const fileName = `BOQ_${tender.project_name.replace(/\s+/g, '_')}_v${boq.version}.pdf`;
  doc.save(fileName);
}

// --- Excel Export ---

export function exportBOQToExcel(
  tender: TenderRef,
  boq: BOQRef,
  items: BOQItem[],
  costElements: CostElements,
  financials: Financials
): void {
  const wb = XLSX.utils.book_new();

  // ---- Sheet 1: Summary ----
  const summaryData = [
    ['AURA ERP — Bill of Quantities Cost Estimation Report'],
    [],
    ['Tender Reference', tender.id.slice(0, 8).toUpperCase()],
    ['BOQ Reference', boq.id.slice(0, 8).toUpperCase()],
    ['Version', `v${boq.version}`],
    ['Status', BOQ_STATUS_LABELS[boq.status]],
    [],
    ['Tender Title', tender.title],
    ['Project Name', tender.project_name],
    ['Client Name', tender.client_name],
    ['Location Name', tender.location],
    ['Export Timestamp', new Date().toLocaleString()],
  ];

  const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
  summarySheet['!cols'] = [{ wch: 25 }, { wch: 45 }];
  XLSX.utils.book_append_sheet(wb, summarySheet, 'Metadata Summary');

  // ---- Sheet 2: BOQ Items Detailed ----
  const itemsHeader = [
    '#', 
    'Item Code',
    'Item Description', 
    'Unit',
    'Quantity', 
    'Unit Supply Cost (AED)', 
    'Net Purchase Cost (AED)',
    'Total Supply Cost (AED)',
    'Technician Hours',
    'Technician Count',
    'Technician Rate (AED/hr)',
    'Technician Cost (AED)',
    'Engineer Hours',
    'Engineer Count',
    'Engineer Rate (AED/hr)',
    'Engineer Cost (AED)',
    'Project Manager Hours',
    'Project Manager Count',
    'Project Manager Rate (AED/hr)',
    'Project Manager Cost (AED)',
    'Gross Labour Cost (AED)',
    'Subcontract Cost (AED)',
    'Equipment Cost (AED)',
    'Logistics Cost (AED)',
    'Wastage %',
    'Wastage Cost (AED)',
    'Risk %',
    'Risk Cost (AED)',
    'Site Overhead %',
    'Site Overhead Cost (AED)',
    'Total Cost (AED)',
    'Profit %',
    'Profit Value (AED)',
    'Unit Selling Price (AED)', 
    'Total Selling Price (AED)'
  ];

  const itemsRows = items.map((item, idx) => [
    idx + 1,
    item.item_code || '—',
    item.name || '—',
    item.unit || 'Pcs',
    item.quantity,
    item.material_unit_cost || 0,
    item.net_purchase_cost_per_unit || item.material_unit_cost || 0,
    item.material_total_cost || 0,
    item.labor_technician_hours || 0,
    item.labor_technician_count || 0,
    item.labor_technician_rate || 0,
    item.labor_technician_cost || 0,
    item.labor_engineer_hours || 0,
    item.labor_engineer_count || 0,
    item.labor_engineer_rate || 0,
    item.labor_engineer_cost || 0,
    item.labor_pm_hours || 0,
    item.labor_pm_count || 0,
    item.labor_pm_rate || 0,
    item.labor_pm_cost || 0,
    item.gross_labour_cost || 0,
    item.subcontract_cost || 0,
    item.equipment_cost || 0,
    item.logistics_cost || 0,
    item.wastage_pct || 0,
    item.wastage_cost || 0,
    item.risk_pct || 0,
    item.risk_cost || 0,
    item.site_overhead_pct || 0,
    item.site_overhead_cost || 0,
    item.total_cost || 0,
    item.profit_pct || 0,
    item.profit_value || 0,
    item.unit_price || 0,
    item.total_price || 0,
  ]);

  // Aggregations
  const totalQty = items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
  const totalTechHours = items.reduce((sum, item) => sum + (Number(item.labor_technician_hours) * Number(item.quantity) || 0), 0);
  const totalEngHours = items.reduce((sum, item) => sum + (Number(item.labor_engineer_hours) * Number(item.quantity) || 0), 0);
  const totalPMHours = items.reduce((sum, item) => sum + (Number(item.labor_pm_hours) * Number(item.quantity) || 0), 0);

  itemsRows.push([
    '', 
    'Aggregated Totals', 
    '',
    '',
    totalQty,
    '',
    '',
    financials.supply_total,
    totalTechHours,
    '',
    '',
    financials.labor_breakdown.technician,
    totalEngHours,
    '',
    '',
    financials.labor_breakdown.engineer,
    totalPMHours,
    '',
    '',
    financials.labor_breakdown.project_manager,
    financials.labor_total,
    financials.subcontract_cost,
    financials.equipment_cost,
    financials.logistics_cost,
    '',
    financials.wastage_value,
    '',
    financials.risk_cost,
    '',
    financials.overhead_value,
    financials.direct_total + financials.indirect_total,
    '',
    financials.profit_value,
    '',
    financials.total_selling_price
  ]);

  const itemsData = [itemsHeader, ...itemsRows];
  const itemsSheet = XLSX.utils.aoa_to_sheet(itemsData);
  itemsSheet['!cols'] = [
    { wch: 5 },   // #
    { wch: 15 },  // Item Code
    { wch: 35 },  // Description
    { wch: 8 },   // Unit
    { wch: 10 },  // Quantity
    { wch: 22 },  // Unit Supply Cost
    { wch: 22 },  // Net Purchase Cost
    { wch: 22 },  // Total Supply Cost
    { wch: 16 },  // Tech Hours
    { wch: 12 },  // Tech Count
    { wch: 18 },  // Tech Rate
    { wch: 18 },  // Tech Cost
    { wch: 16 },  // Eng Hours
    { wch: 12 },  // Eng Count
    { wch: 18 },  // Eng Rate
    { wch: 18 },  // Eng Cost
    { wch: 16 },  // PM Hours
    { wch: 12 },  // PM Count
    { wch: 18 },  // PM Rate
    { wch: 18 },  // PM Cost
    { wch: 22 },  // Gross Labour
    { wch: 22 },  // Subcontract Cost
    { wch: 22 },  // Equipment Cost
    { wch: 22 },  // Logistics Cost
    { wch: 12 },  // Wastage %
    { wch: 18 },  // Wastage Cost
    { wch: 12 },  // Risk %
    { wch: 18 },  // Risk Cost
    { wch: 16 },  // Site Overhead %
    { wch: 22 },  // Site Overhead Cost
    { wch: 22 },  // Total Cost
    { wch: 12 },  // Profit %
    { wch: 18 },  // Profit Value
    { wch: 22 },  // Unit Selling
    { wch: 24 },  // Total Selling
  ];
  XLSX.utils.book_append_sheet(wb, itemsSheet, 'BOQ Costing Sheet');

  // ---- Sheet 3: Financial Summary Table ----
  const finData = [
    ['FINANCIAL BREAKDOWN SUMMARY'],
    [],
    ['Cost Dimensions', 'Value (AED)'],
    ['Material Supply Cost Total', financials.supply_total],
    ['Gross Labour Cost Total', financials.labor_total],
    ['  ├ Technician Labour Cost', financials.labor_breakdown.technician],
    ['  ├ Engineer Labour Cost', financials.labor_breakdown.engineer],
    ['  ├ Project Manager Labour Cost', financials.labor_breakdown.project_manager],
    ['Subcontractor Cost Total', financials.subcontract_cost],
    ['Equipment Cost Total', financials.equipment_cost],
    ['Logistics Cost Total', financials.logistics_cost],
    ['Wastage Cost Total', financials.wastage_value],
    ['Risk Cost Total', financials.risk_cost],
    ['Site Overhead Cost Total', financials.overhead_value],
    [],
    ['DIRECT ESTIMATED TOTAL COST (Material + Labour + Subcontract + Equipment + Logistics + Wastage)', financials.direct_total],
    ['INDIRECT ESTIMATED TOTAL COST (Risk + Site Overhead)', financials.indirect_total],
    ['TOTAL ESTIMATED DIRECT/INDIRECT COST', financials.direct_total + financials.indirect_total],
    ['Profit Cost Total', financials.profit_value],
    [],
    ['GRAND ITEM SELLING PRICE CEILING', financials.total_selling_price],
    ['AVERAGE UNIT SELLING PRICE', financials.unit_selling_price],
  ];

  const finSheet = XLSX.utils.aoa_to_sheet(finData);
  finSheet['!cols'] = [{ wch: 55 }, { wch: 22 }];
  XLSX.utils.book_append_sheet(wb, finSheet, 'Executive Summary');

  // Download
  const fileName = `BOQ_${tender.project_name.replace(/\s+/g, '_')}_v${boq.version}.xlsx`;
  XLSX.writeFile(wb, fileName);
}
