// One-time, idempotent backfill: create a DRAFT payable in AP for every LPO
// that is already approved/sent/delivered but has no supplier_invoices row
// (i.e. was advanced before the auto-create-on-approval hook existed).
// Mirrors supplierInvoiceService.createExpectedFromPO. Safe to re-run.
//
// Usage: node scripts/backfill-ap-from-lpos.mjs
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

const env = {};
for (const l of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')) {
  const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const ADVANCED = ['APPROVED', 'SENT', 'ACKNOWLEDGED', 'PARTIALLY_DELIVERED', 'DELIVERED', 'CLOSED'];

const { data: pos } = await db.from('purchase_orders')
  .select('id, po_number, status, supplier_id, project_id, subtotal, discount_amount, vat_amount, total, payment_terms_days, proforma_invoice_path, proforma_invoice_name, created_by')
  .in('status', ADVANCED);

const { data: existing } = await db.from('supplier_invoices').select('po_id').not('po_id', 'is', null);
const have = new Set((existing || []).map(s => s.po_id));

let made = 0;
for (const po of pos || []) {
  if (have.has(po.id)) { console.log(`· ${po.po_number}: already in AP, skip`); continue; }
  const today = new Date();
  const due = new Date(today); due.setDate(due.getDate() + (Number(po.payment_terms_days) || 30));
  const taxable = Math.round(((Number(po.subtotal) || 0) - (Number(po.discount_amount) || 0)) * 100) / 100;
  const hasProforma = !!po.proforma_invoice_path;

  const { error } = await db.from('supplier_invoices').insert({
    supplier_id: po.supplier_id,
    supplier_invoice_number: `AWAITING-${po.po_number}`,
    po_id: po.id,
    project_id: po.project_id || null,
    invoice_type: 'PO_MATCHED',
    invoice_date: today.toISOString().slice(0, 10),
    received_date: today.toISOString().slice(0, 10),
    due_date: due.toISOString().slice(0, 10),
    taxable_amount: taxable,
    vat_amount: Number(po.vat_amount) || 0,
    total: Number(po.total) || 0,
    match_status: 'NA',
    status: 'DRAFT',
    cost_bucket: po.project_id ? 'PROJECT' : 'OFFICE',
    proforma_path: po.proforma_invoice_path || null,
    proforma_name: po.proforma_invoice_name || null,
    notes: `Backfill: action to spend from LPO ${po.po_number} (${po.status}).` +
      (hasProforma ? ` Proforma "${po.proforma_invoice_name}" imported.` : '') +
      ' Validate the supplier invoice to register it.',
    created_by: po.created_by,
  });
  if (error) { console.error(`  ✗ ${po.po_number}:`, error.message); continue; }
  made++;
  console.log(`  ✓ ${po.po_number}: DRAFT payable created (${po.total})`);
}
console.log(`\nBackfilled ${made} draft payable(s) into AP.`);
