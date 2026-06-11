// ============================================================
// JEET ERP — Realtime Notification Bell Component
// ============================================================

'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, Check, ExternalLink, Settings, Info, AlertTriangle, ShieldAlert } from 'lucide-react';
import { useNotifications } from '@/hooks/useNotifications';
import type { Notification } from '@/types/notification.types';

export const NotificationBell: React.FC = () => {
  const router = useRouter();
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleNotificationClick = async (n: Notification) => {
    setIsOpen(false);
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
          bg: 'rgba(239, 68, 68, 0.15)',
          text: '#ef4444',
          border: 'rgba(239, 68, 68, 0.3)',
          Icon: ShieldAlert
        };
      case 'ACTION_REQUIRED':
        return {
          bg: 'rgba(245, 158, 11, 0.15)',
          text: '#f59e0b',
          border: 'rgba(245, 158, 11, 0.3)',
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

  return (
    <div className="relative z-50" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg bg-slate-900/60 border border-slate-800 text-slate-400 hover:text-emerald-400 hover:border-emerald-500/30 transition-all focus:outline-none"
        aria-label="Notifications"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-[10px] font-bold text-slate-950 animate-pulse">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-xl bg-slate-950/95 backdrop-blur-xl border border-slate-800 shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-250">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-900/50">
            <h3 className="font-semibold text-slate-200 text-sm flex items-center gap-1.5">
              Notifications
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 text-emerald-400 border border-emerald-500/20 font-mono">
                  {unreadCount} UNREAD
                </span>
              )}
            </h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="text-xs text-slate-400 hover:text-emerald-400 transition-colors flex items-center gap-1"
                  title="Mark all as read"
                >
                  <Check size={14} />
                  Clear All
                </button>
              )}
              <button
                onClick={() => {
                  setIsOpen(false);
                  router.push('/notifications/preferences');
                }}
                className="text-slate-400 hover:text-slate-200 transition-colors"
                title="Preferences"
              >
                <Settings size={14} />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="max-height-[320px] overflow-y-auto divide-y divide-slate-900/60 custom-scrollbar max-h-[350px]">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-slate-500 text-sm">
                <Bell size={32} className="mx-auto mb-2 opacity-20 text-slate-400" />
                All caught up! No notifications.
              </div>
            ) : (
              notifications.slice(0, 10).map((n) => {
                const isUnread = ['PENDING', 'SENT', 'DELIVERED'].includes(n.status);
                const styles = getSeverityStyles(n.severity);
                const SeverityIcon = styles.Icon;

                return (
                  <div
                    key={n.id}
                    onClick={() => handleNotificationClick(n)}
                    className={`p-3.5 transition-colors cursor-pointer text-left flex gap-3 ${
                      isUnread ? 'bg-slate-900/30 hover:bg-slate-900/70' : 'hover:bg-slate-900/40 opacity-70'
                    }`}
                  >
                    <div
                      className="flex-shrink-0 h-8 w-8 rounded-lg border flex items-center justify-center mt-0.5"
                      style={{
                        backgroundColor: styles.bg,
                        color: styles.text,
                        borderColor: styles.border
                      }}
                    >
                      <SeverityIcon size={16} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className={`text-xs font-semibold truncate ${isUnread ? 'text-slate-200' : 'text-slate-400'}`}>
                          {n.title}
                        </span>
                        {n.link && <ExternalLink size={10} className="text-slate-600 flex-shrink-0" />}
                      </div>
                      <p className="text-xs text-slate-400 line-clamp-2 mt-1 leading-relaxed">
                        {n.body}
                      </p>
                      <span className="text-[10px] text-slate-500 font-mono mt-1.5 block">
                        {new Date(n.created_at).toLocaleDateString('en-GB')} {new Date(n.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    {isUnread && (
                      <div className="flex-shrink-0 self-center">
                        <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#00E5A0]" />
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-slate-800 bg-slate-900/30 px-4 py-2.5 text-center">
            <button
              onClick={() => {
                setIsOpen(false);
                router.push('/notifications');
              }}
              className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition-colors inline-flex items-center gap-1"
            >
              View All Notifications
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
