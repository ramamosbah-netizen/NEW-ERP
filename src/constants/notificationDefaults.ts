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
    color: '#00E5A0', // Electric Mint
    bg: 'rgba(0, 229, 160, 0.08)',
    border: 'rgba(0, 229, 160, 0.2)'
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
    badgeBg: 'rgba(34, 211, 238, 0.15)' // Cyan
  },
  EMAIL: {
    label: 'Email',
    badgeBg: 'rgba(168, 85, 247, 0.15)' // Purple
  },
  WHATSAPP: {
    label: 'WhatsApp',
    badgeBg: 'rgba(16, 185, 129, 0.15)' // Green
  }
};
