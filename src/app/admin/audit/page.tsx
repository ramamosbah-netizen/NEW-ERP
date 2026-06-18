'use client';

// ============================================================
// JEET ERP — Audit (merged: Log + Investigation + Activity Analytics + Configuration Audit)
// One admin page, four tabs. Deep-linkable via ?tab=log|investigation|analytics|configuration.
// (/admin/audit/analytics and /admin/configuration redirect here.)
// ============================================================

import React, { useState, useEffect } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Tabs } from '@/components/ui/Tabs';
import AuditLogTab from './AuditLogTab';
import AuditInvestigationTab from './AuditInvestigationTab';
import AuditAnalyticsTab from './AuditAnalyticsTab';
import ConfigurationTab from './ConfigurationTab';

type TabKey = 'log' | 'investigation' | 'analytics' | 'configuration';
const VALID: TabKey[] = ['log', 'investigation', 'analytics', 'configuration'];

export default function AuditPage() {
  const [tab, setTab] = useState<TabKey>('log');

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('tab') as TabKey | null;
    if (t && VALID.includes(t)) setTab(t);
  }, []);

  const change = (k: string) => {
    setTab(k as TabKey);
    window.history.replaceState(null, '', `/admin/audit?tab=${k}`);
  };

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Audit"
        subtitle="Immutable activity ledger, trends, and platform configuration inventory"
        breadcrumbs={[{ label: 'Administration', href: '/admin/hub' }, { label: 'Audit' }]}
      />
      <Tabs
        tabs={[{ key: 'log', label: 'Log' }, { key: 'investigation', label: 'Investigation' }, { key: 'analytics', label: 'Analytics' }, { key: 'configuration', label: 'Configuration' }]}
        value={tab}
        onChange={change}
      />
      {tab === 'log' ? <AuditLogTab />
        : tab === 'investigation' ? <AuditInvestigationTab />
        : tab === 'analytics' ? <AuditAnalyticsTab />
        : <ConfigurationTab />}
    </div>
  );
}
