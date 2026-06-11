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
    console.log('Seeding Event Types...');
    const eventTypes = [
      { event_type: 'po.created', module: 'PROCUREMENT', description: 'Local Purchase Order draft created', default_severity: 'INFO' },
      { event_type: 'po.submitted', module: 'PROCUREMENT', description: 'Local Purchase Order submitted for manager approval', default_severity: 'ACTION_REQUIRED' },
      { event_type: 'po.approved', module: 'PROCUREMENT', description: 'Local Purchase Order approved and signed off', default_severity: 'INFO' },
      { event_type: 'po.rejected', module: 'PROCUREMENT', description: 'Local Purchase Order rejected during sign-off review', default_severity: 'INFO' },
      { event_type: 'po.sent', module: 'PROCUREMENT', description: 'LPO officially sent to supplier', default_severity: 'INFO' },
      { event_type: 'po.acknowledged', module: 'PROCUREMENT', description: 'Supplier acknowledged and confirmed delivery date', default_severity: 'INFO' },
      { event_type: 'po.cancelled', module: 'PROCUREMENT', description: 'Local Purchase Order cancelled', default_severity: 'INFO' },
      { event_type: 'po.fully_delivered', module: 'PROCUREMENT', description: 'All materials on the LPO successfully received at site/store', default_severity: 'INFO' },
      { event_type: 'po.partially_delivered', module: 'PROCUREMENT', description: 'Partial materials on the LPO received', default_severity: 'INFO' },
      { event_type: 'po.revised', module: 'PROCUREMENT', description: 'Purchase Order revised and a new revision created', default_severity: 'INFO' },
      { event_type: 'grn.recorded', module: 'PROCUREMENT', description: 'Goods Receipt Note logged at site or warehouse', default_severity: 'INFO' },
      { event_type: 'grn.returned', module: 'PROCUREMENT', description: 'Defective materials returned or credit ticket updated', default_severity: 'ACTION_REQUIRED' },
      { event_type: 'grn.over_delivered', module: 'PROCUREMENT', description: 'Over-delivery above 2% tolerance recorded on GRN', default_severity: 'ACTION_REQUIRED' },
      { event_type: 'po.budget_exceeded', module: 'PROCUREMENT', description: 'Purchase Order takes system committed cost over BOQ budget', default_severity: 'ACTION_REQUIRED' }
    ];

    for (const et of eventTypes) {
      const { error } = await supabase.from('event_types').upsert(et, { onConflict: 'event_type' });
      if (error) {
        console.error(`Failed to upsert event type ${et.event_type}:`, error.message);
      } else {
        console.log(`Synced event type: ${et.event_type}`);
      }
    }

    console.log('\nCleaning existing PO/GRN Notification Rules...');
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

    console.log('\nInserting Notification Rules...');
    const rules = [
      {
        event_type: 'po.submitted',
        recipient_strategy: 'ROLE',
        recipient_value: 'manager',
        channels: ['IN_APP', 'EMAIL'],
        severity: 'ACTION_REQUIRED',
        title_template: 'LPO {{payload.po_number}} Pending Approval',
        body_template: 'Purchase order for {{payload.supplier_name}} (Total: {{payload.total}} AED) requires review.',
        link_template: '/procurement/po/{{entity_id}}',
        is_digest_eligible: false,
        escalation_hours: 24,
        escalation_to_role: 'admin'
      },
      {
        event_type: 'po.approved',
        recipient_strategy: 'SPECIFIC_USER_FROM_PAYLOAD',
        recipient_value: 'created_by_id',
        channels: ['IN_APP'],
        severity: 'INFO',
        title_template: 'LPO {{payload.po_number}} Approved',
        body_template: 'Your Purchase Order for {{payload.supplier_name}} has been signed off.',
        link_template: '/procurement/po/{{entity_id}}',
        is_digest_eligible: true
      },
      {
        event_type: 'po.rejected',
        recipient_strategy: 'SPECIFIC_USER_FROM_PAYLOAD',
        recipient_value: 'created_by_id',
        channels: ['IN_APP', 'EMAIL'],
        severity: 'CRITICAL',
        title_template: 'LPO {{payload.po_number}} Returned / Rejected',
        body_template: 'Your Purchase Order for {{payload.supplier_name}} was rejected. Reason: {{payload.comment}}',
        link_template: '/procurement/po/{{entity_id}}',
        is_digest_eligible: false
      },
      {
        event_type: 'po.fully_delivered',
        recipient_strategy: 'ROLE',
        recipient_value: 'manager',
        channels: ['IN_APP'],
        severity: 'INFO',
        title_template: 'LPO {{payload.po_number}} Fully Delivered',
        body_template: 'All materials from {{payload.supplier_name}} have arrived at site.',
        link_template: '/procurement/po/{{entity_id}}',
        is_digest_eligible: true
      },
      {
        event_type: 'grn.recorded',
        recipient_strategy: 'ROLE',
        recipient_value: 'manager',
        channels: ['IN_APP'],
        severity: 'INFO',
        title_template: 'GRN {{payload.grn_number}} Logged',
        body_template: 'Goods receipt note registered for LPO {{payload.po_number}} ({{payload.item_count}} items).',
        link_template: '/procurement/grn/{{entity_id}}',
        is_digest_eligible: true
      },
      {
        event_type: 'grn.returned',
        recipient_strategy: 'ROLE',
        recipient_value: 'manager',
        channels: ['IN_APP', 'EMAIL'],
        severity: 'ACTION_REQUIRED',
        title_template: 'Rejections / Returns: GRN {{payload.grn_number}}',
        body_template: 'Defective items ({{payload.total_rejected_qty}} rejected) from {{payload.supplier_name}} pending supplier return collection.',
        link_template: '/procurement/grn',
        is_digest_eligible: false
      },
      {
        event_type: 'grn.over_delivered',
        recipient_strategy: 'ROLE',
        recipient_value: 'manager',
        channels: ['IN_APP', 'EMAIL'],
        severity: 'ACTION_REQUIRED',
        title_template: 'Over-Delivery Warning: GRN {{payload.grn_number}}',
        body_template: 'LPO {{payload.po_number}} received quantity exceeds ordered limit by more than 2% tolerance.',
        link_template: '/procurement/grn/{{entity_id}}',
        is_digest_eligible: false
      },
      {
        event_type: 'po.budget_exceeded',
        recipient_strategy: 'ROLE',
        recipient_value: 'manager',
        channels: ['IN_APP', 'EMAIL'],
        severity: 'ACTION_REQUIRED',
        title_template: 'BUDGET OVERRUN: LPO {{payload.po_number}} Approved',
        body_template: 'LPO {{payload.po_number}} took {{payload.system_name}} committed cost to {{payload.percentage}}% of BOQ budget. Justification: {{payload.comment}}',
        link_template: '/procurement/po/{{entity_id}}',
        is_digest_eligible: false
      }
    ];

    const { error: insertErr } = await supabase
      .from('notification_rules')
      .insert(rules);
      
    if (insertErr) {
      console.error('Failed to insert rules:', insertErr.message);
    } else {
      console.log('Successfully inserted all notification rules.');
    }

    console.log('\nSeeding complete.');
  } catch (err) {
    console.error('Seeding failed:', err);
  }
}

seedRules();
