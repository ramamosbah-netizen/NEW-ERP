// ============================================================
// JEET ERP — Alert Notifications Center Logs
// Route: /notifications
// ============================================================

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useNotifications } from '@/hooks/useNotifications';
import { 
  Bell, 
  Settings, 
  Check, 
  ExternalLink, 
  ShieldAlert, 
  AlertTriangle, 
  Info,
  Clock,
  RefreshCw,
  Eye,
  Sliders
} from 'lucide-react';
import type { Notification } from '@/types/notification.types';

export default function NotificationsCenterPage() {
  const router = useRouter();
  const { notifications, unreadCount, loading, error, refetch, markRead, markAllRead } = useNotifications();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) router.replace('/signin');
    });
  }, [router]);

  const handleNotificationClick = async (n: Notification) => {
    if (['PENDING', 'SENT', 'DELIVERED'].includes(n.status)) {
      await markRead(n.id, n.severity === 'ACTION_REQUIRED');
    }
    if (n.link) {
      router.push(n.link);
    }
  };

  const getSeverityStyles = (severity: string) => {
    switch (severity) {
      case 'CRITICAL':
        return {
          bg: 'rgba(239, 68, 68, 0.12)',
          text: '#ef4444',
          border: 'rgba(239, 68, 68, 0.25)',
          Icon: ShieldAlert
        };
      case 'ACTION_REQUIRED':
        return {
          bg: 'rgba(245, 158, 11, 0.12)',
          text: '#f59e0b',
          border: 'rgba(245, 158, 11, 0.25)',
          Icon: AlertTriangle
        };
      default:
        return {
          bg: 'rgba(34, 211, 238, 0.12)',
          text: '#22d3ee',
          border: 'rgba(34, 211, 238, 0.25)',
          Icon: Info
        };
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  };

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="flex flex-col min-h-screen w-full relative z-10">
<main className="quote-container flex-1 py-8 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h1 className="quote-header-title flex items-center gap-2">
              <Bell className="text-[var(--accent)]" size={26} />
              Alert Notifications Center
            </h1>
            <p className="quote-header-subtitle">Realtime feed and audit trail of platform events, approvals, and escalations.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push('/notifications/preferences')}
              className="quote-btn quote-btn-secondary text-xs flex items-center gap-1.5"
            >
              <Sliders size={14} />
              Preferences Matrix
            </button>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="quote-btn quote-btn-primary text-xs flex items-center gap-1.5 font-bold"
              >
                <Check size={14} />
                Clear All Unread
              </button>
            )}
          </div>
        </div>

        {/* Filters and Search Display */}
        <div className="quote-card py-4 flex justify-between items-center bg-[var(--surface-hover)] border border-[var(--border)]">
          <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)] font-mono">
            <span>SHOWING LOG FEED:</span>
            <span className="px-1.5 py-0.5 rounded bg-[var(--surface-hover)] text-[var(--accent)] font-bold border border-[var(--border)]">
              {notifications.length} EVENTS RECORDED
            </span>
            {unreadCount > 0 && (
              <span className="px-1.5 py-0.5 rounded bg-[var(--surface-hover)] text-[var(--status-warning-text)] font-bold border border-[var(--border)]">
                {unreadCount} PENDING ACTION
              </span>
            )}
          </div>
          <button
            onClick={() => refetch()}
            className="text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors p-1"
            title="Reload alerts"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        {/* Notifications list registry */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <RefreshCw className="animate-spin text-[var(--accent)]" size={32} />
            <span className="text-[var(--text-secondary)] font-mono text-sm">SYNCING ALERT CHANNELS...</span>
          </div>
        ) : error ? (
          <div className="p-4 bg-[var(--status-danger-bg)] border border-[var(--status-danger-border)] text-[var(--status-danger-text)] rounded-xl text-center text-xs">
            Failed to sync notification logs: {error.message}
          </div>
        ) : notifications.length === 0 ? (
          <div className="quote-card py-20 text-center text-[var(--text-muted)] text-sm">
            <Bell size={48} className="mx-auto mb-4 opacity-10 text-[var(--text-secondary)]" />
            No alerts logged. System channel is healthy.
          </div>
        ) : (
          <div className="quote-card p-0 overflow-hidden">
            <div className="quote-table-wrap">
              <table className="quote-table">
                <thead>
                  <tr>
                    <th className="w-10 text-center">Type</th>
                    <th>Alert Notification Details</th>
                    <th>Channel</th>
                    <th>Date & Time</th>
                    <th>Status</th>
                    <th className="w-12 text-center">Open</th>
                  </tr>
                </thead>
                <tbody>
                  {notifications.map(n => {
                    const isUnread = ['PENDING', 'SENT', 'DELIVERED'].includes(n.status);
                    const styles = getSeverityStyles(n.severity);
                    const SeverityIcon = styles.Icon;

                    return (
                      <tr
                        key={n.id}
                        onClick={() => handleNotificationClick(n)}
                        className={`cursor-pointer border-b border-[var(--border)] ${
                          isUnread ? 'bg-[var(--surface-hover)] hover:bg-[var(--surface-hover)] font-semibold' : 'hover:bg-[var(--surface-hover)] opacity-75'
                        }`}
                      >
                        <td className="py-4 text-center">
                          <div
                            className="h-8 w-8 rounded-lg border flex items-center justify-center mx-auto"
                            style={{
                              backgroundColor: styles.bg,
                              color: styles.text,
                              borderColor: styles.border
                            }}
                          >
                            <SeverityIcon size={16} />
                          </div>
                        </td>
                        <td className="py-4">
                          <div className={`text-xs ${isUnread ? 'text-[var(--text-primary)] font-bold' : 'text-[var(--text-secondary)]'}`}>
                            {n.title}
                          </div>
                          <div className="text-[10px] text-[var(--text-muted)] mt-0.5 leading-normal max-w-2xl">{n.body}</div>
                        </td>
                        <td className="py-4 text-[10px] font-mono text-[var(--text-secondary)]">
                          {n.channel}
                        </td>
                        <td className="py-4 font-mono text-[10px] text-[var(--text-secondary)]">
                          <div className="flex items-center gap-1">
                            <Clock size={10} className="text-[var(--text-tertiary)]" />
                            {formatDate(n.created_at)} @ {formatTime(n.created_at)}
                          </div>
                        </td>
                        <td className="py-4">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold border ${
                            n.status === 'READ' || n.status === 'ACTIONED'
                              ? 'bg-[var(--accent-glow)] text-[var(--accent)] border-[var(--accent)]'
                              : n.status === 'FAILED'
                              ? 'bg-[var(--status-danger-bg)] text-[var(--status-danger-text)] border-[var(--status-danger-border)]'
                              : 'bg-[var(--status-warning-bg)] text-[var(--status-warning-text)] border-[var(--status-warning-border)]'
                          }`}>
                            {n.status}
                          </span>
                        </td>
                        <td className="py-4 text-center">
                          {n.link ? (
                            <ExternalLink size={12} className="text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors mx-auto" />
                          ) : (
                            <Eye size={12} className="text-[var(--text-tertiary)] mx-auto" />
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
