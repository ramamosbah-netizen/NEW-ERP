'use client';

// ============================================================
// JEET ERP — Access Control (merged: Roles & Access + Permissions Matrix)
// One admin page, two tabs. Deep-linkable via ?tab=roles|permissions.
// (/admin/permissions redirects here.) Reads the tab client-side to avoid
// the useSearchParams CSR-bailout during static prerender.
// ============================================================

import React, { useState, useEffect } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Tabs } from '@/components/ui/Tabs';
import AccessRolesTab from './AccessRolesTab';
import PermissionsTab from './PermissionsTab';

type TabKey = 'roles' | 'permissions';

export default function AccessControlPage() {
  const [tab, setTab] = useState<TabKey>('roles');

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('tab');
    if (t === 'permissions') setTab('permissions');
  }, []);

  const change = (k: string) => {
    setTab(k as TabKey);
    window.history.replaceState(null, '', `/admin/access?tab=${k}`);
  };

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Access Control"
        subtitle="Roles, hierarchy and the permissions each role carries"
        breadcrumbs={[{ label: 'Administration', href: '/admin/hub' }, { label: 'Access Control' }]}
      />
      <Tabs
        tabs={[{ key: 'roles', label: 'Roles & Access' }, { key: 'permissions', label: 'Permissions Matrix' }]}
        value={tab}
        onChange={change}
      />
      {tab === 'roles' ? <AccessRolesTab /> : <PermissionsTab />}
    </div>
  );
}
