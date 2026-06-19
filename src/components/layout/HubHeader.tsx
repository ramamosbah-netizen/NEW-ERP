// ============================================================
// JEET ERP — Hub header with module title + grouped section tabs
// Rendered once in AppShell above page content. Driven by the central
// HUBS config; replaces per-page sub-navigation. Routes are unchanged.
//
// UX: long tab lists are split into labelled clusters (tab.group) and the
// strip gains overflow affordances — edge fades + scroll chevrons — so no
// section is ever hidden off-screen.
// ============================================================

'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { usePermissions } from '@/lib/permissions/usePermissions';
import { isRouteAllowed } from '@/lib/permissions/routeAccess';
import { findHub, findActiveTab, shouldHideHubHeader, type HubTab } from './hubs';

// Pure: decorate each tab with whether it starts a new group (and the first one).
// Kept out of render so the group-tracking locals never mutate render scope.
function decorateTabs(tabs: HubTab[], grouped: boolean) {
  let prev: string | undefined;
  let firstSeen = false;
  return tabs.map(tab => {
    const newGroup = grouped && !!tab.group && tab.group !== prev;
    const isFirst = newGroup && !firstSeen;
    if (newGroup) { prev = tab.group; firstSeen = true; }
    return { tab, newGroup, isFirst };
  });
}

export default function HubHeader() {
  const pathname = usePathname();
  const { role } = usePermissions();
  const stripRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLAnchorElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });

  const hub = shouldHideHubHeader(pathname) ? null : findHub(pathname);
  const activeTab = hub ? findActiveTab(hub, pathname) : null;

  const measure = useCallback(() => {
    const el = stripRef.current;
    if (!el) return;
    setEdges({
      left: el.scrollLeft > 4,
      right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4,
    });
  }, []);

  // Keep the active tab in view + remeasure overflow on navigation.
  useEffect(() => {
    activeRef.current?.scrollIntoView({ inline: 'center', block: 'nearest' });
    const raf = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(raf);
  }, [pathname, measure]);

  // Track overflow as the strip scrolls / the window resizes.
  useEffect(() => {
    const el = stripRef.current;
    if (!el) return;
    const raf = requestAnimationFrame(measure);
    el.addEventListener('scroll', measure, { passive: true });
    window.addEventListener('resize', measure);
    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener('scroll', measure);
      window.removeEventListener('resize', measure);
    };
  }, [hub, measure]);

  if (!hub) return null;

  const Icon = hub.icon;
  const tabs = hub.tabs.filter(t => isRouteAllowed(role, t.href));
  const grouped = tabs.some(t => t.group);
  const nudge = (dir: number) => stripRef.current?.scrollBy({ left: dir * 260, behavior: 'smooth' });

  const items = decorateTabs(tabs, grouped);

  return (
    <div className="hub-header">
      <div className="hub-header-title">
        <span className="hub-header-icon"><Icon size={16} /></span>
        <span>{hub.label}</span>
      </div>

      <div className={`hub-tabs-wrap${edges.left ? ' edge-left' : ''}${edges.right ? ' edge-right' : ''}`}>
        <button
          type="button"
          className="hub-scroll-btn left"
          onClick={() => nudge(-1)}
          aria-label="Scroll sections left"
          tabIndex={-1}
        >
          <ChevronLeft size={15} />
        </button>

        <nav className="hub-tabs" ref={stripRef} aria-label={`${hub.label} sections`}>
          {items.map(({ tab, newGroup, isFirst }) => {
            const active = activeTab?.href === tab.href;
            return (
              <React.Fragment key={tab.href}>
                {newGroup && (
                  <span className={`hub-tab-group${isFirst ? ' first' : ''}`} aria-hidden="true">
                    {tab.group}
                  </span>
                )}
                <Link
                  href={tab.href}
                  ref={active ? activeRef : undefined}
                  className={`hub-tab${active ? ' active' : ''}`}
                  aria-current={active ? 'page' : undefined}
                >
                  {tab.label}
                </Link>
              </React.Fragment>
            );
          })}
        </nav>

        <button
          type="button"
          className="hub-scroll-btn right"
          onClick={() => nudge(1)}
          aria-label="Scroll sections right"
          tabIndex={-1}
        >
          <ChevronRight size={15} />
        </button>
      </div>
    </div>
  );
}
