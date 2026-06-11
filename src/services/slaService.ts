// ============================================================
// JEET ERP — SLA Management Service
// Handles SLA calculation, timer pauses on parts-hold,
// and SLA breach checks (holidays and business hours aware).
// ============================================================

import { addBusinessHours } from './businessTime';
import { SLA_TIER_CONFIGS, EMERGENCY_SLA_CONFIG } from '@/constants/amc.constants';
import type { SLATier } from '@/types/amc.types';
import type { ServiceTicket, TicketPriority } from '@/types/ticket.types';

/**
 * Calculates Response and Resolution SLA deadlines for a ticket.
 * 
 * - EMERGENCY priority tickets bypass business hours and holidays (24/7 calendar clock).
 * - Other priorities respect business hours (08:00 - 18:00, Sun-Thu) and company holidays.
 * - If contract has custom response/resolution hours, those are used instead of tier defaults.
 */
export function calculateSLADeadlines(
  params: {
    priority: TicketPriority;
    sla_tier?: SLATier;
    contract_response_hours?: number;
    contract_resolution_hours?: number;
  },
  startTime: Date,
  holidays: string[] = []
): { responseDue: Date; resolutionDue: Date } {
  const { priority, sla_tier = 'STANDARD', contract_response_hours, contract_resolution_hours } = params;

  if (priority === 'EMERGENCY') {
    // 24/7 calendar calculation - bypass businessTime
    const responseHrs = EMERGENCY_SLA_CONFIG.response_hours;
    const resolutionHrs = EMERGENCY_SLA_CONFIG.resolution_hours;

    const responseDue = new Date(startTime.getTime() + responseHrs * 60 * 60 * 1000);
    const resolutionDue = new Date(startTime.getTime() + resolutionHrs * 60 * 60 * 1000);

    return { responseDue, resolutionDue };
  }

  // Get defaults based on SLA Tier
  const defaults = SLA_TIER_CONFIGS[sla_tier] || SLA_TIER_CONFIGS.STANDARD;

  // Determine hours to add, preferring contract overrides
  const responseHours = contract_response_hours ?? defaults.response_hours;
  const resolutionHours = contract_resolution_hours ?? defaults.resolution_hours;

  // Standard business time calculations
  const responseDue = addBusinessHours(startTime, responseHours, holidays);
  const resolutionDue = addBusinessHours(startTime, resolutionHours, holidays);

  return { responseDue, resolutionDue };
}

/**
 * Pauses SLA timers when a ticket goes on hold (e.g. status changes to ON_HOLD_PARTS).
 */
export function pauseSLATimer(ticket: ServiceTicket, pauseTime: Date = new Date()): Partial<ServiceTicket> {
  return {
    sla_paused_at: pauseTime.toISOString(),
    status: 'ON_HOLD_PARTS'
  };
}

/**
 * Resumes SLA timers when a ticket resumes (e.g. status changes back to IN_PROGRESS).
 * Calculates the pause duration and extends the due dates accordingly.
 */
export function resumeSLATimer(
  ticket: ServiceTicket,
  resumeTime: Date = new Date()
): {
  updatedFields: Partial<ServiceTicket>;
  addedMinutes: number;
} {
  if (!ticket.sla_paused_at) {
    return {
      updatedFields: {},
      addedMinutes: 0
    };
  }

  const pausedAt = new Date(ticket.sla_paused_at);
  const diffMs = resumeTime.getTime() - pausedAt.getTime();
  const addedMinutes = Math.max(0, Math.floor(diffMs / 60000));

  const currentPauseTotal = ticket.sla_pause_total_minutes || 0;
  const newPauseTotal = currentPauseTotal + addedMinutes;

  const responseDue = new Date(ticket.sla_response_due);
  const resolutionDue = new Date(ticket.sla_resolution_due);

  const extendedResponseDue = new Date(responseDue.getTime() + addedMinutes * 60 * 1000);
  const extendedResolutionDue = new Date(resolutionDue.getTime() + addedMinutes * 60 * 1000);

  return {
    updatedFields: {
      sla_paused_at: null,
      sla_pause_total_minutes: newPauseTotal,
      sla_response_due: extendedResponseDue.toISOString(),
      sla_resolution_due: extendedResolutionDue.toISOString()
    },
    addedMinutes
  };
}

/**
 * Evaluates whether SLA response or resolution is breached.
 * Takes current time or a specific check time and compares to the due dates.
 */
export function evaluateSLABreach(
  ticket: ServiceTicket,
  checkTime: Date = new Date()
): {
  responseBreached: boolean;
  resolutionBreached: boolean;
} {
  // If the SLA is paused, we compare against the paused state to avoid ticking during pause
  const effectiveTime = ticket.sla_paused_at ? new Date(ticket.sla_paused_at) : checkTime;

  const responseDue = new Date(ticket.sla_response_due);
  const resolutionDue = new Date(ticket.sla_resolution_due);

  // If response is already met, it can't be breached now. Otherwise, check if current time has passed due
  const responseBreached = ticket.response_met === true 
    ? false 
    : (ticket.response_met === false || effectiveTime.getTime() > responseDue.getTime());

  // If resolution is already met, it can't be breached.
  const resolutionBreached = ticket.resolution_met === true
    ? false
    : (ticket.resolution_met === false || effectiveTime.getTime() > resolutionDue.getTime());

  return {
    responseBreached,
    resolutionBreached
  };
}

/**
 * Formats a remaining time interval in a human-readable HH:MM:SS format.
 * Returns negative if breached.
 */
export function formatSLARemainingTime(dueTimeISO: string, pausedAtISO?: string | null): {
  text: string;
  isBreached: boolean;
  totalSeconds: number;
} {
  const due = new Date(dueTimeISO).getTime();
  const current = pausedAtISO ? new Date(pausedAtISO).getTime() : Date.now();
  const diffMs = due - current;
  const isBreached = diffMs < 0;

  const totalSeconds = Math.round(Math.abs(diffMs) / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const hStr = String(hours).padStart(2, '0');
  const mStr = String(minutes).padStart(2, '0');
  const sStr = String(seconds).padStart(2, '0');

  return {
    text: `${isBreached ? '-' : ''}${hStr}:${mStr}:${sStr}`,
    isBreached,
    totalSeconds: isBreached ? -totalSeconds : totalSeconds
  };
}
