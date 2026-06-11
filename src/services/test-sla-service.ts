// ============================================================
// JEET ERP — SLA Math Service Unit Tests
// Run: npx ts-node src/services/test-sla-service.ts
// ============================================================

import fs from 'fs';

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

import type { ServiceTicket } from '@/types/ticket.types';

const holidays = ['2026-06-14']; // A Sunday holiday

async function runTests() {
  const { calculateSLADeadlines, pauseSLATimer, resumeSLATimer, evaluateSLABreach } = await import('./slaService');
  const { fromGSTParts, getGSTParts } = await import('./businessTime');

  console.log('Running SLA Service Math Unit Tests...');
  let failures = 0;

  function assert(name: string, condition: boolean) {
    if (!condition) {
      console.error(`❌ FAIL: ${name}`);
      failures++;
    } else {
      console.log(`✅ PASS: ${name}`);
    }
  }

  // Test Case 1: Standard SLA calculation (respects business hours/holidays)
  // Standard SLA: 24h Response, 72h Resolution.
  // Start: Sunday 7th June 2026 09:00 GST
  // Response Due should be: 24h -> 2.4 days -> Sunday has 9 hours left (9-18).
  // Monday has 10 hours. Tuesday has 10 hours.
  // Let's verify: 9 hours (Sun) + 10 hours (Mon) + 5 hours (Tue 13:00 GST).
  const start1 = fromGSTParts({ year: 2026, month: 5, date: 7, hours: 9, minutes: 0 }); // 7th June 2026 is Sunday
  const result1 = calculateSLADeadlines({ priority: 'LOW', sla_tier: 'STANDARD' }, start1, holidays);
  
  const responseParts = getGSTParts(result1.responseDue);
  assert(
    'Standard SLA Response Due (24h business time)',
    responseParts.year === 2026 &&
    responseParts.month === 5 &&
    responseParts.date === 9 && // Tuesday 9th June
    responseParts.hours === 13 && // 13:00 GST
    responseParts.minutes === 0
  );

  // Test Case 2: Emergency SLA calculation (24/7 calendar bypass)
  // Emergency SLA: 1h Response, 2h Resolution.
  // Start: Thursday 11th June 2026 17:30 GST
  // Response should be Thursday 11th June 18:30 GST (calendar calculation)
  // Resolution should be Thursday 11th June 19:30 GST (calendar calculation)
  const start2 = fromGSTParts({ year: 2026, month: 5, date: 11, hours: 17, minutes: 30 });
  const result2 = calculateSLADeadlines({ priority: 'EMERGENCY' }, start2, holidays);
  
  const emergencyResponseParts = getGSTParts(result2.responseDue);
  const emergencyResolutionParts = getGSTParts(result2.resolutionDue);
  assert(
    'Emergency SLA Response (1h calendar)',
    emergencyResponseParts.date === 11 && emergencyResponseParts.hours === 18 && emergencyResponseParts.minutes === 30
  );
  assert(
    'Emergency SLA Resolution (2h calendar)',
    emergencyResolutionParts.date === 11 && emergencyResolutionParts.hours === 19 && emergencyResolutionParts.minutes === 30
  );

  // Test Case 3: Pausing and Resuming SLA
  // Start with a mock ticket
  const responseTime = fromGSTParts({ year: 2026, month: 5, date: 9, hours: 13, minutes: 0 });
  const resolutionTime = fromGSTParts({ year: 2026, month: 5, date: 15, hours: 12, minutes: 0 });
  
  const mockTicket: ServiceTicket = {
    id: 'ticket-123',
    ticket_number: 'JI-SRV-2026-001',
    intake_channel: 'MANUAL',
    site_address: 'Dubai Mall',
    system: 'CCTV',
    title: 'Camera offline',
    description: 'Main entrance camera offline',
    reported_by_name: 'Client PM',
    reported_by_phone: '+971500000000',
    priority: 'MEDIUM',
    coverage: 'COVERED',
    sla_response_due: responseTime.toISOString(),
    sla_resolution_due: resolutionTime.toISOString(),
    sla_pause_total_minutes: 0,
    status: 'NEW',
    parts_used: [],
    created_by: 'user-1',
    created_at: start1.toISOString(),
    updated_at: start1.toISOString()
  };

  // Pause at Sunday 7th June 10:00 GST
  const pauseTime = fromGSTParts({ year: 2026, month: 5, date: 7, hours: 10, minutes: 0 });
  const pausedTicketFields = pauseSLATimer(mockTicket, pauseTime);
  
  const ticketAfterPause: ServiceTicket = {
    ...mockTicket,
    ...pausedTicketFields
  };

  assert('Pause Timer fields set correctly', ticketAfterPause.sla_paused_at === pauseTime.toISOString() && ticketAfterPause.status === 'ON_HOLD_PARTS');

  // Resume 45 minutes later (Sunday 7th June 10:45 GST)
  const resumeTime = fromGSTParts({ year: 2026, month: 5, date: 7, hours: 10, minutes: 45 });
  const { updatedFields, addedMinutes } = resumeSLATimer(ticketAfterPause, resumeTime);
  
  assert('Added minutes matches pause duration', addedMinutes === 45);
  assert('Pause total minutes accumulated', updatedFields.sla_pause_total_minutes === 45);

  const ticketAfterResume: ServiceTicket = {
    ...ticketAfterPause,
    ...updatedFields
  };

  const extendedResponse = new Date(ticketAfterResume.sla_response_due);
  const extendedResolution = new Date(ticketAfterResume.sla_resolution_due);

  const extendedResponseParts = getGSTParts(extendedResponse);
  assert(
    'Extended Response Due incorporates pause duration',
    extendedResponseParts.date === 9 && extendedResponseParts.hours === 13 && extendedResponseParts.minutes === 45
  );

  // Test Case 4: SLA Breach checking
  // Check breach state before response due -> should not be breached
  const checkTimeBefore = fromGSTParts({ year: 2026, month: 5, date: 9, hours: 13, minutes: 0 });
  const breachBefore = evaluateSLABreach(ticketAfterResume, checkTimeBefore);
  assert('No breach before deadline', !breachBefore.responseBreached && !breachBefore.resolutionBreached);

  // Check breach state after response due -> should be breached
  const checkTimeAfter = fromGSTParts({ year: 2026, month: 5, date: 9, hours: 14, minutes: 0 });
  const breachAfter = evaluateSLABreach(ticketAfterResume, checkTimeAfter);
  assert('Response breached after deadline', breachAfter.responseBreached === true);

  if (failures === 0) {
    console.log('🎉 All SLA Service unit tests passed successfully!');
  } else {
    console.error(`💥 SLA Service tests failed with ${failures} errors.`);
    process.exit(1);
  }
}

runTests();
