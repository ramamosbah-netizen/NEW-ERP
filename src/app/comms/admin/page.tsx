'use client';

// ============================================================
// JEET ERP — Communication Settings (admin)
// Channels management, integration status (email/WhatsApp/push)
// and posting permissions. Additive.
// ============================================================

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { commsService } from '@/services/commsService';
import type { Conversation } from '@/types/comms.types';
import { Hash, Plus, Mail, MessageCircle, Smartphone, Monitor, ExternalLink, ShieldCheck, Loader2, CheckCircle2, Circle } from 'lucide-react';

export default function CommsAdminPage() {
  const [channels, setChannels] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [meId, setMeId] = useState<string | null>(null);
  const [newName, setNewName] = useState(''); const [creating, setCreating] = useState(false);
  const [waConfigured, setWaConfigured] = useState(false);
  const [smtpConfigured, setSmtpConfigured] = useState(false);

  // User SMTP configurations (Admin-only)
  const [isAdmin, setIsAdmin] = useState(false);
  const [userSmtpConfigs, setUserSmtpConfigs] = useState<any[]>([]);
  const [directory, setDirectory] = useState<any[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState(587);
  const [smtpUsername, setSmtpUsername] = useState('');
  const [smtpPassword, setSmtpPassword] = useState('');
  const [smtpSenderEmail, setSmtpSenderEmail] = useState('');
  const [savingSmtp, setSavingSmtp] = useState(false);

  const loadSmtp = async () => {
    const configs = await commsService.getAllUserSmtpConfigs();
    setUserSmtpConfigs(configs);
    const dir = await commsService.getDirectory();
    setDirectory(dir);
  };

  const load = async () => {
    const { data } = await supabase.from('conversations').select('*').eq('type', 'CHANNEL').order('channel_key');
    setChannels((data || []) as Conversation[]); setLoading(false);
  };

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      const uid = data.user?.id || null;
      setMeId(uid);
      if (uid) {
        const { data: p } = await supabase.from('profiles').select('role').eq('id', uid).single();
        const role = p?.role === 'admin';
        setIsAdmin(role);
        if (role) {
          loadSmtp();
        }
      }
    });
    load();
    // detect existing integration config (best-effort, from settings store)
    supabase.from('settings').select('key, value').in('key', ['integrations.whatsapp_gateway', 'integrations.smtp_config']).then(({ data }) => {
      const m = new Map((data || []).map((r: any) => [r.key, r.value]));
      const wa: any = m.get('integrations.whatsapp_gateway'); const smtp: any = m.get('integrations.smtp_config');
      setWaConfigured(!!(wa && (wa.api_key || wa.token || wa.phone_number_id)));
      setSmtpConfigured(!!(smtp && (smtp.host || smtp.user)));
    }, () => {});
  }, []);

  const createChannel = async () => {
    const key = newName.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/^#/, '');
    if (!key) return; setCreating(true);
    const { error } = await supabase.from('conversations').insert({ type: 'CHANNEL', name: `#${key}`, channel_key: key, created_by: meId });
    setCreating(false);
    if (error) { alert('Could not create — apply the comms migration first, or the channel already exists.'); return; }
    setNewName(''); load();
  };

  const integrations = [
    { key: 'in_app', label: 'In-app', icon: Monitor, status: true, note: 'Always on — realtime via Supabase.', href: null },
    { key: 'email', label: 'Email (Outlook / Gmail / SMTP)', icon: Mail, status: smtpConfigured, note: smtpConfigured ? 'SMTP configured.' : 'Add SMTP / OAuth credentials to deliver email.', href: '/admin/settings/integrations' },
    { key: 'whatsapp', label: 'WhatsApp Business', icon: MessageCircle, status: waConfigured, note: waConfigured ? 'Gateway configured.' : 'Connect the WhatsApp Business gateway.', href: '/settings/whatsapp' },
    { key: 'push', label: 'Push notifications', icon: Smartphone, status: false, note: 'Register a web-push key to enable browser push.', href: '/admin/settings/integrations' },
  ];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Communication Settings" subtitle="Channels, delivery integrations and permissions"
        breadcrumbs={[{ label: 'Communication', href: '/comms' }, { label: 'Settings' }]} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Channels */}
        <Card className="p-4">
          <div className="text-sm font-semibold text-[var(--text-primary)] mb-3 flex items-center gap-1.5"><Hash size={15} /> Department channels</div>
          <div className="flex flex-col gap-1.5 mb-3">
            {loading ? <div className="text-xs text-[var(--text-tertiary)]">Loading…</div> : channels.map(c => (
              <div key={c.id} className="flex items-center justify-between p-2.5 rounded-lg border border-[var(--border)]">
                <span className="flex items-center gap-2 text-sm text-[var(--text-primary)]"><Hash size={14} className="text-[var(--accent)]" />{c.name}</span>
                <span className="text-[11px] text-[var(--text-tertiary)]">{c.description || c.channel_key}</span>
              </div>
            ))}
            {!loading && channels.length === 0 && <div className="text-xs text-[var(--text-tertiary)]">No channels yet — apply the comms migration to seed the defaults.</div>}
          </div>
          <div className="flex gap-2">
            <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="new-channel-name" className="flex-1 h-9 px-3 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] text-sm" />
            <Button variant="primary" icon={creating ? Loader2 : Plus} onClick={createChannel} disabled={!newName.trim() || creating}>Add</Button>
          </div>
        </Card>

        {/* Integrations */}
        <Card className="p-4">
          <div className="text-sm font-semibold text-[var(--text-primary)] mb-3 flex items-center gap-1.5"><Smartphone size={15} /> Delivery integrations</div>
          <div className="flex flex-col gap-2">
            {integrations.map(it => (
              <div key={it.key} className="flex items-start justify-between gap-3 p-3 rounded-lg border border-[var(--border)]">
                <div className="flex items-start gap-2.5 min-w-0">
                  <it.icon size={16} className="text-[var(--text-secondary)] mt-0.5 shrink-0" />
                  <div className="min-w-0"><div className="text-sm font-medium text-[var(--text-primary)] flex items-center gap-1.5">{it.label}{it.status ? <CheckCircle2 size={13} className="text-[var(--status-success-text)]" /> : <Circle size={13} className="text-[var(--text-tertiary)]" />}</div><div className="text-[11px] text-[var(--text-tertiary)] mt-0.5">{it.note}</div></div>
                </div>
                {it.href && <a href={it.href} className="text-xs text-[var(--accent)] inline-flex items-center gap-0.5 shrink-0">Configure <ExternalLink size={11} /></a>}
              </div>
            ))}
          </div>
        </Card>
      </div>

      {isAdmin && (
        <Card className="p-4">
          <div className="text-sm font-semibold text-[var(--text-primary)] mb-3 flex items-center gap-1.5">
            <Mail size={15} /> User-specific SMTP Configurations (Admin Only)
          </div>
          
          {/* Form */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5 p-4 rounded-lg bg-[var(--bg-card)] border border-[var(--border)]">
            <div className="flex flex-col gap-2.5">
              <label className="text-xs font-medium text-[var(--text-secondary)] flex flex-col gap-1">
                Select User
                <select 
                  value={selectedUserId} 
                  onChange={e => {
                    setSelectedUserId(e.target.value);
                    const existing = userSmtpConfigs.find(c => c.user_id === e.target.value);
                    if (existing) {
                      setSmtpHost(existing.host);
                      setSmtpPort(existing.port);
                      setSmtpUsername(existing.username);
                      setSmtpPassword(existing.password);
                      setSmtpSenderEmail(existing.sender_email);
                    } else {
                      setSmtpHost('');
                      setSmtpPort(587);
                      setSmtpUsername('');
                      setSmtpPassword('');
                      setSmtpSenderEmail('');
                    }
                  }}
                  className="w-full h-9 px-2 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] text-sm"
                >
                  <option value="">-- Choose a user --</option>
                  {directory.map(u => (
                    <option key={u.id} value={u.id}>{u.full_name} ({u.role})</option>
                  ))}
                </select>
              </label>
              
              <label className="text-xs font-medium text-[var(--text-secondary)] flex flex-col gap-1">
                SMTP Host
                <input 
                  type="text" 
                  value={smtpHost} 
                  onChange={e => setSmtpHost(e.target.value)} 
                  placeholder="smtp.mailtrap.io" 
                  className="w-full h-9 px-3 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] text-sm" 
                />
              </label>

              <label className="text-xs font-medium text-[var(--text-secondary)] flex flex-col gap-1">
                SMTP Port
                <input 
                  type="number" 
                  value={smtpPort} 
                  onChange={e => setSmtpPort(parseInt(e.target.value) || 587)} 
                  placeholder="587" 
                  className="w-full h-9 px-3 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] text-sm" 
                />
              </label>
            </div>

            <div className="flex flex-col gap-2.5">
              <label className="text-xs font-medium text-[var(--text-secondary)] flex flex-col gap-1">
                Sender Email
                <input 
                  type="email" 
                  value={smtpSenderEmail} 
                  onChange={e => setSmtpSenderEmail(e.target.value)} 
                  placeholder="user@company.com" 
                  className="w-full h-9 px-3 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] text-sm" 
                />
              </label>

              <label className="text-xs font-medium text-[var(--text-secondary)] flex flex-col gap-1">
                SMTP Username
                <input 
                  type="text" 
                  value={smtpUsername} 
                  onChange={e => setSmtpUsername(e.target.value)} 
                  placeholder="smtp-user" 
                  className="w-full h-9 px-3 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] text-sm" 
                />
              </label>

              <label className="text-xs font-medium text-[var(--text-secondary)] flex flex-col gap-1">
                SMTP Password
                <input 
                  type="password" 
                  value={smtpPassword} 
                  onChange={e => setSmtpPassword(e.target.value)} 
                  placeholder="••••••••" 
                  className="w-full h-9 px-3 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] text-sm" 
                />
              </label>
            </div>

            <div className="md:col-span-2 flex justify-end gap-2 mt-2">
              {selectedUserId && userSmtpConfigs.some(c => c.user_id === selectedUserId) && (
                <Button 
                  variant="secondary" 
                  onClick={async () => {
                    if (confirm('Are you sure you want to remove SMTP config for this user?')) {
                      const ok = await commsService.deleteUserSmtpConfig(selectedUserId);
                      if (ok) {
                        setSelectedUserId('');
                        setSmtpHost('');
                        setSmtpPort(587);
                        setSmtpUsername('');
                        setSmtpPassword('');
                        setSmtpSenderEmail('');
                        loadSmtp();
                      } else {
                        alert('Failed to delete config.');
                      }
                    }
                  }}
                >
                  Delete Config
                </Button>
              )}
              <Button 
                variant="primary" 
                isLoading={savingSmtp} 
                disabled={!selectedUserId || !smtpHost || !smtpUsername || !smtpPassword || !smtpSenderEmail}
                onClick={async () => {
                  setSavingSmtp(true);
                  const ok = await commsService.saveUserSmtpConfig(
                    selectedUserId, 
                    smtpHost, 
                    smtpPort, 
                    smtpUsername, 
                    smtpPassword, 
                    smtpSenderEmail
                  );
                  setSavingSmtp(false);
                  if (ok) {
                    loadSmtp();
                    alert('SMTP configuration saved successfully!');
                  } else {
                    alert('Failed to save configuration.');
                  }
                }}
              >
                Save Configuration
              </Button>
            </div>
          </div>

          {/* List of Configured Users */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-left text-[var(--text-tertiary)] text-xs">
                  <th className="p-2.5">User</th>
                  <th className="p-2.5">Sender Email</th>
                  <th className="p-2.5">Host</th>
                  <th className="p-2.5">Port</th>
                  <th className="p-2.5">Updated</th>
                </tr>
              </thead>
              <tbody>
                {userSmtpConfigs.map(c => (
                  <tr 
                    key={c.user_id} 
                    className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-hover)] cursor-pointer"
                    onClick={() => {
                      setSelectedUserId(c.user_id);
                      setSmtpHost(c.host);
                      setSmtpPort(c.port);
                      setSmtpUsername(c.username);
                      setSmtpPassword(c.password);
                      setSmtpSenderEmail(c.sender_email);
                    }}
                  >
                    <td className="p-2.5 font-medium text-[var(--text-primary)]">{c.user_name}</td>
                    <td className="p-2.5 text-xs text-[var(--text-secondary)]">{c.sender_email}</td>
                    <td className="p-2.5 text-xs text-[var(--text-secondary)]">{c.host}</td>
                    <td className="p-2.5 text-xs text-[var(--text-secondary)]">{c.port}</td>
                    <td className="p-2.5 text-[10px] text-[var(--text-tertiary)]">
                      {new Date(c.updated_at).toLocaleString('en-AE', { dateStyle: 'short', timeStyle: 'short' })}
                    </td>
                  </tr>
                ))}
                {userSmtpConfigs.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-4 text-center text-xs text-[var(--text-tertiary)]">
                      No user-specific SMTP configurations defined yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Permissions */}
      <Card className="p-4">
        <div className="text-sm font-semibold text-[var(--text-primary)] mb-2 flex items-center gap-1.5"><ShieldCheck size={15} /> Posting permissions</div>
        <div className="text-xs text-[var(--text-secondary)] grid grid-cols-1 md:grid-cols-2 gap-2">
          <div className="p-3 rounded-lg border border-[var(--border)]"><div className="font-medium text-[var(--text-primary)] mb-1">Company announcements</div>admin · manager · general manager can publish; everyone can read.</div>
          <div className="p-3 rounded-lg border border-[var(--border)]"><div className="font-medium text-[var(--text-primary)] mb-1">Channels & rooms</div>Everyone can join department channels and post. Groups & DMs are private to their members.</div>
        </div>
        <div className="text-[11px] text-[var(--text-tertiary)] mt-2">Note: chat data uses the collaborative RLS model (internal trusted team). Harden with per-conversation RLS keyed to membership before exposing to less-trusted users.</div>
      </Card>
    </div>
  );
}
