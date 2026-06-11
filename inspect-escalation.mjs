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
  auth: {
    persistSession: false
  }
});

async function main() {
  try {
    const eventId = '2e097205-ef9f-4e27-ad4e-4959be9f46f0';
    console.log(`Inspecting event ID: ${eventId}`);

    const { data: event, error: eventErr } = await supabase
      .from('system_events')
      .select('*')
      .eq('id', eventId)
      .single();

    if (eventErr) {
      console.error('Error fetching event:', eventErr);
      return;
    }
    console.log('Event status before invoke:', event.processed_at);

    console.log('Invoking process-event via client library...');
    const { data: invRes, error: invErr } = await supabase.functions.invoke('process-event', {
      body: { event_id: eventId }
    });
    console.log('Local invocation result:', invRes);
    if (invErr) {
      console.error('Local invocation error:', invErr);
    }

    // Check event status again
    const { data: eventAfter } = await supabase
      .from('system_events')
      .select('*')
      .eq('id', eventId)
      .single();
    console.log('Event status after invoke:', eventAfter.processed_at, 'Error:', eventAfter.processing_error);

    const { data: notifs } = await supabase
      .from('notifications')
      .select('*')
      .eq('event_id', eventId);
    console.log('Generated Notifications:', notifs);
  } catch (err) {
    console.error('Exception caught in main:', err);
  }
}

main();
