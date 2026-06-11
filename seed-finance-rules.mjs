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

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function seedRules() {
  try {
    console.log('Seeding Finance Event Types...');
    const eventTypes = [
      { event_type: 'invoice.submitted', module: 'FINANCE', description: 'Client invoice draft submitted for approval', default_severity: 'ACTION_REQUIRED' },
      { event_type: 'invoice.approved', module: 'FINANCE', description: 'Client invoice approved and ready to send', default_severity: 'INFO' },
      { event_type: 'invoice.sent', module: 'FINANCE', description: 'Client invoice officially sent to client', default_severity: 'INFO' },
      { event_type: 'invoice.payment_received', module: 'FINANCE', description: 'Payment received and allocated to client invoice', default_severity: 'INFO' },
      { event_type: 'invoice.overdue', module: 'FINANCE', description: 'Client invoice has passed its due date without payment', default_severity: 'CRITICAL' },
      { event_type: 'invoice.written_off', module: 'FINANCE', description: 'Client invoice written off by management', 'default_severity': 'CRITICAL' },
      { event_type: 'supplier_invoice.match_exception', module: 'FINANCE', description: 'Supplier invoice 3-way match failed (qty/price exception)', default_severity: 'ACTION_REQUIRED' },
      { event_type: 'project.margin_erosion', module: 'FINANCE', description: 'Project actual/committed cost exceeds BOQ budget margin threshold', default_severity: 'CRITICAL' }
    ];

    for (const et of eventTypes) {
      const { error } = await supabase.from('event_types').upsert(et, { onConflict: 'event_type' });
      if (error) {
        console.error(`Failed to upsert event type ${et.event_type}:`, error.message);
      } else {
        console.log(`Synced event type: ${et.event_type}`);
      }
    }

    console.log('\nCleaning existing Finance Notification Rules...');
    const eventTypeNames = eventTypes.map(et => et.event_type);
    const { error: deleteErr } = await supabase
      .from('notification_rules')
      .delete()
      .in('event_type', eventTypeNames);
      
    if (deleteErr) {
      console.error('Failed to clear existing rules:', deleteErr.message);
    } else {
      console.log('Cleared existing notification rules.');
    }

    console.log('\nInserting Finance Notification Rules...');
    const rules = [
      {
        event_type: 'invoice.submitted',
        recipient_strategy: 'ROLE',
        recipient_value: 'manager',
        channels: ['IN_APP', 'EMAIL'],
        severity: 'ACTION_REQUIRED',
        title_template: 'Invoice {{payload.invoice_number}} Submitted for Approval',
        body_template: 'Invoice for client {{payload.client_name}} ({{payload.net_due}} AED) is pending review.',
        link_template: '/finance/ar/{{entity_id}}',
        is_digest_eligible: false,
        escalation_hours: 48,
        escalation_to_role: 'admin'
      },
      {
        event_type: 'invoice.approved',
        recipient_strategy: 'PREPARED_BY',
        recipient_value: 'prepared_by',
        channels: ['IN_APP'],
        severity: 'INFO',
        title_template: 'Invoice {{payload.invoice_number}} Approved',
        body_template: 'Your invoice for client {{payload.client_name}} has been approved by {{payload.approved_by_name}}.',
        link_template: '/finance/ar/{{entity_id}}',
        is_digest_eligible: true
      },
      {
        event_type: 'invoice.sent',
        recipient_strategy: 'ROLE',
        recipient_value: 'account',
        channels: ['IN_APP'],
        severity: 'INFO',
        title_template: 'Invoice {{payload.invoice_number}} Sent',
        body_template: 'Invoice has been marked as SENT to client {{payload.client_name}}.',
        link_template: '/finance/ar/{{entity_id}}',
        is_digest_eligible: true
      },
      {
        event_type: 'invoice.payment_received',
        recipient_strategy: 'ROLE',
        recipient_value: 'account',
        channels: ['IN_APP'],
        severity: 'INFO',
        title_template: 'Payment Received: {{payload.payment_number}}',
        body_template: 'Payment of {{payload.amount}} AED received and allocated to {{payload.invoice_number}}.',
        link_template: '/finance/ar/{{entity_id}}',
        is_digest_eligible: true
      },
      {
        event_type: 'invoice.overdue',
        recipient_strategy: 'ROLE',
        recipient_value: 'account',
        channels: ['IN_APP', 'EMAIL'],
        severity: 'CRITICAL',
        title_template: 'OVERDUE: Invoice {{payload.invoice_number}}',
        body_template: 'Invoice for client {{payload.client_name}} ({{payload.net_due}} AED) was due on {{payload.due_date}} and remains unpaid.',
        link_template: '/finance/ar/{{entity_id}}',
        is_digest_eligible: false,
        escalation_hours: 72,
        escalation_to_role: 'manager'
      },
      {
        event_type: 'invoice.written_off',
        recipient_strategy: 'ROLE',
        recipient_value: 'manager',
        channels: ['IN_APP', 'EMAIL'],
        severity: 'CRITICAL',
        title_template: 'Invoice {{payload.invoice_number}} Written Off',
        body_template: 'Invoice for client {{payload.client_name}} has been written off. Reason: {{payload.write_off_reason}}',
        link_template: '/finance/ar/{{entity_id}}',
        is_digest_eligible: false
      },
      {
        event_type: 'supplier_invoice.match_exception',
        recipient_strategy: 'ROLE',
        recipient_value: 'account',
        channels: ['IN_APP', 'EMAIL'],
        severity: 'ACTION_REQUIRED',
        title_template: '3-Way Match Exception: {{payload.supplier_invoice_number}}',
        body_template: 'Supplier invoice {{payload.supplier_invoice_number}} from {{payload.supplier_name}} failed 3-way match. Exceptions: {{payload.exceptions}}',
        link_template: '/finance/ap/match/{{entity_id}}',
        is_digest_eligible: false,
        escalation_hours: 24,
        escalation_to_role: 'manager'
      },
      {
        event_type: 'project.margin_erosion',
        recipient_strategy: 'PROJECT_ROLE',
        recipient_value: 'project_manager',
        channels: ['IN_APP', 'EMAIL'],
        severity: 'CRITICAL',
        title_template: 'Margin Erosion Alert: Project {{payload.project_number}}',
        body_template: 'Project {{payload.project_name}} margin has eroded. Committed cost + actual cost exceeds 95% of contract value.',
        link_template: '/projects/{{entity_id}}',
        is_digest_eligible: false
      }
    ];

    const { error: insertErr } = await supabase
      .from('notification_rules')
      .insert(rules);
      
    if (insertErr) {
      console.error('Failed to insert rules:', insertErr.message);
    } else {
      console.log('Successfully inserted all finance notification rules.');
    }

    console.log('\nSeeding complete.');
  } catch (err) {
    console.error('Seeding failed:', err);
  }
}

seedRules();
