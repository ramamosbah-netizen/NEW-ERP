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
  auth: { persistSession: false }
});

// Sleep helper
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function runSmokeTest() {
  console.log('=== STARTING INTEGRATION RETROFIT SMOKE TEST ===\n');

  let client = null;
  let tender = null;
  let boq = null;
  let quote = null;
  let tempManagerUser = null;
  let adminUser = null;

  try {
    // 1. Resolve Admin/GM User
    const { data: authUsers, error: authErr } = await supabase.auth.admin.listUsers();
    if (authErr) throw authErr;
    
    adminUser = authUsers.users.find(u => u.email === 'ramma.mosbah@gmail.com');
    if (!adminUser) {
      adminUser = authUsers.users[0];
    }
    
    if (!adminUser) {
      throw new Error('No auth users found in database to run smoke test.');
    }

    console.log(`Using admin/GM user: ${adminUser.email} (ID: ${adminUser.id})`);
    
    // Ensure admin profile exists with admin role
    await supabase.from('profiles').upsert({
      id: adminUser.id,
      email: adminUser.email,
      full_name: 'Test Administrator / GM',
      role: 'admin'
    });

    // Create a temporary manager user
    const tempManagerEmail = `temp_manager_${Date.now()}@smoketest.com`;
    console.log(`Creating temporary manager auth user: ${tempManagerEmail}...`);
    const { data: tempUser, error: tempUserErr } = await supabase.auth.admin.createUser({
      email: tempManagerEmail,
      password: 'TemporaryPassword123!',
      email_confirm: true,
      user_metadata: { full_name: 'Test Commercial Manager', role: 'manager' }
    });
    if (tempUserErr) throw tempUserErr;
    tempManagerUser = tempUser.user;
    console.log(`Temporary manager user created: ID ${tempManagerUser.id}`);

    // Ensure manager profile exists with manager role
    await supabase.from('profiles').upsert({
      id: tempManagerUser.id,
      email: tempManagerUser.email,
      full_name: 'Test Commercial Manager',
      role: 'manager'
    });

    // Verify profiles table state in DB
    const { data: currentProfiles } = await supabase.from('profiles').select('*');
    console.log('Current profiles in database right before test run:');
    console.log(JSON.stringify(currentProfiles, null, 2));

    // 2. Setup Dummy Client, Tender, BOQ, and Draft Quotation
    console.log('\n--- STEP 1: Creating test entities ---');
    
    // A. Client
    const { data: clientData, error: clientErr } = await supabase
      .from('clients')
      .insert({
        name: 'Smoke Test Client Corp',
        contact_person: 'John Doe',
        contact_email: 'john@smoketest.com',
        contact_phone: '+971501234567'
      })
      .select()
      .single();
    if (clientErr) throw clientErr;
    client = clientData;
    console.log(`Client created: ${client.name} (ID: ${client.id})`);

    // B. Tender
    const { data: tenderData, error: tenderErr } = await supabase
      .from('tenders')
      .insert({
        title: 'Smoke Test Office Security Installation',
        project_name: 'Smoke Test Project',
        client_name: client.name,
        location: 'Dubai, UAE',
        deadline_date: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        scope_of_work: 'Install security cameras and readers',
        status: 'Draft',
        created_by: tempManagerUser.id
      })
      .select()
      .single();
    if (tenderErr) throw tenderErr;
    tender = tenderData;
    console.log(`Tender created: ${tender.title} (ID: ${tender.id})`);

    // C. BOQ
    const { data: boqData, error: boqErr } = await supabase
      .from('boqs')
      .insert({
        tender_id: tender.id,
        status: 'finalized',
        created_by: tempManagerUser.id,
        version: 1,
        items: [],
        cost_elements: {},
        financials: {}
      })
      .select()
      .single();
    if (boqErr) throw boqErr;
    boq = boqData;
    console.log(`BOQ created (ID: ${boq.id})`);

    // E. Create Quotation (Draft)
    const quoteNumber = `JI-Q-${Date.now().toString().slice(-6)}`;
    const { data: quoteData, error: quoteErr } = await supabase
      .from('quotations')
      .insert({
        status: 'DRAFT',
        boq_id: boq.id,
        project_id: tender.id,
        project_ref: 'JI-REF-SMOKE',
        quotation_number: quoteNumber,
        client_id: client.id,
        client_name: client.name,
        subject: 'Quotation for CCTV & Access Control Installation',
        grand_total_with_vat: 105000.00,
        subtotal_after_discount: 100000.00,
        prepared_by: tempManagerUser.id,
        prepared_by_name: 'Test Commercial Manager',
        prepared_by_title: 'Estimator',
        is_locked: false,
        valid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        currency: 'AED',
        vat_rate: 5.00
      })
      .select()
      .single();
    if (quoteErr) throw quoteErr;
    quote = quoteData;
    console.log(`Draft Quotation created: ${quote.quotation_number} (ID: ${quote.id})`);

    // 3. Submit Quotation for Review
    console.log('\n--- STEP 2: Submitting quotation for review ---');
    const { data: submittedQuote, error: submitErr } = await supabase
      .from('quotations')
      .update({ status: 'PENDING_COMMERCIAL', updated_at: new Date().toISOString() })
      .eq('id', quote.id)
      .select()
      .single();
    if (submitErr) throw submitErr;
    console.log(`Quotation status updated to: ${submittedQuote.status}`);

    // Log approval
    await supabase.from('quotation_approvals').insert({
      quotation_id: quote.id,
      stage: 'ESTIMATOR',
      action: 'SUBMITTED',
      actor_id: tempManagerUser.id,
      actor_name: 'Test Commercial Manager',
      actor_title: 'Estimator',
      comment: 'Submitted for review (Smoke Test)'
    });

    // Emit event
    console.log('Emitting quotation.submitted event...');
    const { data: submitEvent, error: eventErr } = await supabase
      .from('system_events')
      .insert({
        event_type: 'quotation.submitted',
        entity_type: 'QUOTATION',
        entity_id: quote.id,
        project_id: tender.id,
        payload: {
          quotation_number: quote.quotation_number,
          grand_total: quote.grand_total_with_vat,
          subtotal_after_discount: quote.subtotal_after_discount,
          client_name: client.name,
          subject: quote.subject,
          prepared_by_name: 'Test Commercial Manager'
        },
        actor_user_id: tempManagerUser.id
      })
      .select()
      .single();
    if (eventErr) throw eventErr;
    console.log(`Event row created: ${submitEvent.event_type} (ID: ${submitEvent.id})`);

    // Invoke process-event Edge Function
    console.log('Invoking process-event Edge Function...');
    const { data: processResult, error: processErr } = await supabase.functions.invoke('process-event', {
      body: { event_id: submitEvent.id }
    });
    if (processErr) throw processErr;
    console.log('process-event function completed:', processResult);

    // Wait for DB
    await sleep(3000);

    // 4. Verify Task and Notification Creation
    console.log('\n--- STEP 3: Verifying generated task & notification ---');
    
    const { data: processedEvent } = await supabase
      .from('system_events')
      .select('processed_at')
      .eq('id', submitEvent.id)
      .single();
    console.log(`Event processed_at: ${processedEvent?.processed_at}`);

    const { data: tasks, error: taskFetchErr } = await supabase
      .from('tasks')
      .select('*')
      .eq('source_event_id', submitEvent.id);
    if (taskFetchErr) throw taskFetchErr;
    
    if (tasks.length === 0) {
      throw new Error('Verification failed: No task was generated by the event engine!');
    }
    const generatedTask = tasks[0];
    console.log(`✅ Task Generated successfully!`);
    console.log(`   Title: "${generatedTask.title}"`);
    console.log(`   Assignee ID: ${generatedTask.assignee_id}`);
    console.log(`   Priority: ${generatedTask.priority}`);
    console.log(`   Due Date: ${generatedTask.due_date} (UAE Business Hours applied)`);

    const { data: notifications, error: notifFetchErr } = await supabase
      .from('notifications')
      .select('*')
      .eq('event_id', submitEvent.id);
    if (notifFetchErr) throw notifFetchErr;

    if (notifications.length === 0) {
      throw new Error('Verification failed: No notification was generated by the event engine!');
    }
    console.log(`✅ Notification(s) Generated successfully!`);
    notifications.forEach(n => {
      console.log(`   Channel: ${n.channel} | Recipient ID: ${n.user_id} | Status: ${n.status} | Title: "${n.title}"`);
    });

    const { data: timers, error: timerFetchErr } = await supabase
      .from('escalation_timers')
      .select('*')
      .eq('event_id', submitEvent.id);
    if (timerFetchErr) throw timerFetchErr;

    if (timers.length === 0) {
      throw new Error('Verification failed: No escalation timer was generated!');
    }
    const timer = timers[0];
    console.log(`✅ Escalation Timer created successfully!`);
    console.log(`   Escalate At: ${timer.escalate_at}`);

    // 5. Simulate Escalation
    console.log('\n--- STEP 4: Simulating 48h passage and triggering escalation ---');
    const pastTime = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { data: updatedTimer, error: timerUpdateErr } = await supabase
      .from('escalation_timers')
      .update({ escalate_at: pastTime })
      .eq('id', timer.id)
      .select()
      .single();
    if (timerUpdateErr) throw timerUpdateErr;
    console.log(`Escalation timer updated to: ${updatedTimer.escalate_at}`);

    console.log('Invoking escalation-check Edge Function...');
    const { data: escalationResult, error: escalationErr } = await supabase.functions.invoke('escalation-check');
    if (escalationErr) throw escalationErr;
    console.log('escalation-check function completed:', escalationResult);

    await sleep(3000);

    const { data: escalationEvents } = await supabase
      .from('system_events')
      .select('*')
      .eq('event_type', 'approval.escalation')
      .order('created_at', { ascending: false })
      .limit(1);

    if (!escalationEvents || escalationEvents.length === 0) {
      throw new Error('Verification failed: No approval.escalation event was emitted!');
    }
    const escEvent = escalationEvents[0];
    console.log(`✅ Escalation Event emitted: ${escEvent.event_type} (ID: ${escEvent.id})`);

    const { data: escNotifications } = await supabase
      .from('notifications')
      .select('*')
      .eq('event_id', escEvent.id);

    if (!escNotifications || escNotifications.length === 0) {
      throw new Error('Verification failed: GM/Admin did not receive escalation notification!');
    }
    console.log(`✅ Escalation Notification(s) Generated for Admin/GM!`);
    escNotifications.forEach(n => {
      console.log(`   Channel: ${n.channel} | Recipient ID: ${n.user_id} | Title: "${n.title}"`);
    });

    // 6. GM Approve (GM approval auto-completes task and cancels timer)
    console.log('\n--- STEP 5: Approving quotation (Triggering auto-complete) ---');
    const { data: approvedQuote, error: approveErr } = await supabase
      .from('quotations')
      .update({
        status: 'APPROVED',
        gm_approver_id: adminUser.id,
        gm_approved_at: new Date().toISOString(),
        gm_comment: 'Approved via Smoke Test',
        is_locked: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', quote.id)
      .select()
      .single();
    if (approveErr) throw approveErr;
    console.log(`Quotation status updated to: ${approvedQuote.status}`);

    await supabase.from('quotation_approvals').insert({
      quotation_id: quote.id,
      stage: 'GM',
      action: 'APPROVED',
      actor_id: adminUser.id,
      actor_name: 'Test Administrator / GM',
      actor_title: 'General Manager',
      comment: 'Approved (Smoke Test)'
    });

    console.log('Emitting quotation.approved event...');
    const { data: approveEvent, error: approveEventErr } = await supabase
      .from('system_events')
      .insert({
        event_type: 'quotation.approved',
        entity_type: 'QUOTATION',
        entity_id: quote.id,
        project_id: tender.id,
        payload: {
          quotation_number: quote.quotation_number,
          grand_total: quote.grand_total_with_vat,
          client_name: client.name,
          approver_name: 'Test Administrator / GM'
        },
        actor_user_id: adminUser.id
      })
      .select()
      .single();
    if (approveEventErr) throw approveEventErr;
    console.log(`Event row created: ${approveEvent.event_type} (ID: ${approveEvent.id})`);

    console.log('Invoking process-event Edge Function...');
    const { data: approveProcessResult, error: approveProcessErr } = await supabase.functions.invoke('process-event', {
      body: { event_id: approveEvent.id }
    });
    if (approveProcessErr) throw approveProcessErr;
    console.log('process-event function completed:', approveProcessResult);

    await sleep(3000);

    // 7. Verify Task Auto-completion and Escalation Timer Cancellation
    console.log('\n--- STEP 6: Verifying auto-complete and cancellation ---');

    const { data: updatedTask } = await supabase
      .from('tasks')
      .select('status, completed_at')
      .eq('id', generatedTask.id)
      .single();

    if (updatedTask.status !== 'DONE_AUTO') {
      throw new Error(`Verification failed: Task status is ${updatedTask.status}, expected DONE_AUTO`);
    }
    console.log(`✅ Task auto-completed successfully! Status: ${updatedTask.status} | Completed At: ${updatedTask.completed_at}`);

    const { data: cancelledTimer } = await supabase
      .from('escalation_timers')
      .select('cancelled')
      .eq('id', timer.id)
      .single();

    if (!cancelledTimer.cancelled) {
      throw new Error(`Verification failed: Escalation timer cancelled = ${cancelledTimer.cancelled}, expected true`);
    }
    console.log(`✅ Escalation Timer cancelled successfully! Cancelled: ${cancelledTimer.cancelled}`);

    // 8. Simulate Daily Digest
    console.log('\n--- STEP 7: Simulating daily digest generation ---');
    const { data: digestResult, error: digestErr } = await supabase.functions.invoke('daily-digest');
    if (digestErr) throw digestErr;
    console.log('daily-digest function completed successfully:', digestResult);

    console.log('\n=== SMOKE TEST COMPLETED SUCCESSFULLY WITH ZERO ERRORS ===');

  } catch (err) {
    console.error('\n❌ SMOKE TEST FAILED:', err.message);
    if (err.stack) console.error(err.stack);
  } finally {
    console.log('\nSkipping cleanup for debugging purposes.');
    /*
    console.log('\nCleaning up test records from database...');
    if (quote?.id) {
      await supabase.from('quotations').delete().eq('id', quote.id);
      console.log('Cleaned up test quotation.');
    }
    if (boq?.id) {
      await supabase.from('boqs').delete().eq('id', boq.id);
      console.log('Cleaned up test BOQ.');
    }
    if (tender?.id) {
      await supabase.from('tenders').delete().eq('id', tender.id);
      console.log('Cleaned up test tender.');
    }
    if (client?.id) {
      await supabase.from('clients').delete().eq('id', client.id);
      console.log('Cleaned up test client.');
    }
    if (tempManagerUser?.id) {
      // Clean up profile first then auth user
      await supabase.from('profiles').delete().eq('id', tempManagerUser.id);
      await supabase.auth.admin.deleteUser(tempManagerUser.id);
      console.log('Cleaned up temporary manager auth user.');
    }
    */
  }
}

runSmokeTest();
