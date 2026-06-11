import fs from 'fs';
import path from 'path';

// Parse .env.local manually and set env vars
try {
  const envContent = fs.readFileSync('.env.local', 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const parts = trimmed.split('=');
    if (parts.length >= 2) {
      const key = parts[0].trim();
      const val = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
      process.env[key] = val;
    }
  }
} catch (err) {
  console.error('Warning: Failed to load .env.local:', (err as any).message);
}

async function checkTables() {
  const { supabase } = await import('../src/lib/supabase');

  const tables = [
    'amc_contracts',
    'amc_equipment',
    'amc_billing_schedule',
    'ppm_visits',
    'checklist_templates',
    'checklist_template_items',
    'ppm_visit_checklist_results',
    'service_tickets',
    'ticket_events',
    'whatsapp_settings',
    'whatsapp_chats',
    'whatsapp_messages',
    'whatsapp_templates'
  ];

  console.log('--- Checking Phase 5 Database Tables ---');
  for (const table of tables) {
    const { error } = await supabase.from(table).select('*').limit(1);
    if (error) {
      console.log(`❌ ${table}: Error or missing (${error.message})`);
    } else {
      console.log(`✅ ${table}: Exists`);
    }
  }
}

checkTables();
