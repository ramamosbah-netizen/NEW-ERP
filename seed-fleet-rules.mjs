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
    console.log('Seeding Fleet Management Event Types...');
    const eventTypes = [
      { event_type: 'fleet.registration_expiring', module: 'OPERATIONS', description: 'Vehicle Mulkiya registration approaching expiry (60/30/15/7 days)', default_severity: 'ACTION_REQUIRED' },
      { event_type: 'fleet.insurance_expiring', module: 'OPERATIONS', description: 'Vehicle insurance policy approaching expiry (60/30/15/7 days)', default_severity: 'ACTION_REQUIRED' },
      { event_type: 'fleet.service_due', module: 'OPERATIONS', description: 'Vehicle maintenance service due soon by date or odometer mileage', default_severity: 'ACTION_REQUIRED' },
      { event_type: 'fleet.registration_expired_critical', module: 'OPERATIONS', description: 'CRITICAL: Active vehicle driving with expired Mulkiya registration', default_severity: 'CRITICAL' },
      { event_type: 'fleet.insurance_expired_critical', module: 'OPERATIONS', description: 'CRITICAL: Active vehicle driving with expired insurance policy', default_severity: 'CRITICAL' },
      { event_type: 'fleet.driver_points_high', module: 'OPERATIONS', description: 'Driver has accumulated high license black points (thresholds: 12/18/22)', default_severity: 'ACTION_REQUIRED' },
      { event_type: 'fleet.fuel_anomaly', module: 'OPERATIONS', description: 'Fuel log efficiency deviates >30% from rolling average', default_severity: 'INFO' }
    ];

    for (const et of eventTypes) {
      const { error } = await supabase.from('event_types').upsert(et, { onConflict: 'event_type' });
      if (error) {
        console.error(`Failed to upsert event type ${et.event_type}:`, error.message);
      } else {
        console.log(`Synced event type: ${et.event_type}`);
      }
    }

    console.log('\nCleaning existing Fleet Notification Rules...');
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

    console.log('\nInserting Fleet Notification Rules...');
    const rules = [
      {
        event_type: 'fleet.registration_expiring',
        recipient_strategy: 'ROLE',
        recipient_value: 'fleet_coordinator',
        channels: ['IN_APP', 'EMAIL'],
        severity: 'ACTION_REQUIRED',
        title_template: 'Vehicle Registration Expiring: {{payload.plate_number}}',
        body_template: 'Vehicle {{payload.vehicle_code}} ({{payload.plate_number}}) registration expires in {{payload.days_left}} days ({{payload.expiry_date}}).',
        link_template: '/fleet/{{entity_id}}',
        is_digest_eligible: true
      },
      {
        event_type: 'fleet.insurance_expiring',
        recipient_strategy: 'ROLE',
        recipient_value: 'fleet_coordinator',
        channels: ['IN_APP', 'EMAIL'],
        severity: 'ACTION_REQUIRED',
        title_template: 'Vehicle Insurance Expiring: {{payload.plate_number}}',
        body_template: 'Vehicle {{payload.vehicle_code}} ({{payload.plate_number}}) insurance expires in {{payload.days_left}} days ({{payload.expiry_date}}).',
        link_template: '/fleet/{{entity_id}}',
        is_digest_eligible: true
      },
      {
        event_type: 'fleet.service_due',
        recipient_strategy: 'ROLE',
        recipient_value: 'fleet_coordinator',
        channels: ['IN_APP'],
        severity: 'ACTION_REQUIRED',
        title_template: 'Vehicle Service Due: {{payload.plate_number}}',
        body_template: 'Vehicle {{payload.vehicle_code}} ({{payload.plate_number}}) is due for service. Current odometer: {{payload.odometer_km}} km. Next service target: {{payload.next_service_date}} or {{payload.next_service_odometer}} km.',
        link_template: '/fleet/{{entity_id}}',
        is_digest_eligible: true
      },
      {
        event_type: 'fleet.registration_expired_critical',
        recipient_strategy: 'ROLE',
        recipient_value: 'fleet_coordinator',
        channels: ['IN_APP', 'EMAIL'],
        severity: 'CRITICAL',
        title_template: 'CRITICAL: Vehicle Registration EXPIRED: {{payload.plate_number}}',
        body_template: 'ACTIVE Vehicle {{payload.vehicle_code}} ({{payload.plate_number}}) has an EXPIRED registration (Expired {{payload.expiry_date}}). Immediate action required to prevent impounding.',
        link_template: '/fleet/{{entity_id}}',
        is_digest_eligible: false,
        escalation_hours: 24,
        escalation_to_role: 'gm'
      },
      {
        event_type: 'fleet.insurance_expired_critical',
        recipient_strategy: 'ROLE',
        recipient_value: 'fleet_coordinator',
        channels: ['IN_APP', 'EMAIL'],
        severity: 'CRITICAL',
        title_template: 'CRITICAL: Vehicle Insurance EXPIRED: {{payload.plate_number}}',
        body_template: 'ACTIVE Vehicle {{payload.vehicle_code}} ({{payload.plate_number}}) has an EXPIRED insurance policy (Expired {{payload.expiry_date}}). Driving is a serious legal violation.',
        link_template: '/fleet/{{entity_id}}',
        is_digest_eligible: false,
        escalation_hours: 24,
        escalation_to_role: 'gm'
      },
      {
        event_type: 'fleet.driver_points_high',
        recipient_strategy: 'ROLE',
        recipient_value: 'fleet_coordinator',
        channels: ['IN_APP', 'EMAIL'],
        severity: 'ACTION_REQUIRED',
        title_template: 'High Black Points for Driver: {{payload.driver_name}}',
        body_template: 'Driver {{payload.driver_name}} has reached {{payload.points}} black points on their license. Suspension threshold is 24.',
        link_template: '/hr/{{entity_id}}',
        is_digest_eligible: false
      },
      {
        event_type: 'fleet.fuel_anomaly',
        recipient_strategy: 'ROLE',
        recipient_value: 'fleet_coordinator',
        channels: ['IN_APP'],
        severity: 'INFO',
        title_template: 'Fuel Anomaly: Vehicle {{payload.plate_number}}',
        body_template: 'Fuel efficiency for vehicle {{payload.vehicle_code}} ({{payload.plate_number}}) is {{payload.efficiency}} km/L. This deviates by {{payload.deviation}}% from the rolling baseline of {{payload.baseline}} km/L.',
        link_template: '/fleet/{{entity_id}}',
        is_digest_eligible: true
      }
    ];

    const { error: insertErr } = await supabase.from('notification_rules').insert(rules);
    if (insertErr) {
      console.error('Failed to insert notification rules:', insertErr.message);
    } else {
      console.log('Seeded all Fleet notification rules successfully!');
    }

  } catch (err) {
    console.error('Seeding process failed:', err);
  }
}

seedRules();
