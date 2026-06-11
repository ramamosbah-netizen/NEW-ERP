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
    console.log('Seeding AMC Event Types...');
    const eventTypes = [
      { event_type: 'amc.activated', module: 'FINANCE', description: 'AMC contract officially activated', default_severity: 'INFO' },
      { event_type: 'amc.renewal_due', module: 'FINANCE', description: 'AMC contract is approaching its expiration date', default_severity: 'ACTION_REQUIRED' },
      { event_type: 'amc.suspension_warning', module: 'FINANCE', description: 'AMC contract suspension warning due to non-payment', default_severity: 'CRITICAL' },
      { event_type: 'amc.terminated', module: 'FINANCE', description: 'AMC contract terminated', default_severity: 'CRITICAL' },
      { event_type: 'amc.billing_due', module: 'FINANCE', description: 'AMC billing installment invoice generation trigger', default_severity: 'INFO' },
      { event_type: 'ppm.visit_scheduled', module: 'OPERATIONS', description: 'PPM maintenance visit scheduled', default_severity: 'INFO' },
      { event_type: 'ppm.visit_reminder', module: 'OPERATIONS', description: 'Upcoming PPM maintenance visit reminder (T-1 Day)', default_severity: 'INFO' },
      { event_type: 'ppm.completed', module: 'OPERATIONS', description: 'PPM maintenance visit successfully completed by technician', default_severity: 'INFO' },
      { event_type: 'ppm.defects_found', module: 'OPERATIONS', description: 'Defect items logged during PPM visit', default_severity: 'ACTION_REQUIRED' },
      { event_type: 'ppm.visit_missed', module: 'OPERATIONS', description: 'Scheduled PPM visit date passed without execution', default_severity: 'CRITICAL' },
      { event_type: 'ticket.created', module: 'OPERATIONS', description: 'New call-out service ticket logged', default_severity: 'INFO' },
      { event_type: 'ticket.assigned', module: 'OPERATIONS', description: 'Service ticket assigned to technician', default_severity: 'INFO' },
      { event_type: 'ticket.technician_dispatched', module: 'OPERATIONS', description: 'Technician dispatched to client site', default_severity: 'INFO' },
      { event_type: 'ticket.sla_warning', module: 'OPERATIONS', description: 'Service ticket is approaching SLA response/resolution limit', default_severity: 'ACTION_REQUIRED' },
      { event_type: 'ticket.sla_breached', module: 'OPERATIONS', description: 'Service ticket has breached its SLA response/resolution limit', default_severity: 'CRITICAL' },
      { event_type: 'ticket.resolved', module: 'OPERATIONS', description: 'Service ticket resolved by technician', default_severity: 'INFO' },
      { event_type: 'ticket.closed', module: 'OPERATIONS', description: 'Service ticket reviewed and officially closed', default_severity: 'INFO' }
    ];

    for (const et of eventTypes) {
      const { error } = await supabase.from('event_types').upsert(et, { onConflict: 'event_type' });
      if (error) {
        console.error(`Failed to upsert event type ${et.event_type}:`, error.message);
      } else {
        console.log(`Synced event type: ${et.event_type}`);
      }
    }

    console.log('\nCleaning existing AMC Notification Rules...');
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

    console.log('\nInserting AMC Notification Rules...');
    const rules = [
      {
        event_type: 'amc.activated',
        recipient_strategy: 'ROLE',
        recipient_value: 'coordinator',
        channels: ['IN_APP'],
        severity: 'INFO',
        title_template: 'AMC Contract Activated: {{payload.contract_number}}',
        body_template: 'Contract for client {{payload.client_name}} covers {{payload.visits_per_year}} visits/yr.',
        link_template: '/amc/{{entity_id}}',
        is_digest_eligible: true
      },
      {
        event_type: 'amc.renewal_due',
        recipient_strategy: 'ROLE',
        recipient_value: 'coordinator',
        channels: ['IN_APP', 'EMAIL'],
        severity: 'ACTION_REQUIRED',
        title_template: 'AMC Renewal Due: {{payload.contract_number}}',
        body_template: 'AMC contract for client {{payload.client_name}} expires on {{payload.end_date}}. SIRA link: {{payload.sira_linked}}.',
        link_template: '/amc/renewal',
        is_digest_eligible: false,
        escalation_hours: 72,
        escalation_to_role: 'manager'
      },
      {
        event_type: 'amc.suspension_warning',
        recipient_strategy: 'ROLE',
        recipient_value: 'account',
        channels: ['IN_APP', 'EMAIL'],
        severity: 'CRITICAL',
        title_template: 'SUSPENSION WARNING: {{payload.contract_number}}',
        body_template: 'Contract for client {{payload.client_name}} is at risk of suspension due to unpaid invoices.',
        link_template: '/amc/{{entity_id}}',
        is_digest_eligible: false
      },
      {
        event_type: 'amc.terminated',
        recipient_strategy: 'ROLE',
        recipient_value: 'manager',
        channels: ['IN_APP', 'EMAIL'],
        severity: 'CRITICAL',
        title_template: 'AMC Contract Terminated: {{payload.contract_number}}',
        body_template: 'AMC for {{payload.client_name}} terminated. Reason: {{payload.termination_reason}}',
        link_template: '/amc/{{entity_id}}',
        is_digest_eligible: false
      },
      {
        event_type: 'amc.billing_due',
        recipient_strategy: 'ROLE',
        recipient_value: 'account',
        channels: ['IN_APP'],
        severity: 'INFO',
        title_template: 'AMC Billing Due: {{payload.contract_number}}',
        body_template: 'Draft standalone client invoice generated for sequence {{payload.sequence}}.',
        link_template: '/finance/ar',
        is_digest_eligible: true
      },
      {
        event_type: 'ppm.visit_scheduled',
        recipient_strategy: 'PROJECT_ROLE',
        recipient_value: 'project_manager',
        channels: ['IN_APP'],
        severity: 'INFO',
        title_template: 'PPM Visit Scheduled: {{payload.visit_number}}',
        body_template: 'Visit scheduled for {{payload.scheduled_date}} by technician {{payload.tech_name}}.',
        link_template: '/ppm/calendar',
        is_digest_eligible: true
      },
      {
        event_type: 'ppm.visit_reminder',
        recipient_strategy: 'ROLE',
        recipient_value: 'coordinator',
        channels: ['IN_APP'],
        severity: 'INFO',
        title_template: 'PPM Visit Reminder: {{payload.visit_number}}',
        body_template: 'Visit tomorrow at site {{payload.site_name}}.',
        link_template: '/ppm/calendar',
        is_digest_eligible: true
      },
      {
        event_type: 'ppm.completed',
        recipient_strategy: 'ROLE',
        recipient_value: 'coordinator',
        channels: ['IN_APP'],
        severity: 'INFO',
        title_template: 'PPM Visit Completed: {{payload.visit_number}}',
        body_template: 'Visit at {{payload.site_name}} finished. Report document filed.',
        link_template: '/amc/{{payload.contract_id}}',
        is_digest_eligible: true
      },
      {
        event_type: 'ppm.defects_found',
        recipient_strategy: 'ROLE',
        recipient_value: 'coordinator',
        channels: ['IN_APP'],
        severity: 'ACTION_REQUIRED',
        title_template: 'PPM Defects Found: {{payload.visit_number}}',
        body_template: 'Defect checks failed during PPM maintenance. Service ticket created.',
        link_template: '/service',
        is_digest_eligible: false,
        escalation_hours: 24,
        escalation_to_role: 'manager'
      },
      {
        event_type: 'ppm.visit_missed',
        recipient_strategy: 'ROLE',
        recipient_value: 'coordinator',
        channels: ['IN_APP', 'EMAIL'],
        severity: 'CRITICAL',
        title_template: 'MISSED VISIT: {{payload.visit_number}}',
        body_template: 'Scheduled date {{payload.scheduled_date}} passed without execution.',
        link_template: '/ppm/calendar',
        is_digest_eligible: false
      },
      {
        event_type: 'ticket.created',
        recipient_strategy: 'ROLE',
        recipient_value: 'coordinator',
        channels: ['IN_APP'],
        severity: 'INFO',
        title_template: 'Service Ticket Logged: {{payload.ticket_number}}',
        body_template: 'Ticket: {{payload.title}} (SLA Tier: {{payload.sla_tier}}).',
        link_template: '/service/{{entity_id}}',
        is_digest_eligible: true
      },
      {
        event_type: 'ticket.assigned',
        recipient_strategy: 'PREPARED_BY', // will dynamically map to assigned tech user_id
        recipient_value: 'prepared_by',
        channels: ['IN_APP'],
        severity: 'INFO',
        title_template: 'Ticket Assigned: {{payload.ticket_number}}',
        body_template: 'Ticket {{payload.ticket_number}} has been assigned to you.',
        link_template: '/service/{{entity_id}}',
        is_digest_eligible: false
      },
      {
        event_type: 'ticket.technician_dispatched',
        recipient_strategy: 'ROLE',
        recipient_value: 'coordinator',
        channels: ['IN_APP'],
        severity: 'INFO',
        title_template: 'Tech Dispatched: {{payload.ticket_number}}',
        body_template: 'Technician has dispatched to site {{payload.site_address}}.',
        link_template: '/service/{{entity_id}}',
        is_digest_eligible: true
      },
      {
        event_type: 'ticket.sla_warning',
        recipient_strategy: 'ROLE',
        recipient_value: 'coordinator',
        channels: ['IN_APP'],
        severity: 'ACTION_REQUIRED',
        title_template: 'SLA Warning: Ticket {{payload.ticket_number}}',
        body_template: 'Ticket {{payload.ticket_number}} is approaching SLA limit (75% elapsed).',
        link_template: '/service/{{entity_id}}',
        is_digest_eligible: false
      },
      {
        event_type: 'ticket.sla_breached',
        recipient_strategy: 'ROLE',
        recipient_value: 'manager',
        channels: ['IN_APP', 'EMAIL'],
        severity: 'CRITICAL',
        title_template: 'SLA BREACHED: Ticket {{payload.ticket_number}}',
        body_template: 'Ticket {{payload.ticket_number}} has breached response/resolution SLA times.',
        link_template: '/service/{{entity_id}}',
        is_digest_eligible: false,
        escalation_hours: 12,
        escalation_to_role: 'admin'
      },
      {
        event_type: 'ticket.resolved',
        recipient_strategy: 'ROLE',
        recipient_value: 'coordinator',
        channels: ['IN_APP'],
        severity: 'INFO',
        title_template: 'Ticket Resolved: {{payload.ticket_number}}',
        body_template: 'Ticket {{payload.ticket_number}} resolved by technician.',
        link_template: '/service/{{entity_id}}',
        is_digest_eligible: true
      },
      {
        event_type: 'ticket.closed',
        recipient_strategy: 'ROLE',
        recipient_value: 'account',
        channels: ['IN_APP'],
        severity: 'INFO',
        title_template: 'Ticket Closed: {{payload.ticket_number}}',
        body_template: 'Ticket closed. Chargeable invoice generated: {{payload.invoice_number}}.',
        link_template: '/finance/ar',
        is_digest_eligible: true
      }
    ];

    const { error: insertErr } = await supabase
      .from('notification_rules')
      .insert(rules);
      
    if (insertErr) {
      console.error('Failed to insert rules:', insertErr.message);
    } else {
      console.log('Successfully inserted all AMC/PPM/Ticket notification rules.');
    }

    console.log('\nSeeding complete.');
  } catch (err) {
    console.error('Seeding failed:', err);
  }
}

seedRules();
