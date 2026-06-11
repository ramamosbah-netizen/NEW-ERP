// ============================================================
// JEET ERP — Project Status State Machine & Rules
// Pure functions for state validation and transition rules
// ============================================================

import type { Project, ProjectStatus } from '../types/project.types';

// Map of valid transitions
const VALID_TRANSITIONS: Record<ProjectStatus, ProjectStatus[]> = {
  SUBMITTED: ['MOBILIZATION', 'LOST', 'CANCELLED'],
  MOBILIZATION: ['IN_PROGRESS', 'ON_HOLD', 'CANCELLED'],
  IN_PROGRESS: ['TESTING', 'ON_HOLD', 'CANCELLED'],
  TESTING: ['HANDOVER', 'ON_HOLD', 'CANCELLED'],
  HANDOVER: ['DLP', 'ON_HOLD', 'CANCELLED'],
  DLP: ['CLOSED', 'ON_HOLD'],
  ON_HOLD: ['MOBILIZATION', 'IN_PROGRESS', 'TESTING', 'HANDOVER', 'DLP'], // can resume to prior state
  CLOSED: [],    // terminal
  CANCELLED: [],  // terminal
  LOST: []       // terminal
};

/**
 * Returns a list of next statuses that are logically permitted from the current status.
 */
export function getValidTransitions(currentStatus: ProjectStatus): ProjectStatus[] {
  return VALID_TRANSITIONS[currentStatus] || [];
}

/**
 * Validates whether a transition from one status to another is allowed, and checks gate conditions.
 */
export function validateTransition(
  from: ProjectStatus,
  to: ProjectStatus,
  project: Partial<Project>
): { valid: boolean; error?: string } {
  // 1. Basic transition rule check
  const allowed = getValidTransitions(from);
  if (!allowed.includes(to)) {
    return {
      valid: false,
      error: `Transition from ${from} to ${to} is not allowed.`
    };
  }

  // 2. Business rules / Gates
  if (to === 'HANDOVER') {
    // Requires site testing results, or check documents in DMS (handled by UI/controller but check basic date rules)
    if (!project.actual_end_date && !project.planned_end_date) {
      return {
        valid: false,
        error: 'Handover requires a planned or actual end date.'
      };
    }
  }

  if (to === 'DLP') {
    // DLP requires the start of DLP (handover date) and DLP months
    if (!project.dlp_start_date) {
      return {
        valid: false,
        error: 'DLP status requires a DLP start date (Handover date).'
      };
    }
  }

  if (to === 'CLOSED') {
    // Closed requires DLP to be finished or verified (e.g. current date > dlp_end_date)
    if (project.dlp_end_date) {
      const dlpEnd = new Date(project.dlp_end_date);
      const today = new Date();
      if (dlpEnd > today) {
        return {
          valid: false,
          error: `Project cannot be closed until DLP period expires on ${new Date(project.dlp_end_date).toLocaleDateString('en-GB')}.`
        };
      }
    }
  }

  if (to === 'ON_HOLD') {
    if (!project.on_hold_reason || project.on_hold_reason.trim() === '') {
      return {
        valid: false,
        error: 'Reason for putting the project on hold is required.'
      };
    }
  }

  if (to === 'CANCELLED') {
    if (!project.cancel_reason || project.cancel_reason.trim() === '') {
      return {
        valid: false,
        error: 'Cancellation reason is required.'
      };
    }
  }

  if (to === 'LOST') {
    if (!project.cancel_reason || project.cancel_reason.trim() === '') {
      return {
        valid: false,
        error: 'Reason for losing/rejection is required.'
      };
    }
  }

  return { valid: true };
}

/**
 * Checks if the DLP period of the project is expiring within a given number of days.
 */
export function getDLPExpiryStatus(project: Project): { expiringSoon: boolean; daysRemaining: number } {
  if (project.status !== 'DLP' || !project.dlp_end_date) {
    return { expiringSoon: false, daysRemaining: 999 };
  }

  const dlpEnd = new Date(project.dlp_end_date);
  const today = new Date();
  const diffTime = dlpEnd.getTime() - today.getTime();
  const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  // Expiring soon if within 60 days
  return {
    expiringSoon: daysRemaining <= 60 && daysRemaining >= 0,
    daysRemaining
  };
}
