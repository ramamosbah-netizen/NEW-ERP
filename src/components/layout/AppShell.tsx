// ============================================================
// JEET ERP — App Shell (Sidebar + Topbar + Content Area)
// Wraps authenticated pages with navigation layout
// ============================================================

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import AppSidebar, { NAV_SECTIONS } from './AppSidebar';
import AppTopbar from './AppTopbar';
import { CommandPalette } from '@/components/ui/CommandPalette';
import settingsService from '@/services/settingsService';
import { usePermissions } from '@/lib/permissions/usePermissions';
import { isRouteAllowed } from '@/lib/permissions/routeAccess';
import './layout.css';

// Routes that should NOT show the shell (auth pages)
const NO_SHELL_ROUTES = ['/signin', '/signup'];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { role, loading: permsLoading } = usePermissions();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [enabledModules, setEnabledModules] = useState<Record<string, boolean>>({});

  // Sync enabled modules configuration globally from database settings
  useEffect(() => {
    const loadModules = async () => {
      // 1. Quick initial cache load
      try {
        const cached = localStorage.getItem('erp-enabled-modules');
        if (cached) {
          setEnabledModules(JSON.parse(cached));
        }
      } catch {}

      // 2. Fetch fresh global modules settings from database
      try {
        const globalModules = await settingsService.getSettingByKey<Record<string, boolean>>('system.enabled_modules', {});
        setEnabledModules(globalModules);
        localStorage.setItem('erp-enabled-modules', JSON.stringify(globalModules));
      } catch (err) {
        console.error('AppShell failed to fetch global modules config:', err);
      }
    };
    
    loadModules();
    
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'erp-enabled-modules') {
        loadModules();
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('erp-modules-updated', loadModules);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('erp-modules-updated', loadModules);
    };
  }, []);

  // Sync sidebar state from localStorage (same key as AppSidebar)
  useEffect(() => {
    try {
      const saved = localStorage.getItem('erp-sidebar-collapsed');
      if (saved !== null) setSidebarCollapsed(JSON.parse(saved));
    } catch {
      // Ignore
    }

    // Listen for sidebar toggle changes
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'erp-sidebar-collapsed' && e.newValue !== null) {
        setSidebarCollapsed(JSON.parse(e.newValue));
      }
    };
    window.addEventListener('storage', handleStorage);

    // Also observe the sidebar element for class changes
    const observer = new MutationObserver(() => {
      const sidebar = document.getElementById('erp-sidebar');
      if (sidebar) {
        setSidebarCollapsed(sidebar.classList.contains('collapsed'));
      }
    });

    const sidebar = document.getElementById('erp-sidebar');
    if (sidebar) {
      observer.observe(sidebar, { attributes: true, attributeFilter: ['class'] });
    }

    return () => {
      window.removeEventListener('storage', handleStorage);
      observer.disconnect();
    };
  }, []);

  // Close mobile menu on navigation
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const handleMobileToggle = useCallback(() => {
    setMobileOpen(prev => !prev);
  }, []);

  // Check if current route is an auth route — render without shell
  const isAuthRoute = NO_SHELL_ROUTES.some(
    route => pathname === route || pathname?.startsWith(route + '/')
  );

  if (isAuthRoute) {
    return <>{children}</>;
  }

  // Root route (/) is a redirect page — render without shell
  if (pathname === '/') {
    return <>{children}</>;
  }

  // Check if current path belongs to a disabled module
  const isModuleDisabled = NAV_SECTIONS.some(section =>
    section.items.some(item => {
      const isPathMatch = pathname === item.href || pathname?.startsWith(item.href + '/');
      return isPathMatch && enabledModules[item.href] === false;
    })
  );

  if (isModuleDisabled) {
    return (
      <div className="erp-shell">
        <AppSidebar mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} />
        <div className={`erp-shell-main ${sidebarCollapsed ? 'sidebar-collapsed' : 'sidebar-expanded'}`}>
          <AppTopbar onMobileMenuToggle={handleMobileToggle} />
          <main className="erp-shell-content flex-1 flex flex-col items-center justify-center p-6 text-center text-slate-100 bg-slate-950 min-h-[calc(100vh-60px)]">
            <div className="p-8 bg-slate-900/30 border border-slate-900/80 rounded-2xl flex flex-col items-center max-w-md gap-4 shadow-2xl backdrop-blur-md">
              <div className="rounded-2xl bg-amber-500/10 p-4 border border-amber-500/20 shadow-inner">
                <AlertTriangle className="text-amber-450 animate-pulse" size={36} />
              </div>
              <h2 className="text-lg font-bold tracking-tight text-slate-150">Module Temporarily Disabled</h2>
              <p className="text-xs text-slate-500 leading-relaxed">
                This feature module has been globally deactivated by the system administrator. If you require access, please contact your administration desk.
              </p>
              <Link
                href="/dashboard"
                className="mt-2 bg-gradient-to-r from-emerald-500 to-emerald-600 text-slate-950 font-bold px-5 py-2 rounded-lg text-xs hover:from-emerald-400 hover:to-emerald-500 transition-all shadow-lg shadow-emerald-500/10 active:scale-98 select-none"
              >
                Back to Dashboard
              </Link>
            </div>
          </main>
        </div>
        <CommandPalette />
      </div>
    );
  }

  // Role-based route fence: restricted roles (e.g. accountant) can only reach
  // their allowed sections. Unrestricted roles & admin pass through unchanged.
  if (!permsLoading && pathname && !isRouteAllowed(role, pathname)) {
    return (
      <div className="erp-shell">
        <AppSidebar mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} />
        <div className={`erp-shell-main ${sidebarCollapsed ? 'sidebar-collapsed' : 'sidebar-expanded'}`}>
          <AppTopbar onMobileMenuToggle={handleMobileToggle} />
          <main className="erp-shell-content flex-1 flex flex-col items-center justify-center p-6 text-center text-slate-100 bg-slate-950 min-h-[calc(100vh-60px)]">
            <div className="p-8 bg-slate-900/30 border border-slate-900/80 rounded-2xl flex flex-col items-center max-w-md gap-4 shadow-2xl backdrop-blur-md">
              <div className="rounded-2xl bg-red-500/10 p-4 border border-red-500/20 shadow-inner">
                <AlertTriangle className="text-red-400" size={36} />
              </div>
              <h2 className="text-lg font-bold tracking-tight text-slate-150">Access Restricted</h2>
              <p className="text-xs text-slate-500 leading-relaxed">
                Your role ({role}) doesn&apos;t have access to this section. Contact your administrator if you need it.
              </p>
              <Link
                href="/finance"
                className="mt-2 bg-gradient-to-r from-emerald-500 to-emerald-600 text-slate-950 font-bold px-5 py-2 rounded-lg text-xs hover:from-emerald-400 hover:to-emerald-500 transition-all shadow-lg shadow-emerald-500/10 active:scale-98 select-none"
              >
                Go to my workspace
              </Link>
            </div>
          </main>
        </div>
        <CommandPalette />
      </div>
    );
  }

  return (
    <div className="erp-shell">
      <AppSidebar mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} />

      <div
        className={`erp-shell-main ${
          sidebarCollapsed ? 'sidebar-collapsed' : 'sidebar-expanded'
        }`}
      >
        <AppTopbar onMobileMenuToggle={handleMobileToggle} />
        <main className="erp-shell-content">
          {children}
        </main>
      </div>
      <CommandPalette />
    </div>
  );
}
