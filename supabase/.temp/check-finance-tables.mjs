import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

let supabaseUrl = '';
let supabaseServiceKey = '';

try {
  const envContent = fs.readFileSync('.env.local', 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const parts = trimmed.split('=');
    if (parts.length >= 2) {
      const key = parts[0].trim();
      const val = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
      if (key === 'NEXT_PUBLIC_SUPABASE_URL') {
        supabaseUrl = val;
      } else if (key === 'SUPABASE_SERVICE_ROLE_KEY') {
        supabaseServiceKey = val;
      }
    }
  }
} catch (err) {
  console.error('Failed to read .env.local:', err.message);
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false }
});

async function checkTables() {
  try {
    const { error: invErr } = await supabase.from('client_invoices').select('id').limit(1);
    if (invErr) {
      console.log('client_invoices error:', invErr.message);
    } else {
      console.log('client_invoices exists!');
    }

    const { data: seedData, error: seedErr } = await supabase.from('event_types').select('event_type').eq('event_type', 'invoice.submitted');
    if (seedErr) {
      console.log('event_types error:', seedErr.message);
    } else {
      console.log('event_types seed check:', seedData);
    }
  } catch (err) {
    console.error(err);
  }
}

checkTables();
