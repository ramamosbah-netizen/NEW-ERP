// ============================================================
// JEET ERP — Hub header with module title + header tabs
// Rendered once in AppShell above page content. Driven by the central
// HUBS config; replaces per-page sub-navigation. Routes are unchanged.
// ============================================================

'use client';

import React, { useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { usePermissions } from '@/lib/permissions/usePermissions';
import { isRouteAllowed } from '@/lib/permissions/routeAccess';
import { findHub, findActiveTab, shouldHideHubHeader } from './hubs';

export default function HubHeader() {
  const pathname = usePathname();
  const { role } = usePermissions();
  const stripRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLAnchorElement>(null);

  const hub = shouldHideHubHeader(pathname) ? null : findHub(pathname);
  const activeTab = hub ? findActiveTab(hub, pathname) : null;

  // Keep the active tab in view on navigation.
  useEffect(() => {
    activeRef.current?.scrollIntoView({ inline: 'center', block: 'nearest' });
  }, [pathname]);

  if (!hub) return null;

  const Icon = hub.icon;
  const tabs = hub.tabs.filter(t => isRouteAllowed(role, t.href));

  return (
    <div className="hub-header">
      <div className="hub-header-title">
        <span className="hub-header-icon"><Icon size={16} /></span>
        <span>{hub.label}</span>
      </div>
      <nav className="hub-tabs" ref={stripRef} aria-label={`${hub.label} sections`}>
        {tabs.map(tab => {
          const active = activeTab?.href === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              ref={active ? activeRef : undefined}
              className={`hub-tab ${active ? 'active' : ''}`}
              aria-current={active ? 'page' : undefined}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
