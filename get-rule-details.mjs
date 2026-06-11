import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// Parse .env.local manually
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
  auth: {
    persistSession: false
  }
});

async function getRuleDetails() {
  try {
    const { data: tr } = await supabase
      .from('task_rules')
      .select('*')
      .eq('event_type', 'quotation.submitted');
      
    console.log('Task Rules for quotation.submitted:');
    console.log(JSON.stringify(tr, null, 2));

    const { data: nr } = await supabase
      .from('notification_rules')
      .select('*')
      .eq('event_type', 'quotation.submitted');

    console.log('\nNotification Rules for quotation.submitted:');
    console.log(JSON.stringify(nr, null, 2));

  } catch (err) {
    console.error(err);
  }
}

getRuleDetails();
