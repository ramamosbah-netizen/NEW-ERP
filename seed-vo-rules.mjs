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
    console.log('Seeding Variation Order Event Types...');
    const eventTypes = [
      { event_type: 'vo.created', module: 'COMMERCIAL', description: 'Variation Order draft captured', default_severity: 'INFO' },
      { event_type: 'vo.priced', module: 'COMMERCIAL', description: 'Variation Order scope priced', default_severity: 'INFO' },
      { event_type: 'vo.submitted_internal', module: 'COMMERCIAL', description: 'Variation Order submitted for internal review', default_severity: 'ACTION_REQUIRED' },
      { event_type: 'vo.internally_approved', module: 'COMMERCIAL', description: 'Variation Order approved internally', default_severity: 'INFO' },
      { event_type: 'vo.submitted_to_client', module: 'COMMERCIAL', description: 'Variation Order officially issued to client', default_severity: 'INFO' },
      { event_type: 'vo.client_approved', module: 'COMMERCIAL', description: 'Variation Order approved by client (contract value updated)', default_severity: 'INFO' },
      { event_type: 'vo.client_rejected', module: 'COMMERCIAL', description: 'Variation Order rejected by client', default_severity: 'CRITICAL' },
      { event_type: 'vo.proceed_at_risk', module: 'COMMERCIAL', description: 'VO site work started before client approval (exposure alert)', default_severity: 'CRITICAL' },
      { event_type: 'vo.cancelled', module: 'COMMERCIAL', description: 'Variation Order cancelled', default_severity: 'INFO' }
    ];

    for (const et of eventTypes) {
      const { error } = await supabase.from('event_types').upsert(et, { onConflict: 'event_type' });
      if (error) {
        console.error(`Failed to upsert event type ${et.event_type}:`, error.message);
      } else {
        console.log(`Synced event type: ${et.event_type}`);
      }
    }

    console.log('\nCleaning existing Variation Order Notification Rules...');
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

    console.log('\nInserting Variation Order Notification Rules...');
    const rules = [
      {
        event_type: 'vo.submitted_internal',
        recipient_strategy: 'ROLE',
        recipient_value: 'commercial_mgr',
        channels: ['IN_APP', 'EMAIL'],
        severity: 'ACTION_REQUIRED',
        title_template: 'VO {{payload.vo_number}} Pending Internal Review',
        body_template: 'VO for project {{payload.project_number}} (Amount: {{payload.sell_amount}} AED) is pending approval.',
        link_template: '/vo/{{entity_id}}',
        is_digest_eligible: false,
        escalation_hours: 48,
        escalation_to_role: 'gm'
      },
      {
        event_type: 'vo.internally_approved',
        recipient_strategy: 'PREPARED_BY',
        recipient_value: 'prepared_by',
        channels: ['IN_APP'],
        severity: 'INFO',
        title_template: 'VO {{payload.vo_number}} Internally Approved',
        body_template: 'Variation Order {{payload.vo_number}} has been approved internally and is ready for client submission.',
        link_template: '/vo/{{entity_id}}',
        is_digest_eligible: true
      },
      {
        event_type: 'vo.submitted_to_client',
        recipient_strategy: 'ROLE',
        recipient_value: 'commercial_mgr',
        channels: ['IN_APP'],
        severity: 'INFO',
        title_template: 'VO {{payload.vo_number}} Issued to Client',
        body_template: 'Variation Order has been marked as submitted to the client for project {{payload.project_number}}.',
        link_template: '/vo/{{entity_id}}',
        is_digest_eligible: true
      },
      {
        event_type: 'vo.client_approved',
        recipient_strategy: 'ROLE',
        recipient_value: 'accountant',
        channels: ['IN_APP', 'EMAIL'],
        severity: 'INFO',
        title_template: 'VO {{payload.vo_number}} CLIENT APPROVED',
        body_template: 'Client approved VO for project {{payload.project_number}}. Contract value updated to {{payload.revised_contract_value}} AED.',
        link_template: '/vo/{{entity_id}}',
        is_digest_eligible: true
      },
      {
        event_type: 'vo.client_rejected',
        recipient_strategy: 'PREPARED_BY',
        recipient_value: 'prepared_by',
        channels: ['IN_APP', 'EMAIL'],
        severity: 'CRITICAL',
        title_template: 'VO {{payload.vo_number}} REJECTED BY CLIENT',
        body_template: 'Client rejected Variation Order {{payload.vo_number}} for project {{payload.project_number}}.',
        link_template: '/vo/{{entity_id}}',
        is_digest_eligible: false
      },
      {
        event_type: 'vo.proceed_at_risk',
        recipient_strategy: 'ROLE',
        recipient_value: 'gm',
        channels: ['IN_APP', 'EMAIL'],
        severity: 'CRITICAL',
        title_template: '⚠️ proceed_at_risk Exposure: VO {{payload.vo_number}}',
        body_template: 'Work started on VO {{payload.vo_number}} before client approval. Current exposure: {{payload.sell_amount}} AED.',
        link_template: '/vo/{{entity_id}}',
        is_digest_eligible: false
      }
    ];

    const { error: insertErr } = await supabase
      .from('notification_rules')
      .insert(rules);
      
    if (insertErr) {
      console.error('Failed to insert rules:', insertErr.message);
    } else {
      console.log('Successfully inserted all Variation Order notification rules.');
    }

    console.log('\nCleaning existing Variation Order Task Rules...');
    const { error: deleteTaskErr } = await supabase
      .from('task_rules')
      .delete()
      .in('event_type', eventTypeNames);
      
    if (deleteTaskErr) {
      console.error('Failed to clear existing task rules:', deleteTaskErr.message);
    } else {
      console.log('Cleared existing task rules.');
    }

    console.log('\nInserting Variation Order Task Rules...');
    const taskRules = [
      {
        event_type: 'vo.submitted_internal',
        title_template: 'Review & Approve Variation Order {{payload.vo_number}}',
        description_template: 'Review the scope and pricing for VO {{payload.vo_number}} on project {{payload.project_number}}. Check if work already proceeded (At-Risk: {{payload.proceed_at_risk}}).',
        assignee_strategy: 'ROLE',
        assignee_value: 'commercial_mgr',
        priority: 'HIGH',
        due_hours: 48,
        auto_complete_on_event: 'vo.internally_approved'
      },
      {
        event_type: 'vo.internally_approved',
        title_template: 'Submit Variation Order {{payload.vo_number}} to Client',
        description_template: 'Generate Variation Sheet PDF and submit it formally to client/consultant for project {{payload.project_number}}.',
        assignee_strategy: 'PREPARED_BY',
        assignee_value: 'prepared_by',
        priority: 'MEDIUM',
        due_hours: 24,
        auto_complete_on_event: 'vo.submitted_to_client'
      },
      {
        event_type: 'vo.submitted_to_client',
        title_template: 'Follow up Client Approval for VO {{payload.vo_number}}',
        description_template: 'Track client signature and upload signed approval document for VO {{payload.vo_number}}.',
        assignee_strategy: 'PREPARED_BY',
        assignee_value: 'prepared_by',
        priority: 'MEDIUM',
        due_hours: 120,
        auto_complete_on_event: 'vo.client_approved'
      }
    ];

    const { error: insertTaskErr } = await supabase
      .from('task_rules')
      .insert(taskRules);

    if (insertTaskErr) {
      console.error('Failed to insert task rules:', insertTaskErr.message);
    } else {
      console.log('Successfully inserted all Variation Order task rules.');
    }

    console.log('\nVariation Order seeding complete.');
  } catch (err) {
    console.error('Seeding failed:', err);
  }
}

seedRules();
