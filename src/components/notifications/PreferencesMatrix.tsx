// ============================================================
// JEET ERP — User Notification Preferences Matrix
// ============================================================

'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { notificationService } from '@/services/notificationService';
import type { UserNotificationPreference, NotificationChannel, NotificationPreferenceMode } from '@/types/notification.types';
import { Mail, MessageSquare, Bell, Save, Check, RefreshCw } from 'lucide-react';

const MODULES = [
  { key: 'quotation', label: 'Quotation Management', desc: 'Approvals, submissions, client acceptance' },
  { key: 'comparison', label: 'Supplier Comparisons', desc: 'Approvals and comparison submissions' },
  { key: 'project', label: 'Project Master', desc: 'Project creations, status transitions, DLP notices' },
  { key: 'document', label: 'Document Management (DMS)', desc: 'AI reviews, upload notifications, expiry warnings' },
  { key: 'task', label: 'Task Management', desc: 'Assignments, due soon and overdue tasks' },
  { key: 'meeting', label: 'Meetings & Minutes', desc: 'Schedules, starting notices, minutes publications' },
  { key: 'approval', label: 'Escalations', desc: 'Approval escalation alerts and SLA warnings' }
];

const CHANNELS: { key: NotificationChannel; label: string; Icon: any }[] = [
  { key: 'IN_APP', label: 'In-App Bell', Icon: Bell },
  { key: 'EMAIL', label: 'Email Alerts', Icon: Mail },
  { key: 'WHATSAPP', label: 'WhatsApp', Icon: MessageSquare }
];

export const PreferencesMatrix: React.FC = () => {
  const [preferences, setPreferences] = useState<UserNotificationPreference[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingState, setSavingState] = useState<Record<string, 'idle' | 'saving' | 'saved'>>({});
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        setUserId(user.id);
        
        const prefs = await notificationService.fetchPreferences(user.id);
        setPreferences(prefs);
      } catch (err) {
        console.error('Failed to load preferences:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const getPreferenceMode = (module: string, channel: NotificationChannel): NotificationPreferenceMode => {
    const pref = preferences.find(p => p.event_module === module && p.channel === channel);
    return pref ? pref.mode : 'INSTANT'; // default to instant
  };

  const handlePreferenceChange = async (module: string, channel: NotificationChannel, mode: NotificationPreferenceMode) => {
    if (!userId) return;
    
    const key = `${module}-${channel}`;
    setSavingState(prev => ({ ...prev, [key]: 'saving' }));

    try {
      await notificationService.updatePreference(userId, module, channel, mode);
      
      // Update local state
      setPreferences(prev => {
        const existingIdx = prev.findIndex(p => p.event_module === module && p.channel === channel);
        if (existingIdx >= 0) {
          const updated = [...prev];
          updated[existingIdx] = { ...updated[existingIdx], mode };
          return updated;
        } else {
          return [...prev, { user_id: userId, event_module: module, channel, mode }];
        }
      });

      setSavingState(prev => ({ ...prev, [key]: 'saved' }));
      setTimeout(() => {
        setSavingState(prev => ({ ...prev, [key]: 'idle' }));
      }, 1500);
    } catch (err) {
      console.error('Failed to update preference:', err);
      setSavingState(prev => ({ ...prev, [key]: 'idle' }));
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <RefreshCw className="animate-spin text-[var(--accent)]" size={32} />
        <span className="text-[var(--text-secondary)] font-mono text-sm">LOADING MATRICES...</span>
      </div>
    );
  }

  return (
    <div className="quote-card overflow-hidden">
      <div className="quote-card-header">
        <div>
          <h2 className="quote-card-title">Preference Matrices</h2>
          <p className="quote-header-subtitle">Set channels and delivery modes per module. Default is Instant.</p>
        </div>
      </div>

      <div className="quote-table-wrap">
        <table className="quote-table">
          <thead>
            <tr>
              <th className="w-1/3">ERP Module</th>
              {CHANNELS.map(ch => (
                <th key={ch.key} className="text-center font-mono">
                  <div className="flex items-center justify-center gap-1.5">
                    <ch.Icon size={14} className="text-[var(--text-secondary)]" />
                    {ch.label}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MODULES.map(mod => (
              <tr key={mod.key} className="border-b border-[var(--border)]">
                <td className="py-4">
                  <div className="font-semibold text-[var(--text-primary)]">{mod.label}</div>
                  <div className="text-xs text-[var(--text-muted)] mt-0.5">{mod.desc}</div>
                </td>
                {CHANNELS.map(ch => {
                  const mode = getPreferenceMode(mod.key, ch.key);
                  const stateKey = `${mod.key}-${ch.key}`;
                  const state = savingState[stateKey] || 'idle';

                  return (
                    <td key={ch.key} className="py-4 text-center">
                      <div className="inline-flex items-center justify-center gap-1.5">
                        <select
                          value={mode}
                          onChange={(e) => handlePreferenceChange(mod.key, ch.key, e.target.value as NotificationPreferenceMode)}
                          className="bg-[var(--bg-card)] border border-[var(--border)] rounded px-2 py-1 text-xs text-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] transition-all font-mono"
                        >
                          <option value="INSTANT">⚡ Instant</option>
                          <option value="DIGEST">📭 Daily Digest</option>
                          <option value="OFF">🔕 Off</option>
                        </select>
                        <span className="w-4 h-4 inline-flex items-center justify-center">
                          {state === 'saving' && <RefreshCw size={10} className="animate-spin text-[var(--text-muted)]" />}
                          {state === 'saved' && <Check size={10} className="text-[var(--accent)] animate-pulse" />}
                        </span>
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PreferencesMatrix;
