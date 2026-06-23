'use client';

// ============================================================
// JEET ERP — Workflows & Rules (merged: Designer + Analytics + Business Rules)
// One admin page, three tabs. Deep-linkable via ?tab=designer|analytics|rules.
// (/admin/workflows/analytics and /admin/rules redirect here.)
// The per-workflow editor stays at /admin/workflows/[id].
// ============================================================

import React, { useState, useEffect } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Tabs } from '@/components/ui/Tabs';
import WorkflowDesignerTab from './WorkflowDesignerTab';
import WorkflowAnalyticsTab from './WorkflowAnalyticsTab';
import RulesTab from './RulesTab';

type TabKey = 'designer' | 'analytics' | 'rules';
const VALID: TabKey[] = ['designer', 'analytics', 'rules'];

export default function WorkflowsPage() {
  const [tab, setTab] = useState<TabKey>('designer');

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('tab') as TabKey | null;
    if (t && VALID.includes(t)) setTab(t);
  }, []);

  const change = (k: string) => {
    setTab(k as TabKey);
    window.history.replaceState(null, '', `/admin/workflows?tab=${k}`);
  };

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Workflows & Rules"
        subtitle="Design status pipelines and approvals, monitor running instances, and configure IF/THEN business rules"
        breadcrumbs={[{ label: 'Administration', href: '/admin/hub' }, { label: 'Workflows & Rules' }]}
      />
      <Tabs
        tabs={[{ key: 'designer', label: 'Designer' }, { key: 'analytics', label: 'Analytics' }, { key: 'rules', label: 'Rules' }]}
        value={tab}
        onChange={change}
      />
      {tab === 'designer' ? <WorkflowDesignerTab /> : tab === 'analytics' ? <WorkflowAnalyticsTab /> : <RulesTab />}
    </div>
  );
}
