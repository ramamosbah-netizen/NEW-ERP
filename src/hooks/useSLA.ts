// ============================================================
// JEET ERP — SLA Countdown React Hook
// Feeds live countdown timers for response and resolution SLAs.
// ============================================================

import { useState, useEffect } from 'react';
import { formatSLARemainingTime } from '@/services/slaService';
import type { ServiceTicket } from '@/types/ticket.types';

export function useSLA(ticket: ServiceTicket | null) {
  const [responseTimer, setResponseTimer] = useState({ text: '--:--:--', isBreached: false, totalSeconds: 0 });
  const [resolutionTimer, setResolutionTimer] = useState({ text: '--:--:--', isBreached: false, totalSeconds: 0 });

  useEffect(() => {
    if (!ticket) return;

    const updateTimers = () => {
      const isPaused = !!ticket.sla_paused_at;
      const pausedAt = ticket.sla_paused_at;

      // --- Response SLA Clock ---
      if (ticket.response_met === true) {
        setResponseTimer({ text: 'MET', isBreached: false, totalSeconds: 0 });
      } else if (ticket.response_met === false) {
        setResponseTimer({ text: 'BREACHED', isBreached: true, totalSeconds: 0 });
      } else {
        // Still active
        const remaining = formatSLARemainingTime(ticket.sla_response_due, pausedAt);
        setResponseTimer({
          ...remaining,
          text: isPaused ? `${remaining.text} (PAUSED)` : remaining.text
        });
      }

      // --- Resolution SLA Clock ---
      if (ticket.status === 'RESOLVED' || ticket.status === 'CLOSED') {
        if (ticket.resolution_met === true) {
          setResolutionTimer({ text: 'MET', isBreached: false, totalSeconds: 0 });
        } else {
          setResolutionTimer({ text: 'BREACHED', isBreached: true, totalSeconds: 0 });
        }
      } else {
        // Still active
        const remaining = formatSLARemainingTime(ticket.sla_resolution_due, pausedAt);
        setResolutionTimer({
          ...remaining,
          text: isPaused ? `${remaining.text} (PAUSED)` : remaining.text
        });
      }
    };

    updateTimers();
    const interval = setInterval(updateTimers, 1000);

    return () => clearInterval(interval);
  }, [
    ticket?.id,
    ticket?.status,
    ticket?.sla_paused_at,
    ticket?.sla_response_due,
    ticket?.sla_resolution_due,
    ticket?.response_met,
    ticket?.resolution_met
  ]);

  return {
    responseTimer,
    resolutionTimer
  };
}
export default useSLA;
