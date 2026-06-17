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
          bg: 'color-mix(in srgb, var(--primary) 12%, transparent)',
          text: '#3b82f6',
          border: 'color-mix(in srgb, var(--primary) 25%, transparent)',
          Icon: Info
        };
    }
  };

  return (
    <div className="relative z-50" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg bg-[var(--surface-hover)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--accent)] hover:border-[var(--accent)] transition-all focus:outline-none"
        aria-label="Notifications"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--accent)] text-[10px] font-bold text-white animate-pulse">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-xl bg-[var(--bg-card)] backdrop-blur-xl border border-[var(--border)] shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-250">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] bg-[var(--surface-hover)]">
            <h3 className="font-semibold text-[var(--text-primary)] text-sm flex items-center gap-1.5">
              Notifications
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.5 rounded text-[10px] bg-[var(--surface-hover)] text-[var(--accent)] border border-[var(--accent)] font-mono">
                  {unreadCount} UNREAD
                </span>
              )}
            </h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="text-xs text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors flex items-center gap-1"
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
                className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                title="Preferences"
              >
                <Settings size={14} />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="max-height-[320px] overflow-y-auto divide-y divide-[var(--border)] custom-scrollbar max-h-[350px]">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-[var(--text-muted)] text-sm">
                <Bell size={32} className="mx-auto mb-2 opacity-20 text-[var(--text-secondary)]" />
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
                      isUnread ? 'bg-[var(--surface-hover)] hover:bg-[var(--surface-hover)]' : 'hover:bg-[var(--surface-hover)] opacity-70'
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
                        <span className={`text-xs font-semibold truncate ${isUnread ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}`}>
                          {n.title}
                        </span>
                        {n.link && <ExternalLink size={10} className="text-[var(--text-tertiary)] flex-shrink-0" />}
                      </div>
                      <p className="text-xs text-[var(--text-secondary)] line-clamp-2 mt-1 leading-relaxed">
                        {n.body}
                      </p>
                      <span className="text-[10px] text-[var(--text-muted)] font-mono mt-1.5 block">
                        {new Date(n.created_at).toLocaleDateString('en-GB')} {new Date(n.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    {isUnread && (
                      <div className="flex-shrink-0 self-center">
                        <div className="h-1.5 w-1.5 rounded-full bg-[var(--accent)] shadow-[0_0_6px_var(--primary)]" />
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-[var(--border)] bg-[var(--surface-hover)] px-4 py-2.5 text-center">
            <button
              onClick={() => {
                setIsOpen(false);
                router.push('/notifications');
              }}
              className="text-xs font-semibold text-[var(--accent)] hover:text-[var(--accent)] transition-colors inline-flex items-center gap-1"
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
