// Read-only diagnostic: why aren't GRN goods showing in the store?
// Usage: node scripts/diag-grn-stock.mjs
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

// load .env.local
const env = {};
for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
const db = createClient(url, key, { auth: { persistSession: false } });

const p = (label, v) => console.log(`\n=== ${label} ===\n` + JSON.stringify(v, null, 2));

// 1. Active stock locations (the RPC needs at least one MAIN_STORE/SUB_STORE)
const { data: locs } = await db.from('stock_locations')
  .select('id, name, location_code, type, is_active').order('created_at');
p('STOCK LOCATIONS', locs);

// 2. Latest 3 GRNs and how they were routed
const { data: grns } = await db.from('grns')
  .select('id, grn_number, location, is_stock_item, stock_location_id, received_at')
  .order('received_at', { ascending: false }).limit(3);
p('LATEST GRNs (location / is_stock_item / stock_location_id)', grns);

// 3. For the latest GRN, the items + whether they map to a catalogue item
if (grns && grns.length) {
  const g = grns[0];
  const { data: items } = await db.from('grn_items')
    .select('id, po_item_id, qty_received').eq('grn_id', g.id);
  const poItemIds = (items || []).map(i => i.po_item_id);
  const { data: poItems } = poItemIds.length
    ? await db.from('po_items').select('id, description, pricing_item_id, unit_price').in('id', poItemIds)
    : { data: [] };
  const byId = new Map((poItems || []).map(x => [x.id, x]));
  p('LATEST GRN ITEMS (pricing_item_id null = skipped by RPC)', (items || []).map(i => ({
    qty_received: i.qty_received,
    description: byId.get(i.po_item_id)?.description,
    pricing_item_id: byId.get(i.po_item_id)?.pricing_item_id ?? 'NULL (will be skipped)',
    unit_price: byId.get(i.po_item_id)?.unit_price,
  })));
}

// 4. Were any GRN_RECEIPT stock transactions ever posted?
const { data: txns } = await db.from('stock_transactions')
  .select('id, type, qty, unit_cost, total_value, location_id, source_id, created_at')
  .eq('type', 'GRN_RECEIPT').order('created_at', { ascending: false }).limit(5);
p('RECENT GRN_RECEIPT STOCK TRANSACTIONS (empty = RPC never posted stock)', txns);

// 5. Current stock balances
const { data: bals } = await db.from('stock_balances')
  .select('stock_item_id, location_id, qty_on_hand, avg_unit_cost').limit(10);
p('STOCK BALANCES (sample)', bals);

// 6. Registered stock items
const { count: siCount } = await db.from('stock_items').select('id', { count: 'exact', head: true });
p('STOCK_ITEMS COUNT', siCount);

console.log('\nDone.');
