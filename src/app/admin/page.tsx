'use client';

// ============================================================
// JEET ERP — Administration Center Hub
// Central entry point to every platform configuration area.
// ============================================================

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { PageHeader } from '@/components/ui/PageHeader';
import {
  Settings, Users, GitBranch, Hash, Scale, FormInput,
  FileText, Bell, AlertTriangle, ArrowRight, Shield, Database,
} from 'lucide-react';

const ADMIN_SECTIONS = [
  {
    group: 'Access & Identity',
    items: [
      { href: '/admin/settings?tab=USERS_ROLES', title: 'Users, Roles & Permissions', desc: 'Create users, custom roles, and configure module/action permissions with scopes', icon: Users },
      { href: '/admin/settings?tab=SESSIONS', title: 'Sessions & Account Access', desc: 'Sign-in activity, force sign-out, ban and unban accounts', icon: Shield },
    ],
  },
  {
    group: 'Process Platform',
    items: [
      { href: '/admin/workflows', title: 'Workflow Builder', desc: 'Visual status pipelines, transitions, approval matrix, SLA and escalations per module', icon: GitBranch },
      { href: '/admin/rules', title: 'Business Rules', desc: 'IF/THEN rules: approval thresholds, blocks, escalations and notifications', icon: Scale },
      { href: '/admin/numbering', title: 'Document Numbering', desc: 'Configurable numbering formats per module: MAR-2026-0001, LPO-2026-0001…', icon: Hash },
      { href: '/admin/forms', title: 'Forms Builder', desc: 'Dynamic form layouts: tabs, sections, fields, validation and conditional logic', icon: FormInput },
      { href: '/admin/templates', title: 'Document Templates', desc: 'PDF templates with headers, footers, watermarks, signatures and live variables', icon: FileText },
    ],
  },
  {
    group: 'System Configuration',
    items: [
      { href: '/admin/settings', title: 'Global Settings', desc: 'Company profile, finance & VAT, procurement thresholds, SLA, integrations, security', icon: Settings },
      { href: '/admin/settings?tab=NOTIFICATIONS', title: 'Notification Center', desc: 'Channel configuration and alert preferences across all modules', icon: Bell },
      { href: '/admin/audit', title: 'Audit Log', desc: 'Forensic trail of every change: who, what, when, before and after', icon: AlertTriangle },
    ],
  },
];

export default function AdminCenterPage() {
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    const check = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace('/signin'); return; }
      const { data: profile } = await supabase
        .from('profiles').select('role').eq('id', user.id).maybeSingle();
      setIsAdmin(profile?.role === 'admin');
    };
    check();
  }, [router]);

  if (isAdmin === null) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="h-7 w-7 border-2 border-[var(--border-color)] border-t-[var(--text-primary)] animate-spin rounded-full" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-3 text-center">
        <Shield size={32} className="text-[var(--text-muted)]" />
        <h2 className="text-base font-semibold text-[var(--text-primary)]">Administrator access required</h2>
        <p className="text-sm text-[var(--text-muted)] max-w-sm">
          This area is restricted to system administrators. Contact your administrator if you need access.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Administration Center"
        subtitle="Configure every aspect of the ERP — workflows, permissions, forms, templates and parameters — with no code changes"
      />

      {ADMIN_SECTIONS.map(section => (
        <div key={section.group} className="flex flex-col gap-3">
          <h2 className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">
            {section.group}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {section.items.map(item => {
              const Icon = item.icon;
              return (
                <Link key={item.href} href={item.href} className="no-underline group">
                  <div className="bg-[var(--bg-card)] border border-[var(--border-color)] hover:border-[var(--text-muted)] rounded-lg p-4 h-full flex flex-col gap-2.5 transition-colors duration-100">
                    <div className="flex items-center justify-between">
                      <div className="h-8 w-8 rounded-md bg-[var(--bg-dark)] border border-[var(--border-color)] flex items-center justify-center">
                        <Icon size={15} className="text-[var(--text-secondary)]" />
                      </div>
                      <ArrowRight size={13} className="text-[var(--text-muted)] opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-[var(--text-primary)]">{item.title}</h3>
                      <p className="text-xs text-[var(--text-muted)] mt-1 leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      ))}

      <div className="flex gap-2.5 bg-[var(--status-info-bg)] border border-[var(--status-info-border)] rounded-lg p-3.5 text-xs items-start">
        <Database size={14} className="flex-shrink-0 mt-0.5 text-[var(--status-info-text)]" />
        <div className="text-[var(--status-info-text)]">
          <strong className="font-medium">One-time setup:</strong> the Process Platform requires the
          migration <code className="font-mono">supabase/migrations/20260612090000_admin_platform_engine.sql</code> to
          be applied in the Supabase SQL editor. Run <code className="font-mono">node scripts/verify-platform.mjs</code> to check.
        </div>
      </div>
    </div>
  );
}
