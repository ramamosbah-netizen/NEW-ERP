// ============================================================
// JEET ERP — Stock & Goods-Movement Excel exports
// Client-side .xlsx via SheetJS, matching the BOQ export style.
// ============================================================

import * as XLSX from 'xlsx';
import type { StockRow, MovementRow } from '@/services/warehouseService';

const TYPE_LABEL: Record<string, string> = {
  GRN_RECEIPT: 'Receipt', ISSUE_TO_PROJECT: 'Issue → Project', ISSUE_TO_TICKET: 'Issue → Ticket',
  RETURN_FROM_SITE: 'Return from site', RETURN_TO_SUPPLIER: 'Return to supplier',
  TRANSFER_OUT: 'Transfer out', TRANSFER_IN: 'Transfer in', ADJUSTMENT_IN: 'Adjustment +',
  ADJUSTMENT_OUT: 'Adjustment −', WRITE_OFF: 'Write-off / damaged',
};

const today = () => new Date().toISOString().slice(0, 10);

/** Stock-on-hand export, optionally scoped to one location. */
export function exportStockExcel(rows: StockRow[], meta: { locationName?: string }) {
  const wb = XLSX.utils.book_new();

  const header = [
    ['JEET INTECH L.L.C — Stock on Hand'],
    [`Location: ${meta.locationName || 'All locations'}`, '', `Generated: ${new Date().toLocaleString('en-AE')}`],
    [],
    ['Category', 'System', 'Item Code', 'Description', 'Unit', 'On Hand', 'Available', 'Reserved', 'Avg Cost (AED)', 'Value (AED)', 'Reorder Level', 'Status'],
  ];
  const body = rows.map(r => [
    r.category, r.system, r.item_code, r.description, r.unit,
    r.qty_on_hand, r.qty_available, r.qty_reserved, r.avg_unit_cost, r.stock_value,
    r.reorder_level ?? '', r.risk,
  ]);
  const totalValue = rows.reduce((s, r) => s + r.stock_value, 0);
  body.push([]);
  body.push(['', '', '', '', '', '', '', '', 'TOTAL', Math.round(totalValue * 100) / 100, '', '']);

  const ws = XLSX.utils.aoa_to_sheet([...header, ...body]);
  ws['!cols'] = [{ wch: 14 }, { wch: 16 }, { wch: 16 }, { wch: 40 }, { wch: 8 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 10 }];
  XLSX.utils.book_append_sheet(wb, ws, 'Stock');
  const loc = (meta.locationName || 'all').replace(/[^a-z0-9]+/gi, '_').slice(0, 20);
  XLSX.writeFile(wb, `stock_${loc}_${today()}.xlsx`);
}

/** Goods-movement log export with from/to/received-by and receipt number. */
export function exportMovementsExcel(rows: MovementRow[], meta: { period?: string }) {
  const wb = XLSX.utils.book_new();

  const header = [
    ['JEET INTECH L.L.C — Goods Movement Log'],
    [`Period: ${meta.period || 'All time'}`, '', `Generated: ${new Date().toLocaleString('en-AE')}`],
    [],
    ['Date', 'Receipt / Txn No', 'Type', 'Item Code', 'Description', 'Qty', 'Unit Cost (AED)', 'Value (AED)', 'From', 'To', 'Received By', 'Issued By', 'Project', 'Reason'],
  ];
  const body = rows.map(r => [
    new Date(r.created_at).toLocaleString('en-AE'),
    r.transaction_number,
    TYPE_LABEL[r.type] || r.type,
    r.item_code, r.description,
    r.qty, r.unit_cost, r.total_value,
    r.from_name, r.to_name,
    r.received_by || '', r.issued_by || '',
    r.project_number || '', r.reason || '',
  ]);

  const ws = XLSX.utils.aoa_to_sheet([...header, ...body]);
  ws['!cols'] = [{ wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 16 }, { wch: 36 }, { wch: 8 }, { wch: 12 }, { wch: 12 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 14 }, { wch: 24 }];
  XLSX.utils.book_append_sheet(wb, ws, 'Movements');
  XLSX.writeFile(wb, `goods_movements_${(meta.period || 'all').toLowerCase()}_${today()}.xlsx`);
}
