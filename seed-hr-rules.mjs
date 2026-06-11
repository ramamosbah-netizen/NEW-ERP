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
    console.log('Seeding HR & Payroll Event Types...');
    const eventTypes = [
      { event_type: 'hr.document_expiring', module: 'OPERATIONS', description: 'UAE employee master document or certification approaching expiry', default_severity: 'ACTION_REQUIRED' },
      { event_type: 'hr.visa_expired_critical', module: 'OPERATIONS', description: 'CRITICAL: Visa or Labour Card expired for ACTIVE employee (legal violation risk)', default_severity: 'CRITICAL' },
      { event_type: 'timesheet.submitted', module: 'OPERATIONS', description: 'Employee timesheet submitted for approval', default_severity: 'INFO' },
      { event_type: 'timesheet.approved', module: 'OPERATIONS', description: 'Timesheet approved by department head or PM', default_severity: 'INFO' },
      { event_type: 'timesheet.rejected', module: 'OPERATIONS', description: 'Timesheet rejected with reasons provided', default_severity: 'ACTION_REQUIRED' },
      { event_type: 'leave.submitted', module: 'OPERATIONS', description: 'Leave request submitted for approval', default_severity: 'INFO' },
      { event_type: 'leave.approved', module: 'OPERATIONS', description: 'Leave request approved and balance updated', default_severity: 'INFO' },
      { event_type: 'leave.rejected', module: 'OPERATIONS', description: 'Leave request rejected', default_severity: 'INFO' },
      { event_type: 'payroll.approved', module: 'FINANCE', description: 'Monthly payroll run officially approved and locked', default_severity: 'INFO' }
    ];

    for (const et of eventTypes) {
      const { error } = await supabase.from('event_types').upsert(et, { onConflict: 'event_type' });
      if (error) {
        console.error(`Failed to upsert event type ${et.event_type}:`, error.message);
      } else {
        console.log(`Synced event type: ${et.event_type}`);
      }
    }

    console.log('\nCleaning existing HR Notification Rules...');
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

    console.log('\nInserting HR Notification Rules...');
    const rules = [
      {
        event_type: 'hr.document_expiring',
        recipient_strategy: 'ROLE',
        recipient_value: 'hr',
        channels: ['IN_APP', 'EMAIL'],
        severity: 'ACTION_REQUIRED',
        title_template: 'HR Compliance: {{payload.doc_type}} Expiring',
        body_template: 'Renew {{payload.doc_type}} for {{payload.employee_name}} — expires on {{payload.expiry_date}}.',
        link_template: '/hr/{{entity_id}}',
        is_digest_eligible: true
      },
      {
        event_type: 'hr.visa_expired_critical',
        recipient_strategy: 'ROLE',
        recipient_value: 'hr',
        channels: ['IN_APP', 'EMAIL'],
        severity: 'CRITICAL',
        title_template: 'CRITICAL VIOLATION: Visa/Labour Card Expired for {{payload.employee_name}}',
        body_template: 'ACTIVE employee {{payload.employee_name}} has an expired {{payload.doc_type}} (Expired {{payload.expiry_date}}). Immediate action required to avoid MOHRE fines.',
        link_template: '/hr/{{entity_id}}',
        is_digest_eligible: false,
        escalation_hours: 24,
        escalation_to_role: 'gm'
      },
      {
        event_type: 'timesheet.submitted',
        recipient_strategy: 'ROLE',
        recipient_value: 'manager',
        channels: ['IN_APP'],
        severity: 'INFO',
        title_template: 'Timesheet Submitted: {{payload.employee_name}}',
        body_template: 'Timesheet for week starting {{payload.week_start}} has been submitted for review.',
        link_template: '/timesheets/approvals',
        is_digest_eligible: false
      },
      {
        event_type: 'timesheet.approved',
        recipient_strategy: 'SPECIFIC_USER_FROM_PAYLOAD',
        recipient_value: 'user_id',
        channels: ['IN_APP'],
        severity: 'INFO',
        title_template: 'Timesheet Approved: Week {{payload.week_start}}',
        body_template: 'Your timesheet for week starting {{payload.week_start}} has been approved.',
        link_template: '/timesheets',
        is_digest_eligible: true
      },
      {
        event_type: 'timesheet.rejected',
        recipient_strategy: 'SPECIFIC_USER_FROM_PAYLOAD',
        recipient_value: 'user_id',
        channels: ['IN_APP', 'EMAIL'],
        severity: 'ACTION_REQUIRED',
        title_template: 'Timesheet REJECTED: Week {{payload.week_start}}',
        body_template: 'Your timesheet for week starting {{payload.week_start}} was rejected. Reason: {{payload.rejection_reason}}',
        link_template: '/timesheets',
        is_digest_eligible: false
      },
      {
        event_type: 'leave.submitted',
        recipient_strategy: 'ROLE',
        recipient_value: 'manager',
        channels: ['IN_APP'],
        severity: 'INFO',
        title_template: 'Leave Request: {{payload.employee_name}}',
        body_template: 'Leave request for {{payload.days}} days ({{payload.leave_type}}) submitted from {{payload.from_date}} to {{payload.to_date}}.',
        link_template: '/hr/approvals',
        is_digest_eligible: false
      },
      {
        event_type: 'leave.approved',
        recipient_strategy: 'SPECIFIC_USER_FROM_PAYLOAD',
        recipient_value: 'user_id',
        channels: ['IN_APP', 'EMAIL'],
        severity: 'INFO',
        title_template: 'Leave Request Approved: {{payload.from_date}}',
        body_template: 'Your request for {{payload.leave_type}} leave from {{payload.from_date}} to {{payload.to_date}} has been approved.',
        link_template: '/hr/leave',
        is_digest_eligible: true
      },
      {
        event_type: 'leave.rejected',
        recipient_strategy: 'SPECIFIC_USER_FROM_PAYLOAD',
        recipient_value: 'user_id',
        channels: ['IN_APP'],
        severity: 'INFO',
        title_template: 'Leave Request Rejected: {{payload.from_date}}',
        body_template: 'Your request for {{payload.leave_type}} leave starting {{payload.from_date}} was rejected.',
        link_template: '/hr/leave',
        is_digest_eligible: false
      },
      {
        event_type: 'payroll.approved',
        recipient_strategy: 'ROLE',
        recipient_value: 'account',
        channels: ['IN_APP', 'EMAIL'],
        severity: 'INFO',
        title_template: 'Payroll Run Approved: {{payload.period_month}}',
        body_template: 'The payroll run for {{payload.period_month}} has been approved and locked. SIF file is ready for WPS submission.',
        link_template: '/payroll',
        is_digest_eligible: false
      }
    ];

    const { error: insertErr } = await supabase.from('notification_rules').insert(rules);
    if (insertErr) {
      console.error('Failed to insert notification rules:', insertErr.message);
    } else {
      console.log('Seeded all notification rules successfully!');
    }

  } catch (err) {
    console.error('Seeding process failed:', err);
  }
}

seedRules();
