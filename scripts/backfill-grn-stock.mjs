// One-time, idempotent backfill: post stock for goods already received to a
// store but never influxed (because no store existed / line had no catalogue
// link). Creates a default Main Store if none exists, auto-creates a catalogue
// item for non-catalogue lines, then posts a GRN_RECEIPT (the balance trigger
// fills stock_balances). Safe to re-run: it skips lines already posted.
//
// Usage: node scripts/backfill-grn-stock.mjs
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

const env = {};
for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const log = (...a) => console.log(...a);

// 1. Ensure a default store
let { data: loc } = await db.from('stock_locations')
  .select('id, name, type').eq('is_active', true).in('type', ['MAIN_STORE', 'SUB_STORE'])
  .order('type', { ascending: true }).limit(1).maybeSingle();
if (!loc) {
  const { data: created, error } = await db.from('stock_locations')
    .insert({ location_code: 'MAIN-01', name: 'Main Store', type: 'MAIN_STORE', is_active: true })
    .select('id, name, type').single();
  if (error) { console.error('Could not create store:', error.message); process.exit(1); }
  loc = created;
  log('Created default store:', loc.name);
} else {
  log('Using store:', loc.name);
}

// 2. Store-routed GRNs (location STORE or flagged)
const { data: grns } = await db.from('grns')
  .select('id, grn_number, location, is_stock_item, stock_location_id, project_id, received_by')
  .or('location.eq.STORE,is_stock_item.eq.true');
if (!grns || grns.length === 0) { log('No store-routed GRNs. Nothing to backfill.'); process.exit(0); }

// already-posted GRN ids (idempotency)
const { data: posted } = await db.from('stock_transactions')
  .select('source_id').eq('type', 'GRN_RECEIPT').eq('source_type', 'GRN');
const postedSet = new Set((posted || []).map(p => p.source_id));

let made = 0;
for (const g of grns) {
  if (postedSet.has(g.id)) { log(`· ${g.grn_number}: already posted, skip`); continue; }
  const dest = g.stock_location_id || loc.id;
  const { data: items } = await db.from('grn_items').select('po_item_id, qty_received').eq('grn_id', g.id);
  for (const it of (items || [])) {
    const qty = Number(it.qty_received) || 0;
    if (qty <= 0) continue;
    const { data: poItem } = await db.from('po_items')
      .select('id, description, unit, unit_price, item_code, pricing_item_id').eq('id', it.po_item_id).maybeSingle();
    if (!poItem) continue;

    // resolve / create catalogue item
    let pricingId = poItem.pricing_item_id;
    if (!pricingId && poItem.item_code) {
      const { data: byCode } = await db.from('pricing_items').select('id').eq('item_code', poItem.item_code).maybeSingle();
      pricingId = byCode?.id || null;
    }
    if (!pricingId) {
      const code = poItem.item_code || ('GRN-' + Math.random().toString(36).slice(2, 10).toUpperCase());
      const { data: pi, error: pe } = await db.from('pricing_items').insert({
        item_code: code, system: 'PROCUREMENT', category: 'AUTO',
        description: poItem.description, unit: poItem.unit || 'EA',
        material_cost: Number(poItem.unit_price) || 0, tags: ['auto-grn'],
        notes: 'Auto-created from goods receipt',
      }).select('id').single();
      if (pe) { console.error('  pricing_items insert failed:', pe.message); continue; }
      pricingId = pi.id;
      await db.from('po_items').update({ pricing_item_id: pricingId }).eq('id', poItem.id);
    }

    // find / create stock item
    let { data: si } = await db.from('stock_items').select('id').eq('pricing_item_id', pricingId).maybeSingle();
    if (!si) {
      const { data: created, error: se } = await db.from('stock_items')
        .insert({ pricing_item_id: pricingId, is_serialized: false }).select('id').single();
      if (se) { console.error('  stock_items insert failed:', se.message); continue; }
      si = created;
    }

    // post receipt (transaction_number set by trigger; balance trigger updates stock)
    const unit = Number(poItem.unit_price) || 0;
    const { error: te } = await db.from('stock_transactions').insert({
      type: 'GRN_RECEIPT', stock_item_id: si.id, location_id: dest, qty, unit_cost: unit,
      total_value: Math.round(qty * unit * 10000) / 10000, source_type: 'GRN', source_id: g.id,
      project_id: g.project_id, performed_by: g.received_by, reason: 'Backfill: auto-route to store',
    });
    if (te) { console.error('  stock_transaction insert failed:', te.message); continue; }
    made++;
    log(`  ✓ ${g.grn_number}: +${qty} ${poItem.description}`);
  }
}
log(`\nBackfilled ${made} line(s).`);

// 3. Show resulting balances
const { data: bals } = await db.from('stock_balances')
  .select('stock_item_id, qty_on_hand, avg_unit_cost');
log('Stock balances now:', JSON.stringify(bals, null, 2));
