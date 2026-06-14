// Verifies the admin platform engine migration has been applied.
// Usage: node scripts/verify-platform.mjs
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split('\n')
    .filter(l => l.includes('='))
    .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()])
);

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const TABLES = [
  'workflow_definitions', 'workflow_statuses', 'workflow_transitions', 'workflow_instances',
  'business_rules', 'numbering_rules', 'form_definitions', 'document_templates',
];

let ok = 0, missing = [];

for (const table of TABLES) {
  const { error } = await supabase.from(table).select('*', { count: 'exact', head: true });
  if (error) {
    missing.push(table);
    console.log(`  MISSING  ${table}  (${error.message})`);
  } else {
    ok++;
    console.log(`  OK       ${table}`);
  }
}

// Check the RPC
const { data: num, error: rpcErr } = await supabase.rpc('generate_document_number', { p_module_key: '__VERIFY__' });
if (rpcErr) {
  console.log(`  MISSING  generate_document_number RPC (${rpcErr.message})`);
  missing.push('generate_document_number()');
} else {
  console.log(`  OK       generate_document_number RPC → ${num}`);
  ok++;
}

console.log('---');
if (missing.length === 0) {
  console.log(`All ${ok} platform objects present. Admin Center is fully operational.`);
} else {
  console.log(`${missing.length} object(s) missing. Apply the migration:`);
  console.log('  1. Open the Supabase dashboard → SQL Editor');
  console.log('  2. Paste the contents of supabase/migrations/20260612090000_admin_platform_engine.sql');
  console.log('  3. Run, then re-run this script.');
  process.exit(1);
}
