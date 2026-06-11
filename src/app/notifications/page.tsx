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
              <Bell className="text-emerald-400" size={26} />
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
        <div className="quote-card py-4 flex justify-between items-center bg-slate-900/25 border border-slate-900/60">
          <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
            <span>SHOWING LOG FEED:</span>
            <span className="px-1.5 py-0.5 rounded bg-slate-900 text-emerald-400 font-bold border border-slate-800">
              {notifications.length} EVENTS RECORDED
            </span>
            {unreadCount > 0 && (
              <span className="px-1.5 py-0.5 rounded bg-slate-900 text-amber-500 font-bold border border-slate-800">
                {unreadCount} PENDING ACTION
              </span>
            )}
          </div>
          <button
            onClick={refetch}
            className="text-slate-500 hover:text-emerald-400 transition-colors p-1"
            title="Reload alerts"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        {/* Notifications list registry */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <RefreshCw className="animate-spin text-emerald-400" size={32} />
            <span className="text-slate-400 font-mono text-sm">SYNCING ALERT CHANNELS...</span>
          </div>
        ) : error ? (
          <div className="p-4 bg-red-950/20 border border-red-500/10 text-red-300 rounded-xl text-center text-xs">
            Failed to sync notification logs: {error.message}
          </div>
        ) : notifications.length === 0 ? (
          <div className="quote-card py-20 text-center text-slate-500 text-sm">
            <Bell size={48} className="mx-auto mb-4 opacity-10 text-slate-400" />
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
                        className={`cursor-pointer border-b border-slate-900/60 ${
                          isUnread ? 'bg-slate-900/15 hover:bg-slate-900/35 font-semibold' : 'hover:bg-slate-900/15 opacity-75'
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
                          <div className={`text-xs ${isUnread ? 'text-slate-100 font-bold' : 'text-slate-300'}`}>
                            {n.title}
                          </div>
                          <div className="text-[10px] text-slate-500 mt-0.5 leading-normal max-w-2xl">{n.body}</div>
                        </td>
                        <td className="py-4 text-[10px] font-mono text-slate-400">
                          {n.channel}
                        </td>
                        <td className="py-4 font-mono text-[10px] text-slate-400">
                          <div className="flex items-center gap-1">
                            <Clock size={10} className="text-slate-650" />
                            {formatDate(n.created_at)} @ {formatTime(n.created_at)}
                          </div>
                        </td>
                        <td className="py-4">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold border ${
                            n.status === 'READ' || n.status === 'ACTIONED'
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/15'
                              : n.status === 'FAILED'
                              ? 'bg-red-500/10 text-red-400 border-red-500/15'
                              : 'bg-amber-500/10 text-amber-400 border-amber-500/15'
                          }`}>
                            {n.status}
                          </span>
                        </td>
                        <td className="py-4 text-center">
                          {n.link ? (
                            <ExternalLink size={12} className="text-slate-500 hover:text-emerald-400 transition-colors mx-auto" />
                          ) : (
                            <Eye size={12} className="text-slate-600 mx-auto" />
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
