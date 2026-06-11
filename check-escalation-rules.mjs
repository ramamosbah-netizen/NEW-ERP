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

async function main() {
  const { data: lastEvents } = await supabase
    .from('system_events')
    .select('*')
    .eq('event_type', 'approval.escalation')
    .order('created_at', { ascending: false })
    .limit(3);
  console.log('Last approval.escalation events:', lastEvents);

  if (lastEvents && lastEvents.length > 0) {
    const eventId = lastEvents[0].id;
    const { data: notifs } = await supabase
      .from('notifications')
      .select('*')
      .eq('event_id', eventId);
    console.log(`Generated notifications for event ${eventId}:`, notifs);
  }
}

main();
