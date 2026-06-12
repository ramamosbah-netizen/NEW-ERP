// ============================================================
// JEET ERP — Notification Styles and Default Configuration
// ============================================================

import type { NotificationSeverity, NotificationChannel } from '@/types/notification.types';

export const SEVERITY_CONFIG: Record<NotificationSeverity, {
  label: string;
  color: string;
  bg: string;
  border: string;
}> = {
  INFO: {
    label: 'Info',
    color: '#3b82f6', // Electric Mint
    bg: 'color-mix(in srgb, var(--primary) 8%, transparent)',
    border: 'color-mix(in srgb, var(--primary) 20%, transparent)'
  },
  ACTION_REQUIRED: {
    label: 'Action Required',
    color: '#F59E0B', // Amber
    bg: 'rgba(245, 158, 11, 0.08)',
    border: 'rgba(245, 158, 11, 0.2)'
  },
  CRITICAL: {
    label: 'Critical',
    color: '#EF4444', // Red
    bg: 'rgba(239, 68, 68, 0.08)',
    border: 'rgba(239, 68, 68, 0.2)'
  }
};

export const CHANNELS: Record<NotificationChannel, {
  label: string;
  badgeBg: string;
}> = {
  IN_APP: {
    label: 'In App',
    badgeBg: 'color-mix(in srgb, var(--primary) 15%, transparent)' // Cyan
  },
  EMAIL: {
    label: 'Email',
    badgeBg: 'color-mix(in srgb, var(--accent) 15%, transparent)' // Purple
  },
  WHATSAPP: {
    label: 'WhatsApp',
    badgeBg: 'rgba(16, 185, 129, 0.15)' // Green
  }
};
